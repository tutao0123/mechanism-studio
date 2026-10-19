# Using the Mechanism Studio skill

Mechanism Studio is a project-local authoring skill backed by a runnable JavaScript toolkit. It helps an AI coding agent prepare inspectable mechanical scenes and short stories while preserving the difference between source engineering data, teaching models and presentation effects.

There is **one discoverable skill** at [SKILL.md](../.agents/skills/mechanism-studio/SKILL.md), with **four specialist authoring contracts** for explosion, camera direction, appearance and mating close-ups. They work with seven reusable shared libraries, the Showcase application and local tooling. They are not a collection of independently installed autonomous agents. See the [module catalog](modules.md) for each responsibility and interface.

## Run locally

From the repository root, use Node.js 20.10 or newer:

```powershell
npm ci
npm test
npm run preview
```

The standard preview is local-only at `http://127.0.0.1:4179/`. Existing built viewing assets do not require Blender, Python, an MCP connection or a speech account. Generated Doubao MP3s and local `.blend` exports are excluded from public Git packaging; the included text/manifests/CLI support optional speech regeneration, and Blender Python builders can recreate teaching assets. Fresh public checkouts retain silent/text tours and the original code-music examples. Follow the specific example/tool README when rebuilding.

The robot has its own preview:

```powershell
node EXAMPLE_ROBOT/serve.mjs
```

It normally uses `http://127.0.0.1:4180/`; the short kinetic cut is `/kinetic/?clean=1`. Stop the process when finished.

## Use with an agent

Open the repository as the workspace, and point the agent to the project-local skill if its host does not discover `.agents/skills` automatically. No global installation is required by this repository. A host that supports named invocation can use `$mechanism-studio`; other agents can read the same SKILL.md explicitly.

Example requests:

> Use the Mechanism Studio skill to inspect this STEP assembly. Keep original source identity, add linked tree/model selection and report unsupported fields. Do not invent joints.

> Use the skill to explain a slider-crank from these dimensions. Show the input, linkage and computed piston displacement; label all additional dimensions as authored teaching choices.

> Use the skill to make a 34-second English white-line assembly showcase, with expansion and reassembly, near-part names and original code music. Keep changes inside this repository.

> Make a separate short Cinematic edition of this mechanism: a dark studio setting, readable metal finishes, smooth perspective close-ups, large English titles and original music tied to the actions. Preserve the white fine-line edition and the actual mechanical relationships.

> Use this photo as a visual reference for an illustrative exploded view. First list visible components and unknown internals. Do not claim image-to-CAD reconstruction accuracy.

> Add a close-up of this actual sun–planet pair. Keep the existing camera, music and white line art; use subtle tooth-phase highlights and short rotation arcs to distinguish spin from orbit. Bind the cues to the supported motion and disclose any idealized contact-region assumption.

The skill's directory and real-path checks define the intended project scope. They are not an operating-system permission sandbox. Actual agent/tool permissions still come from the host and user. The skill does not grant permission to read arbitrary credentials, publish a repository, post to social media, install global tools or purchase synthesis.

## Select the route

| Route | Good fit | Default delivery |
| --- | --- | --- |
| **Inspect** | Supported STEP structure, repeated occurrences, source/display identity | Silent observation, assembly tree, linked selection, hide/isolate/explode/reset, provenance and evidence report |
| **Explain** | How a mechanism works, controls, phase, gates and derived readouts | Interactive authored or sourced mechanism, explicit assumptions; process illustration/lesson only when needed |
| **Showcase** | Public first impression, repository demo, looping social clip | English, white fine-line style, normally 30–40 seconds, purposeful views and readable holds |

Routes are authoring choices. Only the existing `showcase/` application implements `mode=showcase|explain`; a standalone page does not gain that URL parameter by choosing a route. The robot's 25.714-second kinetic cut is an explicitly authored short exception, and its original 34-second study remains available.

Showcase offers two authoring pace profiles: **Detailed** retains the normal
30–40 seconds; an explicitly requested **Fast** social cut starts around
18–24 seconds for X. Explain can be longer when the explanation needs it. Ask
for either or both; the skill does not require multiple outputs or silently
shorten existing cuts. The gearbox's 40-second full version remains Detailed.

