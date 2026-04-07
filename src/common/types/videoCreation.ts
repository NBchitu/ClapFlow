/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

// ==================== 核心数据模型 ====================

export type ShotType = 'EWS' | 'WS' | 'MS' | 'CU' | 'ECU';
export type CameraMove = 'static' | 'push' | 'pull' | 'pan' | 'tilt' | 'handheld';
export type ShotStatus =
  | 'pending'
  | 'prompts-ready'
  | 'image-generated'
  | 'image-approved'
  | 'video-generated'
  | 'approved';

export type QAIssueType = 'character-drift' | 'prop-missing' | 'style-shift' | 'composition' | 'continuity';
export type QAIssueSeverity = 'warning' | 'error';

export type QAIssue = {
  type: QAIssueType;
  description: string;
  severity: QAIssueSeverity;
  suggestion: string;
};

export type ContinuityRefs = {
  prevShotId?: string;
  nextShotId?: string;
  sharedCharacters?: string[];
  sharedProps?: string[];
  sharedScene?: string;
};

export type ShotHistoryEntry = {
  timestamp: string;
  imagePrompt?: string;
  videoPrompt?: string;
  imagePath?: string;
  changedBy: 'ai' | 'user';
};

export type Shot = {
  id: string;
  sceneIndex: number;
  shotIndex: number;
  goal: string;
  sceneDescription: string;
  characters: string[];
  action: string;
  dialogue: string;
  shotType: ShotType;
  cameraMove: CameraMove;
  imagePrompt: string;
  videoPrompt: string;
  lockedTokens: string[];
  continuityRefs: ContinuityRefs;
  assetRefs: string[];
  duration: number;
  imagePath?: string;
  imageHistory?: string[];
  videoPath?: string;
  status: ShotStatus;
  qaIssues?: QAIssue[];
  locked: boolean;
  history?: ShotHistoryEntry[];
};

export type DirectorStyle = {
  genre: string;
  visualStyle: string;
  colorPalette: string;
  cameraPreferences: CameraMove[];
  referenceWorks?: string[];
  negativeStyle?: string;
};

export type SceneInfo = {
  id: string;
  name: string;
  description: string;
  timeOfDay?: string;
  location?: string;
};

export type Storyboard = {
  id: string;
  title: string;
  projectRoot: string;
  scriptPath: string;
  style: DirectorStyle;
  scenes: SceneInfo[];
  shotIds: string[];
  createdAt: string;
  updatedAt: string;
};

// ==================== 资产模型 ====================

export type CharacterAsset = {
  id: string;
  name: string;
  description: string;
  appearance: string;
  lockedTokens: string[];
  referenceImagePaths?: string[];
};

export type SceneAsset = {
  id: string;
  name: string;
  description: string;
  referenceImagePaths?: string[];
};

export type PropAsset = {
  id: string;
  name: string;
  description: string;
  referenceImagePaths?: string[];
};

export type StylePreset = {
  id: string;
  name: string;
  description: string;
  style: Partial<DirectorStyle>;
  promptTokens: string[];
};

// ==================== 项目记忆 ====================

export type ProjectMemory = {
  projectId: string;
  characters: Record<string, CharacterAsset>;
  scenes: Record<string, SceneAsset>;
  style?: DirectorStyle;
  continuityNotes: string[];
  lastHarnessRun?: string;
  updatedAt: string;
};

// ==================== Harness ====================

export type HarnessPhase =
  | 'director'
  | 'storyboard_decompose'
  | 'continuity_review'
  | 'prompt_pack'
  | 'image_generate'
  | 'image_qa'
  | 'video_generate';

export type PhaseStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type PhaseResult = {
  phase: HarnessPhase;
  status: PhaseStatus;
  affectedShotIds: string[];
  error?: string;
  retryCount: number;
  durationMs: number;
};

export type HarnessRunLog = {
  runId: string;
  projectRoot: string;
  startedAt: string;
  completedAt?: string;
  phases: PhaseResult[];
  totalShots: number;
  successShots: number;
  failedShots: number;
};

