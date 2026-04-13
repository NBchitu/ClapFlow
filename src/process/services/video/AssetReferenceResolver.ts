/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import type { AssetType, CharacterAsset, PropAsset, SceneAsset, Shot } from '@/common/types/videoCreation';

export const MAX_REFERENCE_IMAGES = 6;

export type ResolvedAssetRef = {
  id: string;
  type: AssetType;
  name: string;
  prompt?: string;
  description?: string;
  appearance?: string;
  lockedTokens?: string[];
  referenceImagePaths?: string[];
  primaryReferenceImagePath?: string;
};

export type ResolveShotReferenceResult = {
  imageUris: string[];
  resolvedAssetIds: string[];
  fallbackPromptPrefix: string;
  referencePromptPrefix: string;
  warnings: string[];
};

type OrderedImageReference = {
  imageUri: string;
  assetId: string;
  assetType: AssetType;
  assetName: string;
  promptName: string;
  description: string;
};

const PRIORITY: Record<AssetType, number> = {
  character: 0,
  scene: 1,
  prop: 2,
};

function normalizeName(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/\s+/g, '_');
}

function canonicalName(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function toNameUsageKey(input: string): string {
  const canonical = canonicalName(input);
  if (canonical) return canonical;
  return normalizeName(input).toLowerCase();
}

function isStrictMatch(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  if (normalizedLeft && normalizedRight && normalizedLeft === normalizedRight) return true;
  const canonicalLeft = canonicalName(left);
  const canonicalRight = canonicalName(right);
  return Boolean(canonicalLeft && canonicalRight && canonicalLeft === canonicalRight);
}

function isLooseMatch(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (
    normalizedLeft === normalizedRight ||
    normalizedLeft.startsWith(`${normalizedRight}_`) ||
    normalizedRight.startsWith(`${normalizedLeft}_`)
  ) {
    return true;
  }

  const canonicalLeft = canonicalName(left);
  const canonicalRight = canonicalName(right);
  if (!canonicalLeft || !canonicalRight) return false;
  if (canonicalLeft === canonicalRight) return true;
  if (
    canonicalLeft.length >= 2 &&
    canonicalRight.length >= 2 &&
    (canonicalLeft.includes(canonicalRight) || canonicalRight.includes(canonicalLeft))
  ) {
    return true;
  }
  return false;
}

export function parseAssetMentions(text: string): string[] {
  if (!text) return [];
  const regex = /@([\p{L}\p{N}_-]+)/gu;
  const result: string[] = [];
  let match = regex.exec(text);
  while (match) {
    result.push(match[1]);
    match = regex.exec(text);
  }
  return result;
}

function parsePromptTokens(text: string): string[] {
  if (!text) return [];
  const regex = /[\p{L}\p{N}][\p{L}\p{N}_-]*/gu;
  const result: string[] = [];
  const seen = new Set<string>();
  let match = regex.exec(text);
  while (match) {
    const token = match[0].trim();
    if (token && !seen.has(token)) {
      seen.add(token);
      result.push(token);
    }
    match = regex.exec(text);
  }
  return result;
}

function toAssetRefList(assets: {
  characters: CharacterAsset[];
  scenes: SceneAsset[];
  props: PropAsset[];
}): ResolvedAssetRef[] {
  return [
    ...assets.characters.map((asset) => ({ ...asset, type: 'character' as const })),
    ...assets.scenes.map((asset) => ({ ...asset, type: 'scene' as const })),
    ...assets.props.map((asset) => ({ ...asset, type: 'prop' as const })),
  ];
}

function resolveDefaultAssetIds(shot: Shot, allAssets: ResolvedAssetRef[]): string[] {
  const sceneId = shot.sceneId;
  const charNames = new Set((shot.characters ?? []).map((name) => name?.trim()).filter(Boolean));
  const sceneDescription = shot.sceneDescription?.trim() ?? '';

  return allAssets
    .filter((asset) => {
      if (asset.type === 'scene') {
        if (sceneId && isLooseMatch(asset.id, sceneId)) return true;
        if (
          sceneDescription &&
          (isLooseMatch(asset.name, sceneDescription) || isLooseMatch(asset.description, sceneDescription))
        ) {
          return true;
        }
      }
      if (asset.type === 'character' && charNames.size > 0) {
        for (const charName of charNames) {
          if (isLooseMatch(asset.name, charName)) {
            return true;
          }
        }
      }
      return false;
    })
    .map((asset) => asset.id);
}

function buildAssetAliasSet(asset: ResolvedAssetRef): Set<string> {
  const name = normalizeName(asset.name);
  const aliases = new Set<string>();
  if (name) aliases.add(name);
  const normalizedId = normalizeName(asset.id);
  if (normalizedId) aliases.add(normalizedId);
  for (const part of name.split(/[_-]+/g)) {
    if (part) aliases.add(part);
  }
  const canonicalFullName = canonicalName(asset.name);
  if (canonicalFullName) aliases.add(canonicalFullName);
  for (const token of asset.lockedTokens ?? []) {
    const normalizedToken = normalizeName(token);
    if (normalizedToken) aliases.add(normalizedToken);
    const canonicalToken = canonicalName(token);
    if (canonicalToken) aliases.add(canonicalToken);
  }
  return aliases;
}

function buildAssetLooseAliasSet(asset: ResolvedAssetRef): Set<string> {
  const name = normalizeName(asset.name);
  const aliases = new Set<string>();
  if (name) aliases.add(name);
  const normalizedId = normalizeName(asset.id);
  if (normalizedId) aliases.add(normalizedId);
  for (const part of name.split(/[_-]+/g)) {
    if (part) aliases.add(part);
  }
  const canonicalFullName = canonicalName(asset.name);
  if (canonicalFullName) aliases.add(canonicalFullName);
  return aliases;
}

function matchesAssetAlias(candidate: string, aliases: Set<string>): boolean {
  if (!candidate) return false;
  for (const alias of aliases) {
    if (isLooseMatch(alias, candidate)) return true;
  }
  return false;
}

function matchesAssetAliasStrict(candidate: string, aliases: Set<string>): boolean {
  if (!candidate) return false;
  for (const alias of aliases) {
    if (isStrictMatch(alias, candidate)) return true;
  }
  return false;
}

function pickPromptDisplayName(
  asset: ResolvedAssetRef,
  orderedMentionNames: string[],
  orderedTokens: string[],
  usedPromptNames: Set<string>
): string | undefined {
  const strictAliases = buildAssetAliasSet(asset);
  const looseAliases = buildAssetLooseAliasSet(asset);

  for (const mention of orderedMentionNames) {
    const key = toNameUsageKey(mention);
    if (usedPromptNames.has(key)) continue;
    if (matchesAssetAliasStrict(mention, strictAliases)) {
      usedPromptNames.add(key);
      return mention;
    }
  }

  for (const token of orderedTokens) {
    const key = toNameUsageKey(token);
    if (usedPromptNames.has(key)) continue;
    if (matchesAssetAliasStrict(token, strictAliases)) {
      usedPromptNames.add(key);
      return token;
    }
  }

  for (const mention of orderedMentionNames) {
    const key = toNameUsageKey(mention);
    if (usedPromptNames.has(key)) continue;
    if (matchesAssetAlias(mention, looseAliases)) {
      usedPromptNames.add(key);
      return mention;
    }
  }

  for (const token of orderedTokens) {
    const key = toNameUsageKey(token);
    if (usedPromptNames.has(key)) continue;
    if (matchesAssetAlias(token, looseAliases)) {
      usedPromptNames.add(key);
      return token;
    }
  }

  return undefined;
}

function resolveMentionAssetIds(mentions: string[], allAssets: ResolvedAssetRef[]): string[] {
  if (mentions.length === 0) return [];
  const mentionSet = new Set(mentions.map((mention) => mention.trim()).filter(Boolean));
  return allAssets
    .filter((asset) => {
      const aliases = buildAssetAliasSet(asset);
      for (const mention of mentionSet) {
        for (const alias of aliases) {
          if (isLooseMatch(alias, mention)) {
            return true;
          }
        }
      }
      return false;
    })
    .map((asset) => asset.id);
}

async function collectImageUris(
  projectRoot: string,
  assets: ResolvedAssetRef[]
): Promise<{
  imageUris: string[];
  orderedImageRefs: Array<{ imageUri: string; asset: ResolvedAssetRef }>;
  warnings: string[];
}> {
  const imageUris: string[] = [];
  const orderedImageRefs: Array<{ imageUri: string; asset: ResolvedAssetRef }> = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const asset of assets) {
    if (imageUris.length >= MAX_REFERENCE_IMAGES) break;
    const orderedPaths = [asset.primaryReferenceImagePath, ...(asset.referenceImagePaths ?? [])].filter(
      (p): p is string => Boolean(p)
    );

    let selectedPath = '';
    for (const imagePath of orderedPaths) {
      const absolutePath = nodePath.isAbsolute(imagePath) ? imagePath : nodePath.join(projectRoot, imagePath);
      const dedupKey = absolutePath.replace(/\\/g, '/');
      if (seen.has(dedupKey)) continue;

      try {
        await fs.access(absolutePath);
        selectedPath = absolutePath;
        seen.add(dedupKey);
        break;
      } catch {
        warnings.push(`Missing reference image: ${imagePath}`);
      }
    }

    if (!selectedPath) continue;
    imageUris.push(selectedPath);
    orderedImageRefs.push({ imageUri: selectedPath, asset });
  }

  return { imageUris, orderedImageRefs, warnings };
}

