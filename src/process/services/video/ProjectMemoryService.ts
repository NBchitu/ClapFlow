/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import type { ProjectMemory } from '@/common/types/videoCreation';
import { getProjectPaths } from './ProjectLayout';

/**
 * 项目长记忆服务
 * 维护 90-memory/project-memory.json，为 AI 上下文提供精简摘要
 */
export class ProjectMemoryService {
  async read(projectRoot: string): Promise<ProjectMemory> {
    const paths = getProjectPaths(projectRoot);
    try {
      const raw = await fs.readFile(paths.projectMemoryJson, 'utf-8');
      return JSON.parse(raw) as ProjectMemory;
    } catch {
      return {
        projectId: '',
        characters: {},
        scenes: {},
        continuityNotes: [],
        updatedAt: new Date().toISOString(),
      };
    }
  }

  async update(projectRoot: string, patch: Partial<ProjectMemory>): Promise<void> {
    const paths = getProjectPaths(projectRoot);
    const current = await this.read(projectRoot);
    const updated: ProjectMemory = {
      ...current,
      ...patch,
      characters: { ...current.characters, ...patch.characters },
      scenes: { ...current.scenes, ...patch.scenes },
      continuityNotes: patch.continuityNotes ?? current.continuityNotes,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(paths.projectMemoryJson, JSON.stringify(updated, null, 2), 'utf-8');
  }

  /**
   * 生成用于注入 AI 上下文的精简摘要（控制在 500 tokens 以内）
   */
  buildContextSummary(memory: ProjectMemory): string {
    const lines: string[] = ['## Project Memory Summary'];

    if (memory.style) {
      lines.push(`**Style**: ${memory.style.genre} / ${memory.style.visualStyle}`);
    }

    const charEntries = Object.values(memory.characters);
    if (charEntries.length > 0) {
      lines.push('**Characters**:');
      for (const char of charEntries) {
        const tokens = char.lockedTokens.length > 0 ? ` [tokens: ${char.lockedTokens.slice(0, 3).join(', ')}]` : '';
        lines.push(`- ${char.name}: ${char.appearance.slice(0, 80)}${tokens}`);
      }
    }

    const sceneEntries = Object.values(memory.scenes);
    if (sceneEntries.length > 0) {
      lines.push('**Scenes**:');
      for (const scene of sceneEntries.slice(0, 5)) {
        lines.push(`- ${scene.name}: ${scene.description.slice(0, 60)}`);
      }
    }

    if (memory.continuityNotes.length > 0) {
      lines.push('**Continuity Notes**:');
      for (const note of memory.continuityNotes.slice(0, 5)) {
        lines.push(`- ${note}`);
      }
    }

    return lines.join('\n');
  }
}
