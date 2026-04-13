---
name: cinematic-video-creation-suite
description: High-fidelity cinematic storyboard workflow for this project. Combines Yuanlong director-grade script decomposition (director/visual/camera/lighting control, pacing and continuity) with ClapFlow project-ready output (00-script, 01-storyboard/shots, 02-assets). Use when users ask for 导演级分镜、电影感拆解、叙事节奏控制、专业电影语言 prompt、并要求直接落地到本项目目录结构。
---

# Cinematic Video Creation Suite

## Goal
Generate **director-level** scene/shot decomposition and **project-ready** files at the same time.

- Creative brain: borrow method from `../yuanlong-storyboard-suite`
- Project adapter: keep file/asset structure from `../video-creation-suite`

## Fixed Project Output
Always write files into:

- `00-script/script.md`
- `01-storyboard/storyboard.json`
- `01-storyboard/shots/shot-XXX.json`
- `02-assets/characters/*.json`
- `02-assets/scenes/*.json`
- `02-assets/props/*.json`

## Direct-Write Principle (Critical)
- **Do not use conversion as the default path.**
- **Do not require reading/running `convert_yuanlong_to_video_project.py` in normal execution.**
- Generate output that directly matches ClapFlow project schemas in one pass.
- Conversion scripts are for offline migration/debug only.

## Workflow
1. Confirm `projectRoot` and create required folders.
2. Read script (or novel excerpt) and extract narrative arc, conflicts, emotional beats.
3. Select director/visual/camera/lighting configuration from Yuanlong references.
4. Decompose into scenes and shots with cinematic pacing.
5. Enforce continuity (axis, eyeline, movement direction, prop persistence).
6. Generate per-shot prompts using professional film language.
7. Write `storyboard.json`, all `shots/*.json`, and `02-assets/*.json` directly.
8. Validate structure with `scripts/validate_cinematic_storyboard.py` when possible.
9. Guide user to open `01-storyboard/storyboard.json` in UI.

## Sub-skills
- `director`: director-level style and scene strategy
- `storyboard`: scene→shot decomposition with pacing grammar
- `continuity`: continuity and editing logic checks
- `prompt`: cinematic image/video prompt writing

## References
- `references/merge-strategy.md`
- `references/direct-write-protocol.md`
- `references/cinematic-rhythm-rules.md`
- `references/output-contract.json`
- `../yuanlong-storyboard-suite/references/yuanlong-configurations.md`
- `../video-creation-suite/references/contracts.json`

## Compatibility Rules
- Keep `shotType` in: `EWS | WS | MS | CU | ECU`
- Keep `cameraMove` in: `static | push | pull | pan | tilt | handheld`
- Keep `duration` integer in `[1, 30]`
- Keep `sceneId` = `scene-XX`, `shotId` = `shot-XXX`
- Preserve cinematic prose quality, but do not break project schema

## Scripts (Debug / Offline)
- `scripts/validate_cinematic_storyboard.py`: structural + cinematic quality checks
- `scripts/convert_yuanlong_to_video_project.py`: offline migration helper only (not default runtime path)

## Fallback Strategy
If you cannot apply full Yuanlong controls, still prioritize:
1. narrative continuity
2. pacing rhythm
3. professional cinematic wording
4. project-compatible file output
