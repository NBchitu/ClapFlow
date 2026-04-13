/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { Shot } from '@/common/types/videoCreation';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useCallback, useMemo } from 'react';
import { toPreviewImageSrc } from './pathUtils';

const PX_PER_SECOND = 48; // width per second

interface TimelineViewProps {
  shots: Shot[];
  projectRoot: string;
  selectedShotId: string | null;
  selectedTrackType?: 'image' | 'video';
  onSelectShot: (shot: Shot, type: 'image' | 'video') => void;
  onShotsReorder: (orderedIds: string[]) => void;
}

// ─── SortableShotColumn ────────────────────────────────────────

interface ShotColumnProps {
  shot: Shot;
  isSelected: boolean;
  selectedTrackType?: 'image' | 'video';
  onSelect: (type: 'image' | 'video') => void;
}

const SortableShotColumn: React.FC<ShotColumnProps> = ({ shot, isSelected, selectedTrackType, onSelect }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id });

  const w = Math.max((shot.duration || 4) * PX_PER_SECOND, 80);
  const imageCacheKey = `${shot.imagePath ?? ''}|${shot.imageHistory?.[0] ?? ''}|${shot.imageHistory?.length ?? 0}`;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    width: w,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className='shrink-0 flex flex-col outline-none relative'
      {...attributes}
      {...listeners}
    >
      {/* Image Track Block */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect('image');
        }}
        className={`relative h-[88px] cursor-pointer overflow-hidden rounded-[6px] border transition-colors ${
          isSelected && selectedTrackType === 'image' ? 'border-[#DFFF00]' : 'border-gray-300 hover:border-gray-500'
        }`}
      >
        {shot.imagePath ? (
          <img
            src={toPreviewImageSrc(shot.imagePath, imageCacheKey)}
            alt={shot.goal}
            className='w-full h-full object-cover'
          />
        ) : (
          <div className='flex h-full w-full items-center justify-center bg-gray-100/80 opacity-60'>
            <span className='text-[15px]'>🎞️</span>
          </div>
        )}
        <div className='absolute bottom-[6px] left-[6px] z-10 rounded-[12px] bg-black/55 px-[6px] py-[2px] text-[8px] font-bold tracking-[0.08em] text-white leading-none'>
          S{shot.shotIndex}
        </div>
      </div>

      <div className='h-[16px] shrink-0' />

      {/* Video Track Block */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect('video');
        }}
        className={`relative flex h-[88px] cursor-pointer flex-col items-center justify-center rounded-[6px] border border-dashed transition-colors bg-white/80 ${
          isSelected && selectedTrackType === 'video' ? 'border-[#DFFF00]' : 'border-gray-300'
        }`}
      >
        {/* Placeholder for generation state */}
        <div className='flex flex-col items-center text-[#1A1A1A]'>
          <svg
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2.3'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'></polygon>
          </svg>
          <span className='mt-[4px] text-[9px] font-bold tracking-[0.1em] uppercase'>Generate</span>
        </div>
      </div>
    </div>
  );
};

// ─── TimelineView ─────────────────────────────────────────────

