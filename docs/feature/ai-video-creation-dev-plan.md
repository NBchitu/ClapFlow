# AI 视频创作工具 — 具体开发计划

> 关联分析文档：`docs/feature/ai-video-creation-plan.md`
> 关联研究文档：`docs/research/ai-video-multi-agent-harness-roadmap.md`
> 日期：2026-04-06

---

## 开发进度记录

### M4 — 视频生成与精修 ✅ 完成（2026-04-07）

**已完成文件：**

| 文件 | 说明 |
|------|------|
| `src/common/types/videoCreation.ts` | 新增 `VideoGenProvider`、`SnapshotInfo`、`AssetType`、`CreateAssetParams`、`UpdateAssetParams`、`DeleteAssetParams`、`GetAssetsResult`、`ListSnapshotsParams`、`CreateSnapshotParams`、`RestoreSnapshotParams` |
| `src/common/adapter/ipcBridge.ts` | 新增 11 个端点：`getAssets`、`createAsset`、`updateAsset`、`deleteAsset`、`applyAssetToShots`、`listSnapshots`、`createSnapshot`、`restoreSnapshot`、`insertShot`、`deleteShot`、`reorderShots` |
| `src/process/services/video/VideoGenService.ts` | 新文件：`KlingProvider`（轮询 image2video 任务）+ `RunwayProvider`（轮询 image_to_video 任务）+ `VideoGenService` 单例（按 `model.platform` 选择 provider，下载视频到 `04-videos/`） |
| `src/process/services/video/AssetService.ts` | 新文件：`AssetService`（角色/场景/道具 CRUD，`applyCharacterToShots` 合并 lockedTokens）+ `createSnapshot`/`listSnapshots`/`restoreSnapshot` 快照工具函数（文件复制，无需 zip） |
| `src/process/task/video/VideoCreationHarness.ts` | 实现 Phase 7 `runVideoGeneratePhase`（并发=2，跳过 locked 及无图镜头，emit `shot-video-ready` + `shot-updated`） |
| `src/process/bridge/videoCreationBridge.ts` | 完整重写：注册全部新 provider；`updateShot` 改为记录 `ShotHistoryEntry`（保留最近 10 条）；`generateFinalVideo` 接入 Harness Phase 7 |
| `src/renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/TimelineView.tsx` | 新文件：DnD 横向排序（`@dnd-kit/sortable`）+ 右边缘拖拽调整时长（mousedown/mousemove/mouseup），松手后写回 IPC |
| `src/renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/AssetLibraryDrawer.tsx` | 新文件：Arco Drawer + Tabs（Characters/Scenes/Props），角色内联创建表单，"Apply to Selected" 按钮 |
| `src/renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/hooks/useUndoStack.ts` | 新文件：20 步 ref-based Undo 栈（`push` / `undo` / `canUndo`） |
| `src/renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/StoryboardBoardViewer.tsx` | 网格/时间轴视图切换；Ctrl+Z/Cmd+Z 撤销；资产库抽屉入口；镜头插入/复制/删除接入；`orderedShotIds` 本地状态管理 |
| `src/renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/ShotCard.tsx` | 新增 `onInsertBefore`/`onDuplicate`/`onDelete` props；悬停时展示操作菜单（+↑ ⎘ ✕）；card 根元素加 `group` class |
| `src/renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/ShotDetailPanel.tsx` | 图片历史横向缩略图条（最多 5 张，点击恢复 `imagePath`） |
| `src/renderer/services/i18n/locales/*/video.json` | 6 个语言包新增 `timeline`、`asset`、`snapshot`、`card`、`history` 五个 key 组 |
| `tests/unit/video/VideoGenService.test.ts` | 新文件：mock axios；覆盖 KlingProvider 成功路径、错误路径、超时；RunwayProvider 成功/失败；provider 选择逻辑；未知 platform 返回 failure |
| `tests/unit/video/AssetService.test.ts` | 新文件：临时目录测试 CRUD（createAsset 自动生成 ID、readback、update、delete）；`applyCharacterToShots` token 合并去重；`createSnapshot`/`listSnapshots`（时序排序）/`restoreSnapshot`（覆盖并验证） |
| `tests/unit/video/StoryboardBoardViewer.dom.test.tsx` | 补全 arco mock：新增 `Tabs`/`Drawer`/`Input`；ipcBridge mock 补全 `insertShot`/`deleteShot`/`reorderShots`/`getAssets` 等新端点 |

**验收结果：**

- `tsc --noEmit` ✅ 无错误
- `bun run test` ✅ 3100/3100 通过（新增 21 个视频模块测试）
- `lint:fix` ✅ 0 errors
- `format` ✅ 通过
- `i18n:types + check-i18n.js` ✅ 通过

