# Skill modules and runtime catalog

The repository exposes **one project-local skill**, **three specialist authoring contracts** and **seven reusable `shared/` libraries**. The Showcase application and CAD/video/Blender tools are additional integration layers. The labels describe actual organization, not independently installed autonomous child skills.

Start with [the skill guide](skill-guide.md) for installation/use and [SKILL.md](../.agents/skills/mechanism-studio/SKILL.md) for task routing. Read only the detailed references relevant to a task.

## Specialist authoring contracts

These contracts define responsibilities and handoffs; an example adapter must implement them. A JSON plan file is not an executable module.

| Contract | Preconditions and inputs | Output | Boundaries and handoff |
| --- | --- | --- | --- |
| [Assembly & Explode](../.agents/skills/mechanism-studio/references/modules/assembly-explode.md) | Goal, actual IDs/parents/rest/units, geometryRevision, pose ownership, fixed parts, optional caller timeline | Bound groups/offsets in declared parent space, stage/hold/reassembly plan, envelope, restoration checks | Observation only; no changed source placement, mates, threads or collision-free removal proof. Camera consumes the full/intermediate envelope |
| [Camera Direction](../.agents/skills/mechanism-studio/references/modules/camera-direction.md) | Real geometry, mechanical/process ranges, finalized explosion revision, viewport/text reserves, chapter clock | Purposeful poses, conservative envelopes, transition/control behavior, near-label space and viewport checks | No motion/explosion changes to rescue a shot; no live auto-fit. Missing bounds leave a candidate plan |
| [Materials & Lighting](../.agents/skills/mechanism-studio/references/modules/materials-lighting.md) | Stable bindings/revision, renderer, style, process/selection rules, licensed local resources | Role-to-occurrence appearance plan, fill/edges/lights/textures, restoration and fallback evidence | No material certification or geometry identity changes. Geometry-changing appearance invalidates dependent plans |

All three return `stage`, input revisions, actual checks, assumptions and limits. `concept` means design only; `bound` means real asset integration; `validated` means claimed checks were run. They share [orchestration records](../.agents/skills/mechanism-studio/references/module-orchestration.md): brief, scene-index, timeline and per-module plans.

## Shared libraries: implemented code

### 1. Viewer — source geometry and observation

**Location:** [shared/viewer](../shared/viewer/README.md).

Inputs are an actual GLB/contract, optional camera presets and example callbacks. `createMechanismViewer()` loads semantic parts and exposes `parts`, `meshes`, `applyPoses`, `setExplode`, camera/picking/cutaway APIs, redraw and disposal.

Bindings preserve source parent → display → model → source node. Mechanical adapter poses and observation offsets have separate ownership. Existing absolute-node-pose assets explicitly opt into `target: 'node'`; never apply their rest twice. Nested parts own their meshes once. Free fit uses visible solids; automatic tours do not fit each frame.

Unknown IDs, inconsistent contracts or nonfinite poses/vectors fail rather than guess. Default line art expects individual static meshes and an orthographic camera; it is not a general skinned/instanced renderer. Example mechanics, lessons and terms remain outside the viewer.

Focused checks: `node --test shared/viewer/tests/scene.test.mjs shared/viewer/tests/assets.test.mjs`.

### 2. Assets — binary and semantic validation

**Location:** [shared/assets](../shared/assets/README.md).

Inputs are real GLB bytes, declared contract and an example's coordinate/ownership expectations. GLB parsing, accessors, contract validation and writing helpers check structure, IDs, real hierarchy, rest transforms, finite axes and motion ownership. Outputs are parsed/validated evidence or explicit errors, not recovered engineering information.

Model invariants such as linkage lengths, IK reachability or ignition timing remain example tests. A parseable GLB does not establish source accuracy, closed solids, collision freedom or physical correctness. Do not copy historical lock compatibility exceptions into new assets.

Focused checks: `node --test shared/assets/assets.test.mjs`.

### 3. CAD — identity, observation and retained-evidence audit

**Location:** [shared/cad](../shared/cad/README.md).

Inputs distinguish reusable definitions from placed occurrences, preserve actual parents and finite affine local/world transforms, and declare units. `createAssemblyIndex()` returns an immutable graph; `createAssemblyInspection()` returns source-preserving select/hide/isolate/explode/reset snapshots. Tree/model UI applies the same selected occurrence to actual display owners.

