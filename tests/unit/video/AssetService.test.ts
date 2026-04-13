import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

const mockExecuteImageGeneration = vi.hoisted(() => vi.fn());
const mockProcessConfigGet = vi.hoisted(() => vi.fn());

// Mock ipcBridge (used by AssetService to emit events)
vi.mock('@/common/adapter/ipcBridge', () => ({
  videoCreation: {
    storyboardStream: { emit: vi.fn() },
  },
}));

vi.mock('@/common/chat/imageGenCore', () => ({
  executeImageGeneration: mockExecuteImageGeneration,
  downloadAndSaveImage: vi.fn(),
  saveGeneratedImage: vi.fn(),
  isHttpUrl: (value: string) => value.startsWith('http://') || value.startsWith('https://'),
}));

vi.mock('@process/utils/initStorage', () => ({
  ProcessConfig: {
    get: mockProcessConfigGet,
  },
}));

import { AssetService, createSnapshot, listSnapshots, restoreSnapshot } from '@process/services/video/AssetService';
import { getProjectPaths, initProjectLayout } from '@process/services/video/ProjectLayout';
import { StoryboardService } from '@process/services/video/StoryboardService';
import type { Shot } from '@/common/types/videoCreation';

function makeShot(id: string, overrides?: Partial<Shot>): Shot {
  return {
    id,
    sceneIndex: 0,
    shotIndex: 1,
    goal: 'test',
    sceneDescription: '',
    characters: [],
    action: '',
    dialogue: '',
    shotType: 'MS',
    cameraMove: 'static',
    imagePrompt: '',
    videoPrompt: '',
    lockedTokens: ['base-token'],
    continuityRefs: {},
    assetRefs: [],
    duration: 4,
    status: 'pending',
    locked: false,
    ...overrides,
  };
}

