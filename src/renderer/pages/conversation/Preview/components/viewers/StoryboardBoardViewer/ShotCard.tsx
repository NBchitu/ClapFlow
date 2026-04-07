/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Shot } from '@/common/types/videoCreation';
import { Button, Spin } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { resolveExtensionAssetUrl } from '@renderer/utils/platform';

type CardSize = 'S' | 'M' | 'L';

interface ShotCardProps {
  shot: Shot;
  cardSize: CardSize;
  isHighlighted: boolean;
  isImageLoading?: boolean;
  onClick: (shot: Shot, event: React.MouseEvent) => void;
  onInsertBefore?: (shot: Shot) => void;
  onDuplicate?: (shot: Shot) => void;
  onDelete?: (shot: Shot) => void;
}

const CARD_WIDTH: Record<CardSize, number> = { S: 100, M: 160, L: 240 };
const CARD_ASPECT = 9 / 16; // height = width * aspect

/** Returns CSS class + content for the status badge */
function useStatusBadge(shot: Shot): { colorClass: string; icon: string } {
  const hasError = shot.qaIssues?.some((q) => q.severity === 'error');
  if (hasError) return { colorClass: 'text-red-500', icon: '⚠' };
  if (shot.locked) return { colorClass: 'text-t-secondary', icon: '🔒' };

  switch (shot.status) {
    case 'pending':
      return { colorClass: 'bg-gray-400', icon: '' };
    case 'prompts-ready':
      return { colorClass: 'bg-blue-500', icon: '' };
    case 'image-generated':
      return { colorClass: 'bg-green-500', icon: '' };
    case 'image-approved':
      return { colorClass: 'bg-green-500', icon: '✓' };
    case 'video-generated':
      return { colorClass: 'bg-purple-500', icon: '' };
    case 'approved':
      return { colorClass: 'text-yellow-500', icon: '✓' };
    default:
      return { colorClass: 'bg-gray-400', icon: '' };
  }
}

const ShotCard: React.FC<ShotCardProps> = ({
  shot,
  cardSize,
  isHighlighted,
  isImageLoading,
  onClick,
  onInsertBefore,
  onDuplicate,
  onDelete,
}) => {
  const { t } = useTranslation();
  const w = CARD_WIDTH[cardSize];
  const h = Math.round(w * CARD_ASPECT);
  const badge = useStatusBadge(shot);

  const handleClick = (e: React.MouseEvent) => onClick(shot, e);

  const renderBadge = () => {
    if (badge.icon) {
      // Icon-only badge (locked, error, approved, image-approved)
      return (
        <span
          className={`absolute top-4px left-4px text-10px leading-none font-bold ${badge.colorClass}`}
          aria-label={t(`video.storyboard.status.${shot.status}`, { defaultValue: shot.status })}
        >
          {badge.icon}
        </span>
      );
    }
    // Dot badge
    return (
      <span
        className={`absolute top-6px left-6px w-6px h-6px rounded-full ${badge.colorClass}`}
        aria-label={t(`video.storyboard.status.${shot.status}`, { defaultValue: shot.status })}
      />
    );
  };

  return (
    <button
      type='button'
      className={[
        'group relative flex flex-col items-center cursor-pointer rounded-4px border',
        'overflow-hidden transition-all duration-150 focus:outline-none focus-visible:ring-2',
        'focus-visible:ring-brand-6',
        isHighlighted
          ? 'border-brand-6 shadow-[0_0_0_2px_var(--color-brand-6,#6366f1)]'
          : 'border-border-1 hover:border-border-2',
      ].join(' ')}
      style={{ width: w }}
      onClick={handleClick}
      aria-label={`${t('video.storyboard.shot')} ${shot.shotIndex}`}
    >
      {/* Thumbnail area */}
      <div className='relative w-full bg-bg-3 flex items-center justify-center' style={{ height: h }}>
        {isImageLoading ? (
          <Spin size={cardSize === 'S' ? 12 : 20} />
        ) : shot.imagePath ? (
          <img src={resolveExtensionAssetUrl(`file://${shot.imagePath}`)} alt={shot.goal} className='w-full h-full object-cover' loading='lazy' />
        ) : (
          <span className='text-10px text-t-tertiary select-none'>{shot.shotType ?? '—'}</span>
        )}

        {/* Status badge */}
        {renderBadge()}

        {/* Hover action menu */}
        {(onInsertBefore ?? onDuplicate ?? onDelete) && (
          <div className='absolute bottom-0 left-0 right-0 flex gap-2px p-2px opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60'>
            {onInsertBefore && (
              <Button
                size='mini'
                type='text'
                title={t('video.storyboard.card.insertBefore')}
                className='text-white text-10px p-0 h-14px min-w-14px'
                onClick={(e) => {
                  e.stopPropagation();
                  onInsertBefore(shot);
                }}
              >
                +↑
              </Button>
            )}
            {onDuplicate && (
              <Button
                size='mini'
                type='text'
                title={t('video.storyboard.card.duplicate')}
                className='text-white text-10px p-0 h-14px min-w-14px'
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(shot);
                }}
              >
                ⎘
              </Button>
            )}
            {onDelete && (
              <Button
                size='mini'
                type='text'
                title={t('video.storyboard.card.delete')}
                className='text-white text-10px p-0 h-14px min-w-14px'
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(shot);
                }}
              >
                ✕
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Shot index label */}
      {cardSize !== 'S' && (
        <div className='w-full px-4px py-2px text-center truncate'>
          <span className='text-11px text-t-secondary'>
            {t('video.storyboard.shot')} {shot.shotIndex}
          </span>
        </div>
      )}
    </button>
  );
};

export default ShotCard;
