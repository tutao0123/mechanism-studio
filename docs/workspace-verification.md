# Project verification record

## WOLF CAD study, colour cues and video · 2026-10-17

> The WOLF actuator example recorded here was removed on 2026-10-20 to keep the repository small. This entry is a historical record; the files remain in Git history (last present at commit `10f724f`).

The music assembly page now uses `shared/study`; `shared/appearance` owns
deterministic pale-blue occurrence cues and independent material copies. The
SO-ARM page is a thin adapter and its old source/audio remain intact. The WOLF
adapter uses a separate real AP242 source: 184 definitions, 252 usages, 245 leaf
occurrences and 8 assembly nodes. Exact identity, hierarchy, unit conversion and
placements pass; analytic coverage is limited for 69 original source-triangulated
bearing definitions reused across 138 instances. Fresh Galileo parity confirms
the backend changes retain the earlier specimen's graph, placements and geometry.

The full project suite passed **376** checks. The subsequent camera-up/preview
route changes passed **9** focused checks, and robot plan integration passed
**43** example checks. The official skill validator passes with UTF-8 and existing
project-local dependencies; **180** local links inside this skill resolve. These
are executed scopes, not a promise of arbitrary STEP or constraint support.

The accepted local video is `examples/wolf-actuator/output/wolf-34s-v2.mp4`:
34.3 seconds, 1920×1080/30 fps, 1,029 frames, H.264/AAC, original quiet procedural
music and sparse editorial effects. Every recorded source-node local matrix was
asserted unchanged. The full-page raster, labels, fade, colours and source credit
were checked; five conservative box outliers were disproved using every actual
mesh vertex. Decode, frame sequence, audio duration/level and faststart pass.
Actual frames and the encoded contact sheet were inspected; subjective listening
and a subjective whole-clip motion review remain unclaimed. The first raw-CDP
recording was visually rejected for a mismatched crop and is not a deliverable.

The visible, focused browser completed all six chapters against the native music
clock with a sampled maximum 0.0531-second audio/last-drawn-state difference.
Reduced motion starts paused; the 390×844 CSS-pixel view retains a short readable
gear name. Crowded whole/return/resolve shots omit names. Current evidence and
publication status are in WOLF verification (`examples/wolf-actuator/verification.json`)
and [robot integration verification](../EXAMPLE_ROBOT/verification-color-study.json).

All work stays within Mechanism Studio. GitHub publication was not performed;
the unchanged 88.6 MB source currently exceeds the release-file budget, so the
older release-audit pass below is historical rather than a pass for this new
source package. Source packaging and the author's code license remain pending.

## Modular authoring and text/image intake · 2026-10-17

Mechanism Studio remains one project-local skill entrypoint. New input and orchestration references separate text, images/drawings, CAD and mixed sources; supplied facts, visible observations, author assumptions and unknowns remain distinct. Three focused authoring modules now describe explosion, camera direction and materials/lighting, with responsibilities, required inputs, outputs, current API adapters and acceptance evidence. These references define handoff plans, not executable schemas, a new runtime plan loader or automatic image-to-CAD reconstruction.

The shared handoff records real part/occurrence bindings, actual coordinate conventions, geometry revisions and dependent plan revisions. Concept, bound and validated distinguish a proposal from real asset binding and executed checks. Explosion changes require affected framing to be rechecked; appearance changes preserve engineering identity and interaction overrides. Text- or image-based teaching geometry uses authored identity and declared assumptions. Existing visual rules remain the single style source, and a user's explicit duration overrides Showcase defaults.

The skill creator validator passes. All **198** checked local Markdown link targets across **23** skill/entry documents exist inside the project. All **8** focused preview-server checks pass, including serving the updated skill entrypoint while keeping local tools/configuration private. The local release-list audit passes and performs no publication.

An independent forward trial produced three concept plans in ignored `.test-output/module-forward-trial/`: a 12-second image-only breakdown, a 32-second text-designed teaching gearbox, and a proposed 20% increase in the existing Galileo display explosion. The image trial viewed its input without borrowing that image's original model. Plans kept author assumptions separate from native identity, honored requested durations and did not claim implementation or visual checks. The real explosion API clamps progress, so the distance proposal correctly scales vectors rather than exceeding progress 1. The trial also identified the existing story shell's unconditional speech preparation and capture timeline dependency; audio guidance now requires adapting a new silent-only story instead of fabricating a TTS requirement. Camera guidance clarifies preserving view direction while rechecking scale and bounds after expansion.

