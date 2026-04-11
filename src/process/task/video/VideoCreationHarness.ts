/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import type {
  DirectorStyle,
  HarnessPhase,
  HarnessRunLog,
  PhaseResult,
  RunOptions,
  SceneInfo,
  Shot,
  StoryboardStreamEvent,
  VideoModelConfig,
} from '@/common/types/videoCreation';
import { getProjectPaths } from '@process/services/video/ProjectLayout';
import { StoryboardService } from '@process/services/video/StoryboardService';
import { ProjectMemoryService } from '@process/services/video/ProjectMemoryService';
import { callVideoAi, loadVideoSkillContent } from '@process/services/video/VideoAiCaller';
import { videoCreation as videoCreationBridge } from '@/common/adapter/ipcBridge';

const PHASE_ORDER: HarnessPhase[] = [
  'director',
  'storyboard_decompose',
  'continuity_review',
  'prompt_pack',
  'image_generate',
  'image_qa',
  'video_generate',
];

const MAX_RETRIES = 3;

/**
 * 视频创作多智能体 Harness
 *
 * 负责约束阶段流转、JSON Schema 校验、失败回退与日志写入。
 * AI 调用逻辑在各 Phase 实现中注入，此类只做编排与门控。
 */
export class VideoCreationHarness {
  private storyboardService = new StoryboardService();
  private projectMemoryService = new ProjectMemoryService();

  /**
   * 启动完整流程（从 director 到 video_generate）
   */
  async run(projectRoot: string, opts?: RunOptions, model?: VideoModelConfig): Promise<HarnessRunLog> {
    const runId = `run-${Date.now()}`;
    const startedAt = new Date().toISOString();
    const phases: PhaseResult[] = [];

    const fromPhase = opts?.fromPhase ?? PHASE_ORDER[0];
    const startIdx = PHASE_ORDER.indexOf(fromPhase);
    const phasesToRun = PHASE_ORDER.slice(startIdx).filter((p) => !(opts?.skipPhases ?? []).includes(p));

    let allShots = await this.storyboardService.readAllShots(projectRoot);
    const shotIds = opts?.shotIds ?? allShots.map((s) => s.id);

    for (const phase of phasesToRun) {
      this.emitStream({ type: 'phase-started', phase });

      const result = await this.runPhaseWithRetry(projectRoot, phase, shotIds, allShots, model);
      phases.push(result);

      if (result.status === 'failed') {
        this.emitStream({ type: 'phase-failed', phase, error: result.error ?? 'unknown error' });
        break;
      }

      this.emitStream({
        type: 'phase-completed',
        phase,
        summary: `${result.affectedShotIds.length} shots processed`,
      });

      // 刷新 shots 数据供下一阶段使用
      allShots = await this.storyboardService.readAllShots(projectRoot);
    }

    const log: HarnessRunLog = {
      runId,
      projectRoot,
      startedAt,
      completedAt: new Date().toISOString(),
      phases,
      totalShots: shotIds.length,
      successShots: phases.filter((p) => p.status === 'completed').length,
      failedShots: phases.filter((p) => p.status === 'failed').length,
    };

    await this.writeRunLog(projectRoot, log);
    return log;
  }

  /**
   * 从指定阶段重跑（支持镜头子集过滤）
   */
  async rerun(
    projectRoot: string,
    fromPhase: HarnessPhase,
    shotIds?: string[],
    model?: VideoModelConfig
  ): Promise<HarnessRunLog> {
    return this.run(projectRoot, { fromPhase, shotIds }, model);
  }

  /**
   * 仅跑单个阶段（调试/手动触发用）
   */
  async runPhase(
    projectRoot: string,
    phase: HarnessPhase,
    model?: VideoModelConfig,
    shotIds?: string[]
  ): Promise<PhaseResult> {
    const allShots = await this.storyboardService.readAllShots(projectRoot);
    const ids = shotIds ?? allShots.map((s) => s.id);
    return this.runPhaseWithRetry(projectRoot, phase, ids, allShots, model);
  }

