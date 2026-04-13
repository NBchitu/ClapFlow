---
name: cinematic-video-director
description: Build director-level scene strategy from script input: genre, visual language, camera preference, lighting mood, narrative beats, and scene segmentation for downstream storyboard decomposition.
---

# Director Pass (Cinematic)

Read the full script first. Output JSON only.

## Output Contract

```json
{
  "style": {
    "genre": "string",
    "visualStyle": "string",
    "colorPalette": "string",
    "cameraPreferences": ["MS", "CU", "push", "static"],
    "referenceWorks": ["optional"],
    "negativeStyle": "optional"
  },
  "narrativeStructure": "3-6 sentence narrative arc",
  "keyThemes": ["theme-1", "theme-2"],
  "scenes": [
    {
      "id": "scene-01",
      "name": "string",
      "description": "what this scene must accomplish narratively",
      "timeOfDay": "string",
      "location": "string"
    }
  ]
}
```

## Director Rules
- Use style profiles from Yuanlong configuration library when possible.
- Scene split by **dramatic objective**, not only by location.
- Each scene description must contain:
  - dramatic goal
  - emotional direction
  - visual motif
- Keep IDs stable and sequential (`scene-01`, `scene-02`, ...).
- `cameraPreferences` can include shot scale + movement keywords together.

## Quality Bar
- Avoid generic labels like "drama" only; use precise genre phrasing.
- Keep visual language cinematic and executable.
- Ensure scene list covers the whole script timeline with no major gap.
