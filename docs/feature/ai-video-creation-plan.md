# AI 视频创作智能体工具 — 研究分析与实现规划

> 生成日期：2026-04-06

---

## 一、现有项目架构分析

### 1.1 整体结构

ClapFlow（AionUi）是一个多进程 Electron 应用，具备成熟的 AI 聊天平台能力：

```
src/
├── process/           # 主进程（Node.js/Electron，禁止使用 DOM API）
│   ├── bridge/        # IPC 处理器（44 个文件）
│   ├── services/      # 业务逻辑与基础设施
│   ├── database/      # SQLite 数据层
│   ├── task/          # 智能体/AI 编排（24 个文件）
│   ├── agent/         # AI 平台连接（8 个平台）
│   ├── extensions/    # 插件扩展系统
│   ├── worker/        # 后台工作进程
│   ├── webserver/     # Express + WebSocket 服务
│   ├── channels/      # 多渠道消息（Lark、钉钉、Telegram）
│   └── resources/     # 内置 Skills 和 MCP 服务（20+）
├── renderer/          # 渲染进程（React UI，禁止使用 Node.js API）
│   ├── pages/         # 页面模块（conversation、settings 等）
│   ├── components/    # 共享组件
│   ├── hooks/         # React Hooks
│   └── services/      # 客户端服务
├── common/            # 跨进程共享代码
│   ├── adapter/       # IPC bridge 类型定义
│   ├── chat/          # 图片生成核心逻辑
│   └── types/         # 共享类型
└── preload.ts         # IPC 桥接入口
```

### 1.2 多进程边界（严格遵守）

| 进程     | 路径                  | 禁止使用                    |
| -------- | --------------------- | --------------------------- |
| 主进程   | `src/process/`        | DOM API                     |
| 渲染进程 | `src/renderer/`       | Node.js/Electron 主进程 API |
| 工作进程 | `src/process/worker/` | Electron API、DOM API       |

跨进程通信必须经过 IPC 桥接（`src/preload.ts`）。

### 1.3 AI 平台能力

已集成的 AI 平台：

- **ACP（Office-AI 协议）** — 主企业协议，含 `AcpAgentManager.ts`、`AcpSkillManager.ts`
- **Gemini** — Google Gemini 模型
- **OpenClaw / NanoBot / Aionrs** — 内部/轻量协议
- **Bedrock** — AWS Bedrock 模型
- **Anthropic SDK** (`@anthropic-ai/sdk@0.71.2`) — Claude API

### 1.4 现有图片生成能力

- 核心逻辑：`src/common/chat/imageGenCore.ts`
- 内置 MCP 服务：`src/process/resources/builtinMcp/imageGenServer.ts`
  - 工具：`aionui_image_generation`（文生图、图片编辑、图片分析）
  - 支持 OpenAI、Gemini、Bedrock 等多供应商
  - 生成结果自动保存到工作区（时间戳命名）
- 图片处理：`sharp@0.34.3`

**当前无视频生成能力**，需新增。

### 1.5 Skills 系统

**开发时 Skills**（`.claude/skills/`）：用于 Claude Code 开发辅助。

**运行时 Skills**（`src/process/resources/skills/`）：20+ 内置领域技能，供 AI 智能体调用：

- `story-roleplay/` — 创意叙事
- `officecli-pptx/` — 演示文稿
- `mermaid/` — 图表生成
- `pdf/` — PDF 处理

通过 `AcpSkillManager.ts` 管理技能的加载与调用。

### 1.6 文件树与编辑器 UI

- **工作区组件**：`src/renderer/pages/conversation/Workspace/`
  - Arco Tree 组件构建文件树
  - 文件操作：创建、删除、重命名、拖拽导入
  - 多标签页文件编辑
  - `useWorkspaceTree.ts` — 树状态管理
- **编辑器**：Monaco Editor + CodeMirror
- **UI 库**：`@arco-design/web-react`（禁止使用原生 HTML 交互元素）
- **图标**：`@icon-park/react`
- **样式**：UnoCSS 工具类 + CSS Modules

### 1.7 消��流（现有）

```
Renderer → electronAPI.emit('chat.send.message')
         → preload → ipcRenderer.invoke
         → Bridge Handler → AgentManager
         → 流式响应
         → ipcRenderer.send('chat.response.stream')
         → Renderer 接收渲染
```

---

## 二、AI 视频创作工具需求分析

### 2.1 核心需求总结

| 需求                                        | 类型            |
| ------------------------------------------- | --------------- |
| 聊天式交互驱动创作流程                      | 交互设计        |
| 文件作为 LLM 上下文                         | 数据架构        |
| 分镜头画板 UI（右侧展示）                   | UI 组件         |
| 文件树 + 画板双向选中分镜头                 | 交互设计        |
| 多智能体 Harness 编排                       | 后端架构        |
| Skills 驱动专业逻辑（导演层/分镜/连续性等） | 技能系统        |
| 图片生成（分镜头图片）                      | AI 能力         |
| 视频生成（最终输出）                        | AI 能力（新增） |
| 过程文件本地化保存                          | 文件管理        |
| JSON 格式标准化输入输出                     | 数据标准        |

