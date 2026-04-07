/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { QAIssue, Shot } from '@/common/types/videoCreation';
import { Button, Select, Slider, Tag } from '@arco-design/web-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveExtensionAssetUrl } from '@renderer/utils/platform';

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

interface ShotDetailPanelProps {
  shot: Shot;
  projectRoot: string;
  onClose: () => void;
}

const ShotDetailPanel: React.FC<ShotDetailPanelProps> = ({ shot, projectRoot, onClose }) => {
  const { t } = useTranslation();
  const [local, setLocal] = useState<Shot>(shot);
  const [saving, setSaving] = useState(false);
  const imagePromptRef = useRef<HTMLTextAreaElement>(null);
  const videoPromptRef = useRef<HTMLTextAreaElement>(null);

  // Sync when the shot prop changes (via storyboardStream)
  useEffect(() => {
    setLocal(shot);
  }, [shot]);

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
    [shot, save]
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
  }, [shot.locked, save]);

  const handleRegenerate = useCallback(() => {
    void ipcBridge.videoCreation.generateShotImages.invoke({
      projectRoot,
      shotIds: [shot.id],
    });
  }, [projectRoot, shot.id]);

  const handleFixAndRegenerate = useCallback(
    (issue: QAIssue) => {
      // Apply suggestion to imagePrompt and trigger regeneration
      const suggestion = issue.suggestion ?? '';
      const newPrompt = local.imagePrompt ? `${local.imagePrompt}, ${suggestion}` : suggestion;
      void save({ imagePrompt: newPrompt, status: 'prompts-ready' });
    },
    [local.imagePrompt, save]
  );

  const severityColor = (severity: QAIssue['severity']) => (severity === 'error' ? 'text-red-500' : 'text-yellow-500');

  return (
    <div className='flex flex-col h-full w-280px shrink-0 border-l border-border-1 bg-bg-1 overflow-y-auto'>
      {/* Header */}
      <div className='flex items-center justify-between px-12px py-8px border-b border-border-1 shrink-0'>
        <span className='text-13px text-t-primary font-medium'>
          {t('video.storyboard.shot')} {local.shotIndex}
        </span>
        <Button type='text' size='mini' onClick={onClose} aria-label={t('video.storyboard.detail.close')}>
          ✕
        </Button>
      </div>

      <div className='flex flex-col gap-12px px-12px py-10px'>
        {/* Image History */}
        {(local.imageHistory?.length ?? 0) > 0 && (
          <div>
            <p className='text-11px text-t-secondary mb-4px'>{t('video.storyboard.history.title')}</p>
            <div className='flex flex-row gap-4px overflow-x-auto pb-4px'>
              {local.imageHistory!.slice(0, 5).map((histPath, idx) => (
                <button
                  key={idx}
                  type='button'
                  title={t('video.storyboard.history.restore')}
                  className='shrink-0 rounded-2px overflow-hidden border border-border-1 hover:border-brand-6 cursor-pointer'
                  style={{ width: 40, height: 24 }}
                  onClick={() => void save({ imagePath: histPath })}
                >
                  <img src={resolveExtensionAssetUrl(`file://${histPath}`)} alt='' className='w-full h-full object-cover' loading='lazy' />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Image preview */}
        <div className='w-full aspect-video rounded-4px overflow-hidden bg-bg-3 flex items-center justify-center'>
          {local.imagePath ? (
            <img
              src={resolveExtensionAssetUrl(`file://${local.imagePath}`)}
              alt={local.goal}
              className='w-full h-full object-cover'
              loading='lazy'
            />
          ) : (
            <span className='text-11px text-t-tertiary'>{t('video.storyboard.detail.noImage')}</span>
          )}
        </div>

        {/* Goal */}
        <div>
          <p className='text-11px text-t-secondary mb-2px'>{t('video.storyboard.detail.goal')}</p>
          <p className='text-12px text-t-primary'>{local.goal || '—'}</p>
        </div>

        {/* Shot type + Camera move */}
        <div className='flex gap-8px'>
          <div className='flex-1'>
            <p className='text-11px text-t-secondary mb-4px'>{t('video.storyboard.detail.shotType')}</p>
            <Select
              size='small'
              value={local.shotType}
              options={SHOT_TYPE_OPTIONS}
              onChange={(val) => {
                setLocal((prev) => ({ ...prev, shotType: val as Shot['shotType'] }));
                void save({ shotType: val as Shot['shotType'] });
              }}
            />
          </div>
          <div className='flex-1'>
            <p className='text-11px text-t-secondary mb-4px'>{t('video.storyboard.detail.cameraMove')}</p>
            <Select
              size='small'
              value={local.cameraMove}
              options={CAMERA_MOVE_OPTIONS}
              onChange={(val) => {
                setLocal((prev) => ({ ...prev, cameraMove: val as Shot['cameraMove'] }));
                void save({ cameraMove: val as Shot['cameraMove'] });
              }}
            />
          </div>
        </div>

        {/* Duration */}
        <div>
          <p className='text-11px text-t-secondary mb-4px'>
            {t('video.storyboard.detail.duration')}: {local.duration}
            {t('video.storyboard.detail.durationUnit')}
          </p>
          <Slider
            min={1}
            max={30}
            step={1}
            value={local.duration}
            onChange={(val) => setLocal((prev) => ({ ...prev, duration: val as number }))}
            onAfterChange={(val) => void save({ duration: val as number })}
          />
        </div>

        {/* Action */}
        <div>
          <p className='text-11px text-t-secondary mb-4px'>{t('video.storyboard.detail.action')}</p>
          <textarea
            className='w-full text-12px text-t-primary bg-bg-2 border border-border-1 rounded-4px px-8px py-6px resize-none focus:outline-none focus:border-brand-6'
            rows={2}
            value={local.action}
            onChange={(e) => setLocal((prev) => ({ ...prev, action: e.target.value }))}
            onBlur={(e) => handleFieldBlur('action', e.target.value)}
          />
        </div>

        {/* Dialogue */}
        <div>
          <p className='text-11px text-t-secondary mb-4px'>{t('video.storyboard.detail.dialogue')}</p>
          <textarea
            className='w-full text-12px text-t-primary bg-bg-2 border border-border-1 rounded-4px px-8px py-6px resize-none focus:outline-none focus:border-brand-6'
            rows={2}
            value={local.dialogue}
            onChange={(e) => setLocal((prev) => ({ ...prev, dialogue: e.target.value }))}
            onBlur={(e) => handleFieldBlur('dialogue', e.target.value)}
          />
        </div>

        {/* Image Prompt */}
        <div>
          <p className='text-11px text-t-secondary mb-4px'>
            {t('video.storyboard.detail.imagePrompt')}{' '}
            <span className='text-t-tertiary'>({t('video.storyboard.detail.saveHint')})</span>
          </p>
          <textarea
            ref={imagePromptRef}
            className='w-full text-12px text-t-primary bg-bg-2 border border-border-1 rounded-4px px-8px py-6px resize-none focus:outline-none focus:border-brand-6'
            rows={4}
            value={local.imagePrompt}
            onChange={(e) => setLocal((prev) => ({ ...prev, imagePrompt: e.target.value }))}
            onKeyDown={(e) => handlePromptKeyDown(e, 'imagePrompt')}
          />
        </div>

        {/* Video Prompt */}
        <div>
          <p className='text-11px text-t-secondary mb-4px'>
            {t('video.storyboard.detail.videoPrompt')}{' '}
            <span className='text-t-tertiary'>({t('video.storyboard.detail.saveHint')})</span>
          </p>
          <textarea
            ref={videoPromptRef}
            className='w-full text-12px text-t-primary bg-bg-2 border border-border-1 rounded-4px px-8px py-6px resize-none focus:outline-none focus:border-brand-6'
            rows={3}
            value={local.videoPrompt}
            onChange={(e) => setLocal((prev) => ({ ...prev, videoPrompt: e.target.value }))}
            onKeyDown={(e) => handlePromptKeyDown(e, 'videoPrompt')}
          />
        </div>

        {/* Locked Tokens */}
        {local.lockedTokens.length > 0 && (
          <div>
            <p className='text-11px text-t-secondary mb-4px'>{t('video.storyboard.detail.lockedTokens')}</p>
            <div className='flex flex-wrap gap-4px'>
              {local.lockedTokens.map((token) => (
                <Tag key={token} closable onClose={() => handleRemoveToken(token)} size='small'>
                  {token}
                </Tag>
              ))}
            </div>
          </div>
        )}

        {/* QA Issues */}
        {local.qaIssues && local.qaIssues.length > 0 && (
          <div>
            <p className='text-11px text-t-secondary mb-4px'>{t('video.storyboard.detail.qaIssues')}</p>
            <div className='flex flex-col gap-6px'>
              {local.qaIssues.map((issue, idx) => (
                <div key={idx} className='rounded-4px bg-bg-2 border border-border-1 p-8px'>
                  <p className={`text-11px font-medium mb-2px ${severityColor(issue.severity)}`}>{issue.type}</p>
                  <p className='text-11px text-t-secondary mb-4px'>{issue.description}</p>
                  {issue.suggestion && (
                    <Button
                      type='text'
                      size='mini'
                      className='text-brand-6 text-11px p-0'
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

        {/* Action buttons */}
        <div className='flex gap-8px pt-4px'>
          <Button
            size='small'
            type={local.locked ? 'primary' : 'outline'}
            onClick={handleToggleLock}
            loading={saving}
            className='flex-1'
          >
            {local.locked ? t('video.storyboard.detail.unlock') : t('video.storyboard.detail.lock')}
          </Button>
          <Button
            size='small'
            type='primary'
            onClick={handleRegenerate}
            disabled={!local.imagePrompt}
            className='flex-1'
          >
            {t('video.storyboard.detail.regenerate')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ShotDetailPanel;