Mixed assemblies may own solids and children; retain that source classification. Repeated screws share a definition/mesh but remain separate occurrences. IDs are not names or mesh indices.

`inspectCadEvidence()` compares retained source/provenance, manifest, contract, GLB, importer report and optional AP214/AP242 product/usage evidence. It returns capabilities, findings and `verified / limited / failed`; these are evidence statuses, not engineering certification. No importer, mate solver, exact measurement, physics or publication-rights grant is supplied by this library.

Focused checks: `node --test shared/cad/assembly.test.mjs shared/cad/audit.test.mjs`.

### 4. Animation — explanatory process effects

**Location:** [shared/animation](../shared/animation/README.md).

Inputs are deterministic process signals sampled from a mechanism phase or shared process clock, regions/anchors, units and a legend. Shared effects render paths/arrows and event pulses; example-specific effects may add chamber volumes or annular combustion regions. They do not own clocks and do not enter mechanical `part_id`/pick/count lists.

Output illustrates flow, fuel, spark or heat; it does not solve CFD, pressure, temperature or combustion. Four-stroke ignition and continuous turbofan combustion require different process models. Effects obey actual visibility/cutaway rules and remain replayable through pause/seek/reverse scrubbing.

Focused checks: `node --test shared/animation/animation.test.mjs`; also run the changed example's process tests.

### 5. Voice — optional Doubao lessons

**Location:** [shared/voice](../shared/voice/README.md).

Inputs are a valid ordered `zh-CN` or `en-US` lesson, matching provider/manifest and, only for explicit synthesis, a user-designated local credential file. The `narration-v1` digest covers schemaVersion/language/steps{id,title,narration}; mechanical/camera metadata does not force new speech.

Protocol/config/generator/CLI produce verified immutable MP3s and publish the complete manifest last. A failed segment or local publish retains the prior valid lesson. The browser player verifies hashes/size and provides text/status, verified Blob URLs, native playback/pause/seek and cleanup. It never receives credentials or calls the speech API.

Dry-run existing wrapper:
`node examples/inline-four/voice/synthesize-doubao.mjs`.
Generation is opt-in with `--generate --config <authorized-local-file>` and an English-compatible speaker for English. Configuration paths and credentials are private; do not put them into examples or commits. Browser sound requires a user gesture; missing/corrupt/stale speech preserves text and an honest unavailable state.

Focused checks: `node --test shared/voice/voice.test.mjs shared/voice/english.test.mjs`. See [narration](../.agents/skills/mechanism-studio/references/narration.md) for protocol, cancellation and version rules.

### 6. Appearance — reversible timeline accents

**Location:** [shared/appearance](../shared/appearance/README.md).

`sampleColorAccents(partIds, cues, options)` takes real IDs and absolute cue weights, returning a complete neutral/accent map. Unknown cue IDs are ignored; weights clamp; repeated cues combine by maximum. Default fill is `#f1f1ed`, accent `#b7d5df`. Turning cues off immediately restores neutral.

`createMeshColorLayer()` clones owned solid materials once, reads stable selectionId, preserves selected/replaced materials and restores/disposes its copies. It does not mutate source geometry, lines, transforms or visibility. Custom selection systems supply canApply or compose selection afterward.

Recompute from the same timeline on pause/seek/restart; never accumulate tint. Accent is an explanation aid, not physical material or simulation data.

Focused checks: `node --test shared/appearance/tests/color-accents.test.mjs`.

### 7. Study — music-driven assembly presentation

**Location:** [shared/study](../shared/study/README.md).

`createStudyShell()` builds the common DOM; `createAssemblyStudy(config)` combines viewer, music transport, stable camera director, near labels and reversible color cues. Inputs are a real scene index/GLB/contract/provenance, score/audio hashes and an example adapter for timeline, annotations, framing and display offsets.

Optional hooks add source-backed workingPoses, visibility detailIds, authored appearanceCues, cameraUp, transition duration and deliberate cameraCuts. The adapter owns mechanics/joint limits and motion/explosion gates; the shell infers none. `.ready` and snapshot().ready/musicReady distinguish model success from music availability.

API: `play()`, `pause()`, `seek(seconds)`, `snapshot()` and viewer/index/framing access. Native audio currentTime is the live music clock; explicit capture mode freezes it and accepts monotonically increasing frame times. Retained labels require stationary named targets. The actual score BPM/duration/byte length/hash must agree.