describe('AssetService', () => {
  let tmpDir: string;
  let service: AssetService;
  let storyboardService: StoryboardService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'assetservice-'));
    await initProjectLayout(tmpDir);
    service = new AssetService();
    storyboardService = new StoryboardService();

    mockProcessConfigGet.mockReset();
    mockProcessConfigGet.mockResolvedValue({
      apiKey: 'test-key',
      useModel: 'dall-e-3',
      platform: 'openai',
      baseUrl: 'https://example.com',
    });
    mockExecuteImageGeneration.mockReset();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('createAsset', () => {
    it('creates a character asset with auto-generated id', async () => {
      const asset = await service.createAsset(tmpDir, 'character', {
        name: 'Hero Name',
        description: 'The main hero',
        appearance: 'tall, dark hair',
        lockedTokens: ['hero-token'],
      });

      expect(asset.id).toMatch(/^char-\d{3}$/);
      expect(asset.name).toBe('Hero_Name');

      // Verify file was written
      const filePath = path.join(tmpDir, '02-assets', 'characters', `${asset.id}.json`);
      const raw = await fs.readFile(filePath, 'utf-8');
      const readback = JSON.parse(raw);
      expect(readback.name).toBe('Hero_Name');
    });

    it('creates a scene asset', async () => {
      const asset = await service.createAsset(tmpDir, 'scene', { name: 'Forest' });
      expect(asset.id).toMatch(/^scene-\d{3}$/);
      expect(asset.name).toBe('Forest');
    });

    it('creates a prop asset', async () => {
      const asset = await service.createAsset(tmpDir, 'prop', { name: 'Sword' });
      expect(asset.id).toMatch(/^prop-\d{3}$/);
    });

    it('uses provided id if given', async () => {
      const asset = await service.createAsset(tmpDir, 'character', { id: 'char-custom', name: 'Villain' });
      expect(asset.id).toBe('char-custom');
    });
  });

  describe('getAssets', () => {
    it('returns all created assets grouped by type', async () => {
      await service.createAsset(tmpDir, 'character', { name: 'Hero' });
      await service.createAsset(tmpDir, 'character', { name: 'Villain' });
      await service.createAsset(tmpDir, 'scene', { name: 'Forest' });

      const result = await service.getAssets(tmpDir);
      expect(result.characters).toHaveLength(2);
      expect(result.scenes).toHaveLength(1);
      expect(result.props).toHaveLength(0);
    });

    it('returns empty arrays for empty project', async () => {
      const result = await service.getAssets(tmpDir);
      expect(result.characters).toHaveLength(0);
      expect(result.scenes).toHaveLength(0);
      expect(result.props).toHaveLength(0);
    });

    it('hydrates missing asset id from file name', async () => {
      const charFile = path.join(tmpDir, '02-assets', 'characters', '鲁鲁.json');
      await fs.writeFile(
        charFile,
        JSON.stringify(
          {
            name: '鲁鲁',
            description: '年轻女孩',
            prompt: 'young chinese woman',
            referenceImagePaths: [],
            lockedTokens: ['@鲁鲁'],
          },
          null,
          2
        ),
        'utf-8'
      );

      const result = await service.getAssets(tmpDir);
      expect(result.characters).toHaveLength(1);
      expect(result.characters[0].id).toBe('鲁鲁');
      expect(result.characters[0].name).toBe('鲁鲁');
    });

    it('skips malformed asset files without dropping all assets', async () => {
      const charsDir = path.join(tmpDir, '02-assets', 'characters');
      await fs.writeFile(
        path.join(charsDir, 'good.json'),
        JSON.stringify({ id: 'char-good', name: 'Good', referenceImagePaths: [], lockedTokens: [] }, null, 2),
        'utf-8'
      );
      await fs.writeFile(path.join(charsDir, 'bad.json'), '{ this is invalid json', 'utf-8');

      const result = await service.getAssets(tmpDir);
      expect(result.characters).toHaveLength(1);
      expect(result.characters[0].id).toBe('char-good');
    });
  });

  describe('updateAsset', () => {
    it('updates an existing asset', async () => {
      const created = await service.createAsset(tmpDir, 'character', { name: 'Hero' });
      await service.updateAsset(tmpDir, 'character', created.id, { name: 'Updated Hero' });

      const assets = await service.getAssets(tmpDir);
      const updated = assets.characters.find((c) => c.id === created.id);
      expect(updated?.name).toBe('Updated_Hero');
    });
  });

  describe('deleteAsset', () => {
    it('deletes an existing asset', async () => {
      const created = await service.createAsset(tmpDir, 'character', { name: 'Delete Me' });
      await service.deleteAsset(tmpDir, 'character', created.id);

      const assets = await service.getAssets(tmpDir);
      expect(assets.characters.find((c) => c.id === created.id)).toBeUndefined();
    });

    it('does not throw for non-existent asset', async () => {
      await expect(service.deleteAsset(tmpDir, 'character', 'non-existent')).resolves.not.toThrow();
    });
  });

  describe('applyCharacterToShots', () => {
    it('merges lockedTokens from character into shots', async () => {
      const char = await service.createAsset(tmpDir, 'character', {
        name: 'Hero',
        lockedTokens: ['char-token', 'another-token'],
      });

      const shot1 = makeShot('shot-001', { lockedTokens: ['base-token'] });
      const shot2 = makeShot('shot-002', { lockedTokens: ['base-token', 'char-token'] });
      await storyboardService.writeShot(tmpDir, shot1);
      await storyboardService.writeShot(tmpDir, shot2);
      // Update storyboard to include shot ids
      await storyboardService.updateStoryboard(tmpDir, { shotIds: ['shot-001', 'shot-002'] });

      await service.applyCharacterToShots(tmpDir, char.id, ['shot-001', 'shot-002']);

      const updatedShot1 = await storyboardService.readShot(tmpDir, 'shot-001');
      const updatedShot2 = await storyboardService.readShot(tmpDir, 'shot-002');

      // shot1 should have merged tokens (no duplicates)
      expect(updatedShot1.lockedTokens).toContain('base-token');
      expect(updatedShot1.lockedTokens).toContain('char-token');
      expect(updatedShot1.lockedTokens).toContain('another-token');
      expect(updatedShot1.assetRefs).toContain(char.id);

      // shot2 should not have duplicate char-token
      const charTokenCount = updatedShot2.lockedTokens.filter((t) => t === 'char-token').length;
      expect(charTokenCount).toBe(1);
    });
  });

  describe('asset reference image management', () => {
    it('adds/removes/sets primary reference images', async () => {
      const created = await service.createAsset(tmpDir, 'character', { name: 'Hero' });
      const sourceDir = path.join(tmpDir, 'tmp-src');
      await fs.mkdir(sourceDir, { recursive: true });
      const img1 = path.join(sourceDir, 'a.png');
      const img2 = path.join(sourceDir, 'b.png');
      await fs.writeFile(img1, 'img1');
      await fs.writeFile(img2, 'img2');

      const afterAdd = await service.addAssetReferenceImages({
        projectRoot: tmpDir,
        type: 'character',
        id: created.id,
        sourcePaths: [img1, img2],
      });
      expect(afterAdd.referenceImagePaths?.length).toBe(2);
      expect(afterAdd.primaryReferenceImagePath).toBe(afterAdd.referenceImagePaths?.[0]);

      const primary = afterAdd.referenceImagePaths?.[1] as string;
      const afterPrimary = await service.setPrimaryAssetReferenceImage({
        projectRoot: tmpDir,
        type: 'character',
        id: created.id,
        imagePath: primary,
      });
      expect(afterPrimary.primaryReferenceImagePath).toBe(primary);

      const afterRemove = await service.removeAssetReferenceImage({
        projectRoot: tmpDir,
        type: 'character',
        id: created.id,
        imagePath: primary,
      });
      expect(afterRemove.referenceImagePaths?.length).toBe(1);
      expect(afterRemove.primaryReferenceImagePath).toBe(afterRemove.referenceImagePaths?.[0]);
    });
  });

  describe('applyAssetsToShots', () => {
    it('binds and unbinds generic assets to shots', async () => {
      const sceneAsset = await service.createAsset(tmpDir, 'scene', { name: 'Forest' });
      const propAsset = await service.createAsset(tmpDir, 'prop', { name: 'Basket' });
      await storyboardService.writeShot(tmpDir, makeShot('shot-001'));
      await storyboardService.updateStoryboard(tmpDir, { shotIds: ['shot-001'] });

      await service.applyAssetsToShots(tmpDir, [sceneAsset.id, propAsset.id], ['shot-001']);
      const bound = await storyboardService.readShot(tmpDir, 'shot-001');
      expect(bound.assetRefs).toContain(sceneAsset.id);
      expect(bound.assetRefs).toContain(propAsset.id);

      await service.removeAssetsFromShots(tmpDir, [sceneAsset.id], ['shot-001']);
      const unbound = await storyboardService.readShot(tmpDir, 'shot-001');
      expect(unbound.assetRefs).not.toContain(sceneAsset.id);
      expect(unbound.assetRefs).toContain(propAsset.id);
    });
  });

  describe('generateAssetThreeViewReference', () => {
    it('uses canonical scene filename and replaces old references with a single image', async () => {
      const scene = await service.createAsset(tmpDir, 'scene', { name: 'Forest' });
      const paths = getProjectPaths(tmpDir);
      const refsDir = path.join(paths.sceneRefsDir, scene.id);
      await fs.mkdir(refsDir, { recursive: true });

      const oldRefA = path.join(refsDir, 'old-a.png');
      const oldRefB = path.join(refsDir, 'old-b.png');
      await fs.writeFile(oldRefA, 'old-a');
      await fs.writeFile(oldRefB, 'old-b');
      await service.updateAsset(tmpDir, 'scene', scene.id, {
        referenceImagePaths: [oldRefA, oldRefB],
        primaryReferenceImagePath: oldRefA,
      });

      const tempGeneratedPath = path.join(refsDir, 'img-1711.png');
      await fs.writeFile(tempGeneratedPath, 'new-image');
      mockExecuteImageGeneration.mockResolvedValue({
        success: true,
        imagePath: tempGeneratedPath,
      });

      const updated = await service.generateAssetThreeViewReference({
        projectRoot: tmpDir,
        type: 'scene',
        id: scene.id,
      });

      const primary = updated.primaryReferenceImagePath ?? '';
      expect(updated.referenceImagePaths).toHaveLength(1);
      expect(updated.referenceImagePaths?.[0]).toBe(primary);
      expect(path.basename(primary)).toMatch(/^scene-\d{3}-three-view-\d+\.png$/);

      await expect(fs.access(primary)).resolves.toBeUndefined();
      await expect(fs.access(oldRefA)).rejects.toThrow();
      await expect(fs.access(oldRefB)).rejects.toThrow();
      await expect(fs.access(tempGeneratedPath)).rejects.toThrow();
    });

    it('keeps only one prop image after repeated generation and avoids img-* final names', async () => {
      const prop = await service.createAsset(tmpDir, 'prop', { name: 'Sword' });
      const paths = getProjectPaths(tmpDir);
      const refsDir = path.join(paths.propRefsDir, prop.id);
      await fs.mkdir(refsDir, { recursive: true });

      const tempPath1 = path.join(refsDir, 'img-201.png');
      await fs.writeFile(tempPath1, 'first');
      mockExecuteImageGeneration.mockResolvedValueOnce({
        success: true,
        imagePath: tempPath1,
      });
      const first = await service.generateAssetThreeViewReference({
        projectRoot: tmpDir,
        type: 'prop',
        id: prop.id,
      });

      await new Promise((resolve) => setTimeout(resolve, 2));

      const tempPath2 = path.join(refsDir, 'img-202.png');
      await fs.writeFile(tempPath2, 'second');
      mockExecuteImageGeneration.mockResolvedValueOnce({
        success: true,
        imagePath: tempPath2,
      });
      const second = await service.generateAssetThreeViewReference({
        projectRoot: tmpDir,
        type: 'prop',
        id: prop.id,
      });

      const primary = second.primaryReferenceImagePath ?? '';
      expect(second.referenceImagePaths).toHaveLength(1);
      expect(second.referenceImagePaths?.[0]).toBe(primary);
      expect(path.basename(primary)).toMatch(/^prop-\d{3}-three-view-\d+\.png$/);
      expect(path.basename(primary).startsWith('img-')).toBe(false);

      await expect(fs.access(first.primaryReferenceImagePath ?? '')).rejects.toThrow();
      await expect(fs.access(tempPath2)).rejects.toThrow();

      const files = await fs.readdir(refsDir);
      expect(files.filter((file) => file.endsWith('.png'))).toHaveLength(1);
    });
  });
});