**M4 验收项：**

- [x] T4.1 VideoGenService（Kling/Runway API 适配器）
- [x] T4.2 Harness Phase 7 `video_generate` 实现
- [x] T4.3 TimelineView（DnD 排序 + 拖拽调整时长）
- [x] T4.4 AssetLibraryDrawer（角色/场景/道具管理，lockedTokens 注入）
- [x] T4.5 Ctrl+Z 撤销（useUndoStack，20 步）+ 项目快照（createSnapshot/restoreSnapshot）
- [x] M3 补丁：ShotDetailPanel 图片历史横向滚动
- [x] M3 补丁：ShotCard 悬停操作菜单（插入/复制/删除）
- [x] `bun run test` 全部通过 ✅

**跳过项（留 M5）：**

- T4.6 Prompt Diff 对比视图（用户决策跳过）
- Animatic FFmpeg 合成（用户决策跳过，Phase 7 直接调用视频 API）

---

### M3 — 图像生成与质检 ✅ 完成（2026-04-06）

**已完成文件：**

| 文件                                                                                                         | 说明                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/common/types/videoCreation.ts`                                                                          | 新增 `VideoModelConfig` 类型；`RunHarnessPhaseParams` / `GenerateImagesParams` 添加 `model?` 字段                                              |
| `src/process/services/video/VideoAiCaller.ts`                                                                | 新文件：一次性 AI 文本/视觉调用封装（`callVideoAi`）+ Skill 内容加载（`loadVideoSkillContent`）                                                |
| `src/process/task/video/VideoCreationHarness.ts`                                                             | 实现全部 7 个阶段执行器：director / storyboard_decompose / continuity_review / prompt_pack / image_generate / image_qa（video_generate 留 M4） |
| `src/process/bridge/videoCreationBridge.ts`                                                                  | `runHarnessPhase` 传递 `model` 到 Harness；`generateShotImages` 实际调用 Phase 5 执行器                                                        |
| `src/renderer/services/i18n/locales/*/video.json`                                                            | 6 个语言添加 `detail`、`batch`、`filter` 三个 key 组                                                                                           |
| `src/renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/ShotDetailPanel.tsx`       | 新组件：镜头详情面板（图片预览、字段编辑、Prompt 编辑、QA 问题、Lock/Regenerate 按钮）                                                         |
| `src/renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/StoryboardBoardViewer.tsx` | 重构：左右分栏布局（网格+详情面板）、状态筛选、Shift+Click 多选、批量操作工具栏                                                                |
| `src/renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/ShotCard.tsx`              | onClick 签名更新（新增 MouseEvent 参数以支持 Shift+Click）                                                                                     |
| `tests/unit/video/StoryboardBoardViewer.dom.test.tsx`                                                        | 补充 Button/Slider/Select/Tag mock；修复 onClick 断言                                                                                          |

**验收结果：**

- `tsc --noEmit` ✅ 无错误
- `bun run test` ✅ 3080/3080 通过
- `lint:fix` ✅ 0 errors
- `i18n:types + check-i18n.js` ✅ 通过

**M3 验收项：**

- [x] T3.1 Skills 内容完善（M1 阶段已完成，director/storyboard/continuity/prompt/image-qa/video-gen 全部就绪）
- [x] T3.2 Harness Phase 1-4 接入 AI（director → storyboard_decompose → continuity_review → prompt_pack）
- [x] T3.3 Phase 5 批量图片生成（`image_generate` 调用 `executeImageGeneration`，实时 emit `shot-image-ready`）
- [x] T3.4 Phase 6 图片质检（`image_qa` 使用视觉 AI 检查，自动回退 error 级问题）
- [x] T3.5 ShotDetailPanel 详情面板（图片预览、所有字段编辑、QA 问题列表）
- [x] T3.6 画板批量操作（Shift+Click 多选、状态筛选、批量 Lock/Unlock/Regenerate）
- [ ] `bun run test` 全部通过 ✅（已验证）

**待 M4 完善：**

- ShotDetailPanel 图片历史版本横向滚动
- 卡片悬浮菜单（插入前/后、复制、删除）
- `video_generate` Phase 7 接入 VideoGenService

---

### M2 — 核心链路 ✅ 完成（2026-04-06）

**已完成文件：**

| 文件                                                                                                         | 说明                                                                  |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `src/common/types/preview.ts`                                                                                | 新增 `'storyboard'` PreviewContentType                                |
| `src/renderer/pages/conversation/Preview/fileUtils.ts`                                                       | 新增 `storyboard` 到 FILE_EXTENSION_MAP                               |
| `src/renderer/pages/conversation/Workspace/utils/filePreview.ts`                                             | 新增 `isStoryboardFile()` 工具函数                                    |
| `src/renderer/pages/conversation/Workspace/hooks/useWorkspaceFileOps.ts`                                     | 识别 `storyboard.json` → 路由到画板预览                               |
| `src/renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/StoryboardBoardViewer.tsx` | 主容器：IPC 加载分镜、`storyboardStream` 实时刷新、S/M/L 卡片尺寸切换 |
| `src/renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/ShotCard.tsx`              | 分镜卡片：状态徽章、缩略图占位、高亮边框                              |
| `src/renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/index.ts`                  | 桶导出                                                                |
| `src/renderer/pages/conversation/Preview/components/viewers/index.ts`                                        | 新增 StoryboardBoardViewer 导出                                       |
| `src/renderer/pages/conversation/Preview/components/PreviewPanel/PreviewPanel.tsx`                           | 新增 `storyboard` case 分发                                           |
| `src/common/config/i18n-config.json`                                                                         | 新增 `video` 模块                                                     |
| `src/renderer/services/i18n/locales/*/video.json`                                                            | 6 个语言的视频 i18n 文件                                              |
| `tests/unit/video/StoryboardBoardViewer.dom.test.tsx`                                                        | 11 个 DOM 测试 ✅                                                     |

**验收结果：**

- `tsc --noEmit` ✅ 无错误
- `bun run test` ✅ 3080/3080 通过（含 34 个视频模块测试）
- `lint:fix` ✅ 新增文件无 error 级问题
- `i18n:types + check-i18n.js` ✅ 通过

**已完成的 M2 验收项：**

- [x] T2.1 StoryboardService（M1 阶段已完成）
- [x] T2.2 ProjectMemoryService（M1 阶段已完成）
- [x] T2.3 StoryboardBoardViewer 基础 UI（画板网格、实时刷新、尺寸切换、状态徽章）
- [x] T2.4 IPC Bridge 聊天→更新链路（`updateShot` + `storyboardStream` emit 已在 M1 实现，Renderer 监听已在 T2.3 实现）
- [x] T2.5 `parseScript` provider 结构（M1 阶段已完成，M3 接 AI）

**待后续里程碑完善：**

- 点击文件树 shot 文件 ↔ 画板卡片双向联动（T2.3 延伸，M3 补充）
- ShotDetailPanel 详情面板（T3.5，M3 阶段）

---

### M1 — 骨架与规范 ✅ 完成（2026-04-06）

**已完成文件：**

| 文件                                                 | 说明                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| `src/common/types/videoCreation.ts`                  | 完整类型定义（Shot/Storyboard/Harness/IPC 事件等）               |
| `src/process/services/video/ProjectLayout.ts`        | 项目路径工具 + 目录初始化                                        |
| `src/process/services/video/StoryboardService.ts`    | 分镜 JSON 读写（含串行队列）                                     |
| `src/process/services/video/ProjectMemoryService.ts` | 长记忆读写 + 上下文摘要生成                                      |
| `src/process/task/video/VideoCreationHarness.ts`     | 多智能体阶段编排骨架                                             |
| `src/process/bridge/videoCreationBridge.ts`          | IPC 处理器（所有 provider 已注册）                               |
| `src/common/adapter/ipcBridge.ts`                    | 新增 `videoCreation` 命名空间（7 个端点）                        |
| `src/process/bridge/index.ts`                        | 注册 `initVideoCreationBridge`                                   |
| `src/process/resources/skills/video-creation-suite/` | 完整 Skills 套件（6 个子 Skill + contracts.json + 5 个风格预设） |
| `tests/unit/video/ProjectLayout.test.ts`             | 9 个测试 ✅                                                      |
| `tests/unit/video/StoryboardService.test.ts`         | 8 个测试 ✅                                                      |
| `tests/unit/video/VideoCreationHarness.test.ts`      | 6 个测试 ✅                                                      |

**验收结果：**

- `tsc --noEmit` ✅ 无错误
- `bun run test tests/unit/video/` ✅ 23/23 通过
- lint:fix ✅ 新增文件无 error 级问题

---

## 总览

| 里程碑 | 主题           | 预估工期 | 产出                                            |
| ------ | -------------- | -------- | ----------------------------------------------- |
| M1     | 骨架与规范     | 1~2 天   | 类型定义、文件规范、Skills 骨架、Harness 空实现 |
| M2     | 核心链路       | 2~4 天   | 聊天→分镜更新→文件→UI 全链路打通                |
| M3     | 图像生成与质检 | 2~4 天   | AI 驱动 Phase 1-6，图片生成与质检完整流程       |
| M4     | 视频生成与精修 | 3~5 天   | 视频生成、时间轴、资产库、历史回滚              |

---

## M1：骨架与规范（1~2 天）

### 目标

搭好所有模块的架子，确立数据规范，让后续开发有稳固基础。

### 任务清单

#### T1.1 类型定义

**文件**：`src/common/types/videoCreation.ts`

定义以下类型（不实现逻辑，仅类型声明）：

```typescript
// 核心数据模型
type Shot
type Storyboard
type DirectorStyle
type QAIssue
type CharacterAsset
type SceneAsset
type ProjectMemory

