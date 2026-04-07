# AI 视频多智能体工具 — 具体开发计划（Implementation Plan）

> 日期：2026-04-06  
> 融合来源：
>
> - `docs/research/ai-video-multi-agent-harness-roadmap.md`
> - `docs/feature/ai-video-creation-plan.md`

---

## 1. 目标与边界

## 1.1 目标

在现有 ClapFlow 架构上落地可用 MVP：

1. 聊天驱动视频创作流程（剧本→分镜→提示词→图片→视频）
2. 文件树 + 画板 + 聊天三端实时同步
3. Harness 约束多智能体阶段协作
4. Skills 可编辑迭代（专业经验沉淀）

## 1.2 非目标（MVP 不做）

1. 高级 NLE（完整时间线剪辑器）
2. 全自动配音/配乐工程化流水线
3. 云端协作与多人实时编辑

---

## 2. 总体落地策略

采用 **双阶段 UI 策略**：

- **Phase A（MVP）**：内嵌现有 conversation 页面（复用 `Workspace + Preview + SendBox`）
- **Phase B（增强）**：根据使用反馈决定是否抽出独立 `videoCreation` 页面

采用 **文件真源 + JSON 合约 + 阶段门控**：

- 文件是真实状态，不依赖数据库持久化中间产物
- Harness 必须基于 schema 校验推进阶段
- 所有重跑支持“按镜头/按场景/按全片”粒度

---

## 3. 里程碑与交付物

## M1：领域模型与桥接骨架（3~4 天）

### 交付

1. 领域类型与 JSON 合约
2. `videoCreation` IPC 端点与空实现
3. Storyboard 文件读写服务
4. Skills 骨架目录

### 代码清单

- `src/common/types/videoCreation.ts`（新增）
- `src/common/adapter/ipcBridge.ts`（扩展 `videoCreation` 命名空间）
- `src/process/bridge/videoCreationBridge.ts`（新增）
- `src/process/services/video/StoryboardService.ts`（新增）
- `src/process/services/video/AssetService.ts`（新增）
- `src/process/resources/skills/video-creation-suite/...`（新增）

### 验收标准

- 能创建 `video-project` 目录并生成 `storyboard.json`
- 前端可通过 IPC 读取/更新某个 `shot` 字段
- 类型定义可通过 `bunx tsc --noEmit`

---

## M2：画板 MVP + 文件联动 + 聊天改镜（4~6 天）

### 交付

1. Preview 新增 Storyboard Viewer
2. 文件树与画板双向选中
3. 聊天指令触发 `updateShot` 并写回文件
4. 基础批量编辑（多选 + 批量时长/状态修改）

### 代码清单

- `src/common/types/preview.ts`（扩展内容类型，例如 `storyboard`）
- `src/renderer/pages/conversation/Preview/components/viewers/StoryboardViewer.tsx`（新增）
- `src/renderer/pages/conversation/Preview/components/viewers/index.ts`（注册）
- `src/renderer/pages/conversation/Workspace/hooks/useWorkspaceFileOps.ts`（shot 文件打开策略扩展）
- `src/renderer/pages/conversation/Workspace/index.tsx`（选中联动事件扩展）
- `src/renderer/utils/emitter.ts`（必要事件扩展）

### 验收标准

- 点击 `shot-001.json` 可在右侧画板打开并高亮镜头
- 画板点击镜头可回定位文件树
- 聊天“修改第 N 镜”后，`shots/shot-NNN.json` 被正确写回，UI 自动刷新

---

## M3：Harness + 图片生成 + 质检闭环（5~7 天）

### 交付

1. VideoCreationHarness 阶段编排
2. 接入 `aionui_image_generation` 批量生图
3. image-qa Skill 输出问题清单
4. 局部重跑（镜头级）

### 代码清单

- `src/process/task/video/VideoCreationHarness.ts`（新增）
- `src/process/services/video/HarnessRunService.ts`（新增，可选）
- `src/process/services/video/ImageGenerationService.ts`（新增，封装 imageGenCore/MCP）
- `src/process/resources/skills/video-creation-suite/image-qa/SKILL.md`（新增）

### 验收标准

- 可执行 `director -> storyboard -> prompt -> image_generate -> image_qa`
- 失败镜头可按镜头重跑，不影响已通过镜头
- 质检结果可回写到 shot 的 `qa` 字段并在 UI 可见

---

## M4：视频生成与导出（4~6 天）

### 交付

1. VideoGenService（至少 1 个供应商先打通）
2. 镜头视频生成 + final 合成（可先简单拼接）
3. 导出产物与 run 日志归档

### 代码清单

