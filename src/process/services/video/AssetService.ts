/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import type {
  AssetType,
  CharacterAsset,
  GetAssetsResult,
  PropAsset,
  SceneAsset,
  Shot,
  SnapshotInfo,
} from '@/common/types/videoCreation';
import { getProjectPaths } from './ProjectLayout';
import { StoryboardService } from './StoryboardService';
import { videoCreation as videoCreationBridge } from '@/common/adapter/ipcBridge';

function assetDir(projectRoot: string, type: AssetType): string {
  const paths = getProjectPaths(projectRoot);
  switch (type) {
    case 'character':
      return paths.charactersDir;
    case 'scene':
      return paths.scenesDir;
    case 'prop':
      return paths.propsDir;
  }
}

async function readJsonFiles<T>(dir: string): Promise<T[]> {
  try {
    const entries = await fs.readdir(dir);
    const jsonFiles = entries.filter((f) => f.endsWith('.json'));
    const results = await Promise.all(
      jsonFiles.map(async (f) => {
        const raw = await fs.readFile(nodePath.join(dir, f), 'utf-8');
        return JSON.parse(raw) as T;
      })
    );
    return results;
  } catch {
    return [];
  }
}

async function nextId(dir: string, prefix: string): Promise<string> {
  try {
    const entries = await fs.readdir(dir);
    const count = entries.filter((f) => f.endsWith('.json')).length;
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  } catch {
    return `${prefix}-001`;
  }
}

export class AssetService {
  private storyboardService = new StoryboardService();

  async getAssets(projectRoot: string): Promise<GetAssetsResult> {
    const paths = getProjectPaths(projectRoot);
    const [characters, scenes, props] = await Promise.all([
      readJsonFiles<CharacterAsset>(paths.charactersDir),
      readJsonFiles<SceneAsset>(paths.scenesDir),
      readJsonFiles<PropAsset>(paths.propsDir),
    ]);
    return { characters, scenes, props };
  }

  async createAsset(
    projectRoot: string,
    type: AssetType,
    data: Partial<CharacterAsset | SceneAsset | PropAsset>
  ): Promise<CharacterAsset | SceneAsset | PropAsset> {
    const dir = assetDir(projectRoot, type);
    await fs.mkdir(dir, { recursive: true });

    const prefix = type === 'character' ? 'char' : type === 'scene' ? 'scene' : 'prop';
    const id = data.id ?? (await nextId(dir, prefix));

    const asset = { ...data, id } as CharacterAsset | SceneAsset | PropAsset;
    await fs.writeFile(nodePath.join(dir, `${id}.json`), JSON.stringify(asset, null, 2), 'utf-8');
    return asset;
  }

  async updateAsset(
    projectRoot: string,
    type: AssetType,
    id: string,
    patch: Partial<CharacterAsset | SceneAsset | PropAsset>
  ): Promise<void> {
    const dir = assetDir(projectRoot, type);
    const filePath = nodePath.join(dir, `${id}.json`);
    const raw = await fs.readFile(filePath, 'utf-8');
    const existing = JSON.parse(raw) as CharacterAsset | SceneAsset | PropAsset;
    const updated = { ...existing, ...patch, id };
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8');
  }

  async deleteAsset(projectRoot: string, type: AssetType, id: string): Promise<void> {
    const dir = assetDir(projectRoot, type);
    try {
      await fs.unlink(nodePath.join(dir, `${id}.json`));
    } catch {
      // Ignore missing file
    }
  }

  async applyCharacterToShots(projectRoot: string, charId: string, shotIds: string[]): Promise<void> {
    const dir = assetDir(projectRoot, 'character');
    const raw = await fs.readFile(nodePath.join(dir, `${charId}.json`), 'utf-8');
    const char = JSON.parse(raw) as CharacterAsset;
    const newTokens = char.lockedTokens ?? [];
    if (newTokens.length === 0) return;

    for (const shotId of shotIds) {
      const shot = await this.storyboardService.readShot(projectRoot, shotId);
      const merged = [...new Set([...shot.lockedTokens, ...newTokens])];
      const updated: Shot = { ...shot, lockedTokens: merged };
      await this.storyboardService.writeShot(projectRoot, updated);
      videoCreationBridge.storyboardStream.emit({ type: 'shot-updated', shotId, shot: updated });
    }
  }
}

export const assetService = new AssetService();

// ─── Snapshot helpers ─────────────────────────────────────────

async function cpDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = nodePath.join(src, entry.name);
    const destPath = nodePath.join(dest, entry.name);
    if (entry.isDirectory()) {
      await cpDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

function snapshotsDir(projectRoot: string): string {
  return nodePath.join(projectRoot, '99-logs', 'snapshots');
}

export async function createSnapshot(projectRoot: string): Promise<SnapshotInfo> {
  const id = `snapshot-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const snapRoot = nodePath.join(snapshotsDir(projectRoot), id);
  await fs.mkdir(snapRoot, { recursive: true });

  const paths = getProjectPaths(projectRoot);

  try {
    await cpDir(paths.storyboardDir, nodePath.join(snapRoot, '01-storyboard'));
  } catch {
    // storyboard dir may not exist yet
  }
  try {
    await cpDir(paths.assetsDir, nodePath.join(snapRoot, '02-assets'));
  } catch {
    // assets dir may not exist yet
  }

  const info: SnapshotInfo = { id, createdAt, path: snapRoot };
  await fs.writeFile(nodePath.join(snapRoot, 'info.json'), JSON.stringify(info, null, 2), 'utf-8');
  return info;
}

export async function listSnapshots(projectRoot: string): Promise<SnapshotInfo[]> {
  const dir = snapshotsDir(projectRoot);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const snapshots: SnapshotInfo[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const infoPath = nodePath.join(dir, entry.name, 'info.json');
        const raw = await fs.readFile(infoPath, 'utf-8');
        snapshots.push(JSON.parse(raw) as SnapshotInfo);
      } catch {
        // Skip malformed entries
      }
    }
    return snapshots.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function restoreSnapshot(projectRoot: string, snapshotId: string): Promise<void> {
  // Back up current state first
  await createSnapshot(projectRoot);

  const snapRoot = nodePath.join(snapshotsDir(projectRoot), snapshotId);
  const paths = getProjectPaths(projectRoot);

  // Overwrite storyboard dir
  const snapStoryboard = nodePath.join(snapRoot, '01-storyboard');
  try {
    await fs.rm(paths.storyboardDir, { recursive: true, force: true });
    await cpDir(snapStoryboard, paths.storyboardDir);
  } catch {
    // Ignore if snapshot doesn't have storyboard
  }

  // Overwrite assets dir
  const snapAssets = nodePath.join(snapRoot, '02-assets');
  try {
    await fs.rm(paths.assetsDir, { recursive: true, force: true });
    await cpDir(snapAssets, paths.assetsDir);
  } catch {
    // Ignore if snapshot doesn't have assets
  }
}
