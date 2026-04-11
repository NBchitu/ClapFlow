/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Button, Image } from '@arco-design/web-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toPreviewImageSrc } from '../pathUtils';
import type { FlowShotNode } from './types';
import styles from './FlowShotNode.module.css';

function getStatusColorClass(hasError: boolean, status: string): string {
  if (hasError) return 'bg-red-6';
  switch (status) {
    case 'prompts-ready':
      return 'bg-blue-6';
    case 'image-generating':
      return 'bg-indigo-6';
    case 'image-generated':
      return 'bg-green-6';
    case 'image-approved':
      return 'bg-cyan-6';
    case 'video-generated':
      return 'bg-purple-6';
    case 'approved':
      return 'bg-yellow-6';
    default:
      return 'bg-gray-6';
  }
}

function getProgressPercent(status: string): number {
  switch (status) {
    case 'pending':
      return 16;
    case 'prompts-ready':
      return 36;
    case 'image-generating':
      return 52;
    case 'image-generated':
      return 68;
    case 'image-approved':
      return 84;
    case 'video-generated':
      return 96;
    case 'approved':
      return 100;
    default:
      return 8;
  }
}

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
  const shotChangeKey = useMemo(
    () =>
      [shot.status, shot.imagePath ?? '', shot.imagePrompt ?? '', shot.videoPrompt ?? '', shot.locked ? '1' : '0'].join(
        '|'
      ),
    [shot]
  );
  useEffect(() => {
    setPulseUpdate(true);
    const timer = window.setTimeout(() => setPulseUpdate(false), 260);
    return () => window.clearTimeout(timer);
  }, [shotChangeKey]);
  const hasError = shot.qaIssues?.some((issue) => issue.severity === 'error') ?? false;
  const statusColorClass = getStatusColorClass(hasError, shot.status);
  const progress = getProgressPercent(shot.status);
  const isGenerating = shot.status === 'image-generating';
  const showProgressAnimation =
    shot.status === 'pending' || shot.status === 'prompts-ready' || shot.status === 'image-generating';
  const handleEdit = (event: Event) => {
    event.stopPropagation();
    data.onEditShot?.(shot.id);
  };
  const handleDelete = (event: Event) => {
    event.stopPropagation();
    data.onDeleteShot?.(shot.id);
  };
  const showContextActions = Boolean(data.onEditShot || data.onDeleteShot);

  return (
    <div
      className={[
        'group',
        styles.nodeContainer,
        styles.hardShadow,
        'relative w-252px rounded-10px border-2 overflow-hidden',
        'bg-white transition-all duration-180',
        pulseUpdate ? 'animate-pop' : '',
        selected
          ? 'border-[var(--color-lime-pop,#D9FF00)] scale-[1.012]'
          : 'border-[var(--color-ink,#000)] hover:border-[var(--color-lime-pop,#D9FF00)]',
      ].join(' ')}
    >
      <Handle
        type='target'
        position={Position.Left}
        style={{ width: 10, height: 10, background: 'var(--color-violet-pop,#8B5CF6)', border: '2px solid #000' }}
      />
      <Handle
        type='source'
        position={Position.Right}
        style={{ width: 10, height: 10, background: 'var(--color-violet-pop,#8B5CF6)', border: '2px solid #000' }}
      />

      {/* Title bar */}
      <div
        className={`h-30px px-8px flex items-center gap-6px border-b-2 border-[var(--color-ink,#000)] ${styles.titleStrip}`}
      >
        <span
          className={`w-8px h-8px rounded-full border-2 border-white ${statusColorClass} ${showProgressAnimation ? 'animate-pulse' : ''}`}
        />
        <span className='w-18px h-18px rounded-full border-2 border-[var(--color-ink,#000)] bg-[var(--color-ink,#000)] text-white text-10px font-bold flex items-center justify-center shrink-0'>
          {String(shot.shotIndex).padStart(2, '0')}
        </span>
        <span className='text-11px text-white font-bold truncate'>{shot.shotType}</span>
      </div>

      {/* Preview */}
      <div className='relative w-full h-126px bg-white flex items-center justify-center border-b-2 border-[var(--color-ink,#000)]'>
        {shot.imagePath && showImagePreview ? (
          <div className='w-full h-full' onClick={(event) => event.stopPropagation()}>
            <Image
              src={toPreviewImageSrc(shot.imagePath)}
              alt={shot.goal}
              preview
              previewProps={{
                actionsLayout: ['zoomIn', 'zoomOut', 'originalSize', 'rotateLeft', 'rotateRight'],
              }}
              className='w-full h-full [&_.arco-image-img]:w-full [&_.arco-image-img]:h-full [&_.arco-image-img]:object-cover'
            />
          </div>
        ) : (
          <div
            className={[
              styles.previewSkeleton,
              'w-[92%] h-[84%] rounded-6px border-2 border-dashed border-[var(--color-ink,#000)] flex items-center justify-center',
            ].join(' ')}
          >
            <div className='flex flex-col items-center gap-6px'>
              <span className='w-28px h-28px rounded-full border-2 border-[var(--color-ink,#000)] bg-white flex items-center justify-center'>
                <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2'>
                  <path d='M3 7h4l2-2h6l2 2h4v12H3z' />
                  <circle cx='12' cy='13' r='4' />
                  <path d='M20 3v4M18 5h4' />
                </svg>
              </span>
              <span className='text-10px text-[var(--color-ink,#000)] font-semibold'>
                {t('video.storyboard.loading')}
              </span>
            </div>
          </div>
        )}
        <span className='absolute left-8px bottom-8px text-10px px-8px py-3px rounded-999px bg-[var(--color-ink,#000)] text-[var(--color-pink-pop,#F472B6)] font-bold border-2 border-[var(--color-pink-pop,#F472B6)] shadow-[2px_2px_0_0_var(--color-ink,#000)]'>
          {shot.shotType}
        </span>

        {isGenerating && (
          <div className={styles.generationOverlay}>
            <MechanicalSpinner size={40} />
          </div>
        )}
      </div>

      {/* Params */}
      <div className='px-8px pt-6px pb-6px flex flex-col gap-4px bg-[var(--color-card-surface,#fff)]'>
        <div
          className={[
            styles.descriptionPanel,
            'relative rounded-6px border border-[var(--color-ink,#000)]/20 pl-10px pr-10px pt-6px pb-6px min-h-44px bg-white',
            shot.status === 'image-generating'
              ? 'bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.12)_1px,transparent_0)] bg-[length:8px_8px]'
              : '',
          ].join(' ')}
        >
          <span className={`${styles.descriptionBaseline} absolute left-4px top-6px bottom-6px w-2px rounded-full`} />
          <p className='text-11px leading-16px text-[var(--color-ink,#000)] line-clamp-2 min-h-28px font-semibold'>
            {shot.goal || '—'}
          </p>
          {showContextActions ? (
            <div className='absolute right-6px bottom-5px flex items-center gap-4px'>
              {data.onEditShot ? (
                <Button
                  size='mini'
                  type='text'
                  className='!h-20px !px-7px !rounded-6px !border !border-[var(--color-ink,#000)] !bg-white !text-[var(--color-ink,#000)] !text-10px !font-bold hover:!bg-[var(--color-lime-pop,#D9FF00)]'
                  onClick={handleEdit}
                >
                  {t('common.edit')}
                </Button>
              ) : null}
              {data.onDeleteShot ? (
                <Button
                  size='mini'
                  type='text'
                  className='!h-20px !px-7px !rounded-6px !border !border-[var(--color-ink,#000)] !bg-white !text-[var(--color-ink,#000)] !text-10px !font-bold hover:!bg-[var(--color-lime-pop,#D9FF00)]'
                  onClick={handleDelete}
                >
                  {t('common.delete')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Agent progress */}
      <div className={`${styles.progressTrack} h-4px`}>
        <div
          className={[
            styles.progressBarMoving,
            showProgressAnimation ? styles.progressBarAnimated : '',
            'h-full',
            statusColorClass,
            showProgressAnimation ? '' : 'opacity-75',
          ].join(' ')}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default FlowShotNode;