// Harness 相关
type HarnessPhase = 'director' | 'storyboard_decompose' | 'continuity_review'
  | 'prompt_pack' | 'image_generate' | 'image_qa' | 'video_generate'
type HarnessRunLog
type PhaseContract  // 阶段输入输出 JSON Schema 描述

// IPC 相关
type VideoCreationBridgeEvents
type StoryboardStreamEvent  // 进度/状态/告警事件类型
```

**验收**：`bunx tsc --noEmit` 无报错。

---

#### T1.2 视频项目文件规范

**目标**：建立项目目录模板，并提供工具函数。

**文件**：`src/process/services/video/ProjectLayout.ts`

```typescript
// 给定项目根目录，返回各路径
export function getProjectPaths(projectRoot: string): ProjectPaths;
// 初始化空项目目录结构
export function initProjectLayout(projectRoot: string): Promise<void>;
// 从 storyboard.json 加载分镜索引
export function readStoryboard(projectRoot: string): Promise<Storyboard>;
```

同时新增示例模板目录：`src/process/resources/video-project-template/`（含示例文件）。

**验收**：单元测试 `tests/unit/video/ProjectLayout.test.ts` 覆盖路径生成与目录初始化。

---

#### T1.3 Skills 骨架

**目录**：`src/process/resources/skills/video-creation-suite/`

创建以下文件（内容为占位说明，M3 阶段填充具体 prompt 规则）：

```
SKILL.md                    # 总 Skill 说明
references/contracts.json   # 各阶段 JSON Schema（占位）
references/style-presets.json  # 5~8 个内置风格预设
director/SKILL.md
storyboard/SKILL.md
continuity/SKILL.md
prompt/SKILL.md
image-qa/SKILL.md
video-gen/SKILL.md
```

`contracts.json` 中定义各 Phase 的最小 JSON Schema，用于 M2 阶段的门控校验。

**验收**：`AcpSkillManager` 能正确加载 `video-creation-suite`（集成测试）。

---

#### T1.4 Harness 骨架

**文件**：`src/process/task/video/VideoCreationHarness.ts`

```typescript
class VideoCreationHarness {
  // 启动完整流程（从 director 到 video_generate）
  async run(projectRoot: string, opts?: RunOptions): Promise<HarnessRunLog>;
  // 从指定阶段重跑（支持镜头子集过滤）
  async rerun(projectRoot: string, fromPhase: HarnessPhase, shotIds?: string[]): Promise<HarnessRunLog>;
  // 仅跑单个阶段（调试用）
  async runPhase(projectRoot: string, phase: HarnessPhase): Promise<PhaseResult>;
  // 校验阶段输出是否符合 Schema
  private validateOutput(phase: HarnessPhase, output: unknown): ValidationResult;
  // 写入运行日志
  private writeRunLog(projectRoot: string, log: HarnessRunLog): Promise<void>;
}
```

此阶段 AI 调用全部 `TODO`，只实现：阶段枚举流转、Schema 校验占位、日志写入。

**验收**：`tests/unit/video/VideoCreationHarness.test.ts` 验证阶段流转顺序和日志写入。

---

#### T1.5 IPC Bridge 骨架

**文件**：`src/common/adapter/ipcBridge.ts` 新增 `videoCreation` 命名空间

```typescript
videoCreation: {
  parseScript:         bridge.buildProvider<ParseScriptResult, ParseScriptParams>('video.parseScript'),
  runHarnessPhase:     bridge.buildProvider<PhaseResult, RunHarnessPhaseParams>('video.runHarnessPhase'),
  updateShot:          bridge.buildProvider<Shot, UpdateShotParams>('video.updateShot'),
  generateShotImages:  bridge.buildProvider<GenerateImagesResult, GenerateImagesParams>('video.generateShotImages'),
  generateFinalVideo:  bridge.buildProvider<GenerateVideoResult, GenerateVideoParams>('video.generateFinalVideo'),
  storyboardStream:    bridge.buildEmitter<StoryboardStreamEvent>('video.storyboardStream'),
  getProjectMemory:    bridge.buildProvider<ProjectMemory, { projectRoot: string }>('video.getProjectMemory'),
}
```

**文件**：`src/process/bridge/videoCreationBridge.ts`（注册所有 provider，实现全部为 TODO 占位）。

**验收**：`bunx tsc --noEmit` 无报错，bridge 注册不影响现有功能。

---

#### M1 完成标准

- [ ] 类型文件无 TS 报错
- [ ] `AcpSkillManager` 可加载 `video-creation-suite`
- [ ] Harness 骨架单元测试全绿
- [ ] `bun run test` 全部通过

---

## M2：核心链路（2~4 天）

### 目标

打通"用户聊天 → AI 修改分镜 → 文件写回 → UI 画板刷新"的完整链路。

### 任务清单

#### T2.1 StoryboardService

**文件**：`src/process/services/video/StoryboardService.ts`

```typescript
class StoryboardService {
  // 读取 storyboard.json（含所有 shot 引用）
  async readStoryboard(projectRoot: string): Promise<Storyboard>;
  // 写入单个 shot（带文件锁，串行队列）
  async writeShot(projectRoot: string, shot: Shot): Promise<void>;
  // 批量写入
  async writeShots(projectRoot: string, shots: Shot[]): Promise<void>;
  // 读取单个 shot
  async readShot(projectRoot: string, shotId: string): Promise<Shot>;
  // 新增 shot（自动分配 ID 和序号）
  async insertShot(projectRoot: string, after: string | null, partial: Partial<Shot>): Promise<Shot>;
  // 删除 shot
  async deleteShot(projectRoot: string, shotId: string): Promise<void>;
  // 重新排序（拖拽后调用）
  async reorderShots(projectRoot: string, orderedIds: string[]): Promise<void>;
}
```

关键实现：内部维护写入串行队列，避免并发写冲突。

**验收**：集成测试覆盖并发写、重排序、删除后 ID 序号更新。

---

#### T2.2 ProjectMemoryService

**文件**：`src/process/services/video/ProjectMemoryService.ts`

```typescript
class ProjectMemoryService {
  async read(projectRoot: string): Promise<ProjectMemory>;
  async update(projectRoot: string, patch: Partial<ProjectMemory>): Promise<void>;
  // 生成用于注入上下文的精简摘要（< 500 tokens）
  buildContextSummary(memory: ProjectMemory): string;
}
```

---

#### T2.3 StoryboardBoardViewer — 基础 UI

**目录**：`src/renderer/pages/conversation/Preview/viewers/StoryboardBoardViewer/`

**阶段目标**（M2 只做基础，M3 补充详情）：

- `StoryboardBoardViewer.tsx`：主容器，从 IPC 加载分镜列表，响应 `storyboardStream` 事件实时刷新
- `ShotCard.tsx`：分镜卡片，展示序号/状态图标/缩略图（无图时显示占位）/加载进度
- 网格布局，支持 S/M/L 三种卡片大小切换
- 卡片点击 → 文件树定位到对应 `shot-XXX.json`（调用现有 Workspace 联动 API）
- 文件树点击 `shot-XXX.json` → 画板卡片高亮滚动到视口内

**状态颜色规范**：

| 状态            | 卡片左上角标识 |
| --------------- | -------------- |
| pending         | 灰色点         |
| prompts-ready   | 蓝色点         |
| image-generated | 绿色点         |
| image-approved  | 绿色勾         |
| video-generated | 紫色点         |
| approved        | 金色勾         |
| 有 error 级 QA  | 红色 ⚠         |
| locked          | 🔒 图标        |

---

#### T2.4 打通聊天→更新链路

**涉及文件**：`videoCreationBridge.ts` 中的 `updateShot` + `storyboardStream`

流程：

1. 用户发送聊天消息："把第3镜的运镜改为手持跟拍"
2. ACP 智能体识别意图 → 调用 `video.updateShot` IPC
3. `videoCreationBridge` 接收 → `StoryboardService.writeShot()` 写回文件
4. 写入成功后 emit `video.storyboardStream`（`type: 'shot-updated', shotId: 'shot-003'`）
5. Renderer 监听 → 找到对应卡片 → 局部刷新（不重载整个画板）

`StoryboardStreamEvent` 类型：

```typescript
type StoryboardStreamEvent =
  | { type: 'shot-updated'; shotId: string; shot: Shot }
  | { type: 'shot-image-ready'; shotId: string; imagePath: string }
  | { type: 'shot-video-ready'; shotId: string; videoPath: string }
  | { type: 'phase-started'; phase: HarnessPhase }
  | { type: 'phase-completed'; phase: HarnessPhase; summary: string }
  | { type: 'phase-failed'; phase: HarnessPhase; error: string }
  | { type: 'qa-issue'; shotId: string; issue: QAIssue }
  | { type: 'progress'; completed: number; total: number; phase: HarnessPhase };