  // ─── 私有方法 ─────────────────────────────────────────────────

  private async runPhaseWithRetry(
    projectRoot: string,
    phase: HarnessPhase,
    shotIds: string[],
    allShots: Shot[],
    model?: VideoModelConfig
  ): Promise<PhaseResult> {
    const start = Date.now();
    let retryCount = 0;
    let lastError = '';

    while (retryCount < MAX_RETRIES) {
      try {
        const affected = await this.executePhase(projectRoot, phase, shotIds, allShots, model);
        return {
          phase,
          status: 'completed',
          affectedShotIds: affected,
          retryCount,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`[Harness] Phase ${phase} failed (attempt ${retryCount + 1}):`, lastError);
        retryCount++;
      }
    }

    return {
      phase,
      status: 'failed',
      affectedShotIds: [],
      error: lastError,
      retryCount,
      durationMs: Date.now() - start,
    };
  }

  private async executePhase(
    projectRoot: string,
    phase: HarnessPhase,
    shotIds: string[],
    allShots: Shot[],
    model?: VideoModelConfig
  ): Promise<string[]> {
    switch (phase) {
      case 'director':
        return this.runDirectorPhase(projectRoot, model);
      case 'storyboard_decompose':
        return this.runStoryboardDecomposePhase(projectRoot, model);
      case 'continuity_review':
        return this.runContinuityReviewPhase(projectRoot, shotIds, allShots, model);
      case 'prompt_pack':
        return this.runPromptPackPhase(projectRoot, shotIds, allShots, model);
      case 'image_generate':
        return this.runImageGeneratePhase(projectRoot, shotIds, allShots);
      case 'image_qa':
        return this.runImageQaPhase(projectRoot, shotIds, allShots, model);
      case 'video_generate':
        return this.runVideoGeneratePhase(projectRoot, shotIds, allShots, model);
      default:
        return [];
    }
  }

  // ─── Phase 1: Director ────────────────────────────────────────

  private async runDirectorPhase(projectRoot: string, model?: VideoModelConfig): Promise<string[]> {
    if (!model) throw new Error('model config required for director phase');

    const paths = getProjectPaths(projectRoot);
    const scriptContent = await fs.readFile(paths.script, 'utf-8');
    const skillContent = await loadVideoSkillContent('director');

    type DirectorOutput = {
      style: DirectorStyle;
      narrativeStructure?: string;
      keyThemes?: string[];
      scenes: SceneInfo[];
    };
    const result = await callVideoAi<DirectorOutput>(
      model,
      skillContent || 'You are a film director. Analyze the script and return JSON with style and scenes.',
      `Script:\n\n${scriptContent}`
    );

    if (!result?.style || !result.scenes) throw new Error('director phase: invalid AI response');

    await this.storyboardService.updateStoryboard(projectRoot, {
      style: result.style,
      scenes: result.scenes,
    });
    await this.projectMemoryService.update(projectRoot, { style: result.style });

    console.log(`[Harness] Director phase: ${result.scenes.length} scenes`);
    return [];
  }

  // ─── Phase 2: Storyboard Decompose ───────────────────────────

