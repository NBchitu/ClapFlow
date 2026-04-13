/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { GetAssetsResult, Shot } from '@/common/types/videoCreation';
import { Button, Drawer, Image, Slider } from '@arco-design/web-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toPreviewImageSrc } from './pathUtils';

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
  shot?: Shot | null;
  visible?: boolean;
  projectRoot: string;
  onClose?: () => void;
  mode?: 'sidebar' | 'full';
}

const ShotDetailPanel: React.FC<ShotDetailPanelProps> = ({
  shot,
  visible = true,
  projectRoot,
  onClose,
  mode = 'sidebar',
}) => {
  const { t } = useTranslation();
  const [local, setLocal] = useState<Shot | null>(shot || null);
  const [saving, setSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState(0);
  const [assets, setAssets] = useState<GetAssetsResult>({ characters: [], scenes: [], props: [] });
  const imagePromptRef = useRef<HTMLTextAreaElement>(null);
  const videoPromptRef = useRef<HTMLTextAreaElement>(null);
  const regenTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (shot) {
      setLocal(shot);
      setIsRegenerating(shot.status === 'image-generating');
      setRegenProgress(shot.status === 'image-generating' ? 8 : 0);
    }
  }, [shot]);

  const loadAssets = useCallback(async () => {
    if (!projectRoot) return;
    try {
      const nextAssets = await ipcBridge.videoCreation.getAssets.invoke({ projectRoot });
      setAssets(nextAssets);
    } catch {
      // Ignore asset loading errors in panel
    }
  }, [projectRoot]);

  useEffect(() => {
    if (!visible) return;
    void loadAssets();
  }, [loadAssets, visible]);

  useEffect(() => {
    const onAssetsUpdated = () => {
      if (!visible) return;
      void loadAssets();
    };
    window.addEventListener('storyboard-assets-updated', onAssetsUpdated);
    return () => window.removeEventListener('storyboard-assets-updated', onAssetsUpdated);
  }, [loadAssets, visible]);

  useEffect(() => {
    if (!local) return;
    if (local.status === 'image-generating') {
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
  }, [local?.status, isRegenerating]);

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
      if (saving || !local) return;
      setSaving(true);
      try {
        await ipcBridge.videoCreation.updateShot.invoke({ projectRoot, shotId: local.id, updates });
      } finally {
        setSaving(false);
      }
    },
    [projectRoot, local?.id, saving]
  );

  const handleFieldBlur = useCallback(
    (field: keyof Shot, value: unknown) => {
      if (!local) return;
      if (value !== local[field]) {
        void save({ [field]: value } as Partial<Shot>);
      }
    },
    [save, local]
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

  const handleToggleLock = useCallback(() => {
    if (!local) return;
    setLocal((prev) => (prev ? { ...prev, locked: !prev.locked } : prev));
    void save({ locked: !local.locked });
  }, [save, local]);

  const handleRegenerate = useCallback(() => {
    if (!local) return;
    setIsRegenerating(true);
    setRegenProgress(8);
    setLocal((prev) => (prev ? { ...prev, status: 'image-generating' } : prev));
    void (async () => {
      try {
        await ipcBridge.videoCreation.updateShot.invoke({
          projectRoot,
          shotId: local.id,
          updates: { status: 'prompts-ready' },
        });
        await ipcBridge.videoCreation.generateShotImages.invoke({
          projectRoot,
          shotIds: [local.id],
        });
      } catch {
        setIsRegenerating(false);
        setRegenProgress(0);
      }
    })();
  }, [projectRoot, local]);

  const showGeneratingSpin = isRegenerating || local?.status === 'image-generating';
  const isSidebarMode = mode === 'sidebar';
  const allAssets = useMemo(
    () => [...assets.characters, ...assets.scenes, ...assets.props],
    [assets.characters, assets.props, assets.scenes]
  );
  const boundAssetIds = useMemo(() => new Set(local?.assetRefs ?? []), [local?.assetRefs]);
  const boundAssets = useMemo(
    () => allAssets.filter((asset) => boundAssetIds.has(asset.id)),
    [allAssets, boundAssetIds]
  );
  const unboundAssets = useMemo(
    () => allAssets.filter((asset) => !boundAssetIds.has(asset.id)),
    [allAssets, boundAssetIds]
  );
  const appliedReferenceCount = local?.appliedReferenceCount ?? local?.assetRefs?.length ?? 0;
  const shotImageCacheKey = `${local?.imagePath ?? ''}|${local?.imageHistory?.[0] ?? ''}|${local?.imageHistory?.length ?? 0}`;

  const bindAssetToShot = useCallback(
    async (assetId: string) => {
      if (!local) return;
      try {
        await ipcBridge.videoCreation.applyAssetsToShots.invoke({
          projectRoot,
          assetIds: [assetId],
          shotIds: [local.id],
        });
        const nextRefs = [...new Set([...(local.assetRefs ?? []), assetId])];
        setLocal((prev) => (prev ? { ...prev, assetRefs: nextRefs } : prev));
      } catch {
        // noop
      }
    },
    [local, projectRoot]
  );

  const unbindAssetFromShot = useCallback(
    async (assetId: string) => {
      if (!local) return;
      try {
        await ipcBridge.videoCreation.removeAssetsFromShots.invoke({
          projectRoot,
          assetIds: [assetId],
          shotIds: [local.id],
        });
        const nextRefs = (local.assetRefs ?? []).filter((id) => id !== assetId);
        setLocal((prev) => (prev ? { ...prev, assetRefs: nextRefs } : prev));
      } catch {
        // noop
      }
    },
    [local, projectRoot]
  );

  if (!local) return null;

  const content = (
    <div className='flex flex-col h-full bg-[#FAFAFA] text-black overflow-y-auto overflow-x-hidden p-[24px]'>
      <div className='flex items-start justify-between mb-[24px] shrink-0'>
        <div>
          <div className='text-[10px] font-bold tracking-[0.2em] text-gray-500 uppercase mb-[4px]'>SHOT DETAILS</div>
          <div className='text-[24px] font-extrabold text-[#111] leading-tight'>
            Shot {String(local.shotIndex).padStart(3, '0')}
          </div>
        </div>
        {isSidebarMode && onClose && (
          <button
            onClick={onClose}
            className='p-1 hover:bg-gray-200 transition-colors rounded-lg text-gray-500 hover:text-black mt-[4px]'
          >
            <svg
              width='20'
              height='20'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <line x1='18' y1='6' x2='6' y2='18'></line>
              <line x1='6' y1='6' x2='18' y2='18'></line>
            </svg>
          </button>
        )}
      </div>

      <div className='relative w-full aspect-[16/9] rounded-[16px] border border-black overflow-hidden bg-black mb-[24px] shrink-0'>
        {local.imagePath ? (
          <div className='w-full h-full'>
            <Image
              src={toPreviewImageSrc(local.imagePath, shotImageCacheKey)}
              alt={local.goal}
              preview
              previewProps={{
                actionsLayout: ['zoomIn', 'zoomOut', 'originalSize', 'rotateLeft', 'rotateRight'],
              }}
              className='w-full h-full [&_.arco-image-img]:w-full [&_.arco-image-img]:h-full [&_.arco-image-img]:object-cover'
            />
          </div>
        ) : (
          <div className='flex items-center justify-center w-full h-full'>
            <span className='text-[11px] text-gray-500 tracking-[0.1em] font-bold'>
              {t('video.storyboard.detail.noImage')}
            </span>
          </div>
        )}

        {showGeneratingSpin && (
          <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/60 pointer-events-none backdrop-blur-sm z-10'>
            <MechanicalSpinner size={40} />
            <div className='mt-[16px] w-[60%] h-[4px] bg-gray-800 rounded-full overflow-hidden'>
              <div
                className='h-full bg-[#D9FF00] transition-all duration-200'
                style={{ width: `${Math.max(8, regenProgress)}%` }}
              />
            </div>
            {appliedReferenceCount > 0 ? (
              <div className='mt-[8px] text-[11px] font-bold text-[#D9FF00]'>
                Applying {appliedReferenceCount} refs…
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className='grid grid-cols-2 gap-[12px] mb-[32px] shrink-0'>
        <button
          onClick={handleToggleLock}
          disabled={saving}
          className='flex items-center justify-center gap-[8px] h-[48px] rounded-[10px] border-[1.5px] border-black bg-[#F1F2F4] text-black font-extrabold tracking-wider text-[12px] hover:bg-gray-200 transition-colors disabled:opacity-50'
        >
          {local.locked ? (
            <svg
              width='14'
              height='14'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <rect x='3' y='11' width='18' height='11' rx='2' ry='2'></rect>
              <path d='M7 11V7a5 5 0 0 1 10 0v4'></path>
            </svg>
          ) : (
            <svg
              width='14'
              height='14'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <rect x='3' y='11' width='18' height='11' rx='2' ry='2'></rect>
              <path d='M7 11V7a5 5 0 0 1 9.9-1'></path>
            </svg>
          )}
          {local.locked ? 'UNLOCK SHOT' : 'LOCK SHOT'}
        </button>
        <button
          onClick={handleRegenerate}
          disabled={!local.imagePrompt || showGeneratingSpin}
          className='flex items-center justify-center gap-[8px] h-[48px] rounded-[10px] bg-[#D9FF00] text-black font-extrabold tracking-wider text-[12px] hover:bg-[#cbf000] focus:outline-none transition-colors disabled:opacity-50'
        >
          <svg
            width='14'
            height='14'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2.5'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'></polygon>
          </svg>
          GENERATE
        </button>
      </div>

      <div className='mb-[24px] shrink-0'>
        <div className='flex items-center gap-[8px] text-gray-500 font-bold tracking-[0.15em] text-[10px] mb-[12px] uppercase'>
          <svg
            width='14'
            height='14'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2.5'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <path d='M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z'></path>
            <circle cx='12' cy='13' r='4'></circle>
          </svg>
          SHOT TYPE
        </div>
        <div className='grid grid-cols-3 gap-[8px]'>
          {[
            { label: 'WIDE', match: ['WS', 'EWS'] },
            { label: 'MEDIUM', match: ['MS'] },
            { label: 'CLOSE UP', match: ['CU', 'ECU'] },
          ].map((btn) => {
            const isActive = btn.match.includes(local.shotType);
            return (
              <button
                key={btn.label}
                onClick={() => {
                  const val = btn.match[0] as Shot['shotType'];
                  setLocal((prev) => (prev ? { ...prev, shotType: val } : prev));
                  void save({ shotType: val });
                }}
                className={`h-[40px] rounded-[8px] border-[1.5px] font-extrabold tracking-wider text-[11px] transition-colors focus:outline-none ${
                  isActive
                    ? 'border-[#D9FF00] bg-white shadow-[0_0_0_1px_#D9FF00]'
                    : 'border-black bg-[#F1F2F4] hover:bg-gray-200'
                }`}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className='mb-[24px] shrink-0'>
        <div className='flex items-center gap-[8px] text-gray-500 font-bold tracking-[0.15em] text-[10px] mb-[12px] uppercase'>
          <svg
            width='14'
            height='14'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2.5'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <line x1='12' y1='5' x2='12' y2='19'></line>
            <line x1='5' y1='12' x2='19' y2='12'></line>
          </svg>
          CAMERA MOVEMENT
        </div>
        <select
          value={local.cameraMove}
          onChange={(e) => {
            const val = e.target.value as Shot['cameraMove'];
            setLocal((prev) => (prev ? { ...prev, cameraMove: val } : prev));
            void save({ cameraMove: val });
          }}
          className='h-[48px] w-full box-border appearance-none rounded-[10px] border-[1.5px] border-black bg-[#F1F2F4] px-[16px] text-[13px] font-semibold text-black outline-none transition-colors focus:border-[#D9FF00]'
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 14px center',
            backgroundSize: '16px',
          }}
        >
          {CAMERA_MOVE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className='mb-[32px] shrink-0'>
        <div className='flex items-center gap-[8px] text-gray-500 font-bold tracking-[0.15em] text-[10px] mb-[16px] uppercase'>
          <svg
            width='14'
            height='14'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2.5'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <circle cx='12' cy='12' r='10'></circle>
            <polyline points='12 6 12 12 16 14'></polyline>
          </svg>
          DURATION ({local.duration}S)
        </div>
        <Slider
          min={1}
          max={30}
          step={1}
          value={local.duration}
          className='[&_.arco-slider-road]:!h-[4px] [&_.arco-slider-road]:!bg-gray-300 [&_.arco-slider-bar]:!h-[4px] [&_.arco-slider-bar]:!bg-black [&_.arco-slider-button]:!w-[16px] [&_.arco-slider-button]:!h-[16px] [&_.arco-slider-button]:!rounded-full [&_.arco-slider-button]:!border-[2.5px] [&_.arco-slider-button]:!border-black [&_.arco-slider-button]:!bg-white'
          onChange={(val) => setLocal((prev) => (prev ? { ...prev, duration: val as number } : prev))}
          onAfterChange={(val) => void save({ duration: val as number })}
        />
      </div>

      {/* Advanced Text fields */}
      <div className='space-y-[16px] shrink-0'>
        <div>
          <label className='block text-gray-500 font-bold tracking-[0.15em] text-[10px] mb-[8px] uppercase'>GOAL</label>
          <textarea
            className='w-full box-border rounded-[10px] border-[1.5px] border-black bg-[#F1F2F4] p-[12px] text-[12px] font-semibold text-black outline-none transition-colors resize-none focus:border-[#D9FF00] focus:bg-white'
            rows={2}
            value={local.goal}
            onChange={(e) => setLocal((prev) => (prev ? { ...prev, goal: e.target.value } : prev))}
            onBlur={(e) => handleFieldBlur('goal', e.target.value)}
          />
        </div>
        <div>
          <label className='block text-gray-500 font-bold tracking-[0.15em] text-[10px] mb-[8px] uppercase'>
            IMAGE PROMPT
          </label>
          <textarea
            ref={imagePromptRef}
            className='w-full box-border rounded-[10px] border-[1.5px] border-black bg-[#F1F2F4] p-[12px] text-[12px] font-semibold text-black outline-none transition-colors resize-vertical focus:border-[#D9FF00] focus:bg-white'
            rows={3}
            value={local.imagePrompt}
            onChange={(e) => setLocal((prev) => (prev ? { ...prev, imagePrompt: e.target.value } : prev))}
            onKeyDown={(e) => handlePromptKeyDown(e, 'imagePrompt')}
            onBlur={(e) => handleFieldBlur('imagePrompt', e.target.value)}
          />
        </div>
        <div>
          <label className='block text-gray-500 font-bold tracking-[0.15em] text-[10px] mb-[8px] uppercase'>
            VIDEO PROMPT
          </label>
          <textarea
            ref={videoPromptRef}
            className='w-full box-border rounded-[10px] border-[1.5px] border-black bg-[#F1F2F4] p-[12px] text-[12px] font-semibold text-black outline-none transition-colors resize-vertical focus:border-[#D9FF00] focus:bg-white'
            rows={3}
            value={local.videoPrompt}
            onChange={(e) => setLocal((prev) => (prev ? { ...prev, videoPrompt: e.target.value } : prev))}
            onKeyDown={(e) => handlePromptKeyDown(e, 'videoPrompt')}
            onBlur={(e) => handleFieldBlur('videoPrompt', e.target.value)}
          />
        </div>
      </div>

      <div className='mt-[20px] shrink-0 rounded-[10px] border-[1.5px] border-black bg-white p-[12px]'>
        <div className='flex items-center justify-between mb-[8px]'>
          <label className='block text-gray-500 font-bold tracking-[0.15em] text-[10px] uppercase'>REFERENCES</label>
          <span className='text-[10px] font-bold text-black'>#{local.assetRefs?.length ?? 0}</span>
        </div>

        {boundAssets.length > 0 ? (
          <div className='space-y-[8px] mb-[10px]'>
            {boundAssets.map((asset) => (
              <div
                key={asset.id}
                className='flex items-center gap-[8px] rounded-[8px] border border-black/20 bg-[#F7F7F7] p-[6px]'
              >
                <div className='w-[40px] h-[24px] overflow-hidden rounded-[4px] border border-black/30 bg-white'>
                  {asset.primaryReferenceImagePath || asset.referenceImagePaths?.[0] ? (
                    <img
                      src={toPreviewImageSrc(
                        asset.primaryReferenceImagePath || asset.referenceImagePaths?.[0],
                        `${asset.id}|${asset.primaryReferenceImagePath ?? ''}|${asset.referenceImagePaths?.[0] ?? ''}|${asset.referenceImagePaths?.length ?? 0}`
                      )}
                      alt={asset.name}
                      className='w-full h-full object-cover'
                    />
                  ) : (
                    <div className='w-full h-full flex items-center justify-center text-[9px] text-gray-500'>
                      No Ref
                    </div>
                  )}
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='text-[11px] font-bold text-black truncate'>{asset.name}</div>
                </div>
                <Button
                  size='mini'
                  type='text'
                  className='!h-[22px] !px-[6px] !text-[10px] !font-bold !border !border-black/20 !rounded-[6px]'
                  onClick={() => void unbindAssetFromShot(asset.id)}
                >
                  Unbind
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className='text-[11px] text-gray-500 mb-[10px]'>No references bound.</div>
        )}

        {unboundAssets.length > 0 ? (
          <div className='flex flex-wrap gap-[6px]'>
            {unboundAssets.slice(0, 12).map((asset) => (
              <Button
                key={asset.id}
                size='mini'
                type='text'
                className='!h-[24px] !px-[8px] !text-[10px] !font-bold !border !border-black/20 !rounded-[6px]'
                onClick={() => void bindAssetToShot(asset.id)}
              >
                + {asset.name}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );

  return isSidebarMode ? (
    <Drawer
      visible={visible}
      placement='right'
      width={420}
      title={null}
      closable={false}
      onCancel={onClose}
      footer={null}
      className='[&_.arco-drawer-body]:!p-0 [&_.arco-drawer-header]:!hidden'
    >
      {content}
    </Drawer>
  ) : (
    <div className='flex h-full w-full flex-col overflow-hidden'>{content}</div>
  );
};

export default ShotDetailPanel;