No runtime code, existing model, source CAD, lesson, sound, UI style or dependency changed, so model/audio rebuilding and full browser visual checks were not repeated. Changes and controllable verification output remain inside Mechanism Studio; no global skill, permission or external service was changed.

## Reusable skill and CAD evidence workflow · 2026-10-17

> The KFL08 example used in the generic-import trial below was removed on 2026-10-20; it remains in Git history (last present at commit `10f724f`).

The project-local skill now routes work to Inspect, Explain or Showcase according to the requested result. Real STEP inspection can complete without an invented motion model, lesson or soundtrack. The entrypoint links focused CAD and audio runbooks rather than duplicating implementation APIs. X short clips use the current no-narration preference, with code-synthesized music when requested; explicit narration still uses Doubao. Existing public playback supports silence and narration, without a shared music generator/player or video exporter. White line art, serif typography, camera and annotation rules remain unchanged.

`import:cad` accepts an explicit example source package and reuses the XCAF/display pipeline. It verifies pinned source bytes, supported units, exact usage mapping, both tessellation settings and unchanged source graphs/matrices before replacing the four owned display assets. Tests exercise rejection before backend startup, ancestor junctions, stale caches, legitimate equal triangle counts, ordinary replacement rollback and retained Galileo byte compatibility. This is not a multi-file reader transaction or guaranteed recovery after process/OS termination.

`audit:cad` checks retained source identity, source/display hashes, hierarchy, manifest/exported transforms, actual binary mesh bindings, triangles and face recovery evidence. It writes a local report with per-capability status, without modifying source/display assets. The Galileo package reports **limited** for six disclosed mesh-recovery faces, while source identity, placement consistency and shared definition geometry are supported. Its source and GLB hashes remain the values recorded below. There are zero unmeshed faces; no global geometric-error guarantee is inferred.

An isolated copy of the already retained real KFL08 source exercised the generic workflow with the actual project-local Python/OCCT backend at both settings. It retained **30 definitions, 30 occurrences including root, 29 source usages and 22 source parts**. Fine/coarse unique triangle counts were 22,986 and 10,516; no faces required recovery or remained unmeshed. The resulting evidence report is **verified** within the listed checks. This is a second source exercised through the reusable route, not a newly acquired third specimen or an upgrade of the original KFL08 webpage. The trial found and corrected a preflight issue with explicitly unitless 2D surface-parameter contexts; unassigned 3D and ordinary 2D geometry remain rejected.

`npm test`: **281 passed, 0 failed**. The skill creator's validator passes; 130 local Markdown link targets across the skill and updated entry docs exist and remain inside the project. An independent forward review found and resolved unconditional narration requirements in older instructions. The release-list audit passes and performs no publication. It now rejects candidate CAD provenance explicitly marked local-only, with regression coverage; this marker check cannot discover arbitrary private copies or establish licensing rights.

No viewer, geometry, existing lesson/audio or browser behavior changed in this iteration, so browser checks were not repeated. Previous UI evidence remains scoped to the original inspection implementation below. Logs, reports and the real generic-import trial are in ignored `output/cad-research/`; the retained Galileo evidence report is `output/cad-check/shaft-bearing.json`. All edits and trial outputs stayed in Mechanism Studio; global settings, sibling projects, credentials and MCP permissions were unchanged. Native placement re-evaluation, exact B-rep measurement, mates/joints and physical simulation remain outside these tools.

## Real STEP occurrence inspection · 2026-10-16

> The GPL-3.0 Galileo 2 example recorded here was removed on 2026-10-20 to keep included models under permissive licenses. This entry is a historical record; the files remain in Git history.

The second external CAD example retains the complete original Galileo 2 STEP at commit `98f8a37944d7277cd37231776400553cc402219f`, source SHA-256 `d3a699b72a8cbdf7fc3acc70078870df141efb0a62991f8fa0bebd3ee56405bf`, its GPL v3 license and upstream manual references. This is a compact real extruder assembly with carriage/PCB context, rather than an authored bearing fixture. Carrier is the documented shaft, with a front bearing holder and genuinely repeated M3 fastener definitions.

