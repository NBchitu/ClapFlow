/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { Shot, Storyboard, StoryboardStreamEvent } from '@/common/types/videoCreation';
import { Spin } from '@arco-design/web-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AssetLibraryDrawer from './AssetLibraryDrawer';
import { FlowCanvasView } from './flow';
import ShotDetailPanel from './ShotDetailPanel';
import TimelineView from './TimelineView';
import VideoDetailPanel from './VideoDetailPanel';
import { useUndoStack } from './hooks/useUndoStack';
import { deriveProjectRootFromStoryboardPath } from './pathUtils';

type ViewMode = 'canvas' | 'timeline' | 'assets';

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
  const [selectedTrackType, setSelectedTrackType] = useState<'image' | 'video'>('image');
  const [parseError, setParseError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('canvas');
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
    <div className='flex flex-col h-full bg-white overflow-hidden border border-gray-200'>
      <div className='flex items-center justify-between px-[20px] py-[16px] border-b border-gray-200 shrink-0 bg-white relative'>
        <div className='flex items-center'>
          {/* Logo */}
          <div className='flex items-center gap-[14px]'>
            {/* <div className='w-[44px] h-[44px] bg-[#D9FF00] rounded-[12px] flex items-center justify-center p-0'>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
            </div> */}
            <div className='flex flex-col'>
              <span className='text-[24px] font-black tracking-tight text-black'>Storyboard</span>
              <div className='mt-[2px] mb-[1px] flex items-center gap-[6px]'>
                <span className='w-[6px] h-[6px] rounded-full bg-[#D9FF00]'></span>
                <span className='text-[9px] font-medium tracking-[0.08em] text-gray-500 uppercase'>
                  Project: storyboard.json
                </span>
                <span className='text-[9px] font-medium tracking-[0.08em] text-gray-400 uppercase'>V1.0.4</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className='flex items-center absolute left-1/2 -translate-x-1/2 gap-[8px]'>
          <button
            className={`text-[11px] font-bold tracking-widest px-[18px] py-[8px] transition-colors focus:outline-none ${
              viewMode === 'canvas'
                ? 'border-[1.5px] border-black rounded-[8px] bg-[#F2F3F5] text-black'
                : 'text-gray-500 hover:text-black border-[1.5px] border-transparent rounded-[8px]'
            }`}
            onClick={() => setViewMode('canvas')}
          >
            CANVAS
          </button>
          <button
            className={`text-[11px] font-bold tracking-widest px-[18px] py-[8px] transition-colors focus:outline-none ${
              viewMode === 'timeline'
                ? 'border-[1.5px] border-black rounded-[8px] bg-[#F2F3F5] text-black'
                : 'text-gray-500 hover:text-black border-[1.5px] border-transparent rounded-[8px]'
            }`}
            onClick={() => setViewMode('timeline')}
          >
            TIMELINE
          </button>
          <button
            className={`text-[11px] font-bold tracking-widest px-[18px] py-[8px] transition-colors focus:outline-none ${
              viewMode === 'assets'
                ? 'border-[1.5px] border-black rounded-[8px] bg-[#F2F3F5] text-black'
                : 'text-gray-500 hover:text-black border-[1.5px] border-transparent rounded-[8px]'
            }`}
            onClick={() => setViewMode('assets')}
          >
            ASSETS
          </button>
        </div>

        {/* Right Tools */}
        <div className='flex items-center gap-[12px]'>
          <div className='w-[2px] h-[16px] bg-black/60 rounded-full mr-[4px]'></div>
          <button className='w-[36px] h-[36px] rounded-[8px] border-[1.5px] border-black bg-[#F2F3F5] flex items-center justify-center hover:bg-gray-200 transition-colors'>
            <svg
              width='16'
              height='16'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <circle cx='12' cy='12' r='3'></circle>
              <path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'></path>
            </svg>
          </button>
          <button className='flex h-[36px] items-center justify-center gap-[6px] rounded-[6px] bg-[#D9FF00] px-[16px] transition-colors hover:bg-[#cbf000]'>
            <svg
              width='16'
              height='16'
              viewBox='0 0 24 24'
              fill='none'
              stroke='black'
              strokeWidth='2.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <line x1='12' y1='5' x2='12' y2='19'></line>
              <line x1='5' y1='12' x2='19' y2='12'></line>
            </svg>
            <span className='mt-[1px] text-[11px] font-bold tracking-[0.1em] text-black'>SHOT</span>
          </button>
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
        ) : viewMode === 'assets' ? (
          <AssetLibraryDrawer
            visible={true}
            projectRoot={projectRoot}
            selectedShotIds={selectedShotSet}
            onClose={() => setViewMode('canvas')}
          />
        ) : viewMode === 'timeline' ? (
          <TimelineView
            shots={orderedShots}
            projectRoot={projectRoot}
            selectedShotId={selectedShotId}
            selectedTrackType={selectedTrackType}
            onSelectShot={(shot, type) => {
              setSelectedShotId(shot.id);
              setSelectedTrackType(type);
            }}
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
              setSelectedTrackType('image');
            }}
          />
        )}

        {/* Detail panel */}
        {viewMode !== 'assets' &&
          (viewMode === 'timeline' && selectedTrackType === 'video' ? (
            <VideoDetailPanel
              visible={!!selectedShotId}
              shot={selectedShot}
              projectRoot={projectRoot}
              onClose={() => setSelectedShotId(null)}
            />
          ) : (
            <ShotDetailPanel
              visible={!!selectedShotId}
              shot={selectedShot}
              projectRoot={projectRoot}
              onClose={() => setSelectedShotId(null)}
            />
          ))}
      </div>
    </div>
  );
};

export default StoryboardBoardViewer;
