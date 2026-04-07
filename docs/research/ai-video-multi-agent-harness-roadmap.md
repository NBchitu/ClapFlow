# 基于 ClapFlow 的 AI 视频创作多智能体方案（Harness + Skills）研究

> 日期：2026-04-06
> 目标：在现有项目上，最快落地“聊天驱动 + Skills 可迭代 + 多智能体协同 + 本地文件化”的 AI 视频创作工具。

---

## 1. 现有项目可复用能力（As-Is）

### 1.1 已具备的核心基础

1. **多进程架构完整**（`src/process` / `src/renderer` / `src/preload.ts`）
2. **聊天主链路成熟**（IPC、流式响应、任务管理）
3. **Workspace 文件树 + 预览编辑已打通**
   - 左侧文件树：`src/renderer/pages/conversation/Workspace/`
   - 右侧预览编辑：`src/renderer/pages/conversation/Preview/`
   - 文件修改可写回原文件（`PreviewContext.saveContent`）
4. **文件可作为对话上下文**
   - 发送框支持 `@file` / 文件选择注入（`AcpSendBox` + `processAtFileReferences`）
5. **Skills 体系成熟**
   - 运行时 Skills：`src/process/resources/skills/`
   - Skills 按需加载：`AcpSkillManager`
   - 支持用户自定义 Skills（`config/skills`）
6. **多智能体 Team Mode 已有雏形**
   - 会话与团队：`src/process/team/TeamSessionService.ts`
   - 消息与任务：`Mailbox` + `TaskManager` + `TeamMcpServer`
7. **图片生成能力现成**
   - `imageGenCore` + 内置 MCP `aionui_image_generation`

### 1.2 与你需求的天然匹配点

- 你要的“**聊天驱动创作流程**”：现有会话架构可直接承载
- 你要的“**文件即上下文**”：现有 Workspace + `@file` 已支持
- 你要的“**Skills 可迭代**”：现有 Skills 目录/加载机制已支持
- 你要的“**多智能体协作**”：Team Mode 可作为 Harness 运行底座

---

## 2. 当前差距（Gap）

1. **缺少视频创作领域模型**：没有统一 `script/storyboard/shots/assets` 文件规范
2. **缺少分镜画板视图**：当前右侧是通用 Preview，不是“分镜卡片画板”
3. **缺少强约束 Harness**：目前 Team 协作偏通用，没有“阶段门控 + 输入输出校验”
4. **缺少视频生成服务层**：只有图像生成，没有统一视频生成适配器
5. **缺少创作长记忆层**：现有是聊天历史 + 文件上下文，缺项目级记忆索引

---

## 3. 建议的快速落地策略（To-Be）

### 原则：**文件为真源，Harness 为流程约束，Skills 为专业能力**

- **真源（Source of Truth）**：全部过程数据落地为本地 JSON/Markdown/资产文件
- **流程约束**：Harness 只推进“已通过校验”的阶段输出
- **专业能力**：导演/分镜/连续性/提示词/质检全部下沉到可编辑 Skills

---

## 4. 目标架构（最小改造版）

## 4.1 文件结构（每个视频项目）

```text
video-project/
  00-script/script.md
  01-storyboard/storyboard.json
  01-storyboard/shots/shot-001.json
  01-storyboard/shots/shot-002.json
  02-assets/characters/*.json
  02-assets/scenes/*.json
  03-images/shot-001.png
  03-images/shot-002.png
  04-videos/shot-001.mp4
  04-videos/final.mp4
  90-memory/project-memory.json
  99-logs/harness-runs/*.json
```

## 4.2 Harness（建议新增）

- 新增：`src/process/task/video/VideoCreationHarness.ts`
- 作用：
  1. 阶段编排（Script -> Storyboard -> Prompt -> Image -> QA -> Video）
  2. 阶段输入输出 JSON 校验
  3. 失败可回滚到指定阶段重跑

建议阶段：

