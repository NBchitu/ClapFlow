/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Image } from '@arco-design/web-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toPreviewImageSrc } from '../pathUtils';
import type { FlowShotNode } from './types';
import styles from './FlowShotNode.module.css';

function MechanicalSpinner({ size = 40 }: { size?: number }) {
  const notchLength = Math.round(size * 0.22);
  const notchWidth = Math.max(3, Math.round(size * 0.1));
  const radius = Math.round(size * 0.34);

  return (
    <span className='storyboard-notch-spinner' style={{ width: size, height: size }}>
      <span className='storyboard-notch-spinner__ring'>
        {Array.from({ length: 8 }).map((_, index) => (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className='storyboard-notch-spinner__notch'
            style={{
              width: notchWidth,
              height: notchLength,
              transform: `translate(-50%, -50%) rotate(${index * 45}deg) translateY(-${radius}px)`,
              background: index === 0 ? 'var(--color-lime-pop,#D9FF00)' : 'var(--color-ink,#000)',
            }}
          />
        ))}
      </span>
    </span>
  );
}

const FlowShotNode: React.FC<NodeProps<FlowShotNode>> = ({ data, selected }) => {
  const { t } = useTranslation();
  const shot = data.shot;
  const showImagePreview = data.showImagePreview !== false;
  const [pulseUpdate, setPulseUpdate] = useState(false);
  const imageCacheKey = useMemo(
    () => `${shot.imagePath ?? ''}|${shot.imageHistory?.[0] ?? ''}|${shot.imageHistory?.length ?? 0}`,
    [shot.imageHistory, shot.imagePath]
  );
  const shotChangeKey = useMemo(
    () =>
      [
        shot.status,
        shot.imagePath ?? '',
        shot.imageHistory?.[0] ?? '',
        shot.imageHistory?.length ?? 0,
        shot.imagePrompt ?? '',
        shot.videoPrompt ?? '',
        shot.locked ? '1' : '0',
      ].join('|'),
    [shot]
  );
  useEffect(() => {
    setPulseUpdate(true);
    const timer = window.setTimeout(() => setPulseUpdate(false), 260);
    return () => window.clearTimeout(timer);
  }, [shotChangeKey]);
  const isGenerating = shot.status === 'image-generating';
  const referenceCount = shot.appliedReferenceCount ?? shot.assetRefs?.length ?? 0;

  return (
    <div
      className={[
        'group',
        styles.nodeContainer,
        'relative bg-white w-[320px] rounded-[12px] border border-gray-200 overflow-hidden flex flex-col cursor-pointer',
        'transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-sm hover:shadow-md hover:-translate-y-[4px]',
        pulseUpdate ? 'animate-pop' : '',
        selected ? 'ring-2 ring-[#D9FF00]' : 'hover:ring-1 hover:ring-[#D9FF00]',
      ].join(' ')}
    >
      <Handle type='target' position={Position.Left} style={{ width: 0, height: 0, opacity: 0 }} />
      <Handle type='source' position={Position.Right} style={{ width: 0, height: 0, opacity: 0 }} />

      {/* Header */}
      <div className='h-[32px] bg-[#F9F9F9] border-b border-gray-200 flex items-center justify-between px-[12px] shrink-0'>
        <div className='flex items-center gap-[4px]'>
          <div className='w-[6px] h-[6px] rounded-full bg-black/80' />
          <div className='w-[6px] h-[6px] rounded-full bg-black/80' />
          <div className='w-[6px] h-[6px] rounded-full bg-black/80' />
        </div>
        <div className='text-[10px] font-bold text-gray-500 tracking-[0.1em]'>
          SHOT {String(shot.shotIndex).padStart(3, '0')}
        </div>
        <div className='flex items-center gap-[4px]'>
          <div className='w-[6px] h-[6px] rounded-full bg-black/80' />
          <div className='w-[6px] h-[6px] rounded-full bg-black/80' />
          <div className='w-[6px] h-[6px] rounded-full bg-black/80' />
        </div>
      </div>

      {/* Image Area */}
      <div className='relative w-full h-[180px] bg-gray-100 shrink-0 overflow-hidden'>
        <div className='absolute top-[8px] left-[8px] z-10 bg-black/80 px-[6px] py-[3px] rounded-[4px] flex items-center gap-[4px] pointer-events-none'>
          <span className='text-[10px] leading-none mb-[1px]'>📸</span>
          <span className='text-[9px] font-bold text-[#D9FF00] tracking-wider leading-none'>
            {shot.shotType?.toUpperCase()}
          </span>
        </div>
        {referenceCount > 0 ? (
          <div className='absolute top-[8px] right-[8px] z-10 bg-white px-[6px] py-[3px] rounded-[4px] border border-black pointer-events-none'>
            <span className='text-[9px] font-bold text-black tracking-wider leading-none'>REF {referenceCount}</span>
          </div>
        ) : null}

        {isGenerating ? (
          <div className='flex flex-col items-center justify-center bg-[#E5E7EB] w-full h-full z-10'>
            <div className='mb-5'>
              <MechanicalSpinner size={40} />
            </div>
            <div className='font-extrabold text-black text-[11px] tracking-[0.15em] opacity-80'>GENERATING...</div>
            {referenceCount > 0 ? (
              <div className='mt-1 text-[10px] font-bold text-black/80'>Applying {referenceCount} refs…</div>
            ) : null}
          </div>
        ) : shot.imagePath && showImagePreview ? (
          <div className='w-full h-full z-10' onClick={(event) => event.stopPropagation()}>
            <Image
              src={toPreviewImageSrc(shot.imagePath, imageCacheKey)}
              alt={shot.goal}
              preview
              className='w-full h-full [&_.arco-image-img]:w-full [&_.arco-image-img]:h-full [&_.arco-image-img]:object-cover'
            />
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center bg-[#E5E7EB] w-full h-full z-10'>
            <div className='w-[48px] h-[48px] rounded-full border-2 border-black flex items-center justify-center bg-white mb-[8px] opacity-20'>
              <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='black' strokeWidth='2.5'>
                <path d='M3 7h4l2-2h6l2 2h4v12H3z' />
                <circle cx='12' cy='13' r='4' />
              </svg>
            </div>
            <div className='font-bold text-black text-[11px] tracking-widest opacity-20'>
              {t('video.storyboard.loading')}
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className='flex flex-col bg-white flex-1 p-[16px]'>
        <div className='text-[13px] font-bold text-gray-900 leading-tight line-clamp-1'>{shot.goal || '—'}</div>
        <div className='text-[11px] text-gray-500 mt-[6px] line-clamp-2 leading-relaxed'>
          {shot.sceneDescription || shot.action || '—'}
        </div>
      </div>
    </div>
  );
};

export default FlowShotNode;
