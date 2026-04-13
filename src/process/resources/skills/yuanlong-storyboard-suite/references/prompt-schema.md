# Prompt Schema (JSON First)

## Primary Output
Return a single JSON object conforming to `output-contract.json`.

## Top-level keys
- `meta`
- `input`
- `selected_configuration`
- `global_rules`
- `shots`
- `validation`

## shots[] required keys
- `shot_id`
- `scene_id`
- `time` (start_sec/end_sec/duration_sec/range)
- `content` (shot_size/camera_movement/frame_description/lighting_mood)
- `prompts` (text_to_image/image_to_video)

## Prompt Field Rule
- `prompts.text_to_image`: optimized for 文生图.
- `prompts.image_to_video`: optimized for 图生视频 (motion/camera continuity emphasis).
- Keep dialogue text verbatim if dialogue exists.
- Keep @标签 mapping stable across shots.

## text_to_image 画面感硬约束（源自元龙分镜）
每条 `prompts.text_to_image` 必须是单行结构化提示词，字段顺序固定：
`主体：... 空间：... 光影：... 镜头：... 音效：... [台词：...]`

### 1) 主体（必须可拍）
- 必须包含人物/主体 + 动作动词，并包含“正在”。
- 必须出现动作动线或节奏变化（如：加速/减速/悬停/转身/出画）。
- 禁止纯抽象情绪句（如“他很悲伤”）；改为可见行为（如“眼眶泛红，指尖颤抖”）。

### 2) 空间（三层纵深）
- 必须同时包含：`前景-`、`中景-`、`背景-`。
- 多人场景建议写站位关系（A在左前景、B在右后景）。

### 3) 光影（量化）
- 必须包含色温（例如 `4500K`）。
- 必须包含明暗比（例如 `3:1`）。
- 建议包含光源方向（侧光/逆光/顶光 + 角度）。

### 4) 镜头（有语义）
- 必须包含景别 + 运镜。
- 建议包含机位/构图/焦段信息（如三分法、对称、低机位、35mm）。
- 建议包含结尾动势（供下一镜衔接）。

### 5) 音效（三层）
- 建议按三层写：环境层 / 动作层 / 情绪层。

### 6) 台词（若存在）
- 若 `dialogue[]` 非空，`text_to_image` 必须包含 `台词：` 字段。
- 台词文本必须与 `dialogue[].text` 一字不差。

### 7) 反空泛约束
- 建议最小长度 >= 80 字。
- 避免“不要/不能/禁止/没有”否定句，尽量改肯定表达。

## image_to_video 约束补充
- 在保留同一视觉主体的前提下，突出运动连续性：
  - 镜头路径（推进/横移/跟拍）
  - 速度变化（匀速/加速/急停）
  - 衔接信息（延续上一镜出画方向/动作趋势）

## Legacy Table Compatibility
If upstream content is markdown table, convert via:
- `scripts/markdown_to_storyboard_json.py`
Then validate via:
- `scripts/validate_output_json.py`
