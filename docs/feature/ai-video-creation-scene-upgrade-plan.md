# AI Video Creation Scene 化改造计划（M5）

> 日期：2026-04-08  
> 基线文档：`docs/feature/ai-video-creation-dev-plan.md`

---

## 1. 改造目标

将当前 **Shot 扁平结构** 升级为 **Scene 包含多个 Shot** 的结构，并完成以下联动：

1. `video-creation-suite` skill 输出改为 Scene+Shots 层级；
2. 主进程数据读写与 Harness 全链路支持 Scene；
3. Preview 从原 3 视图收敛为 2 视图（Canvas + Timeline）；
4. Canvas 用 Scene 容器包裹多个 Shot；
5. Shot “重新生成”补齐进度/动画反馈。

---

## 2. 范围与改动清单

### 2.1 数据与服务层

- `src/common/types/videoCreation.ts`
  - `Shot` 增加 `sceneId?: string`、`sceneShotIndex?: number`；
  - `ShotStatus` 增加 `image-generating`（用于进度态）；
  - `SceneInfo` 增加 `shotIds?: string[]`。
- `src/process/services/video/StoryboardService.ts`
  - 读取时做 Scene 字段兼容归一化（老项目无 `sceneId` 时自动推断）；
  - 写入/重排时同步维护 `sceneShotIndex` 与 `scene.shotIds`；
  - 新增按 Scene 分组读取能力。

### 2.2 Harness 与 Bridge

- `src/process/task/video/VideoCreationHarness.ts`
  - `storyboard_decompose` 同时兼容：
    - 旧格式：`Partial<Shot>[]`
    - 新格式：`{ scenes: [{ id, name, shots: [...] }] }`
  - 写回 shot 时补齐 `sceneId`、`sceneShotIndex`；
  - 生成图片阶段新增 `image-generating` 中间状态事件。
- `src/process/bridge/videoCreationBridge.ts`
  - `generateFinalVideo` 透传 `model`（修复 Phase 7 参数链路）。

### 2.3 Skill 套件

- `src/process/resources/skills/video-creation-suite/references/contracts.json`
  - `storyboard_decompose` 输出契约升级为 Scene+Shots。
- `src/process/resources/skills/video-creation-suite/SKILL.md`
- `src/process/resources/skills/video-creation-suite/storyboard/SKILL.md`
- `src/process/resources/skills/video-creation-suite/continuity/SKILL.md`
- `src/process/resources/skills/video-creation-suite/prompt/SKILL.md`
  - 全部补充 Scene 维度约束、索引规则、输出示例。

### 2.4 Renderer（Preview）

- `src/renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/StoryboardBoardViewer.tsx`
  - 视图由 `grid/timeline/flow` 改为 `canvas/timeline`；
  - 默认进入 `canvas`；
  - Canvas 需要传入 `storyboard.scenes`。
- `.../flow/shotFlowMapper.ts`
  - 生成 Scene 容器节点 + Shot 子节点；
  - 线性边保留，跨 Scene 边做视觉区分。
- `.../flow/FlowCanvasView.tsx`
  - 渲染 Scene 容器与 Shot 节点；
  - 暗色画布保留。
- `.../ShotDetailPanel.tsx`
  - “重新生成”按钮加载态；
  - 添加生成进度条与动画反馈。
- `.../ShotCard.tsx`
  - 支持 `image-generating` 状态点与动画。

### 2.5 测试

- `tests/unit/video/StoryboardService.test.ts`
  - 补充 Scene 归一化/分组/重排测试。
- `tests/unit/video/StoryboardBoardViewer.dom.test.tsx`
  - 适配 2 视图切换（Canvas + Timeline）；
  - 覆盖新状态渲染。

---

## 3. 执行顺序

1. 先改 `types + StoryboardService`，确保读写兼容稳定；
2. 再改 Harness 与 Bridge，保证 AI 输出与生成链路可用；
3. 同步更新 skills/contracts，保证后续生成一致；
4. 改 Preview 视图结构与 Canvas 场景容器；
5. 最后做进度反馈与测试补齐。

---

## 4. 验收标准

1. 同一 Scene 可包含多个 Shot，且文件持久化可回读；
2. 老项目（仅 `sceneIndex`）打开后不报错，自动映射 `sceneId`；
3. `storyboard_decompose` 支持 Scene+Shots 新输出；
4. Preview 为 2 视图，Canvas 中可见 Scene 容器包裹 Shot；
5. 点击“重新生成”后，按钮与节点可见生成中动画，完成后自动恢复；
6. 相关单测与 `tsc --noEmit` 通过。