OCCT XCAF maps all 146 source usage relations exactly: 69 definitions, 147 occurrences including root, 126 parts and 21 assemblies. One source assembly also owns geometry; its anonymous OCCT geometry component is folded into its real source owner without inventing a source occurrence. The GLB contains 127 semantic geometry owners, 49 reused mesh definitions and 235,938 placed triangles. The six faces omitted by nominal fine meshing were recovered with individually recorded retry settings; no imported faces remain unmeshed. Those settings do not certify geometric accuracy.

Fresh fine/coarse imports preserve the complete definition/occurrence graph and every local/world matrix. A second complete rebuild produced the same GLB SHA-256 `91b7130e725c16765d58109acf30b6ad12bf659e0f41683b60f7c2a9ecef9e21`. The independent XCAF regression also covers repeated subassemblies, shared child definitions under different parent paths, noncommuting placements and nonsequential/reversed STEP entity records. `npm test`: **236 passed, 0 failed**. The project skill validator and its local reference links pass. The release-list audit passes for 367 files; it performs no publication and the author's overall license remains unselected.

Browser verification selected three real M3×8 occurrences independently. A mesh click on usage `#590` selected the exact same tree identity; changing to instance 2 selected `#589` while preserving the shared definition. Hiding reduced the visible geometry count from 3 to 2; restore returned all 127 and zero explosion. Isolation, selecting an outside part and showing it restored context correctly. Filtered keyboard navigation retained focus on a visible ancestor/child. At 100% explosion, projected visible mesh bounds remained within the current orthographic view, and the engineering manifest remained frozen. Actual narrow and medium layouts (effective 300px and 945px widths) had no horizontal overflow; temporary viewport overrides were reset. This is local browser verification, not physical-device or CAD precision certification.

Source/report artifacts are in `examples/shaft-bearing`; local rebuild/test logs and screenshots are in ignored `output/cad-research/`. All code, runtime, downloads, caches and outputs stayed within Mechanism Studio. No global skill/configuration, Blender MCP scope, credentials or external publication was changed. The source identity foundation does not yet recover mates or solve joints, perform engineering measurements, or validate disassembly collisions.

## Showcase default and short quadruped · 2026-10-15

New public examples now default to **Showcase**, targeting 30–40 seconds, while **Explain** retains the detailed lesson. The skill entrypoint, pacing reference, visual guidance and project instructions share this default. Presentation timing is separate from the white line drawing and serif typography. The runtime resolves only available editions; existing engine lessons remain Explain. A stage-top mode selector remains accessible in clean view.

The quadruped's default URL now opens a separately written **79-word, 33.984-second** English Doubao Jane edit. The original **91.944-second** Explain edition remains at `mode=explain`; all ten original lesson/duration/CLI/manifest/MP3 files were compared by SHA-256 and left unchanged. New clips use the same provider and voice, with their own lesson identity, audio files, completion manifest and measured durations. No original soundtrack was sped up or overwritten.

Showcase uses 0.8-second camera transitions, earlier brief label fades, a 0.76 Hz prescribed gait and a single-leg lift completed in one second. Display explosion takes 1.2 seconds, holds for one second, closes over 1.2 seconds and remains assembled. Its final mechanical pose matches the next opening pose. Explain retains its original 0.32 Hz gait, chapter-progress action timing and 2.4-second camera transitions. The same selected profile and measured chapter lengths drive silent and audible playback; the source kinematics, GLB and framing geometry are reused.

`npm test`: **198 passed, 0 failed**. Additional checks cover mode resolution/fallback, independent short/full narration, the 30–40-second measured range, silent hint lengths, faster actions and camera timing, deterministic seeking, real GLB poses and loop restoration. The subsequent default-resolution adjustment also passed all eight presentation/narration integration checks. Offline verification fully decoded all **45** included MP3s, validated their bytes and hashes, and measured **778.536 seconds** in total. The skill validator and local release-list checks pass.

Browser checks exercised the default short URL, real English playback over two complete narrated loops, a complete silent loop, and real mode selection. The full edition still played with its original 91.944-second timeline; switching back canceled that audio and started the short edition silently. The actual short scene showed a 40 mm lift at chapter time 1.042 seconds and fully restored display explosion at 3.428 seconds. Reduced-motion emulation started Showcase paused at time zero and was cleared afterwards. Console errors were absent in the inspected page.

