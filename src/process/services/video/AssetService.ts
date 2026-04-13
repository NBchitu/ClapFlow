/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import type {
  AddAssetReferenceImagesParams,
  AssetType,
  CharacterAsset,
  GenerateAssetThreeViewReferenceParams,
  GetAssetsResult,
  PropAsset,
  RemoveAssetReferenceImageParams,
  SceneAsset,
  SetPrimaryAssetReferenceImageParams,
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

function normalizeAssetName(input?: string): string {
  if (!input) return '';
  return input.trim().replace(/\s+/g, '_');
}

function sanitizeFileSegment(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return normalized || 'asset';
}

function buildAssetThreeViewFileStem(type: AssetType, assetId: string): string {
  const fallbackPrefix = type === 'character' ? 'char' : type === 'scene' ? 'scene' : 'prop';
  const normalizedId = sanitizeFileSegment(assetId);
  if (normalizedId.startsWith(`${fallbackPrefix}-`)) {
    return normalizedId;
  }
  if (normalizedId === 'asset') {
    return fallbackPrefix;
  }
  return `${fallbackPrefix}-${normalizedId}`;
}

async function readJsonFiles<T extends Record<string, unknown>>(dir: string): Promise<T[]> {
  try {
    const entries = await fs.readdir(dir);
    const jsonFiles = entries.filter((f) => f.endsWith('.json'));
    const results: T[] = [];
    for (const f of jsonFiles) {
      try {
        const raw = await fs.readFile(nodePath.join(dir, f), 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
        const fallbackId = f.replace(/\.json$/i, '');
        if (typeof parsed.id !== 'string' || !parsed.id.trim()) {
          parsed.id = fallbackId;
        }
        if (typeof parsed.name === 'string') {
          parsed.name = normalizeAssetName(parsed.name);
        }
        results.push(parsed as T);
      } catch (err) {
        console.warn(`[AssetService] Skip invalid asset JSON: ${nodePath.join(dir, f)}`, err);
      }
    }
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

function toAbsolutePath(projectRoot: string, inputPath: string): string {
  return nodePath.isAbsolute(inputPath) ? inputPath : nodePath.join(projectRoot, inputPath);
}

function referenceRootDir(projectRoot: string, type: AssetType, assetId: string): string {
  const paths = getProjectPaths(projectRoot);
  const typeDir =
    type === 'character' ? paths.characterRefsDir : type === 'scene' ? paths.sceneRefsDir : paths.propRefsDir;
  return nodePath.join(typeDir, assetId);
}

const ASSET_THREE_VIEW_CONSTRAINT_PROMPT = [
  'Create one single 16:9 reference image with a pure white background (#FFFFFF).',
  'Split the image into 3 equal vertical sections arranged from left to right.',
  'Section order must be: FRONT VIEW, BACK VIEW, SIDE VIEW.',
  'The same subject must stay visually consistent across all 3 sections.',
  'Keep composition centered with stable scale, style, and lighting.',
  'Do not add any text, labels, logos, watermark, panel borders, or decorative frames.',
].join(' ');

function buildAssetThreeViewPrompt(type: AssetType, asset: CharacterAsset | SceneAsset | PropAsset): string {
  const typeHint = type === 'character' ? 'character' : type === 'scene' ? 'scene/environment asset' : 'prop asset';
  const detailParts = [asset.prompt, asset.description, 'appearance' in asset ? asset.appearance : '']
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);
  const detailText = detailParts.join('\n');
  const subjectLine = `Subject: ${asset.name} (${typeHint}).`;
  return detailText
    ? `${ASSET_THREE_VIEW_CONSTRAINT_PROMPT}\n${subjectLine}\nGeneration Prompt:\n${detailText}`
    : `${ASSET_THREE_VIEW_CONSTRAINT_PROMPT}\n${subjectLine}`;
}

async function readAssetByType(
  projectRoot: string,
  type: AssetType,
  id: string
): Promise<CharacterAsset | SceneAsset | PropAsset> {
  const dir = assetDir(projectRoot, type);
  const filePath = nodePath.join(dir, `${id}.json`);
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as CharacterAsset | SceneAsset | PropAsset;
}

async function writeAssetByType(
  projectRoot: string,
  type: AssetType,
  asset: CharacterAsset | SceneAsset | PropAsset
): Promise<void> {
  const dir = assetDir(projectRoot, type);
  await fs.mkdir(dir, { recursive: true });
  const filePath = nodePath.join(dir, `${asset.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(asset, null, 2), 'utf-8');
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

    const normalizedName = normalizeAssetName(data.name);
    if (!normalizedName) {
      throw new Error('Asset name is required');
    }
    const primaryReferenceImagePath = data.primaryReferenceImagePath;
    const referenceImagePaths = (data.referenceImagePaths ?? []).filter(Boolean);
    const asset = {
      ...data,
      id,
      name: normalizedName,
      referenceImagePaths,
      primaryReferenceImagePath: primaryReferenceImagePath ?? referenceImagePaths[0],
    } as CharacterAsset | SceneAsset | PropAsset;
    await fs.writeFile(nodePath.join(dir, `${id}.json`), JSON.stringify(asset, null, 2), 'utf-8');
    return asset;
  }

  async updateAsset(
    projectRoot: string,
    type: AssetType,
    id: string,
    patch: Partial<CharacterAsset | SceneAsset | PropAsset>
  ): Promise<void> {
    const existing = await readAssetByType(projectRoot, type, id);
    const normalizedName = patch.name ? normalizeAssetName(patch.name) : existing.name;
    const updated = {
      ...existing,
      ...patch,
      id,
      name: normalizedName,
      referenceImagePaths: patch.referenceImagePaths ?? existing.referenceImagePaths ?? [],
      primaryReferenceImagePath: patch.primaryReferenceImagePath ?? existing.primaryReferenceImagePath,
    } as CharacterAsset | SceneAsset | PropAsset;
    await writeAssetByType(projectRoot, type, updated);
  }

  async deleteAsset(projectRoot: string, type: AssetType, id: string): Promise<void> {
    const dir = assetDir(projectRoot, type);
    try {
      await fs.unlink(nodePath.join(dir, `${id}.json`));
    } catch {
      // Ignore missing file
    }
    try {
      await fs.rm(referenceRootDir(projectRoot, type, id), { recursive: true, force: true });
    } catch {
      // Ignore
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
      const updated: Shot = {
        ...shot,
        lockedTokens: merged,
        assetRefs: [...new Set([...(shot.assetRefs ?? []), charId])],
      };
      await this.storyboardService.writeShot(projectRoot, updated);
      videoCreationBridge.storyboardStream.emit({ type: 'shot-updated', shotId, shot: updated });
    }
  }

  async applyAssetsToShots(projectRoot: string, assetIds: string[], shotIds: string[]): Promise<void> {
    if (assetIds.length === 0 || shotIds.length === 0) return;
    for (const shotId of shotIds) {
      const shot = await this.storyboardService.readShot(projectRoot, shotId);
      const mergedAssetRefs = [...new Set([...(shot.assetRefs ?? []), ...assetIds])];
      if (mergedAssetRefs.length === (shot.assetRefs ?? []).length) continue;
      const updated: Shot = { ...shot, assetRefs: mergedAssetRefs };
      await this.storyboardService.writeShot(projectRoot, updated);
      videoCreationBridge.storyboardStream.emit({ type: 'shot-updated', shotId, shot: updated });
    }
  }

  async removeAssetsFromShots(projectRoot: string, assetIds: string[], shotIds: string[]): Promise<void> {
    if (assetIds.length === 0 || shotIds.length === 0) return;
    const removeSet = new Set(assetIds);
    for (const shotId of shotIds) {
      const shot = await this.storyboardService.readShot(projectRoot, shotId);
      const nextAssetRefs = (shot.assetRefs ?? []).filter((id) => !removeSet.has(id));
      if (nextAssetRefs.length === (shot.assetRefs ?? []).length) continue;
      const updated: Shot = { ...shot, assetRefs: nextAssetRefs };
      await this.storyboardService.writeShot(projectRoot, updated);
      videoCreationBridge.storyboardStream.emit({ type: 'shot-updated', shotId, shot: updated });
    }
  }

  async addAssetReferenceImages(
    params: AddAssetReferenceImagesParams
  ): Promise<CharacterAsset | SceneAsset | PropAsset> {
    const { projectRoot, type, id, sourcePaths } = params;
    if (sourcePaths.length === 0) {
      return readAssetByType(projectRoot, type, id);
    }

    const asset = await readAssetByType(projectRoot, type, id);
    const refsDir = referenceRootDir(projectRoot, type, id);
    await fs.mkdir(refsDir, { recursive: true });

    const existing = asset.referenceImagePaths ?? [];
    const nextPaths = [...existing];
    const existingAbs = new Set(existing.map((p) => toAbsolutePath(projectRoot, p).replace(/\\/g, '/')));
    for (const sourcePath of sourcePaths) {
      const absoluteSourcePath = toAbsolutePath(projectRoot, sourcePath);
      const fileName = nodePath.basename(absoluteSourcePath).replace(/\s+/g, '_');
      const targetPath = nodePath.join(refsDir, `${Date.now()}-${fileName}`);
      const normalizedTargetPath = targetPath.replace(/\\/g, '/');
      await fs.copyFile(absoluteSourcePath, targetPath);
      if (existingAbs.has(normalizedTargetPath)) continue;
      nextPaths.push(targetPath);
      existingAbs.add(normalizedTargetPath);
    }

    const updated = {
      ...asset,
      referenceImagePaths: nextPaths,
      primaryReferenceImagePath: asset.primaryReferenceImagePath ?? nextPaths[0],
    } as CharacterAsset | SceneAsset | PropAsset;
    await writeAssetByType(projectRoot, type, updated);
    return updated;
  }

  async removeAssetReferenceImage(
    params: RemoveAssetReferenceImageParams
  ): Promise<CharacterAsset | SceneAsset | PropAsset> {
    const { projectRoot, type, id, imagePath } = params;
    const asset = await readAssetByType(projectRoot, type, id);
    const refs = asset.referenceImagePaths ?? [];
    const normalizedTarget = imagePath.replace(/\\/g, '/');
    const nextRefs = refs.filter((p) => p.replace(/\\/g, '/') !== normalizedTarget);

    try {
      await fs.rm(toAbsolutePath(projectRoot, imagePath), { force: true });
    } catch {
      // Ignore
    }

    const updated = {
      ...asset,
      referenceImagePaths: nextRefs,
      primaryReferenceImagePath:
        asset.primaryReferenceImagePath && nextRefs.includes(asset.primaryReferenceImagePath)
          ? asset.primaryReferenceImagePath
          : nextRefs[0],
    } as CharacterAsset | SceneAsset | PropAsset;
    await writeAssetByType(projectRoot, type, updated);
    return updated;
  }

  async setPrimaryAssetReferenceImage(
    params: SetPrimaryAssetReferenceImageParams
  ): Promise<CharacterAsset | SceneAsset | PropAsset> {
    const { projectRoot, type, id, imagePath } = params;
    const asset = await readAssetByType(projectRoot, type, id);
    const refs = asset.referenceImagePaths ?? [];
    const normalized = imagePath.replace(/\\/g, '/');
    const hasTarget = refs.some((p) => p.replace(/\\/g, '/') === normalized);
    if (!hasTarget) {
      throw new Error('Reference image not found in asset');
    }
    const updated = {
      ...asset,
      primaryReferenceImagePath: refs.find((p) => p.replace(/\\/g, '/') === normalized),
    } as CharacterAsset | SceneAsset | PropAsset;
    await writeAssetByType(projectRoot, type, updated);
    return updated;
  }

  async generateAssetThreeViewReference(
    params: GenerateAssetThreeViewReferenceParams
  ): Promise<CharacterAsset | SceneAsset | PropAsset> {
    const { projectRoot, type, id } = params;
    const asset = await readAssetByType(projectRoot, type, id);
    const generationPrompt = buildAssetThreeViewPrompt(type, asset);

    const { ProcessConfig } = await import('@process/utils/initStorage');
    const { executeImageGeneration, downloadAndSaveImage, saveGeneratedImage, isHttpUrl } =
      await import('@/common/chat/imageGenCore');

    const imgModelRaw = await ProcessConfig.get('tools.imageGenerationModel');
    const imgCfg = imgModelRaw as {
      baseUrl?: string;
      apiKey?: string;
      useModel?: string;
      platform?: string;
    } | null;

    if (!imgCfg?.apiKey) {
      throw new Error('Image generation model is not configured');
    }

    const refsDir = referenceRootDir(projectRoot, type, id);
    await fs.mkdir(refsDir, { recursive: true });
    const provider = {
      id: 'img-gen',
      name: 'img-gen',
      platform: imgCfg.platform ?? 'openai',
      baseUrl: imgCfg.baseUrl ?? '',
      apiKey: imgCfg.apiKey,
      useModel: imgCfg.useModel ?? 'dall-e-3',
      model: [imgCfg.useModel ?? 'dall-e-3'],
    };

    const result = await executeImageGeneration({ prompt: generationPrompt }, provider, refsDir);
    if (!result.success || !result.imagePath) {
      throw new Error(result.error || result.text || 'Failed to generate asset reference image');
    }

    let generatedLocalPath = result.imagePath;
    if (isHttpUrl(generatedLocalPath)) {
      generatedLocalPath = await downloadAndSaveImage(generatedLocalPath, refsDir);
    } else if (generatedLocalPath.startsWith('data:image/')) {
      generatedLocalPath = await saveGeneratedImage(generatedLocalPath, refsDir);
    } else if (!nodePath.isAbsolute(generatedLocalPath)) {
      generatedLocalPath = nodePath.join(refsDir, generatedLocalPath);
    }

    await fs.access(generatedLocalPath);
    const generatedExt = nodePath.extname(generatedLocalPath) || '.png';
    const fileStem = buildAssetThreeViewFileStem(type, id);
    const normalizedOutputPath = nodePath.join(refsDir, `${fileStem}-three-view-${Date.now()}${generatedExt}`);
    if (nodePath.resolve(generatedLocalPath) !== nodePath.resolve(normalizedOutputPath)) {
      try {
        await fs.rename(generatedLocalPath, normalizedOutputPath);
      } catch {
        await fs.copyFile(generatedLocalPath, normalizedOutputPath);
        try {
          await fs.rm(generatedLocalPath, { force: true });
        } catch {
          // Ignore cleanup failure for temp image.
        }
      }
    }
    await fs.access(normalizedOutputPath);

    const previousRefs = (asset.referenceImagePaths ?? [])
      .map((oldPath) => toAbsolutePath(projectRoot, oldPath))
      .filter((oldPath) => nodePath.resolve(oldPath) !== nodePath.resolve(normalizedOutputPath));
    for (const oldPath of previousRefs) {
      try {
        await fs.rm(oldPath, { force: true });
      } catch {
        // Ignore cleanup failure for old reference images.
      }
    }

    const singlePath = normalizedOutputPath;

    const updated = {
      ...asset,
      referenceImagePaths: [singlePath],
      primaryReferenceImagePath: singlePath,
    } as CharacterAsset | SceneAsset | PropAsset;
    await writeAssetByType(projectRoot, type, updated);
    return updated;
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