```

---

#### T2.5 `parseScript` 实现（M2 范围：解析不调 AI）

**文件**：`videoCreationBridge.ts` 中的 `parseScript` provider

M2 阶段：读取 `00-script/script.md`，创建空的 `01-storyboard/` 目录和初始 `storyboard.json`（shots 为空数组），初始化 `90-memory/project-memory.json`。

M3 阶段再接入 AI 驱动的 director/storyboard 阶段。

---

#### M2 完成标准

- [x] 用户在聊天框说"修改第X镜"，对应 `shot-XXX.json` 内容更新，画板卡片刷新
- [ ] 点击文件树 shot 文件 ↔ 画板卡片双向联动正常（延至 M3 补充）
- [x] 新建项目时自动初始化目录结构
- [x] `bun run test` 全部通过（3080/3080）

---

## M3：图像生成与质检（2~4 天）

### 目标

接入 AI 驱动 Phase 1-6，实现从剧本到分镜图片的完整自动化流程。

### 任务清单

#### T3.1 Skills 内容完善（Phase 1-4）

**`director/SKILL.md`** — 核心规则：

- 输入：剧本全文
- 输出：`DirectorStyle` JSON + 场景列表（sceneId/名称/氛围）
- 规则：根据类型选择默认镜头偏好；确定色彩方案；识别情感弧线

**`storyboard/SKILL.md`** — 核心规则：

- 输入：`DirectorStyle` + 场景列表 + 剧本
- 输出：每场景分解为 N 个 Shot（含 goal/shotType/cameraMove/duration）
- 规则：对白场景默认"过肩切换"；动作场景多用"中景+特写组合"；节奏参考每分钟镜头数

**`continuity/SKILL.md`** — 核心规则：

- 输入：Shot 列表
- 输出：补全每个 Shot 的 `continuityRefs`；标记潜在问题（`qaIssues`）
- 必查项：同场景相邻镜头机位 180° 法则；角色进出画方向一致性；道具手持位置

**`prompt/SKILL.md`** — 核心规则：

- 输入：Shot（含 goal/sceneDescription/continuityRefs）+ ProjectMemory
- 输出：`imagePrompt`（英文，含 lockedTokens）+ `videoPrompt`（英文）
- 规则：imagePrompt 必须含景别关键词 + 角色外观 token + 风格 token；videoPrompt 必须含运镜描述；`lockedTokens` 提取角色名外观描述词和全局风格词

#### T3.2 Harness Phase 1-4 接入 AI

**文件**：`VideoCreationHarness.ts` 中各 Phase 实现

每个 Phase：

1. 从 `ProjectMemoryService.buildContextSummary()` 取摘要
2. 加载对应 Skill 内容（`AcpSkillManager`）
3. 构造精简上下文（相关 shot 子集 + memory 摘要 + Skill 规则）
4. 调用 AI → 解析 JSON 输出 → Schema 校验
5. 校验失败重试（最多 3 次）→ 超限 emit `phase-failed`
6. 写回文件 + emit 进度事件

#### T3.3 Phase 5：批量图片生成

**文件**：`VideoCreationHarness.ts` Phase 5 + `videoCreationBridge.generateShotImages`

- 从 `storyboard.json` 读取 `status !== 'image-approved'` 且 `locked !== true` 的 shots
- 并发控制：最多同时 3 个生成请求（避免 API 限流）
- 每张生成完成立即 emit `shot-image-ready` → UI 实时刷新卡片图片
- 失败镜头记录到 `harness-run.json`，不阻塞其他镜头
- 生成结果保存到 `03-images/shot-XXX.png`，历史版本重命名为 `shot-XXX_v<N>.png`

#### T3.4 Phase 6：图片质检 Skill 接入

**文件**：`image-qa/SKILL.md` 完善 + Harness Phase 6 实现

**`image-qa/SKILL.md`** — 核心检查项：

- 角色外观是否与 `charAsset.appearance` 描述一致（特别检查服装颜色/发型）
- 与 `continuityRefs.prevShotId` 对应图片中角色位置/方向是否连贯
- 景别是否符合 `shot.shotType` 设定
- 是否有明显 AI 生成瑕疵（手部畸形、文字乱码等）
- 输出：`qaIssues` 列表（含 type/severity/suggestion）

**门控逻辑**：error 级问题 → 自动回退到 Phase 4 重跑 prompt（最多 2 次）→ 仍失败则标记等待用户处理。

#### T3.5 ShotDetailPanel 完整 UI

完善 `ShotDetailPanel.tsx`，加入：

- 图片大图预览 + 历史版本横向滚动（最近 5 次，点击恢复）
- 图片/视频 prompt 可折叠编辑区（`Ctrl+Enter` 保存并触发重生成）
- 锁定 Token 展示（chips，可删除单个 token）
- 景别/运镜下拉选择（选择后自动更新 shot JSON）
- 时长滑块（1~30 秒）
- QA 问题列表（含 [按建议修复并重跑] 按钮）
- [🔒锁定] [🔄重新生成] 操作按钮

#### T3.6 画板批量操作

在画板工具栏和卡片上加入：

- `Shift+点击` 多选
- 批量操作菜单：[批量重新生成] [批量锁定] [批量应用风格]
- 按状态筛选（待生成/已生成/有问题/已锁定）
- 卡片悬浮菜单：[重新生成] [锁定] [编辑提示词] [插入前/后] [复制] [删除]

#### M3 完成标准

- [x] 用户粘贴剧本后，系统自动完成 Phase 1-4，生成完整分镜列表（含 prompt）
- [x] 触发批量图片生成，进度实时显示在画板卡片上
- [x] 质检完成后，有问题的卡片显示红色 ⚠，详情面板展示具体问题
- [x] ShotDetailPanel 所有字段可编辑，修改后写回文件
- [x] `bun run test` 全部通过

---

## M4：视频生成与精修（3~5 天）

### 目标

完成视频生成全流程，并补充高频编辑功能（时间轴、资产库、历史回滚）。

### 任务清单

#### T4.1 VideoGenService

**文件**：`src/process/services/video/VideoGenService.ts`

```typescript
interface VideoGenProvider {
  generate(params: VideoGenParams): Promise<VideoGenResult>
  checkStatus(taskId: string): Promise<VideoGenStatus>
}