The white/serif layout and thin callouts were inspected in desktop screenshots. At an effective **300×649** narrow viewport, the mode selector and chapter number stayed inside the stage header and the document had no horizontal overflow; temporary viewport overrides were reset. Screenshots and actual browser observations are in ignored `output/quadruped-short/`; the global offline audio report is `output/audio-verification.json`. These are local browser checks, not physical-device certification. All changes stayed inside the project, with only the explicitly authorized external speech configuration read for synthesis; nothing was remotely published.

## English quadruped tour · 2026-10-15

The small quadruped now joins the same showcase shell through `?story=quadruped`, with six English chapters: overview, hip/knee geometry, foot trajectory, diagonal gait, planned stance and explosion/restoration. It reuses the original 20-part, 291-mesh GLB, Blender source and FK/IK model; the original Chinese lesson and audio were preserved. The body is fixed, with eight pitch joints and no balance, contact-force, terrain or hardware simulation.

The adapter has no independent animation loop. Thin joint-chain guides, a single-foot path, four diagonal-gait paths and planned-contact rings follow the same model/time inputs. Stance annotations select a foot currently in the model's planned-contact group. A quadruped-specific planner bounds continuous Z-axis joint ranges and real geometry without modifying live poses; it converts the contract's already-metre-valued body-axis explosion vectors once. All chapter cameras are fixed plans, with transitions delegated to the existing 2.4-second director.

`npm test`: **186 passed, 0 failed**. Nine new adapter checks cover real link endpoints, anchors, source-pose preservation, continuous motion bounds, off-grid vertices, portrait/ultrawide framing, planned-contact captions and display-only explosion. Story/audio/clock checks and real HTTP tests include all three tours; provider scripts and configuration remain private. The skill validator and local release-list audit pass. No remote publication or permission expansion was performed.

Six new Doubao Jane clips (`seed-tts-2.0`, `en_female_jane_uranus_bigtts`) were generated in one authorized batch: **91.944 seconds**, 24 kHz MP3. All **39** included Chinese/English clips pass lesson/manifest identity, byte-count, SHA-256, FFprobe and complete FFmpeg decoding: **744.552 seconds** total. Credentials were read only from the user-designated external configuration and were not copied into project outputs or exposed in the browser.

Browser verification loaded the direct story and the story selector, checked all six chapters and actual figures, and sampled six opening times with identical camera position/target/scale. A 3.1-second live transition yielded 188 local frame observations and settled at the planned hip/knee view. A real click started the new English audio; the native audio clock continued while muted, completed all six clips and entered the next loop. Manual orbit kept mechanical state and time unchanged, paused the audio, and resumed through a camera transition. Reduced-motion emulation started paused at time zero; emulation was cleared afterwards.

The inspected desktop chapter figures have readable serif text and fine labels outside key joints and paths. DOM checks at effective 966×925 and 390×844 viewports found no horizontal overflow; narrow screens stack the stage and narration, with natural vertical scrolling. Short desktop windows can scroll rather than letting the note collide with transport. These are local browser/layout checks, not physical-device or frame-rate guarantees. Evidence is in ignored `output/quadruped-showcase/verification.json` and its desktop screenshots; the offline audio audit is `output/audio-verification.json`.

## Presentation polish · 2026-10-15

The opening camera previously changed its target and scale with live moving-mesh bounds, and its first 0.9 seconds blended from a fabricated final-chapter view. Both mechanisms now plan geometry envelopes once; the opening and exploded-view compositions hold steady. A camera director captures the last actual view for a 2.4-second eased chapter transition, snaps explicit scrubs, and resumes from an actual free-orbit pose.

`npm test`: **174 passed, 0 failed**, including continuous motion/explosion envelope coverage on real GLBs and camera interpolation/cancellation checks. Ten browser samples from 0 to 1.35 seconds have identical opening camera position, target and scale. A live 3.2-second chapter transition produced 193 observed frames, held a continuous initial view and ended at the intended close-up. This is a local observation, not a performance guarantee for all devices.