### 2.2 创作流程

```
用户提交剧本（文本/文件）
    ↓
[智能体 1 — 导演层] 剧本理解与风格定调
    ↓
[智能体 2 — 分镜师] 剧本 → 分镜头列表（JSON）
    ↓
[智能体 3 — 审核] 分镜连续性审核与修正
    ↓
[智能体 4 — 提示词工程师] 图片描述词 + 视频提示词生成
    ↓
[智能体 5 — 图片生成] 调用 imageGenCore 批量生成分镜图片
    ↓
[智能体 6 — 图片质检] 构图/一致性审核
    ↓
[智能体 7 — 视频生成] 调用视频 API 生成最终视频
    ↓
用户审核 → 通过聊天修改 → 重走对应步骤
```

---

## 三、实现方案设计

### 3.1 总体策略

**核心原则：文件为真源，Harness 为流程约束，Skills 为专业能力**

最大化复用现有能力，最小化改造范围：

| 现有能力                          | 复用方式                                          | 依据                                         |
| --------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| 聊天主链路（IPC + 流式响应）      | 直接承载视频创作对话                              | `conversationBridge` 已成熟                  |
| Workspace 文件树                  | 展示视频项目目录                                  | `src/renderer/pages/conversation/Workspace/` |
| Preview 右侧面板                  | 新增 `StoryboardBoardViewer` 作为一种 Viewer 类型 | 不新开大页面                                 |
| `@file` 文件上下文注入            | 剧本/分镜文件注入 AI 上下文                       | `processAtFileReferences` 已支持             |
| `PreviewContext.saveContent`      | 分镜 JSON 修改写回文件                            | 文件写回机制已有                             |
| Team Mode（`TeamSessionService`） | 作为多智能体 Harness 底座                         | `Mailbox` + `TaskManager` + `TeamMcpServer`  |
| AcpSkillManager                   | 加载视频创作专属 Skills                           | 按需加载机制已有                             |
| `imageGenCore` + MCP              | 分镜图片批量生成                                  | `aionui_image_generation` 已可用             |

### 3.2 本地项目文件结构标准

每个视频项目采用数字前缀目录，确保文件树排列顺序与创作流程一致：

```
video-project/
  00-script/
    script.md               # 原始剧本（Markdown）
  01-storyboard/
    storyboard.json         # 分镜总览索引（shots 引用列表）
    shots/
      shot-001.json         # 单镜头数据
      shot-002.json
      ...
  02-assets/
    characters/
      char-A.json           # 角色卡（外观描述 + 参考图路径）
    scenes/
      scene-01.json         # 场景卡
    props/
      prop-01.json          # 道具卡
    style-presets.json      # 风格模板库
  03-images/
    shot-001.png            # 生成的分镜图片
    shot-001_v2.png         # 历史版本
    ...
  04-videos/
    shot-001.mp4            # 单镜头视频
    animatic.mp4            # Animatic 预览（静帧拼接）
    final.mp4               # 最终成片
  90-memory/
    project-memory.json     # 项目长记忆（人物/场景/风格摘要）
  99-logs/
    harness-runs/
      run-20260406-1.json   # Harness 每次运行日志
```

### 3.3 新增模块清单

#### 3.3.1 后端（主进程）

```
src/process/
├── bridge/
│   └── videoCreationBridge.ts        # 视频创作 IPC 处理器
├── services/
│   └── video/
│       ├── StoryboardService.ts      # 分镜 JSON 读写与索引管理
│       ├── VideoGenService.ts        # 视频生成多供应商适配器
│       ├── AssetService.ts           # 角色/场景/道具资产管理
│       └── ProjectMemoryService.ts   # 项目记忆读写维护
└── task/
    └── video/
        └── VideoCreationHarness.ts   # 多智能体阶段编排（Team Mode 底座）
```

#### 3.3.2 前端（渲染进程）

不新建独立页面，扩展现有 Preview 面板：

```
src/renderer/pages/conversation/Preview/
└── viewers/
    └── StoryboardBoardViewer/        # 新增分镜画板 Viewer
        ├── StoryboardBoardViewer.tsx
        ├── ShotCard.tsx              # 单个分镜卡片
        ├── ShotDetailPanel.tsx       # 右侧详情面板（展开后）
        ├── AssetLibraryDrawer.tsx    # 资产库抽屉
        ├── TimelineView.tsx          # 时间轴视图
        └── StoryboardBoardViewer.module.css
```

#### 3.3.3 共享类型（`src/common/types/videoCreation.ts`）

