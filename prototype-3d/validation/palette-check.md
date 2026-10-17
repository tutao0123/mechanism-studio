# 配色检查 · 2026-10-11

新增暖白黄铜、深空蓝、石墨铜三套配色，并保留原版蓝金作对照。所有源码、说明和截图均在 anatomy-lab 内；无依赖安装、权限变更或全局设置修改。

## 本轮验证

- `node --check prototype-3d/app.mjs` 与 `node --check prototype-3d/palettes.mjs` 通过。
- IAB 桌面 1280 × 1000：同一匹配钥匙插入 100%、转动 0°、展开 0%、剖面打开、整体视角，逐一切换四套配色并读取页面状态、查看实际渲染。
- UI token 静态对比度复核：正文、次级文字和操作/状态文字达到 4.5:1；石墨铜选中按钮的 accent/selected 为 4.90:1。三维材质另以实际截图检查。
- 错误钥匙 2、4 组的玫红阻挡色，与铜橙弹簧及绿色对齐色清楚区分；转动滑杆保持禁用，状态仍为 3/5 组对齐。
- 播放本地豆包 `assets/audio/wrong.mp3` 时切换配色：DOM 读取的 paused 仍为 false，src、步骤、机械数值与相机预设标签一致。
- 展开 100% 后切换配色，展开值、钥匙位置和错误钥匙步骤保持不变。
- 去掉 URL 的 palette 参数后重新进入，显示已保存的石墨铜，验证站点局部偏好记忆。
- 390 × 844 手机布局无横向溢出，四个按钮排成两列；滚回可见模型区后截图确认模型实际显示。默认窗口也检查了两列色板与单列观察区。
- 浏览器错误日志为空。只读独立审阅确认外观更新未调用机械控制器、重设相机或暂停音频。

未修改机械逻辑或豆包配音；本轮没有重复运行已有完整机械/语音测试。

## 截图

- [暖白黄铜](../../shots/palette-ivory.jpg)
- [深空蓝](../../shots/palette-midnight.jpg)
- [石墨铜](../../shots/palette-graphite.jpg)
- [原版对照](../../shots/palette-original.jpg)
- [深色错误钥匙](../../shots/palette-midnight-blocked.jpg)
- [手机模型视窗](../../shots/palette-mobile-stage.jpg)
- [默认窗口最终显示](../../shots/palette-final.jpg)

`palette-mobile.jpg` 仅作整页文字/布局证据。模型离屏时不继续渲染，整页截图不能可靠证明离屏 Canvas 的显示；手机模型以视窗截图为证据。检查后已清除临时尺寸覆盖，恢复原窗口，并停在暖白黄铜、匹配钥匙完全插入的整体观察状态。

## 第二轮：VS Code / GitHub 参考配色

新增六套，合计十套；按 VS Code 3、GitHub 3、原有配色 4 分组。所有参考来源列在原型 README 与 palettes.mjs 注释中。

- app.mjs 与 palettes.mjs 语法检查通过；10 个 ID 唯一，family 数量正确，八类材质和灯光字段完整。
- 只读独立检查了 14 类实际文字/背景配对，全部达到 4.5:1，新配色最低为 GitHub 浅色的 good/goodBg 4.56:1。
- 在默认窗口（799 CSS 像素宽）逐一切换六套新主题，匹配钥匙 100%、角度 0°、展开 0%、整体观察保持一致。六张最终截图均实际显示模型，已独立读图复核。
- 系列筛选只显示本组 3/4 张色板，不改变当前配色、URL、机械状态或音频。具体色板选择才应用配色并更新 URL。
- 豆包 wrong.mp3 播放中，从 GitHub 切到 VS Code 候选系列：读取的 palette、机械数值、相机预设标签、解说步骤、src、paused 全部一致；再选择 Monokai 后，paused 仍为 false，src 保持不变。
- 390 × 844 的手机页面只显示三张候选、排为两列，无横向溢出，模型实际可见。测试后清除了尺寸覆盖。
- Monokai 的紫上弹子、青弹簧、黄钥匙，以及错误钥匙第 2、4 组的鲜粉红失败色清楚区分。机械、配音和资产文件未修改。

临时桌面尺寸覆盖在当前 IAB 的缩放下曾产生捕获空边；最终六张图已在默认尺寸下重拍，不使用异常图作证据。

| VS Code 深色 | VS Code 浅色 | Monokai |
|---|---|---|
| [截图](../../shots/palette-vscode-dark.jpg) | [截图](../../shots/palette-vscode-light.jpg) | [截图](../../shots/palette-monokai.jpg) |

| GitHub 浅色 | GitHub 深色 | GitHub 柔暗 |
|---|---|---|
| [截图](../../shots/palette-github-light.jpg) | [截图](../../shots/palette-github-dark.jpg) | [截图](../../shots/palette-github-dimmed.jpg) |

[手机分组与模型](../../shots/palette-github-mobile.jpg) · [Monokai 错误钥匙](../../shots/palette-monokai-blocked.jpg)
