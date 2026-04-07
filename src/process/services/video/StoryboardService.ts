/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import type { Shot, Storyboard } from '@/common/types/videoCreation';
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
    return JSON.parse(raw) as Storyboard;
  }

  /** 更新 storyboard.json 的元数据（不修改 shotIds） */
  async updateStoryboard(projectRoot: string, patch: Partial<Storyboard>): Promise<void> {
    return this.enqueue(async () => {
      const paths = getProjectPaths(projectRoot);
      const current = await this.readStoryboard(projectRoot);
      const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
      await fs.writeFile(paths.storyboardJson, JSON.stringify(updated, null, 2), 'utf-8');
    });
  }

  /** 读取单个 shot */
  async readShot(projectRoot: string, shotId: string): Promise<Shot> {
    const shotPath = this.getShotPath(projectRoot, shotId);
    const raw = await fs.readFile(shotPath, 'utf-8');
    return JSON.parse(raw) as Shot;
  }

  /** 读取所有 shot（按 storyboard.json 中 shotIds 顺序） */
  async readAllShots(projectRoot: string): Promise<Shot[]> {
    const storyboard = await this.readStoryboard(projectRoot);
    const shots = await Promise.all(storyboard.shotIds.map((id) => this.readShot(projectRoot, id)));
    return shots;
  }

  /** 写入单个 shot（串行队列保护） */
  async writeShot(projectRoot: string, shot: Shot): Promise<void> {
    return this.enqueue(async () => {
      const shotPath = this.getShotPath(projectRoot, shot.id);
      const withTs = { ...shot };
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

    const newIndex = existingShots.length;
    const newId = `shot-${String(newIndex + 1).padStart(3, '0')}`;

    const newShot: Shot = {
      id: newId,
      sceneIndex: partial.sceneIndex ?? 0,
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

    return newShot;
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
  }

  /** 重新排序 shot（拖拽后调用），更新 storyboard.json 中的 shotIds */
  async reorderShots(projectRoot: string, orderedIds: string[]): Promise<void> {
    const paths = getProjectPaths(projectRoot);
    return this.enqueue(async () => {
      const current = JSON.parse(await fs.readFile(paths.storyboardJson, 'utf-8')) as Storyboard;
      const updated = { ...current, shotIds: orderedIds, updatedAt: new Date().toISOString() };
      await fs.writeFile(paths.storyboardJson, JSON.stringify(updated, null, 2), 'utf-8');
    });
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
