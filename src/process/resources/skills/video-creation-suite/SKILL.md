---
name: video-creation-suite
description: Complete AI video creation workflow — from script to storyboard, prompts, image generation, QA, and final video output.
---

# Video Creation Suite

This skill suite guides you through creating a complete AI video storyboard project. You will generate all text content (director analysis, shots, prompts) directly as JSON files in the required directory structure. Image and video generation are triggered by the user from the Storyboard Canvas UI.

## Step 1: Create Project Directory Structure

Given a `projectRoot` path (ask the user if not provided), create all required directories and files:

```
{projectRoot}/
├── 00-script/
│   └── script.md          ← write the user's script here
├── 01-storyboard/
│   ├── storyboard.json    ← create this file (see schema below)
│   └── shots/             ← individual shot JSON files go here
├── 02-assets/
│   ├── characters/
│   ├── scenes/
│   └── props/
├── 03-images/
├── 04-videos/
├── 90-memory/
└── 99-logs/
    └── harness-runs/
```

## Step 2: Write `01-storyboard/storyboard.json`

**File path**: `{projectRoot}/01-storyboard/storyboard.json`

**Schema** (must match exactly):

```json
{
  "id": "<8-char random alphanumeric>",
  "title": "<project title derived from script>",
  "projectRoot": "<absolute path to projectRoot>",
  "scriptPath": "<absolute path to projectRoot>/00-script/script.md",
  "style": {
    "genre": "<e.g. slice-of-life drama>",
    "visualStyle": "<e.g. warm tones, natural lighting>",
    "colorPalette": "<e.g. muted earth tones with soft highlights>",
    "cameraPreferences": ["MS", "CU", "static"],
    "referenceWorks": ["optional film references"],
    "negativeStyle": "avoid handheld unless tension scene"
  },
  "scenes": [
    {
      "id": "scene-01",
      "name": "<scene name>",
      "description": "<scene description>",
      "timeOfDay": "<morning/day/evening/night>",
      "location": "<location name>",
      "shotIds": ["shot-001", "shot-002"]
    }
  ],
  "shotIds": ["shot-001", "shot-002", "shot-003"],
  "createdAt": "<ISO timestamp>",
  "updatedAt": "<ISO timestamp>"
}
```

**Rules:**
- `shotIds` must list ALL shot IDs in order
- `id` must be an 8-character random string like `"a3f9bc12"`
- All paths must be absolute

## Step 3: Write Individual Shot Files

**File path pattern**: `{projectRoot}/01-storyboard/shots/shot-NNN.json`
- IDs are zero-padded 3-digit numbers: `shot-001`, `shot-002`, ... `shot-012`

**Schema for each shot file** (must match exactly):

```json
{
  "id": "shot-001",
  "sceneId": "scene-01",
  "sceneIndex": 0,
  "sceneShotIndex": 1,
  "shotIndex": 1,
  "goal": "one sentence: the narrative purpose of this shot",
  "sceneDescription": "describe what the viewer sees",
  "characters": ["character name if present"],
  "action": "what the character(s) are doing",
  "dialogue": "spoken words, or empty string if none",
  "shotType": "MS",
  "cameraMove": "static",
  "imagePrompt": "",
  "videoPrompt": "",
  "lockedTokens": [],
  "continuityRefs": {
    "prevShotId": "shot-000 or omit if first shot",
    "nextShotId": "shot-002 or omit if last shot",
    "sharedCharacters": [],
    "sharedProps": [],
    "sharedScene": "scene-01"
  },
  "assetRefs": [],
  "duration": 4,
  "status": "pending",
  "locked": false
}
```

**Valid values:**
- `shotType`: one of `"EWS"` `"WS"` `"MS"` `"CU"` `"ECU"`
- `cameraMove`: one of `"static"` `"push"` `"pull"` `"pan"` `"tilt"` `"handheld"`
- `status`: always `"pending"` when first created
- `duration`: seconds (integer, 1–30)
- `sceneIndex`: 0-based index matching position in `storyboard.json scenes[]`
- `sceneId`: must match one entry in `storyboard.json scenes[].id`
- `sceneShotIndex`: 1-based index inside current scene
- `shotIndex`: 1-based sequential number

## Step 4: Fill in Image and Video Prompts

After creating all shot files, update each shot file to add `imagePrompt` and `videoPrompt`, then change `status` to `"prompts-ready"`.

**imagePrompt format** (English only, ≤150 words):
```
cinematic photo, <shot-type-keyword>, <character description>, <action>, <environment>, <lighting>, <style>, 8k, masterpiece
```

Shot type keywords: `EWS`→"extreme wide shot", `WS`→"wide shot full body", `MS`→"medium shot waist up", `CU`→"close up", `ECU`→"extreme close up"

**videoPrompt format** (English only, ≤60 words):
```
<camera move phrase>, <subject action>, <mood>
```

Camera move phrases: `static`→"camera static locked off", `push`→"slow camera push in", `pull`→"slow camera pull back", `pan`→"smooth camera pan", `tilt`→"camera tilt", `handheld`→"handheld camera slight shake"

## Step 5: Tell the User to Open the Storyboard

After all files are written, tell the user:

> ✅ 故事板已创建完成！
> 请在左侧文件树中找到 `{projectRoot}/01-storyboard/storyboard.json` 并点击打开，即可在右侧预览面板查看所有分镜。
> 在故事板画布中确认分镜内容后，点击工具栏的"生成图像"按钮触发 AI 图像生成。

## Sub-Skills Reference

| Sub-Skill | Purpose |
|-----------|---------|
| `director` | Analyze genre, visual style, color palette, camera preferences |
| `storyboard` | Decompose script into shots with camera language |
| `continuity` | Fill `continuityRefs` between shots |
| `prompt` | Generate `imagePrompt` + `videoPrompt` for each shot |

## Notes

- **Always write files**, never just output JSON in chat messages
- Create all directories before writing files
- `storyboard.json` must be written before shot files
- Shot IDs in `storyboard.json`'s `shotIds` array must exactly match the filenames in `shots/`
- `scenes[].shotIds` must be kept in sync with each shot's `sceneId`
- The image generation and video generation phases are handled by the UI after you complete the text phases
