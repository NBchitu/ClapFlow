/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { Shot } from '@/common/types/videoCreation';
import { Drawer, Select, Slider } from '@arco-design/web-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toPreviewImageSrc } from './pathUtils';

interface VideoDetailPanelProps {
  shot?: Shot | null;
  visible?: boolean;
  projectRoot: string;
  onClose?: () => void;
}

const AI_MODEL_PROVIDERS = [
  { id: 'kling', name: 'KLING', icon: '🔥' },
  { id: 'seedance', name: 'Seedance', icon: '🌱' },
  { id: 'hailuo', name: 'Hailuo AI', icon: '🐚' },
  { id: 'luma', name: 'Luma', icon: '✨' },
];

const CAMERA_MOVE_OPTIONS: Array<{ label: string; value: Shot['cameraMove'] }> = [
  { label: 'Static', value: 'static' },
  { label: 'Push', value: 'push' },
  { label: 'Pull', value: 'pull' },
  { label: 'Pan', value: 'pan' },
  { label: 'Tilt', value: 'tilt' },
];

const VideoDetailPanel: React.FC<VideoDetailPanelProps> = ({ shot, visible = true, projectRoot, onClose }) => {
  const [local, setLocal] = useState<Shot | null>(shot || null);
  const [saving, setSaving] = useState(false);
  const imageCacheKey = `${local?.imagePath ?? ''}|${local?.imageHistory?.[0] ?? ''}|${local?.imageHistory?.length ?? 0}`;

  useEffect(() => {
    if (shot) setLocal(shot);
  }, [shot]);

  const save = useCallback(
    async (updates: Partial<Shot>) => {
      if (saving || !local) return;
      setSaving(true);
      try {
        await ipcBridge.videoCreation.updateShot.invoke({ projectRoot, shotId: local.id, updates });
        setLocal((prev) => (prev ? { ...prev, ...updates } : null));
      } finally {
        setSaving(false);
      }
    },
    [projectRoot, local?.id, saving]
  );

  return (
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
      <div className='flex h-full flex-col bg-[#FCFCFC] overflow-hidden'>
        {/* HEADER */}
        <div className='px-[28px] pt-[28px] pb-[16px] shrink-0 border-b border-gray-100 flex items-start justify-between'>
          <div className='flex flex-col'>
            <span className='text-[10px] font-extrabold tracking-[0.2em] text-gray-500 uppercase'>
              Video Generation
            </span>
            <span className='text-[26px] font-extrabold text-black mt-[4px] tracking-tight'>
              Shot {String(local?.shotIndex || 1).padStart(3, '0')}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className='p-[4px] hover:bg-gray-200 transition-colors rounded-lg text-gray-500 hover:text-black mt-[4px]'
            >
              <svg
                width='24'
                height='24'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <line x1='18' y1='6' x2='6' y2='18'></line>
                <line x1='6' y1='6' x2='18' y2='18'></line>
              </svg>
            </button>
          )}
        </div>

        <div className='flex flex-1 min-h-0 flex-col gap-[36px] overflow-y-auto overflow-x-hidden px-[28px] py-[24px]'>
          {/* VIDEO PREVIEW */}
          <div className='flex flex-col gap-[12px]'>
            <span className='text-[10px] font-extrabold tracking-widest text-gray-500 uppercase flex items-center gap-[6px]'>
              Video Preview
            </span>

            <div className='flex gap-[16px] h-[180px]'>
              <div className='flex flex-col gap-[12px] shrink-0 w-[110px]'>
                <div className='flex-1 border border-gray-300 rounded-[10px] bg-white relative overflow-hidden shadow-sm'>
                  {local?.imagePath ? (
                    <img
                      src={toPreviewImageSrc(local.imagePath, imageCacheKey)}
                      className='w-full h-full object-cover'
                      alt=''
                    />
                  ) : null}
                  <div className='absolute bottom-[6px] left-[6px] bg-black/80 rounded-[4px] px-[5px] py-[3px] text-[8px] font-bold text-white tracking-widest z-10'>
                    START
                  </div>
                </div>
                <div className='flex-1 border border-gray-300 border-dashed rounded-[10px] bg-[#F9F9F9] relative flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors'>
                  <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#9CA3AF' strokeWidth='2.5'>
                    <line x1='12' y1='5' x2='12' y2='19'></line>
                    <line x1='5' y1='12' x2='19' y2='12'></line>
                  </svg>
                  <div className='absolute bottom-[6px] left-[6px] bg-gray-500 rounded-[4px] px-[5px] py-[3px] text-[8px] font-bold text-white tracking-widest'>
                    END
                  </div>
                </div>
              </div>

              <div className='flex-1 border-[1.5px] border-gray-300 border-dashed rounded-[14px] bg-[#F9F9F9] flex flex-col items-center justify-center'>
                <svg
                  width='36'
                  height='36'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='#D1D5DB'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <polygon points='23 7 16 12 23 17 23 7'></polygon>
                  <rect x='1' y='5' width='15' height='14' rx='2' ry='2'></rect>
                </svg>
                <span className='text-[10px] font-bold text-gray-400 tracking-widest mt-[12px] uppercase'>
                  Preview Placeholder
                </span>
              </div>
            </div>
          </div>

          {/* VIDEO PROMPT */}
          <div className='flex flex-col gap-[12px]'>
            <div className='flex items-center gap-[6px] text-[11px] font-extrabold tracking-widest text-black uppercase'>
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                <polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'></polygon>
              </svg>
              Video Prompt
            </div>
            <textarea
              className='h-[110px] w-full box-border resize-none rounded-[10px] border border-gray-300 bg-[#F9F9F9] p-[16px] text-[13px] font-medium text-black transition-all focus:border-[#D9FF00] focus:outline-none focus:ring-1 focus:ring-[#D9FF00]'
              value={local?.videoPrompt || ''}
              onChange={(e) => setLocal((prev) => (prev ? { ...prev, videoPrompt: e.target.value } : null))}
              onBlur={(e) => save({ videoPrompt: e.target.value })}
            />
          </div>

          {/* CINEMATIC MOVEMENT */}
          <div className='flex flex-col gap-[16px]'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-[6px] text-[11px] font-extrabold tracking-widest text-gray-500 uppercase'>
                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                  <circle cx='12' cy='12' r='10'></circle>
                  <line x1='2' y1='12' x2='22' y2='12'></line>
                  <path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'></path>
                </svg>
                Cinematic Movement
              </div>
              <div className='text-[10px] font-bold text-black flex items-center gap-[4px] cursor-pointer'>
                <svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                  <polyline points='6 9 12 15 18 9'></polyline>
                </svg>
                More
              </div>
            </div>

            <div className='flex flex-wrap gap-[10px]'>
              {CAMERA_MOVE_OPTIONS.map((move) => {
                const isSelected = move.value === (local?.cameraMove || 'static');
                return (
                  <button
                    key={move.value}
                    className={`px-[22px] py-[10px] rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-colors border ${
                      isSelected
                        ? 'bg-[#FCFFCF] text-black border-[#D9FF00]'
                        : 'bg-[#F9F9F9] text-gray-500 border-gray-300 hover:bg-gray-200'
                    }`}
                    onClick={() => save({ cameraMove: move.value })}
                  >
                    {move.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI MODEL PROVIDER */}
          <div className='flex flex-col gap-[16px]'>
            <div className='flex items-center gap-[6px] text-[11px] font-extrabold tracking-widest text-gray-500 uppercase'>
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                <path d='M12 2L2 7l10 5 10-5-10-5z'></path>
                <path d='M2 17l10 5 10-5'></path>
                <path d='M2 12l10 5 10-5'></path>
              </svg>
              AI Model Provider
            </div>

            <div className='grid grid-cols-4 gap-[8px]'>
              {AI_MODEL_PROVIDERS.map((provider) => {
                // Mock selected provider directly from the design image
                const isSelected = provider.id === 'luma';
                return (
                  <button
                    key={provider.id}
                    className={`flex flex-col items-center justify-center gap-[6px] py-[16px] rounded-[8px] border transition-colors ${
                      isSelected ? 'bg-[#FCFFCF] border-[#D9FF00]' : 'bg-[#F9F9F9] border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    <span className='text-[18px]'>{provider.icon}</span>
                    <span className='text-[9px] font-bold text-black tracking-widest uppercase'>{provider.name}</span>
                  </button>
                );
              })}
            </div>

            <div className='mt-[6px] flex flex-col gap-[8px]'>
              <label className='text-[9px] font-extrabold tracking-widest text-gray-500 uppercase'>
                Specific Model Version
              </label>
              <Select
                defaultValue='v1.0'
                className='w-full !rounded-[8px] !h-[36px] !bg-white border !border-gray-300 hover:!border-gray-400 font-medium'
              >
                <Select.Option value='v1.0'>Dream Machine v1.0</Select.Option>
                <Select.Option value='v1.5'>Dream Machine v1.5</Select.Option>
              </Select>
            </div>
          </div>

          {/* MOTION INTENSITY */}
          <div className='flex flex-col gap-[16px] p-[20px] pb-[24px] rounded-[12px] border border-gray-300 bg-[#F9F9F9]'>
            <div className='text-[10px] font-extrabold tracking-widest text-gray-500 uppercase'>Motion Intensity</div>
            <div className='px-[8px] mt-[4px] relative'>
              {/* Base line black thick */}
              <div className='absolute top-1/2 left-[8px] right-[8px] h-[4px] -translate-y-1/2 bg-black rounded-full pointer-events-none' />
              <Slider
                defaultValue={30}
                className='[&_.arco-slider-bar]:bg-transparent [&_.arco-slider-track::before]:hidden [&_.arco-slider-button]:!border-[#D9FF00] [&_.arco-slider-button]:!bg-[#D9FF00] [&_.arco-slider-button]:!w-[16px] [&_.arco-slider-button]:!h-[16px] [&_.arco-slider-button]:hover:!scale-110'
              />
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className='shrink-0 bg-gradient-to-t from-white via-white to-transparent px-[28px] pt-[16px] pb-[28px]'>
          <button className='flex h-[52px] w-full items-center justify-center gap-[8px] rounded-[10px] bg-[#D9FF00] text-[13px] font-extrabold tracking-wider text-black uppercase shadow-sm transition-colors hover:bg-[#cbf000]'>
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
              <polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'></polygon>
            </svg>
            Generate AI Video
          </button>
        </div>
      </div>
    </Drawer>
  );
};

export default VideoDetailPanel;
