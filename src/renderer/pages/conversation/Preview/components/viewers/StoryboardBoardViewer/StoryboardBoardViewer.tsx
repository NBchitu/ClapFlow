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
import ShotCard from './ShotCard';
import ShotDetailPanel from './ShotDetailPanel';
import TimelineView from './TimelineView';
import { useUndoStack } from './hooks/useUndoStack';

type CardSize = 'S' | 'M' | 'L';
type StatusFilter = 'all' | 'pending' | 'hasIssue' | 'locked';
type ViewMode = 'grid' | 'timeline';

interface StoryboardBoardViewerProps {
  /** storyboard.json raw content string */
  content: string;
  /** absolute path to storyboard.json (used to derive projectRoot) */
  filePath?: string;
}

/** Derive projectRoot from storyboard.json path: .../01-storyboard/storyboard.json → .../ */
function deriveProjectRoot(filePath: string): string {
  const sep = filePath.includes('/') ? '/' : '\\';
  const parts = filePath.split(sep);
  parts.splice(-2);
  return parts.join(sep);
}

function matchesFilter(shot: Shot, filter: StatusFilter): boolean {
  switch (filter) {
    case 'pending':
      return shot.status === 'pending' || shot.status === 'prompts-ready';
    case 'hasIssue':
      return (shot.qaIssues?.length ?? 0) > 0;
    case 'locked':
      return shot.locked;
    default:
      return true;
  }
}

const SHOT_LOAD_CONCURRENCY = 5;