The UI uses local serif headings, narration and sentence-case figure labels, with restrained sans controls. Rounded cards and arrowheads are removed. Fine leaders track real anchors while text stays in the paper margins; wide-view label placement checks the planned envelope to avoid obscuring the mechanism. Labels fade in as the camera settles. Both mechanisms' twelve chapter panels fit 1280×720; the 966×925 and 390×844 emulated layouts have no horizontal overflow. Reduced-motion support, English Doubao audio and all source model/audio assets remain in place.

Screenshots and raw before/after camera samples are in ignored `output/tour-polish/`. Browser checks cover chapter selection, scrubbing, a real narration gesture, mute while the voice clock continues and loop playback. This is a scoped visual/motion review, not full accessibility certification. No remote publication, permission expansion, credential access or new audio generation was required.

## v0.4 · English looping presentations · 2026-10-14

`npm test`: **159 passed, 0 failed**. This includes real-GLB story adapters, current bounds/anchor camera projections across five viewport aspects, deterministic chapter timing, English speech identity/preloading and the preview's actual public narration routes. The six application entrypoints also pass syntax checks. The official skill validator passes. The local release candidate check passes for 311 files; publication has not been performed.

Two English Doubao stories are included: inline-four **86.712 seconds**, turbofan **93.696 seconds**, six clips each. Jane uses `seed-tts-2.0`. All **33** included Chinese/English MP3s pass manifest, byte-count, SHA-256, FFprobe measurement and full FFmpeg decoding: **652.608 seconds** total. Existing Chinese lessons/audio remain intact and explicitly optional. No credentials are served to the browser or copied into release assets.

Browser checks exercised silent initial playback, real-click English voice activation, native audio-time chapter changes, rapid start/pause, stable paused poses and audio, chapter/slider seeks, muting while the audio clock continues, manual orbit without mechanical advancement, and each narrated story's final-clip-to-first-clip loop. Engine has 46 stable parts; turbofan has 34 and retains independent prescribed spool angles, continuous annular combustion and no tail flame. One preload timing bug and an intentional-pause cancellation race found during review were corrected before delivery.

The clean presentation fits a 1280×720 desktop viewport, including the transport. A 390×844 emulated mobile viewport has no horizontal document overflow; actual screenshots were inspected. Reduced-motion emulation starts the tour paused at time zero. Temporary emulation settings were cleared. English UI smoke checks loaded the lock, both engines, quadruped and STEP with rendered canvases; the lock's matching-key state reports five aligned pairs. These checks are not physical-device performance or audio-device certification.

Local screenshots and browser observations are saved under ignored `output/showcase/`; audio validation is in `output/audio-verification.json`. All changes are within the new Mechanism Studio project. Original source geometry, mechanical contracts, Chinese lessons and speech assets were preserved. The legacy recording labels, reference documents and engineering/source notices retain their stated language and provenance.

## Archived v0.3 verification

> 2026-10-20：本节记录的 KFL08 STEP 示例与 occt-import-js 依赖已移除，仍保存在 Git 历史中（最后见于提交 `10f724f`）。

日期：2026-10-14，版本 0.3.0。本记录覆盖模块提取、过程动画、教学机构、配音和 STEP 显示派生；不代表工程 CAD 精度认证。

## 自动检查与干净安装

根目录当前 `npm test`：141 项通过，0 失败。在 v0.2 的 119 项基础上增加 22 项过程/显示/服务检查；覆盖公共模块、锁芯/四缸/涡扇/四足专项模型与 GLB、旧配音兼容、完整发布/播放器、预览范围和真实 OCCT 导入。

v0.2 的 Git 候选文件复制到项目忽略的 `.test-output/standalone-v2`，没有复制 node_modules、.tools、.codex 或父目录代码。根 `npm ci` 安装两个锁定依赖成功；当时干净目录 119 项再次通过。v0.3 未重新运行干净安装，依赖版本不变；新增过程模块和路由已在当前根实际加载及回归。预览服务测试使用本机随机端口，实取四个实例、公共模块和 STEP 资源，拒绝工具、配置与范围外路径。

根依赖为 Three.js 0.186.1、occt-import-js 0.0.23。旧锁芯依赖目录不再承担页面运行，所有 importmap 与实际公共代码使用根依赖。

## 公共模块与浏览器

