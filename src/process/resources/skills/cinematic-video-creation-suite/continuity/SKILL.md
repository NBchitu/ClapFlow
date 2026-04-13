---
name: cinematic-video-continuity
description: Perform cinematic continuity supervision for shot lists, including axis control, eyeline match, prop carry-over, and rhythm-safe transitions.
---

# Continuity Pass (Cinematic)

Review shot sequence and return updates JSON.

## Output Format

```json
{
  "updates": [
    {
      "shotId": "shot-003",
      "continuityRefs": {
        "prevShotId": "shot-002",
        "nextShotId": "shot-004",
        "sharedCharacters": ["char-001"],
        "sharedProps": ["prop-001"],
        "sharedScene": "scene-01"
      },
      "qaIssues": [
        {
          "type": "continuity",
          "description": "Eyeline flips without motivated camera crossing.",
          "severity": "error",
          "suggestion": "Keep facing direction consistent or add a neutral axis-breaking shot."
        }
      ]
    }
  ]
}
```

## Check Order
1. Axis (180-degree rule)
2. Eyeline direction
3. Character appearance continuity
4. Prop state continuity
5. Temporal/spatial transition logic
6. Rhythm continuity between cuts

## Severity Policy
- `error`: must fix before generation
- `warning`: quality issue, can proceed if needed

Be concrete and actionable in every issue suggestion.