> 所有类型统一在此文件定义，bridge 与 service 共享。

#### 3.3.4 Skills 目录（`src/process/resources/skills/video-creation-suite/`）

```
video-creation-suite/
  SKILL.md                    # 总 Skill：覆盖完整视频创作流程说明
  references/
    contracts.json            # 各阶段 JSON Schema 合约
    style-presets.json        # 内置风格预设库
  director/SKILL.md           # 导演层：风格定调 + 叙事结构
  storyboard/SKILL.md         # 分镜分解：景别/节奏/镜头类型决策
  continuity/SKILL.md         # 连续性审核：角色/服装/道具/机位检查
  prompt/SKILL.md             # 提示词工程：中文意图 → 双轨英文 prompt
  image-qa/SKILL.md           # 图片质检：构图/一致性/质量判断
  video-gen/SKILL.md          # 视频生成：参数配置 + 供应商选择建议
```

#### 3.3.5 IPC 桥接扩展（`src/common/adapter/ipcBridge.ts` 新增命名空间）

```typescript
videoCreation: {
  parseScript,          // 解析剧本 → 触发 director + storyboard 阶段
  runHarnessPhase,      // 手动触发指定阶段（带阶段名 + 作用域参数）
  updateShot,           // 聊天指令修改后更新单个分镜 JSON
  generateShotImages,   // 批量/单镜图片生成
  generateFinalVideo,   // 触发最终视频合成
  storyboardStream,     // 进度/状态/告警流式推送（emitter）
  getProjectMemory,     // 读取项目记忆
}
```

### 3.4 数据格式标准（JSON 合约）

#### 统一合约头（所有阶段输出必须包含）

```json
{
  "schemaVersion": "1.0.0",
  "projectId": "proj-xxx",
  "phase": "storyboard_decompose",
  "input": {},
  "output": {},
  "meta": {
    "agent": "storyboard",
    "timestamp": "2026-04-06T12:00:00Z",
    "durationMs": 3200
  }
}
```

#### Shot 完整字段定义

```typescript
type Shot = {
  id: string; // 唯一 ID（shot-001）
  sceneIndex: number; // 所属场景序号
  shotIndex: number; // 场景内分镜序号
  goal: string; // 本镜头叙事目标（一句话）
  sceneDescription: string; // 场景描述（中文）
  characters: string[]; // 出场角色 ID（引用 02-assets/characters）
  action: string; // 动作描述
  dialogue: string; // 对白
  shotType: 'EWS' | 'WS' | 'MS' | 'CU' | 'ECU'; // 景别
  cameraMove: 'static' | 'push' | 'pull' | 'pan' | 'tilt' | 'handheld'; // 运镜
  imagePrompt: string; // 图片生成提示词（英文，AI 生成）
  videoPrompt: string; // 视频生成提示词（英文，AI 生成）
  lockedTokens: string[]; // 锁定不可修改的 prompt token（角色名/风格等）
  continuityRefs: {
    // 连续性引用
    prevShotId?: string;
    sharedCharacters?: string[];
    sharedProps?: string[];
    sharedScene?: string;
  };
  assetRefs: string[]; // 引用的资产 ID 列表
  duration: number; // 预计时长（秒）
  imagePath?: string; // 生成图片路径（相对项目根）
  imageHistory?: string[]; // 历史生成版本路径（最近 5 次）
  videoPath?: string; // 生成视频路径
  status: 'pending' | 'prompts-ready' | 'image-generated' | 'image-approved' | 'video-generated' | 'approved';
  qaIssues?: QAIssue[]; // 质检问题列表
  locked: boolean; // 是否锁定（锁定后批量重生成跳过）
};

type QAIssue = {
  type: 'character-drift' | 'prop-missing' | 'style-shift' | 'composition';
  description: string;
  severity: 'warning' | 'error';
  suggestion: string;
};
```

#### DirectorStyle（项目级风格配置）

```typescript
type DirectorStyle = {
  genre: string; // 类型（动作/爱情/科幻等）
  visualStyle: string; // 视觉风格描述
  colorPalette: string; // 色彩方案
  cameraPreferences: string[]; // 偏好运镜列表
  referenceWorks?: string[]; // 参考作品
  negativeStyle?: string; // 明确排除的风格
};
```

### 3.5 Harness 架构设计

基于现有 Team Mode（`TeamSessionService` + `Mailbox` + `TaskManager`）构建阶段门控：