1. `director`
2. `storyboard_decompose`
3. `continuity_review`
4. `prompt_pack`
5. `image_generate`
6. `image_qa`
7. `video_generate`

## 4.3 Skills 设计（总 Skill + 分 Skill）

新增目录建议：

```text
src/process/resources/skills/video-creation-suite/
  SKILL.md
  references/contracts.json
  references/style-presets.json
  director/SKILL.md
  storyboard/SKILL.md
  continuity/SKILL.md
  prompt/SKILL.md
  image-qa/SKILL.md
  video-gen/SKILL.md
```

关键点：

- 每个子 Skill 明确 `input.schema` / `output.schema`
- 所有提示词输出双轨：`imagePrompt` + `videoPrompt`
- 连续性 Skill 必须检查角色、服装、机位、道具一致性

## 4.4 UI 同步（文件树 + 画板 + 聊天）

建议不新开大页面，先复用现有 Conversation 框架：

- 左侧继续用 `Workspace`
- 右侧新增 `StoryboardBoardViewer`（作为 Preview 新 viewer）
- 聊天继续走现有 SendBox

同步规则：

1. 点击文件树 `shot-xxx.json` -> 画板高亮对应卡片
2. 点击画板卡片 -> 文件树定位到对应文件
3. 聊天修改某镜头 -> Harness 更新 shot JSON -> UI 自动刷新

---

## 5. 输入输出标准（JSON 合约）

建议统一合约头：

```json
{
  "schemaVersion": "1.0.0",
  "projectId": "...",
  "phase": "storyboard_decompose",
  "input": {},
  "output": {},
  "meta": { "agent": "storyboard", "timestamp": "..." }
}
```

`shot` 最小字段建议：

- `id`
- `sceneIndex`
- `shotIndex`
- `goal`
- `continuityRefs`
- `imagePrompt`
- `videoPrompt`
- `status`
- `assetRefs`

---

## 6. 快速实施路线（4 个里程碑）

### M1（1~2 天）先跑通骨架

- 建立 `video-project` 文件规范
- 建立 `video-creation-suite` Skills 骨架
- 建立 Harness 空实现（仅阶段流转 + 日志）

### M2（2~4 天）打通“聊天改分镜”

- 实现 storyboard JSON 解析/写回服务
- 新增右侧分镜画板 Viewer
- 打通“聊天指令 -> shot 更新 -> 文件写回 -> UI 刷新”

### M3（2~4 天）接图像生成与质检

- 复用 `aionui_image_generation` 批量出图
- image-qa Skill 生成问题清单与修复建议
- 支持单镜头重生图与局部重跑

### M4（3~5 天）接视频生成与收尾

- 新增 `VideoGenService`（多供应商适配）
- 实现镜头视频生成与 final 合成
- 增加项目记忆文件 `project-memory.json`（人物/场景/风格摘要）

---

## 7. 关键风险与规避

1. **上下文过长**：仅注入“当前阶段 + 相关镜头子集 + memory 摘要”
2. **多智能体失控**：Harness 强制阶段门控，未通过校验不得推进
3. **文件并发写冲突**：shot 级文件锁 + 串行写策略
4. **模型输出漂移**：JSON Schema 校验失败立即重试或回退

---

## 8. 结论

你要的方案与 ClapFlow 当前架构**高度兼容**，且能快速落地。最佳路径不是重做一个新系统，而是：

- 复用现有 **聊天、文件树、Skills、Team Mode、图像生成**
- 新增 **视频领域 Harness + 分镜画板 Viewer + 视频生成服务**
- 以 **本地文件 + JSON 合约** 做全流程可追溯与可迭代

这条路线能最快把“传统按钮式 Storyboard 工具”升级为“像专业视频团队协作的聊天式多智能体创作系统”。

---

## 9. IPC 处理器在本项目中的作用（结合当前代码）

