/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import type { SceneInfo, Shot, Storyboard } from '@/common/types/videoCreation';
import { getProjectPaths } from './ProjectLayout';

/**
 * 分镜管理服务
 * 负责 storyboard.json 和 shot-XXX.json 的读写
 * 内部维护写入串行队列，避免并发写冲突
 */
export class StoryboardService {
  private writeQueue: Promise<void> = Promise.resolve();

  /** 读取 storyboard.json 总览（不含 shot 详情） */
  async readStoryboard(projectRoot: string): Promise<Storyboard> {
    const paths = getProjectPaths(projectRoot);
    const raw = await fs.readFile(paths.storyboardJson, 'utf-8');
    return this.normalizeStoryboard(JSON.parse(raw) as Storyboard);
  }

  /** 更新 storyboard.json 的元数据（不修改 shotIds） */
  async updateStoryboard(projectRoot: string, patch: Partial<Storyboard>): Promise<void> {
    return this.enqueue(async () => {
      const paths = getProjectPaths(projectRoot);
      const current = await this.readStoryboard(projectRoot);
      const updated = this.normalizeStoryboard({ ...current, ...patch, updatedAt: new Date().toISOString() });
      await fs.writeFile(paths.storyboardJson, JSON.stringify(updated, null, 2), 'utf-8');
    });
  }

  /** 读取单个 shot */
  async readShot(projectRoot: string, shotId: string): Promise<Shot> {
    const parsed = await this.readRawShot(projectRoot, shotId);
    return this.normalizeShot(parsed, parsed.sceneId ?? this.sceneIdFromIndex(parsed.sceneIndex), parsed.sceneIndex);
  }

  /** 读取所有 shot（按 storyboard.json 中 shotIds 顺序） */
  async readAllShots(projectRoot: string): Promise<Shot[]> {
    const storyboard = await this.readStoryboard(projectRoot);
    const sceneIndexById = new Map<string, number>(storyboard.scenes.map((scene, index) => [scene.id, index]));
    const sceneShotCounter = new Map<string, number>();
    const rawShots = new Map<string, Shot>();

    const shots = await Promise.all(
      storyboard.shotIds.map(async (id, globalIndex) => {
        const rawShot = await this.readRawShot(projectRoot, id);
        rawShots.set(id, rawShot);
        const shot = this.normalizeShot(
          rawShot,
          rawShot.sceneId ?? this.sceneIdFromIndex(rawShot.sceneIndex),
          rawShot.sceneIndex
        );
        const fallbackSceneId = this.sceneIdFromIndex(shot.sceneIndex);
        const sceneId = shot.sceneId ?? this.findSceneIdByIndex(storyboard.scenes, shot.sceneIndex) ?? fallbackSceneId;
        const sceneIndex = sceneIndexById.get(sceneId) ?? shot.sceneIndex ?? 0;
        const sceneShotIndex = (sceneShotCounter.get(sceneId) ?? 0) + 1;
        sceneShotCounter.set(sceneId, sceneShotIndex);
        return this.normalizeShot(
          {
            ...shot,
            shotIndex: globalIndex + 1,
            sceneShotIndex,
          },
          sceneId,
          sceneIndex
        );
      })
    );

    await this.syncSceneShotIds(projectRoot, storyboard, shots, false, rawShots);
    return shots;
  }

  /** 按 scene 分组读取 shots（用于 Scene 视图） */
  async readShotsGroupedByScene(projectRoot: string): Promise<Array<{ scene: SceneInfo; shots: Shot[] }>> {
    const shots = await this.readAllShots(projectRoot);
    const storyboard = await this.readStoryboard(projectRoot);
    const byScene = new Map<string, Shot[]>();
    for (const shot of shots) {
      const sceneId = shot.sceneId ?? this.sceneIdFromIndex(shot.sceneIndex);
      const list = byScene.get(sceneId) ?? [];
      list.push(shot);
      byScene.set(sceneId, list);
    }

    return storyboard.scenes.map((scene) => ({
      scene: scene,
      shots: byScene.get(scene.id) ?? [],
    }));
  }

  /** 写入单个 shot（串行队列保护） */
  async writeShot(projectRoot: string, shot: Shot): Promise<void> {
    return this.enqueue(async () => {
      const storyboard = await this.readStoryboard(projectRoot);
      const sceneId = shot.sceneId ?? this.findSceneIdByIndex(storyboard.scenes, shot.sceneIndex) ?? 'scene-01';
      const sceneIndex =
        storyboard.scenes.findIndex((scene) => scene.id === sceneId) >= 0
          ? storyboard.scenes.findIndex((scene) => scene.id === sceneId)
          : shot.sceneIndex;
      const shotPath = this.getShotPath(projectRoot, shot.id);
      const withTs = this.normalizeShot(shot, sceneId, sceneIndex);
      await fs.writeFile(shotPath, JSON.stringify(withTs, null, 2), 'utf-8');
    });
  }

