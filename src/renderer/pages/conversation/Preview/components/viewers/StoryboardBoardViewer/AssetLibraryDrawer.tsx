/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { AssetType, CharacterAsset, GetAssetsResult, PropAsset, SceneAsset } from '@/common/types/videoCreation';
import { Drawer, Select } from '@arco-design/web-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toPreviewImageSrc } from './pathUtils';

type AnyAsset = CharacterAsset | SceneAsset | PropAsset;

interface AssetLibraryDrawerProps {
  visible: boolean;
  projectRoot: string;
  selectedShotIds: Set<string>;
  onClose: () => void;
}

const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }];

function MechanicalSpinner({ size = 34 }: { size?: number }) {
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

function buildAssetPayload(
  type: AssetType,
  form: { name: string; prompt: string; tags: string },
  baseAsset?: AnyAsset | null
): Partial<CharacterAsset | SceneAsset | PropAsset> {
  const basePayload = {
    name: form.name.trim(),
    description: form.prompt.trim(),
    prompt: form.prompt.trim(),
    referenceImagePaths: baseAsset?.referenceImagePaths ?? [],
    primaryReferenceImagePath: baseAsset?.primaryReferenceImagePath,
  };
  if (type === 'character') {
    return {
      ...basePayload,
      appearance: form.prompt.trim(),
      lockedTokens: form.tags
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean),
    } as Partial<CharacterAsset>;
  }
  return basePayload as Partial<SceneAsset | PropAsset>;
}

