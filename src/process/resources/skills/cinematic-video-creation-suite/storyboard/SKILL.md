---
name: cinematic-video-storyboard
description: Decompose scenes into cinematic shot lists with pacing, continuity cues, and project-compatible shot fields.
---

# Storyboard Decomposition (Cinematic)

Output JSON only. Prefer scene-grouped structure:

```json
{
  "scenes": [
    {
      "id": "scene-01",
      "name": "string",
      "description": "string",
      "timeOfDay": "string",
      "location": "string",
      "shots": [
        {
          "sceneId": "scene-01",
          "goal": "narrative purpose",
          "sceneDescription": "what audience sees",
          "characters": ["name"],
          "action": "visible action",
          "dialogue": "dialogue text or empty",
          "shotType": "MS",
          "cameraMove": "push",
          "duration": 4,
          "assetRefs": ["char-001", "scene-01", "prop-001"],
          "rhythmPurpose": "setup|build|payoff|transition",
          "continuityCue": "entry direction / eyeline / prop carry-over",
          "cinematicNotes": "lens, angle, framing intent"
        }
      ]
    }
  ],
  "assets": {
    "characters": [{ "id": "char-001", "name": "name", "description": "", "prompt": "", "lockedTokens": [] }],
    "scenes": [{ "id": "scene-01", "name": "name", "description": "", "prompt": "" }],
    "props": [{ "id": "prop-001", "name": "name", "description": "", "prompt": "" }]
  }
}
```

## Direct Output Constraint
- Produce data that can be directly written into ClapFlow `storyboard.json` + `shots/*.json`.
- Do not output Yuanlong top-level contract (`meta/input/selected_configuration/...`) in this step.

## Pacing Rules
- Scene entrance: prefer `EWS/WS` before emotional close coverage.
- Dialogue: alternate `MS/CU` with motivated changes.
- Emotional peaks: hold `CU/ECU` longer.
- Transition shots must carry direction and rhythm into next beat.

## Continuity Rules
- Keep axis and eyeline stable unless intentional break is declared.
- Prop and costume persistence across neighboring shots.
- Motion vector continuity (left→right, in→out) must be explicit in `continuityCue`.

## Compatibility Rules
- `shotType` enum must be valid.
- `cameraMove` enum must be valid.
- `duration` integer within 1~30.
- Always fill `goal`, `action`, `sceneDescription`.
