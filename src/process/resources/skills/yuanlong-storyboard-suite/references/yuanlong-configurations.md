# 元龙AI配置提取（导演风格 / 视觉风格 / 运镜语言 / 光影氛围）

- 来源文件：`docs/元龙AI分镜6.7.html`
- 提取时间：`2026-04-03T14:18:58.946Z`
- 配置总数：导演 54 / 视觉 41 / 运镜 21 / 光影 17

> 说明：运镜语言与光影氛围在源码中仅提供 `value + 显示文案`，未找到独立英文 prompt 映射；此处将显示文案作为相关 prompt。

## 1) 导演风格

| id | 名称 | tag分类 | 风格prompt | 运镜prompt | 光影prompt |
|---|---|---|---|---|---|
| generic | 标准电影感 (AI自由创作) | all（全部） | 叙事清晰、自然光效、构图稳健、通用电影质感 | 标准镜头、平稳运镜、自然剪辑 | 自然光、三点布光 |
| nolan | 克里斯托弗·诺兰 | scifi（科幻） | 非线性叙事、IMAX实拍、时间概念、IMAX实拍宏大构图 | Dolly Zoom眩晕感、IMAX超宽幅构图、时间轴交叉剪辑、实拍特效无CG | 高对比冷蓝钢灰调、工业冷光、强硬阴影、IMAX超清质感 |
| cameron | 詹姆斯·卡梅隆 | scifi（科幻） | 科幻史诗、技术革新、宏大场面 | 水下摄影、3D立体、动态捕捉、全景深 | 蓝绿色调、深海光、未来感 |
| villeneuve | 丹尼斯·维伦纽瓦 | scifi（科幻） | 宏大静穆、氛围美学、诗意科幻、宏大静穆极简构图 | 史诗航拍大远景、极简孤立构图、超缓慢推镜、日落剪影、人与环境对比 | 沙漠黄金时刻自然光、雾霭散射光、冷暖强对比、神圣降光感 |
| spielberg | 史蒂文·斯皮尔伯格 | classic（classic） | 经典好莱坞、情感共鸣、冒险精神 | 推轨镜头、面部特写、逆光轮廓、升降镜头 | 温暖、戏剧性、经典布光 |
| scorsese | 马丁·斯科塞斯 | classic（classic） | 犯罪史诗、快速剪辑、纽约风情 | 快速变焦、定格特写、跟踪长镜头、跳剪 | 霓虹灯、暗调、都市夜景 |
| fincher | 大卫·芬奇 | thriller（悬疑） | 冷峻精确、心理悬疑、暗黑美学、心理悬疑冷峻色调 | 斯坦尼康流畅长镜头、低角度权力仰拍、精确快速剪辑、暗部细节保留 | 低调暗部照明、青橙双色调（Teal-Orange）、强阴影硬边、冷荧光感 |
| hitchcock | 阿尔弗雷德·希区柯克 | thriller（悬疑） | 悬疑大师、心理惊悚、视觉隐喻 | 希区柯克变焦、主观视角、蒙太奇、悬念构图 | 高对比黑白、阴影恐惧、戏剧光 |
| tarantino | 昆汀·塔伦蒂诺 | action（动作） | 暴力美学、非线性叙事、复古致敬 | trunk shot、长对话镜头、血腥定格、跳剪 | 高饱和、霓虹灯、复古色调 |
| ritchie | 盖·里奇 | thriller（悬疑） | 英伦犯罪喜剧、快剪节奏、黑色幽默、英伦犯罪快剪 | 极速蒙太奇剪辑、多线索交叉叙事、慢快动作交替、独白内心画外音、字幕视觉插件 | 伦敦阴雨灰金调、酒吧暖橙光、高对比街景、自然光加脏感颗粒 |
| wook | 朴赞郁 | thriller（悬疑） | 暴力美学、黑色幽默、华丽视觉 | 横移长镜头、对称构图、快速剪辑、俯拍 | 高饱和、霓虹灯、阴影 |
| zhang | 张艺谋 | oriental（东方） | 色彩美学、东方意境、视觉奇观、色彩美学大色块构图 | 大色块饱和构图、千人群像精密调度、慢动作武打仪式感、对称俯拍宏观视角 | 极度高饱和大红大黑大金、丝绸漫反射光、水墨留白意境、仪式性剧场光 |
| wong | 王家卫 | oriental（东方） | 迷离情绪、慢快门、都市孤独、迷离情绪慢快门拖影 | 慢快门拖影长曝光、倾斜构图禁正中、抽帧跳帧、玻璃镜面反射、浅景深人物 | 霓虹灯暖橙黄光晕、朦胧过曝局部、雨后街道反光、深夜香港色调 |
| lee | 李安 | oriental（东方） | 东西方融合、细腻情感、技术探索 | 120帧高帧率、3D立体、长镜头、含蓄构图 | 自然光、柔和、东方意境 |
| kurosawa | 黑泽明 | oriental（东方） | 东方史诗、动态构图、人性探索、东方史诗天气元素 | 多机位宽幅拍摄、暴雨大风天气元素、轴向剪辑节奏、史诗群众场面、望远镜压缩景深 | 强烈自然顶光、戏剧性黑白高对比、暴风雨漫射光、武士侧面轮廓光 |
| hu_jinquan | 胡金铨 | oriental（东方） | 禅意武侠、京剧程式、竹林禅境、女侠叙事 | 快剪慢停交替节奏、京剧式动作程式化、固定机位禅意长镜、剪影轮廓构图、空间切割蒙太奇 | 竹林碎光丁达尔、庙堂幽暗烛光、水墨留白光感、自然环境光 |
| chenkaige | 陈凯歌 | oriental（东方） | 中国史诗、命运悲剧、东方美学、色彩美学大色块构图 | 大全景史诗构图、仪式感场面调度、慢推情绪特写、群像史诗剪辑 | 高饱和戏剧剧场光、京剧彩光渲染、大漠残阳金红、仪式性顶光 |
| yuen | 袁和平 | action（动作） | 武术指导、飘逸武打、创新动作 | 钢丝威亚、360度环绕武打、慢动作拆解、快速剪辑 | 自然光、竹林光影、水墨意境 |
| woo | 吴宇森 | action（动作） | 暴力美学、白鸽、双枪英雄 | 双枪对峙、慢动作枪战、白鸽飞起、对称构图 | 高对比、教堂彩窗、暗调 |
| tsui | 徐克 | oriental（东方） | 武侠奇幻、视觉奇观、技术创新 | 快速剪辑、特效合成、倾斜构图、夸张透视 | 高饱和、奇幻色彩、戏剧性 |
| chan | 成龙风格 | action（动作） | 功夫喜剧、创意打斗、环境利用 | 长镜头打斗、环境互动、滑稽动作、快速剪辑 | 明亮、自然光、喜剧氛围 |
| spielberg_war | 斯皮尔伯格(战争) | war（战争） | 战争写实、人性刻画、沉浸体验 | 手持摄影、战场长镜头、主观视角、纪实风格 | 自然光、硝烟、战场氛围 |
| bigelow | 凯瑟琳·毕格罗 | war（战争） | 战争惊悚、紧张节奏、真实感 | 手持摄影、快速剪辑、主观视角、纪实风格 | 自然光、紧张氛围、高对比 |
| malick | 泰伦斯·马力克 | war（战争） | 战争诗意、自然哲学、意识流 | 广角镜头、自然光、画外音、碎片化叙事 | 黄金时刻、自然光、诗意氛围 |
| zack | 扎克·施奈德 | visual（视觉） | 视觉奇观、慢动作、漫画美学 | 超慢动作、极速变焦、定格画面、史诗构图 | 高饱和、戏剧光、剪影 |
| burton | 蒂姆·伯顿 | visual（视觉） | 哥特奇幻、黑暗童话、怪诞美学、哥特黑暗童话 | 倾斜失重构图、黑白螺旋条纹、定格动画质感、夸张变形造型、月光仰拍 | 蓝黑冷月光、烛光暖斑点、高对比怪诞光影、万圣节调色 |
| gerwig | 格蕾塔·葛韦格 | visual（视觉） | 女性视角、温暖叙事、色彩明快 | 手持摄影、快速对话、粉色美学、跳跃剪辑 | 明亮、粉色调、自然光 |
| anderson | 韦斯·安德森 | visual（视觉） | 对称美学、童话色彩、怪诞幽默、对称美学糖果配色 | 绝对中心对称构图、横移平移镜头、正面90度俯拍、定格动画质感、图形化布局 | 粉黄薄荷糖果色调、柔和均匀平面光、无强阴影、插图感打光 |
| nolan_b | 诺兰(动作版) | action（动作） | 实拍特技、IMAX动作、时间操控 | 实拍特技、倒放镜头、时间压缩、超大画幅 | 冷峻、高对比、IMAX质感 |
| miyazaki | 宫崎骏 | anime（二次元） | 吉卜力风格、自然治愈、奇幻冒险、手绘质感、绿野与飞行美学 | 手绘动画长镜头、飞行俯冲镜头、草木风吹细节、微表情慢镜、自然光过渡 | 柔和自然光、暖黄绿调、晨雾光晕、草木反射光、梦幻氛围 |
| shinkai | 新海诚 | anime（二次元） | 唯美超写实、天空云彩、青春情感、天空云彩光粒子 | 超精细背景渲染、强烈镜头光晕、延时摄影感、极致光影细节、城市玻璃反光 | 黄金时刻强逆光、戏剧性云彩光晕、城市夜景霓虹倒影、蓝紫黄对比色调 |
| hosoda | 细田守 | anime（二次元） | 家庭温情、成长主题、动态动作 | 流畅动作、广角镜头、快速剪辑、情感特写 | 明亮自然光、夏日氛围、温暖色调 |
| kon | 今敏 | anime（二次元） | 现实与梦境、快速剪辑、心理悬疑、现实与梦境无缝切换 | 无缝蒙太奇切换、极速精确剪辑、现实梦境镜像对接、心理扭曲特写、时空叠加 | 高对比都市霓虹、梦境柔化色彩、现实冷光与幻想暖光对照 |
| anno | 庵野秀明 | anime（二次元） | 机甲战斗、意识流、心理描写 | 快速剪辑、定格画面、文字画面、意识流 | 高对比、戏剧光、末日氛围 |
| oshii | 押井守 | anime（二次元） | 赛博哲学、机械美学、雨夜都市、赛博哲学机械美学 | 固定机位哲思长镜头、机械细节极限特写、长独白旁白、空镜沉思切换、雨中倒影俯拍 | 蓝绿赛博工业冷光、雨夜湿路霓虹反光、机械仓库顶光、赛博都市天际线 |
| takahata | 高畑勋 | anime（二次元） | 写实风格、日常生活、细腻情感 | 写实动画、自然动作、长镜头、细腻表情 | 自然光、柔和色调、日常氛围 |
| koreeda | 是枝裕和 | arthouse（文艺） | 日常静默、家庭伤痕、自然光纪实、日常静默写实 | 固定机位长镜头、窗边自然光、儿童视角特写、餐桌场面调度、非对抗性剪辑 | 日式窗边柔和自然光、四季环境光变化、室内低饱和暖调、无刻意布光 |
| hou | 侯孝贤 | arthouse（文艺） | 台湾新浪潮、长镜头美学、时间流逝、台湾新浪潮固定长镜 | 固定机位超长镜头、窗框门框构图、远景人物渺小感、空镜叙事时间流逝、非职业演员自然表演 | 台湾午后自然光、暖黄昏光斜射、月光夜景低照度 |
| louye | 娄烨 | arthouse（文艺） | 手持写实、地下情感、都市迷离、手持粗糙写实 | 粗糙手持摄影抖动、快速推拉情绪化、逆光人像剪影、跟拍纪实感、胶片颗粒暗光 | 弱光手持自然光、城市霓虹迷幻、雨夜冷街道反光、高颗粒感低照度 |
| bigan | 毕赣 | arthouse（文艺） | 诗意长镜、梦境嵌套、贵州雾气、诗意长镜梦境游荡 | 单镜超长镜头漫游、3D梦境段落游走、画外音诗歌旁白、迷宫空间连续调度、时间错位叙事 | 贵州潮湿雾气散射、昏黄煤矿灯孤光、KTV彩色霓虹、梦境柔化光晕 |
| chow | 周星驰风格 | oriental（东方） | 无厘头喜剧、小人物逆袭、港式幽默 | 夸张表情特写、喜剧节奏剪辑、无厘头对话长镜头、慢动作热血反转、群戏闹剧调度 | 明亮温暖、港式霓虹、喜剧氛围 |
| kubrick_h | 库布里克(恐怖) | horror（恐怖） | 心理恐怖、对称构图、压迫氛围 | 单点透视对称、缓慢推镜、广角扭曲、静默长镜头 | 冷白走廊、异常强光、孤立阴影 |
| wan | 温子仁风格 | horror（恐怖） | 氛围恐怖、jump scare、灵异美学 | 缓慢拉镜揭示、暗处藏影、jump cut恐吓、音效驱动节奏、极度低角度仰拍 | 低调蜡烛光、深度阴影、单一冷光源 |
| nakata | 中田秀夫风格 | horror（恐怖） | 日式恐怖、静默压迫、心理扭曲 | 静止长镜头、缓慢移动阴影、扭曲肢体特写、声效留白 | 蓝绿冷调、阴暗潮湿、鬼气氛围 |
| aster | 阿里·阿斯特风格 | horror（恐怖） | 民俗恐怖、白昼惊悚、情绪崩溃 | 固定机位长镜头、强烈色彩对比、民俗符号特写、情绪升级慢燃 | 明亮白昼恐怖、北欧金色阳光、诡异仪式火光 |
| ads_cinematic | 电影级广告风格 | visual（视觉） | 品牌叙事、高端质感、情绪共鸣 | 极简构图、高速升格慢动作、产品特写光影、情绪蒙太奇 | 精准棚拍光、黄金时刻自然光、奢侈品质感 |
| mv_kpop | K-POP MV风格 | visual（视觉） | 高饱和潮流、舞台感、视觉冲击 | 卡点剪辑、多机位切换、霓虹灯光追踪、镜面反射构图 | 霓虹色彩、强补光、冷暖对比强烈 |
| mv_cinematic | 叙事MV风格 | visual（视觉） | 故事MV、情感叙事、电影质感融合 | 情绪慢镜、双线叙事剪辑、自然光跟拍、特写与大景交替 | 胶片质感、自然光主导、情绪色调 |
| xianxia_3d | 凡人修仙传风格 | anime（二次元） | 中国3D修仙国漫、精细人物建模、宏大仙界场景 | 史诗宽幅镜头、飞剑特效追踪、灵力粒子特效、功法发动慢动作、人物面部精细特写 | 灵气流光、仙雾缥缈、雷劫紫电、金光祥云 |
| shortdrama_style | 短剧质感风格 | arthouse（文艺） | 竖屏9:16构图、高饱和美颜滤镜、情绪密度极高、强节奏高反转、面部情绪特写驱动叙事 | 竖屏9:16中心构图聚焦人物、过肩正反打对话快切、面部微表情慢镜特写、升格慢动作配闪白转场、冷暖色调随情绪转换、信息密度高的快速蒙太奇 | 高饱和美颜柔光、面部三点布光消除阴影、冷蓝色调压抑段→暖黄色调觉醒段转换、夜景霓虹补光 |
| korean_romance | 韩系氛围感风格 | arthouse（文艺） | 唯美氛围感、低对比柔光、奶茶暖调、空气感散景、情绪留白、细腻配乐驱动情感 | 中近景结合面部手部细节特写、浅景深空气感散景虚化、回忆蒙太奇闪回重复、慢推情绪特写配OST切入、弱化色彩突出故事沉稳感、唯美场景选景构图 | 低对比柔和漫射光、奶茶米白暖色调、窗边自然侧光、黄昏金色逆光轮廓、雨后街道反光氛围 |
| mandrama_style | AI漫剧风格 | anime（二次元） | 有限动画帧、清晰墨线描边、平涂色块填充、漫画分格残留痕迹、口型微动有限表演 | 有限帧动画每秒8-12帧、清晰黑色描线勾勒轮廓、平涂色块无渐变填色、漫画分格构图残留、口型微动与眨眼有限表演、2D角色叠加手绘背景 | 平面化光影无立体阴影、色块区分明暗、漫画式高光点缀、简洁背景氛围光 |
| dark_epic | 暗黑史诗风格 | horror（恐怖） | 低饱和暗色调、哥特建筑纵深、魔法粒子暗光、压迫性戏剧光影、史诗级场面规模 | 低角度仰拍建筑压迫感、史诗大远景人物渺小对比、暗部细节保留深邃阴影、慢推魔法粒子特效镜头、烟雾体积光穿透缝隙、对称哥特建筑框式构图 | 极低调照明暗部主导、冷蓝紫色调、火光烛光作为唯一暖光源、体积雾穿透光缝、魔法发光粒子作为点光源 |
| raw_vlog | 毛边Vlog风格 | arthouse（文艺） | 手机随拍质感、自然不修饰、轻微过曝颗粒、生活流本真记录、反精致反滤镜的真实美学 | 手持晃动随拍跟拍、自然光不打灯直拍、非标准构图随机取景、长镜头生活流不剪辑、偶遇式伪纪实叙事、直视镜头打破第四面墙 | 纯自然available光、轻微过曝高光溢出、室内混合光源不校正、手机自动曝光直出 |