const AssetLibraryDrawer: React.FC<AssetLibraryDrawerProps> = ({
  visible,
  projectRoot,
  selectedShotIds: _selectedShotIds,
  onClose: _onClose,
}) => {
  const [assets, setAssets] = useState<GetAssetsResult>({ characters: [], scenes: [], props: [] });
  const [activeTab, setActiveTab] = useState<AssetType>('character');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewIndexByAssetId, setPreviewIndexByAssetId] = useState<Record<string, number>>({});
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [isGeneratingReference, setIsGeneratingReference] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const generationTickRef = useRef<number | null>(null);

  // Editing state
  const [editingAsset, setEditingAsset] = useState<AnyAsset | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    style: 'Anime / Manga',
    prompt: '',
    aspectRatio: '1:1',
    tags: '',
  });

  const loadAssets = useCallback(async () => {
    if (!projectRoot) return;
    try {
      const result = await ipcBridge.videoCreation.getAssets.invoke({ projectRoot });
      setAssets(result);
    } catch {
      // Silently ignore
    }
  }, [projectRoot]);

  const emitAssetsUpdated = useCallback(() => {
    window.dispatchEvent(new Event('storyboard-assets-updated'));
  }, []);

  useEffect(() => {
    if (visible) void loadAssets();
  }, [visible, loadAssets]);

  useEffect(() => {
    if (!isGeneratingReference) {
      if (generationTickRef.current !== null) {
        window.clearInterval(generationTickRef.current);
        generationTickRef.current = null;
      }
      return;
    }

    generationTickRef.current = window.setInterval(() => {
      setGenerationProgress((prev) => Math.min(92, prev + Math.max(1, Math.round((100 - prev) * 0.08))));
    }, 220);

    return () => {
      if (generationTickRef.current !== null) {
        window.clearInterval(generationTickRef.current);
        generationTickRef.current = null;
      }
    };
  }, [isGeneratingReference]);

  const patchAssetInState = useCallback((type: AssetType, nextAsset: AnyAsset) => {
    setAssets((prev) => {
      const key = type === 'character' ? 'characters' : type === 'scene' ? 'scenes' : 'props';
      return {
        ...prev,
        [key]: (prev[key] as AnyAsset[]).map((asset) => (asset.id === nextAsset.id ? nextAsset : asset)),
      } as GetAssetsResult;
    });
  }, []);

  const handleSaveAsset = async (generateReference: boolean) => {
    if (!form.name.trim() || isSavingAsset) return;
    setIsSavingAsset(true);
    try {
      let targetAsset: AnyAsset | null = null;
      const payload = buildAssetPayload(activeTab, form, editingAsset);
      if (isCreating) {
        targetAsset = (await ipcBridge.videoCreation.createAsset.invoke({
          projectRoot,
          type: activeTab,
          data: payload,
        })) as AnyAsset;
      } else if (editingAsset) {
        await ipcBridge.videoCreation.updateAsset.invoke({
          projectRoot,
          type: activeTab,
          id: editingAsset.id,
          data: payload,
        });
        targetAsset = { ...editingAsset, ...payload } as AnyAsset;
      }
      if (!targetAsset) return;

      if (generateReference) {
        setIsGeneratingReference(true);
        setGenerationProgress(8);
        try {
          targetAsset = (await ipcBridge.videoCreation.generateAssetThreeViewReference.invoke({
            projectRoot,
            type: activeTab,
            id: targetAsset.id,
          })) as AnyAsset;
          setGenerationProgress(100);
          if (!isCreating) {
            patchAssetInState(activeTab, targetAsset);
          }
        } catch {
          // Ignore generation failure, keep saved asset data.
        } finally {
          setIsGeneratingReference(false);
          setGenerationProgress(0);
        }
      }

      setEditingAsset(null);
      setIsCreating(false);
      await loadAssets();
      emitAssetsUpdated();
    } catch {
      // Ignore save errors in drawer
    } finally {
      setIsSavingAsset(false);
    }
  };

  const handleDeleteAsset = useCallback(
    async (type: AssetType, id: string) => {
      await ipcBridge.videoCreation.deleteAsset.invoke({ projectRoot, type, id });
      await loadAssets();
      emitAssetsUpdated();
    },
    [emitAssetsUpdated, loadAssets, projectRoot]
  );

  const handleUploadRefs = async () => {
    if (!editingAsset) return;
    try {
      const selected = await ipcBridge.dialog.showOpen.invoke({
        properties: ['openFile', 'multiSelections'],
        filters: IMAGE_FILTERS,
      });
      if (!selected || selected.length === 0) return;
      const updated = await ipcBridge.videoCreation.addAssetReferenceImages.invoke({
        projectRoot,
        type: activeTab,
        id: editingAsset.id,
        sourcePaths: selected,
      });
      patchAssetInState(activeTab, updated);
      setEditingAsset(updated);
      emitAssetsUpdated();
    } catch {}
  };

  const currentList =
    activeTab === 'character' ? assets.characters : activeTab === 'scene' ? assets.scenes : assets.props;
  const filteredList = currentList.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const cardStyleLabel =
    activeTab === 'character' ? 'ANIME / MANGA' : activeTab === 'scene' ? 'SET DESIGN' : 'PROP DESIGN';

  const getPreviewIndex = useCallback(
    (asset: AnyAsset) => {
      const refs = asset.referenceImagePaths ?? [];
      if (refs.length === 0) return 0;
      const index = previewIndexByAssetId[asset.id] ?? 0;
      return Math.max(0, Math.min(index, refs.length - 1));
    },
    [previewIndexByAssetId]
  );

  const openNewModal = () => {
    setIsCreating(true);
    setForm({ name: '', style: 'Anime / Manga', prompt: '', aspectRatio: '1:1', tags: '' });
  };

  const openEditModal = (asset: AnyAsset) => {
    setEditingAsset(asset);
    setIsCreating(false);
    const tags = 'lockedTokens' in asset ? asset.lockedTokens.join(', ') : '';
    setForm({
      name: asset.name,
      style: 'Anime / Manga',
      prompt: ('appearance' in asset ? asset.appearance : asset.description) || '',
      aspectRatio: '1:1',
      tags,
    });
  };

  if (!visible) return null;

  return (
    <>
      <div
        className='absolute inset-0 z-10 flex flex-col overflow-y-auto overflow-x-hidden px-[24px] pt-[8px] pb-[20px] md:px-[28px] md:pb-[28px]'
        style={{
          backgroundColor: '#f8f9fa',
          backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.09) 0.7px, transparent 0.7px)',
          backgroundSize: '14px 14px',
        }}
      >
        {/* HEADER ROW */}
        <div className='mb-[14px] flex items-start justify-between shrink-0'>
          <div className='flex flex-wrap items-center gap-[8px]'>
            <div className='relative'>
              <span className='absolute left-[12px] top-1/2 -translate-y-1/2 text-gray-400'>
                <svg
                  width='12'
                  height='12'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2.5'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <circle cx='11' cy='11' r='8'></circle>
                  <line x1='21' y1='21' x2='16.65' y2='16.65'></line>
                </svg>
              </span>
              <input
                className='h-[34px] w-[320px] rounded-full border border-black/60 bg-white/90 pl-[34px] pr-[14px] text-[11px] font-medium outline-none transition-colors focus:border-[#D9FF00] focus:bg-white md:w-[360px]'
                placeholder='Search assets...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className='flex h-[34px] items-center rounded-full border border-black/50 bg-white px-[3px]'>
              <button className='flex h-[26px] w-[26px] items-center justify-center rounded-[6px] bg-[#D9FF00]'>
                <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='black' strokeWidth='2.5'>
                  <rect x='3' y='3' width='7' height='7'></rect>
                  <rect x='14' y='3' width='7' height='7'></rect>
                  <rect x='14' y='14' width='7' height='7'></rect>
                  <rect x='3' y='14' width='7' height='7'></rect>
                </svg>
              </button>
              <button className='flex h-[26px] w-[26px] items-center justify-center rounded-[6px] text-gray-400 hover:text-black'>
                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                  <line x1='8' y1='6' x2='21' y2='6'></line>
                  <line x1='8' y1='12' x2='21' y2='12'></line>
                  <line x1='8' y1='18' x2='21' y2='18'></line>
                  <line x1='3' y1='6' x2='3.01' y2='6'></line>
                  <line x1='3' y1='12' x2='3.01' y2='12'></line>
                  <line x1='3' y1='18' x2='3.01' y2='18'></line>
                </svg>
              </button>
            </div>
            <button
              onClick={openNewModal}
              className='flex h-[36px] items-center justify-center gap-[6px] rounded-[6px] bg-[#D9FF00] px-[16px] text-[11px] font-bold tracking-[0.1em] text-black uppercase transition-colors hover:bg-[#cbf000]'
            >
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.8'>
                <line x1='12' y1='5' x2='12' y2='19'></line>
                <line x1='5' y1='12' x2='19' y2='12'></line>
              </svg>
              NEW ASSET
            </button>
          </div>
        </div>
        {/* TABS */}
        <div className='mb-[14px] flex flex-wrap items-center gap-[8px]'>
          <button
            onClick={() => setActiveTab('character')}
            className={`flex h-[32px] items-center gap-[5px] rounded-[6px] border border-black/80 px-[12px] text-[10px] font-bold tracking-[0.1em] uppercase transition-colors ${
              activeTab === 'character' ? 'bg-[#D9FF00] text-black' : 'bg-white/70 text-gray-700 hover:bg-white'
            }`}
          >
            <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
              <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'></path>
              <circle cx='12' cy='7' r='4'></circle>
            </svg>
            Characters
          </button>
          <button
            onClick={() => setActiveTab('scene')}
            className={`flex h-[32px] items-center gap-[5px] rounded-[6px] border border-black/80 px-[12px] text-[10px] font-bold tracking-[0.1em] uppercase transition-colors ${
              activeTab === 'scene' ? 'bg-[#D9FF00] text-black' : 'bg-white/70 text-gray-700 hover:bg-white'
            }`}
          >
            <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
              <rect x='3' y='3' width='18' height='18' rx='2' ry='2'></rect>
              <line x1='3' y1='9' x2='21' y2='9'></line>
              <line x1='9' y1='21' x2='9' y2='9'></line>
            </svg>
            Sets
          </button>
          <button
            onClick={() => setActiveTab('prop')}
            className={`flex h-[32px] items-center gap-[5px] rounded-[6px] border border-black/80 px-[12px] text-[10px] font-bold tracking-[0.1em] uppercase transition-colors ${
              activeTab === 'prop' ? 'bg-[#D9FF00] text-black' : 'bg-white/70 text-gray-700 hover:bg-white'
            }`}
          >
            <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
              <polygon points='12 2 2 7 12 12 22 7 12 2'></polygon>
              <polyline points='2 17 12 22 22 17'></polyline>
              <polyline points='2 12 12 17 22 12'></polyline>
            </svg>
            Props
          </button>
        </div>

        {/* GRID */}
        {filteredList.length === 0 ? (
          <div className='flex flex-1 items-center justify-center text-[12px] font-semibold tracking-[0.1em] text-gray-500 uppercase'>
            No Assets Found
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-[12px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {filteredList.map((asset) => {
              const refs = asset.referenceImagePaths ?? [];
              const previewIndex = getPreviewIndex(asset);
              const previewPath = refs[previewIndex];
              return (
                <div
                  key={asset.id}
                  className='group flex h-[222px] cursor-pointer flex-col overflow-hidden rounded-[6px] border border-black/20 bg-white transition-colors hover:border-black/45'
                  onClick={() => openEditModal(asset)}
                >
                  <div className='relative h-[156px] overflow-hidden border-b border-black/10 bg-[#eef1f3]'>
                    {refs.length === 0 ? (
                      <div className='flex h-full w-full flex-col items-center justify-center text-gray-500'>
                        <span className='mb-[8px] inline-flex h-[30px] w-[30px] items-center justify-center rounded-full border border-black/25 bg-white'>
                          <svg
                            width='16'
                            height='16'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2'
                          >
                            <rect x='3' y='3' width='18' height='18' rx='2' ry='2'></rect>
                            <circle cx='8.5' cy='8.5' r='1.5'></circle>
                            <polyline points='21 15 16 10 5 21'></polyline>
                          </svg>
                        </span>
                        <span className='text-[9px] font-semibold tracking-[0.1em] uppercase'>No Reference</span>
                      </div>
                    ) : (
                      <>
                        {previewPath ? (
                          <img
                            src={toPreviewImageSrc(
                              previewPath,
                              `${asset.id}|${previewPath}|${asset.referenceImagePaths?.length ?? 0}`
                            )}
                            className='h-full w-full object-cover'
                            alt={asset.name}
                          />
                        ) : null}
                        {refs.length > 1 ? (
                          <div className='absolute right-[8px] bottom-[8px] flex items-center gap-[4px] rounded-[6px] border border-black/20 bg-white/90 p-[4px]'>
                            {refs.slice(0, 3).map((path, index) => {
                              const isActive = index === previewIndex;
                              return (
                                <button
                                  key={`${asset.id}-thumb-${index}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewIndexByAssetId((prev) => ({ ...prev, [asset.id]: index }));
                                  }}
                                  onMouseEnter={() =>
                                    setPreviewIndexByAssetId((prev) => ({ ...prev, [asset.id]: index }))
                                  }
                                  className={`h-[18px] w-[18px] overflow-hidden rounded-[4px] border ${isActive ? 'border-black' : 'border-black/20 opacity-85 hover:opacity-100'}`}
                                  title={`REF ${index + 1}`}
                                >
                                  <img
                                    src={toPreviewImageSrc(path, `${asset.id}|${index}|${path}`)}
                                    className='h-full w-full object-cover'
                                    alt=''
                                  />
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </>
                    )}

                    <div className='pointer-events-none absolute left-[8px] top-[8px] flex gap-[4px]'>
                      <span className='h-[5px] w-[5px] rounded-full bg-black/20' />
                      <span className='h-[5px] w-[5px] rounded-full bg-black/20' />
                      <span className='h-[5px] w-[5px] rounded-full bg-black/20' />
                    </div>
                    <div className='pointer-events-none absolute inset-[6px] rounded-[4px] border border-black/10' />
                  </div>

                  <div className='flex flex-1 flex-col px-[10px] py-[8px]'>
                    <div className='mb-[8px] flex items-center justify-between gap-[8px]'>
                      <span className='truncate text-[13px] font-semibold text-black'>{asset.name}</span>
                      <button
                        className='shrink-0 text-gray-500 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto hover:text-red-500'
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAsset(activeTab, asset.id);
                        }}
                        title='Delete asset'
                      >
                        <svg
                          width='15'
                          height='15'
                          viewBox='0 0 24 24'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth='2.4'
                          strokeLinecap='round'
                        >
                          <circle cx='12' cy='5' r='1.5' />
                          <circle cx='12' cy='12' r='1.5' />
                          <circle cx='12' cy='19' r='1.5' />
                        </svg>
                      </button>
                    </div>
                    <div className='mt-auto flex items-center justify-between gap-[10px]'>
                      <span className='truncate rounded-full bg-[#3f3f46] px-[8px] py-[3px] text-[8px] font-semibold tracking-[0.1em] text-white uppercase'>
                        {cardStyleLabel}
                      </span>
                      <span className='text-[11px] font-semibold text-black tracking-[0.06em]'>1:1</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EDIT SIDEBAR DRAWER */}
      <Drawer
        visible={isCreating || !!editingAsset}
        placement='right'
        width={420}
        title={null}
        closable={false}
        footer={null}
        onCancel={() => {
          setIsCreating(false);
          setEditingAsset(null);
        }}
        className='[&_.arco-drawer-body]:!p-0 [&_.arco-drawer-header]:!hidden'
      >
        <div className='flex h-full flex-col bg-[#FCFCFC] overflow-hidden'>
          {/* Header */}
          <div className='flex items-start justify-between shrink-0 border-b border-gray-100 px-[24px] pt-[24px] pb-[14px]'>
            <div className='flex flex-col'>
              <span className='text-[9px] font-extrabold tracking-[0.18em] text-gray-500 uppercase'>
                {activeTab} Management
              </span>
              <span className='mt-[4px] text-[22px] font-extrabold tracking-tight text-black'>
                {isCreating ? 'Create Asset' : `Edit Asset`}
              </span>
            </div>
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingAsset(null);
              }}
              className='p-[4px] hover:bg-gray-200 transition-colors rounded-lg text-gray-500 hover:text-black mt-[4px] shrink-0'
            >
              <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                <line x1='18' y1='6' x2='6' y2='18'></line>
                <line x1='6' y1='6' x2='18' y2='18'></line>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className='flex flex-1 min-h-0 flex-col gap-[24px] overflow-y-auto overflow-x-hidden break-words px-[24px] py-[20px]'>
            {/* REFERENCE PREVIEW */}
            <div className='flex flex-col gap-[10px]'>
              <div className='flex items-center justify-between'>
                <span className='text-[9px] font-extrabold tracking-[0.18em] text-gray-500 uppercase'>
                  Reference Preview
                </span>
                <button
                  className='flex items-center gap-[4px] text-[9px] font-extrabold tracking-[0.12em] text-[#a8c200] uppercase transition-colors hover:text-[#8a9900]'
                  onClick={handleUploadRefs}
                >
                  <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                    <line x1='12' y1='5' x2='12' y2='19'></line>
                    <line x1='5' y1='12' x2='19' y2='12'></line>
                  </svg>
                  Add Image
                </button>
              </div>

              <div className='flex h-[150px] gap-[12px]'>
                <div className='relative flex flex-1 overflow-hidden rounded-[10px] border-[1.5px] border-gray-300 bg-white'>
                  {editingAsset?.referenceImagePaths?.[0] ? (
                    <img
                      src={toPreviewImageSrc(
                        editingAsset.referenceImagePaths[0],
                        `${editingAsset.id}|${editingAsset.referenceImagePaths[0]}|${editingAsset.referenceImagePaths?.length ?? 0}`
                      )}
                      className='h-full w-full object-cover'
                    />
                  ) : (
                    <div className='w-full h-full flex items-center justify-center opacity-20'>
                      <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                        <rect x='3' y='3' width='18' height='18' rx='2' ry='2'></rect>
                        <circle cx='8.5' cy='8.5' r='1.5'></circle>
                        <polyline points='21 15 16 10 5 21'></polyline>
                      </svg>
                    </div>
                  )}
                  <div className='absolute bottom-[8px] left-[8px] rounded-[6px] bg-black/80 px-[6px] py-[3px] text-[8px] font-extrabold tracking-widest text-white uppercase'>
                    THREE-VIEW SHEET
                  </div>
                  {isGeneratingReference ? (
                    <div className='absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/82 backdrop-blur-[1px]'>
                      <MechanicalSpinner size={34} />
                      <div className='mt-[14px] h-[4px] w-[56%] overflow-hidden rounded-full bg-gray-200'>
                        <div
                          className='h-full bg-[#D9FF00] transition-all duration-200'
                          style={{ width: `${Math.max(8, generationProgress)}%` }}
                        />
                      </div>
                      <div className='mt-[8px] text-[10px] font-bold tracking-[0.08em] text-black uppercase'>
                        Generating 3-View Sheet…
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className='flex flex-col gap-[10px]'>
              <span className='text-[9px] font-extrabold tracking-[0.18em] text-gray-500 uppercase'>Asset Name</span>
              <input
                className='h-[44px] rounded-[10px] border border-gray-300 bg-gray-50 px-[14px] text-[13px] font-semibold outline-none transition-shadow focus:border-[#D9FF00] focus:ring-1 focus:ring-[#D9FF00]'
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder='e.g. John Doe, Cyberpunk City'
              />
            </div>

            <div className='flex flex-col gap-[10px]'>
              <span className='text-[9px] font-extrabold tracking-[0.18em] text-gray-500 uppercase'>Style</span>
              <Select
                value={form.style}
                onChange={(v) => setForm((p) => ({ ...p, style: v }))}
                className='!h-[44px] !rounded-[10px] !border !border-gray-300 !bg-gray-50 !font-semibold'
              >
                <Select.Option value='Anime / Manga'>Anime / Manga</Select.Option>
                <Select.Option value='Realistic'>Realistic</Select.Option>
                <Select.Option value='Pixar'>Pixar</Select.Option>
              </Select>
            </div>

            <div className='flex flex-col gap-[10px]'>
              <span className='text-[9px] font-extrabold tracking-[0.18em] text-gray-500 uppercase'>
                Generation Prompt
              </span>
              <textarea
                className='h-[130px] w-full box-border resize-none rounded-[10px] border border-gray-300 bg-gray-50 px-[14px] py-[14px] text-[12px] font-semibold outline-none transition-shadow focus:border-[#D9FF00] focus:ring-1 focus:ring-[#D9FF00]'
                value={form.prompt}
                onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
                placeholder='Describe the asset in detail...'
              />
            </div>

            <div className='flex flex-col gap-[10px]'>
              <span className='text-[9px] font-extrabold tracking-[0.18em] text-gray-500 uppercase'>Aspect Ratio</span>
              <div className='flex gap-[12px]'>
                {['16:9', '9:16', '1:1', '4:3'].map((ar) => (
                  <button
                    key={ar}
                    onClick={() => setForm((p) => ({ ...p, aspectRatio: ar }))}
                    className={`flex h-[36px] flex-1 items-center justify-center rounded-[8px] border text-[10px] font-extrabold tracking-[0.08em] transition-colors ${form.aspectRatio === ar ? 'border-[#D9FF00] bg-[#FCFFCF] text-black' : 'border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            <div className='flex flex-col gap-[10px]'>
              <span className='text-[9px] font-extrabold tracking-[0.18em] text-gray-500 uppercase'>Tags</span>
              <input
                className='h-[44px] rounded-[10px] border border-gray-300 bg-gray-50 px-[14px] text-[12px] font-semibold outline-none transition-shadow focus:border-[#D9FF00] focus:ring-1 focus:ring-[#D9FF00]'
                value={form.tags}
                onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                placeholder='Comma separated...'
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className='flex shrink-0 justify-end gap-[10px] border-t border-gray-100 bg-[#FCFCFC] px-[24px] py-[14px]'>
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingAsset(null);
              }}
              disabled={isSavingAsset}
              className='h-[40px] whitespace-nowrap rounded-[9px] border-[1.5px] border-gray-300 bg-white px-[14px] text-[10px] font-extrabold tracking-[0.12em] text-black uppercase transition-colors hover:bg-gray-50'
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSaveAsset(false)}
              disabled={isSavingAsset}
              className='inline-flex h-[40px] items-center justify-center gap-[8px] whitespace-nowrap rounded-[9px] border border-gray-300 bg-white px-[14px] text-[10px] font-extrabold tracking-[0.12em] text-black uppercase transition-colors hover:bg-gray-50 disabled:opacity-60'
            >
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.6'>
                <path d='M19 21H5a2 2 0 0 1-2-2V7h18v12a2 2 0 0 1-2 2z'></path>
                <path d='M17 3H7v4h10V3z'></path>
                <path d='M12 12v6'></path>
              </svg>
              {isCreating ? 'Create Only' : 'Save Only'}
            </button>
            <button
              onClick={() => void handleSaveAsset(true)}
              disabled={isSavingAsset}
              className='inline-flex h-[40px] items-center justify-center gap-[8px] whitespace-nowrap rounded-[9px] border border-transparent bg-[#D9FF00] px-[16px] text-[10px] font-extrabold tracking-[0.12em] text-black uppercase transition-colors hover:bg-[#cbf000] disabled:opacity-60'
            >
              {isGeneratingReference ? <MechanicalSpinner size={18} /> : null}
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3'>
                <path d='M12 2v20'></path>
                <path d='M2 12h20'></path>
                <path d='m19 19-3-3'></path>
                <path d='m5 5 3 3'></path>
                <path d='m19 5-3 3'></path>
                <path d='m5 19 3-3'></path>
              </svg>
              Generate
            </button>
          </div>
        </div>
      </Drawer>
    </>
  );
};

export default AssetLibraryDrawer;