  private async runStoryboardDecomposePhase(projectRoot: string, model?: VideoModelConfig): Promise<string[]> {
    if (!model) throw new Error('model config required for storyboard_decompose phase');

    const paths = getProjectPaths(projectRoot);
    const scriptContent = await fs.readFile(paths.script, 'utf-8');
    const storyboard = await this.storyboardService.readStoryboard(projectRoot);
    const skillContent = await loadVideoSkillContent('storyboard');

    const userMsg = [
      `Script:\n\n${scriptContent}`,
      `Director Style:\n${JSON.stringify(storyboard.style ?? {}, null, 2)}`,
      `Scenes:\n${JSON.stringify(storyboard.scenes ?? [], null, 2)}`,
    ].join('\n\n---\n\n');

    type SceneStoryboardOutput = Pick<SceneInfo, 'id' | 'name' | 'description' | 'timeOfDay' | 'location'> & {
      shots: Partial<Shot>[];
    };
    type StoryboardDecomposeOutput =
      | Partial<Shot>[]
      | {
          scenes?: SceneStoryboardOutput[];
          shots?: Partial<Shot>[];
        };

    const aiOutput = await callVideoAi<StoryboardDecomposeOutput>(
      model,
      skillContent ||
        'You are a storyboard artist. Decompose the script into scenes and shots. Return JSON with scenes[].shots[] or a shot array.',
      userMsg,
      8192
    );

    const sceneIndexById = new Map<string, number>();
    const normalizedScenes: SceneInfo[] = (storyboard.scenes ?? []).map((scene, index) => {
      const sceneId = scene.id || `scene-${String(index + 1).padStart(2, '0')}`;
      sceneIndexById.set(sceneId, index);
      return {
        ...scene,
        id: sceneId,
        name: scene.name || `Scene ${index + 1}`,
        description: scene.description || '',
        shotIds: [] as string[],
      };
    });

    const rawShots: Partial<Shot>[] = [];
    if (Array.isArray(aiOutput)) {
      rawShots.push(...aiOutput);
    } else if (aiOutput?.scenes && Array.isArray(aiOutput.scenes)) {
      for (const [scenePos, scene] of aiOutput.scenes.entries()) {
        const sceneId = scene.id || normalizedScenes[scenePos]?.id || `scene-${String(scenePos + 1).padStart(2, '0')}`;
        if (!sceneIndexById.has(sceneId)) {
          const sceneIndex = normalizedScenes.length;
          normalizedScenes.push({
            id: sceneId,
            name: scene.name || `Scene ${sceneIndex + 1}`,
            description: scene.description || '',
            timeOfDay: scene.timeOfDay,
            location: scene.location,
            shotIds: [] as string[],
          });
          sceneIndexById.set(sceneId, sceneIndex);
        } else {
          const idx = sceneIndexById.get(sceneId) as number;
          normalizedScenes[idx] = {
            ...normalizedScenes[idx],
            name: scene.name || normalizedScenes[idx].name,
            description: scene.description || normalizedScenes[idx].description,
            timeOfDay: scene.timeOfDay ?? normalizedScenes[idx].timeOfDay,
            location: scene.location ?? normalizedScenes[idx].location,
          };
        }

        for (const shot of scene.shots ?? []) {
          rawShots.push({
            ...shot,
            sceneId,
            sceneIndex: sceneIndexById.get(sceneId) ?? scenePos,
            sceneDescription: shot.sceneDescription ?? scene.description ?? '',
          });
        }
      }
    } else if (Array.isArray(aiOutput?.shots)) {
      rawShots.push(...aiOutput.shots);
    }

    if (rawShots.length === 0) {
      throw new Error('storyboard_decompose: no shots generated');
    }

    await fs.mkdir(paths.shotsDir, { recursive: true });

    const writtenIds: string[] = [];
    const sceneShotCounter = new Map<string, number>();
    for (let i = 0; i < rawShots.length; i++) {
      const raw = rawShots[i];
      const id = `shot-${String(i + 1).padStart(3, '0')}`;
      const sceneId =
        raw.sceneId ??
        (typeof raw.sceneIndex === 'number' ? normalizedScenes[raw.sceneIndex]?.id : undefined) ??
        normalizedScenes[0]?.id ??
        'scene-01';
      if (!sceneIndexById.has(sceneId)) {
        const newSceneIndex = normalizedScenes.length;
        normalizedScenes.push({
          id: sceneId,
          name: `Scene ${newSceneIndex + 1}`,
          description: raw.sceneDescription ?? '',
          shotIds: [],
        });
        sceneIndexById.set(sceneId, newSceneIndex);
      }
      const sceneIndex = sceneIndexById.get(sceneId) ?? 0;
      const sceneShotIndex = (sceneShotCounter.get(sceneId) ?? 0) + 1;
      sceneShotCounter.set(sceneId, sceneShotIndex);

      const shot: Shot = {
        id,
        sceneId,
        sceneIndex,
        sceneShotIndex,
        shotIndex: i + 1,
        goal: raw.goal ?? '',
        sceneDescription: raw.sceneDescription ?? '',
        characters: raw.characters ?? [],
        action: raw.action ?? '',
        dialogue: raw.dialogue ?? '',
        shotType: raw.shotType ?? 'MS',
        cameraMove: raw.cameraMove ?? 'static',
        imagePrompt: '',
        videoPrompt: '',
        lockedTokens: [],
        continuityRefs: { sharedScene: sceneId },
        assetRefs: [],
        duration: raw.duration ?? 4,
        status: 'pending',
        locked: false,
      };
      await this.storyboardService.writeShot(projectRoot, shot);
      writtenIds.push(id);
      const scenePos = normalizedScenes.findIndex((scene) => scene.id === sceneId);
      if (scenePos >= 0) {
        const scene = normalizedScenes[scenePos];
        normalizedScenes[scenePos] = { ...scene, shotIds: [...(scene.shotIds ?? []), id] };
      }
      this.emitStream({ type: 'progress', completed: i + 1, total: rawShots.length, phase: 'storyboard_decompose' });
    }

    await this.storyboardService.updateStoryboard(projectRoot, { shotIds: writtenIds, scenes: normalizedScenes });
    console.log(`[Harness] Storyboard decompose: ${writtenIds.length} shots`);
    return writtenIds;
  }