你提到“不太理解 IPC 处理器”，可以把它理解成：**跨进程的“受控 API 网关”**。

在 ClapFlow 里，UI 在 `renderer` 进程，业务能力（文件系统、Agent、数据库、MCP）在 `process` 进程。两边不能直接互调，所以必须通过 IPC 桥接：

1. **统一定义协议（类型）**
   - 入口：`src/common/adapter/ipcBridge.ts`
   - 在这里定义 `provider`（请求-响应）和 `emitter`（事件流）
2. **主进程挂载处理器**
   - 例如：`src/process/bridge/fsBridge.ts`、`teamBridge.ts`
   - 负责真正执行文件读写、团队会话、消息分发等
3. **渲染进程调用**
   - `ipcBridge.xxx.invoke(...)` 发请求
   - `ipcBridge.xxx.on(...)` 订阅流式事件

### 9.1 为什么它在你的视频工具里是关键

- **安全边界**：渲染层不直接拿 Node/Electron 高权限 API，避免 UI 侧误操作系统资源
- **架构一致性**：视频创作新能力（Harness、Storyboard、视频生成）能复用现有桥接模式，不破坏主链路
- **流式同步**：你要的“UI、智能体、文件实时同步”本质靠 emitter 事件（例如文件更新推送）实现
- **多运行模式兼容**：桌面 IPC 与 WebSocket 模式共享同一套 bridge/service 语义

### 9.2 对视频创作模块的直接建议

建议新增 `videoCreationBridge.ts`，只暴露“视频域动作”，比如：

- `parseScript`
- `runHarnessPhase`
- `updateShot`
- `generateShotImages`
- `generateFinalVideo`
- `storyboardStream`（状态/进度/告警）

这样 UI 不需要知道后端多智能体细节，只调用稳定的领域 API。

---

## 10. AI 视频创作（漫剧/广告）真实门槛、痛点与耗时

以下是按实际创作经验抽象（并非固定统计值）：

## 10.1 门槛与痛点

| 环节                          | 主要痛点                           | 常见耗时占比（经验） | 技能要求                         |
| ----------------------------- | ---------------------------------- | -------------------: | -------------------------------- |
| 创意拆解（Brief->可执行脚本） | 需求模糊、目标不清、反复返工       |              10%~20% | 叙事设计、受众洞察、营销目标抽象 |
| 分镜设计                      | 节奏、镜头语言、叙事连贯难兼顾     |              15%~25% | 导演思维、镜头语法、节奏控制     |
| 提示词工程                    | 模型差异大、稳定复现困难           |              15%~30% | Prompt 工程、模型参数理解        |
| 资产一致性（角色/场景/道具）  | 人设漂移、服装道具跳变、景别不一致 |              15%~25% | 视觉统筹、连续性管理             |
| 大批量生成与筛选              | 生成多、可用少、筛选成本高         |              10%~20% | 审美判断、质量标准化             |
| 后期整合（视频+音频）         | 时长节奏、转场、音画匹配           |              10%~20% | 剪辑、声音设计、成片把控         |

## 10.2 漫剧 vs 广告的差异门槛

- **AI 漫剧**：难在“长程连续性”（人物与世界观要跨镜头稳定）
- **AI 广告**：难在“品牌/卖点压缩表达”（短时长内高信息密度且要转化）

## 10.3 这些技能要求的本质

本质上不是“会不会某个按钮”，而是三件事：

1. **把模糊意图转成机器可执行约束**（结构化表达能力）
2. **在不确定生成结果中维持一致性**（约束管理能力）
3. **快速闭环迭代到可交付质量**（反馈控制能力）

## 10.4 本项目如何降门槛、缩时间

可以，而且是这个项目最有价值的方向：

