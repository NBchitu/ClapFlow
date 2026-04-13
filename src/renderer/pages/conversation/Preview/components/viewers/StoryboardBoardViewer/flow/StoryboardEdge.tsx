/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import React from 'react';
import type { FlowStoryboardEdge } from './types';
import styles from './StoryboardEdge.module.css';

const StoryboardEdge: React.FC<EdgeProps<FlowStoryboardEdge>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}) => {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const isProcessing = Boolean(data?.isProcessing);
  const hasIssue = Boolean(data?.hasIssue);
  const isCrossScene = Boolean(data?.isCrossScene);

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      className={isProcessing ? styles.processingEdge : undefined}
      style={{
        stroke: hasIssue ? '#ef4444' : '#9CA3AF',
        strokeWidth: hasIssue ? 2.5 : 2,
        strokeDasharray: '6 6',
        strokeLinecap: 'round',
        opacity: 0.8,
      }}
    />
  );
};

export default StoryboardEdge;
