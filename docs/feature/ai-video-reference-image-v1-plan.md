# AI 视频创作：Shot 参考图（角色/场景/道具）V1 开发计划

> 日期：2026-04-11
> 状态：进行中
> 目标：支持本地参考图、`@资产名` 引用、6 张上限、角色/场景/道具默认规则、不支持图像参考时自动降级。

---

## 0. 已确认产品规则（冻结）

1. 参考图来源：仅本地文件。
2. 作用范围：
   - 角色：默认作用到出现该角色的 shot。
   - 场景：默认作用到同 scene 下全部 shot。
   - 道具：在 `storyboard_decompose` 阶段自动关联；可手动调整。
3. 每个 shot 最多参考图：6 张。
4. 优先级：角色 > 场景 > 道具。
5. 不支持图像参考时自动降级：仅对当前 shot 涉及资产进行统一描述，不重复堆叠。
6. `@Name` 允许中文。
7. 资产名包含空格时：自动规范化为 `_` 并提示。
8. 主参考图策略：默认第一张为主图。

---

## 1. 实施范围（V1）

- [x] 数据模型：资产参考图字段 + shot 引用字段规范。
- [x] 文件系统：新增 `02-assets/references/{character|scene|prop}/{assetId}`。
- [x] Service/IPC：
  - [x] 上传资产参考图
  - [x] 删除资产参考图
  - [x] 设置主参考图
  - [x] shot 绑定/解绑资产（通用）
- [x] 生成链路：新增“引用图解析器”并接入 `image_generate`。
- [x] 自动关联：`storyboard_decompose` 解析资产并关联 shot（优先结构化字段，兼容 `@` 文本引用）。
- [x] UI：
  - [x] Asset Library 资产参考图管理（上传/预览/删除/设主图）
  - [x] ShotDetailPanel References 区（绑定/解绑）
  - [x] Storyboard 卡片参考状态标识
  - [x] 生成中显示“应用参考图数量”
- [x] Skills 约束：`video-creation-suite` 输出资产清单、资产 prompt、shot `assetRefs`、`@资产名` 引用。
- [x] 测试：解析器、Harness image_uris 传参、资产参考图 CRUD、UI 基础回归。
- [ ] 待补：人工回归（多项目、多场景下的 UI 交互与容错）。

---

## 2. 技术设计要点

### 2.1 解析策略

- 输入：`shot.assetRefs + scene 默认绑定 + 角色默认绑定 + prompt @引用`
- 处理：去重、优先级排序、上限截断（6）
- 输出：
  - `imageUris: string[]`
  - `resolvedAssets: string[]`
  - `fallbackPromptPrefix: string`

### 2.2 降级策略

- 首选带 `image_uris` 生成。
- 若模型/接口报“不支持图像参考”，自动重试纯文本 prompt（附资产摘要）。

### 2.3 命名与兼容

- 资产名保存时自动 `trim + 空格转 _`。
- 保持旧项目兼容：无参考图时行为不变。

---

## 3. 开发进度日志

- 2026-04-11 23:52：完成需求冻结与计划文档初始化。
- 2026-04-11 23:52：开始进入开发阶段（数据层 + Service/IPC）。
- 2026-04-12 00:15：完成数据模型、项目目录、AssetService/IPC 改造；支持参考图上传/删除/主图设置与通用资产绑定。
- 2026-04-12 00:38：完成引用图解析器与 Harness 接入；实现角色/场景/道具优先级、6 张上限、去重与不支持图像参考自动降级。
- 2026-04-12 01:10：完成 `storyboard_decompose` 与 `prompt_pack` 资产关联逻辑；支持 `@资产名`（含中文）解析和 `assetRefs` 合并。
- 2026-04-12 01:42：完成 Skill 合同与提示词约束更新（assets、assetRefs、资产 prompt、`@` 引用约束）。
- 2026-04-12 02:20：完成 Asset Library / ShotDetailPanel / Flow 节点 UI 接入，展示参考图状态与生成中引用数量。
- 2026-04-12 04:05：补齐单测与 DOM 测试，`AssetReferenceResolver`、`AssetService`、`Harness image_uris` 相关用例通过。
- 2026-04-12 20:52：完成 UI 代码收口（移除无用逻辑，统一机械齿轮风格 spinner）；局部 lint 清零，TypeScript 与目标测试集通过。
- 2026-04-12 21:53：新增 `image_generate` 提示词调试日志：控制台打印每个 shot 的最终请求 prompt / image_uris / fallback prompt，并落盘到 `99-logs/harness-runs/image-generate-debug-YYYY-MM-DD.jsonl` 便于人工核查资产解析是否生效。
- 2026-04-12 22:38：修复 `@资产名` 直接透传到图片模型导致画面出现文字的问题；在 `image_generate` 请求前统一去除 `@` 标记，仅保留实体名，并同步更新 fallback prompt 组装逻辑与单测。
- 2026-04-12 22:49：按产品规则补齐“无参考图也注入资产上下文”逻辑：当 `image_uris` 为空但资产存在 prompt/description 时，自动在 shot prompt 前拼接 `Reference context`；并保持“有参考图优先图生图、仅失败时再降级文本前缀”的策略。
- 2026-04-12 22:54：优化资产上下文前缀格式为结构化分组（`角色清单`/`场景清单`/`道具清单`），满足人工可读与可审计需求；更新对应单测断言。
- 2026-04-12 22:58：增强资产匹配与兜底策略：支持 `@鲁鲁` 匹配 `鲁鲁_主角` 等规范化别名；当资产缺少 prompt/description 时仍输出分组条目并注入默认描述，避免角色/场景条目在上下文中消失。
- 2026-04-12 23:02：修复 `image_generate` 阶段崩溃（`startsWith` 读取 undefined）：对资产 `id/name` 异常数据增加健壮性处理，别名集合仅使用有效字符串；补充 malformed asset 单测防回归。
- 2026-04-12 23:05：继续优化“仅道具命中”场景：当角色资产未命中但 prompt 中存在 `@角色名` 时，自动在“角色清单”补齐占位设定；同时增强 scene/name 的宽松匹配（去符号、NFKC、包含匹配）并补充单测。
- 2026-04-12 23:12：修复资产读取鲁棒性：`getAssets` 对单文件 JSON 解析失败改为“跳过坏文件而非整类清空”；缺失 `id` 时自动用文件名回填。并修正“道具名误入角色清单”问题（角色 fallback 过滤非角色资产别名）。
- 2026-04-12 23:24：新增“最终发送给图片模型的 prompt”可观测日志 `prompt(sent-to-image-model)`，明确区分内部 prompt 与 `Generate image:/Analyze/Edit image:` 包装后的传输 prompt，便于定位风格偏差问题。