1. **Harness 阶段门控**：把“创作经验”变成固定流程，减少遗漏与返工
2. **Skills 专业化**：把导演/连续性/质检规则沉淀成可编辑技能，不再全靠人工记忆
3. **文件即真源**：所有中间产物可见可改可回滚，降低协作和追踪成本
4. **选择性重跑**：改一个镜头只重跑受影响阶段，避免全量重生成
5. **自动质检与告警**：把“审片经验”前置成规则（角色漂移、道具丢失、风格偏移）
6. **上下文聚焦**：按镜头/阶段注入上下文，减少长上下文噪音和 token 浪费

---

## 11. 必须具备的编辑能力（不仅聊天，还要 UI 直编）

你说得很对：真实创作不是一次生成，而是大量编辑。  
因此除智能体交互外，UI 直编能力必须覆盖“中间产物”。

## 11.1 必备编辑能力（按产物层）

1. **脚本层**
   - 段落重排、Beat 拆分/合并、角色台词标注
2. **分镜层**
   - 镜头拖拽排序、拆镜/并镜、时长微调、镜头类型切换
3. **提示词层**
   - image/video prompt 双轨编辑、变量锁定（角色名/服装/风格 token）
4. **资产层**
   - 角色卡/场景卡/道具卡编辑与绑定（镜头引用可追踪）
5. **生成层**
   - 单镜头重生、批量重生、模型切换、种子复用
6. **质检层**
   - 问题标注、拒绝原因、一键“按建议修复并重跑”
7. **成片层**
   - 时间线粗剪、镜头时长拖拽、转场/字幕/配音占位
8. **版本层**
   - Prompt Diff、镜头版本对比、快照回滚

## 11.2 UI 交互功能清单（建议直接纳入）

1. **Storyboard 画板交互**
   - 卡片多选、拖拽排序、批量属性编辑
2. **镜头详情侧栏**
   - 结构化字段表单（景别/机位/运动/情绪/对白/时长）
3. **Prompt 对比器**
   - “旧 prompt vs 新 prompt”差异高亮 + 影响范围提示
4. **一致性告警面板**
   - 显示连续性错误并可点击跳转到对应镜头
5. **重跑控制台**
   - 选择“仅重跑当前镜头/当前场景/全片”
6. **结果对比视图**
   - 同镜头多个版本并排比对并一键设为主版本
7. **时间线预览**
   - 先做 animatic（静帧+时长+音轨占位）再进最终视频生成
8. **操作追踪与撤销**
   - 关键操作日志 + 快照恢复

## 11.3 与聊天编辑的分工建议

- **聊天适合**：意图表达、全局策略调整、批量规则修改
- **UI 直编适合**：精细参数、局部对比、拖拽与可视化决策

最佳体验不是二选一，而是：**聊天做决策，UI 做精修，Harness 做执行与校验**。

---

## 12. 与 `docs/feature/ai-video-creation-plan.md` 的融合与收敛

已将两份方案做对齐，统一结论如下：

1. **架构方向保持一致**
   - 都采用：`videoCreationBridge + video services + video skills + Harness`
   - 都坚持：JSON 标准化输入输出、文件本地化保存

2. **UI 路径收敛为“先内嵌，后独立”**
   - `ai-video-creation-plan.md` 提出独立页面 `src/renderer/pages/videoCreation/`
   - 本文建议先复用 Conversation（Workspace + Preview + Chat）
   - 最终收敛：**Phase A 先做会话内嵌 MVP；Phase B 再升级独立页（如需要）**

3. **模块命名与落盘结构统一**
   - 统一使用：
     - `src/common/types/videoCreation.ts`
     - `src/process/bridge/videoCreationBridge.ts`
     - `src/process/services/video/{StoryboardService,AssetService,VideoGenService}.ts`
     - `src/process/task/video/VideoCreationHarness.ts`
     - `src/process/resources/skills/video-creation-suite/`

4. **执行策略升级**
   - 不是只列里程碑，而是落地为“可直接开发的具体计划文档”
   - 具体开发计划已单独输出到：
   - `docs/research/ai-video-multi-agent-implementation-plan.md`
