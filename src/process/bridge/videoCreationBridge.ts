/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as nodePath from 'node:path';
import * as fs from 'node:fs/promises';
import { videoCreation as videoCreationBridge } from '@/common/adapter/ipcBridge';
import type { Shot, ShotHistoryEntry, Storyboard, StoryboardStreamEvent } from '@/common/types/videoCreation';
import { initProjectLayout, getProjectPaths } from '@process/services/video/ProjectLayout';
import { ProjectMemoryService } from '@process/services/video/ProjectMemoryService';
import { StoryboardService } from '@process/services/video/StoryboardService';
import { videoCreationHarness } from '@process/task/video/VideoCreationHarness';
import { assetService, createSnapshot, listSnapshots, restoreSnapshot } from '@process/services/video/AssetService';

const storyboardService = new StoryboardService();
const projectMemoryService = new ProjectMemoryService();

export function initVideoCreationBridge(): void {
  // ── 解析剧本，初始化项目结构 ────────────────────────────────
  videoCreationBridge.parseScript.provider(async ({ projectRoot, scriptContent }) => {
    await initProjectLayout(projectRoot);

    const storyboard = await storyboardService.readStoryboard(projectRoot);
    const updated: Storyboard = {
      ...storyboard,
      updatedAt: new Date().toISOString(),
    };
    await storyboardService.updateStoryboard(projectRoot, updated);

    // 将剧本写入 00-script/script.md
    const paths = getProjectPaths(projectRoot);
    await fs.mkdir(nodePath.dirname(paths.script), { recursive: true });
    await fs.writeFile(paths.script, scriptContent, 'utf-8');

    return { projectRoot, storyboard: updated };
  });

  // ── 手动触发指定 Harness 阶段 ────────────────────────────────
  videoCreationBridge.runHarnessPhase.provider(async ({ projectRoot, phase, model }) => {
    return videoCreationHarness.runPhase(projectRoot, phase, model);
  });

  // ── 更新单个分镜（记录历史） ─────────────────────────────────
  videoCreationBridge.updateShot.provider(async ({ projectRoot, shotId, updates }) => {
    const existing = await storyboardService.readShot(projectRoot, shotId);
    const historyEntry: ShotHistoryEntry = {
      timestamp: new Date().toISOString(),
      imagePrompt: existing.imagePrompt,
      videoPrompt: existing.videoPrompt,
      imagePath: existing.imagePath,
      changedBy: 'user',
    };
    const history = [historyEntry, ...(existing.history ?? [])].slice(0, 10);
    const updated: Shot = { ...existing, ...updates, history };
    await storyboardService.writeShot(projectRoot, updated);

    const event: StoryboardStreamEvent = { type: 'shot-updated', shotId, shot: updated };
    videoCreationBridge.storyboardStream.emit(event);

    return updated;
  });

  // ── 批量生成分镜图片（T3.3） ─────────────────────────────────
  videoCreationBridge.generateShotImages.provider(async ({ projectRoot, shotIds, model }) => {
    const allShots = await storyboardService.readAllShots(projectRoot);
    const targets = shotIds ? allShots.filter((s) => shotIds.includes(s.id)) : allShots.filter((s) => !s.locked);

    if (targets.length === 0) return { succeeded: [], failed: [] };

    const targetIds = targets.map((s) => s.id);
    const result = await videoCreationHarness.runPhase(projectRoot, 'image_generate', model, targetIds);
    const succeeded = result.affectedShotIds;
    const failed = targetIds.filter((id) => !succeeded.includes(id));

    return { succeeded, failed };
  });

  // ── 生成最终视频（M4 VideoGenService） ───────────────────────
  videoCreationBridge.generateFinalVideo.provider(async ({ projectRoot, model }) => {
    const allShots = await storyboardService.readAllShots(projectRoot);
    const shotIds = allShots.map((s) => s.id);
    const result = await videoCreationHarness.runPhase(projectRoot, 'video_generate', model);
    const succeeded = result.affectedShotIds;
    const failed = shotIds.filter((id) => !succeeded.includes(id));
    return { succeeded, failed };
  });

  // ── 读取项目记忆 ─────────────────────────────────────────────
  videoCreationBridge.getProjectMemory.provider(async ({ projectRoot }) => {
    return projectMemoryService.read(projectRoot);
  });

  // ── Asset CRUD ───────────────────────────────────────────────
  videoCreationBridge.getAssets.provider(async ({ projectRoot }) => {
    return assetService.getAssets(projectRoot);
  });

  videoCreationBridge.createAsset.provider(async ({ projectRoot, type, data }) => {
    return assetService.createAsset(projectRoot, type, data);
  });

  videoCreationBridge.updateAsset.provider(async ({ projectRoot, type, id, data }) => {
    return assetService.updateAsset(projectRoot, type, id, data);
  });

  videoCreationBridge.deleteAsset.provider(async ({ projectRoot, type, id }) => {
    return assetService.deleteAsset(projectRoot, type, id);
  });

  videoCreationBridge.addAssetReferenceImages.provider(async (params) => {
    return assetService.addAssetReferenceImages(params);
  });

  videoCreationBridge.removeAssetReferenceImage.provider(async (params) => {
    return assetService.removeAssetReferenceImage(params);
  });

  videoCreationBridge.setPrimaryAssetReferenceImage.provider(async (params) => {
    return assetService.setPrimaryAssetReferenceImage(params);
  });

  videoCreationBridge.generateAssetThreeViewReference.provider(async (params) => {
    return assetService.generateAssetThreeViewReference(params);
  });

  videoCreationBridge.applyAssetToShots.provider(async ({ projectRoot, charId, shotIds }) => {
    return assetService.applyCharacterToShots(projectRoot, charId, shotIds);
  });

  videoCreationBridge.applyAssetsToShots.provider(async ({ projectRoot, assetIds, shotIds }) => {
    return assetService.applyAssetsToShots(projectRoot, assetIds, shotIds);
  });

  videoCreationBridge.removeAssetsFromShots.provider(async ({ projectRoot, assetIds, shotIds }) => {
    return assetService.removeAssetsFromShots(projectRoot, assetIds, shotIds);
  });

  // ── Snapshots ────────────────────────────────────────────────
  videoCreationBridge.listSnapshots.provider(async ({ projectRoot }) => {
    return listSnapshots(projectRoot);
  });

  videoCreationBridge.createSnapshot.provider(async ({ projectRoot }) => {
    return createSnapshot(projectRoot);
  });

  videoCreationBridge.restoreSnapshot.provider(async ({ projectRoot, snapshotId }) => {
    return restoreSnapshot(projectRoot, snapshotId);
  });

  // ── Shot CRUD ────────────────────────────────────────────────
  videoCreationBridge.insertShot.provider(async ({ projectRoot, after, partial }) => {
    return storyboardService.insertShot(projectRoot, after, partial);
  });

  videoCreationBridge.deleteShot.provider(async ({ projectRoot, shotId }) => {
    return storyboardService.deleteShot(projectRoot, shotId);
  });

  videoCreationBridge.reorderShots.provider(async ({ projectRoot, orderedIds }) => {
    return storyboardService.reorderShots(projectRoot, orderedIds);
  });
}
