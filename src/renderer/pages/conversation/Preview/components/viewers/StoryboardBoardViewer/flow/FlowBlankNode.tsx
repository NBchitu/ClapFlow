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
    <div className='w-[320px] h-[300px] rounded-[12px] border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center opacity-60'>
      <span className='text-[12px] font-bold tracking-widest text-gray-400'>EMPTY SHOT</span>
    </div>
  );
};

export default FlowBlankNode;
