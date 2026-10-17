# SolidWorks 风格配色

日期：2026-10-11。新增 `solidworks`，归入 `cad` 系列；既有 GitHub 浅色、深色、柔暗保留，全部方案共 13 套。无有效 URL 或已存偏好时仍以白底黑线为默认。

采用蓝灰渐变舞台、银钢零件和橙色点选参数；教学对齐保持绿色，受阻保持玫红。参考 [SolidWorks 官方系统颜色选项](https://help.solidworks.com/2018/english/SolidWorks/sldworks/HIDD_OPTIONS_SYSTEM_COLORS_modeldisplay.htm) 中可调背景渐变与选择颜色的设计，色值为本项目适配，未声称复制官方预设。沿用现有 PBR 渲染，没有新依赖。

数据检查通过 13 个唯一 ID、各类材质与灯光颜色有效、材质数值范围、GitHub 三套存在和默认回退。`node --check prototype-3d/app.mjs` 通过。

通过 Codex 内置浏览器实际操作：

- `CAD` 系列显示 SolidWorks，选择后 URL 为 `?v=2&palette=solidworks`，模型与界面均更新。
- 匹配钥匙 100%、转角 90°，切换 GitHub 浅色→深色→柔暗，保持同一机械状态。
- 回到 SolidWorks 展开 100%，所有零件进入取景；机械控件暂停，合拢后恢复。
- 点击底座铭牌，选中所属展示底座并出现选择色及作用说明。
- 最终浏览器错误日志为空；恢复原先的 100% 插入、0° 和未展开状态。

截图位于项目 `shots/solidworks-overview.jpg`、`solidworks-exploded.jpg`、`solidworks-selected.jpg` 和 `github-{light,dark,dimmed}-refined.jpg`。本轮未更改几何、原理、配音或运行时依赖。