// 实现两个供应商（按优先级）
class KlingProvider implements VideoGenProvider { ... }
class RunwayProvider implements VideoGenProvider { ... }

class VideoGenService {
  async generateShot(shot: Shot, provider: 'kling' | 'runway'): Promise<string>  // 返回视频路径
  async generateAnimatic(shots: Shot[], projectRoot: string): Promise<string>      // 静帧拼接
  async generateFinal(shots: Shot[], projectRoot: string): Promise<string>         // 最终合成
}
```

**Animatic 实现**：使用 `sharp` 将 `imagePath` 拼接为静帧序列，FFmpeg 合成为带时长的 MP4（无需外部视频 API）。

**`video-gen/SKILL.md`** — 包含：各供应商适用场景建议、Kling/Runway prompt 格式差异、运镜参数映射。

#### T4.2 Harness Phase 7 实现

- 读取 `status === 'image-approved'` 的 shots
- 先生成 Animatic → emit `animatic-ready` → 等待用户确认
- 用户确认后（或通过聊天说"开始生成视频"）触发正式视频生成
- 并发控制：最多同时 2 个视频生成请求
- 视频完成后 emit `shot-video-ready`
- 所有镜头完成后触发 `generateFinal` 合成 → emit `final-video-ready`

#### T4.3 时间轴视图（TimelineView）

**文件**：`StoryboardBoardViewer/TimelineView.tsx`

- 横轴为时间（秒），每个 shot 显示为色块（宽度 = duration）
- 色块内显示缩略图 + 时长数字
- 拖拽色块左右边缘 → 调整时长（松手后写回 shot JSON）
- 拖拽色块位置 → 调整顺序（松手后调用 `StoryboardService.reorderShots()`）
- 底部显示总时长、视频生成进度

**视图切换**：画板工具栏 [网格 | 时间轴 | 列表] 切换，状态保存到 localStorage。

#### T4.4 资产库抽屉（AssetLibraryDrawer）

**文件**：`StoryboardBoardViewer/AssetLibraryDrawer.tsx`

- 从 `02-assets/` 目录加载角色/场景/道具卡
- 角色卡：名称 + 参考图 + 外观描述 + lockedTokens 一览
- 操作：
  - [新建角色] → 弹窗填写信息 → 写入 `02-assets/characters/char-xxx.json`
  - [应用到选中镜头] → 将角色 lockedTokens 注入选中镜头的 prompt
  - [编辑] → 修改后自动刷新所有引用该角色的镜头 prompt 建议

**风格模板**：从 `references/style-presets.json` + 用户自定义模板加载，支持一键应用到全部/选中镜头。

#### T4.5 操作历史与快照回滚

**Shot 级历史**（已在 M3 中的图片历史基础上扩展）：

- 文本字段修改也记录历史（最近 10 次），存入 shot JSON 的 `history` 字段
- ShotDetailPanel 显示 [历史] 按钮 → 弹出历史列表，选中版本预览并一键恢复

**项目级快照**：

- 工具栏 [📷 保存快照] → 将当前 `01-storyboard/` + `02-assets/` 打包为 `99-logs/snapshot-<timestamp>.zip`
- [🔄 恢复快照] → 选择历史快照恢复（先备份当前状态）

**`Ctrl+Z` 撤销**（基础版）：

- 维护操作栈（最近 20 步），支持以下操作类型的撤销：
  - 字段修改（`updateShot`）
  - 排序变更（`reorderShots`）
  - 插入/删除（`insertShot` / `deleteShot`）

#### T4.6 Prompt 差异对比视图

**触发时机**：AI 修改 prompt 后，在聊天区展示 diff 块。

```
── imagePrompt 变更 ──────────────────
- cinematic photo, wide shot, ...
+ cinematic photo, medium shot, over-shoulder, ...
影响镜头: shot-003
──────────────────────────────────────
[接受] [拒绝] [对比预览]
```

[对比预览] → 新 prompt 生成图片后，与旧图并排显示，用户选择采用哪个版本。

#### M4 完成标准

- [ ] Animatic 生成并可在 Preview 面板中播放
- [ ] 正式视频生成后卡片展示视频封帧
- [ ] 时间轴视图中拖拽调整时长/顺序，写回文件
- [ ] 资产库中新建角色后，prompt 中自动引用
- [ ] `Ctrl+Z` 撤销字段修改
- [ ] `bun run test` 全部通过

---

## 跨里程碑的持续工作

### 测试策略

每个新文件必须有对应测试（`bun run test`），覆盖率 ≥ 80%：

| 模块                    | 测试类型         | 关注点                          |
| ----------------------- | ---------------- | ------------------------------- |
| `ProjectLayout`         | 单元             | 路径生成、目录初始化            |
| `StoryboardService`     | 集成             | 并发写、重排序、ID 一致性       |
| `VideoCreationHarness`  | 单元 + 集成      | 阶段流转、Schema 校验、重试逻辑 |
| `VideoGenService`       | 单元（mock API） | 供应商适配、错误处理            |
| `StoryboardBoardViewer` | DOM 测试         | 事件联动、状态渲染              |

### i18n 要求

所有新增 UI 文字必须走 i18n key，不硬编码。每次提交前运行：

```bash
bun run i18n:types
node scripts/check-i18n.js
```

### 代码质量检查（每次提交前）

```bash
bun run lint:fix
bun run format
bunx tsc --noEmit
bun run test
```

### 提交规范

- `feat(video): add StoryboardService with file locking`
- `feat(video-ui): add StoryboardBoardViewer grid layout`
- `feat(harness): implement phase 1-4 AI integration`
- 不加 AI 署名

---

## 依赖关系图

```
T1.1 类型定义
    ↓
