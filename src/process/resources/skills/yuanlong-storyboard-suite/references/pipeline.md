# Pipeline (Yuanlong Method)

1. Intake: 核心情节输入、时长、风格、STC/保真、镜数、BGM/字幕、素材标签。
2. Pre-process: 敏感词处理、台词提取、台词锁定。
3. Build context: 导演风格 + 视觉风格 + 运镜/光影 + 资产映射 + 连续性约束。
4. Branch by duration:
   - <180s: single-pass
   - >=180s: chain scene segmentation + per-scene generation + stitching
5. Enforce shot/time skeleton and exact shot count.
6. Render storyboard markdown table.
7. Validate/repair timeline and formatting.
8. Export unified prompt table (文生图 + 图生视频)。