  /** 批量写入 shot */
  async writeShots(projectRoot: string, shots: Shot[]): Promise<void> {
    for (const shot of shots) {
      await this.writeShot(projectRoot, shot);
    }
  }

  /**
   * 新增 shot，自动分配 ID，插入到指定 shot 之后（after=null 则追加到末尾）
   * 同时更新 storyboard.json 中的 shotIds
   */
  async insertShot(projectRoot: string, after: string | null, partial: Partial<Shot>): Promise<Shot> {
    const paths = getProjectPaths(projectRoot);
    const storyboard = await this.readStoryboard(projectRoot);
    const existingShots = await this.readAllShots(projectRoot);

    const existingIds = new Set(existingShots.map((shot) => shot.id));
    let nextId = 1;
    while (existingIds.has(`shot-${String(nextId).padStart(3, '0')}`)) {
      nextId += 1;
    }
    const newId = `shot-${String(nextId).padStart(3, '0')}`;
    const newIndex = existingShots.length;

    const afterShot = after ? existingShots.find((shot) => shot.id === after) : undefined;
    const targetSceneId =
      partial.sceneId ??
      afterShot?.sceneId ??
      this.findSceneIdByIndex(storyboard.scenes, partial.sceneIndex ?? 0) ??
      storyboard.scenes[0]?.id ??
      'scene-01';
    const targetSceneIndex = Math.max(
      0,
      storyboard.scenes.findIndex((scene) => scene.id === targetSceneId)
    );

    const newShot: Shot = {
      id: newId,
      sceneId: targetSceneId,
      sceneIndex: targetSceneIndex,
      sceneShotIndex: partial.sceneShotIndex ?? 1,
      shotIndex: partial.shotIndex ?? newIndex,
      goal: partial.goal ?? '',
      sceneDescription: partial.sceneDescription ?? '',
      characters: partial.characters ?? [],
      action: partial.action ?? '',
      dialogue: partial.dialogue ?? '',
      shotType: partial.shotType ?? 'MS',
      cameraMove: partial.cameraMove ?? 'static',
      imagePrompt: partial.imagePrompt ?? '',
      videoPrompt: partial.videoPrompt ?? '',
      lockedTokens: partial.lockedTokens ?? [],
      continuityRefs: partial.continuityRefs ?? {},
      assetRefs: partial.assetRefs ?? [],
      duration: partial.duration ?? 4,
      status: 'pending',
      locked: false,
    };

    // 写入 shot 文件
    await this.writeShot(projectRoot, newShot);

    // 更新 storyboard.json 的 shotIds
    await this.enqueue(async () => {
      let newShotIds: string[];
      if (after === null) {
        newShotIds = [...storyboard.shotIds, newId];
      } else {
        const idx = storyboard.shotIds.indexOf(after);
        if (idx === -1) {
          newShotIds = [...storyboard.shotIds, newId];
        } else {
          newShotIds = [...storyboard.shotIds.slice(0, idx + 1), newId, ...storyboard.shotIds.slice(idx + 1)];
        }
      }
      const updated = { ...storyboard, shotIds: newShotIds, updatedAt: new Date().toISOString() };
      await fs.writeFile(paths.storyboardJson, JSON.stringify(updated, null, 2), 'utf-8');
    });

    await this.reindexShotsAndSyncScenes(projectRoot);
    return this.readShot(projectRoot, newId);
  }

  /** 删除 shot，同时从 storyboard.json 的 shotIds 中移除 */
  async deleteShot(projectRoot: string, shotId: string): Promise<void> {
    const paths = getProjectPaths(projectRoot);
    return this.enqueue(async () => {
      // 删除文件
      const shotPath = this.getShotPath(projectRoot, shotId);
      try {
        await fs.unlink(shotPath);
      } catch {
        // 文件不存在也继续
      }

      // 更新 storyboard.json
      const current = JSON.parse(await fs.readFile(paths.storyboardJson, 'utf-8')) as Storyboard;
      const updated = {
        ...current,
        shotIds: current.shotIds.filter((id) => id !== shotId),
        updatedAt: new Date().toISOString(),
      };
      await fs.writeFile(paths.storyboardJson, JSON.stringify(updated, null, 2), 'utf-8');
    });
    await this.reindexShotsAndSyncScenes(projectRoot);
  }