v0.3 新增 `shared/animation` 与两个发动机的纯过程/显示模块。四缸实际核对 5° 火花可见、14° 火花结束而燃烧前沿延续、90° 四阶段及四缸喷射、播放时 angle 与 process.angle 相同、暂停冻结、展开隐藏/复装、过程开关不改读数。首次火花/喷雾被金属遮挡，读图后修到开放腔内/外部进气汇合位置；保持 depthTest，几何边界纳入专项检查。两个示例在模型上方增加同状态的播放/暂停入口；四缸总览在窗口变窄时重新取景，390px 的完整模型、图例与过程控件已实际查看，无横向页面溢出。

涡扇实际核对转子/路径相位推进、暂停不变、90°/137° 手动定位、核心/旁通分组、持续环形燃烧、无外部火焰、展开/关闭剖面隐藏和复装恢复。390px 初始布局无横向溢出，实际查看模型/燃烧区。新过程组没有改变 46/34 个机械零件身份。截图与观察记录在本地 output/process-animation。已有豆包课程和音频未修改或重新合成。

锁芯和直列四缸已实际迁入公共查看器/播放器。回归验证机位、点选、观察展开、门控、复装、步骤与真实配音，机械读数在换视角/展开时保持；迁移记录在本地 `output/shared-refactor`。

涡扇 34 个稳定零件，12 个转动件分属低压/高压轴。实际页面验证独立 90°/137° 输入、源节点弧度、静子不动、侧视展开、输入门控、复装全部 display 归零、课程核心近景、点选和豆包播放，第三段时长 22.368 秒。默认白底黑线与 390px 首屏已查看。

四足 20 个稳定零件、291 个网格细节。实际页面验证单腿/步态、机位、点选、展开/复装不改 derived、播放暂停与第三步真实豆包音频。专项 15 项覆盖 FK/IK、连杆长度、步态边界、关节限位与资产。记录在本例忽略的 output。

STEP 页面验证真实 GLB 的 35 个显示身份，点选出现来源 PRODUCT/occurrence，展开与多视角，复装恢复原节点/display 状态并同步机位按钮。来源元数据和报告在例内保留。各上述实测页控制台未记录未捕获错误；静态测试和截图不代表全路径碰撞、真实手机性能或所有设备验证。

## 配音

`npm run verify:audio` 使用公共课程/清单校验、字节数、SHA-256、FFprobe 时长和 FFmpeg 全解码。四个实例共 21 段、3,778,545 字节、472.200 秒，全部通过。旧十段保留，新十一段经用户指定豆包服务生成。浏览器只读本地 MP3，未获得凭据。检查本身不请求供应商。

## 真实 STEP

KFL08 源 SHA-256 为 `938d5e7e596d5e9586e7b2d7cef89da3003d3cf734dbfa5ab39f6e790319c090`。源有 30 PRODUCT、29 使用关系，其中 7 子装配与 22 叶实例。显示派生有 35 片段；19 个具名关联源定义/使用关系，16 个匿名仅保留分组。源与显示统计区分，缺项明示。

真实 OCCT 毫米/米校准、两档网格化、GLB 几何与源摘要检查通过。正式 22,942 三角形；粗版 8,820，Z 边界内缩约 0.04611 mm。导入器烘焙 placement，未暴露完整工程局部变换；精确实体测量、配合、工程剖切、接触及参数回写未实现。详情见 STEP 说明（`examples/step-assembly/README.md`）。

## skill 与仓库边界

当前 skill 及六份 references 已同步，26 个本地引用有效；官方 quick_validate 实跑通过。仅在项目忽略的 .test-output 安装 PyYAML 验证依赖，没有全局安装。独立前向试用正确区分 STEP 显示、缺失源身份、尚未实现的精确量孔与滚动模型，没有把计划写成能力。

本地 Git main 项目已存在，发布候选检查通过；没有远程发布，作者自身许可证尚未选择。三方通知已补 OCCT 和 KFL08。业务修改、依赖与可控输出均在新版根内，未改兄弟原版/父目录或全局配置。MCP 保持既有四工具锁芯能力，未接入本次聊天或扩权。

此前 10 月 11 日的 51 项结果属于初次目录拆分历史，119 项属于 v0.2；本记录按当前 141 项和分轮实测范围更新。当前路线见 [CAD 计划](cad-roadmap.md)。