```
VideoCreationHarness（src/process/task/video/VideoCreationHarness.ts）
│
├── Phase 1: director
│   输入: script.md → 输出: DirectorStyle + 分镜草稿骨架
│   门控: DirectorStyle JSON Schema 校验通过才推进
│
├── Phase 2: storyboard_decompose
│   输入: 分镜草稿 → 输出: shot-XXX.json × N（完整分镜列表）
│   门控: 每个 shot 字段完整性校验
│
├── Phase 3: continuity_review
│   输入: shot-XXX.json × N → 输出: 修正后 shot 列表 + continuityRefs 填充
│   门控: 无 error 级 QA 问题才通过
│
├── Phase 4: prompt_pack
│   输入: shot 列表 → 输出: imagePrompt + videoPrompt（双轨，英文）
│   门控: 提示词非空且含 lockedTokens
│
├── Phase 5: image_generate
│   输入: shot 列表 → 调用 imageGenCore → 输出: imagePath 填充
│   特性: 并发批量生成，锁定镜头跳过，失败自动重试 1 次
│
├── Phase 6: image_qa
│   输入: 含图 shot 列表 → 输出: qaIssues 填充 + status 更新
│   特性: error 级问题自动回退到 Phase 4 重跑 prompt
│
└── Phase 7: video_generate
    输入: status=image-approved 的 shot 列表 → 输出: videoPath + final.mp4
    特性: 先生成 animatic（静帧拼接预览），用户确认后再出正式视频

失败回滚规则：
- JSON Schema 校验失败 → 重试同阶段（最多 3 次）→ 标记 error 等待用户介入
- 单镜头失败 → 跳过继续 → 批次结束后汇报失败列表
- 跨阶段回退 → 仅重跑受影响镜头子集，不全量重生成
```

每次 Harness 运行写入 `99-logs/harness-runs/run-<timestamp>.json` 用于追溯。

### 3.6 UI 交互设计

#### 布局方案（复用现有框架）

```
┌──────────────────────────────────────────────────────────┐
│ 左侧：Workspace 文件树      │ 右侧：StoryboardBoardViewer │
│ video-project/              │ [网格▼][时间轴][列表]  [S M L]│
│ ├── 00-script/              │ ┌────────┐ ┌────────┐       │
│ │   └── script.md    ●      │ │ 🔒 镜1 │ │  镜2   │       │
│ ├── 01-storyboard/          │ │ [图片] │ │ [生成]│       │
│ │   ├── storyboard.json     │ └────────┘ └────────┘       │
│ │   └── shots/              │ ┌────────┐ ┌────────┐       │
│ │       ├── shot-001.json ● │ │  镜3   │ │ ⚠ 镜4  │       │
│ │       └── shot-002.json   │ │ [图片] │ │ [QA!] │       │
│ ├── 02-assets/              │ └────────┘ └────────┘       │
│ └── 03-images/              │              [资产库]        │
├──────────────────────────────────────────────────────────┤
│ 底部聊天区：现有 SendBox（支持 @file 注入分镜文件）         │
└──────────────────────────────────────────────────────────┘
```

#### 镜头详情侧栏（点击卡片后右侧展开）

```
┌─── 镜头详情：shot-003 ────────────────┐
│ [图片预览大图]  [← 历史 1/5 →]  [对比] │
│ ─────────────────────────────────────  │
│ 叙事目标: 主角发现线索，情绪转折        │
│ 景别: [中景 ▼]  运镜: [固定 ▼]         │
│ 时长: ●────── 4s ──────── 10s          │
│ ─────────────────────────────────────  │
│ 图片提示词 ▼（可编辑）                  │
│  cinematic photo, mid shot, ...        │
│ 视频提示词 ▼（可编辑）                  │
│  camera static, character walks...     │
│ 锁定 Token：[角色A外观] [赛博朋克风格]  │
│ ─────────────────────────────────────  │
│ 参考图: [+上传]  [角色A参考] [场景参考]  │
│ ─────────────────────────────────────  │
│ QA 问题: ⚠ 角色服装与第2镜不一致        │
│          → [按建议修复并重跑]           │
│ ─────────────────────────────────────  │
│ [🔒锁定] [🔄重新生成] [💾保存]          │
└────────────────────────────────────────┘
```

#### 关键交互

1. **文件树 ↔ 画板双向联动**：点击 `shot-001.json` → 画板高亮；点击卡片 → 文件树定位
2. **聊天修改分镜**：识别目标镜头 → Harness 重跑受影响阶段 → 写回文件 → 画板原地刷新
3. **后台生成不阻塞**：批量图片生成期间用户可继续编辑其他镜头，完成后卡片静默更新
4. **Animatic 预览**：正式视频生成前先输出 `animatic.mp4`（静帧+时长）供用户确认节奏

### 3.7 视频生成 API 接入

新增 `VideoGenService.ts`，与 `imageGenCore` 模式一致，统一多供应商适配：

| 供应商            | 能力                 | 适用场景               |
| ----------------- | -------------------- | ---------------------- |
| Runway ML (Gen-4) | 图片转视频、文生视频 | 写实风格，运镜控制强   |
| Kling（可灵）     | 图片转视频           | 中文语境优化，性价比高 |
| Wan（万象）       | 文生视频、图生视频   | 国内访问稳定           |
| Pika Labs         | 文生视频             | 创意风格，快速原型     |

