import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

// Mock ipcBridge (used by AssetService to emit events)
vi.mock('@/common/adapter/ipcBridge', () => ({
  videoCreation: {
    storyboardStream: { emit: vi.fn() },
  },
}));

import { AssetService, createSnapshot, listSnapshots, restoreSnapshot } from '@process/services/video/AssetService';
import { initProjectLayout } from '@process/services/video/ProjectLayout';
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
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('createAsset', () => {
    it('creates a character asset with auto-generated id', async () => {
      const asset = await service.createAsset(tmpDir, 'character', {
        name: 'Hero',
        description: 'The main hero',
        appearance: 'tall, dark hair',
        lockedTokens: ['hero-token'],
      });

      expect(asset.id).toMatch(/^char-\d{3}$/);
      expect(asset.name).toBe('Hero');

      // Verify file was written
      const filePath = path.join(tmpDir, '02-assets', 'characters', `${asset.id}.json`);
      const raw = await fs.readFile(filePath, 'utf-8');
      const readback = JSON.parse(raw);
      expect(readback.name).toBe('Hero');
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
  });

  describe('updateAsset', () => {
    it('updates an existing asset', async () => {
      const created = await service.createAsset(tmpDir, 'character', { name: 'Hero' });
      await service.updateAsset(tmpDir, 'character', created.id, { name: 'Updated Hero' });

      const assets = await service.getAssets(tmpDir);
      const updated = assets.characters.find((c) => c.id === created.id);
      expect(updated?.name).toBe('Updated Hero');
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

      // shot2 should not have duplicate char-token
      const charTokenCount = updatedShot2.lockedTokens.filter((t) => t === 'char-token').length;
      expect(charTokenCount).toBe(1);
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