const TimelineView: React.FC<TimelineViewProps> = ({
  shots,
  projectRoot,
  selectedShotId,
  selectedTrackType,
  onSelectShot,
  onShotsReorder,
}) => {
  const totalSeconds = useMemo(() => shots.reduce((sum, s) => sum + (s.duration || 4), 0), [shots]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = shots.findIndex((s) => s.id === active.id);
      const newIndex = shots.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...shots];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      const orderedIds = reordered.map((s) => s.id);

      onShotsReorder(orderedIds);
      void ipcBridge.videoCreation.reorderShots.invoke({ projectRoot, orderedIds });
    },
    [shots, projectRoot, onShotsReorder]
  );

  return (
    <div
      className='flex h-full w-full flex-col overflow-hidden border border-gray-200 font-sans text-black'
      style={{
        backgroundColor: '#fafafa',
        backgroundImage: 'radial-gradient(#f0f0f0 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    >
      {/* UPPER HALF: Video Preview Area */}
      <div className='relative flex min-h-[300px] shrink-0 flex-[0.8] flex-col items-center justify-center overflow-hidden border-b border-gray-200'>
        {/* Watermark */}
        <div className='absolute top-[20px] left-[24px] pointer-events-none z-[10] font-extrabold tracking-[0.3em] text-gray-300 text-[10px] uppercase'>
          A I O N &nbsp; S T O R Y B O A R D &nbsp; S Y S T E M &nbsp; V 1 . 0 . 4
        </div>

        {/* Preview Box */}
        <div className='relative flex h-[360px] w-[640px] flex-col items-center justify-center overflow-hidden rounded-[6px] border border-gray-300 bg-white'>
          <div className='absolute top-[8px] left-[10px] flex items-center gap-[4px]'>
            <span className='h-[5px] w-[5px] rounded-full bg-gray-300' />
            <span className='h-[5px] w-[5px] rounded-full bg-gray-300' />
            <span className='h-[5px] w-[5px] rounded-full bg-gray-300' />
          </div>

          <div className='z-10 flex flex-col items-center justify-center opacity-70'>
            <svg
              width='30'
              height='30'
              viewBox='0 0 24 24'
              fill='none'
              stroke='#DFFF00'
              strokeWidth='2.4'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'></polygon>
            </svg>
            <span className='mt-[16px] text-[15px] font-extrabold tracking-wide text-black'>No Video Preview</span>
          </div>

          {/* Fake playback controls */}
          <div className='absolute bottom-[14px] left-[14px] z-20'>
            <button className='flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#DFFF00]'>
              <svg width='13' height='13' viewBox='0 0 24 24' fill='black'>
                <polygon points='5 3 19 12 5 21 5 3'></polygon>
              </svg>
            </button>
          </div>
          <div className='absolute right-[14px] bottom-[14px] z-20 rounded-full bg-black/55 px-[10px] py-[4px] font-mono text-[11px] font-semibold text-white'>
            0.0s / {totalSeconds.toFixed(1)}s
          </div>
        </div>
      </div>

      {/* TIMELINE HEADER */}
      <div className='relative z-20 flex h-[44px] shrink-0 items-center justify-between border-b border-gray-200 bg-white/95 px-[20px]'>
        <div className='flex items-center gap-[14px]'>
          <div className='rounded-[4px] bg-[#DFFF00] px-[10px] py-[4px] font-mono text-[11px] font-semibold tracking-[0.08em] text-black'>
            00:00:12:04
          </div>
          <span className='mt-[1px] font-mono text-[10px] font-semibold tracking-[0.22em] text-gray-500 uppercase'>
            TIMELINE EDITOR
          </span>
        </div>
        <div className='flex items-center gap-[8px]'>
          <button className='rounded-[4px] border border-[#1A1A1A] bg-transparent px-[14px] py-[6px] text-[10px] font-bold tracking-[0.1em] text-black uppercase transition-colors hover:bg-[#DFFF00]'>
            Zoom Out
          </button>
          <button className='rounded-[4px] border border-[#1A1A1A] bg-transparent px-[14px] py-[6px] text-[10px] font-bold tracking-[0.1em] text-black uppercase transition-colors hover:bg-[#DFFF00]'>
            Zoom In
          </button>
        </div>
      </div>

      {/* HORIZONTAL TIMELINE CONTENT */}
      <div className='relative flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-hidden'>
        {/* Ruler Row */}
        <div
          className='relative flex h-[32px] shrink-0 border-b border-gray-200 bg-white/90'
          style={{ minWidth: (totalSeconds + 1) * PX_PER_SECOND + 100 }}
        >
          {/* Sticky Ruler spacer */}
          <div className='sticky left-0 z-30 h-full w-[96px] shrink-0 border-r border-gray-200 bg-white/95' />

          {/* Ticks Container */}
          <div className='relative flex-1' style={{ width: Math.max(totalSeconds * PX_PER_SECOND, 800) }}>
            {Array.from({ length: Math.ceil(totalSeconds) + 5 }).map((_, i) => (
              <div
                key={i}
                className='absolute top-0 bottom-0 flex items-end border-l border-gray-200 pb-[4px] pl-[6px]'
                style={{ left: i * PX_PER_SECOND }}
              >
                <span className='font-mono text-[10px] font-medium leading-none text-gray-400'>{i}s</span>
              </div>
            ))}

            {/* Playhead */}
            <div
              className='absolute top-0 bottom-[-480px] z-40 w-[1px] bg-[#DFFF00] shadow-[0_0_8px_rgba(223,255,0,0.55)]'
              style={{ left: 2 * PX_PER_SECOND }}
            >
              <div className='absolute top-[-1px] left-1/2 h-0 w-0 -translate-x-1/2 border-r-[6px] border-l-[6px] border-t-[8px] border-r-transparent border-l-transparent border-t-[#DFFF00]' />
            </div>
          </div>
        </div>

        {/* Tracks Area */}
        <div
          className='relative flex flex-1 items-start pb-[36px] pt-[14px]'
          style={{ minWidth: (totalSeconds + 1) * PX_PER_SECOND + 100 }}
        >
          {/* Sticky Labels */}
          <div className='sticky left-0 z-20 flex h-full w-[96px] shrink-0 flex-col justify-start border-r border-gray-200 bg-white/95'>
            <div className='flex h-[88px] items-center px-[14px] font-mono text-[10px] font-semibold tracking-[0.12em] text-gray-400 uppercase'>
              IMAGES
            </div>
            <div className='h-[16px] shrink-0'></div>
            <div className='flex h-[88px] items-center px-[14px] font-mono text-[10px] font-semibold tracking-[0.12em] text-gray-400 uppercase'>
              VIDEOS
            </div>
          </div>

          {/* Sortable List */}
          {shots.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={shots.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
                <div className='flex gap-[6px] pl-[8px] pr-[28px]'>
                  {shots.map((shot) => (
                    <SortableShotColumn
                      key={shot.id}
                      shot={shot}
                      isSelected={selectedShotId === shot.id}
                      selectedTrackType={selectedTrackType}
                      onSelect={(type) => onSelectShot(shot, type)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className='flex h-full flex-1 items-center justify-center font-mono text-[11px] text-gray-500'>
              No clips available in timeline.
            </div>
          )}
        </div>
      </div>

      {/* FOOTER BAR */}
      <div className='flex h-[72px] shrink-0 items-center justify-between border-t border-[#1A1A1A] bg-white px-[24px]'>
        <div className='flex items-center'>
          <div className='flex flex-col'>
            <span className='font-mono text-[10px] font-medium tracking-[0.12em] text-gray-500 uppercase'>
              TOTAL LENGTH
            </span>
            <span className='mt-[1px] text-[18px] font-extrabold text-black'>{totalSeconds.toFixed(1)}s</span>
          </div>
          <div className='mx-[26px] h-[32px] w-[1px] bg-black/10' />
          <div className='flex flex-col'>
            <span className='font-mono text-[10px] font-medium tracking-[0.12em] text-gray-500 uppercase'>
              RESOLUTION
            </span>
            <span className='mt-[1px] text-[18px] font-extrabold text-black'>4K Cinematic</span>
          </div>
        </div>

        <div className='flex items-center gap-[10px]'>
          <button className='flex h-[38px] items-center gap-[6px] rounded-[4px] border border-[#1A1A1A] bg-white px-[18px] text-[10px] font-bold tracking-[0.1em] text-black uppercase transition-colors hover:bg-gray-50'>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.6'>
              <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'></path>
              <polyline points='7 10 12 15 17 10'></polyline>
              <line x1='12' y1='15' x2='12' y2='3'></line>
            </svg>
            EXPORT VIDEO
          </button>
          <button className='flex h-[38px] items-center gap-[6px] rounded-[4px] bg-[#DFFF00] px-[18px] text-[10px] font-bold tracking-[0.1em] text-black uppercase transition-colors hover:bg-[#cbf000]'>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.6'>
              <line x1='12' y1='5' x2='12' y2='19'></line>
              <line x1='5' y1='12' x2='19' y2='12'></line>
            </svg>
            GENERATE ALL CLIPS
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimelineView;
