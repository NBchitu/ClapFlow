/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SceneInfo, Shot } from '@/common/types/videoCreation';
import type { FlowBlankNode, FlowSceneNode, FlowShotNode, FlowStoryboardEdge, FlowStoryboardNode } from './types';

const SCENE_START_X = 48;
const SCENE_START_Y = 40;
const SCENE_GAP_X = 56;
const SCENE_GAP_Y = 56;
const SCENE_HEADER_H = 44;
const SCENE_PADDING_X = 24;
const SCENE_PADDING_Y = 16;
const SHOT_NODE_W = 320;
const SHOT_NODE_H = 300;
const SHOT_GAP_X = 18;
const SHOT_GAP_Y = 10;
const MIN_SCENE_W = 320;
const SCENE_MIN_H = 264;
const MAX_SCENES_PER_ROW = 2;

export function mapShotsToFlowNodes(
  shotIds: string[],
  shotsById: Map<string, Shot>,
  scenes: SceneInfo[],
  selectedShotId: string | null,
  actions?: {
    onEditShot?: (shotId: string) => void;
    onDeleteShot?: (shotId: string) => void;
  }
): Array<FlowStoryboardNode> {
  const nodes: Array<FlowStoryboardNode> = [];

  const sceneOrder: SceneInfo[] = [];
  const sceneMap = new Map<string, SceneInfo>();
  for (const [index, scene] of scenes.entries()) {
    const sceneId = scene.id || `scene-${String(index + 1).padStart(2, '0')}`;
    const normalized: SceneInfo = {
      ...scene,
      id: sceneId,
      name: scene.name || `Scene ${index + 1}`,
      description: scene.description || '',
      shotIds: scene.shotIds ?? [],
    };
    sceneOrder.push(normalized);
    sceneMap.set(sceneId, normalized);
  }

  const shotsByScene = new Map<string, Shot[]>();
  for (const shotId of shotIds) {
    const shot = shotsById.get(shotId);
    if (!shot) continue;
    const sceneId =
      shot.sceneId ?? sceneOrder[shot.sceneIndex]?.id ?? `scene-${String(shot.sceneIndex + 1).padStart(2, '0')}`;
    const list = shotsByScene.get(sceneId) ?? [];
    list.push(shot);
    shotsByScene.set(sceneId, list);
    if (!sceneMap.has(sceneId)) {
      const syntheticScene: SceneInfo = {
        id: sceneId,
        name: `Scene ${sceneOrder.length + 1}`,
        description: shot.sceneDescription || '',
        shotIds: [],
      };
      sceneOrder.push(syntheticScene);
      sceneMap.set(sceneId, syntheticScene);
    }
  }

  const totalShotCount = Array.from(shotsByScene.values()).reduce((sum, list) => sum + list.length, 0);
  let currentX = SCENE_START_X;
  let currentY = SCENE_START_Y;
  let currentRowMaxH = SCENE_MIN_H;
  let scenesInRow = 0;
  for (const scene of sceneOrder) {
    const sceneShots = shotsByScene.get(scene.id) ?? [];
    const gridSize = Math.max(2, Math.ceil(Math.sqrt(Math.max(1, sceneShots.length))));
    const columns = gridSize;
    const rows = gridSize;
    const slotCount = gridSize * gridSize;
    const width = Math.max(
      MIN_SCENE_W,
      columns * SHOT_NODE_W + Math.max(0, columns - 1) * SHOT_GAP_X + SCENE_PADDING_X * 2
    );
    const height = Math.max(
      SCENE_MIN_H,
      SCENE_HEADER_H + SCENE_PADDING_Y * 2 + rows * SHOT_NODE_H + Math.max(0, rows - 1) * SHOT_GAP_Y + 14
    );

    if (scenesInRow >= MAX_SCENES_PER_ROW) {
      currentX = SCENE_START_X;
      currentY += currentRowMaxH + SCENE_GAP_Y;
      currentRowMaxH = SCENE_MIN_H;
      scenesInRow = 0;
    }

    const sceneNode: FlowSceneNode = {
      id: scene.id,
      type: 'sceneNode',
      position: { x: currentX, y: currentY },
      data: {
        scene,
        shotCount: sceneShots.length || scene.shotIds?.length || 0,
      },
      draggable: false,
      selectable: false,
      style: {
        width,
        height,
        background: 'transparent',
      },
    };
    nodes.push(sceneNode);

    for (let index = 0; index < slotCount; index++) {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const slotPosition = {
        x: SCENE_PADDING_X + col * (SHOT_NODE_W + SHOT_GAP_X),
        y: SCENE_HEADER_H + SCENE_PADDING_Y + row * (SHOT_NODE_H + SHOT_GAP_Y),
      };

      const shot = sceneShots[index];
      if (shot) {
        const showImagePreview = totalShotCount <= 32 || selectedShotId === shot.id;
        const shotNode: FlowShotNode = {
          id: shot.id,
          type: 'shotNode',
          parentId: scene.id,
          extent: 'parent',
          position: slotPosition,
          selected: selectedShotId === shot.id,
          data: {
            shot,
            showImagePreview,
            onEditShot: actions?.onEditShot,
            onDeleteShot: actions?.onDeleteShot,
          },
          draggable: false,
        };
        nodes.push(shotNode);
      } else {
        const blankNode: FlowBlankNode = {
          id: `${scene.id}-blank-${index}`,
          type: 'blankNode',
          parentId: scene.id,
          extent: 'parent',
          position: slotPosition,
          data: { sceneId: scene.id },
          selectable: false,
          draggable: false,
        };
        nodes.push(blankNode);
      }
    }

    currentX += width + SCENE_GAP_X;
    currentRowMaxH = Math.max(currentRowMaxH, height);
    scenesInRow += 1;
  }

  return nodes;
}

function isProcessingStatus(status: Shot['status']): boolean {
  return status === 'image-generating';
}

export function mapShotIdsToLinearEdges(shotIds: string[], shotsById: Map<string, Shot>): Array<FlowStoryboardEdge> {
  const edges: Array<FlowStoryboardEdge> = [];

  for (let i = 0; i < shotIds.length - 1; i++) {
    const sourceId = shotIds[i];
    const targetId = shotIds[i + 1];
    const sourceShot = shotsById.get(sourceId);
    const targetShot = shotsById.get(targetId);
    if (!sourceShot || !targetShot) continue;
    const hasIssue = Boolean(
      sourceShot.qaIssues?.some((issue) => issue.severity === 'error') ||
      targetShot.qaIssues?.some((issue) => issue.severity === 'error')
    );
    const isProcessing = isProcessingStatus(sourceShot.status) || isProcessingStatus(targetShot.status);
    const sourceSceneId = sourceShot.sceneId ?? `scene-${String(sourceShot.sceneIndex + 1).padStart(2, '0')}`;
    const targetSceneId = targetShot.sceneId ?? `scene-${String(targetShot.sceneIndex + 1).padStart(2, '0')}`;
    const isCrossScene = sourceSceneId !== targetSceneId;

    edges.push({
      id: `edge-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      type: 'storyboardEdge',
      animated: isProcessing,
      data: { isProcessing, hasIssue, isCrossScene },
      markerEnd: {
        type: 'arrowclosed',
        width: 20,
        height: 20,
        color: 'var(--color-ink, #000)',
      },
    });
  }

  return edges;
}