## 2) 视觉风格

| value | 名称 | tag分类 | 中文prompt | 英文prompt |
|---|---|---|---|---|
| none | 无风格 | realism（写实） |  |  |
| cinematic | 电影写实 | realism（写实） | 电影写实，追求极致的真实感和电影质感 | cinematic film still, photorealistic, anamorphic lens, dramatic lighting, sharp focus, professional color grading |
| documentary | 纪录片 | realism（写实） | 纪录片写实，手持晃动，自然光跟拍，粗糙颗粒感，真实感优先，Jump cut节奏 | documentary photography, handheld camera, natural light, film grain, candid moment, vérité style, neutral color grading, raw realism |
| kdrama | 韩式偶像 | realism（写实） | 韩式偶像剧，柔光人像，粉紫暖调，大光圈虚化，精致妆容特写，都市浪漫感 | Korean drama aesthetic, soft bokeh portrait, warm pink-purple tones, dewy skin, romantic urban setting, glamorous soft lighting, shallow depth of field |
| vintage | 复古胶片 | realism（写实） | 复古胶片，颗粒感强，色调怀旧 | vintage film, analog grain, nostalgic color grading, retro aesthetic, faded tones, 35mm film look |
| noir | 黑色电影 | realism（写实） | 黑色电影，黑白高对比，阴影深邃 | film noir, black and white, deep shadows, high contrast chiaroscuro, venetian blind shadows, moody atmosphere |
| shortdrama_look | 短剧质感 | realism（写实） |  | Chinese short drama aesthetic, high saturation beauty filter, glamorous soft lighting, smooth skin, vivid color grading, dramatic close-up, fast-paced cinematic |
| korean_mood | 韩系氛围 | realism（写实） |  | Korean mood photography, low contrast soft light, cream beige milk tea tones, airy bokeh, emotional negative space, gentle pastel palette, dreamy atmosphere |
| raw_aesthetic | 毛边美学 | realism（写实） |  | raw aesthetic, smartphone candid, natural available light, slight overexposure, life-like grain, unpolished authentic feel, casual composition |
| sports | 赛事体育 | realism（写实） |  | sports photography, high speed shutter freeze frame, motion blur trail, low angle dynamic shot, high contrast, stadium lighting, adrenaline energy |
| anime | 日式动漫 | animation（动画） | 日式动漫，线条清晰，色彩明快，具有二次元感 | anime style, 2D hand-drawn animation, vibrant colors, cel shading, clean linework, expressive eyes, detailed hair, flat color fills, NOT 3D, NOT photorealistic |
| pixar_3d | 皮克斯3D | animation（动画） | 皮克斯3D动画，圆润角色造型，高饱和暖色，次表面散射皮肤质感，超强表情力，细腻环境叙事 | Pixar animation style, subsurface scattering skin, expressive character design, warm saturated colors, smooth surfaces, appealing proportions, studio lighting, high quality render |
| claymation | 黏土定格 | animation（动画） | 黏土定格动画，手工质感 | claymation, stop motion, handmade clay texture, tactile surface, matte finish, warm studio light |
| pixel_art | 像素艺术 | animation（动画） | 像素艺术，复古游戏感，点阵清晰 | pixel art, retro game aesthetic, 8-bit, crisp pixel dots, limited color palette |
| donghua_xianxia | 3D修仙 | animation（动画） / oriental（国风） | 中国3D修仙国漫风格，角色精细建模，东方仙侠美学，灵气流光粒子特效，仙山浮云宏大场景，飘逸发丝与华服 | Chinese 3D xianxia animation, flowing immortal robes, qi energy particles, celestial mountain, magical sword light, ethereal mist, detailed character model |
| ghibli | 吉卜力 | animation（动画） |  | Studio Ghibli style, 2D hand-drawn animation, NOT 3D, hand-painted watercolor background, lush green nature, soft natural light, whimsical organic shapes, warm golden natural light, detailed grass and leaves, gentle character expression |
| disney_3d | 迪士尼 | animation（动画） |  | Disney 3D animation, big expressive eyes, round adorable face, candy bright colors, smooth glossy surface, fairy tale castle, magical sparkle particles, princess aesthetic |
| gothic_anime | 暗黑哥特 | animation（动画） |  | dark gothic anime, deep shadow palette, sharp angular linework, moonlit candlelight, gothic cathedral architecture, pale skin dark clothing, vampiric elegance, 2D dark fantasy |
| ai_mandrama | AI漫剧 | animation（动画） |  | AI comic drama style, limited animation frames, clear ink outlines, flat color cel shading, manga panel traces, subtle mouth movement, 2D character on painted background |
| oil_painting | 油画质感 | art（艺术） | 油画质感，笔触明显，色彩浓郁，艺术感强 | oil painting, visible impasto brushstrokes, rich saturated colors, painterly texture, old master technique |
| watercolor | 水彩手绘 | art（艺术） | 水彩手绘，边缘晕染，清透唯美 | watercolor illustration, soft wash, bleeding edges, delicate transparency, wet on wet technique, poetic softness |
| comic | 美漫风格 | art（艺术） | 美式漫画，粗犷线条，张力十足 | comic book style, bold black outlines, pop art, dynamic composition, Ben-Day dots, graphic impact |
| ukiyoe | 浮世绘 | art（艺术） / oriental（国风） | 浮世绘风格，传统日本艺术感 | ukiyo-e woodblock print, traditional japanese art, flat bold colors, fine contour lines, natural motifs |
| surreal | 超现实 | art（艺术） | 超现实主义，梦幻且怪诞 | surrealist, dreamlike, impossible architecture, Salvador Dali influence, uncanny juxtaposition, hyper-detailed |
| french_illus | 法式插画 | art（艺术） | 法式插画，平面色块几何化，Moebius线条风格，欧洲动画感，简洁优雅构图 | French graphic novel style, Moebius line art, flat geometric color blocks, clean elegant composition, European animation aesthetic |
| cyberpunk | 赛博朋克 | fantasy（幻想） | 赛博朋克，霓虹灯光，高对比度，科技感十足 | cyberpunk, neon lights, rain reflections, high contrast, dark city, holographic billboards, wet asphalt |
| fantasy | 奇幻魔法 | fantasy（幻想） | 奇幻魔幻，色彩绚丽，充满魔法感 | fantasy art, magical atmosphere, ethereal glow, vivid colors, mystical creatures, epic landscape |
| steampunk | 蒸汽朋克 | fantasy（幻想） | 蒸汽朋克，齿轮机械，黄铜色调 | steampunk, brass gears, Victorian aesthetic, mechanical details, aged copper, steam vents, sepia tone |
| 3d_render | 3D渲染 | fantasy（幻想） | 3D渲染效果，虚幻引擎质感，模型精细 | 3D render, Unreal Engine, hyperrealistic model, subsurface scattering, ray tracing, photorealistic texture |
| concept_art | 科幻概念 | fantasy（幻想） | 科幻概念艺术，机械设计图感，Greg Rutkowski风格，宏大世界观场景，精密细节渲染 | sci-fi concept art, digital matte painting, intricate mechanical detail, epic scale environment, Greg Rutkowski style, cinematic lighting |
| post_apocalyptic | 末日废土 | fantasy（幻想） |  | post-apocalyptic wasteland, barren desert, rusted metal structures, crumbling buildings, polluted sky, survival gear, dusty muted earth tones, desolate atmosphere |
| dark_fantasy | 暗黑奇幻 | fantasy（幻想） |  | dark fantasy art, deep shadow palette, gothic architecture, magical dark particles, oppressive dramatic lighting, epic scale, souls-like aesthetic, ominous atmosphere |
| mecha | 机甲科幻 | fantasy（幻想） |  | mecha sci-fi, giant robot, metallic reflections, battle damage texture, particle thruster glow, destroyed cityscape background, dramatic low angle, mechanical detail |
| ink_wash | 国风水墨 | oriental（国风） | 中国传统水墨画风格，笔墨晕染，留白意境，山水写意，丹青设色，东方古典美学，如宋元山水意境 | Chinese ink wash painting, sumi-e brushwork, misty mountains, poetic negative space, flowing calligraphic lines, Song dynasty aesthetic |
| paper_cut | 皮影剪纸 | oriental（国风） | 中国皮影剪纸，镂空剪影造型，红黑金传统配色，工艺美术感，平面装饰风格 | Chinese paper cut art, silhouette cutout design, red black gold palette, folk art craftsmanship, shadow puppet aesthetic, flat decorative pattern |
| gongbi | 工笔画 | oriental（国风） | 中国工笔画风格，白描铁线勾勒，矿物质颜料分层渲染，绢本设色，唐宋院体花鸟画美学，笔触精细入微，色彩清丽典雅，青绿朱砂配色，工整而不失灵气 | gongbi painting, Chinese fine-brush meticulous painting, ultra-fine silk-thread ink outlines baimiao, layered mineral pigments on silk scroll, azurite blue and malachite green palette, cinnabar red accents, ivory silk background, Tang-Song dynasty court aesthetic, bird-and-flower huaniao genre, luminous translucent color washes built layer by layer, precise botanical and figural detail, elegant classical Chinese composition, no visible brushstrokes, seamless meticulous surface |
| dunhuang | 敦煌壁画 | oriental（国风） |  | Dunhuang mural art style, mineral pigment texture, flying apsara figure, lotus motif pattern, crackled ancient wall texture, gold leaf accents, Buddhist art aesthetic, warm ochre and turquoise palette |
| minguo | 民国复古 | oriental（国风） / realism（写实） |  | Republic of China era aesthetic, qipao cheongsam, old Shanghai neon, sepia tinted photograph, Art Deco elements, vintage film fade, 1930s glamour |
| collage | 拼贴混搭 | art（艺术） |  | mixed media collage, magazine cutout, multi-texture patchwork, graffiti doodle overlay, torn paper edges, handwritten text, zine aesthetic |
| miniature | 微缩模型 | art（艺术） |  | tilt-shift miniature photography, extremely shallow depth of field, toy-like scale, bird eye view, vibrant saturated colors, tiny detailed world |
| neon_fluid | 霓虹流体 | fantasy（幻想） |  | neon fluid art, glowing liquid metal, dark background bright neon colors, tech particle streams, chrome reflection, electronic music visual, abstract light trails |

