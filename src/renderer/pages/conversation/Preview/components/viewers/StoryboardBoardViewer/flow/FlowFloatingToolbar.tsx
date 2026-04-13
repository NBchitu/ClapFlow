/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from '@arco-design/web-react';
import { Panel, useReactFlow, useViewport } from '@xyflow/react';
import React, { useMemo } from 'react';

const FlowFloatingToolbar: React.FC = () => {
  const flow = useReactFlow();
  const { zoom } = useViewport();

  const zoomText = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);

  return (
    <Panel position='bottom-left' className='m-[24px] pointer-events-auto'>
      <div className='flex flex-col items-center bg-white border border-gray-200 rounded-full overflow-hidden shadow-sm'>
        <button
          className='w-[44px] h-[44px] flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-200 focus:outline-none'
          onClick={() => void flow.zoomIn({ duration: 180 })}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button
          className='w-[44px] h-[44px] flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-200 focus:outline-none'
          onClick={() => void flow.zoomOut({ duration: 180 })}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button
          className='w-[44px] h-[44px] flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none'
          onClick={() => void flow.fitView({ duration: 220, maxZoom: 1.2 })}
        >
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14v4h4"></path><path d="M20 14v4h-4"></path><path d="M4 10V6h4"></path><path d="M20 10V6h-4"></path></svg>
        </button>
      </div>
    </Panel>
  );
};

export default FlowFloatingToolbar;
