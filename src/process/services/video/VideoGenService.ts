/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import type { Shot, VideoModelConfig } from '@/common/types/videoCreation';
import { getProjectPaths } from './ProjectLayout';

export type VideoGenProviderResult = {
  success: boolean;
  videoPath?: string;
  error?: string;
};

interface IVideoGenProvider {
  generate(shot: Shot, outputDir: string, apiKey: string, baseUrl?: string): Promise<VideoGenProviderResult>;
}

/** Poll task until status is 'succeed' or 'failed'. Returns task result data or throws. */
async function pollTask(
  fetchFn: () => Promise<{ status: string; videoUrl?: string }>,
  intervalMs = 5000,
  maxAttempts = 60
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await fetchFn();
    if (result.status === 'succeed' && result.videoUrl) return result.videoUrl;
    if (result.status === 'failed') throw new Error('Video generation task failed');
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Video generation timed out');
}

/** Download video from URL to local path */
async function downloadVideo(url: string, destPath: string): Promise<void> {
  const axios = (await import('axios')).default;
  const resp = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 300_000 });
  await fs.writeFile(destPath, Buffer.from(resp.data));
}

// ─── Kling Provider ────────────────────────────────────────────

class KlingProvider implements IVideoGenProvider {
  async generate(shot: Shot, outputDir: string, apiKey: string, baseUrl?: string): Promise<VideoGenProviderResult> {
    try {
      const axios = (await import('axios')).default;
      const { fileToBase64 } = await import('@/common/chat/imageGenCore');

      const base = (baseUrl ?? 'https://api.klingai.com').replace(/\/$/, '');

      const imageBase64 = shot.imagePath ? await fileToBase64(shot.imagePath) : undefined;

      const body: Record<string, unknown> = {
        model_name: shot.id,
        prompt: shot.videoPrompt || shot.imagePrompt,
        duration: String(Math.min(shot.duration, 10)),
        cfg_scale: 0.5,
      };
      if (imageBase64) body['image'] = imageBase64;

      const createResp = await axios.post<{ data?: { task_id?: string } }>(`${base}/v1/videos/image2video`, body, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 60_000,
      });

      const taskId = createResp.data?.data?.task_id;
      if (!taskId) throw new Error('Kling: missing task_id in response');

      const videoUrl = await pollTask(async () => {
        const statusResp = await axios.get<{ data?: { status?: string; works?: Array<{ resource?: string }> } }>(
          `${base}/v1/videos/image2video/${taskId}`,
          { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 30_000 }
        );
        const d = statusResp.data?.data;
        return {
          status: d?.status === 'succeed' ? 'succeed' : d?.status === 'failed' ? 'failed' : 'pending',
          videoUrl: d?.works?.[0]?.resource,
        };
      });

      const destPath = nodePath.join(outputDir, `${shot.id}.mp4`);
      await downloadVideo(videoUrl, destPath);
      return { success: true, videoPath: destPath };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// ─── Runway Provider ───────────────────────────────────────────

class RunwayProvider implements IVideoGenProvider {
  async generate(shot: Shot, outputDir: string, apiKey: string, baseUrl?: string): Promise<VideoGenProviderResult> {
    try {
      const axios = (await import('axios')).default;
      const { fileToBase64 } = await import('@/common/chat/imageGenCore');

      const base = (baseUrl ?? 'https://api.runwayml.com').replace(/\/$/, '');

      const imageBase64 = shot.imagePath ? await fileToBase64(shot.imagePath) : undefined;
      const promptImage = imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : undefined;

      const duration = shot.duration <= 5 ? 5 : 10;

      const createResp = await axios.post<{ id?: string }>(
        `${base}/v1/image_to_video`,
        {
          promptImage,
          promptText: shot.videoPrompt || shot.imagePrompt,
          ratio: '1280:768',
          duration,
        },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 60_000 }
      );

      const taskId = createResp.data?.id;
      if (!taskId) throw new Error('Runway: missing task id in response');

      const videoUrl = await pollTask(async () => {
        const statusResp = await axios.get<{ status?: string; output?: string[] }>(`${base}/v1/tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 30_000,
        });
        const d = statusResp.data;
        return {
          status: d?.status === 'SUCCEEDED' ? 'succeed' : d?.status === 'FAILED' ? 'failed' : 'pending',
          videoUrl: d?.output?.[0],
        };
      });

      const destPath = nodePath.join(outputDir, `${shot.id}.mp4`);
      await downloadVideo(videoUrl, destPath);
      return { success: true, videoPath: destPath };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// ─── VideoGenService ───────────────────────────────────────────

const PROVIDERS: Record<string, IVideoGenProvider> = {
  kling: new KlingProvider(),
  runway: new RunwayProvider(),
};

export class VideoGenService {
  async generateShot(shot: Shot, projectRoot: string, model: VideoModelConfig): Promise<VideoGenProviderResult> {
    const provider = PROVIDERS[model.platform];
    if (!provider) {
      return { success: false, error: `Unknown video provider: ${model.platform}` };
    }

    const paths = getProjectPaths(projectRoot);
    await fs.mkdir(paths.videosDir, { recursive: true });

    return provider.generate(shot, paths.videosDir, model.apiKey, model.baseUrl);
  }
}

export const videoGenService = new VideoGenService();
