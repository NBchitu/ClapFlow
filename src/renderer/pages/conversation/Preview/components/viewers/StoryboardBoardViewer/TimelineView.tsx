/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { Shot } from '@/common/types/videoCreation';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveExtensionAssetUrl } from '@renderer/utils/platform';

const PX_PER_SECOND = 48;

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id });
  const resizing = useRef(false);
  const startX = useRef(0);
  const startDuration = useRef(0);
  const [localDuration, setLocalDuration] = useState(shot.duration);

  const w = Math.max(localDuration * PX_PER_SECOND, 24);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      resizing.current = true;
      startX.current = e.clientX;
      startDuration.current = localDuration;

      const onMove = (me: MouseEvent) => {
        if (!resizing.current) return;
        const delta = me.clientX - startX.current;
        const newDuration = Math.max(1, Math.round(startDuration.current + delta / PX_PER_SECOND));
        setLocalDuration(newDuration);
      };

      const onUp = (me: MouseEvent) => {
        resizing.current = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        const delta = me.clientX - startX.current;
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
    width: w,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'relative flex-shrink-0 h-48px rounded-4px border overflow-hidden cursor-pointer select-none',
        isSelected ? 'border-brand-6' : 'border-border-1 hover:border-border-2',
      ].join(' ')}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      {/* Thumbnail */}
      {shot.imagePath ? (
        <img src={resolveExtensionAssetUrl(`file://${shot.imagePath}`)} alt={shot.goal} className='w-full h-full object-cover' loading='lazy' />
      ) : (
        <div className='w-full h-full bg-bg-3 flex items-center justify-center'>
          <span className='text-9px text-t-tertiary'>{shot.shotType}</span>
        </div>
      )}

      {/* Shot index */}
      <span className='absolute top-2px left-4px text-9px text-white/80 font-medium select-none leading-none'>
        {shot.shotIndex}
      </span>

      {/* Duration label */}
      <span className='absolute bottom-2px left-4px text-9px text-white/70 select-none leading-none'>
        {localDuration}s
      </span>

      {/* Resize handle */}
      <div
        className='absolute top-0 right-0 w-6px h-full cursor-ew-resize bg-transparent hover:bg-brand-6/40'
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
};

// ─── Ruler ────────────────────────────────────────────────────

const TimelineRuler: React.FC<{ totalSeconds: number }> = ({ totalSeconds }) => {
  const { t } = useTranslation();
  const marks = Array.from({ length: Math.ceil(totalSeconds) + 1 }, (_, i) => i);

  return (
    <div className='flex shrink-0 h-16px border-b border-border-1 relative select-none'>
      {marks.map((sec) => (
        <div
          key={sec}
          className='absolute flex items-center'
          style={{ left: sec * PX_PER_SECOND, top: 0, height: '100%' }}
        >
          <span className='text-9px text-t-tertiary ml-2px leading-none'>
            {sec}
            {t('video.storyboard.timeline.secondUnit')}
          </span>
          <div className='absolute left-0 top-0 w-1px h-full bg-border-1' />
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
    <div className='flex flex-col flex-1 overflow-hidden'>
      {/* Ruler */}
      <div className='overflow-x-auto shrink-0' style={{ minWidth: 0 }}>
        <div style={{ width: Math.max(totalSeconds * PX_PER_SECOND + 48, 400) }}>
          <TimelineRuler totalSeconds={totalSeconds} />
        </div>
      </div>

      {/* Shot lane */}
      <div className='flex-1 overflow-x-auto overflow-y-hidden p-8px'>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={shots.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
            <div className='flex gap-4px items-center' style={{ minWidth: 'max-content' }}>
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
    </div>
  );
};

export default TimelineView;
