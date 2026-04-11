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
    <Panel position='top-right'>
      <div className='flex items-center gap-6px p-6px rounded-10px border-2 border-[var(--color-ink,#000)] bg-white shadow-[4px_4px_0_0_var(--color-ink,#000)]'>
        <div className='flex items-stretch overflow-hidden rounded-8px border-2 border-[var(--color-ink,#000)] shadow-[2px_2px_0_0_var(--color-ink,#000)]'>
          <Button
            size='mini'
            type='text'
            className='!h-28px !px-10px !rounded-none !border-none !bg-[#4b5563] !text-white !font-bold hover:!bg-[#374151]'
            onClick={() => void flow.zoomOut({ duration: 180 })}
          >
            −
          </Button>
          <Button
            size='mini'
            type='text'
            className='!h-28px !px-12px !rounded-none !border-l-2 !border-r-2 !border-[var(--color-ink,#000)] !bg-white !text-[var(--color-ink,#000)] !font-700'
            onClick={() => void flow.fitView({ duration: 220, maxZoom: 1.2 })}
          >
            {zoomText}
          </Button>
          <Button
            size='mini'
            type='text'
            className='!h-28px !px-10px !rounded-none !border-none !bg-[#4b5563] !text-white !font-bold hover:!bg-[#374151]'
            onClick={() => void flow.zoomIn({ duration: 180 })}
          >
            +
          </Button>
        </div>
      </div>
    </Panel>
  );
};

export default FlowFloatingToolbar;
