## 1) 先定产品规则（必须先拍板）

  1. 参考图来源：仅本地文件
  2. 作用范围：
      - 角色参考图：是否默认作用到含该角色的所有 shot？ - 是的，在prompt中用“@角色名”表示，方便用户阅读和理解，角色名不要有空格，具体解析在后台作为prompt发送图片生成模型时解析为具体的图片，比如“@LuLu（图片1）对@MaMa（图片2）打了一个招呼”
      - 场景参考图：是否默认作用到该 scene 下全部 shot？- 是的，可以保持布景的一致性
      - 道具参考图：是否仅手动绑定到 shot？- 在剧本生成时就自动关联，参照角色名的表示和关联方式，就是前面的“@”符号是否有必要替换为其他符号，如果没有必要也可以用“@”
  3. 每个 shot 最多带几张参考图（建议 4~8 张）。设置上限，建议最多6张，放在图片模型生成失败
  4. 优先级规则（建议：角色 > 场景 > 道具）。- 可以的
  5. 模型不支持图像参考时是否自动降级为纯文生图并提示。- 嗯，但是目前基本都是支持参考图的，如果不支持就在整段prompt前面就对角色等进行统一描述（只对该张图片中出现的资产进行描述，防止prompt长。），不用在后续每个角色中进行重复描述，

  ———

  ## 2) 数据模型与“文件即上下文”

  ### 建议落盘结构 - 可以的

  - 资产仍在 02-assets/*/*.json - 接受，资产名称不能带空格
  - 参考图文件集中放：
      - 02-assets/references/character/{charId}/...
      - 02-assets/references/scene/{sceneId}/...
      - 02-assets/references/prop/{propId}/...
  - JSON 里保存相对路径（方便迁移/agent 改文件）

  ### 建议字段 - 可以的

  - 资产 JSON：完善 referenceImagePaths（后续可升级为对象数组，含主参考图、权重）
  - shot JSON：规范 assetRefs（明确绑定哪些 asset id）

  这样后续智能体直接改 JSON 就能驱动 UI 同步。

  ———

  ## 3) 生成链路改造（核心）

  在 image_generate 阶段，按 shot 组装引用图后传给：

  executeImageGeneration({ prompt, image_uris: [...] }, ...)

  需要新增一个“引用图解析器”：

  - 从 shot.assetRefs + scene默认绑定 + character默认绑定 汇总
  - 去重、按优先级排序、截断上限
  - 文件不存在时跳过并记录 warning
  - 模型不支持多图输入时降级到纯 prompt

  ———

  ## 4) UI 改造点 - 可以的，但注意仔细观察目前的UI（比如可以参照shot详情页UI细节），确保UI风格一致

  1. Asset Library
      - 角色/场景/道具资产可上传参考图、预览、删除、设主图
  2. ShotDetailPanel
      - 新增“References”区：展示当前 shot 绑定资产及其参考图
      - 一键绑定/解绑资产
  3. Storyboard 卡片
      - 显示“已绑定参考图”状态标识
  4. 生成反馈
      - 生成中显示“正在应用 N 张参考图”

  ———

  ## 5) IPC / Service 需要新增

  - 资产参考图管理：
      - addAssetReferenceImages
      - removeAssetReferenceImage
  - shot 绑定：
      - updateShotAssetRefs（或复用 updateShot）
  - 可把现有 applyAssetToShots 从“仅角色”扩展成通用资产绑定

  ———

  ## 6) 测试与回归

  - 单测：
      - 引用图解析优先级/去重/缺图容错
      - image_generate 是否正确传 image_uris
  - 服务测试：
      - 上传/删除参考图落盘正确
  - UI 测试：
      - shot 绑定后立即可见
  - 回归：
      - 无参考图项目行为完全不变

  ———

  ## 7) 推荐实施顺序（两阶段）- 可以，我建议在使用video-creation-suite这一skills生成剧本的时候，需要约束LLM来返回剧本中所有的角色、场景、道具，并在image prmopt引用对应的角色、场景、道具，同时提供角色、场景、道具的prompt，这些prompt方便在资产管理面板中进行图片生成、修改等管理操作

  ### V1（先可用）

  - 只做“手动绑定资产 -> 生成时带参考图”
  - 不做复杂权重，只做优先级 + 上限
  - 预计开发快、风险低

  ### V2（增强）

  - 主参考图/权重
  - 场景默认自动继承
  - QA 阶段增加“参考一致性”检查
