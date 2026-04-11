/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Set of file extensions that support in-app preview
 */
export const PREVIEW_SUPPORTED_EXTENSIONS: Set<string> = new Set([
  // Markdown formats
  'md',
  'markdown',
  // Diff formats
  'diff',
  'patch',
  // PDF format
  'pdf',
  // PPT formats
  'ppt',
  'pptx',
  'odp',
  // Word formats
  'doc',
  'docx',
  'odt',
  // Excel formats
  'xls',
  'xlsx',
  'ods',
  'csv',
  // HTML formats
  'html',
  'htm',
  // Code formats
  'js',
  'ts',
  'tsx',
  'jsx',
  'py',
  'java',
  'go',
  'rs',
  'c',
  'cpp',
  'h',
  'hpp',
  'css',
  'scss',
  'json',
  'xml',
  'yaml',
  'yml',
  // Image formats
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'webp',
  'svg',
  'ico',
  'tif',
  'tiff',
  'avif',
]);

/**
 * Check whether a file supports in-app preview based on its extension
 */
export function isPreviewSupportedExt(filename: string): boolean {
  if (!filename) return false;
  const ext = filename.toLowerCase().split('.').pop() || '';
  return PREVIEW_SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Check whether a file is a video project storyboard
 */
export function isStoryboardFile(filename: string): boolean {
  return filename === 'storyboard.json';
}

/**
 * Check whether a file is a storyboard shot json
 */
export function isShotFile(filename: string, relativePath?: string): boolean {
  if (!/^shot-[a-z0-9_-]+\.json$/i.test(filename)) return false;

  const normalizedPath = (relativePath || '').replace(/\\/g, '/');
  return normalizedPath.includes('/01-storyboard/shots/') || normalizedPath.startsWith('01-storyboard/shots/');
}
