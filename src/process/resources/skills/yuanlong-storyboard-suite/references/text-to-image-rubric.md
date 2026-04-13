# Text-to-Image Rubric (Yuanlong)

## Pass Checklist (per shot)
- [ ] Contains fixed fields in order: 主体/空间/光影/镜头/音效(/台词)
- [ ] 主体字段含“正在”+动作动词
- [ ] 空间字段含 前景-中景-背景-
- [ ] 光影字段含 色温(K) + 明暗比(X:1)
- [ ] 镜头字段含 景别 + 运镜
- [ ] 若有台词，逐字匹配 dialogue[].text
- [ ] 至少一个可见情绪外化细节（目光/呼吸/手部/姿态）

## Fail Patterns
- 只有情绪形容词，无可拍动作
- 缺少空间层次（无前中后景）
- 光影不量化（无K值或明暗比）
- 镜头只有“推镜头”无起止语义
- 台词被改写
