import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { VideoCreationHarness } from '@process/task/video/VideoCreationHarness';
import { initProjectLayout } from '@process/services/video/ProjectLayout';
import { getProjectPaths } from '@process/services/video/ProjectLayout';

// Mock ipcBridge to avoid Electron dependency in tests
vi.mock('@/common/adapter/ipcBridge', () => ({
  videoCreation: {
    storyboardStream: { emit: vi.fn() },
  },
}));

describe('VideoCreationHarness', () => {
  let tmpDir: string;
  let harness: VideoCreationHarness;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-'));
    await initProjectLayout(tmpDir);
    harness = new VideoCreationHarness();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('run', () => {
    it('completes full run and writes log file', async () => {
      const log = await harness.run(tmpDir);

      expect(log.runId).toMatch(/^run-\d+$/);
      expect(log.projectRoot).toBe(tmpDir);
      expect(log.startedAt).toBeTruthy();
      expect(log.completedAt).toBeTruthy();
      expect(Array.isArray(log.phases)).toBe(true);
    });

    it('writes run log to harness-runs directory', async () => {
      const log = await harness.run(tmpDir);
      const paths = getProjectPaths(tmpDir);
      const logPath = path.join(paths.harnessRunsDir, `${log.runId}.json`);

      const stat = await fs.stat(logPath);
      expect(stat.isFile()).toBe(true);
    });

    it('respects fromPhase option', async () => {
      const log = await harness.run(tmpDir, { fromPhase: 'prompt_pack' });
      const phaseNames = log.phases.map((p) => p.phase);

      expect(phaseNames).not.toContain('director');
      expect(phaseNames).not.toContain('storyboard_decompose');
      expect(phaseNames).toContain('prompt_pack');
    });

    it('respects skipPhases option', async () => {
      const log = await harness.run(tmpDir, { skipPhases: ['image_qa', 'video_generate'] });
      const phaseNames = log.phases.map((p) => p.phase);

      expect(phaseNames).not.toContain('image_qa');
      expect(phaseNames).not.toContain('video_generate');
    });
  });

  describe('runPhase', () => {
    it('runs a single phase and returns result', async () => {
      const result = await harness.runPhase(tmpDir, 'continuity_review');
      expect(result.phase).toBe('continuity_review');
      expect(['completed', 'failed']).toContain(result.status);
      expect(typeof result.durationMs).toBe('number');
    });
  });

  describe('validatePhaseOutput', () => {
    it('validates storyboard_decompose output expects array', () => {
      const r1 = harness.validatePhaseOutput('storyboard_decompose', []);
      expect(r1.valid).toBe(true);

      const r2 = harness.validatePhaseOutput('storyboard_decompose', { notAnArray: true });
      expect(r2.valid).toBe(false);
      expect(r2.errors.length).toBeGreaterThan(0);
    });

    it('validates prompt_pack requires imagePrompt and videoPrompt', () => {
      const valid = [{ id: 'shot-001', imagePrompt: 'a photo', videoPrompt: 'camera static' }];
      expect(harness.validatePhaseOutput('prompt_pack', valid).valid).toBe(true);

      const missing = [{ id: 'shot-001', imagePrompt: '', videoPrompt: '' }];
      const result = harness.validatePhaseOutput('prompt_pack', missing);
      expect(result.valid).toBe(false);
    });
  });

  describe('getLastRunLog', () => {
    it('returns null when no logs exist', async () => {
      const log = await harness.getLastRunLog(tmpDir);
      expect(log).toBeNull();
    });

    it('returns most recent log after running', async () => {
      await harness.run(tmpDir);
      const log = await harness.getLastRunLog(tmpDir);
      expect(log).not.toBeNull();
      expect(log?.runId).toMatch(/^run-\d+$/);
    });
  });
});