function buildFallbackPromptPrefix(assets: ResolvedAssetRef[], shot: Shot): string {
  const mentionNames = [
    ...new Set(parseAssetMentions([shot.imagePrompt, shot.goal, shot.action, shot.dialogue].join('\n'))),
  ];
  const nonCharacterNames = assets
    .filter((asset) => asset.type !== 'character')
    .map((asset) => asset.name)
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
  const buildSection = (type: AssetType, title: string): string => {
    const lines = assets
      .filter((asset) => asset.type === type)
      .map((asset) => {
        const fallbackDescription =
          type === 'scene'
            ? shot.sceneDescription || '请保持该场景空间与氛围一致。'
            : '请保持该资产在画面中的身份与视觉一致（未配置详细设定）。';
        const description = asset.prompt || asset.description || asset.appearance || fallbackDescription;
        const displayName = asset.name?.trim() || asset.id;
        return `- ${displayName}：${description}`;
      })
      .filter((line): line is string => Boolean(line));
    if (type === 'scene' && lines.length === 0 && shot.sceneDescription?.trim()) {
      lines.push(`- 当前场景：${shot.sceneDescription.trim()}`);
    }
    if (type === 'character' && lines.length === 0) {
      const names = [...new Set([...(shot.characters ?? []), ...mentionNames])]
        .map((name) => name.trim())
        .filter(Boolean)
        .filter((name) => !nonCharacterNames.some((nonCharacterName) => isLooseMatch(name, nonCharacterName)));
      for (const name of names) {
        lines.push(`- ${name}：请保持该角色身份与外观一致（未配置详细设定）。`);
      }
    }
    if (lines.length === 0) return '';
    return `${title}\n${lines.join('\n')}`;
  };

  const sections = [
    buildSection('character', '角色清单：'),
    buildSection('scene', '场景清单：'),
    buildSection('prop', '道具清单：'),
  ].filter(Boolean);

  if (sections.length === 0) return '';
  return `参考资产设定：\n${sections.join('\n')}\n`;
}