T1.2 文件规范  →  T1.4 Harness 骨架  →  T3.2 Phase 1-4 接 AI
    ↓                    ↓
T2.1 StoryboardService   T1.3 Skills 骨架  →  T3.1 Skills 内容完善
    ↓
T2.2 ProjectMemoryService
    ↓
T1.5 IPC Bridge  →  T2.4 聊天→更新链路  →  T3.3 批量图片生成  →  T4.2 Phase 7
    ↓                                              ↓
T2.3 画板基础 UI  →  T3.5 ShotDetailPanel  →  T4.3 时间轴视图
                          ↓
                     T3.6 批量操作
                          ↓
                     T4.4 资产库抽屉
                     T4.5 历史回滚
                     T4.6 Prompt Diff
```

---

## 开发顺序建议（单人线性推进）

```
Day 1:  T1.1 + T1.2 + T1.3（规范与骨架）
Day 2:  T1.4 + T1.5（Harness + Bridge 骨架）
Day 3:  T2.1 + T2.2（Service 层）
Day 4:  T2.3（画板基础 UI）
Day 5:  T2.4 + T2.5（链路打通，M2 收尾）
Day 6:  T3.1（Skills 内容，可与 T3.2 并行思考）
Day 7:  T3.2（Harness Phase 1-4 接 AI）
Day 8:  T3.3 + T3.4（图片生成 + 质检）
Day 9:  T3.5 + T3.6（ShotDetailPanel + 批量操作，M3 收尾）
Day 10: T4.1 + T4.2（VideoGenService + Phase 7）
Day 11: T4.3（时间轴视图）
Day 12: T4.4 + T4.5 + T4.6（资产库 + 历史 + Diff，M4 收尾）
```

---

_开发计划由 Claude Code 基于项目架构分析与 roadmap 研究文档整合生成。_
