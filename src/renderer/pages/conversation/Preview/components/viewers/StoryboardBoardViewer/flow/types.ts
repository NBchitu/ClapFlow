/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SceneInfo, Shot } from '@/common/types/videoCreation';
import type { Edge, Node } from '@xyflow/react';

export type FlowShotNodeData = Record<string, unknown> & {
  shot: Shot;
  showImagePreview?: boolean;
  onEditShot?: (shotId: string) => void;
  onDeleteShot?: (shotId: string) => void;
};

export type FlowShotNode = Node<FlowShotNodeData, 'shotNode'>;

export type FlowBlankNodeData = Record<string, unknown> & {
  sceneId: string;
};

export type FlowBlankNode = Node<FlowBlankNodeData, 'blankNode'>;

export type FlowSceneNodeData = Record<string, unknown> & {
  scene: SceneInfo;
  shotCount?: number;
};

export type FlowSceneNode = Node<FlowSceneNodeData, 'sceneNode'>;

export type FlowStoryboardNode = FlowSceneNode | FlowShotNode | FlowBlankNode;

export type FlowStoryboardEdgeData = Record<string, unknown> & {
  isProcessing: boolean;
  hasIssue: boolean;
  isCrossScene: boolean;
};

export type FlowStoryboardEdge = Edge<FlowStoryboardEdgeData, 'storyboardEdge'>;
