import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { initProjectLayout, getProjectPaths } from '@process/services/video/ProjectLayout';
import { StoryboardService } from '@process/services/video/StoryboardService';
import type { Shot } from '@/common/types/videoCreation';

const mockExecuteImageGeneration = vi.hoisted(() => vi.fn());
const mockProcessConfigGet = vi.hoisted(() => vi.fn());

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

function makeShot(overrides?: Partial<Shot>): Shot {
  return {
    id: 'shot-001',
    sceneIndex: 0,
    shotIndex: 1,
    goal: 'test',
    sceneDescription: 'test',
    characters: [],
    action: '',
    dialogue: '',
    shotType: 'MS',
    cameraMove: 'static',
    imagePrompt: 'a cinematic frame',
    videoPrompt: '',
    lockedTokens: [],
    continuityRefs: {},
    assetRefs: [],
    duration: 4,
    status: 'prompts-ready',
    locked: false,
    ...overrides,
  };
}

describe('VideoCreationHarness image versioning', () => {
  let tmpDir: string;
  let storyboardService: StoryboardService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-image-version-'));
    await initProjectLayout(tmpDir);
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

  async function setupSingleShot(shot: Shot): Promise<void> {
    await storyboardService.writeShot(tmpDir, shot);
    await storyboardService.updateStoryboard(tmpDir, { shotIds: [shot.id] });
  }

  it('promotes generated temp image to canonical shot filename (no duplicate temp file)', async () => {
    const { VideoCreationHarness } = await import('@process/task/video/VideoCreationHarness');
    const harness = new VideoCreationHarness();
    const paths = getProjectPaths(tmpDir);

    const shot = makeShot();
    await setupSingleShot(shot);

    const tempGeneratedPath = path.join(paths.imagesDir, 'img-111.png');
    await fs.writeFile(tempGeneratedPath, Buffer.from('new-image'));
    mockExecuteImageGeneration.mockResolvedValue({
      success: true,
      imagePath: tempGeneratedPath,
    });

    const result = await harness.runPhase(tmpDir, 'image_generate');
    expect(result.status).toBe('completed');
    expect(result.affectedShotIds).toContain('shot-001');

    const canonicalPath = path.join(paths.imagesDir, 'shot-001.png');
    await expect(fs.stat(canonicalPath)).resolves.toBeTruthy();
    await expect(fs.access(tempGeneratedPath)).rejects.toThrow();

    const updated = await storyboardService.readShot(tmpDir, 'shot-001');
    expect(updated.imagePath).toBe(canonicalPath);
    expect(updated.imageHistory).toBeUndefined();
  });

  it('moves previous image to shot-XXX_vN and keeps canonical filename stable on regenerate', async () => {
    const { VideoCreationHarness } = await import('@process/task/video/VideoCreationHarness');
    const harness = new VideoCreationHarness();
    const paths = getProjectPaths(tmpDir);

    const currentImagePath = path.join(paths.imagesDir, 'shot-001.png');
    await fs.writeFile(currentImagePath, Buffer.from('old-image'));

    const shot = makeShot({ imagePath: currentImagePath });
    await setupSingleShot(shot);

    const tempGeneratedPath = path.join(paths.imagesDir, 'img-222.png');
    await fs.writeFile(tempGeneratedPath, Buffer.from('new-image'));
    mockExecuteImageGeneration.mockResolvedValue({
      success: true,
      imagePath: tempGeneratedPath,
    });

    const result = await harness.runPhase(tmpDir, 'image_generate');
    expect(result.status).toBe('completed');
    expect(result.affectedShotIds).toContain('shot-001');

    const versionedPath = path.join(paths.imagesDir, 'shot-001_v1.png');
    await expect(fs.stat(versionedPath)).resolves.toBeTruthy();
    await expect(fs.stat(currentImagePath)).resolves.toBeTruthy();
    await expect(fs.access(tempGeneratedPath)).rejects.toThrow();

    const updated = await storyboardService.readShot(tmpDir, 'shot-001');
    expect(updated.imagePath).toBe(currentImagePath);
    expect(updated.imageHistory?.[0]).toBe(versionedPath);
  });
});
