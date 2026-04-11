/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { Shot } from '@/common/types/videoCreation';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toPreviewImageSrc } from './pathUtils';

const PX_PER_SECOND = 24;
const MIN_BLOCK_HEIGHT = 116;

function MechanicalSpinner({ size = 24 }: { size?: number }) {
  const notchLength = Math.round(size * 0.24);
  const notchWidth = Math.max(2, Math.round(size * 0.1));
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

interface TimelineViewProps {
  shots: Shot[];
  projectRoot: string;
  selectedShotId: string | null;
  onSelectShot: (shot: Shot) => void;
  onShotsReorder: (orderedIds: string[]) => void;
}

// ─── SortableShotBlock ────────────────────────────────────────

interface ShotBlockProps {
  shot: Shot;
  isSelected: boolean;
  onSelect: () => void;
  onDurationChange: (newDuration: number) => void;
}

const SortableShotBlock: React.FC<ShotBlockProps> = ({ shot, isSelected, onSelect, onDurationChange }) => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id });
  const resizing = useRef(false);
  const startY = useRef(0);
  const startDuration = useRef(0);
  const [localDuration, setLocalDuration] = useState(shot.duration);
  useEffect(() => {
    setLocalDuration(shot.duration);
  }, [shot.duration]);

  const h = Math.max(localDuration * PX_PER_SECOND, MIN_BLOCK_HEIGHT);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      resizing.current = true;
      startY.current = e.clientY;
      startDuration.current = localDuration;

      const onMove = (me: MouseEvent) => {
        if (!resizing.current) return;
        const delta = me.clientY - startY.current;
        const newDuration = Math.max(1, Math.round(startDuration.current + delta / PX_PER_SECOND));
        setLocalDuration(newDuration);
      };

      const onUp = (me: MouseEvent) => {
        resizing.current = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        const delta = me.clientY - startY.current;
        const newDuration = Math.max(1, Math.round(startDuration.current + delta / PX_PER_SECOND));
        onDurationChange(newDuration);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [localDuration, onDurationChange]
  );

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    height: h,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'relative w-full rounded-8px border-2 overflow-hidden cursor-pointer select-none bg-white shadow-[2px_2px_0_0_rgba(0,0,0,0.12)]',
        isSelected ? 'border-[var(--color-lime-pop,#D9FF00)]' : 'border-[var(--color-ink,#000)]',
      ].join(' ')}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      <div className='flex h-full w-full gap-10px p-8px pb-14px'>
        {/* Thumbnail: keep aspect ratio */}
        <div
          className='shrink-0 rounded-6px overflow-hidden border border-[var(--color-ink,#000)] bg-[#f8f8f8]'
          style={{ width: 160 }}
        >
          <div className='aspect-video w-full'>
            {shot.imagePath ? (
              <img
                src={toPreviewImageSrc(shot.imagePath)}
                alt={shot.goal}
                className='w-full h-full object-cover'
                loading='lazy'
              />
            ) : (
              <div className='w-full h-full bg-bg-3 flex items-center justify-center'>
                <span className='text-11px text-t-tertiary'>{shot.shotType}</span>
              </div>
            )}
          </div>
        </div>
        <div className='min-w-0 flex-1 flex flex-col'>
          <span className='text-12px leading-16px font-semibold text-[var(--color-ink,#000)]'>
            {t('video.storyboard.shot')} {shot.shotIndex}
          </span>
          <span className='text-11px leading-16px text-t-secondary'>
            {shot.shotType} · {shot.cameraMove}
          </span>
          <span className='text-11px leading-16px text-t-secondary mt-4px line-clamp-2'>{shot.goal || '—'}</span>
        </div>
      </div>

      {/* Duration label */}
      <span className='absolute bottom-4px left-8px text-11px text-[var(--color-ink,#000)] select-none leading-none font-medium'>
        {localDuration}
        {t('video.storyboard.timeline.secondUnit')}
      </span>

      {shot.status === 'image-generating' && (
        <span className='absolute top-8px right-8px pointer-events-none'>
          <MechanicalSpinner size={24} />
        </span>
      )}

      {/* Resize handle */}
      <div
        className='absolute bottom-0 left-0 w-full h-8px cursor-ns-resize bg-transparent hover:bg-brand-6/20'
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
};

// ─── Ruler ────────────────────────────────────────────────────

const TimelineRuler: React.FC<{ totalSeconds: number }> = ({ totalSeconds }) => {
  const { t } = useTranslation();
  const marks = Array.from({ length: Math.ceil(totalSeconds) + 1 }, (_, i) => i);
  const height = Math.max(totalSeconds * PX_PER_SECOND, MIN_BLOCK_HEIGHT);

  return (
    <div className='relative select-none' style={{ height }}>
      {marks.map((sec) => (
        <div
          key={sec}
          className='absolute flex items-center'
          style={{ top: sec * PX_PER_SECOND, left: 0, width: '100%' }}
        >
          <span className='text-9px text-t-tertiary leading-none'>
            {sec}
            {t('video.storyboard.timeline.secondUnit')}
          </span>
          <div className='absolute left-26px right-0 top-0 h-1px bg-border-1' />
        </div>
      ))}
    </div>
  );
};

// ─── TimelineView ─────────────────────────────────────────────

const TimelineView: React.FC<TimelineViewProps> = ({
  shots,
  projectRoot,
  selectedShotId,
  onSelectShot,
  onShotsReorder,
}) => {
  const { t } = useTranslation();
  const totalSeconds = shots.reduce((sum, s) => sum + s.duration, 0);

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

  const handleDurationChange = useCallback(
    (shot: Shot, newDuration: number) => {
      void ipcBridge.videoCreation.updateShot.invoke({
        projectRoot,
        shotId: shot.id,
        updates: { duration: newDuration },
      });
    },
    [projectRoot]
  );

  if (shots.length === 0) {
    return (
      <div className='flex-1 flex items-center justify-center text-t-secondary text-13px'>
        {t('video.storyboard.timeline.noShots')}
      </div>
    );
  }

  return (
    <div className='flex flex-1 overflow-hidden bg-[var(--color-paper,#FFFDF5)]'>
      {/* Vertical ruler */}
      <div className='shrink-0 w-64px overflow-y-auto border-r border-border-1 px-6px pt-8px'>
        <TimelineRuler totalSeconds={totalSeconds} />
      </div>

      {/* Shot lane */}
      <div className='flex-1 overflow-y-auto overflow-x-hidden p-8px'>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={shots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className='flex flex-col gap-8px' style={{ minHeight: '100%' }}>
              {shots.map((shot) => (
                <SortableShotBlock
                  key={shot.id}
                  shot={shot}
                  isSelected={selectedShotId === shot.id}
                  onSelect={() => onSelectShot(shot)}
                  onDurationChange={(d) => handleDurationChange(shot, d)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
      <div className='shrink-0 w-10px border-l border-border-1 bg-white/40' />
    </div>
  );
};

export default TimelineView;
