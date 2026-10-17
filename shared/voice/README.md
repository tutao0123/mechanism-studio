# Shared optional narration

New examples can use the provider-neutral **Node-only speech adapter** below.
The existing Doubao lesson/player pipeline remains available for old recordings;
it is optional and is not required to view or export a music-led example.

## Provider-neutral speech API

`speech.mjs` exports `normalizeSpeechConfig()`, `requestSpeech()` and
`synthesizeSpeech()`. Input is text plus explicit endpoint/model/voice/format.
Output is verified-type audio bytes and a secret-free identity record; local
synthesis writes immutable, content-addressed audio and a `.speech.json` sidecar
inside the selected example. It does not migrate an existing Doubao manifest,
start browser playback, align words or change a camera timeline.

As checked **2026-10-18**, OpenRouter documents a dedicated
[`POST /api/v1/audio/speech`](https://openrouter.ai/docs/guides/overview/multimodal/tts)
endpoint with OpenAI-compatible request fields and raw audio responses. The
adapter's `openrouter` preset uses that endpoint and supports documented `mp3`
or raw `pcm`. Discover currently available **speech** models using the public
[`models?output_modalities=speech`](https://openrouter.ai/api/v1/models?output_modalities=speech)
catalog; select that model's supported voice and format. A general chat model,
an audio-input model or a voice from another provider is not automatically TTS.
Catalog IDs, account access and service terms can change.

The `openai` preset uses its speech endpoint; a `custom` OpenAI-compatible
endpoint requires an explicit HTTPS URL and an independently supplied allowed
origin. Custom format/model/voice support is the provider's responsibility.
`instructions` and `speed` are optional and should be omitted unless the model
supports them. No voice-cloning, model auto-selection or paid fallback is added.

Copy [speech-config.example.json](speech-config.example.json) to an ignored
`speech.local.json`, set a current model/voice, and put your narration in a text
file inside the example. Only the **name** of the environment variable appears
in JSON; its value stays in the CLI/server environment. Do not place keys in a
browser, query string, source control or a public example configuration.

```powershell
# First validate only: no key is read and no request/output is created.
node shared/voice/speech-cli.mjs --config examples/my-example/speech.local.json --input examples/my-example/narration.txt --root examples/my-example
# Explicit generation uses the named API key from this shell/server environment.
node shared/voice/speech-cli.mjs --config examples/my-example/speech.local.json --input examples/my-example/narration.txt --root examples/my-example --generate
```

Default output is `examples/my-example/output/narration/`. `--output` may choose
another location within that example. There is no config/secret discovery and
no paid call in preview, tests or a dry run. Custom endpoints additionally need
`--allow-origin https://your-speech-host.example`; presets reject endpoint
overrides. Redirects are rejected so credentials cannot follow a changed host.

```js
// Server/CLI code only. apiKey is supplied by the authorized caller.
import { synthesizeSpeech } from './shared/voice/speech.mjs';
const result = await synthesizeSpeech(text, {
  provider: 'openrouter', model, voice, format: 'mp3',
}, { rootDir: exampleRoot, apiKey });
// result: { path, recordPath, metadata }; no key appears in metadata.
```

HTTP chunks are collected up to a finite byte limit; an interrupted response
fails. The adapter checks status, MIME type and MP3/WAV signature or complete
PCM16 frames. These are transport/container checks, not an actual decoder or a
listening review. JSON, SSE and HTML are never silently saved as MP3. A custom
service can explicitly choose `responseMode: 'json-base64'` and `base64Field:
'audio.data'`; canonical base64 and the same audio limits are checked. This is
not a streaming-chat/SSE parser. `pcm` requires documented `sampleRate` and
`channels` and explicit `encoding: 's16le'`, remains `.pcm` and needs conversion
before ordinary browser playback. Other raw PCM encodings require another adapter.

Failed requests publish no audio. Output paths are checked before and after
the network request, rejecting escaping paths, symlinks and junctions. Existing
content-addressed files are never overwritten. HTTP bodies, key values and
underlying network errors are omitted from CLI errors. Generated files remain
private/ignored until their provider's redistribution terms are reviewed.

Bind any chosen, playable narration file to the same media clock as the scene,
measure its actual duration and retain text/silent fallback. The older
`createLessonPlayer()` below still validates **Doubao manifest v1**; a generic
speech sidecar must not be relabeled as a valid old lesson manifest.

Checks: `node --test shared/voice/speech.test.mjs` uses fake responses only.

## Existing Doubao lesson integration

**Public source release:** original lesson text, adapters, manifests and synthesis
code are included under MIT. Provider-generated MP3s are excluded until their
downstream redistribution terms are established. Existing local recordings remain
untouched. Geometry/text/music examples need no speech account. Generating new
Doubao narration is optional and uses the recipient's own credentials and service
rights; see [licensing](../../docs/licensing.md#optional-doubao-narration).

既有课程实例使用同一套豆包适配器。浏览器只播放本地 MP3，不获得凭据、不调用 TTS，也不维护机械判断。新示例不强制采用此提供方。

| 模块 | 职责 |
| --- | --- |
| `lesson.mjs` | 校验有序课程与固定文案摘要 |
| `provider.mjs` | 浏览器与生成器共用的豆包身份、资源与端点常量 |
| `config.mjs` | 仅解析显式指定的本地配置，豆包鉴权与固定官方端点 |
| `protocol.mjs` | 按 HTTP JSON 流重组音频，要求明确成功结束 |
| `generator.mjs` | 验证实例输出范围，整批成功后发布音频清单 |
| `cli.mjs` | 通用干运行与显式生成入口 |
| `player.mjs` | 课程/清单加载、摘要核验、预加载、播放/暂停/定位 |
| `messages.mjs` | 中文与英文播放器状态文字 |

## 文案身份

`narration-v1` 摘要使用固定 JSON 字段顺序：

```js
{ schemaVersion: 1, language: 'zh-CN' /* or 'en-US' */, steps: [{ id, title, narration }] }
```

标题和旁白先去除首尾空格，步骤顺序影响摘要。镜头、曲轴角度、零件 ID 等实例元数据保留在课程文件中，但不改变配音身份。这样镜头调整可以继续使用相同文案的已有音频。此规则兼容锁芯、直列四缸的现有清单；无需重新请求已生成的音频。

共用课程支持 `zh-CN`、`en-US` 和 1–100 个有序步骤。语言参与摘要，因此中英文清单不能混用。ID 为小写字母、数字和中间连字符，必须唯一；每段旁白最多 1024 UTF-8 字节。各实例可以在薄入口中另行指定 `expectedStepIds`。新增英文支持不改变现有中文的规范 JSON 或摘要。

## 实例 CLI

```js
import { mainCLI, reportCLIError } from '../../../shared/voice/cli.mjs';
// ROOT 是本实例目录，不是仓库或父目录。
mainCLI(process.argv.slice(2), {
  rootDir: ROOT,
  lessonPath: new URL('./lesson.json', import.meta.url),
}).catch(reportCLIError);
```

默认只校验。显式 `--generate --config 本地配置文件` 才调用服务；可额外指定 `--speaker` 与 `--api-mode speech|agent-plan`。不搜索目录，不读取环境变量作为隐式密钥，不把配置复制到仓库。两种模式对应固定豆包官方端点；Agent Plan 必须使用新 API Key，文本模型密钥不代表语音权限。

英文课程使用 `language: 'en-US'`，并显式传入兼容 2.0 的英文音色，例如 `--speaker en_female_jane_uranus_bigtts`。生成器仅为英文请求追加官方 `additions` JSON 字符串 `{"explicit_language":"en"}`，中文请求保持原样。默认音色仍是现有中文音色；英文课程的调用方需要指定英文音色。官方来源、核验日期与账户权限边界见 [English voice reference](./english-voice-reference.md)。

`generator.mjs` 的输出必须在传入的实例根中。写入前及网络等待后复核所有现存路径，拒绝符号链接、Windows 目录连接和出界路径。全部供应商响应成功结束并包含音频之后才创建输出。新 MP3 使用 `步骤ID-完整SHA256.mp3` 的不可变名称，最后原子替换清单；旧清单及旧音频不会提前删除或覆盖。本地发布失败可能保留未被清单引用的完整摘要文件，之后可复用；播放器不会将其当作已发布课程，也不会删除可能由另一成功批次引用的文件。提供者错误、HTTP 正文与底层凭据错误不写入日志。

## 浏览器播放器

```js
import { createLessonPlayer } from '../../shared/voice/player.mjs';
const player = createLessonPlayer({
  baseURL: new URL('./', location.href),
  lessonURL: 'voice/lesson.json',
  manifestURL: 'voice/audio-manifest.json',
  onStatus: state => { statusElement.textContent = state.message; },
  onPlayback: state => { button.textContent = state.playing ? '暂停解说' : '播放解说'; },
});
const { lesson, manifest } = await player.load();
// 实例负责把选定课程应用到自身机械状态与镜头。
await player.toggleStep(lesson.steps[0].id);
player.stop(); // 用户改变机械状态、换步骤或离开页面时调用。
```

还可传入已有 `audioElement`，或自定义 `audioFactory`。`load()` 保留完整实例课程元数据，返回 `lesson/manifest/status/message`。清单要求豆包、MP3、完整步骤、合法相对路径与匹配文案摘要；任何失败都保留文字课程并拒绝播放。每段音频在首次播放或预加载前核验字节数与 SHA256。暂停后再次点击会继续播放；`stop()` 取消待加载播放、清除当前音源并归零，保留已验证的 Blob 缓存。下一次 `load()` 或 `dispose()` 释放全部 Blob URL；`dispose()` 还解除播放器事件监听。不要在外部 Audio 仍使用这些 URL 时调用这两个方法。

播放器默认跟随已加载课程的语言。传入 `locale: 'en-US'` 可让课程读取前的提示、错误和中文课程页面中的提示也使用英文；现有中文页面保持中文。浏览器不调用语音服务，也没有系统语音回退。

## Narrated tours and the audio clock

```js
const player = createLessonPlayer({
  baseURL: new URL('./', location.href),
  lessonURL: 'voice/lesson.json',
  manifestURL: 'voice/audio-manifest.json',
  locale: 'en-US',
});
await player.load();
const records = await player.preloadAll();
// Object keys follow lesson order. Every record is { id, url, bytes, sha256 }.
const audio = new Audio(records.overview.url);
audio.preload = 'auto';
// After a user gesture, audio.play() may start the narrated tour.
// Drive captions and camera motion from audio.currentTime.
// Pause this Audio before calling player.load() or player.dispose().
```

`preloadStep(id)` returns one verified, immutable record. Concurrent calls for the same ID share a fetch and Blob URL. `preloadAll()` returns an object keyed by step ID, in lesson order; both methods reject missing, corrupt, oversized or stale audio. Neither creates an Audio element nor starts playback. The player owns these URLs: callers must not revoke them, and must stop external audio before invalidating them with `load()` or `dispose()`. Individual records are limited to 32 MiB; a complete lesson is limited to 128 MiB. A reload or disposal cancels in-flight preloads rather than caching stale bytes.

For the built-in transport, `playStep(id, { startTime })` optionally starts at a non-negative time in seconds. `seek(seconds)` requires an active source, preserves the paused state, and clamps to a known duration; `setMuted(boolean)` also applies to Audio instances created later. These methods use native `Audio.currentTime`. There is no internal animation timer. `onPlayback` fires for native `timeupdate`, `seeking`, `seeked` and `loadedmetadata`; call `snapshot()` each rendered frame when camera motion needs smoother sampling. Browser autoplay restrictions still require a user gesture for audible playback.

`snapshot()` 提供状态、步骤、播放阶段、`duration/currentTime/muted/ended/locale`、可用配音数量 `readySteps` 与已验证缓存数量 `preloadedSteps`，不包含任何机械读数。`phase` 为 `loading/playing/paused/stopped/ended/error`。`ended` 会停止并归零内置播放器；需要连续章节时，由调用方选择下一章。

## 检查

```sh
node --test shared/voice/*.test.mjs prototype-3d/voice/synthesize-doubao.test.mjs examples/inline-four/voice/synthesize-doubao.test.mjs
```

所有合成测试使用模拟流；没有真实计费请求。检查覆盖任意步骤数、中英文身份、文字摘要及已生成音频兼容、协议失败、旧清单保留、路径连接、播放摘要、预加载复用与取消、原生音频时钟和控制。
