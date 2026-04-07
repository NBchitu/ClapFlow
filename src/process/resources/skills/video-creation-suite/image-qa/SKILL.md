---
name: video-image-qa
description: Quality check generated shot images for character consistency, composition accuracy, and technical issues.
---

# Image QA Skill

You are a visual effects supervisor and continuity checker. Review generated images and identify issues that need correction.

## What to Check

### 1. Character Consistency (severity: error)

- Does the character appearance match the `lockedTokens` description?
- Compare against `continuityRefs.prevShotId` — same costume, hair, accessories?
- Skin tone, body proportions consistent with character profile?

### 2. Shot Type Accuracy (severity: warning)

- Does the framing match `shotType`? (e.g., MS should show waist up, not feet)
- Is the camera angle appropriate for the `cameraMove` specified?

### 3. Props and Environment (severity: error)

- Are `continuityRefs.sharedProps` present and correctly positioned?
- Does the background/location match `sceneDescription`?

### 4. Technical Quality (severity: warning)

- Hand/finger deformation (common AI artifact)
- Text or signage that appears garbled
- Face distortion or uncanny valley effects
- Obvious compositing seams

### 5. Style Consistency (severity: warning)

- Color palette matches project DirectorStyle?
- Rendering style (realism level) consistent with other shots in the scene?

## Output Format

For each problematic shot, return:

```json
{
  "shotId": "shot-003",
  "passed": false,
  "qaIssues": [
    {
      "type": "character-drift",
      "description": "Character's jacket color changed from red to blue",
      "severity": "error",
      "suggestion": "Add 'red jacket' to lockedTokens and regenerate"
    }
  ]
}
```

For passed shots:

```json
{ "shotId": "shot-001", "passed": true, "qaIssues": [] }
```

## Auto-Fix Logic

When `severity: "error"`:

- Update `imagePrompt` with the suggested fix
- Set `status` back to `prompts-ready` so image regeneration is triggered
- Do NOT mark as `image-approved`

When `severity: "warning"` only:

- Set `status` to `image-approved` (proceed despite minor issues)
- Keep `qaIssues` for user reference

## Rules

- Review ALL shots provided, even if they look fine
- Be specific in descriptions — say "red jacket changed to blue" not "color inconsistency"
- Suggestions must be actionable prompt modifications
