import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ipcBridge
vi.mock('@/common/adapter/ipcBridge', () => ({
  videoCreation: { storyboardStream: { emit: vi.fn() } },
}));

// Mock axios
const mockAxiosGet = vi.fn();
const mockAxiosPost = vi.fn();
vi.mock('axios', () => ({
  default: {
    get: mockAxiosGet,
    post: mockAxiosPost,
  },
}));

// Mock imageGenCore
vi.mock('@/common/chat/imageGenCore', () => ({
  fileToBase64: vi.fn().mockResolvedValue('base64data'),
}));

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { VideoGenService } from '@process/services/video/VideoGenService';
import { initProjectLayout } from '@process/services/video/ProjectLayout';
import type { Shot, VideoModelConfig } from '@/common/types/videoCreation';

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
    imagePrompt: 'a hero',
    videoPrompt: 'hero walks',
    lockedTokens: [],
    continuityRefs: {},
    assetRefs: [],
    duration: 4,
    status: 'image-approved',
    locked: false,
    imagePath: '/tmp/test-image.jpg',
    ...overrides,
  };
}

function makeKlingModel(): VideoModelConfig {
  return { platform: 'kling', baseUrl: 'https://api.klingai.com', apiKey: 'test-key', useModel: 'kling-v1' };
}

function makeRunwayModel(): VideoModelConfig {
  return { platform: 'runway', baseUrl: 'https://api.runwayml.com', apiKey: 'test-key', useModel: 'gen3a' };
}

describe('VideoGenService', () => {
  let tmpDir: string;
  let service: VideoGenService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidgen-'));
    await initProjectLayout(tmpDir);
    service = new VideoGenService();
    mockAxiosGet.mockReset();
    mockAxiosPost.mockReset();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('KlingProvider', () => {
    it('successfully generates a video', async () => {
      // Mock create task
      mockAxiosPost.mockResolvedValueOnce({ data: { data: { task_id: 'task-123' } } });
      // Mock poll — succeed on first poll
      mockAxiosGet.mockResolvedValueOnce({
        data: { data: { status: 'succeed', works: [{ resource: 'https://cdn.example.com/video.mp4' }] } },
      });
      // Mock download
      const videoBuffer = Buffer.from('fake-video-data');
      mockAxiosGet.mockResolvedValueOnce({ data: videoBuffer.buffer });

      const shot = makeShot('shot-001');
      const result = await service.generateShot(shot, tmpDir, makeKlingModel());

      expect(result.success).toBe(true);
      expect(result.videoPath).toContain('shot-001.mp4');
    });

    it('returns failure on non-2xx or missing task_id', async () => {
      mockAxiosPost.mockRejectedValueOnce(new Error('HTTP 500'));

      const shot = makeShot('shot-002');
      const result = await service.generateShot(shot, tmpDir, makeKlingModel());

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 500');
    });

    it('returns failure when polling reports failed status', async () => {
      mockAxiosPost.mockResolvedValueOnce({ data: { data: { task_id: 'task-fail' } } });
      mockAxiosGet.mockResolvedValueOnce({ data: { data: { status: 'failed' } } });

      const shot = makeShot('shot-003');
      const result = await service.generateShot(shot, tmpDir, makeKlingModel());

      expect(result.success).toBe(false);
    });
  });

  describe('RunwayProvider', () => {
    it('successfully generates a video', async () => {
      mockAxiosPost.mockResolvedValueOnce({ data: { id: 'runway-task-1' } });
      mockAxiosGet.mockResolvedValueOnce({
        data: { status: 'SUCCEEDED', output: ['https://cdn.example.com/runway.mp4'] },
      });
      const videoBuffer = Buffer.from('fake-runway-video');
      mockAxiosGet.mockResolvedValueOnce({ data: videoBuffer.buffer });

      const shot = makeShot('shot-004');
      const result = await service.generateShot(shot, tmpDir, makeRunwayModel());

      expect(result.success).toBe(true);
      expect(result.videoPath).toContain('shot-004.mp4');
    });

    it('returns failure on API error', async () => {
      mockAxiosPost.mockRejectedValueOnce(new Error('Unauthorized'));

      const shot = makeShot('shot-005');
      const result = await service.generateShot(shot, tmpDir, makeRunwayModel());

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });
  });

  describe('VideoGenService.generateShot', () => {
    it('selects KlingProvider for platform=kling', async () => {
      mockAxiosPost.mockResolvedValueOnce({ data: { data: { task_id: 'k1' } } });
      mockAxiosGet.mockResolvedValueOnce({
        data: { data: { status: 'succeed', works: [{ resource: 'https://example.com/v.mp4' }] } },
      });
      mockAxiosGet.mockResolvedValueOnce({ data: Buffer.from('').buffer });

      const shot = makeShot('shot-006');
      const result = await service.generateShot(shot, tmpDir, makeKlingModel());
      // Should have called Kling endpoint
      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/v1/videos/image2video'),
        expect.any(Object),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('returns failure for unknown platform', async () => {
      const shot = makeShot('shot-007');
      const model: VideoModelConfig = { platform: 'unknown', baseUrl: '', apiKey: 'k', useModel: 'm' };
      const result = await service.generateShot(shot, tmpDir, model);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown video provider');
    });
  });
});
