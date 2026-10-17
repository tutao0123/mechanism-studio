# Creo / Fusion 官方参考复核 · 2026-10-11

这是目录拆分前的历史复核，修正了初版 Creo 的暖白背景与青绿选择，以及 Fusion 的冷白蓝灰风格。SolidWorks、黑白线稿与其他配色不变。当时只修改项目内的外观数据、选择边线和说明，未重建 Blender 资产、生成配音或修改全局配置。记录整理到当前独立项目后保留，不表示迁移时重新执行了浏览器检查。

官方 PDF、PTC 截图与 PDF 渲染图是本机参考证据，已排除于发布清单，克隆公开仓库不会包含下面标明的本地媒体链接。公开依据以各官方来源链接为准；本项目页面截图与验证说明另行保留。

## Creo Parametric 12

- [PTC 默认系统颜色表](https://support.ptc.com/help/creo/creo_pma/r12/usascii/configuration_options/System_Colors.html)给出 Shaded Edge 为 RGB 34, 34, 38（`#222226`），Selected 为 RGB 51, 204, 77（`#33cc4d`）。此处使用这两个色值；Preselected 的亮黄绿与 Selected 不同。
- [系统颜色方案说明](https://support.ptc.com/help/creo/creo_pma/r12/usascii/configuration_options/About_System_Colors.html)说明 Default 使用中等色调背景，Light (Previous Creo Default) 使用浅背景。因此不能将某一种背景当作所有版本唯一默认。
- [主窗口截图](https://support.ptc.com/help/creo/creo_pma/r12/usascii/fundamentals/fundamentals/About_the_Pro_ENGINEER_Main_Window.html)与[实体外观示例](https://support.ptc.com/help/creo/creo_pma/r12/usascii/fundamentals/fundamentals/about_material_appearance.html)显示冷蓝灰实体、深色边线。历史上实际查看了主窗口、实体、背景与选择装配四张图片，本机副本保存在 [reference-creo](reference-creo/)（不随发布）。
- 当前方案：中灰背景、冷蓝灰实体、官方绿色选择。实体灰度、灯光和背景渐变端点根据截图近似；UI 的深绿按钮为本教学页面的可读性适配，不声称对应官方界面色值。

## Fusion 360 / Photo Booth

- [Autodesk 官方视图控制教材](https://files.upskill-dev.autodesk.com/public/fusion360-design-for-manufacturing-cert-prep/220225_L2-07_Demonstrate-view-controls.pdf)第 6 页明确使用 **Shaded with Visible Edges Only** 与 **Photo Booth**。图 15 显示中性灰背景、灰色实体与深色可见边线；第 3 页图 6 显示蓝色选中面与浅色边界。
- 历史本机证据：原 [PDF](references/fusion-view-controls.pdf)，通过[参考渲染脚本](references/render-fusion-reference.py)生成第 [1](references/fusion-view-controls-page-1.png)、[3](references/fusion-view-controls-page-3.png)、[6](references/fusion-view-controls-page-6.png) 页图片并逐一查看。PDF 与图片不随发布；脚本随源码保留时可从上面的官方地址重新取得资料。
- 当前方案：Photo Booth 中性灰背景与实体、深边线、蓝色选择填面和浅色选择边线。色值为截图风格适配，无官方精确 RGB 依据。教材为 2022 年资料，本方案不声称是所有当前版本、主题或环境的默认外观。
- 这里选择整个教学零件；官方示例的单面选择只用于参考视觉反馈，未实现 CAD 单面操作。

## 历史浏览器与代码验证

下面是原配色复核阶段的实际结果，不是当前项目搬迁后的验收数量；重新验证需运行当前命令并操作实际页面。

- 实际查看了 Creo、Fusion 完整装配和选择底座的画面，确认绿色选择、蓝色填面与浅色边界能够显示。
- 匹配钥匙插入 100%、底座选中后，从 Creo 切换 Fusion：机械状态、选择与相机不变，相机数值差为 0。
- Fusion 零件展开 100% 后切换 Creo：机械状态与展开程度不变，相机差值 `8.33e-17`；展开时钥匙控件保持禁用，合拢后恢复。
- 保留剖面与原有教学视角，页面控制台无错误。核对后恢复浏览器原先保存的外观偏好；保留的预览标签通过 URL 指定 Creo。
- `node --check prototype-3d/app.mjs` 与 `node --check prototype-3d/palettes.mjs` 通过。
- `node --test prototype-3d/tests/state.test.mjs prototype-3d/tests/line-art.test.mjs`：16 项通过。
- 具体浏览器状态见 [cad-reference-check.json](cad-reference-check.json)。此前验证保存在 [cad-palette-check.md](cad-palette-check.md)，其中旧 Creo / Fusion 截图为修正前记录。

## 更新后截图

- [Creo](../../shots/creo-verified.jpg) / [绿色选择](../../shots/creo-verified-selected.jpg) / [展开](../../shots/creo-verified-exploded.jpg)
- [Fusion](../../shots/fusion-verified.jpg) / [蓝色填面与浅色选择边线](../../shots/fusion-verified-selected.jpg)
