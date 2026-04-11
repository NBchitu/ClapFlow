/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
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
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 18,
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
        stroke: hasIssue ? 'var(--color-red-6, #ef4444)' : 'var(--color-ink, #000)',
        strokeWidth: hasIssue ? 2.8 : isCrossScene ? 2.1 : 2.4,
        strokeDasharray: isProcessing ? '8 6' : isCrossScene ? '4 5' : '6 4',
        strokeLinecap: 'round',
        opacity: isCrossScene ? 0.88 : 1,
      }}
    />
  );
};

export default StoryboardEdge;