  // ─── Phase 3: Continuity Review ──────────────────────────────

  private async runContinuityReviewPhase(
    projectRoot: string,
    shotIds: string[],
    allShots: Shot[],
    model?: VideoModelConfig
  ): Promise<string[]> {
    if (!model) throw new Error('model config required for continuity_review phase');

    const shots = allShots.filter((s) => shotIds.includes(s.id));
    const skillContent = await loadVideoSkillContent('continuity');

    type ContinuityUpdate = {
      shotId: string;
      continuityRefs?: Shot['continuityRefs'];
      qaIssues?: Shot['qaIssues'];
    };
    type ContinuityOutput =
      | ContinuityUpdate[]
      | {
          updates?: ContinuityUpdate[];
        }
      | Array<Partial<Shot>>;
    const output = await callVideoAi<ContinuityOutput>(
      model,
      skillContent ||
        'You are a continuity supervisor. Review shots for consistency. Return JSON array with shotId, continuityRefs, qaIssues.',
      `Shot list:\n${JSON.stringify(shots, null, 2)}`,
      8192
    );

    const updates: ContinuityUpdate[] = Array.isArray(output)
      ? output
          .map((item): ContinuityUpdate | null => {
            if ('shotId' in item && typeof item.shotId === 'string') {
              return {
                shotId: item.shotId,
                continuityRefs: item.continuityRefs,
                qaIssues: item.qaIssues,
              };
            }
            if ('id' in item && typeof item.id === 'string') {
              return {
                shotId: item.id,
                continuityRefs: item.continuityRefs,
                qaIssues: item.qaIssues,
              };
            }
            return null;
          })
          .filter((item): item is ContinuityUpdate => item !== null)
      : Array.isArray(output?.updates)
        ? output.updates
        : [];

    if (updates.length === 0) throw new Error('continuity_review: invalid response');

    const updatedIds: string[] = [];
    for (const update of updates) {
      if (!update.shotId) continue;
      const existing = shots.find((s) => s.id === update.shotId);
      if (!existing) continue;
      const updated: Shot = {
        ...existing,
        continuityRefs: update.continuityRefs ?? existing.continuityRefs,
        qaIssues: update.qaIssues,
      };
      await this.storyboardService.writeShot(projectRoot, updated);
      updatedIds.push(update.shotId);
      this.emitStream({ type: 'shot-updated', shotId: update.shotId, shot: updated });
    }

    return updatedIds;
  }