所有供应商通过统一接口封装，用户在设置中配置 API Key 后即可切换。

### 3.8 项目长记忆（`90-memory/project-memory.json`）

每次 Harness 运行后自动维护，记录：

```json
{
  "projectId": "proj-xxx",
  "characters": {
    "char-A": { "name": "主角", "appearance": "...", "lockedTokens": [...] }
  },
  "scenes": { "scene-01": { "description": "...", "timeOfDay": "黄昏" } },
  "style": { "genre": "赛博朋克漫剧", "visualStyle": "..." },
  "continuityNotes": ["角色A第3镜后换装，第4镜起着黑色外套"],
  "lastHarnessRun": "run-20260406-1.json"
}
```

`ProjectMemoryService` 在每个 Skill 调用时将精简的 memory 摘要注入上下文，避免全量注入过长内容。

### 3.9 风险规避

| 风险           | 规避策略                                                            |
| -------------- | ------------------------------------------------------------------- |
| 上下文过长     | 每次只注入「当前阶段 + 相关镜头子集 + memory 摘要」，不注入全量文件 |
| 多智能体失控   | Harness 强制阶段门控，JSON Schema 校验失败不得推进                  |
| 文件并发写冲突 | shot 级文件锁 + 串行写策略（`StoryboardService` 内部队列）          |
| 模型输出漂移   | JSON Schema 校验失败立即重试（最多 3 次），超限回退等待用户介入     |
| 大批量生成成本 | 锁定通过镜头跳过重生成；失败镜头单独重跑不影响其他                  |

---

## 四、实现优先级与里程碑

### M1（骨架，约 1~2 天）

- 定义 `src/common/types/videoCreation.ts`（Shot/Storyboard/DirectorStyle 等类型）
- 创建视频项目文件规范（`video-project/` 目录结构 + 示例文件）
- 创建 `video-creation-suite` Skills 骨架（SKILL.md + contracts.json）
- 实现 `VideoCreationHarness.ts` 骨架（仅阶段流转 + 日志，无 AI 调用）
- 新增 `videoCreationBridge.ts` 基础结构

### M2（核心链路，约 2~4 天）

- 实现 `StoryboardService`（分镜 JSON 读写 + 文件锁）
- 实现 `ProjectMemoryService`（project-memory.json 读写）
- 新增 `StoryboardBoardViewer`（画板 UI，卡片网格 + 状态展示）
- 打通"聊天指令 → `updateShot` → 文件写回 → `storyboardStream` 推送 → 画板刷新"端到端链路
- 文件树 ↔ 画板双向联动

### M3（图像生成与质检，约 2~4 天）

- Harness Phase 1-4 接入 AI（director / storyboard / continuity / prompt）
- 复用 `imageGenCore` 实现 Phase 5 批量生成（并发 + 锁定跳过）
- 实现 `image-qa` Skill + Phase 6（问题标注 + 自动回退）
- ShotDetailPanel 完整 UI（景别/运镜/时长/提示词编辑/历史版本/QA 批注）

### M4（视频生成与收尾，约 3~5 天）

- 实现 `VideoGenService`（多供应商适配，先支持 Kling + Runway）
- Animatic 生成（静帧拼接 + 时长）
- Phase 7 视频生成 + final.mp4 合成
- 时间轴视图（TimelineView）
- 资产库抽屉（AssetLibraryDrawer）
- 操作历史与快照回滚

---

## 五、关键技术决策

| 问题         | 决策                                                      | 理由                           |
| ------------ | --------------------------------------------------------- | ------------------------------ |
| 分镜数据存储 | 文件（JSON），不用数据库                                  | 本地化、可直接编辑、Git 可追踪 |
| 智能体编排   | 基于 Team Mode（TeamSessionService）新增 Harness 阶段门控 | 复用现有多智能体底座           |
| UI 布局      | 扩展现有 Preview 面板新增 Viewer 类型，不新建页面         | 最小改造，不破坏主链路         |
| 视频生成     | 新增 VideoGenService，与 imageGenCore 同模式              | 统一多供应商适配模式           |
| IPC 通信     | 新增 videoCreationBridge 命名空间                         | 保持架构一致性                 |
| Skills 格式  | JSON 合约头 + SKILL.md 规范，双轨 prompt                  | 与现有 Skills 体系一致         |
| 上下文注入   | 仅注入当前阶段相关镜头子集 + memory 摘要                  | 避免上下文溢出                 |
| 角色一致性   | lockedTokens + 资产库 + continuityRefs 自动注入           | 状态管理而非人工记忆           |

## 六、与 roadmap 文档的整合说明

本文档已整合 `docs/research/ai-video-multi-agent-harness-roadmap.md` 的以下关键内容：

