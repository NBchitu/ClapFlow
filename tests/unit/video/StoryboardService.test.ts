import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { StoryboardService } from '@process/services/video/StoryboardService';
import { initProjectLayout } from '@process/services/video/ProjectLayout';
import type { Shot } from '@/common/types/videoCreation';

function makeShot(id: string, overrides?: Partial<Shot>): Shot {
  return {
    id,
    sceneId: 'scene-01',
    sceneIndex: 0,
    sceneShotIndex: 1,
    shotIndex: 0,
    goal: 'test shot',
    sceneDescription: '测试分镜',
    characters: [],
    action: '',
    dialogue: '',
    shotType: 'MS',
    cameraMove: 'static',
    imagePrompt: '',
    videoPrompt: '',
    lockedTokens: [],
    continuityRefs: {},
    assetRefs: [],
    duration: 4,
    status: 'pending',
    locked: false,
    ...overrides,
  };
}

describe('StoryboardService', () => {
  let tmpDir: string;
  let service: StoryboardService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storyboard-'));
    await initProjectLayout(tmpDir);
    service = new StoryboardService();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('writeShot / readShot', () => {
    it('writes and reads back a shot', async () => {
      const shot = makeShot('shot-001', { goal: 'hero enters' });
      await service.writeShot(tmpDir, shot);
      const read = await service.readShot(tmpDir, 'shot-001');
      expect(read.id).toBe('shot-001');
      expect(read.goal).toBe('hero enters');
    });
  });

  describe('insertShot', () => {
    it('appends shot when after=null and updates storyboard shotIds', async () => {
      const shot = await service.insertShot(tmpDir, null, { goal: 'first shot' });
      expect(shot.id).toBe('shot-001');

      const storyboard = await service.readStoryboard(tmpDir);
      expect(storyboard.shotIds).toContain('shot-001');
    });

    it('inserts shot after specified id', async () => {
      await service.insertShot(tmpDir, null, { goal: 'A' });
      await service.insertShot(tmpDir, null, { goal: 'C' });
      await service.insertShot(tmpDir, 'shot-001', { goal: 'B' });

      const storyboard = await service.readStoryboard(tmpDir);
      const idx001 = storyboard.shotIds.indexOf('shot-001');
      const idxNew = storyboard.shotIds.indexOf('shot-003');
      expect(idxNew).toBe(idx001 + 1);
    });
  });

  describe('deleteShot', () => {
    it('removes shot file and updates storyboard shotIds', async () => {
      await service.insertShot(tmpDir, null, {});
      await service.deleteShot(tmpDir, 'shot-001');

      const storyboard = await service.readStoryboard(tmpDir);
      expect(storyboard.shotIds).not.toContain('shot-001');
    });
  });

  describe('reorderShots', () => {
    it('updates shotIds order in storyboard', async () => {
      await service.insertShot(tmpDir, null, {});
      await service.insertShot(tmpDir, null, {});
      await service.insertShot(tmpDir, null, {});

      const reversed = ['shot-003', 'shot-002', 'shot-001'];
      await service.reorderShots(tmpDir, reversed);

      const storyboard = await service.readStoryboard(tmpDir);
      expect(storyboard.shotIds).toEqual(reversed);
    });
  });

  describe('scene compatibility', () => {
    it('infers sceneId from sceneIndex for old shots and syncs scene shotIds', async () => {
      const legacyShot = makeShot('shot-001', {
        sceneId: undefined,
        sceneIndex: 0,
        shotIndex: 1,
      });
      await service.writeShot(tmpDir, legacyShot);
      await service.updateStoryboard(tmpDir, {
        scenes: [{ id: 'scene-01', name: 'Scene 1', description: '' }],
        shotIds: ['shot-001'],
      });

      const shots = await service.readAllShots(tmpDir);
      expect(shots[0].sceneId).toBe('scene-01');
      expect(shots[0].sceneShotIndex).toBe(1);

      const storyboard = await service.readStoryboard(tmpDir);
      expect(storyboard.scenes[0]?.shotIds).toEqual(['shot-001']);
    });

    it('groups shots by scene', async () => {
      await service.insertShot(tmpDir, null, { sceneId: 'scene-01', sceneIndex: 0, goal: 'A' });
      await service.insertShot(tmpDir, null, { sceneId: 'scene-01', sceneIndex: 0, goal: 'B' });
      await service.insertShot(tmpDir, null, { sceneId: 'scene-02', sceneIndex: 1, goal: 'C' });

      const grouped = await service.readShotsGroupedByScene(tmpDir);
      const scene1 = grouped.find((group) => group.scene.id === 'scene-01');
      const scene2 = grouped.find((group) => group.scene.id === 'scene-02');

      expect(scene1?.shots.length).toBe(2);
      expect(scene2?.shots.length).toBe(1);
    });
  });

  describe('concurrent writes', () => {
    it('serializes concurrent writes without corruption', async () => {
      const shot = await service.insertShot(tmpDir, null, { goal: 'initial' });

      // Fire multiple concurrent updates
      await Promise.all([
        service.writeShot(tmpDir, { ...shot, goal: 'update-1' }),
        service.writeShot(tmpDir, { ...shot, goal: 'update-2' }),
        service.writeShot(tmpDir, { ...shot, goal: 'update-3' }),
      ]);

      // File should be valid JSON (not corrupted)
      const result = await service.readShot(tmpDir, shot.id);
      expect(result.id).toBe(shot.id);
      expect(typeof result.goal).toBe('string');
    });
  });
});