  /** 重新排序 shot（拖拽后调用），更新 storyboard.json 中的 shotIds */
  async reorderShots(projectRoot: string, orderedIds: string[]): Promise<void> {
    const paths = getProjectPaths(projectRoot);
    return this.enqueue(async () => {
      const current = JSON.parse(await fs.readFile(paths.storyboardJson, 'utf-8')) as Storyboard;
      const updated = { ...current, shotIds: orderedIds, updatedAt: new Date().toISOString() };
      await fs.writeFile(paths.storyboardJson, JSON.stringify(updated, null, 2), 'utf-8');
    });
    await this.reindexShotsAndSyncScenes(projectRoot);
  }

  /** 在同一 scene 内重排镜头顺序 */
  async reorderShotsInScene(projectRoot: string, sceneId: string, orderedIds: string[]): Promise<void> {
    const storyboard = await this.readStoryboard(projectRoot);
    const shots = await this.readAllShots(projectRoot);
    const sceneShotIds = shots.filter((shot) => shot.sceneId === sceneId).map((shot) => shot.id);
    if (sceneShotIds.length === 0) return;

    const filteredOrdered = orderedIds.filter((id) => sceneShotIds.includes(id));
    if (filteredOrdered.length !== sceneShotIds.length) return;

    const sortedShotSet = new Set(filteredOrdered);
    const finalOrder: string[] = [];
    let inserted = false;
    for (const shotId of storyboard.shotIds) {
      if (sortedShotSet.has(shotId)) {
        if (!inserted) {
          finalOrder.push(...filteredOrdered);
          inserted = true;
        }
      } else {
        finalOrder.push(shotId);
      }
    }
    await this.reorderShots(projectRoot, finalOrder);
  }

  /** 将多个 shot 的 status 更新为指定状态 */
  async updateShotStatuses(projectRoot: string, shotIds: string[], status: Shot['status']): Promise<void> {
    for (const shotId of shotIds) {
      const shot = await this.readShot(projectRoot, shotId);
      await this.writeShot(projectRoot, { ...shot, status });
    }
  }

  private getShotPath(projectRoot: string, shotId: string): string {
    const paths = getProjectPaths(projectRoot);
    return nodePath.join(paths.shotsDir, `${shotId}.json`);
  }

  private async readRawShot(projectRoot: string, shotId: string): Promise<Shot> {
    const shotPath = this.getShotPath(projectRoot, shotId);
    const raw = await fs.readFile(shotPath, 'utf-8');
    return JSON.parse(raw) as Shot;
  }

  private normalizeStoryboard(storyboard: Storyboard): Storyboard {
    const scenes = (storyboard.scenes ?? []).map((scene, index) => ({
      ...scene,
      id: scene.id || this.sceneIdFromIndex(index),
      name: scene.name || `Scene ${index + 1}`,
      description: scene.description || '',
      shotIds: scene.shotIds ?? [],
    }));
    return {
      ...storyboard,
      scenes,
      shotIds: storyboard.shotIds ?? [],
    };
  }

  private normalizeShot(shot: Shot, sceneId: string, sceneIndex: number): Shot {
    return {
      ...shot,
      sceneId,
      sceneIndex,
      sceneShotIndex: shot.sceneShotIndex ?? shot.shotIndex ?? 1,
    };
  }

  private sceneIdFromIndex(index: number): string {
    return `scene-${String(Math.max(1, index + 1)).padStart(2, '0')}`;
  }

  private findSceneIdByIndex(scenes: SceneInfo[], sceneIndex: number): string | undefined {
    if (sceneIndex >= 0 && sceneIndex < scenes.length) {
      return scenes[sceneIndex]?.id;
    }
    return undefined;
  }