- **文件结构**：采用数字前缀目录（00~99）+ `90-memory/` + `99-logs/` 的完整规范
- **Team Mode 底座**：Harness 基于 `TeamSessionService` + `Mailbox` + `TaskManager` 构建
- **JSON 合约头**：统一 `schemaVersion` + `projectId` + `phase` + `meta` 结构
- **Shot 字段补全**：增加 `goal`、`continuityRefs`、`assetRefs`、`lockedTokens`、`qaIssues`
- **Animatic 流程**：视频生成前先出静帧拼接预览，用户确认节奏后再正式生成
- **Prompt 变量锁定**：`lockedTokens` 机制保护角色名/风格 token 不被批量修改覆盖
- **风险规避策略**：上下文聚焦、文件锁、Schema 校验失败重试机制

> 具体开发计划见：`docs/feature/ai-video-creation-dev-plan.md`

---

## 七、补充分析：三个核心问题的深度思考

### 7.1 IPC 处理器的作用（结合本项目解释）

#### 问题根源：为什么需要 IPC？

Electron 应用天生是多进程架构：渲染进程（React UI）运行在沙箱中，无法直接访问文件系统、数据库、操作系统 API。但 UI 又需要读写文件、调用 AI 模型、访问数据库。IPC（进程间通信）就是解决这个矛盾的桥梁。

#### 三层结构

```
渲染进程（UI/React）
      │  调用 ipcBridge.xxx.invoke(params)
      ▼
preload.ts（安全沙箱边界）
      │  contextBridge.exposeInMainWorld → window.electronAPI.emit()
      │  序列化参数 → ipcRenderer.invoke()
      ▼
主进程 Bridge Handler（src/process/bridge/*.ts）
      │  注册：ipcBridge.xxx.provider(async (params) => { ... })
      │  执行：文件读写 / 数据库操作 / 调用 AI 模型
      ▼
返回结果 → 渲染进程更新 UI
```

**主动推送方向（主进程 → 渲染进程）：**

```
主进程（AgentManager 流式响应）
      │  ipcBridge.conversation.responseStream.emit(message)
      ▼
preload.ts → ipcRenderer.send()
      ▼
渲染进程监听 → ipcBridge.conversation.responseStream.on(callback)
      ▼
UI 实时更新（打字机效果）
```

#### 在本项目中的具体作用

| Bridge 文件                        | 职责                                      |
| ---------------------------------- | ----------------------------------------- |
| `conversationBridge.ts`            | 创建/查询会话、发送消息、接收 AI 流式响应 |
| `fsBridge.ts`                      | 读写文件、列目录、监听文件变化            |
| `mcpBridge.ts`                     | 管理 MCP 服务器的启动/停止/工具调用       |
| `acpConversationBridge.ts`         | ACP 协议的智能体消息路由                  |
| （待新增）`videoCreationBridge.ts` | 分镜读写、图片生成、视频生成的 IPC 入口   |

#### 核心价值总结

1. **安全隔离**：UI 代码无法直接操作文件系统，防止恶意注入
2. **类型安全**：`bridge.buildProvider<返回类型, 参数类型>()` 编译期检查，杜绝类型错误
3. **统一契约**：`ipcBridge.ts` 是所有跨进程通信的唯一声明文件，45+ 个端点一目了然
4. **双向通信**：`.invoke()` 做请求-响应，`.on()` / `.emit()` 做事件推送（如流式 AI 输出）

---

### 7.2 AI 视频创作的门槛与痛点深度分析

#### 7.2.1 核心技能壁垒全景图

以 AI 漫剧或 AI 广告为例，从剧本到成片需要跨越以下技能：

| 技能域          | 具体要求                   | 耗时占比 | 门槛高低 |
| --------------- | -------------------------- | -------- | -------- |
| 提示词工程      | 图片/视频生成提示词撰写    | ★★★★★    | ★★★★★    |
| 影视镜头语言    | 景别、运镜、蒙太奇节奏     | ★★★☆☆    | ★★★★☆    |
| 角色/风格一致性 | 跨镜头保持外观统一         | ★★★★☆    | ★★★★★    |
| 工具链操作      | ComfyUI/ControlNet/LoRA 等 | ★★★☆☆    | ★★★★☆    |
| 迭代判断力      | 判断生成结果是否合格       | ★★★★☆    | ★★★☆☆    |
| 最终剪辑        | 片段排列、转场、字幕       | ★★☆☆☆    | ★★☆☆☆    |

#### 7.2.2 最耗时的三个步骤

**第一名：提示词多轮迭代（占全流程 40-60% 时间）**

一个分镜的图片往往需要：

- 第1次生成 → 构图不对 → 修改提示词
- 第2次生成 → 人物变形 → 加负面提示词
- 第3次生成 → 风格偏了 → 调整权重
- 第4次生成 → 细节不满意 → 换种子值
- 重复 5-15 次才能得到可用结果

