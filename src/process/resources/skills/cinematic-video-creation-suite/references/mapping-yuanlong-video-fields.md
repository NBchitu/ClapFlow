# Field Mapping: Yuanlong Contract -> ClapFlow Storyboard

| Yuanlong field | ClapFlow target | Notes |
|---|---|---|
| `shots[].shot_id` | `shot-XXX` filename + `id` | Re-index to zero-padded sequence |
| `shots[].scene_id` | `sceneId` / `sceneIndex` | map numeric -> `scene-XX` |
| `shots[].time.duration_sec` | `duration` | round to int, clamp 1~30 |
| `shots[].content.frame_description` | `sceneDescription` | visible, cinematic description |
| `shots[].content.shot_size` | `shotType` | map CN/EN labels to `EWS/WS/MS/CU/ECU` |
| `shots[].content.camera_movement` | `cameraMove` | map to `static/push/pull/pan/tilt/handheld` |
| `shots[].prompts.text_to_image` | `imagePrompt` | keep cinematic wording |
| `shots[].prompts.image_to_video` | `videoPrompt` | keep continuity motion wording |
| `shots[].assets.characters` | `characters` + `assetRefs` | resolve to character asset ids |
| `shots[].assets.props` | `assetRefs` | resolve to prop asset ids |
| `shots[].assets.scenes` | `assetRefs` + scene asset | resolve to scene asset ids |
| `shots[].dialogue[]` | `dialogue` | flatten text if needed |
| `continuity.in/out` | `continuityRefs` | derive prev/next + notes |

## Enum Mapping Suggestions

### shot_size -> shotType
- `远景/大全景/extreme wide` -> `EWS`
- `全景/wide` -> `WS`
- `中景/medium` -> `MS`
- `近景/特写/close up` -> `CU`
- `大特写/微距/extreme close` -> `ECU`

### camera_movement -> cameraMove
- `固定/静止/static` -> `static`
- `推进/push in` -> `push`
- `拉远/pull back` -> `pull`
- `摇移/pan` -> `pan`
- `俯仰/tilt` -> `tilt`
- `手持/handheld` -> `handheld`
