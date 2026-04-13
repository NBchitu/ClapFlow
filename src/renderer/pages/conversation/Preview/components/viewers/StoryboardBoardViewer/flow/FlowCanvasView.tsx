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
    <div className='w-full h-full rounded-[16px] border border-gray-200 bg-white/40 shadow-sm pt-[20px] px-[24px] pb-[20px] transition-all duration-150 relative'>
      <div className='flex items-center gap-[12px] mb-[16px]'>
        <div className='inline-flex items-center px-[8px] py-[4px] rounded-[6px] bg-gray-100/80 text-gray-600 font-bold text-[10px]'>
          <span>SCENE</span>
        </div>
        <span className='text-[18px] font-bold text-gray-900'>{data.scene.name}</span>
      </div>
      {data.scene.description ? (
        <p className='text-[13px] leading-relaxed text-gray-500 line-clamp-2'>
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
    <div className='flex-1 bg-white'>
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
        <Background variant={BackgroundVariant.Dots} color='rgba(0,0,0,0.1)' gap={20} size={1.5} />
        <div className="absolute top-[20px] left-[24px] pointer-events-none z-[10] font-bold tracking-[0.4em] text-gray-400/50 text-[10px] uppercase">
          A I O N &nbsp; S T O R Y B O A R D &nbsp; S Y S T E M &nbsp; V 1 . 0 . 4
        </div>
        <FlowFloatingToolbar />
      </ReactFlow>
    </div>
  );
};

export default FlowCanvasView;