每次修改都是"猜测→验证→再猜测"的盲试过程，极其消耗精力。

**第二名：角色一致性维护（占全流程 20-30% 时间）**

每到一个新场景，同一角色可能因光线、姿态、角度不同而面目全非。解决方案（IP-Adapter、ControlNet 角色参考、LoRA 训练）都需要深厚的技术积累，且每次微调都要重新生成。

**第三名：分镜规划（占全流程 10-20% 时间）**

剧本是文字，分镜是视觉语言。需要做的决策包括：

- 这段对话用几个镜头？各占多长？
- 情绪高潮时用哪种景别和运镜？
- 镜头之间如何转换才显得流畅？

这需要真正的影视创作经验，没有捷径。

#### 7.2.3 技能要求的本质

**提示词工程的本质**：将人脑的视觉直觉翻译成模型能理解的语言。

> 人想的是"一个凄美的黄昏"，模型需要的是 `"golden hour lighting, warm amber tones, long shadows, cinematic, lens flare, depth of field, highly detailed"`。这是两种完全不同的表达体系，中间的翻译成本就是提示词工程的代价。

**角色一致性的本质**：在无状态的生成模型之间传递"视觉状态"。

> 每次调用图片 API 都是一次无记忆的全新生成。保持一致性，本质上是在用参考图、权重、LoRA 等方式，把"这个角色的样子"外挂给模型。这是一个状态管理问题，不是创作问题。

**分镜规划的本质**：空间叙事能力——用镜头组合来控制观众的情绪和注意力。

> 这是导演的核心专业能力，几十年电影语言积累形成的语法体系。

#### 7.2.4 本项目如何系统性降低门槛

| 痛点       | 传统做法                    | 本项目解法                                                 | 降低难度方式                             |
| ---------- | --------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| 提示词撰写 | 用户自己写、反复试          | `prompt-engineer` Skill 自动生成专业英文提示词             | 用户只描述中文意图，技能层完成翻译       |
| 角色一致性 | 手动管理参考图、LoRA        | 资产库 + `character-consistency` Skill 自动附加参考描述    | 系统维护"角色视觉档案"，每次生成自动注入 |
| 分镜规划   | 需要影视专业知识            | `storyboard` Skill 内置导演经验，自动做景别/节奏决策       | 将专家经验编码进 Skill，用户无需学习     |
| 工具链复杂 | ComfyUI、ControlNet参数调整 | 统一 API 接入，界面只暴露高层概念                          | 技术细节全部封装在 Skill 和 Service 层   |
| 迭代判断   | 人工盯着每张图评价          | `image-qa` Skill 自动质检 + 批注                           | AI 做初筛，人只需审核 AI 标记的问题图    |
| 连续性管理 | 人工逐镜对比                | `continuity-review` Skill 自动检查前后镜头的人物/道具/场景 | 将连续性导演的工作交给 AI                |

**总结**：本项目的核心价值，是把 AI 视频创作中所有需要专业知识的环节，通过可迭代的 Skills 封装成"经验数据库"，用户只需用自然语言表达创意意图，技术实现由系统完成。**门槛从"掌握工具技术"降至"有故事可讲"。**

---

### 7.3 编辑能力设计：以资深 AI 视频创作者视角

#### 7.3.1 必须有的编辑能力（不可缺失）

以一个 20 镜的 AI 广告项目为例，以下操作每个项目必然发生多次：

**分镜结构层**

- **拖拽重排**：灵感迸发后发现第 5 镜放到第 2 镜叙事更流畅，直接拖动
- **插入分镜**：看完整体觉得两个场景之间缺一个过渡镜，点击间隙插入
- **复制分镜**：角色 A 和角色 B 的反应镜要保持相同构图，复制后改提示词
- **删除分镜**：整体节奏太慢，直接删掉某几个过渡镜
- **合并场景**：两个独立场景合并为一个连续场景

**单镜精细编辑层**

- **提示词直接编辑**：不走聊天，直接点击卡片上的提示词文字原地编辑，`Ctrl+Enter` 确认并重新生成
- **一键重新生成**：对图不满意，单击刷新按钮重新生成（保持其他分镜不变）
- **锁定/解锁分镜**：满意的分镜加锁，批量重新生成时跳过
- **参考图替换**：上传本地图片作为该镜的风格/构图参考
- **镜头参数面板**：下拉菜单快速选择景别（大远景/远景/中景/近景/特写）和运镜类型（固定/推/拉/横移/手持），选择后自动注入提示词

**批量操作层**

- **多选**：`Shift+点击` 或框选多个分镜卡片
- **批量重新生成**：选中 N 个分镜，一键全部重新生成
- **批量应用风格**：选中多镜，统一覆盖某个风格词（如统一换成"赛博朋克风格"）
- **批量调整时长**：选中多镜，统一设置 3 秒/5 秒

