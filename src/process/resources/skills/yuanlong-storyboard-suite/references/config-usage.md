# Config Usage (Yuanlong)

## Included Config Packs
- 导演风格: 54
- 视觉风格: 41
- 运镜语言: 21
- 光影氛围: 17
- Source file in this skill: `references/yuanlong-configurations.md`

## Selection Order
1. 先确定叙事模式（Single / Chain, STC / 保真）。
2. 再选导演风格（决定叙事语气与镜头组织）。
3. 再选视觉风格（决定画面材质与渲染语汇）。
4. 再选运镜语言（镜头运动策略）。
5. 再选光影氛围（场景情绪与光照体系）。

## Mapping Rule
- 允许显式传参：director_id / visual_style / camera_style[] / lighting_style[]。
- 未显式给定时，按核心情节关键词从配置表检索最匹配项。
- 冲突时优先级：保真约束 > 台词锁定 > 时长与镜数锁定 > 风格偏好。
