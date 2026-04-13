---
name: cinematic-video-prompt
description: Generate professional cinematic prompts per shot with strong visual language, camera grammar, and continuity-aware motion description.
---

# Prompt Pass (Cinematic Language)

Output JSON array with: `id`, `imagePrompt`, `videoPrompt`, `lockedTokens`, `assetRefs`.

## imagePrompt Requirements (English)
Include all of the following in one coherent prompt:
- shot scale keyword (from `shotType`)
- lens + angle + framing/composition
- subject + visible action
- environment depth cues
- quantified/clear lighting expression
- palette + texture + cinematic mood
- continuity hint from previous shot when relevant

Recommended structure:
`cinematic still, [shot scale], [lens/angle], [composition], [subject + action], [foreground/midground/background], [lighting], [color palette], [texture], [mood], ultra-detailed`

## videoPrompt Requirements (English)
Describe motion like a cinematographer:
- camera path (push/pull/pan/tilt/handheld)
- subject blocking and speed change
- continuity bridge (entry/exit direction, end pose)
- mood and pacing

Recommended structure:
`[camera movement], [blocking and action], [speed profile], [continuity bridge], [mood]`

## Hard Rules
- `imagePrompt` <= 150 words
- `videoPrompt` <= 60 words
- Use professional visual language, avoid vague adjectives-only prompts
- Keep character tokens stable through `lockedTokens`
- Set shot status to `prompts-ready`
