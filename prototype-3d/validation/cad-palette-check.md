# CAD 显示风格验证 · 2026-10-11

根据用户提供的 SolidWorks 截图，将此前蓝灰金属展示改为灰紫不透明实体、深色可见轮廓、灰白垂直渐变背景和柔和投影。在 CAD 分组新增 Creo 与 Fusion 360。三套都是为本教学页面制作的风格适配，不是官方预设或 CAD 软件本身。

CAD 与黑白线稿复用 Lambert 填面和已有特征边线；CAD 保留阴影，关闭金属反光。实体遮挡后方线，平面上的三角划分不作为边线。线稿与原有金属材质主题保留各自的显示方式。

## 验证结果

- 三套 CAD 配色的实际页面均已查看，15 套主题与 GitHub 三款仍可选择。
- 匹配钥匙插入 100% 后切换 Creo、Fusion 360，机械状态不变，相机差值低于 `1e-10`。
- 锁芯转到 90°、零件展开 100% 后切换 SolidWorks、白底黑线与 GitHub 深色，机械状态、展开程度与相机不变。
- 白底黑线关闭阴影；CAD 与 GitHub 材质恢复阴影。浏览器画面确认 CAD 边线、线稿与金属材质可正确切换。
- 错误钥匙插入后第 2、4 组未对齐，转动控件不可用。点选第 2 组上弹子可显示零件说明，仍保留玫红警告面与边线。
- 页面控制台无错误；`node --check prototype-3d/app.mjs` 通过。
- `node --test prototype-3d/tests/state.test.mjs prototype-3d/tests/line-art.test.mjs`：16 项通过。

记录见 [实际浏览器状态](cad-palette-check.json)。只改配色、显示逻辑、样式和说明，没有重建 Blender/GLB 或生成配音。

## 截图

- [SolidWorks](../../shots/solidworks-cad-refined.jpg)
- [Creo](../../shots/creo-cad.jpg)
- [Fusion 360](../../shots/fusion360-cad.jpg)
- [SolidWorks 展开](../../shots/solidworks-cad-exploded.jpg)
- [Creo：选中受阻弹子](../../shots/creo-cad-warning-selected.jpg)

参考：用户提供的 SolidWorks 界面截图，以及 [PTC 实体带边线显示说明](https://support.ptc.com/help/creo/creo_pma/r12/usascii/assembly/asm/About_Display_Styles.html)、[Autodesk Fusion 显示设置教程](https://www.autodesk.com/learn/ondemand/curated/fusion-quick-start-guide/3hzSp0q4YIHXZd3dj8ZzQb)。
