/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveExtensionAssetUrl } from '@renderer/utils/platform';

const ASSET_PROTOCOL_PREFIX = 'aion-asset://asset/';

function stripLeadingSlashForWindowsDrive(filePath: string): string {
  if (/^\/[A-Za-z]:/.test(filePath)) {
    return filePath.slice(1);
  }
  return filePath;
}

export function normalizeFsPath(inputPath: string): string {
  if (!inputPath) return inputPath;

  if (inputPath.startsWith(ASSET_PROTOCOL_PREFIX)) {
    const decoded = decodeURIComponent(inputPath.slice(ASSET_PROTOCOL_PREFIX.length));
    return stripLeadingSlashForWindowsDrive(decoded);
  }

  if (inputPath.startsWith('file://')) {
    const decoded = decodeURIComponent(inputPath.replace(/^file:\/\/\/?/, ''));
    return stripLeadingSlashForWindowsDrive(decoded);
  }

  return inputPath;
}

/** Derive projectRoot from .../01-storyboard/storyboard.json */
export function deriveProjectRootFromStoryboardPath(storyboardPath: string): string {
  const normalizedPath = normalizeFsPath(storyboardPath);
  const normalizedSepPath = normalizedPath.replace(/\\/g, '/');
  const marker = '/01-storyboard/storyboard.json';
  const markerIndex = normalizedSepPath.lastIndexOf(marker);
  if (markerIndex >= 0) {
    return normalizedSepPath.slice(0, markerIndex);
  }

  const parts = normalizedSepPath.split('/');
  if (parts.length <= 2) return normalizedSepPath;
  parts.splice(-2);
  return parts.join('/');
}

/** Derive projectRoot from .../01-storyboard/shots/shot-xxx.json */
export function deriveProjectRootFromShotPath(shotPath: string): string {
  const normalizedPath = normalizeFsPath(shotPath);
  const normalizedSepPath = normalizedPath.replace(/\\/g, '/');
  const marker = '/01-storyboard/shots/';
  const markerIndex = normalizedSepPath.lastIndexOf(marker);
  if (markerIndex >= 0) {
    return normalizedSepPath.slice(0, markerIndex);
  }

  const parts = normalizedSepPath.split('/');
  if (parts.length <= 3) return normalizedSepPath;
  parts.splice(-3);
  return parts.join('/');
}

export function toPreviewImageSrc(imagePath?: string): string | undefined {
  if (!imagePath) return undefined;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:image/')) {
    return imagePath;
  }

  const absPath = normalizeFsPath(imagePath);
  const assetUrl = `${ASSET_PROTOCOL_PREFIX}${encodeURIComponent(absPath)}`;
  return resolveExtensionAssetUrl(assetUrl);
}