  // ─── Phase 4: Prompt Pack ─────────────────────────────────────

  private async runPromptPackPhase(
    projectRoot: string,
    shotIds: string[],
    allShots: Shot[],
    model?: VideoModelConfig
  ): Promise<string[]> {
    if (!model) throw new Error('model config required for prompt_pack phase');

    const shots = allShots.filter((s) => shotIds.includes(s.id) && !s.locked);
    const memory = await this.projectMemoryService.read(projectRoot);
    const memorySummary = this.projectMemoryService.buildContextSummary(memory);
    const skillContent = await loadVideoSkillContent('prompt');

    const userMsg = [`Memory Summary:\n${memorySummary}`, `Shots:\n${JSON.stringify(shots, null, 2)}`].join(
      '\n\n---\n\n'
    );

    type PromptUpdate = {
      id: string;
      imagePrompt: string;
      videoPrompt: string;
      lockedTokens: string[];
    };
    const updates = await callVideoAi<PromptUpdate[]>(
      model,
      skillContent ||
        'Generate imagePrompt and videoPrompt for each shot. Return JSON array with id, imagePrompt, videoPrompt, lockedTokens.',
      userMsg,
      8192
    );

    if (!Array.isArray(updates)) throw new Error('prompt_pack: invalid response');

    const updatedIds: string[] = [];
    for (const update of updates) {
      if (!update.id || !update.imagePrompt) continue;
      const existing = shots.find((s) => s.id === update.id);
      if (!existing) continue;
      const updated: Shot = {
        ...existing,
        imagePrompt: update.imagePrompt,
        videoPrompt: update.videoPrompt ?? existing.videoPrompt,
        lockedTokens: update.lockedTokens ?? existing.lockedTokens,
        status: 'prompts-ready',
      };
      await this.storyboardService.writeShot(projectRoot, updated);
      updatedIds.push(update.id);
      this.emitStream({ type: 'shot-updated', shotId: update.id, shot: updated });
    }

    return updatedIds;
  }

  // ─── Phase 5: Image Generate (T3.3) ──────────────────────────

