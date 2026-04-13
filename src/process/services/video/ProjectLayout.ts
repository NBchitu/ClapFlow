/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as nodePath from 'node:path';
import * as fs from 'node:fs/promises';
import type { ProjectPaths, Storyboard, ProjectMemory } from '@/common/types/videoCreation';

/**
 * 给定项目根目录，返回所有标准子路径
 */
export function getProjectPaths(projectRoot: string): ProjectPaths {
  const root = projectRoot;
  const storyboardDir = nodePath.join(root, '01-storyboard');
  const assetsDir = nodePath.join(root, '02-assets');
  const assetReferencesDir = nodePath.join(assetsDir, 'references');
  const characterRefsDir = nodePath.join(assetReferencesDir, 'character');
  const sceneRefsDir = nodePath.join(assetReferencesDir, 'scene');
  const propRefsDir = nodePath.join(assetReferencesDir, 'prop');
  const memoryDir = nodePath.join(root, '90-memory');
  const logsDir = nodePath.join(root, '99-logs');

  return {
    root,
    script: nodePath.join(root, '00-script', 'script.md'),
    storyboardDir,
    storyboardJson: nodePath.join(storyboardDir, 'storyboard.json'),
    shotsDir: nodePath.join(storyboardDir, 'shots'),
    assetsDir,
    charactersDir: nodePath.join(assetsDir, 'characters'),
    scenesDir: nodePath.join(assetsDir, 'scenes'),
    propsDir: nodePath.join(assetsDir, 'props'),
    assetReferencesDir,
    characterRefsDir,
    sceneRefsDir,
    propRefsDir,
    stylePresetsJson: nodePath.join(assetsDir, 'style-presets.json'),
    imagesDir: nodePath.join(root, '03-images'),
    videosDir: nodePath.join(root, '04-videos'),
    memoryDir,
    projectMemoryJson: nodePath.join(memoryDir, 'project-memory.json'),
    logsDir,
    harnessRunsDir: nodePath.join(logsDir, 'harness-runs'),
  };
}

/**
 * 初始化空项目目录结构，创建所有必要的目录和占位文件
 */
export async function initProjectLayout(projectRoot: string): Promise<void> {
  const paths = getProjectPaths(projectRoot);

  const dirs = [
    nodePath.join(projectRoot, '00-script'),
    paths.storyboardDir,
    paths.shotsDir,
    paths.assetsDir,
    paths.charactersDir,
    paths.scenesDir,
    paths.propsDir,
    paths.assetReferencesDir,
    paths.characterRefsDir,
    paths.sceneRefsDir,
    paths.propRefsDir,
    paths.imagesDir,
    paths.videosDir,
    paths.memoryDir,
    paths.logsDir,
    paths.harnessRunsDir,
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  // 初始化 storyboard.json（如果不存在）
  try {
    await fs.access(paths.storyboardJson);
  } catch {
    const initial: Storyboard = {
      id: generateId(),
      title: nodePath.basename(projectRoot),
      projectRoot,
      scriptPath: paths.script,
      style: {
        genre: '',
        visualStyle: '',
        colorPalette: '',
        cameraPreferences: [],
      },
      scenes: [],
      shotIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(paths.storyboardJson, JSON.stringify(initial, null, 2), 'utf-8');
  }

  // 初始化 project-memory.json（如果不存在）
  try {
    await fs.access(paths.projectMemoryJson);
  } catch {
    const initial: ProjectMemory = {
      projectId: generateId(),
      characters: {},
      scenes: {},
      continuityNotes: [],
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(paths.projectMemoryJson, JSON.stringify(initial, null, 2), 'utf-8');
  }

  // 初始化 style-presets.json（如果不存在）
  try {
    await fs.access(paths.stylePresetsJson);
  } catch {
    await fs.writeFile(paths.stylePresetsJson, JSON.stringify([], null, 2), 'utf-8');
  }
}

/**
 * 检查目录是否是合法的视频项目（含 storyboard.json）
 */
export async function isVideoProject(dir: string): Promise<boolean> {
  const paths = getProjectPaths(dir);
  try {
    await fs.access(paths.storyboardJson);
    return true;
  } catch {
    return false;
  }
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
