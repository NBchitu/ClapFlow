/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { Shot, StoryboardStreamEvent } from '@/common/types/videoCreation';
import { Spin, Tag } from '@arco-design/web-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deriveProjectRootFromShotPath } from './pathUtils';
import ShotDetailPanel from './ShotDetailPanel';

interface ShotInspectorViewerProps {
  content: string;
  filePath?: string;
}

const statusToI18nKey = (status: Shot['status']): string => {
  if (status === 'pending') return 'video.storyboard.status.pending';
  if (status === 'prompts-ready') return 'video.storyboard.status.promptsReady';
  if (status === 'image-generated') return 'video.storyboard.status.imageGenerated';
  if (status === 'image-approved') return 'video.storyboard.status.imageApproved';
  if (status === 'video-generated') return 'video.storyboard.status.videoGenerated';
  if (status === 'approved') return 'video.storyboard.status.approved';
  return 'video.storyboard.status.pending';
};

const ShotInspectorViewer: React.FC<ShotInspectorViewerProps> = ({ content, filePath }) => {
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;

  const [shot, setShot] = useState<Shot | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const projectRoot = useMemo(() => (filePath ? deriveProjectRootFromShotPath(filePath) : ''), [filePath]);
  const shotId = shot?.id;

  useEffect(() => {
    try {
      const parsed = JSON.parse(content) as Shot;
      setShot(parsed);
      setParseError(null);
    } catch {
      setShot(null);
      setParseError(tRef.current('video.storyboard.loadFailed'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  useEffect(() => {
    if (!shotId) return;

    const unsubscribe = ipcBridge.videoCreation.storyboardStream.on((event: StoryboardStreamEvent) => {
      if (event.shotId !== shotId) return;

      if (event.type === 'shot-updated' && event.shot) {
        setShot(event.shot as Shot);
      } else if (event.type === 'shot-image-ready' && event.imagePath) {
        setShot((prev) => (prev ? { ...prev, imagePath: event.imagePath as string } : prev));
      }
    });

    return unsubscribe;
  }, [shotId]);

  if (parseError) {
    return <div className='flex-1 flex items-center justify-center text-t-secondary text-14px'>{parseError}</div>;
  }

  if (!shot) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <Spin>{t('video.storyboard.loading')}</Spin>
      </div>
    );
  }

  return (
    <div className='h-full flex flex-col overflow-hidden border-2 border-[var(--color-ink,#000)] bg-[var(--color-paper,#FFFDF5)]'>
      <div className='shrink-0 flex items-center justify-between gap-8px px-12px py-8px border-b-2 border-[var(--color-ink,#000)] bg-white'>
        <div className='flex items-center gap-8px min-w-0'>
          <span className='text-13px font-semibold text-[var(--color-ink,#000)] truncate'>
            {t('video.storyboard.shot')} {shot.shotIndex}
          </span>
          <Tag color='arcoblue' size='small'>
            {shot.id}
          </Tag>
          <Tag color='lime' size='small'>
            {t(statusToI18nKey(shot.status))}
          </Tag>
        </div>
        <div className='text-11px text-t-secondary shrink-0'>
          {t('video.storyboard.detail.duration')}: {shot.duration}
          {t('video.storyboard.detail.durationUnit')}
        </div>
      </div>

      <div className='flex-1 min-h-0 overflow-auto'>
        <ShotDetailPanel shot={shot} projectRoot={projectRoot} mode='full' />
      </div>
    </div>
  );
};

export default ShotInspectorViewer;