export type PhaseContract = {
  phase: HarnessPhase;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
};

export type RunOptions = {
  fromPhase?: HarnessPhase;
  shotIds?: string[];
  skipPhases?: HarnessPhase[];
};

// ==================== IPC Bridge 事件 ====================

export type StoryboardStreamEventType =
  | 'shot-updated'
  | 'shot-image-ready'
  | 'shot-video-ready'
  | 'animatic-ready'
  | 'final-video-ready'
  | 'phase-started'
  | 'phase-completed'
  | 'phase-failed'
  | 'qa-issue'
  | 'progress';

/** 扁平事件对象（使用 type 字段区分），buildEmitter 需要单一对象类型 */
export type StoryboardStreamEvent = {
  type: StoryboardStreamEventType;
  shotId?: string;
  shot?: Shot;
  imagePath?: string;
  videoPath?: string;
  animaticPath?: string;
  phase?: HarnessPhase;
  summary?: string;
  error?: string;
  issue?: QAIssue;
  completed?: number;
  total?: number;
};

export type ParseScriptParams = {
  projectRoot: string;
  scriptContent: string;
};

export type ParseScriptResult = {
  projectRoot: string;
  storyboard: Storyboard;
};

/** Minimal model config passed from renderer to main-process video handlers */
export type VideoModelConfig = {
  platform: string;
  baseUrl: string;
  apiKey: string;
  useModel: string;
  modelProtocols?: Record<string, string>;
};

export type RunHarnessPhaseParams = {
  projectRoot: string;
  phase: HarnessPhase;
  shotIds?: string[];
  /** AI model to use for phases that require generation */
  model?: VideoModelConfig;
};

export type UpdateShotParams = {
  projectRoot: string;
  shotId: string;
  updates: Partial<Shot>;
};

export type GenerateImagesParams = {
  projectRoot: string;
  shotIds?: string[];
  /** AI model to use for image generation */
  model?: VideoModelConfig;
};

export type GenerateImagesResult = {
  succeeded: string[];
  failed: string[];
};

export type GenerateVideoParams = {
  projectRoot: string;
  shotIds?: string[];
  provider?: 'kling' | 'runway';
  animaticOnly?: boolean;
};

export type GenerateVideoResult = {
  animaticPath?: string;
  finalVideoPath?: string;
  succeeded: string[];
  failed: string[];
};

// ==================== Video Gen ====================

export type VideoGenProvider = 'kling' | 'runway';

export type SnapshotInfo = {
  id: string;
  createdAt: string;
  path: string;
};

export type AssetType = 'character' | 'scene' | 'prop';

export type CreateAssetParams = {
  projectRoot: string;
  type: AssetType;
  data: Partial<CharacterAsset | SceneAsset | PropAsset>;
};

export type UpdateAssetParams = {
  projectRoot: string;
  type: AssetType;
  id: string;
  data: Partial<CharacterAsset | SceneAsset | PropAsset>;
};

export type DeleteAssetParams = {
  projectRoot: string;
  type: AssetType;
  id: string;
};

export type GetAssetsResult = {
  characters: CharacterAsset[];
  scenes: SceneAsset[];
  props: PropAsset[];
};

export type ListSnapshotsParams = { projectRoot: string };
export type CreateSnapshotParams = { projectRoot: string };
export type RestoreSnapshotParams = { projectRoot: string; snapshotId: string };

// ==================== 项目路径 ====================

export type ProjectPaths = {
  root: string;
  script: string;
  storyboardDir: string;
  storyboardJson: string;
  shotsDir: string;
  assetsDir: string;
  charactersDir: string;
  scenesDir: string;
  propsDir: string;
  stylePresetsJson: string;
  imagesDir: string;
  videosDir: string;
  memoryDir: string;
  projectMemoryJson: string;
  logsDir: string;
  harnessRunsDir: string;
};