Focused checks: `node --test shared/study/tests/runtime-delivery.test.mjs`, plus the actual adapter's tests and browser loop.

## Application and toolchains

| Component | Inputs → outputs | Commands and limits |
| --- | --- | --- |
| [Showcase](../showcase/README.md) | Registered mechanism adapter, valid lesson/manifest, measured chapter durations → English silent/narrated tour with planned camera, captions and process | `npm run preview`, then `/showcase/?story=quadruped&mode=showcase&clean=1`. Existing app's narration path is separate from study music; not every old annotation has the new near-label implementation |
| [CAD import](../tools/cad/README.md) and [XCAF backend](../tools/cad/README-xcaf.md) | Digest-pinned self-contained source and terms → actual two-setting XCAF graphs, GLB, contract, manifest/report; read-only audit report | Project-local `./tools/cad/setup-xcaf.ps1`; `npm run import:cad -- --example examples/my-assembly`; `npm run audit:cad -- --example examples/my-assembly`. One root, uniform explicit m/mm, exact source usage mapping; unsupported external refs/units/missing identities fail |
| [Video export](../tools/video/README.md) | Sequential captured JPEGs, verified timeline-matched track, declared fps/count/size → H.264/AAC MP4, contact sheet and objective report | `node tools/video/export.mjs --help`. FFmpeg/FFprobe required; output project-local under output, audio mismatch ≤1 frame, at most 1920×1080 total pixels, clip ≤140 seconds. No browser capture/upload/publication |
| [Blender lock MCP](../tools/blender-mcp/README.md) | Project-scoped lock operation → lock assets/status through its four-operation allowlist | Optional and not auto-connected; see its setup/CLI. It is not a general Blender or CAD API, and is not required to view existing demos |

The [runtime map](../.agents/skills/mechanism-studio/references/runtime-modules.md) links actual examples. Library READMEs and source are authoritative for exact API parameters; this catalog explains ownership and integration.

## Cross-cutting contracts

| Guidance | When to read |
| --- | --- |
| [Input brief](../.agents/skills/mechanism-studio/references/input-brief.md) | Text/image/CAD evidence, unknown internals, authorized source and model basis |
| [Scene contract](../.agents/skills/mechanism-studio/references/scene-contract.md) | Stable IDs, rest, source/working/display layers, units and one mechanical writer |
| [CAD workflow](../.agents/skills/mechanism-studio/references/cad-workflow.md) | Source retention, importer support, staged publication, evidence and linked selection |
| [Visual style](../.agents/skills/mechanism-studio/references/presentation-style.md) | White line art, atlas type, short near-part leaders, honest projection and safety areas |
| [Pacing](../.agents/skills/mechanism-studio/references/presentation-pacing.md) | 30–40s default, action/hold separation, sequential names, same-scene retention/group fade |
| [Tour transport](../.agents/skills/mechanism-studio/references/presentation-tour.md) | One clock, pause/seek/loop/exploration/reduced-motion and fallback |
| [Audio delivery](../.agents/skills/mechanism-studio/references/audio-delivery.md) | Silence/music/Doubao selection, synchronized editorial effects and actual media review |
| [Process animation](../.agents/skills/mechanism-studio/references/process-animation.md) | Phase-driven qualitative flow/spark/combustion, regions and unsupported physics |
| [Teaching and validation](../.agents/skills/mechanism-studio/references/teaching-and-validation.md) | Observable question, model invariants, evidence layers and browser checks |

## Failure and scope policy

Keep previous working source/assets/manifests on failed import or synthesis. Do not mask ambiguous IDs with name/proximity guesses, rewrite source units, drop inconvenient source geometry, infer constraints from parents, or fabricate completed tests.

A missing model can yield a useful concept handoff; a static sourced assembly can fully satisfy Inspect. A visual explosion is not engineering disassembly. A kinematic gesture is not a hardware-safe trajectory. A passing audit is not a license grant.

All new controlled files remain in the repository; no global skill/configuration or account-permission changes. Runtime path guards do not constitute an OS sandbox. Project-owned code/docs are [MIT](../LICENSE); retain [third-party terms](../THIRD_PARTY_NOTICES.md), source attribution and derivative notices.
