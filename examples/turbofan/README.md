# 双转子涡扇：观察同心双轴

**Public checkout:** model, GLB, Blender builder, captions and voice-generation
code are included. Local `.blend` exports and provider-generated MP3s are
excluded from Git; the development notes below also describe those optional
files. See the [example catalog](../README.md) and [license policy](../../docs/licensing.md).

这是 Mechanism Studio 的原创教学几何实例。用一台示意双转子涡扇回答三个问题：哪些转子由低压轴连接、哪些由高压轴连接、固定静子与两条气流通道位于哪里。尺寸、级数和规定运动用于教学，不对应制造商或具体机型。

在项目根运行 `npm ci`、`npm run preview`，打开 `/examples/turbofan/`。默认白底黑线。切换整体、侧面、风扇正面和核心近景，拖动两根独立角度滑杆，或点选零件。展开时暂停并锁定机械输入，角度读数保留；复装恢复显示位置。五段中文课程使用项目共用的豆包配音生成与校验播放器。

## 工作过程示意层

`process.mjs` 声明固定路径与纯过程状态，`effects.mjs` 组合公共 `shared/animation/effects.mjs` 的流动箭头和事件标记。效果放在独立观察组中，不添加、替换或驱动任何源语义零件，不改变双轴模型、资产或机械读数。

- **核心路径**：冷色箭头从风扇进入低压/高压压气机，经过压缩段后到达环形燃烧室；暖色核心热气依次穿过高压、低压涡轮，再从核心喷管导出。
- **旁通路径**：另外六条浅青色路径从风扇外段绕过核心，沿旁通通道向后导出，和核心路径分开。箭头密度不表示质量流量或旁通比。
- **连续燃烧区**：暖橙色环带与局部标记固定在燃烧室内的环形空间，中央轴心保持空。它表示持续燃烧区域，不按转子每转一圈触发火花；暂停后保持同一静止画面。
- **尾流**：喷口外只保留短、淡暖色流迹，没有外部火焰标记，也没有加力燃烧室。这个普通涡扇示例不把喷口画成持续明火。

过程由同一轴角状态定位：核心和喷口流迹相位为高压轴角/360，旁通相位为低压轴角/360；这些只是可复现的教学相位，不是空气实际流速。效果不读取墙钟，不随机重采样，也没有自主播放循环。暂停固定全部箭头；手动拖动其中一根轴可重新定位对应路径，另一通道保持不变。连续燃烧强度不随转角闪烁。

界面有工作过程总开关、气流方向和连续燃烧区开关。它们只控制可见性，不代表发动机点火、熄火或供油控制。关闭剖面或开始展开时隐藏整个过程层，避免内部路径穿透封闭外壳或留在已分离的零件之间；复装/打开剖面恢复相同机械定位。材质仍启用深度测试，过程不会强制覆盖实体遮挡。

所有路径、颜色和燃烧区域均为本例按结构布置的解释标记，不是 CFD 流线、温度云图、热循环、喷雾混合、燃烧稳定性或性能求解。五步课程文案与已有豆包音频保持原样，描述的通道关系和“未进行流体计算”的边界仍然适用。

## 资产与接口

- `model.mjs` 是唯一网页运动来源。12 个旋转零件使用规定角度：风扇、低压轴、两级低压压气机与两级低压涡轮跟随低压输入；空心高压轴、四级高压压气机与高压涡轮跟随高压输入。播放演示速度为 36°/s 与 66°/s，属于演示设定。
- `assets/turbofan.blend` 是可编辑 Blender 源；`blender/build-turbofan.py` 从参数构建厚叶片、轮盘、同心轴、固定静子、环形燃烧室、机匣、旁通壁、支承和尾喷管。没有使用 Anatomy 几何套件或第三方发动机模型。
- `assets/turbofan.glb` 有 34 个稳定 `part_id`，每个语义零件保留装配父节点。转动件声明 `motionOwner: model` 与 `spool: low/high`，其余为 `static`。`assets/build-report.json` 保存生成器/GLB 摘要、实际网格与三角形数量。
- 机体设计单位为 mm，Blender 和 GLB 为 m；坐标只转换一次：`[x,y,z] mm → [x,z,-y] × .001 m`。所有转轴沿 x，零件原点位于该轴，网页只设置原节点 `rotationX`。
- 网页实际使用 `shared/viewer/viewer.mjs` 和 `shared/voice/player.mjs`。模型姿态写工作节点，展开只写独立 display 层；显示偏移来自 `scene-contract.json` 的机体坐标向量。

## 重建与验证

项目中已有便携 Blender 时，在项目根运行：

```powershell
New-Item -ItemType Directory -Path examples/turbofan/.cache -Force | Out-Null
$env:TEMP = (Resolve-Path examples/turbofan/.cache).Path
$env:TMP = $env:TEMP
$env:BLENDER_USER_CONFIG = Join-Path $env:TEMP 'config'
$env:BLENDER_USER_SCRIPTS = Join-Path $env:TEMP 'scripts'
$env:BLENDER_USER_DATAFILES = Join-Path $env:TEMP 'datafiles'
& ./.tools/blender-4.5.14-windows-x64/blender.exe --background --factory-startup --python examples/turbofan/blender/build-turbofan.py
node --test examples/turbofan/tests/*.test.mjs
```

其它安装位置可将可执行文件替换为本机 Blender 4.5。临时目录留在本例 `.cache`，无需全局插件或通用 MCP。此例直接使用授权的本地 Blender 脚本，`mcpUsed` 为 false。

测试检查两轴独立输入及同轴部件耦合、静子不动、观察状态不改读数、展开门控、坐标转换、真实 GLB 稳定 ID 与父层级、实际源几何厚度和轴间隙，以及生成摘要。它们不构成制造装配或性能验证。

过程层另测路径顺序和核心/旁通分离、环形燃烧位置、没有尾部火焰、单位转换、暂停和拖角定位、显示开关不改机械结果，以及实际 THREE 实例矩阵的可重复性、展开隐藏和同相位恢复。新增 8 项过程测试，连同原有模型/资产共 17 项通过；这不代替实际页面的视觉验收。

## 原理依据与简化

双轴、风扇及核心/旁通通道的示意依据是 [NASA Glenn 的 Turbofan Engine 教学说明](https://www.grc.nasa.gov/www/k-12/airplane/Animation/turbtyp/etfm.html)。这里通过自建几何表达连接和空间关系，没有复制其图片或模型。

过程顺序另核对 [NASA Glenn 的核心与旁通气流说明](https://www.grc.nasa.gov/www/k-12/airplane/turbfan.html)；燃烧室位于压气机与涡轮之间、环形结构围绕中央轴的解释核对 [NASA Glenn 的燃烧室说明](https://www.grc.nasa.gov/www/k-12/airplane/burner.html)。本例未复制其图像，也未将其性能方程当作已实现的求解器。

机匣、燃烧室与通道分成可隐藏的前半观察盖；高压轴有固定的预制纵向观察截面，便于看见内部低压轴。它们属于显示资产中的教学切面；关闭外盖开关不会把高压轴变为未经剖视的工程实体。叶片采用带厚度、错列、扫掠和展向扭转的示意截面，没有真实翼型、冷却流路或叶尖间隙验证。

本例不含真实 CAD B-rep、接触/配合求解、热力循环、燃烧、流体、推力、平衡或轴承载荷计算。气流通道的解释不意味着已经求解流线。展开偏移不代表维修拆装次序，也未验证无碰撞拆装路径。
