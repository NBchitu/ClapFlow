/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import { ClientFactory } from '@/common/api/ClientFactory';
import { safeJsonParse } from '@/common/chat/imageGenCore';
import type { VideoModelConfig } from '@/common/types/videoCreation';
import type { TProviderWithModel } from '@/common/config/storage';

/** Convert VideoModelConfig to TProviderWithModel for ClientFactory */
function toProvider(cfg: VideoModelConfig): TProviderWithModel {
  return {
    id: `video-${cfg.platform}`,
    name: cfg.platform,
    platform: cfg.platform,
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    useModel: cfg.useModel,
    modelProtocols: cfg.modelProtocols,
    model: [cfg.useModel],
  } as unknown as TProviderWithModel;
}

/** Strip JSON from possible markdown code fences */
function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenceMatch ? fenceMatch[1].trim() : text.trim();
}

/**
 * One-shot AI text completion, returns parsed JSON of type T.
 * Returns null if the call fails or JSON cannot be parsed.
 */
export async function callVideoAi<T>(
  modelConfig: VideoModelConfig,
  systemPrompt: string,
  userContent: string | Array<Record<string, unknown>>,
  maxTokens = 4096
): Promise<T | null> {
  try {
    const provider = toProvider(modelConfig);
    const client = await ClientFactory.createRotatingClient(provider, { timeout: 120_000 });

    const userMessage = Array.isArray(userContent)
      ? { role: 'user', content: userContent }
      : { role: 'user', content: userContent };

    const response = await client.createChatCompletion({
      model: modelConfig.useModel,
      messages: [{ role: 'system', content: systemPrompt }, userMessage],
      max_tokens: maxTokens,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const text = response.choices[0]?.message?.content ?? '';
    const jsonStr = extractJson(text);
    return safeJsonParse<T>(jsonStr, null as T);
  } catch (err) {
    console.error('[VideoAiCaller] AI call failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Load the body of a video-creation-suite sub-skill SKILL.md file.
 * Returns empty string if the file cannot be found (graceful degradation).
 */
export async function loadVideoSkillContent(subSkillName: string): Promise<string> {
  try {
    const { getBuiltinSkillsCopyDir } = await import('@process/utils/initStorage');
    const skillPath = nodePath.join(getBuiltinSkillsCopyDir(), 'video-creation-suite', subSkillName, 'SKILL.md');
    const raw = await fs.readFile(skillPath, 'utf-8');
    // Remove YAML frontmatter
    return raw.replace(/^---[\s\S]*?---\s*\n?/, '').trim();
  } catch {
    console.warn(`[VideoAiCaller] Skill not found: video-creation-suite/${subSkillName}`);
    return '';
  }
}