- `src/process/services/video/VideoGenService.ts`（新增）
- `src/process/services/video/VideoComposeService.ts`（新增，可选）
- `src/process/bridge/videoCreationBridge.ts`（扩展 `generateVideo`/`composeFinal`）

### 验收标准

- 对某个 shot 生成视频并写入 `04-videos/shot-xxx.mp4`
- 能输出 `04-videos/final.mp4`（哪怕是 MVP 拼接）
- UI 可查看生成状态与失败原因

---

## 4. API / IPC 明细（MVP）

建议在 `ipcBridge.videoCreation` 下提供：

1. `initProject({ workspace, script })`
2. `loadStoryboard({ projectPath })`
3. `updateShot({ projectPath, shotId, patch })`
4. `runHarnessPhase({ projectPath, phase, selection })`
5. `generateImages({ projectPath, shotIds, provider })`
6. `generateVideos({ projectPath, shotIds, provider })`
7. `composeFinal({ projectPath })`
8. `storyboardStream`（阶段状态、进度、告警）

---

## 5. JSON 合约与文件规范

## 5.1 关键文件

- `00-script/script.md`
- `01-storyboard/storyboard.json`
- `01-storyboard/shots/shot-*.json`
- `90-memory/project-memory.json`
- `99-logs/harness-runs/*.json`

## 5.2 最小 shot schema

```json
{
  "id": "shot-001",
  "sceneIndex": 1,
  "shotIndex": 1,
  "goal": "...",
  "duration": 3,
  "imagePrompt": "...",
  "videoPrompt": "...",
  "assetRefs": [],
  "status": "pending"
}
```

## 5.3 版本与兼容

- 强制 `schemaVersion`
- 读文件先做 migration（低版本自动升级）
- 新字段必须向后兼容，旧字段不立刻删除

---

## 6. UI 需求拆解（MVP 必做 / 增强可选）

## 6.1 MVP 必做

1. 画板卡片展示（缩略图、状态、时长）
2. 单镜编辑（prompt、时长、状态）
3. 拖拽排序
4. 多选批量操作（时长/状态）
5. 结果版本切换（至少最近 3 次）
6. 一键重生（单镜）

## 6.2 增强可选（M4+）

1. 连续性告警面板
2. Prompt Diff 视图
3. 时间轴 animatic 视图
4. 批量重跑控制台（场景级/全片级）

---

## 7. Skills 计划（可直接建目录）

```text
src/process/resources/skills/video-creation-suite/
  SKILL.md
  references/contracts.json
  director/SKILL.md
  storyboard/SKILL.md
  continuity/SKILL.md
  prompt/SKILL.md
  image-qa/SKILL.md
  video-gen/SKILL.md
```

每个子 Skill 必须包含：

1. 输入字段定义
2. 输出字段定义
3. 失败重试策略
4. 与 Harness phase 的绑定关系

---

## 8. 测试与质量门禁

## 8.1 每个里程碑必须通过

```bash
bun run lint:fix
bun run format
bunx tsc --noEmit
bun run test
```

若改动涉及 `src/renderer/` 或 i18n：

```bash
bun run i18n:types
node scripts/check-i18n.js
```

## 8.2 建议新增测试

1. `tests/unit/video/storyboardService.test.ts`
2. `tests/unit/video/videoCreationBridge.test.ts`
3. `tests/unit/video/videoCreationHarness.test.ts`
4. `tests/dom/video/storyboardViewer.dom.test.tsx`

---

## 9. 风险与应对

1. **模型输出不稳定**：Harness 增加 schema 校验 + 自动重试
2. **上下文膨胀**：按 phase + shot 子集注入上下文
3. **并发写冲突**：shot 粒度串行写，避免同镜并发写入
4. **供应商 API 波动**：VideoGenService 做 provider 抽象与降级

---

## 10. 可执行任务清单（按优先级）

### P0（先做）

1. 建 `videoCreation` 类型 + IPC + StoryboardService
2. 做 Storyboard Viewer 并打通文件联动
3. 聊天改单镜并写回 JSON

### P1（随后）

4. Harness 阶段执行 + 图片批量生成
5. image-qa 与局部重跑

### P2（增强）

6. 视频生成 provider 接入
7. final 合成 + 导出
8. 连续性告警/Prompt Diff/时间轴视图

---

## 11. Definition of Done（项目完成定义）

满足以下条件视为第一版完成：

1. 用户可从脚本创建分镜并在画板编辑
2. 用户可通过聊天改镜并看到文件/UI实时同步
3. 用户可批量生成分镜图片并查看质检结果
4. 用户可至少通过 1 个视频供应商生成镜头视频并导出 final
5. 全链路有运行日志与失败可定位信息
