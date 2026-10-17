# Anatomy 思路与弹子锁原理

新版参考 [Anatomy 官方项目](https://github.com/wheresryan22/anatomy)的机制先行、精细实体、同一模型驱动运动与读数、实际读图检查等原则。当前独立项目安装的是 [.agents/skills/mechanism-studio](../.agents/skills/mechanism-studio/SKILL.md)，不依赖原 Anatomy 绘图库，也不要求在这里安装原版。来源和许可见 [第三方说明](../THIRD_PARTY_NOTICES.md)。

## 值得沿用的工作方法

先写读者需要理解的因果关系，再列出零件和动作；零件细节应服务于连接、接触和运动，而不是装饰。读数、状态说明和画面使用同一份原理模型。正常动作、错误输入和复位都要可以操作并核对。

原 Anatomy 包含等距绘图、可选三维与拆解示例，具体能力以其 [README](https://github.com/wheresryan22/anatomy/blob/main/README.md) 和 [SKILL.md](https://github.com/wheresryan22/anatomy/blob/main/SKILL.md) 为准。新版以 Blender 资产与网页教学流程重新组织这些原则；原版 SVG 审计不能直接用来证明 GLB、工程接触或 CAD 精度正确。

## 五组弹子锁的零件

教具采用普通单排弹子结构，每组展示下弹子、上弹子和弹簧。固定外壳包住可转动锁芯；钥匙槽属于锁芯，下弹子接触钥匙，上弹子位于弹簧下方。锁芯与外壳相接的边界叫剪切线。[Schlage 官方术语表，PDF 第 18 页](https://www.schlage.com/content/dam/sch-us/documents/pdf/installation-manuals/P513-325.pdf#page=18)

观察顺序：

1. 没有钥匙时，跨越边界的弹子阻挡转动，弹簧使弹子向钥匙槽方向复位。
2. 插入钥匙后，各处齿高配合不同长度的下弹子，将各组接缝抬到相应高度。
3. 匹配钥匙让全部上下弹子接缝落在剪切线上；任一组过高或过低，仍有弹子跨越边界。
4. 对齐后钥匙与锁芯转动，尾部驱动件传递动作；回到原位并拔出钥匙，弹子复位。[Schlage 原理定义](https://www.schlage.com/content/dam/sch-us/documents/pdf/installation-manuals/P513-325.pdf#page=18) · [ASSA ABLOY 圆筒锁说明](https://www.assaabloy.com/ng/en/solutions/products/locking-solutions/cylinders)

对齐的是五组接缝高度，不是下弹子的长度或钥匙接触点的高度。教具设计中，下弹子和钥匙随锁芯转动，上弹子与弹簧属于固定外壳。五组是本实例的选择，不同实际锁型的组数、形状、钥匙槽和尺寸可能不同。

## 教学读数与边界

模型用每组下弹子的顶端高度减去剪切线高度得到对齐误差；接缝高度来自钥匙接触高度与下弹子长度之和。五组判定共同决定能否转动。显示“可转动”时，画面应确实全部对齐；显示某组受阻时，应能看到该组跨越边界。

当前长度、容差和动画是教学示意，不是实测图纸。平面剪切线模型未实现真实圆柱接触、摩擦、弹簧力、动态碰撞和工程公差分析。三维页面的动作与观察说明见 [锁芯原型](../prototype-3d/README.md)；真实 CAD 能力的计划见 [CAD 路线](cad-roadmap.md)。