## 3) 运镜语言

| value | 名称 | tag分类 | 相关prompt |
|---|---|---|---|
| dolly_in | 缓慢推镜 | camera-tech | 缓慢推镜 |
| dolly_out | 拉远揭示 | camera-tech | 拉远揭示 |
| pan | 摇镜头 | camera-tech | 摇镜头 |
| tilt | 升降镜头 | camera-tech | 升降镜头 |
| orbit | 360度环绕 | camera-tech | 360度环绕 |
| handheld | 手持呼吸感 | camera-tech | 手持呼吸感 |
| dolly_zoom | 希区柯克变焦 | camera-tech | 希区柯克变焦 |
| fpv | FPV穿越机 | camera-tech | FPV穿越机 |
| pov | POV主观视角 | camera-tech | POV主观视角 |
| steadicam | 斯坦尼康跟随 | camera-tech | 斯坦尼康跟随 |
| whip_pan | 快速甩镜 | camera-tech | 快速甩镜 |
| crash_zoom | 极速急推 | camera-tech | 极速急推 |
| tracking | 跟踪镜头 | camera-tech | 跟踪镜头 |
| rack_focus | 移焦 | camera-tech | 移焦 |
| aerial | 航拍 | camera-tech | 航拍 |
| macro | 微距特写 | camera-tech | 微距特写 |
| bullet_time | 子弹时间 | camera-tech | 子弹时间 |
| low_angle | 低角度仰拍 | camera-tech | 低角度仰拍 |
| high_angle | 高角度俯拍 | camera-tech | 高角度俯拍 |
| dutch_angle | 荷兰角(倾斜) | camera-tech | 荷兰角(倾斜) |
| split_screen | 分屏效果 | camera-tech | 分屏效果 |