**历史与回退层**

- **每镜生成历史**：每个分镜保留最近 5 次生成结果，横向滑动查看历史版本
- **快速回退**：觉得改坏了，点击历史缩略图一键恢复
- **整体快照**：重大改版前保存整体快照（类似 Git 的 commit），支持回退

#### 7.3.2 直接 UI 编辑 vs 聊天编辑的分工

不是所有编辑都适合走聊天，两种模式应该互补：

| 操作类型                   | 推荐交互方式         | 理由                          |
| -------------------------- | -------------------- | ----------------------------- |
| 拖拽重排                   | 直接 UI（拖拽）      | 视觉操作，聊天表达低效        |
| 修改单个字段（时长、景别） | 直接 UI（下拉/滑块） | 明确的结构化参数              |
| 重新生成单镜               | 直接 UI（按钮）      | 一次点击，无需解释            |
| 提示词微调                 | 直接 UI（原地编辑）  | 已知目标，精准操作            |
| 风格方向调整               | 聊天                 | 涉及意图理解，AI 更擅长       |
| 连续性问题修复             | 聊天                 | 需要跨镜头分析，AI 更擅长     |
| 角色外观调整               | 聊天                 | 需要理解"人物形象"语义        |
| 插入新场景                 | 聊天 + UI 确认       | AI 生成建议，用户 UI 确认位置 |

#### 7.3.3 完整的 UI 交互功能清单

##### A. 分镜画板层

```
画板工具栏：
├── [视图切换]  网格视图 / 时间轴视图 / 列表视图
├── [缩放]     缩略图大小调节（S/M/L）
├── [筛选]     按状态筛选（待生成/已生成/已锁定/有问题）
├── [批量操作] 全选 / 反选 / 按状态选 / 批量生成 / 批量锁定
└── [快照]     保存当前版本 / 查看历史版本

卡片操作（悬浮菜单）：
├── [重新生成]  单镜重新生成
├── [编辑提示词] 原地展开编辑框
├── [锁定/解锁]
├── [插入前/后]  在此镜前/后插入新分镜
├── [复制]
├── [删除]
└── [查看历史]  展开生成历史横向滚动条
```

##### B. 分镜详情面板（点击卡片后右侧展开）

```
详情面板：
├── [预览区]    图片大图预览，支持对比（当前 vs 历史）
├── [镜头参数]
│   ├── 景别：[大远景▼] 下拉选择
│   ├── 运镜：[固定▼] 下拉选择
│   └── 时长：[3s ←——●——→ 10s] 滑块
├── [图片提示词]  可折叠的可编辑文本区
├── [视频提示词]  可折叠的可编辑文本区
├── [场景描述]    中文说明（仅展示/供 AI 参考）
├── [参考图]      上传/替换参考图（角色/场景/风格）
├── [生成历史]    最近 5 次结果缩略图，点击恢复
└── [审核批注]    添加文字批注（协作审核用）
```

##### C. 资产库（侧边抽屉）

```
资产库：
├── [角色]    已定义角色的参考图 + 外观描述卡片
│             操作：新增、编辑、应用到选中分镜
├── [场景]    背景/环境参考图
├── [道具]    重要道具参考图
└── [风格模板] 保存的风格配置（可一键应用到全部/选中分镜）
```

##### D. 脚本与分镜联动

```
脚本面板（左侧或上方可收起）：
├── 内联编辑：直接修改剧本文字，保存后触发 AI 更新对应分镜
├── 段落高亮：鼠标悬停剧本段落 → 画板对应分镜高亮
├── 双向跳转：点击画板分镜 → 脚本滚动到对应段落
└── 差异对比：显示 AI 分镜结果与原始剧本的映射关系
```

##### E. 时间轴视图（视频节奏专用）

```
时间轴（切换到时间轴视图时显示）：
├── 横轴为时间，每个分镜显示为色块（宽度=时长）
├── 拖拽色块左右边缘调整时长
├── 拖拽色块位置调整顺序
├── 色块上显示缩略图和时长数字
└── 底部显示总时长
```

#### 7.3.4 关键 UX 原则

1. **就地编辑**：修改任何内容不应跳转离开画板，原地展开/收起编辑区
2. **立即可见**：修改提示词后，重新生成按钮即时高亮，结果回来后图片原地替换
3. **不打断节奏**：批量生成在后台执行，用户可以继续编辑其他分镜，完成后卡片静默更新
4. **可撤销一切**：所有操作支持 `Ctrl+Z` 撤销，包括"重新生成"（可回退到上一次结果）
5. **状态透明**：每个分镜卡片用颜色/图标清晰标示当前状态（等待中/生成中/已完成/有问题/已锁定）

---

_本文档由 Claude Code 基于项目代码分析自动生成，作为 AI 视频创作工具开发的起点参考。_
