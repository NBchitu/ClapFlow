/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { NodeProps } from '@xyflow/react';
import type { FlowBlankNode } from './types';

const FlowBlankNode: React.FC<NodeProps<FlowBlankNode>> = () => {
  return (
    <div className='w-252px h-214px rounded-10px border-2 border-dashed border-[var(--color-ink,#000)] bg-[var(--color-paper,#FFFDF5)]/60 flex items-center justify-center'>
      <span className='text-10px text-[var(--color-ink,#000)]/70'>空白</span>
    </div>
  );
};

export default FlowBlankNode;
