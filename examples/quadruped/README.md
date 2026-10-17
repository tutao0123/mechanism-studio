# 四足机器人：从足端到八个关节

![Eight-joint quadruped in the English Showcase viewer](../../docs/media/quadruped-preview.jpg)

*Existing English Showcase preview: original Mechanism Studio teaching model and
rendering (MIT). The body is fixed and the foot paths are prescribed; this is
not a balance simulation. Optional narration audio is not bundled in the public
checkout.*

**Public checkout:** model, GLB, Blender builder, captions and voice-generation
code are included. Local `.blend` exports and provider-generated MP3s are
excluded from Git; the development notes below also describe those optional
files. See the [example catalog](../README.md) and [license policy](../../docs/licensing.md).

Mechanism Studio 的 8DOF 运动学装配示例。四腿各有髋俯仰、膝俯仰，外展支架固定；没有侧向自由度。尺寸和所有三维部件由本例参数化脚本定义，不对应量产机器人，不使用 Anatomy 网格资源。

网页调用共用查看器、资产校验与豆包播放器。零件身份、姿态、观察展开、课程和生成音频分开维护，但机械动作与读数来自同一份 `model.mjs`。

另有 [英文自动循环短展示](http://127.0.0.1:4179/showcase/?story=quadruped&clean=1)，复用这里的模型和资产，六章依次观察整体、髋膝、足端轨迹、对角步态、预定支撑阶段及拆解复装。默认 Showcase **33.984 秒**，保留白底细黑线、无框细引线图注和衬线排版，使用约 0.8 秒切镜与按秒编排的动作；点击 `Play with narration` 后播放新生成的豆包英文 Jane 短旁白。页内可切换 [Explain 91.944 秒完整版](http://127.0.0.1:4179/showcase/?story=quadruped&mode=explain&clean=1)，原文案和音频保持不变。原中文课程与音频也保留。使用和验证入口见 [showcase README](../../showcase/README.md)。

## 可以观察什么

- 站立、左前腿单独抬起、两组相差半周期的对角步态。
- 步频 0.2–2 Hz，步高 10–60 mm，单腿抬高 0–60 mm。
- 整体、侧面、前视、足端近景和自由旋转；点击零件查看职责。
- 隐藏上盖观察电池与控制板；展开/复装只修改显示层。
- 六段文字课程与共用豆包音频入口；没有有效完整清单时仍提供文字解说。

`assets/quadruped.blend` 是可编辑源模型，GLB 包含 20 个稳定语义零件、291 个几何网格细节。上腿/小腿侧架、轴承、固定支架、六角螺钉、通风盖、控制板和足垫均可在 Blender 中继续修改。调用本地 Blender CLI 导出；没有调用或扩大锁芯专用 MCP。

## 同一个运动学模型

机身坐标：X 向前、Y 向左、Z 向上，长度使用 mm。GLTF 显示统一转换为米的 `[x,z,-y]`，只转换一次。髋高 200 mm；上腿长 `L1=100 mm`，小腿长 `L2=115 mm`；足垫球半径 10 mm，所以站立足心在 Z=10 mm。

髋角 `q1` 相对竖直向下，膝弯曲为 `q2`：

```text
x = L1*sin(q1) + L2*sin(q1+q2)
z = -L1*cos(q1) - L2*cos(q1+q2)
cos(q2) = (x*x + z*z - L1*L1 - L2*L2) / (2*L1*L2)
q1 = atan2(x,-z) - atan2(L2*sin(q2), L1+L2*cos(q2))
```

逆解使用明确的正膝弯曲分支；超出杆长或示意关节限位直接拒绝，不悄悄截断。髋限位为 -90°–65°，膝限位为 15°–135°。得到关节后，再用正运动学计算网页中的膝与足端坐标；右侧残差表示目标与复算足端的差，不是额外维护的演示数字。

对角组为左前+右后、右前+左后。摆动半周期使用平滑前进位置与平方正弦抬高；另一半周期在足心基准高度回移。机身始终固定，路径是原地演示。接触标签仅由预定轨迹阶段产生，不能当作地面力传感器或平衡证明。

## 明确的能力范围

这是几何教学与展示装配。没有浮动基座动力学、碰撞、地形、力矩、电机驱动、摩擦、触地冲击或稳定控制求解，不能直接用于真实机器人。目标在关节范围内，不等于实机可稳定执行。GLB/.blend 也不是原生 B-rep CAD 文件；展开不是工程配合求解。

正/逆运动学的通用背景参考 Lynch 与 Park 的 [Modern Robotics](https://modernrobotics.northwestern.edu/)；真实足式机器人涉及接触与动力学，参考 MIT 的 [Highly-articulated Legged Robots](https://underactuated.csail.mit.edu/humanoids.html)。本例方程与尺寸在此公开，几何及代码由项目自行实现，没有复刻上述课程中的机器人模型。

## 复现与检查

在 Mechanism Studio 根目录执行：

```powershell
node examples/quadruped/blender/build.mjs
node --test examples/quadruped/tests/*.test.mjs
node examples/quadruped/voice/synthesize-doubao.mjs
```

建模脚本优先读取显式环境字段 `MECHANISM_BLENDER_PATH`，否则寻找本仓库 `.tools/blender-4.5.14-windows-x64/blender.exe`。工具本身不会上传；其它系统或安装位置可以给当前命令指定 Blender 可执行文件。配置、临时目录和 Blender 缓存全部位于本实例 `.cache/`，不写用户全局配置。先从 JS 模型生成 `blender/build-input.json`，再输出源模型、GLB、场景契约和摘要记录。

最后一条仅干运行。实际豆包调用须显式 `--generate --config 本地凭据路径`，由用户授权的本地配置提供凭据；网页与仓库均不保存密钥。播放前会验证文案摘要及音频字节摘要。

测试覆盖杆长、全步高/相位的 FK/IK 一致性、限位/不可达输入、轨迹连续性、对角关系、观察独立性、真实 GLB 身份/父层/单位/静止姿态、可编辑源文件和六步课程绑定。显示网格检查不构成实物工程验证。

2026-10-14 验收：15 项本例测试通过，含六段已生成真实豆包音频的课程/字节/摘要一致性。浏览器实测载入 20 个语义零件、切换侧面/足端视角、点选上腿、步态播放与暂停、展开/复装；展开前后机械 derived 状态完全一致。第三段豆包解说核验后成功播放，页面无控制台错误。实际记录与截图保存在本例 `output/`，可公开的总览缩略图为 `assets/preview.png`。