  private async runImageGeneratePhase(projectRoot: string, shotIds: string[], allShots: Shot[]): Promise<string[]> {
    const { executeImageGeneration, downloadAndSaveImage, saveGeneratedImage, isHttpUrl } = await import(
      '@/common/chat/imageGenCore'
    );
    const { ProcessConfig } = await import('@process/utils/initStorage');

    const imgModelRaw = await ProcessConfig.get('tools.imageGenerationModel');
    const imgCfg = imgModelRaw as {
      baseUrl?: string;
      apiKey?: string;
      useModel?: string;
      platform?: string;
    } | null;

    if (!imgCfg?.apiKey) {
      console.warn('[Harness] image_generate: no image generation model configured');
      return [];
    }

    const paths = getProjectPaths(projectRoot);
    await fs.mkdir(paths.imagesDir, { recursive: true });

    const targets = allShots.filter(
      (s) => shotIds.includes(s.id) && !s.locked && s.status === 'prompts-ready' && s.imagePrompt
    );

    const IMAGE_CONCURRENCY = 3;
    const succeeded: string[] = [];
    const finished = new Set<string>();

    const imgProvider = {
      id: 'img-gen',
      name: 'img-gen',
      platform: imgCfg.platform ?? 'openai',
      baseUrl: imgCfg.baseUrl ?? '',
      apiKey: imgCfg.apiKey,
      useModel: imgCfg.useModel ?? 'dall-e-3',
      model: [imgCfg.useModel ?? 'dall-e-3'],
    } as Parameters<typeof executeImageGeneration>[1];

    for (let i = 0; i < targets.length; i += IMAGE_CONCURRENCY) {
      const batch = targets.slice(i, i + IMAGE_CONCURRENCY);
      await Promise.all(
        batch.map(async (shot) => {
          const generatingShot: Shot = { ...shot, status: 'image-generating' };
          await this.storyboardService.writeShot(projectRoot, generatingShot);
          this.emitStream({ type: 'shot-updated', shotId: shot.id, shot: generatingShot });

          try {
            const result = await executeImageGeneration(
              { prompt: generatingShot.imagePrompt },
              imgProvider,
              paths.imagesDir
            );
            if (result.success && result.imagePath) {
              let generatedLocalPath = result.imagePath;
              if (isHttpUrl(generatedLocalPath)) {
                generatedLocalPath = await downloadAndSaveImage(generatedLocalPath, paths.imagesDir);
              } else if (generatedLocalPath.startsWith('data:image/')) {
                generatedLocalPath = await saveGeneratedImage(generatedLocalPath, paths.imagesDir);
              } else if (!nodePath.isAbsolute(generatedLocalPath)) {
                generatedLocalPath = nodePath.join(paths.imagesDir, generatedLocalPath);
              }

              await fs.access(generatedLocalPath);
              const { imagePath, imageHistory } = await this.promoteShotImageWithVersioning(
                generatingShot,
                generatedLocalPath,
                paths.imagesDir
              );
              const updated: Shot = {
                ...generatingShot,
                imagePath,
                imageHistory,
                status: 'image-generated',
              };
              await this.storyboardService.writeShot(projectRoot, updated);
              this.emitStream({ type: 'shot-image-ready', shotId: shot.id, imagePath });
              this.emitStream({ type: 'shot-updated', shotId: shot.id, shot: updated });
              succeeded.push(shot.id);
            }
          } catch (err) {
            console.error(`[Harness] image_generate failed for ${shot.id}:`, err);
            const rollbackShot: Shot = { ...generatingShot, status: 'prompts-ready' };
            await this.storyboardService.writeShot(projectRoot, rollbackShot);
            this.emitStream({ type: 'shot-updated', shotId: shot.id, shot: rollbackShot });
          } finally {
            finished.add(shot.id);
          }
          this.emitStream({
            type: 'progress',
            completed: finished.size,
            total: targets.length,
            phase: 'image_generate',
          });
        })
      );
    }

    await this.cleanupDanglingTempImages(projectRoot, paths.imagesDir);
    return succeeded;
  }

  private async cleanupDanglingTempImages(projectRoot: string, imagesDir: string): Promise<void> {
    try {
      const shots = await this.storyboardService.readAllShots(projectRoot);
      const referenced = new Set<string>();
      for (const shot of shots) {
        if (shot.imagePath) referenced.add(shot.imagePath);
        for (const histPath of shot.imageHistory ?? []) {
          referenced.add(histPath);
        }
      }

      const entries = await fs.readdir(imagesDir);
      await Promise.all(
        entries.map(async (entry) => {
          if (!/^img-\d+/.test(entry)) return;
          const fullPath = nodePath.join(imagesDir, entry);
          if (referenced.has(fullPath)) return;
          try {
            await fs.rm(fullPath, { force: true });
          } catch {
            // ignore cleanup failures
          }
        })
      );
    } catch {
      // best-effort cleanup only
    }
  }

