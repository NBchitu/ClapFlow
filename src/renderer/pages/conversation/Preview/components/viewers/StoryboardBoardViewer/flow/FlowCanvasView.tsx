/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SceneInfo, Shot } from '@/common/types/videoCreation';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  type Edge,
  type EdgeTypes,
  type NodeTypes,
  type NodeMouseHandler,
  type NodeProps,
  type Viewport,
} from '@xyflow/react';
import React, { useCallback, useMemo } from 'react';
import FlowBlankNode from './FlowBlankNode';
import FlowFloatingToolbar from './FlowFloatingToolbar';
import FlowShotNode from './FlowShotNode';
import StoryboardEdge from './StoryboardEdge';
import { mapShotIdsToLinearEdges, mapShotsToFlowNodes } from './shotFlowMapper';
import type { FlowSceneNode, FlowShotNode as FlowShotNodeType, FlowStoryboardNode } from './types';
import '@xyflow/react/dist/style.css';

type FlowCanvasViewProps = {
  shotIds: string[];
  shotsById: Map<string, Shot>;
  scenes: SceneInfo[];
  selectedShotId: string | null;
  onSelectShot: (shotId: string) => void;
  onDeleteShot?: (shotId: string) => void;
  viewportKey?: string;
};

const VIEWPORT_CACHE = new Map<string, Viewport>();
const DEFAULT_CANVAS_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 0.5 };

const FlowSceneNodeView: React.FC<NodeProps<FlowSceneNode>> = ({ data }) => {
  const shotCount = data.shotCount ?? data.scene.shotIds?.length ?? 0;
  return (
    <div className='w-full h-full rounded-12px border-2 border-[var(--color-ink,#000)] bg-white shadow-[4px_4px_0_0_var(--color-ink,#000)] p-10px transition-all duration-150 hover:border-[var(--color-lime-pop,#D9FF00)] hover:shadow-[6px_6px_0_0_var(--color-ink,#000)]'>
      <div className='inline-flex items-center gap-5px px-8px py-3px rounded-7px border-2 border-[var(--color-ink,#000)] bg-[var(--color-ink,#000)] text-[var(--color-lime-pop,#D9FF00)] font-bold text-10px shadow-[2px_2px_0_0_var(--color-ink,#000)]'>
        <span>{data.scene.name}</span>
        <span className='text-white/90'>{shotCount}</span>
      </div>
      {data.scene.description ? (
        <p className='mt-7px text-11px leading-16px text-[var(--color-ink,#000)] font-semibold line-clamp-2'>
          {data.scene.description}
        </p>
      ) : null}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  shotNode: FlowShotNode,
  blankNode: FlowBlankNode,
  sceneNode: FlowSceneNodeView,
};
const edgeTypes: EdgeTypes = { storyboardEdge: StoryboardEdge };

const FlowCanvasView: React.FC<FlowCanvasViewProps> = ({
  shotIds,
  shotsById,
  scenes,
  selectedShotId,
  onSelectShot,
  onDeleteShot,
  viewportKey,
}) => {
  const cachedViewport = useMemo(() => {
    if (!viewportKey) return undefined;
    return VIEWPORT_CACHE.get(viewportKey);
  }, [viewportKey]);
  const initialViewport = cachedViewport ?? DEFAULT_CANVAS_VIEWPORT;
  const nodes = useMemo<Array<FlowStoryboardNode>>(
    () =>
      mapShotsToFlowNodes(shotIds, shotsById, scenes, selectedShotId, {
        onEditShot: onSelectShot,
        onDeleteShot,
      }),
    [shotIds, shotsById, scenes, selectedShotId, onSelectShot, onDeleteShot]
  );

  const edges = useMemo<Array<Edge>>(() => mapShotIdsToLinearEdges(shotIds, shotsById), [shotIds, shotsById]);

  const handleNodeClick = useCallback<NodeMouseHandler<FlowStoryboardNode>>(
    (_event, node) => {
      if (node.type !== 'shotNode') return;
      onSelectShot(node.id);
    },
    [onSelectShot]
  );

  const handleMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      if (!viewportKey) return;
      VIEWPORT_CACHE.set(viewportKey, viewport);
    },
    [viewportKey]
  );

  return (
    <div className='flex-1 bg-[var(--color-paper,#FFFDF5)]'>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        defaultViewport={initialViewport}
        onMoveEnd={handleMoveEnd}
        minZoom={0.2}
        maxZoom={1.8}
        panOnDrag
        zoomOnScroll
        nodesDraggable={false}
        edgesFocusable={false}
        className='w-full h-full'
      >
        <Background variant={BackgroundVariant.Dots} color='rgba(0,0,0,0.1)' gap={20} size={1.2} />
        <FlowFloatingToolbar />
      </ReactFlow>
    </div>
  );
};

export default FlowCanvasView;
