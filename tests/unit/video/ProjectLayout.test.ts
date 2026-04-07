import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { getProjectPaths, initProjectLayout, isVideoProject } from '@process/services/video/ProjectLayout';

describe('ProjectLayout', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-project-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('getProjectPaths', () => {
    it('returns all standard paths relative to root', () => {
      const paths = getProjectPaths('/some/project');
      expect(paths.root).toBe('/some/project');
      expect(paths.script).toContain('00-script');
      expect(paths.storyboardDir).toContain('01-storyboard');
      expect(paths.shotsDir).toContain('shots');
      expect(paths.assetsDir).toContain('02-assets');
      expect(paths.imagesDir).toContain('03-images');
      expect(paths.videosDir).toContain('04-videos');
      expect(paths.memoryDir).toContain('90-memory');
      expect(paths.logsDir).toContain('99-logs');
      expect(paths.harnessRunsDir).toContain('harness-runs');
    });

    it('all paths are under the given root', () => {
      const root = '/my/project/root';
      const paths = getProjectPaths(root);
      for (const [key, value] of Object.entries(paths)) {
        if (key === 'root') continue;
        expect(value, `${key} should start with root`).toMatch(new RegExp(`^${root}`));
      }
    });
  });

  describe('initProjectLayout', () => {
    it('creates all required directories', async () => {
      await initProjectLayout(tmpDir);
      const paths = getProjectPaths(tmpDir);

      for (const dir of [
        path.join(tmpDir, '00-script'),
        paths.storyboardDir,
        paths.shotsDir,
        paths.assetsDir,
        paths.charactersDir,
        paths.imagesDir,
        paths.videosDir,
        paths.memoryDir,
        paths.harnessRunsDir,
      ]) {
        const stat = await fs.stat(dir);
        expect(stat.isDirectory(), `${dir} should be a directory`).toBe(true);
      }
    });

    it('creates storyboard.json with correct structure', async () => {
      await initProjectLayout(tmpDir);
      const paths = getProjectPaths(tmpDir);
      const raw = await fs.readFile(paths.storyboardJson, 'utf-8');
      const storyboard = JSON.parse(raw);

      expect(storyboard).toHaveProperty('id');
      expect(storyboard).toHaveProperty('shotIds');
      expect(Array.isArray(storyboard.shotIds)).toBe(true);
      expect(storyboard.shotIds).toHaveLength(0);
      expect(storyboard).toHaveProperty('createdAt');
    });

    it('creates project-memory.json with correct structure', async () => {
      await initProjectLayout(tmpDir);
      const paths = getProjectPaths(tmpDir);
      const raw = await fs.readFile(paths.projectMemoryJson, 'utf-8');
      const memory = JSON.parse(raw);

      expect(memory).toHaveProperty('projectId');
      expect(memory).toHaveProperty('characters');
      expect(memory).toHaveProperty('continuityNotes');
      expect(Array.isArray(memory.continuityNotes)).toBe(true);
    });

    it('does not overwrite existing storyboard.json on re-init', async () => {
      await initProjectLayout(tmpDir);
      const paths = getProjectPaths(tmpDir);

      // Manually set a custom field
      const storyboard = JSON.parse(await fs.readFile(paths.storyboardJson, 'utf-8'));
      storyboard.title = 'My Custom Title';
      await fs.writeFile(paths.storyboardJson, JSON.stringify(storyboard), 'utf-8');

      await initProjectLayout(tmpDir);

      const reread = JSON.parse(await fs.readFile(paths.storyboardJson, 'utf-8'));
      expect(reread.title).toBe('My Custom Title');
    });
  });

  describe('isVideoProject', () => {
    it('returns true for initialized project', async () => {
      await initProjectLayout(tmpDir);
      expect(await isVideoProject(tmpDir)).toBe(true);
    });

    it('returns false for empty directory', async () => {
      expect(await isVideoProject(tmpDir)).toBe(false);
    });
  });
});