## 4) 光影氛围

| value | 名称 | tag分类 | 相关prompt |
|---|---|---|---|
| golden_hour | 🌅黄金时刻 | lighting-tech | 🌅黄金时刻 |
| blue_hour | 🌆蓝色时刻 | lighting-tech | 🌆蓝色时刻 |
| neon_noir | 🌃霓虹noir | lighting-tech | 🌃霓虹noir |
| volumetric | ✨丁达尔效应 | lighting-tech | ✨丁达尔效应 |
| silhouette | 🌑剪影效果 | lighting-tech | 🌑剪影效果 |
| rembrandt | 🎨伦勃朗光 | lighting-tech | 🎨伦勃朗光 |
| high_noon | ☀️正午强光 | lighting-tech | ☀️正午强光 |
| overcast | ☁️阴天柔光 | lighting-tech | ☁️阴天柔光 |
| studio | 📸影棚柔光 | lighting-tech | 📸影棚柔光 |
| firelight | 🔥篝火烛光 | lighting-tech | 🔥篝火烛光 |
| bioluminescence | 🪼生物发光 | lighting-tech | 🪼生物发光 |
| foggy | 🌫️迷雾朦胧 | lighting-tech | 🌫️迷雾朦胧 |
| rainy | 🌧️雨夜湿润 | lighting-tech | 🌧️雨夜湿润 |
| snowy | ❄️雪景冷调 | lighting-tech | ❄️雪景冷调 |
| moonlight | 🌙月光冷色 | lighting-tech | 🌙月光冷色 |
| lens_flare | 🌟镜头光晕 | lighting-tech | 🌟镜头光晕 |
| backlight | 💫逆光轮廓 | lighting-tech | 💫逆光轮廓 |
