# 豆包五步配音

这里保存中文旁白和本地合成工具。配音只调用豆包，页面不接触 API Key。
2026-10-11 已使用用户指定的本地配置，只读 `VOLC_SPEECH_API_KEY`，完成五段真实豆包配音；凭据没有复制进项目。
本次使用官方「元气甜妹」`ICL_uranus_zh_female_yuanqitianmei_tob`、`seed-tts-2.0` 与标准 V3 HTTP 接口。
使用 Node 20 或更新版本的内置 `fetch`，不需安装依赖或修改全局配置。

## 本地校验

在 `prototype-3d` 目录运行：

```powershell
node voice/synthesize-doubao.mjs
node --test voice/synthesize-doubao.test.mjs
```

默认只读取 `voice/lesson.json` 并校验五步旁白，不请求服务，不生成音频清单。
可加 `--config "本地文件路径"` 校验指定配置；脚本不搜索其它目录，不读取环境变量。
未知配置字段不参与合成，不会保存到输出，也不会打印其值。

## 明确开始合成

准备本地配置文件，可参考 `.env.example`；不要提交真实凭据，不要放进可公开访问的页面资源。
如果在项目内保存 `.env`，预览服务器必须阻止读取它；也可只读用户明确指定的其它本地路径。
新控制台填写 `DOUBAO_TTS_API_KEY`；已有配置也支持 `DOUBAO_API_KEY`、`VOLC_SPEECH_API_KEY` 别名。
旧控制台填写 `DOUBAO_APP_ID` 和 `DOUBAO_ACCESS_KEY`。
API Key 与旧字段同时存在时使用 API Key。音色默认使用官方示例 `zh_female_vv_uranus_bigtts`。
账户是否开通 `seed-tts-2.0` 与该音色权限，只有真实请求才能确认。

```powershell
node voice/synthesize-doubao.mjs --generate --config "F:\path\to\doubao.env"
# 使用指定的公共音色 ID：
node voice/synthesize-doubao.mjs --generate --config "F:\path\to\doubao.env" --speaker ICL_uranus_zh_female_yuanqitianmei_tob
```

JSON 配置也支持 `apiKey` 或 `appId` / `accessKey`，以及 `speaker`、`sampleRate`、`speechRate`、`apiMode`。
默认 `apiMode=speech`，地址固定为 `https://openspeech.bytedance.com/api/v3/tts/unidirectional`。
只有明确指定 `--api-mode agent-plan` 或同名配置，才使用官方 Agent Plan 的固定地址 `https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional`，且必须使用新 API Key。
不推断密钥类型，也不在失败后自动切换接口。`TAO55S_TTS_*` 等其它工具的私有参数不会被自动映射。
合成会把五段旁白发送至选定豆包 HTTPS 地址，并可能消耗账户的语音合成额度。
每段串行请求，无自动重试；超时、鉴权失败或断流会停止本轮，不使用替代 TTS。

## 输出与页面契约

- 五段全部返回成功结束帧且包含音频之后，才开始发布本地文件。
- 已生成的历史音频为 `assets/audio/{part,wrong,align,turn,reset}.mp3`；今后生成使用 `assets/audio/步骤ID-SHA256.mp3`，页面以清单中的 `src` 为准。
- 完成清单为 `voice/audio-manifest.json`，只有全部发布成功才写入。
- 页面读取 `manifest.complete` 和 `manifest.steps[id].src`；`src` 相对 `prototype-3d` 根目录。
- `lesson.steps` 提供对应的 `id`、`title` 和 `narration`，不需要另存字幕副本。
- 清单保存字节数、SHA-256 和可用的计费字数；不含凭据或私有配置路径。
- 服务阶段或本地发布失败都保留上一轮有效清单和对应音频。新音频使用不可变摘要文件名，最后原子替换清单。
- 本地发布失败可能留下未被清单引用的完整摘要音频，可在后续成功批次复用；页面不会显示本轮完成。

已验证五段都收到 `code: 20000000` 完成帧；FFmpeg 全段解码通过，MP3 均为 24 kHz 单声道。
清单内五段字节数、SHA-256 及旁白课程哈希均与本地文件一致；14 个协议/鉴权/发布测试通过。
时长分别为 part 19.224 秒、wrong 13.968 秒、align 15.840 秒、turn 17.976 秒、reset 16.464 秒。
这些检查确认真实合成与音频文件完整性；页面播放、音画对应和人工试听由原型运行验收继续确认。
没有完成清单时，页面应提供文字说明，并明确“豆包配音尚未生成”。

## 已核实的协议与验证边界

[新 HTTP 文档](https://docs.volcengine.com/docs/DoubaoVoice/unidirectional-streaming-text-to-speech-http?lang=zh)规定 V3 地址、新 API Key 鉴权、`seed-tts-2.0` 和 MP3 参数。
[官方历史 V3 HTTP 文档](https://docs.volcengine.com/docs/DoubaoVoice/HTTPChunkedSSEUnidirectionalStreaming-V3?lang=zh)及其 `tts_http_demo.py` 示例确认旧鉴权、JSON 音频包与成功终止码。
[官方 Agent Plan 语音文档](https://docs.volcengine.com/docs/ark/agent-plan-personal-voice-model?lang=zh)确认专属 API Key、同一资源线及 `plan/tts/unidirectional` 地址。
解析器将 `code: 0` 的 base64 音频块按序拼接，`code: 20000000` 表示成功结束，其它代码视为失败。
HTTP 网络块不是 JSON 消息边界：本地测试覆盖碎片化 UTF-8、多对象、元数据、断流、错误码和非法 base64。
脚本要求显式结束帧与非空音频，拒绝将 HTTP 200 或已收到部分音频当作合成完成。
这里使用 HTTP Chunked，不混用 SSE 的 `event/data` 或 WebSocket 的二进制事件格式。
旁白描述教学示意机构，不声称实际工程尺寸、接触几何或力学精度已验证。
## 共用模块迁移

本目录保留锁芯课程、已生成音频清单和 CLI 入口。协议、配置、整批发布及浏览器播放现在统一使用 `../../shared/voice/`，不再维护第二份生成器。详细接口与发布行为见 [共用配音说明](../../shared/voice/README.md)。现有音频和文案摘要保持有效，没有因迁移重新调用豆包。

