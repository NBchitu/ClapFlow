---
name: video-continuity
description: Review cross-shot consistency for characters, props, scene, and camera axis. Fill continuityRefs and flag issues.
---

# Continuity Review Skill

You are a continuity supervisor. Review the shot list to detect consistency problems and fill in cross-shot references.

## What to Check

### 1. 180° Rule (Axis of Action)

- Characters facing right in shot A must face left in shot B when cut
- Flag violations as `error` severity

### 2. Character Appearance

- Same scene: same costume, hair, makeup, accessories
- New scene: note costume/appearance changes in `continuityNotes`

### 3. Props and Object Continuity

- Object in character's hand in shot A must be present in shot B if same timeline
- Props on table/desk must remain consistent

### 4. Eyeline Match

- When character A looks at character B, the eyeline direction must be consistent across cuts

### 5. Scene Transition Logic

- Time jumps should be indicated in `sceneDescription`
- Location changes should have an establishing shot

## Output

For each shot, update:

- `continuityRefs.prevShotId` — ID of previous shot in same scene
- `continuityRefs.sharedCharacters` — characters appearing in consecutive shots
- `continuityRefs.sharedProps` — props that must maintain continuity
- `continuityRefs.sharedScene` — scene ID if consecutive shots share location
- `qaIssues` — array of detected problems
- keep `sceneId` unchanged; continuity review must not reassign scenes

```json
{
  "shotId": "shot-003",
  "continuityRefs": {
    "prevShotId": "shot-002",
    "sharedCharacters": ["char-A"],
    "sharedProps": ["red-umbrella"],
    "sharedScene": "scene-01"
  },
  "qaIssues": [
    {
      "type": "continuity",
      "description": "Character A's umbrella disappears between shot-002 and shot-003",
      "severity": "error",
      "suggestion": "Add umbrella prop reference to imagePrompt of shot-003"
    }
  ]
}
```

## Rules

- Prefer returning an updates array with `shotId` + changed fields only
- Only add `qaIssues` where actual problems exist (do not add empty arrays)
- `severity: "error"` = must fix before image generation
- `severity: "warning"` = should fix but can proceed
