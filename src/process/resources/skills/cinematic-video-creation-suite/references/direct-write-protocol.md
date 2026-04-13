# Direct Write Protocol (One-Pass Project Output)

## Purpose
Ensure the model outputs **project-compatible JSON directly**, without any converter step.

## Output Expectations

### 1) Storyboard index (`01-storyboard/storyboard.json`)
Must include:
- `id`, `title`, `projectRoot`, `scriptPath`
- `style`
- `scenes[]` with `id=scene-XX`
- top-level `shotIds[]` ordered
- `createdAt`, `updatedAt`

### 2) Shot files (`01-storyboard/shots/shot-XXX.json`)
Each shot must include:
- `id=shot-XXX`, `sceneId`, `sceneIndex`, `sceneShotIndex`, `shotIndex`
- `goal`, `sceneDescription`, `characters`, `action`, `dialogue`
- `shotType`, `cameraMove`, `duration`
- `imagePrompt`, `videoPrompt`, `lockedTokens`
- `continuityRefs`, `assetRefs`
- `status` (`prompts-ready` after prompt pass), `locked`

### 3) Asset files (`02-assets/*/*.json`)
Characters/scenes/props must be written as JSON files and referenced by shot `assetRefs`.

## One-Pass Rule
- Director output, storyboard decomposition, continuity, prompt generation, and schema adaptation happen in one pipeline.
- Do not switch to Yuanlong contract JSON as an intermediate mandatory format.

## Cinematic Quality Rule
Project compatibility cannot reduce cinematic quality. Keep:
- narrative continuity
- rhythm-aware shot design
- professional film-language prompts