  private async promoteShotImageWithVersioning(
    shot: Shot,
    generatedImagePath: string,
    imagesDir: string
  ): Promise<{ imagePath: string; imageHistory?: string[] }> {
    const generatedExt = nodePath.extname(generatedImagePath) || '.png';
    const normalizedCurrentPath = nodePath.join(imagesDir, `${shot.id}${generatedExt}`);
    let history = [...(shot.imageHistory ?? [])];

    // 1) Move current image to versioned backup if it exists and differs from the generated temp file.
    if (shot.imagePath && shot.imagePath !== generatedImagePath) {
      try {
        await fs.access(shot.imagePath);
        const currentExt = nodePath.extname(shot.imagePath) || generatedExt;
        const versionPath = await this.getNextShotImageVersionPath(imagesDir, shot.id, currentExt);
        await fs.rename(shot.imagePath, versionPath);
        history = [versionPath, ...history.filter((p) => p !== versionPath && p !== shot.imagePath)];
      } catch {
        // Existing path missing/cannot move: continue with generated image promotion.
      }
    }

    // 2) Promote generated temp image to canonical shot filename.
    if (generatedImagePath !== normalizedCurrentPath) {
      // Remove stale canonical file if it still exists (e.g. not captured in shot.imagePath)
      try {
        await fs.rm(normalizedCurrentPath, { force: true });
      } catch {
        // Ignore
      }
      await fs.rename(generatedImagePath, normalizedCurrentPath);
    }

    // 3) Keep history deterministic and limited.
    history = history.filter((p) => p !== normalizedCurrentPath && p !== generatedImagePath).slice(0, 10);
    return { imagePath: normalizedCurrentPath, imageHistory: history.length > 0 ? history : undefined };
  }

  private async getNextShotImageVersionPath(imagesDir: string, shotId: string, ext: string): Promise<string> {
    let version = 1;
    while (true) {
      const candidate = nodePath.join(imagesDir, `${shotId}_v${version}${ext}`);
      try {
        await fs.access(candidate);
        version += 1;
      } catch {
        return candidate;
      }
    }
  }

  // ─── Phase 6: Image QA (T3.4) ────────────────────────────────

  private async runImageQaPhase(
    projectRoot: string,
    shotIds: string[],
    allShots: Shot[],
    model?: VideoModelConfig
  ): Promise<string[]> {
    if (!model) throw new Error('model config required for image_qa phase');

    const { fileToBase64, getImageMimeType } = await import('@/common/chat/imageGenCore');
    const targets = allShots.filter((s) => shotIds.includes(s.id) && s.imagePath && s.status === 'image-generated');

    const skillContent = await loadVideoSkillContent('image-qa');
    const checkedIds: string[] = [];

    for (const shot of targets) {
      if (!shot.imagePath) continue;
      try {
        const base64 = await fileToBase64(shot.imagePath);
        const mimeType = getImageMimeType(shot.imagePath);

        type QAOutput = { shotId: string; passed: boolean; qaIssues?: Shot['qaIssues'] };
        const result = await callVideoAi<QAOutput>(
          model,
          skillContent || 'You are a visual QA supervisor. Check the image. Return JSON with passed and qaIssues.',
          [
            {
              type: 'text',
              text: `Shot context:\n${JSON.stringify(
                {
                  id: shot.id,
                  shotType: shot.shotType,
                  imagePrompt: shot.imagePrompt,
                  continuityRefs: shot.continuityRefs,
                },
                null,
                2
              )}`,
            },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          ] as Array<Record<string, unknown>>
        );

        if (!result) continue;

        const hasErrors = result.qaIssues?.some((q) => q.severity === 'error');
        const newStatus: Shot['status'] = hasErrors ? 'prompts-ready' : 'image-approved';
        const updated: Shot = { ...shot, qaIssues: result.qaIssues, status: newStatus };

        await this.storyboardService.writeShot(projectRoot, updated);
        this.emitStream({ type: 'shot-updated', shotId: shot.id, shot: updated });
        for (const issue of result.qaIssues ?? []) {
          this.emitStream({ type: 'qa-issue', shotId: shot.id, issue });
        }
        checkedIds.push(shot.id);
      } catch (err) {
        console.error(`[Harness] image_qa failed for ${shot.id}:`, err);
      }
    }

    return checkedIds;
  }

