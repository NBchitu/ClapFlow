/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { CharacterAsset, GetAssetsResult } from '@/common/types/videoCreation';
import { Button, Drawer, Input, Tabs } from '@arco-design/web-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const TabPane = Tabs.TabPane;

interface AssetLibraryDrawerProps {
  visible: boolean;
  projectRoot: string;
  selectedShotIds: Set<string>;
  onClose: () => void;
}

interface NewCharacterForm {
  name: string;
  appearance: string;
  lockedTokens: string;
}

const EMPTY_FORM: NewCharacterForm = { name: '', appearance: '', lockedTokens: '' };

const AssetLibraryDrawer: React.FC<AssetLibraryDrawerProps> = ({ visible, projectRoot, selectedShotIds, onClose }) => {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<GetAssetsResult>({ characters: [], scenes: [], props: [] });
  const [showNewForm, setShowNewForm] = useState(false);
  const [form, setForm] = useState<NewCharacterForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadAssets = useCallback(async () => {
    if (!projectRoot) return;
    try {
      const result = await ipcBridge.videoCreation.getAssets.invoke({ projectRoot });
      setAssets(result);
    } catch {
      // Silently ignore
    }
  }, [projectRoot]);

  useEffect(() => {
    if (visible) void loadAssets();
  }, [visible, loadAssets]);

  const handleCreateCharacter = useCallback(async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const tokens = form.lockedTokens
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await ipcBridge.videoCreation.createAsset.invoke({
        projectRoot,
        type: 'character',
        data: {
          name: form.name.trim(),
          description: '',
          appearance: form.appearance.trim(),
          lockedTokens: tokens,
        } as Partial<CharacterAsset>,
      });
      setForm(EMPTY_FORM);
      setShowNewForm(false);
      await loadAssets();
    } finally {
      setSaving(false);
    }
  }, [form, projectRoot, loadAssets]);

  const handleApplyToShots = useCallback(
    async (charId: string) => {
      if (selectedShotIds.size === 0) return;
      await ipcBridge.videoCreation.applyAssetToShots.invoke({
        projectRoot,
        charId,
        shotIds: [...selectedShotIds],
      });
    },
    [projectRoot, selectedShotIds]
  );

  const handleDeleteCharacter = useCallback(
    async (id: string) => {
      await ipcBridge.videoCreation.deleteAsset.invoke({ projectRoot, type: 'character', id });
      await loadAssets();
    },
    [projectRoot, loadAssets]
  );

  return (
    <Drawer
      visible={visible}
      placement='right'
      width={320}
      title={t('video.storyboard.asset.title')}
      onCancel={onClose}
      footer={null}
    >
      <Tabs defaultActiveTab='characters' size='small'>
        <TabPane key='characters' title={t('video.storyboard.asset.characters')}>
          <div className='flex flex-col gap-8px'>
            {assets.characters.length === 0 && !showNewForm && (
              <p className='text-12px text-t-secondary'>{t('video.storyboard.asset.noAssets')}</p>
            )}

            {assets.characters.map((char) => (
              <div key={char.id} className='rounded-4px border border-border-1 p-8px bg-bg-2'>
                <div className='flex items-center justify-between mb-4px'>
                  <span className='text-13px text-t-primary font-medium'>{char.name}</span>
                  <Button
                    size='mini'
                    type='text'
                    className='text-red-500'
                    onClick={() => void handleDeleteCharacter(char.id)}
                  >
                    ✕
                  </Button>
                </div>
                {char.appearance && <p className='text-11px text-t-secondary mb-4px truncate'>{char.appearance}</p>}
                {char.lockedTokens.length > 0 && (
                  <div className='flex flex-wrap gap-4px mb-6px'>
                    {char.lockedTokens.map((tok) => (
                      <span
                        key={tok}
                        className='text-10px px-4px py-1px rounded-full bg-brand-1 text-brand-6 border border-brand-3'
                      >
                        {tok}
                      </span>
                    ))}
                  </div>
                )}
                {selectedShotIds.size > 0 && (
                  <Button size='mini' type='outline' onClick={() => void handleApplyToShots(char.id)}>
                    {t('video.storyboard.asset.applyToSelected')}
                  </Button>
                )}
              </div>
            ))}

            {showNewForm ? (
              <div className='rounded-4px border border-border-1 p-8px bg-bg-2 flex flex-col gap-8px'>
                <div>
                  <p className='text-11px text-t-secondary mb-2px'>{t('video.storyboard.asset.name')}</p>
                  <Input
                    size='small'
                    value={form.name}
                    onChange={(val) => setForm((prev) => ({ ...prev, name: val }))}
                  />
                </div>
                <div>
                  <p className='text-11px text-t-secondary mb-2px'>{t('video.storyboard.asset.appearance')}</p>
                  <Input
                    size='small'
                    value={form.appearance}
                    onChange={(val) => setForm((prev) => ({ ...prev, appearance: val }))}
                  />
                </div>
                <div>
                  <p className='text-11px text-t-secondary mb-2px'>{t('video.storyboard.asset.lockedTokens')}</p>
                  <Input
                    size='small'
                    placeholder='token1, token2'
                    value={form.lockedTokens}
                    onChange={(val) => setForm((prev) => ({ ...prev, lockedTokens: val }))}
                  />
                </div>
                <div className='flex gap-8px'>
                  <Button size='mini' type='primary' loading={saving} onClick={() => void handleCreateCharacter()}>
                    {t('video.storyboard.asset.create')}
                  </Button>
                  <Button
                    size='mini'
                    type='text'
                    onClick={() => {
                      setShowNewForm(false);
                      setForm(EMPTY_FORM);
                    }}
                  >
                    {t('video.storyboard.asset.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button size='small' type='dashed' long onClick={() => setShowNewForm(true)}>
                + {t('video.storyboard.asset.newCharacter')}
              </Button>
            )}
          </div>
        </TabPane>

        <TabPane key='scenes' title={t('video.storyboard.asset.scenes')}>
          <div className='flex flex-col gap-8px'>
            {assets.scenes.length === 0 ? (
              <p className='text-12px text-t-secondary'>{t('video.storyboard.asset.noAssets')}</p>
            ) : (
              assets.scenes.map((scene) => (
                <div key={scene.id} className='rounded-4px border border-border-1 p-8px bg-bg-2'>
                  <span className='text-13px text-t-primary font-medium'>{scene.name}</span>
                </div>
              ))
            )}
          </div>
        </TabPane>

        <TabPane key='props' title={t('video.storyboard.asset.props')}>
          <div className='flex flex-col gap-8px'>
            {assets.props.length === 0 ? (
              <p className='text-12px text-t-secondary'>{t('video.storyboard.asset.noAssets')}</p>
            ) : (
              assets.props.map((prop) => (
                <div key={prop.id} className='rounded-4px border border-border-1 p-8px bg-bg-2'>
                  <span className='text-13px text-t-primary font-medium'>{prop.name}</span>
                </div>
              ))
            )}
          </div>
        </TabPane>
      </Tabs>
    </Drawer>
  );
};

export default AssetLibraryDrawer;