describe('Snapshot helpers', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-'));
    await initProjectLayout(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('createSnapshot copies storyboard and assets dirs', async () => {
    // Write a test file into storyboard dir
    const storyboardDir = path.join(tmpDir, '01-storyboard');
    await fs.writeFile(path.join(storyboardDir, 'test-marker.txt'), 'hello', 'utf-8');

    const info = await createSnapshot(tmpDir);
    expect(info.id).toMatch(/^snapshot-\d+$/);
    expect(info.path).toContain(info.id);

    // Verify marker was copied
    const markerPath = path.join(info.path, '01-storyboard', 'test-marker.txt');
    const content = await fs.readFile(markerPath, 'utf-8');
    expect(content).toBe('hello');
  });

  it('listSnapshots returns snapshots sorted by creation time (newest first)', async () => {
    const snap1 = await createSnapshot(tmpDir);
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 2));
    const snap2 = await createSnapshot(tmpDir);

    const list = await listSnapshots(tmpDir);
    expect(list.length).toBeGreaterThanOrEqual(2);
    // Newest first
    const idx1 = list.findIndex((s) => s.id === snap1.id);
    const idx2 = list.findIndex((s) => s.id === snap2.id);
    expect(idx2).toBeLessThan(idx1);
  });

  it('restoreSnapshot overwrites current storyboard from snapshot', async () => {
    // Create a marker file in current storyboard
    const storyboardDir = path.join(tmpDir, '01-storyboard');
    await fs.writeFile(path.join(storyboardDir, 'original.txt'), 'original', 'utf-8');

    const snap = await createSnapshot(tmpDir);

    // Modify current state
    await fs.writeFile(path.join(storyboardDir, 'modified.txt'), 'modified', 'utf-8');

    // Restore
    await restoreSnapshot(tmpDir, snap.id);

    // original.txt should be back, modified.txt should be gone
    const files = await fs.readdir(storyboardDir);
    expect(files).toContain('original.txt');
    expect(files).not.toContain('modified.txt');
  });
});