function buildReferenceDescription(asset: ResolvedAssetRef): string {
  return (
    asset.prompt?.trim() ||
    asset.description?.trim() ||
    asset.appearance?.trim() ||
    (asset.type === 'scene'
      ? '请保持该场景空间结构、时间氛围与光线逻辑一致。'
      : '请保持该资产身份、外观特征与画面一致性。')
  );
}

function buildReferencePromptPrefix(imageRefs: OrderedImageReference[]): string {
  if (imageRefs.length === 0) return '';
  const lines = imageRefs.map((ref, index) => {
    const typeLabel = ref.assetType === 'character' ? '角色' : ref.assetType === 'scene' ? '场景' : '道具';
    return `- 图片${index + 1}为${ref.promptName}（${typeLabel}）：${ref.description}`;
  });

  return [
    '参考图片与资产对应关系（请严格按顺序理解）：',
    ...lines,
    '请确保最终画面中的角色/场景/道具与上述参考图片保持身份和外观一致。',
    '',
  ].join('\n');
}

export function stripAssetMentionMarkers(prompt: string): string {
  if (!prompt) return '';
  return prompt
    .replace(/@([\p{L}\p{N}_-]+)/gu, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function resolveShotReferences(
  projectRoot: string,
  shot: Shot,
  assets: {
    characters: CharacterAsset[];
    scenes: SceneAsset[];
    props: PropAsset[];
  }
): Promise<ResolveShotReferenceResult> {
  const allAssets = toAssetRefList(assets);
  const assetById = new Map(allAssets.map((asset) => [asset.id, asset]));
  const promptText = [shot.imagePrompt, shot.goal, shot.action, shot.dialogue].filter(Boolean).join('\n');
  const orderedMentionNames = parseAssetMentions(promptText);
  const orderedTokens = parsePromptTokens(promptText);

  const mentionNames = parseAssetMentions(
    [shot.goal, shot.action, shot.dialogue, shot.sceneDescription, shot.imagePrompt].join('\n')
  );

  const sourceIds = [
    ...(shot.assetRefs ?? []),
    ...resolveDefaultAssetIds(shot, allAssets),
    ...resolveMentionAssetIds(mentionNames, allAssets),
  ];
  const dedupIds = [...new Set(sourceIds)].filter((id) => assetById.has(id));

  const orderedAssets = dedupIds
    .map((id) => assetById.get(id) as ResolvedAssetRef)
    .toSorted((a, b) => PRIORITY[a.type] - PRIORITY[b.type]);

  const { imageUris, orderedImageRefs, warnings } = await collectImageUris(projectRoot, orderedAssets);
  const unusedCharacterNames = (shot.characters ?? []).map((name) => name.trim()).filter(Boolean);
  const usedPromptNames = new Set<string>();
  const normalizedImageRefs: OrderedImageReference[] = orderedImageRefs.map((item) => {
    const resolvedName = pickPromptDisplayName(item.asset, orderedMentionNames, orderedTokens, usedPromptNames);
    let promptName = resolvedName;

    if (!promptName && item.asset.type === 'character' && unusedCharacterNames.length > 0) {
      const fallbackCharacterName = unusedCharacterNames.shift();
      if (fallbackCharacterName) {
        promptName = fallbackCharacterName;
        usedPromptNames.add(toNameUsageKey(fallbackCharacterName));
      }
    }

    return {
      imageUri: item.imageUri,
      assetId: item.asset.id,
      assetType: item.asset.type,
      assetName: item.asset.name,
      promptName: promptName || item.asset.name?.trim() || item.asset.id,
      description: buildReferenceDescription(item.asset),
    };
  });
  return {
    imageUris,
    warnings,
    resolvedAssetIds: orderedAssets.map((asset) => asset.id),
    fallbackPromptPrefix: buildFallbackPromptPrefix(orderedAssets, shot),
    referencePromptPrefix: buildReferencePromptPrefix(normalizedImageRefs),
  };
}

export function buildPromptWithFallbackPrefix(prefix: string, originalPrompt: string): string {
  if (!prefix) return originalPrompt;
  return `${prefix}${originalPrompt}`.trim();
}

export function buildPromptWithReferencePrefix(prefix: string, originalPrompt: string): string {
  if (!prefix) return originalPrompt;
  return `${prefix}${originalPrompt}`.trim();
}