const StoryboardBoardViewer: React.FC<StoryboardBoardViewerProps> = ({ content, filePath }) => {
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;

  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [shots, setShots] = useState<Map<string, Shot>>(new Map());
  const [loadingShots, setLoadingShots] = useState<Set<string>>(new Set());
  const [cardSize, setCardSize] = useState<CardSize>('M');
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [parseError, setParseError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [assetDrawerVisible, setAssetDrawerVisible] = useState(false);
  const [orderedShotIds, setOrderedShotIds] = useState<string[]>([]);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { push: pushUndo, undo } = useUndoStack();

  const projectRoot = filePath ? deriveProjectRoot(filePath) : '';

  // Parse storyboard.json content
  useEffect(() => {
    try {
      const parsed = JSON.parse(content) as Storyboard;
      setStoryboard(parsed);
      setOrderedShotIds(parsed.shotIds);
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
      const root = deriveProjectRoot(filePath);
      const shotIds = [...sb.shotIds];

      for (let i = 0; i < shotIds.length; i += SHOT_LOAD_CONCURRENCY) {
        const batch = shotIds.slice(i, i + SHOT_LOAD_CONCURRENCY);
        setLoadingShots((prev) => {
          const next = new Set(prev);
          batch.forEach((id) => next.add(id));
          return next;
        });

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
            } finally {
              setLoadingShots((prev) => {
                const next = new Set(prev);
                next.delete(shotId);
                return next;
              });
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

  // Scroll selected card into view
  useEffect(() => {
    if (selectedShotId) {
      const el = cardRefs.current.get(selectedShotId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedShotId]);

  const handleCardClick = useCallback((shot: Shot, event: React.MouseEvent) => {
    if (event.shiftKey) {
      setBatchSelected((prev) => {
        const next = new Set(prev);
        if (next.has(shot.id)) next.delete(shot.id);
        else next.add(shot.id);
        return next;
      });
    } else {
      setBatchSelected(new Set());
      setSelectedShotId((prev) => (prev === shot.id ? null : shot.id));
    }
  }, []);

  const handleBatchLock = useCallback(
    async (locked: boolean) => {
      for (const id of batchSelected) {
        await ipcBridge.videoCreation.updateShot.invoke({
          projectRoot,
          shotId: id,
          updates: { locked },
        });
      }
      setBatchSelected(new Set());
    },
    [batchSelected, projectRoot]
  );

  const handleBatchRegenerate = useCallback(() => {
    void ipcBridge.videoCreation.generateShotImages.invoke({
      projectRoot,
      shotIds: [...batchSelected],
    });
    setBatchSelected(new Set());
  }, [batchSelected, projectRoot]);

  const handleInsertBefore = useCallback(
    async (shot: Shot) => {
      const idx = orderedShotIds.indexOf(shot.id);
      const after = idx > 0 ? orderedShotIds[idx - 1] : null;
      const newShot = await ipcBridge.videoCreation.insertShot.invoke({
        projectRoot,
        after,
        partial: { sceneIndex: shot.sceneIndex },
      });
      setShots((prev) => {
        const next = new Map(prev);
        next.set(newShot.id, newShot);
        return next;
      });
      setOrderedShotIds((prev) => {
        const insertAt = idx >= 0 ? idx : prev.length;
        const next = [...prev];
        next.splice(insertAt, 0, newShot.id);
        return next;
      });
    },
    [orderedShotIds, projectRoot]
  );

  const handleDuplicate = useCallback(
    async (shot: Shot) => {
      const newShot = await ipcBridge.videoCreation.insertShot.invoke({
        projectRoot,
        after: shot.id,
        partial: { ...shot, id: undefined },
      });
      setShots((prev) => {
        const next = new Map(prev);
        next.set(newShot.id, newShot);
        return next;
      });
      setOrderedShotIds((prev) => {
        const idx = prev.indexOf(shot.id);
        const next = [...prev];
        next.splice(idx + 1, 0, newShot.id);
        return next;
      });
    },
    [projectRoot]
  );

  const handleDelete = useCallback(
    async (shot: Shot) => {
      // Push undo before deleting — restore is a no-op (shot is gone) but allows cancel pattern
      pushUndo({ shotId: shot.id, before: { ...shot }, label: 'delete' });
      await ipcBridge.videoCreation.deleteShot.invoke({ projectRoot, shotId: shot.id });
      setShots((prev) => {
        const next = new Map(prev);
        next.delete(shot.id);
        return next;
      });
      setOrderedShotIds((prev) => prev.filter((id) => id !== shot.id));
      if (selectedShotId === shot.id) setSelectedShotId(null);
    },
    [projectRoot, pushUndo, selectedShotId]
  );

  const handleShotsReorder = useCallback((newOrderedIds: string[]) => {
    setOrderedShotIds(newOrderedIds);
  }, []);

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
  const filteredIds = orderedShotIds.filter((id) => {
    const shot = shots.get(id);
    if (!shot) return statusFilter === 'all';
    return matchesFilter(shot, statusFilter);
  });

  const orderedShots = orderedShotIds.map((id) => shots.get(id)).filter((s): s is Shot => Boolean(s));

  return (
    <div className='flex flex-col h-full bg-bg-1 overflow-hidden'>
      {/* Toolbar */}
      <div className='flex items-center justify-between px-12px py-8px border-b border-border-1 shrink-0 gap-8px'>
        <span className='text-13px text-t-primary font-medium shrink-0'>{t('video.storyboard.title')}</span>

        {/* View switch */}
        <Radio.Group type='button' size='small' value={viewMode} onChange={(val) => setViewMode(val as ViewMode)}>
          <Radio value='grid'>≡</Radio>
          <Radio value='timeline'>◫</Radio>
        </Radio.Group>

        {/* Status filter (grid only) */}
        {viewMode === 'grid' && (
          <div className='flex gap-4px'>
            {(['all', 'pending', 'hasIssue', 'locked'] as StatusFilter[]).map((f) => (
              <Button
                key={f}
                size='mini'
                type={statusFilter === f ? 'primary' : 'text'}
                onClick={() => setStatusFilter(f)}
              >
                {t(`video.storyboard.filter.${f}`)}
              </Button>
            ))}
          </div>
        )}

        <div className='flex items-center gap-4px'>
          {/* Asset library button */}
          <Button size='mini' type='text' onClick={() => setAssetDrawerVisible(true)}>
            {t('video.storyboard.asset.title')}
          </Button>

          {/* Card size (grid only) */}
          {viewMode === 'grid' && (
            <Radio.Group type='button' size='small' value={cardSize} onChange={(val) => setCardSize(val as CardSize)}>
              <Radio value='S'>{t('video.storyboard.size.small')}</Radio>
              <Radio value='M'>{t('video.storyboard.size.medium')}</Radio>
              <Radio value='L'>{t('video.storyboard.size.large')}</Radio>
            </Radio.Group>
          )}
        </div>
      </div>

      {/* Batch toolbar */}
      {batchSelected.size > 0 && (
        <div className='flex items-center gap-8px px-12px py-6px bg-bg-2 border-b border-border-1 shrink-0'>
          <span className='text-12px text-t-secondary'>
            {t('video.storyboard.batch.selected', { count: batchSelected.size })}
          </span>
          <Button size='mini' type='outline' onClick={handleBatchRegenerate}>
            {t('video.storyboard.batch.regenerate')}
          </Button>
          <Button size='mini' type='outline' onClick={() => void handleBatchLock(true)}>
            {t('video.storyboard.batch.lock')}
          </Button>
          <Button size='mini' type='outline' onClick={() => void handleBatchLock(false)}>
            {t('video.storyboard.batch.unlock')}
          </Button>
          <Button size='mini' type='text' onClick={() => setBatchSelected(new Set())}>
            {t('video.storyboard.batch.clear')}
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className='flex flex-1 overflow-hidden'>
        {viewMode === 'timeline' ? (
          <TimelineView
            shots={orderedShots}
            projectRoot={projectRoot}
            selectedShotId={selectedShotId}
            onSelectShot={(shot) => setSelectedShotId(shot.id)}
            onShotsReorder={handleShotsReorder}
          />
        ) : (
          /* Grid view */
          <div className='flex-1 overflow-y-auto p-12px'>
            {filteredIds.length === 0 ? (
              <div className='flex items-center justify-center h-full text-t-secondary text-14px'>
                {t('video.storyboard.empty')}
              </div>
            ) : (
              <div className='flex flex-wrap gap-8px'>
                {filteredIds.map((shotId) => {
                  const shot = shots.get(shotId);
                  const isLoading = loadingShots.has(shotId);
                  const isHighlighted = selectedShotId === shotId || batchSelected.has(shotId);

                  return (
                    <div
                      key={shotId}
                      ref={(el) => {
                        if (el) cardRefs.current.set(shotId, el);
                        else cardRefs.current.delete(shotId);
                      }}
                    >
                      {shot ? (
                        <ShotCard
                          shot={shot}
                          cardSize={cardSize}
                          isHighlighted={isHighlighted}
                          isImageLoading={isLoading}
                          onClick={(s, e) => handleCardClick(s, e)}
                          onInsertBefore={handleInsertBefore}
                          onDuplicate={handleDuplicate}
                          onDelete={handleDelete}
                        />
                      ) : (
                        <div
                          className='rounded-4px border border-border-1 bg-bg-3 flex items-center justify-center'
                          style={{
                            width: cardSize === 'S' ? 100 : cardSize === 'M' ? 160 : 240,
                            height: cardSize === 'S' ? 56 : cardSize === 'M' ? 90 : 135,
                          }}
                        >
                          {isLoading ? <Spin size={16} /> : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
        selectedShotIds={batchSelected}
        onClose={() => setAssetDrawerVisible(false)}
      />
    </div>
  );
};

export default StoryboardBoardViewer;
