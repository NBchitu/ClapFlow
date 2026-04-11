/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { QAIssue, Shot } from '@/common/types/videoCreation';
import { Button, Image, Select, Slider, Tag } from '@arco-design/web-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toPreviewImageSrc } from './pathUtils';

const SHOT_TYPE_OPTIONS = [
  { label: 'EWS — Extreme Wide', value: 'EWS' },
  { label: 'WS — Wide Shot', value: 'WS' },
  { label: 'MS — Medium Shot', value: 'MS' },
  { label: 'CU — Close Up', value: 'CU' },
  { label: 'ECU — Extreme Close Up', value: 'ECU' },
];

const CAMERA_MOVE_OPTIONS = [
  { label: 'Static', value: 'static' },
  { label: 'Push', value: 'push' },
  { label: 'Pull', value: 'pull' },
  { label: 'Pan', value: 'pan' },
  { label: 'Tilt', value: 'tilt' },
  { label: 'Handheld', value: 'handheld' },
];

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

interface ShotDetailPanelProps {
  shot: Shot;
  projectRoot: string;
  onClose?: () => void;
  mode?: 'sidebar' | 'full';
}

const ShotDetailPanel: React.FC<ShotDetailPanelProps> = ({ shot, projectRoot, onClose, mode = 'sidebar' }) => {
  const { t } = useTranslation();
  const [local, setLocal] = useState<Shot>(shot);
  const [saving, setSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(shot.status === 'image-generating');
  const [regenProgress, setRegenProgress] = useState(shot.status === 'image-generating' ? 8 : 0);
  const [promptsExpanded, setPromptsExpanded] = useState(false);
  const imagePromptRef = useRef<HTMLTextAreaElement>(null);
  const videoPromptRef = useRef<HTMLTextAreaElement>(null);
  const regenTickRef = useRef<number | null>(null);

  useEffect(() => {
    setLocal(shot);
  }, [shot]);

  useEffect(() => {
    if (shot.status === 'image-generating') {
      setIsRegenerating(true);
      setRegenProgress((prev) => (prev > 0 ? prev : 8));
      return;
    }

    if (isRegenerating) {
      setRegenProgress(100);
      const finishTimer = window.setTimeout(() => {
        setIsRegenerating(false);
        setRegenProgress(0);
      }, 520);
      return () => window.clearTimeout(finishTimer);
    }
  }, [shot.status, isRegenerating]);

  useEffect(() => {
    if (!isRegenerating) {
      if (regenTickRef.current !== null) {
        window.clearInterval(regenTickRef.current);
        regenTickRef.current = null;
      }
      return;
    }

    regenTickRef.current = window.setInterval(() => {
      setRegenProgress((prev) => Math.min(92, prev + Math.max(1, Math.round((100 - prev) * 0.08))));
    }, 220);

    return () => {
      if (regenTickRef.current !== null) {
        window.clearInterval(regenTickRef.current);
        regenTickRef.current = null;
      }
    };
  }, [isRegenerating]);

  const save = useCallback(
    async (updates: Partial<Shot>) => {
      if (saving) return;
      setSaving(true);
      try {
        await ipcBridge.videoCreation.updateShot.invoke({ projectRoot, shotId: shot.id, updates });
      } finally {
        setSaving(false);
      }
    },
    [projectRoot, shot.id, saving]
  );

  const handleFieldBlur = useCallback(
    (field: keyof Shot, value: unknown) => {
      if (value !== shot[field]) {
        void save({ [field]: value } as Partial<Shot>);
      }
    },
    [save, shot]
  );

  const handlePromptKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, field: 'imagePrompt' | 'videoPrompt') => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const value = (e.target as HTMLTextAreaElement).value;
        void save({ [field]: value });
      }
    },
    [save]
  );

  const handleRemoveToken = useCallback(
    (token: string) => {
      const updated = local.lockedTokens.filter((t) => t !== token);
      setLocal((prev) => ({ ...prev, lockedTokens: updated }));
      void save({ lockedTokens: updated });
    },
    [local.lockedTokens, save]
  );

  const handleToggleLock = useCallback(() => {
    void save({ locked: !shot.locked });
  }, [save, shot.locked]);

  const handleRegenerate = useCallback(() => {
    setIsRegenerating(true);
    setRegenProgress(8);
    setLocal((prev) => ({ ...prev, status: 'image-generating' }));
    void (async () => {
      try {
        await ipcBridge.videoCreation.updateShot.invoke({
          projectRoot,
          shotId: shot.id,
          updates: { status: 'prompts-ready' },
        });
        await ipcBridge.videoCreation.generateShotImages.invoke({
          projectRoot,
          shotIds: [shot.id],
        });
      } catch {
        setIsRegenerating(false);
        setRegenProgress(0);
      }
    })();
  }, [projectRoot, shot.id]);

  const handleFixAndRegenerate = useCallback(
    (issue: QAIssue) => {
      const suggestion = issue.suggestion ?? '';
      const newPrompt = local.imagePrompt ? `${local.imagePrompt}, ${suggestion}` : suggestion;
      void save({ imagePrompt: newPrompt, status: 'prompts-ready' });
    },
    [local.imagePrompt, save]
  );

  const severityColor = (severity: QAIssue['severity']) => (severity === 'error' ? 'text-red-500' : 'text-yellow-500');
  const showGeneratingSpin = isRegenerating || local.status === 'image-generating';
  const isSidebarMode = mode === 'sidebar';

  const panelRootClass = isSidebarMode
    ? 'flex h-full w-[420px] flex-col overflow-hidden border-l-2 border-[var(--color-ink,#000)] bg-[#F2F2F2] shadow-[4px_0_0_0_var(--color-ink,#000)]'
    : 'flex h-full w-full flex-col overflow-hidden bg-[var(--color-paper,#FFFDF5)]';
  const headerClass = isSidebarMode
    ? 'flex shrink-0 items-center justify-between border-b-2 border-[var(--color-ink,#000)] bg-[var(--color-ink,#000)] px-3 py-2'
    : 'flex shrink-0 items-center justify-between border-b-2 border-[var(--color-ink,#000)] bg-white px-4 py-3';
  const mediaBlockClass = isSidebarMode
    ? 'shrink-0 space-y-2 border-b-2 border-[var(--color-ink,#000)] bg-[#F7F7F7] p-3'
    : 'shrink-0 space-y-3 border-b-2 border-[var(--color-ink,#000)] bg-white p-4';
  const formScrollClass = isSidebarMode
    ? 'flex-1 min-h-0 space-y-3 overflow-y-auto p-3'
    : 'flex-1 min-h-0 space-y-4 overflow-y-auto p-4';
  const sectionCardClass = 'space-y-2 border-2 border-[var(--color-ink,#000)] bg-white p-3';
  const rowLabelClass = 'pt-1 text-xs font-bold text-[var(--color-ink,#000)]';
  const rowClass = 'grid grid-cols-[68px_1fr] items-start gap-2';
  const inputClass =
    'w-full resize-none border-0 border-b-2 border-[var(--color-ink,#000)] bg-transparent px-0 py-1.5 text-sm text-[var(--color-ink,#000)] focus:border-[var(--color-lime-pop,#D9FF00)] focus:outline-none';
  const selectClass =
    '[&_.arco-select-view]:!h-8 [&_.arco-select-view]:!rounded-none [&_.arco-select-view]:!border-2 [&_.arco-select-view]:!border-[var(--color-ink,#000)] [&_.arco-select-view]:!bg-white';

  return (
    <div className={panelRootClass}>
      <div className={headerClass}>
        <span
          className={
            isSidebarMode
              ? 'text-xs font-bold text-[var(--color-lime-pop,#D9FF00)] text-balance'
              : 'text-13px font-semibold text-[var(--color-ink,#000)] text-balance'
          }
        >
          {t('video.storyboard.detail.title')} · {t('video.storyboard.shot')} {local.shotIndex} / {local.shotType}
        </span>
        {isSidebarMode && onClose && (
          <Button
            type='text'
            size='mini'
            className='!h-6 !w-6 !min-w-6 !px-0 !text-[var(--color-lime-pop,#D9FF00)] hover:!bg-transparent hover:!opacity-80'
            onClick={onClose}
            aria-label={t('video.storyboard.detail.close')}
          >
            ✕
          </Button>
        )}
      </div>

      <div className={mediaBlockClass}>
        <div className='relative flex aspect-video w-full items-center justify-center overflow-hidden border-2 border-[var(--color-ink,#000)] bg-white'>
          {local.imagePath ? (
            <div className='h-full w-full'>
              <Image
                src={toPreviewImageSrc(local.imagePath)}
                alt={local.goal}
                preview
                previewProps={{
                  actionsLayout: ['zoomIn', 'zoomOut', 'originalSize', 'rotateLeft', 'rotateRight'],
                }}
                className='h-full w-full [&_.arco-image-img]:h-full [&_.arco-image-img]:w-full [&_.arco-image-img]:object-cover'
              />
            </div>
          ) : (
            <span className='text-11px text-t-tertiary'>{t('video.storyboard.detail.noImage')}</span>
          )}

          {showGeneratingSpin && (
            <div className='absolute inset-0 flex items-center justify-center bg-[rgba(255,253,245,0.78)] pointer-events-none'>
              <MechanicalSpinner size={40} />
            </div>
          )}
        </div>

        <div className='flex items-center gap-2'>
          <Button
            size='small'
            type={local.locked ? 'primary' : 'secondary'}
            onClick={handleToggleLock}
            loading={saving}
            aria-label={local.locked ? t('video.storyboard.detail.unlock') : t('video.storyboard.detail.lock')}
            className='!h-8 !w-8 !min-w-8 !rounded-none !border-2 !border-[var(--color-ink,#000)] !px-0 !shadow-sm'
          >
            {local.locked ? '🔒' : '🔓'}
          </Button>
          <Button
            size='small'
            type='primary'
            onClick={handleRegenerate}
            loading={showGeneratingSpin}
            disabled={!local.imagePrompt || isRegenerating}
            className='!h-8 flex-1 !rounded-none !border-2 !border-[var(--color-ink,#000)] !bg-[var(--color-lime-pop,#D9FF00)] !font-extrabold !text-[var(--color-ink,#000)] !shadow-sm'
          >
            {t('video.storyboard.detail.regenerate')}
          </Button>
        </div>

        {showGeneratingSpin && (
          <div>
            <div className='h-1.5 w-full overflow-hidden border border-[var(--color-ink,#000)] bg-white'>
              <div
                className='h-full bg-[var(--color-lime-pop,#D9FF00)] transition-all duration-200'
                style={{ width: `${Math.max(8, regenProgress)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className={formScrollClass}>
        <div className={sectionCardClass}>
          <p className='text-xs font-bold text-[var(--color-ink,#000)] text-balance'>
            {t('video.storyboard.detail.title')}
          </p>
          <div className='grid grid-cols-2 gap-2'>
            <Select
              size='small'
              value={local.shotType}
              options={SHOT_TYPE_OPTIONS}
              className={selectClass}
              onChange={(val) => {
                setLocal((prev) => ({ ...prev, shotType: val as Shot['shotType'] }));
                void save({ shotType: val as Shot['shotType'] });
              }}
            />
            <Select
              size='small'
              value={local.cameraMove}
              options={CAMERA_MOVE_OPTIONS}
              className={selectClass}
              onChange={(val) => {
                setLocal((prev) => ({ ...prev, cameraMove: val as Shot['cameraMove'] }));
                void save({ cameraMove: val as Shot['cameraMove'] });
              }}
            />
          </div>
          <div className='space-y-1'>
            <div className='flex items-center justify-between text-xs font-bold text-[var(--color-ink,#000)]'>
              <span>{t('video.storyboard.detail.duration')}</span>
              <span className='tabular-nums'>
                {local.duration}
                {t('video.storyboard.detail.durationUnit')}
              </span>
            </div>
            <Slider
              min={1}
              max={30}
              step={1}
              value={local.duration}
              className='[&_.arco-slider-road]:!h-1 [&_.arco-slider-road]:!bg-black/20 [&_.arco-slider-bar]:!h-1 [&_.arco-slider-bar]:!bg-black [&_.arco-slider-button]:!h-3 [&_.arco-slider-button]:!w-3 [&_.arco-slider-button]:!rounded-none [&_.arco-slider-button]:!border-2 [&_.arco-slider-button]:!border-[var(--color-ink,#000)] [&_.arco-slider-button]:!bg-[var(--color-lime-pop,#D9FF00)]'
              onChange={(val) => setLocal((prev) => ({ ...prev, duration: val as number }))}
              onAfterChange={(val) => void save({ duration: val as number })}
            />
          </div>
        </div>

        <div className={sectionCardClass}>
          <div className={rowClass}>
            <p className={rowLabelClass}>{t('video.storyboard.detail.goal')}</p>
            <p className='border border-[var(--color-ink,#000)] bg-[#F7F7F7] px-2 py-1.5 text-sm text-[var(--color-ink,#000)] text-pretty'>
              {local.goal || '—'}
            </p>
          </div>
          <div className={rowClass}>
            <p className={rowLabelClass}>{t('video.storyboard.detail.action')}</p>
            <textarea
              className={inputClass}
              rows={2}
              value={local.action}
              onChange={(e) => setLocal((prev) => ({ ...prev, action: e.target.value }))}
              onBlur={(e) => handleFieldBlur('action', e.target.value)}
            />
          </div>
          <div className={rowClass}>
            <p className={rowLabelClass}>{t('video.storyboard.detail.dialogue')}</p>
            <textarea
              className={inputClass}
              rows={2}
              value={local.dialogue}
              onChange={(e) => setLocal((prev) => ({ ...prev, dialogue: e.target.value }))}
              onBlur={(e) => handleFieldBlur('dialogue', e.target.value)}
            />
          </div>
        </div>

        <div className={sectionCardClass}>
          <div className='mb-1 flex items-center justify-between'>
            <p className='text-xs font-bold text-[var(--color-ink,#000)]'>Prompt</p>
            <Button
              type='text'
              size='mini'
              className='!h-5 !px-1.5 !text-xs'
              onClick={() => setPromptsExpanded((prev) => !prev)}
            >
              {promptsExpanded ? t('common.collapse') : t('common.more')}
            </Button>
          </div>
          <p className='text-xs text-t-secondary'>
            {t('video.storyboard.detail.imagePrompt')}{' '}
            <span className='text-t-tertiary'>({t('video.storyboard.detail.saveHint')})</span>
          </p>
          <textarea
            ref={imagePromptRef}
            className={inputClass}
            rows={promptsExpanded ? 4 : 2}
            value={local.imagePrompt}
            onChange={(e) => setLocal((prev) => ({ ...prev, imagePrompt: e.target.value }))}
            onKeyDown={(e) => handlePromptKeyDown(e, 'imagePrompt')}
          />

          <p className='text-xs text-t-secondary'>
            {t('video.storyboard.detail.videoPrompt')}{' '}
            <span className='text-t-tertiary'>({t('video.storyboard.detail.saveHint')})</span>
          </p>
          <textarea
            ref={videoPromptRef}
            className={inputClass}
            rows={promptsExpanded ? 3 : 2}
            value={local.videoPrompt}
            onChange={(e) => setLocal((prev) => ({ ...prev, videoPrompt: e.target.value }))}
            onKeyDown={(e) => handlePromptKeyDown(e, 'videoPrompt')}
          />
        </div>

        {(local.imageHistory?.length ?? 0) > 0 && (
          <div className={sectionCardClass}>
            <p className='text-xs font-bold text-[var(--color-ink,#000)]'>{t('video.storyboard.history.title')}</p>
            <div className='flex gap-1.5 overflow-x-auto'>
              {local.imageHistory!.slice(0, 8).map((histPath, idx) => (
                <Button
                  key={idx}
                  type='text'
                  title={t('video.storyboard.history.restore')}
                  className='!h-9 !w-14 !min-w-14 !overflow-hidden !rounded-none !border !border-[var(--color-ink,#000)] !p-0'
                  onClick={() => void save({ imagePath: histPath })}
                >
                  <img src={toPreviewImageSrc(histPath)} alt='' className='h-full w-full object-cover' loading='lazy' />
                </Button>
              ))}
            </div>
          </div>
        )}

        {local.lockedTokens.length > 0 && (
          <div className={sectionCardClass}>
            <p className='text-xs font-bold text-[var(--color-ink,#000)]'>
              {t('video.storyboard.detail.lockedTokens')}
            </p>
            <div className='flex flex-wrap gap-2'>
              {local.lockedTokens.map((token) => (
                <Tag key={token} closable onClose={() => handleRemoveToken(token)} size='small'>
                  {token}
                </Tag>
              ))}
            </div>
          </div>
        )}

        {local.qaIssues && local.qaIssues.length > 0 && (
          <div className={sectionCardClass}>
            <p className='text-xs font-bold text-[var(--color-ink,#000)]'>{t('video.storyboard.detail.qaIssues')}</p>
            <div className='flex flex-col gap-2'>
              {local.qaIssues.map((issue, idx) => (
                <div key={idx} className='border border-[var(--color-ink,#000)] bg-[#F7F7F7] p-2'>
                  <p className={`mb-1 text-11px font-medium ${severityColor(issue.severity)}`}>{issue.type}</p>
                  <p className='mb-1 text-11px text-t-secondary text-pretty'>{issue.description}</p>
                  {issue.suggestion && (
                    <Button
                      type='text'
                      size='mini'
                      className='!h-5 !p-0 !text-11px !text-[var(--color-ink,#000)]'
                      onClick={() => handleFixAndRegenerate(issue)}
                    >
                      {t('video.storyboard.detail.fixAndRegenerate')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShotDetailPanel;
