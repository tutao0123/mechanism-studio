# 发动机豆包解说

五步中文课程来自同一份 `lesson.json`：整体、进气、压缩、做功和排气。步骤还指定曲轴角、选缸、机位和零件，便于暂停观察。

生成器复用项目中已测试的豆包 HTTP 协议解析与鉴权工具，输出限定在本发动机实例内，网页只读取公开音频和完成清单。它不读取方舟大模型密钥、不保存凭据、不搜索其它目录、不改全局配置。

在本实例目录执行：

```powershell
node voice/synthesize-doubao.mjs
node voice/synthesize-doubao.mjs --generate --config "本地豆包语音配置文件路径"
```

第一条只校验旁白，不调用服务；第二条明确调用豆包，可能消耗语音额度。配置变量为 `DOUBAO_TTS_API_KEY`，空模板见 `.env.example`。也支持已有 `VOLC_SPEECH_API_KEY`、`DOUBAO_API_KEY` 或旧式 App ID/Access Key。语音和方舟大模型鉴权不同，不自动混用。可用 `--speaker` 显式指定已获权限的音色，`--api-mode agent-plan` 显式选择官方 Agent Plan 语音接口。

只有五段均收到完整成功结束帧后，才发布 `assets/audio/*.mp3` 与 `voice/audio-manifest.json`。服务失败保留原有完成清单，不自动重试，不切换语音提供商。尚无完成清单时，页面明确显示配音未生成，继续提供文字解说。

4 项发动机发布测试覆盖完整成功、第三段失败、不完整流、凭据缺失和出界输出；通用协议、鉴权测试由共享模块提供，锁芯入口保留 14 项兼容回归。测试使用模拟音频，不代表真实服务已经生成。

2026-10-14 已生成五段真实豆包语音，使用 `seed-tts-2.0`、`zh_female_vv_uranus_bigtts` 和标准 HTTP 接口。五段完整结束、大小与 SHA-256 校验通过，FFmpeg 全段解码通过，均为 24 kHz 单声道；总体解说 32.328 秒。`lessonSha256` 覆盖校验后用于 TTS 的 id/title/narration，不包含镜头等观察字段。凭据未复制到项目。

协议依据：[豆包语音官方 HTTP 接口](https://docs.volcengine.com/docs/DoubaoVoice/unidirectional-streaming-text-to-speech-http?lang=zh)。
## 共用模块迁移

本目录保留发动机课程、已生成音频清单和 CLI 入口。协议、配置、整批发布及浏览器播放统一使用 `../../../shared/voice/`。详细接口见 [共用配音说明](../../../shared/voice/README.md)。已有五段 MP3 未重新生成；今后生成的文件以摘要命名，发布清单决定实际路径。

