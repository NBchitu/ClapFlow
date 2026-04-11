/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { Shot, Storyboard, StoryboardStreamEvent } from '@/common/types/videoCreation';
import { Button, Radio, Spin } from '@arco-design/web-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AssetLibraryDrawer from './AssetLibraryDrawer';
import { FlowCanvasView } from './flow';
import ShotDetailPanel from './ShotDetailPanel';
import TimelineView from './TimelineView';
import { useUndoStack } from './hooks/useUndoStack';
import { deriveProjectRootFromStoryboardPath } from './pathUtils';

type ViewMode = 'canvas' | 'timeline';

interface StoryboardBoardViewerProps {
  /** storyboard.json raw content string */
  content: string;
  /** absolute path to storyboard.json (used to derive projectRoot) */
  filePath?: string;
}

const SHOT_LOAD_CONCURRENCY = 5;

const StoryboardBoardViewer: React.FC<StoryboardBoardViewerProps> = ({ content, filePath }) => {
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;

  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [shots, setShots] = useState<Map<string, Shot>>(new Map());
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('canvas');
  const [assetDrawerVisible, setAssetDrawerVisible] = useState(false);
  const [orderedShotIds, setOrderedShotIds] = useState<string[]>([]);
  const [imageGenProgress, setImageGenProgress] = useState<{ completed: number; total: number } | null>(null);

  const { undo } = useUndoStack();

  const projectRoot = filePath ? deriveProjectRootFromStoryboardPath(filePath) : '';

  // Parse storyboard.json content
  useEffect(() => {
    try {
      const parsed = JSON.parse(content) as Storyboard;
      setStoryboard(parsed);
      setOrderedShotIds(parsed.shotIds);
      if ((parsed.shotIds?.length ?? 0) > 80) {
        setViewMode('timeline');
      } else {
        setViewMode('canvas');
      }
      setParseError(null);
    } catch {
      setParseError(tRef.current('video.storyboard.loadFailed'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // Load shots from filesystem
  const loadShots = useCallback(
    async (sb: Storyboard) => {
      if (!filePath || sb.shotIds.length === 0) return;
      const root = deriveProjectRootFromStoryboardPath(filePath);
      const shotIds = [...sb.shotIds];

      for (let i = 0; i < shotIds.length; i += SHOT_LOAD_CONCURRENCY) {
        const batch = shotIds.slice(i, i + SHOT_LOAD_CONCURRENCY);

        await Promise.all(
          batch.map(async (shotId) => {
            try {
              const shotPath = `${root}/01-storyboard/shots/${shotId}.json`;
              const raw = await ipcBridge.fs.readFile.invoke({ path: shotPath });
              const shot = JSON.parse(raw) as Shot;
              setShots((prev) => {
                const next = new Map(prev);
                next.set(shotId, shot);
                return next;
              });
            } catch {
              // Shot file missing or invalid — ignore silently
            }
          })
        );
      }
    },
    [filePath]
  );

  useEffect(() => {
    if (storyboard) {
      void loadShots(storyboard);
    }
  }, [storyboard, loadShots]);

  // Subscribe to storyboardStream events
  useEffect(() => {
    const unsubscribe = ipcBridge.videoCreation.storyboardStream.on((event: StoryboardStreamEvent) => {
      if (event.type === 'shot-updated' && event.shot) {
        setShots((prev) => {
          const next = new Map(prev);
          next.set(event.shotId as string, event.shot as Shot);
          return next;
        });
      } else if (event.type === 'shot-image-ready' && event.imagePath) {
        setShots((prev) => {
          const existing = prev.get(event.shotId as string);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(event.shotId as string, { ...existing, imagePath: event.imagePath as string });
          return next;
        });
      } else if (event.type === 'phase-started' && event.phase === 'image_generate') {
        setImageGenProgress({ completed: 0, total: 0 });
      } else if (event.type === 'progress' && event.phase === 'image_generate') {
        setImageGenProgress({
          completed: event.completed ?? 0,
          total: event.total ?? 0,
        });
      } else if (
        (event.type === 'phase-completed' || event.type === 'phase-failed') &&
        event.phase === 'image_generate'
      ) {
        setImageGenProgress((prev) => {
          if (!prev) return null;
          return { completed: prev.total || prev.completed, total: prev.total };
        });
        window.setTimeout(() => setImageGenProgress(null), 1000);
      }
    });
    return unsubscribe;
  }, []);

  // Ctrl+Z / Cmd+Z undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        void undo(async (shotId, updates) => {
          await ipcBridge.videoCreation.updateShot.invoke({ projectRoot, shotId, updates });
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, projectRoot]);

  const handleShotsReorder = useCallback((newOrderedIds: string[]) => {
    setOrderedShotIds(newOrderedIds);
  }, []);

  const handleDeleteShot = useCallback(
    async (shotId: string) => {
      if (!projectRoot || !storyboard) return;
      try {
        await ipcBridge.videoCreation.deleteShot.invoke({ projectRoot, shotId });

        const nextStoryboard: Storyboard = {
          ...storyboard,
          shotIds: storyboard.shotIds.filter((id) => id !== shotId),
          scenes: storyboard.scenes.map((scene) => ({
            ...scene,
            shotIds: (scene.shotIds ?? []).filter((id) => id !== shotId),
          })),
        };

        setStoryboard(nextStoryboard);
        setOrderedShotIds(nextStoryboard.shotIds);
        setShots((prev) => {
          const next = new Map(prev);
          next.delete(shotId);
          return next;
        });
        setSelectedShotId((prev) => (prev === shotId ? null : prev));
        void loadShots(nextStoryboard);
      } catch {
        // noop: keep current UI state if delete failed
      }
    },
    [projectRoot, storyboard, loadShots]
  );

  if (parseError) {
    return <div className='flex-1 flex items-center justify-center text-t-secondary text-14px'>{parseError}</div>;
  }

  if (!storyboard) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <Spin>{t('video.storyboard.loading')}</Spin>
      </div>
    );
  }

  const selectedShot = selectedShotId ? shots.get(selectedShotId) : null;

  const orderedShots = orderedShotIds.map((id) => shots.get(id)).filter((s): s is Shot => Boolean(s));
  const selectedShotSet = new Set(selectedShotId ? [selectedShotId] : []);

  return (
    <div className='flex flex-col h-full bg-[var(--color-paper,#FFFDF5)] overflow-hidden border-2 border-[var(--color-ink,#000)]'>
      {/* Toolbar */}
      <div className='flex items-center justify-between px-12px py-8px border-b-2 border-[var(--color-ink,#000)] shrink-0 gap-8px bg-white'>
        <span className='text-13px text-[var(--color-ink,#000)] font-bold shrink-0'>{t('video.storyboard.title')}</span>

        {/* View switch */}
        <Radio.Group type='button' size='small' value={viewMode} onChange={(val) => setViewMode(val as ViewMode)}>
          <Radio value='canvas'>◎</Radio>
          <Radio value='timeline'>◫</Radio>
        </Radio.Group>

        <div className='flex items-center gap-4px'>
          {/* Asset library button */}
          <Button
            size='mini'
            type='text'
            className='!bg-[var(--color-lime-pop,#D9FF00)] !text-[var(--color-ink,#000)] !border-2 !border-[var(--color-ink,#000)] !rounded-10px !shadow-[4px_4px_0_0_var(--color-ink,#000)]'
            onClick={() => setAssetDrawerVisible(true)}
          >
            {t('video.storyboard.asset.title')}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className='relative flex flex-1 overflow-hidden'>
        {imageGenProgress && (
          <div className='absolute top-44px left-12px z-10 min-w-220px rounded-8px border-2 border-[var(--color-ink,#000)] bg-white px-10px py-8px shadow-[4px_4px_0_0_var(--color-ink,#000)]'>
            <div className='flex items-center justify-between mb-4px'>
              <span className='text-11px text-t-secondary'>Image Generate</span>
              <span className='text-11px text-t-secondary'>
                {imageGenProgress.total > 0
                  ? `${imageGenProgress.completed}/${imageGenProgress.total}`
                  : imageGenProgress.completed}
              </span>
            </div>
            <div className='h-4px w-full rounded-full bg-fill-2 overflow-hidden'>
              <div
                className='h-full bg-brand-6 transition-all duration-200'
                style={{
                  width:
                    imageGenProgress.total > 0
                      ? `${Math.max(6, Math.min(100, (imageGenProgress.completed / imageGenProgress.total) * 100))}%`
                      : '10%',
                }}
              />
            </div>
          </div>
        )}
        {orderedShots.length === 0 ? (
          <div className='flex-1 flex items-center justify-center text-t-secondary text-14px'>
            {t('video.storyboard.empty')}
          </div>
        ) : viewMode === 'timeline' ? (
          <TimelineView
            shots={orderedShots}
            projectRoot={projectRoot}
            selectedShotId={selectedShotId}
            onSelectShot={(shot) => setSelectedShotId(shot.id)}
            onShotsReorder={handleShotsReorder}
          />
        ) : (
          <FlowCanvasView
            shotIds={orderedShotIds}
            shotsById={shots}
            scenes={storyboard.scenes}
            selectedShotId={selectedShotId}
            viewportKey={filePath || projectRoot || storyboard.id}
            onDeleteShot={handleDeleteShot}
            onSelectShot={(shotId) => {
              setSelectedShotId((prev) => (prev === shotId ? null : shotId));
            }}
          />
        )}

        {/* Detail panel */}
        {selectedShot && (
          <ShotDetailPanel shot={selectedShot} projectRoot={projectRoot} onClose={() => setSelectedShotId(null)} />
        )}
      </div>

      {/* Asset library drawer */}
      <AssetLibraryDrawer
        visible={assetDrawerVisible}
        projectRoot={projectRoot}
        selectedShotIds={selectedShotSet}
        onClose={() => setAssetDrawerVisible(false)}
      />
    </div>
  );
};

export default StoryboardBoardViewer;
