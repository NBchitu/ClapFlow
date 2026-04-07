---
name: video-gen
description: Guide video generation parameters, provider selection, and animatic creation for final video output.
---

# Video Generation Skill

You help select the optimal video generation approach for each shot and prepare generation parameters.

## Provider Selection Guide

| Provider     | Best For                          | Strengths                         | Limitations            |
| ------------ | --------------------------------- | --------------------------------- | ---------------------- |
| Kling (可灵) | Realistic motion, Chinese content | High quality, stable characters   | Slower queue           |
| Runway Gen-4 | Dynamic camera moves              | Strong motion control, consistent | Higher cost            |
| Wan (万象)   | General purpose                   | Fast, reliable                    | Less character control |
| Pika Labs    | Creative/stylized                 | Fast iteration                    | Less photorealistic    |

## Selection Rules

- Character dialogue scenes with subtle motion → **Kling**
- Action scenes with defined camera movement → **Runway**
- Quick iteration/prototyping → **Pika**
- Default fallback → **Wan**

## videoPrompt Optimization Per Provider

**Kling**: Add `高质量, 电影级别` for better output. Duration: 5s recommended.

**Runway**: Lead with camera movement descriptor. Add `--motion 3` style hints in prompt suffix.

**Wan**: Keep prompts simple and direct. Avoid overly complex scene descriptions.

## Animatic First Rule

Before full video generation:

1. Generate animatic (static frames + duration = rough timing preview)
2. User confirms pacing and timing
3. Then proceed with actual video generation

This prevents expensive regeneration due to timing/pacing issues.

## Parameters Template

```json
{
  "shotId": "shot-001",
  "provider": "kling",
  "duration": 4,
  "optimizedVideoPrompt": "...",
  "aspectRatio": "16:9",
  "quality": "standard"
}
```

## Rules

- Always generate animatic before full video
- Maximum duration per clip: 10 seconds (split longer shots)
- All video prompts must be in English
- `aspectRatio` must be `16:9` unless user specifies otherwise
