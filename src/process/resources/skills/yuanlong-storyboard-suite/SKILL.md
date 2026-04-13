---
name: yuanlong-storyboard-suite
description: "Apply the Yuanlong storyboard method to turn core plot input into production-ready storyboard tables with deterministic parameter control. Use when users ask to generate, refine, validate, or export storyboard prompts with director style, visual style, camera language, lighting mood, STC/faithful mode, shot-count control, chain-scene generation, and per-shot 文生图 + 图生视频 prompt tables (keywords include 元龙分镜, 核心情节输入, 保真模式, STC, 导演风格, 视觉风格, 运镜, 光影, 分镜导出)."
---

# Yuanlong Storyboard Suite

## Overview
Use this skill as the single orchestrator for the Yuanlong workflow. Keep one main skill and organize capabilities as internal modules via `references/`.

## Built-in Configuration Library
This skill includes the full Yuanlong configuration packs:
- 导演风格 54
- 视觉风格 41
- 运镜语言 21
- 光影氛围 17

Always load `references/yuanlong-configurations.md` for style/camera/lighting selection.

## Fixed Output Contract (JSON-Only)
Output must be a single JSON object only.
- No markdown
- No code fence
- No explanatory prose before/after JSON

Use `references/output-contract.json` as the canonical schema.
Use `references/output-json-example.json` as the concrete template.

Required output content:
1. 参数配置快照（input + selected_configuration）
2. 每镜头可程序化内容（shots[]）
3. 每镜双提示词（prompts.text_to_image + prompts.image_to_video）
4. 结构化校验结果（validation）

## Workflow
1. Read inputs: core plot, duration, director style, visual style, STC, faithful mode, shot mode, BGM/subtitle, asset-tag switches.
2. Run pre-processing: safety filtering, dialogue extraction, dialogue-lock constraints.
3. Build style context from configuration library:
   - director profile
   - visual style prompt
   - camera language preset(s)
   - lighting mood preset(s)
4. Choose generation path by duration:
   - Single-pass (<180s)
   - Chain generation (>=180s): segment scenes, generate per scene, stitch with continuity.
5. Enforce shot/time skeleton and JSON schema fields.
6. Fill per-shot prompts for image and video generation.
7. Validate with `scripts/validate_output_json.py` when possible.

## Parameter Precedence
1. Safety hard blocks
2. Faithful/script-direct constraints
3. Dialogue lock
4. Duration branch + shot lock
5. Style constraints (director/visual/camera/lighting)
6. Asset-tag consistency
7. Optional polish (BGM/subtitle hints)

## References
- `references/pipeline.md`
- `references/parameter-effects.md`
- `references/mode-rules.md`
- `references/prompt-schema.md`
- `references/yuanlong-configurations.md`
- `references/config-usage.md`
- `references/output-contract.json`
- `references/output-json-example.json`
- `references/text-to-image-rubric.md`

## Scripts
- `scripts/validate_output_json.py`: validate required JSON structure.
- `scripts/markdown_to_storyboard_json.py`: convert markdown storyboard table to contract JSON.
- `scripts/export_unified_prompt_table.py`: convert storyboard markdown table to CSV.