  private async reindexShotsAndSyncScenes(projectRoot: string): Promise<void> {
    const storyboard = await this.readStoryboard(projectRoot);
    const shots = await Promise.all(storyboard.shotIds.map((id) => this.readShot(projectRoot, id)));

    const sceneIndexById = new Map<string, number>(storyboard.scenes.map((scene, index) => [scene.id, index]));
    const sceneShotCounter = new Map<string, number>();

    const normalizedShots = shots.map((shot, globalIndex) => {
      const sceneId = shot.sceneId ?? this.findSceneIdByIndex(storyboard.scenes, shot.sceneIndex) ?? 'scene-01';
      const sceneIndex = sceneIndexById.get(sceneId) ?? shot.sceneIndex ?? 0;
      const sceneShotIndex = (sceneShotCounter.get(sceneId) ?? 0) + 1;
      sceneShotCounter.set(sceneId, sceneShotIndex);

      return this.normalizeShot(
        {
          ...shot,
          shotIndex: globalIndex + 1,
          sceneShotIndex,
        },
        sceneId,
        sceneIndex
      );
    });

    await this.syncSceneShotIds(projectRoot, storyboard, normalizedShots, true);
  }

  private async syncSceneShotIds(
    projectRoot: string,
    storyboard: Storyboard,
    shots: Shot[],
    forceWrite = false,
    rawShots?: Map<string, Shot>
  ): Promise<void> {
    const paths = getProjectPaths(projectRoot);
    const orderedSceneIds: string[] = [];
    const sceneMap = new Map<string, SceneInfo>();
    for (const scene of storyboard.scenes) {
      sceneMap.set(scene.id, { ...scene, shotIds: [] });
      orderedSceneIds.push(scene.id);
    }

    for (const shot of shots) {
      const sceneId = shot.sceneId ?? this.sceneIdFromIndex(shot.sceneIndex);
      if (!sceneMap.has(sceneId)) {
        sceneMap.set(sceneId, {
          id: sceneId,
          name: `Scene ${orderedSceneIds.length + 1}`,
          description: shot.sceneDescription || '',
          shotIds: [],
        });
        orderedSceneIds.push(sceneId);
      }
      const scene = sceneMap.get(sceneId);
      if (!scene) continue;
      scene.shotIds = [...(scene.shotIds ?? []), shot.id];
    }

    const nextScenes = orderedSceneIds.map((sceneId, index) => {
      const scene = sceneMap.get(sceneId);
      if (!scene) {
        return {
          id: this.sceneIdFromIndex(index),
          name: `Scene ${index + 1}`,
          description: '',
          shotIds: [],
        };
      }
      return {
        ...scene,
        shotIds: scene.shotIds ?? [],
      };
    });

    const normalizedStoryboard = this.normalizeStoryboard({
      ...storyboard,
      scenes: nextScenes,
      shotIds: storyboard.shotIds,
      updatedAt: new Date().toISOString(),
    });

    const storyboardChanged =
      forceWrite ||
      JSON.stringify(storyboard.scenes.map((scene) => ({ ...scene, shotIds: scene.shotIds ?? [] }))) !==
        JSON.stringify(normalizedStoryboard.scenes);
    const normalizedShots = shots.map((shot) => {
      const currentScene = normalizedStoryboard.scenes.find((scene) => scene.id === shot.sceneId);
      const expectedSceneShotIndex = (currentScene?.shotIds ?? []).indexOf(shot.id) + 1;
      return {
        ...shot,
        shotIndex: storyboard.shotIds.indexOf(shot.id) + 1,
        sceneShotIndex: expectedSceneShotIndex > 0 ? expectedSceneShotIndex : shot.sceneShotIndex,
        sceneIndex:
          normalizedStoryboard.scenes.findIndex((scene) => scene.id === shot.sceneId) >= 0
            ? normalizedStoryboard.scenes.findIndex((scene) => scene.id === shot.sceneId)
            : shot.sceneIndex,
      };
    });

    const changedShots = normalizedShots.filter((shot) => {
      const raw = rawShots?.get(shot.id);
      if (!raw) return true;
      return (
        raw.shotIndex !== shot.shotIndex ||
        raw.sceneShotIndex !== shot.sceneShotIndex ||
        raw.sceneIndex !== shot.sceneIndex ||
        raw.sceneId !== shot.sceneId
      );
    });

    if (!storyboardChanged && changedShots.length === 0 && !forceWrite) return;

    await this.enqueue(async () => {
      for (const shot of changedShots) {
        await fs.writeFile(this.getShotPath(projectRoot, shot.id), JSON.stringify(shot, null, 2), 'utf-8');
      }
      await fs.writeFile(paths.storyboardJson, JSON.stringify(normalizedStoryboard, null, 2), 'utf-8');
    });
  }

  /** 串行执行写操作，避免并发冲突 */
  private enqueue(task: () => Promise<void>): Promise<void> {
    this.writeQueue = this.writeQueue
      .then(() => task())
      .catch((err) => {
        console.error('[StoryboardService] Write error:', err);
      });
    return this.writeQueue;
  }
}
