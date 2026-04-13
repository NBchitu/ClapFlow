import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  buildPromptWithReferencePrefix,
  MAX_REFERENCE_IMAGES,
  parseAssetMentions,
  resolveShotReferences,
  stripAssetMentionMarkers,
} from '@process/services/video/AssetReferenceResolver';
import type { CharacterAsset, PropAsset, SceneAsset, Shot } from '@/common/types/videoCreation';

function createShot(overrides?: Partial<Shot>): Shot {
  return {
    id: 'shot-001',
    sceneId: 'scene-01',
    sceneIndex: 0,
    shotIndex: 1,
    goal: '@露露 对 @妈妈 打招呼',
    sceneDescription: '森林小路',
    characters: ['露露'],
    action: '',
    dialogue: '',
    shotType: 'MS',
    cameraMove: 'static',
    imagePrompt: 'cinematic scene with @露露 and @妈妈',
    videoPrompt: '',
    lockedTokens: [],
    continuityRefs: {},
    assetRefs: ['prop-basket'],
    duration: 4,
    status: 'prompts-ready',
    locked: false,
    ...overrides,
  };
}

describe('AssetReferenceResolver', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-ref-resolver-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('parses @ mentions with unicode names', () => {
    const result = parseAssetMentions('hello @露露 and @MaMa and @道具_1');
    expect(result).toEqual(['露露', 'MaMa', '道具_1']);
  });

  it('strips @ markers from prompt before image model call', () => {
    const result = stripAssetMentionMarkers('cinematic @露露 meets @妈妈 with @red_umbrella');
    expect(result).toBe('cinematic 露露 meets 妈妈 with red_umbrella');
  });

  it('prepends ordered reference mapping to prompt', () => {
    const result = buildPromptWithReferencePrefix(
      '参考图片与资产对应关系（请严格按顺序理解）：\n- 图片1为XiaoBei\n',
      'cinematic frame'
    );
    expect(result).toContain('图片1为XiaoBei');
    expect(result).toContain('cinematic frame');
  });

  it('resolves references with priority and max limit', async () => {
    const makeRef = async (relative: string): Promise<string> => {
      const fullPath = path.join(tmpDir, relative);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, 'ok');
      return relative;
    };

    const characterA: CharacterAsset = {
      id: 'char-lulu',
      name: '露露',
      description: '主角松鼠',
      appearance: '橙色毛发',
      prompt: 'small squirrel in orange fur',
      lockedTokens: ['LuLu'],
      referenceImagePaths: [await makeRef('02-assets/references/character/char-lulu/1.png')],
      primaryReferenceImagePath: await makeRef('02-assets/references/character/char-lulu/main.png'),
    };
    const characterB: CharacterAsset = {
      id: 'char-mama',
      name: '妈妈',
      description: '妈妈松鼠',
      appearance: '棕色毛发',
      prompt: 'mother squirrel brown fur',
      lockedTokens: ['MaMa'],
      referenceImagePaths: [await makeRef('02-assets/references/character/char-mama/1.png')],
      primaryReferenceImagePath: await makeRef('02-assets/references/character/char-mama/main.png'),
    };

    const scene: SceneAsset = {
      id: 'scene-01',
      name: '秋日森林',
      description: '森林场景',
      prompt: 'autumn forest path',
      referenceImagePaths: [await makeRef('02-assets/references/scene/scene-01/main.png')],
      primaryReferenceImagePath: await makeRef('02-assets/references/scene/scene-01/main.png'),
    };

    const prop: PropAsset = {
      id: 'prop-basket',
      name: '坚果篮',
      description: '装满坚果的篮子',
      prompt: 'wicker basket with acorns',
      referenceImagePaths: [
        await makeRef('02-assets/references/prop/prop-basket/1.png'),
        await makeRef('02-assets/references/prop/prop-basket/2.png'),
      ],
      primaryReferenceImagePath: await makeRef('02-assets/references/prop/prop-basket/main.png'),
    };

    const result = await resolveShotReferences(tmpDir, createShot(), {
      characters: [characterA, characterB],
      scenes: [scene],
      props: [prop],
    });

    expect(result.resolvedAssetIds.slice(0, 2)).toEqual(['char-lulu', 'char-mama']);
    expect(result.resolvedAssetIds).toContain('scene-01');
    expect(result.resolvedAssetIds).toContain('prop-basket');
    expect(result.imageUris.length).toBeLessThanOrEqual(MAX_REFERENCE_IMAGES);
    expect(result.fallbackPromptPrefix).toContain('参考资产设定：');
    expect(result.fallbackPromptPrefix).toContain('角色清单：');
    expect(result.fallbackPromptPrefix).toContain('场景清单：');
    expect(result.fallbackPromptPrefix).toContain('道具清单：');
    expect(result.fallbackPromptPrefix).toContain('露露：');
    expect(result.fallbackPromptPrefix).toContain('妈妈：');
    expect(result.referencePromptPrefix).toContain('参考图片与资产对应关系');
    expect(result.referencePromptPrefix).toContain('图片1为露露');
    expect(result.referencePromptPrefix).toContain('图片2为妈妈');
  });

  it('matches mentions against normalized aliases and keeps character in fallback when prompt missing', async () => {
    const characterA: CharacterAsset = {
      id: 'char-lulu',
      name: '露露_主角',
      description: '',
      appearance: '',
      lockedTokens: ['LuLu'],
      referenceImagePaths: [],
      primaryReferenceImagePath: undefined,
    };

    const result = await resolveShotReferences(
      tmpDir,
      createShot({ characters: ['露露'], imagePrompt: 'cinematic frame of @露露' }),
      {
        characters: [characterA],
        scenes: [],
        props: [],
      }
    );

    expect(result.resolvedAssetIds).toContain('char-lulu');
    expect(result.fallbackPromptPrefix).toContain('角色清单：');
    expect(result.fallbackPromptPrefix).toContain('露露_主角：');
  });

  it('does not crash when asset file has missing id/name fields', async () => {
    const malformedCharacter = {
      id: undefined,
      name: undefined,
      description: '',
      appearance: '',
      lockedTokens: [],
      referenceImagePaths: [],
      primaryReferenceImagePath: undefined,
    } as unknown as CharacterAsset;

    const result = await resolveShotReferences(
      tmpDir,
      createShot({ characters: ['露露'], imagePrompt: 'cinematic frame of @露露' }),
      {
        characters: [malformedCharacter],
        scenes: [],
        props: [],
      }
    );

    expect(result.resolvedAssetIds).toEqual([]);
    expect(result.imageUris).toEqual([]);
  });

  it('adds character fallback lines from @mentions when only prop assets are resolved', async () => {
    const prop: PropAsset = {
      id: 'prop-umbrella',
      name: '红色雨伞',
      description: '',
      prompt: 'bright red umbrella with raindrops',
      referenceImagePaths: [],
      primaryReferenceImagePath: undefined,
    };

    const result = await resolveShotReferences(
      tmpDir,
      createShot({
        characters: [],
        imagePrompt: 'cinematic frame, @鲁鲁 greeting @妈妈 in cafe',
        assetRefs: ['prop-umbrella'],
      }),
      {
        characters: [],
        scenes: [],
        props: [prop],
      }
    );

    expect(result.fallbackPromptPrefix).toContain('角色清单：');
    expect(result.fallbackPromptPrefix).toContain('鲁鲁：请保持该角色身份与外观一致');
    expect(result.fallbackPromptPrefix).toContain('妈妈：请保持该角色身份与外观一致');
    expect(result.fallbackPromptPrefix).not.toContain('- 红色雨伞：请保持该角色身份与外观一致');
    expect(result.fallbackPromptPrefix).toContain('道具清单：');
    expect(result.fallbackPromptPrefix).toContain('红色雨伞：bright red umbrella with raindrops');
  });

  it('keeps prompt naming consistent with original prompt references and avoids duplicate alias reuse', async () => {
    const makeRef = async (relative: string): Promise<string> => {
      const fullPath = path.join(tmpDir, relative);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, 'ok');
      return relative;
    };

    const xiaobei: CharacterAsset = {
      id: 'char-001',
      name: '小北',
      description: '少年',
      appearance: '',
      prompt: 'young boy',
      lockedTokens: ['XiaoBei'],
      referenceImagePaths: [await makeRef('02-assets/references/character/char-001/main.png')],
      primaryReferenceImagePath: await makeRef('02-assets/references/character/char-001/main.png'),
    };
    const amu: CharacterAsset = {
      id: 'char-002',
      name: '阿木_老板',
      description: '面包店老板',
      appearance: '',
      prompt: 'young girl',
      lockedTokens: ['A-mu'],
      referenceImagePaths: [await makeRef('02-assets/references/character/char-002/main.png')],
      primaryReferenceImagePath: await makeRef('02-assets/references/character/char-002/main.png'),
    };
    const mother: CharacterAsset = {
      id: 'char-003',
      name: '妈妈',
      description: '体弱母亲',
      appearance: '',
      prompt: 'weak mother',
      lockedTokens: ['XiaoBei_mother'],
      referenceImagePaths: [await makeRef('02-assets/references/character/char-003/main.png')],
      primaryReferenceImagePath: await makeRef('02-assets/references/character/char-003/main.png'),
    };

    const shot = createShot({
      characters: [],
      assetRefs: ['char-002', 'char-001', 'char-003'],
      imagePrompt:
        'cinematic still, MS, 50mm push-in framing XiaoBei supporting his weak mother, A-mu blurred in background',
    });

    const result = await resolveShotReferences(tmpDir, shot, {
      characters: [xiaobei, amu, mother],
      scenes: [],
      props: [],
    });

    expect(result.imageUris).toHaveLength(3);
    expect(result.referencePromptPrefix).toContain('图片1为A-mu');
    expect(result.referencePromptPrefix).toContain('图片2为XiaoBei');
    expect(result.referencePromptPrefix).toMatch(/图片3为(妈妈|mother)/);
    expect(result.referencePromptPrefix).not.toContain('图片3为XiaoBei');
  });
});
