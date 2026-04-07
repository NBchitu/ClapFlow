# AI 视频创作 M1-M3 实现核查报告（独立文档）

> 核查时间：2026-04-07  
> 对照文档：`docs/feature/ai-video-creation-dev-plan.md`  
> 核查范围：M1~M3 标记“已完成”任务在代码中的实际落地情况

---

## 结论摘要

当前实现已具备基础骨架与部分 UI/流程，但存在多项“计划写明已完成、代码侧仍不完整”的问题。  
其中 **P0（高优）4 项** 会直接影响核心使用流程，建议优先修复。

---

## P0 问题（优先修复）

### 1) `shotIds` 子集执行未真正生效（单镜头/批量重跑会误跑全量）

- **现象**：`runHarnessPhase` 与 `generateShotImages` 传入的 `shotIds` 未真正作用到 Harness 执行范围。
- **影响**：用户想重跑选中镜头时，实际会处理更多镜头，行为与预期不一致。
- **证据**：
  - `src/process/bridge/videoCreationBridge.ts:40-42` 未将 `shotIds` 传入 `runPhase`
  - `src/process/task/video/VideoCreationHarness.ts:114-117` `runPhase()`固定读取全量 `allShots`

### 2) 全流程 `run()` 中 `shotIds` 固定在初始快照，后续阶段可能处理 0 镜头

- **现象**：`run()` 一开始读取一次 `shotIds`，后续虽然刷新了 `allShots`，但没刷新 `shotIds`。
- **影响**：从空项目跑完整流程时，Phase2 新生成镜头后，Phase3~6 可能不处理这些新镜头。
- **证据**：
  - `src/process/task/video/VideoCreationHarness.ts:60-62` 初始化 `shotIds`
  - `src/process/task/video/VideoCreationHarness.ts:80-81` 仅刷新 `allShots`

### 3) “重新生成”按钮在多数状态下无效

- **现象**：Phase5 只处理 `status === 'prompts-ready'`，UI 侧重生成未先把状态置回 `prompts-ready`。
- **影响**：`image-approved` 等状态点击“重新生成”没有实际生成动作。
- **证据**：
  - `src/process/task/video/VideoCreationHarness.ts:408-410`
  - `src/renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/ShotDetailPanel.tsx:94-99`

### 4) “粘贴剧本后自动跑 Phase1-4”未实现

- **现象**：`parseScript` 仅初始化目录并写入脚本，不会自动触发 Harness。
- **影响**：与 M3 完成标准“自动完成 Phase1-4”不一致。
- **证据**：
  - `src/process/bridge/videoCreationBridge.ts:21-37`

---

## P1 问题（功能不完整/与计划不一致）

### 5) 图片历史版本机制未落地

- **现象**：未维护 `imageHistory`，也未实现 `shot-XXX_vN` 的历史命名回滚策略。
- **证据**：
  - `src/process/task/video/VideoCreationHarness.ts:432` 仅更新 `imagePath`
  - `src/common/chat/imageGenCore.ts:82-86` 默认保存为 `img-时间戳`
  - 代码中几乎无 `imageHistory` 写入逻辑

### 6) Phase6 “error 自动回退 Phase4 并最多重试2次”未实现

- **现象**：检测到 error 仅将状态改回 `prompts-ready`，没有自动回退与重跑链路。
- **证据**：
  - `src/process/task/video/VideoCreationHarness.ts:500-503`

### 7) Schema 合约校验未真正接入运行流程

- **现象**：`validatePhaseOutput()` 存在但未在执行链路中调用；`contracts.json` 也未参与校验。
- **证据**：
  - `src/process/task/video/VideoCreationHarness.ts:538-553`（仅定义）
  - `src/process/resources/skills/video-creation-suite/references/contracts.json`（未被运行链路消费）

### 8) StoryboardService 并发与错误处理有风险

- **现象**：
  - `enqueue()` 吃掉错误仅打印日志，调用方拿不到失败信号
  - `insertShot()` 基于当前数量生成 ID，并发插入可能撞 ID
  - 删除后只更新 `shotIds`，未处理序号重整
- **证据**：
  - `src/process/services/video/StoryboardService.ts:171-176`
  - `src/process/services/video/StoryboardService.ts:76-77`
  - `src/process/services/video/StoryboardService.ts:137-140`

### 9) M3 UI 仍有缺口

- **现象**：
  - “按建议修复并重跑”仅保存，不会重跑生成
  - `Ctrl+Enter` 仅保存，不触发重生成
  - “所有字段可编辑”未完全满足（如 goal 只读展示）
  - 批量操作缺“批量应用风格”；卡片悬浮菜单未实现
  - 画板未消费 `progress` 事件显示进度
- **证据**：
  - `ShotDetailPanel.tsx:101-107`, `70-76`, `142-144`
  - `StoryboardBoardViewer.tsx:239-257`（批量菜单）
  - `StoryboardBoardViewer.tsx:127-142`（仅处理两类事件）

---

## P2 问题（一致性与规范性）

### 10) 状态 i18n key 与状态值不一致

- **现象**：状态值使用 `prompts-ready/image-generated/...`，而 i18n key 为 `promptsReady/imageGenerated/...`。
- **影响**：状态文案可能回退显示原始值或 defaultValue。
- **证据**：
  - `src/renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/ShotCard.tsx:63,73`
  - `src/renderer/services/i18n/locales/en-US/video.json:14-20`

### 11) M1 计划项有遗漏

- **现象**：
  - `ProjectLayout.ts` 未提供计划中的 `readStoryboard(projectRoot)` 导出
  - 计划要求的 `src/process/resources/video-project-template/` 目录不存在
- **证据**：
  - `src/process/services/video/ProjectLayout.ts`
  - 仓库路径检查：无 `src/process/resources/video-project-template/`

---

## 测试与核对记录

- 已执行：`bun run test tests/unit/video/`
- 结果：`4 files, 34 tests passed`

---

## 建议修复顺序

1. **P0 全部先修复**（子集执行、run 全流程 shotIds、重生成触发条件、parseScript 自动跑）
2. 补齐 **P1 的流程完整性**（图片历史、QA 自动回退重试、Schema 实校验）
3. 最后处理 **P2 一致性问题**（i18n key、M1 遗漏项）