  // ─── Phase 7: Video Generate (M4) ───────────────────────────

  private async runVideoGeneratePhase(
    projectRoot: string,
    shotIds: string[],
    allShots: Shot[],
    model?: VideoModelConfig
  ): Promise<string[]> {
    if (!model) throw new Error('model config required for video_generate phase');
    const { videoGenService } = await import('@process/services/video/VideoGenService');

    const targets = allShots.filter(
      (s) =>
        shotIds.includes(s.id) &&
        !s.locked &&
        s.imagePath &&
        (s.status === 'image-approved' || s.status === 'image-generated')
    );

    const VIDEO_CONCURRENCY = 2;
    const succeeded: string[] = [];

    for (let i = 0; i < targets.length; i += VIDEO_CONCURRENCY) {
      const batch = targets.slice(i, i + VIDEO_CONCURRENCY);
      await Promise.all(
        batch.map(async (shot) => {
          const result = await videoGenService.generateShot(shot, projectRoot, model);
          if (result.success && result.videoPath) {
            const updated: Shot = { ...shot, videoPath: result.videoPath, status: 'video-generated' };
            await this.storyboardService.writeShot(projectRoot, updated);
            this.emitStream({ type: 'shot-video-ready', shotId: shot.id, videoPath: result.videoPath });
            this.emitStream({ type: 'shot-updated', shotId: shot.id, shot: updated });
            succeeded.push(shot.id);
          }
          this.emitStream({
            type: 'progress',
            completed: succeeded.length,
            total: targets.length,
            phase: 'video_generate',
          });
        })
      );
    }

    return succeeded;
  }

  // ─── Utilities ────────────────────────────────────────────────

  private emitStream(event: StoryboardStreamEvent): void {
    try {
      videoCreationBridge.storyboardStream.emit(event);
    } catch {
      // 渲染进程可能未就绪，忽略推送错误
    }
  }

  private async writeRunLog(projectRoot: string, log: HarnessRunLog): Promise<void> {
    const paths = getProjectPaths(projectRoot);
    const logPath = nodePath.join(paths.harnessRunsDir, `${log.runId}.json`);
    try {
      await fs.writeFile(logPath, JSON.stringify(log, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Harness] Failed to write run log:', err);
    }
  }

  /** 校验阶段输出是否满足最小必填字段 */
  validatePhaseOutput(phase: HarnessPhase, output: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (phase === 'storyboard_decompose') {
      const sceneObject =
        typeof output === 'object' &&
        output !== null &&
        'scenes' in output &&
        Array.isArray((output as { scenes?: unknown[] }).scenes);
      if (!Array.isArray(output) && !sceneObject) errors.push('Output must be shot[] or { scenes: [...] }');
    }
    if (phase === 'prompt_pack') {
      if (Array.isArray(output)) {
        for (const shot of output as Partial<Shot>[]) {
          if (!shot.imagePrompt) errors.push(`shot ${shot.id}: missing imagePrompt`);
          if (!shot.videoPrompt) errors.push(`shot ${shot.id}: missing videoPrompt`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  /** 查询最近一次运行日志 */
  async getLastRunLog(projectRoot: string): Promise<HarnessRunLog | null> {
    const paths = getProjectPaths(projectRoot);
    try {
      const entries = await fs.readdir(paths.harnessRunsDir);
      const logFiles = entries
        .filter((f) => f.endsWith('.json'))
        .toSorted()
        .toReversed();
      if (logFiles.length === 0) return null;
      const raw = await fs.readFile(nodePath.join(paths.harnessRunsDir, logFiles[0]), 'utf-8');
      return JSON.parse(raw) as HarnessRunLog;
    } catch {
      return null;
    }
  }
}

/** 单例，供 Bridge 使用 */
export const videoCreationHarness = new VideoCreationHarness();