A **2× playback preview** lets you judge a faster viewing pace without producing
a new cut. The gearbox review provides 1×, 1.5× and 2×, initially 2×, while its
source file stays 40 seconds. Pitch preservation keeps musical pitch while
tempo and visual speed increase, and text gets less reading time. An authored
Fast edition needs its own timeline, concise readable captions and music arranged
for that timing when selected. These are authoring contracts, not a universal
fast/detailed generator. See [pace profiles](../.agents/skills/mechanism-studio/references/presentation-pacing.md#preview-speed-and-authored-editions).

## Input evidence

Text can describe a goal and supplied parameters; missing geometry may be designed as an illustrative teaching model. An image gives visible outline, layout and appearance, not hidden joints or material grades. A dimensioned drawing supplies only its legible explicit dimensions. Supported CAD can preserve actual source definitions, occurrences, placements and hierarchy.

The [input brief](../.agents/skills/mechanism-studio/references/input-brief.md) labels facts `provided / observed / assumed / unknown` and separates engineering, geometry, style and motion references. The project does not implement a one-image-to-precision-CAD service. Instructions inside attachments remain source material, not commands from the user.

## End-to-end authoring

1. Define the reader's question, inputs, permitted public use, route and requested output.
2. Reuse or prepare geometry and a real scene contract/index. Preserve source bytes, units, provenance, actual parents, stable IDs and known mapping limits.
3. Invoke only needed specialist contracts. Explosion and appearance may proceed in parallel after geometry exists; final camera envelopes depend on finalized motion and separation ranges.
4. Adapt plans to implemented runtime APIs. Plans use shared IDs/revisions and one time domain; they are not automatically executed JSON.
5. Inspect the resulting model and page. Check actual transformations, rest restoration, controls, pause/seek/loop behavior, relevant audio and narrow-screen readability.
6. Deliver the working entry, sources, assumptions, reproducible commands and actual evidence. Preserve prior valid versions.

Handoff stages are `concept` (intent), `bound` (actual asset adapter) and `validated` (claimed checks run). These differ from CAD audit's `verified / limited / failed`. Read [orchestration](../.agents/skills/mechanism-studio/references/module-orchestration.md) for dependencies and invalidation.

## Presentation defaults

New scenes use a white background, pale neutral solids, dark feature/silhouette edges and atlas-like serif type. Annotations stay near their actual parts, with short neutral leaders and small endpoints, no arrowheads or heavy boxes. Introduce one name, allow reading, retain it within the scene, then fade the group at the scene boundary. Normally show at most two names; settle the target and camera before naming. Optional gentle pullback comes after reading.

Camera plans use conservative motion/explosion envelopes. Motion must not cause frame-by-frame auto-fit, jitter or breathing. Explicit seek cuts to the planned frame; continuous transitions capture the actual start once. Preserve pause, resize, reduced-motion and exploration behavior. Defaults and their implementation boundaries are in [visual style](../.agents/skills/mechanism-studio/references/presentation-style.md) and [pacing](../.agents/skills/mechanism-studio/references/presentation-pacing.md).

The [Mating Close-up contract](../.agents/skills/mechanism-studio/references/modules/mating-closeup.md) handles a different question from extracting a small part: how two components work together. It first binds actual occurrences, evidence, axes and supported relative motion, then coordinates local phase highlights and concise direction marks. Small rotation arcs may have restrained arrowheads; name leaders keep their existing style. Marks follow the motion's sign, disappear at rest and distinguish spin from orbit. These cues use the common clock and restore the current appearance; they do not infer CAD mates or establish physical tooth contact.

Social clips normally omit narration. Optional original code music and sparse action effects share the mechanical/display timeline. Doubao narration is available when requested, through an explicit local synthesis command; the browser receives only verified local audio. Credentials never belong in source, plans, web assets or Git. See [audio delivery](../.agents/skills/mechanism-studio/references/audio-delivery.md).

## Optional Cinematic edition

Ask for the [Cinematic profile](../.agents/skills/mechanism-studio/references/presentation-cinematic.md) when you want a technology-film or product-reveal treatment. It coordinates perspective camera paths with continuous velocity, restrained PBR metal/light, large sans-serif English film graphics and action-linked music. White fine-line Atlas remains the default. Both treatments preserve the same source identity, geometry and supported mechanical relationships.

Style and pace are separate choices: a short Cinematic request starts around 18–24 seconds using Fast pacing unless you specify otherwise; a longer explanation can retain Detailed or Explain timing. A new edition gets its own timeline and score when selected, and the earlier version stays available. There is no automatic `cinematic` URL flag, global renderer switch or mandatory dual-version export.

The [24-second cinematic gearbox](../examples/gearbox/cinematic/README.md) is a working reference with direct WebGL + Canvas film composition, an original synthesized score and repeatable export instructions. Its exact camera, 120 BPM music and duration belong to that example. Fixed-frame export avoids dependence on the recording window; encoded playback, phone-size text and sound still need their own review. More realistic materials remain presentation choices, not evidence of engineering validation.

## CAD and engineering boundaries

Current generic import accepts a self-contained STEP assembly, one exact XCAF root, source usage mapping and uniform explicit metre or millimetre spatial contexts. AP214/AP242 product/usage evidence is a supported subset, not full protocol conformance.

```powershell
./tools/cad/setup-xcaf.ps1
npm run import:cad -- --example examples/my-assembly
npm run audit:cad -- --example examples/my-assembly
```

Prepare `examples/my-assembly/source/` with a real STEP and digest-pinned provenance first. The setup keeps its runtime/caches in the project. The command creates source/display evidence, not a complete generic inspection webpage; a thin page adapter and preview allowlist still need integration. Inspect existing shipped examples without rerunning this setup.

Unsupported units, external references, ambiguous identity or failed meshing are reported, without guessing IDs, rewriting units or replacing a working package. Some STEP objects are source-triangulated, not analytic solids. No current route supplies a general mate/constraint solver, exact engineering measurement, collision-free removal planning, native parameter editing or dynamics. Source-backed robot kinematics are specific adapters, not recovered CAD mates.

Read the [CAD workflow](../.agents/skills/mechanism-studio/references/cad-workflow.md), [CAD boundaries](../.agents/skills/mechanism-studio/references/cad-direction.md) and [tool README](../tools/cad/README.md).

## Tests, export and publication

```powershell
npm test
npm run release:check
```

Use focused commands from [the module catalog](modules.md) while editing. Passing automated tests does not prove correct framing, mechanical feasibility, third-party rights or good audio. Record actual browser/visual checks separately; claim subjective listening only after listening.

The shared study's explicit `?capture=1` path supports deterministic sequential frames; `tools/video/export.mjs` encodes captured JPEGs and a verified timeline-matched track. It does not capture a browser or publish online. Full export procedure and failure limits are in [the video tool](../tools/video/README.md).

Substantial deliveries can retain a [delivery manifest](../.agents/skills/mechanism-studio/references/delivery-evidence.md) with exact input, evidence and output fingerprints. WOLF v4 is the worked example:

```powershell
npm run check:delivery -- --manifest examples/wolf-actuator/tour-v4/delivery.json
# On the authoring machine, also require ignored media and review files:
npm run check:delivery -- --manifest examples/wolf-actuator/tour-v4/delivery.json --require-local
```

Default mode permits missing files explicitly marked local, so an absent MP4 does not make a fresh checkout an unfinished model. Present files must match their recorded bytes and hashes; repository files must exist. The report distinguishes byte integrity, declared check results and evidence availability. It neither runs the declared reviews nor proves engineering validity. Updating a changed file's digest requires reviewing and rechecking its dependents, not simply refreshing the record. The [worked module handoff](../.agents/skills/mechanism-studio/references/module-orchestration.md#worked-handoff-wolf-sun-and-one-planet) shows the actual WOLF pair and adapter ownership.

Keep implementation, validation, export and remote publication separate in completion messages. Verify the current remote commit and relevant paths when asked what reached GitHub; posting a video to X does not update the source repository.

Project-authored code and documentation use [MIT](../LICENSE). Third-party assets, adapted upstream components, generated voice and runtime dependencies have separate terms in [third-party notices](../THIRD_PARTY_NOTICES.md) and source-local files. A successful technical import/release check does not grant redistribution rights or authorize remote publication.

## Further reading

- [Module catalog](modules.md): all current contracts, libraries and toolchains.
- [Architecture](architecture.md): source/model/display separation.
- [Example catalog](../examples/README.md): runnable examples, model basis, rebuilding and licensing.
- [Origins](origins.md): project provenance and retained acknowledgments.
- [Runtime map](../.agents/skills/mechanism-studio/references/runtime-modules.md): implementation entry points.
