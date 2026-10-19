---
name: mechanism-studio
description: Build and refine mechanical assembly inspection, interactive explanations, and short visual showcases from text, images, or supported CAD sources, with traceable part identity and coordinated explosion, camera, appearance, and sound.
---

# Mechanism Studio

Turn mechanical relationships into inspectable, replayable visual stories. Keep source engineering data, authored teaching assumptions, display presentation, and verification distinct. Rendering detail is not engineering evidence.

## Route the task

Read only the references needed for the user's deliverable. The public [skill guide](../../../docs/skill-guide.md) explains setup and examples; the [module catalog](../../../docs/modules.md) distinguishes authoring contracts from executable libraries.

| Goal | Route and references | Deliverable |
| --- | --- | --- |
| Inspect a supported STEP and repeated parts | **Inspect**: [CAD workflow](references/cad-workflow.md), [capability boundaries](references/cad-direction.md) | Source/provenance, definitions and occurrences, assembly tree, linked selection, evidence report; silent by default |
| Explain a mechanism and its controls | **Explain**: [scene contract](references/scene-contract.md), [teaching and validation](references/teaching-and-validation.md), [process animation](references/process-animation.md) when needed | Explicit model assumptions, mechanical inputs, coherent motion/readouts, optional lesson |
| Make a public looping demo | **Showcase**: [visual style](references/presentation-style.md), [pacing](references/presentation-pacing.md), [motion choreography](references/motion-choreography.md), [tour transport](references/presentation-tour.md), [audio choice](references/audio-delivery.md) | English, white line art, normally 30–40 seconds; preserve existing longer cuts |
| Change an existing example or tool | [Runtime map](references/runtime-modules.md), then that component's README | Reuse working assets and shared code; validate the changed behavior |

These routes are authoring choices, not universal URL parameters. STEP placement alone does not supply joints or an operating cycle. Text and images first go through the [input brief](references/input-brief.md); there is no automatic image-to-CAD service.

Showcase has two [pace profiles](references/presentation-pacing.md#preview-speed-and-authored-editions): **Detailed** keeps the 30–40s default; an explicit **Fast** request starts around 18–24s for X. Explain may be longer as needed. Preserve existing cuts and deliver only the requested profile(s). A 2× playback preview changes viewing speed; an authored fast cut needs its own readable captions, timeline and synchronized selected audio. These are authoring contracts, not an automatic two-version generator.

For a requested cinematic or technology-film treatment, read the optional [Cinematic profile](references/presentation-cinematic.md): coordinated perspective camera, PBR materials/light, large sans-serif film typography and action-linked music. A short Cinematic request starts with Fast pacing unless specified otherwise; style and pace remain independent. White fine-line Atlas remains the default, and the profile requires an actual example adapter rather than a global style switch.

For component-level breakdown or internal parts, read [assembly depth](references/assembly-depth.md) before grouping: plan whole mechanism → sourced subassembly → available physical components, with the requested depth and actual source limits recorded.

## Compose specialist modules

Use [module orchestration](references/module-orchestration.md) to share real IDs, geometry revisions, units, rest transforms, and one timeline.

| Module | Owns |
| --- | --- |
| [Assembly & Explode](references/modules/assembly-explode.md) | Display groups, offsets, expansion/reassembly, bounds and recovery checks |
| [Camera Direction](references/modules/camera-direction.md) | Purposeful views, motion/explosion envelopes, transitions and annotation space |
| [Materials & Lighting](references/modules/materials-lighting.md) | Base appearance, edges, lighting, source-aware textures and selection-safe overrides |
| [Mating Close-up](references/modules/mating-closeup.md) | Source-bound component pairs, local phase cues and spin/orbit explanations; handoffs to camera and appearance |

These are four internal authoring contracts within **one skill**. They are not separately installed autonomous skills, MCP tools, or a generic JSON-plan executor. Adapt their outputs to [existing runtime APIs](references/runtime-modules.md); distinguish `concept`, `bound`, and `validated` work.

For continuous dismantling, reassembly or a close-up of one repeated component, coordinate these contracts through [motion choreography](references/motion-choreography.md). This cross-module layer owns the shared editorial rhythm and context; example adapters implement it.

For a close-up that explains how components interact, select Mating Close-up: bind actual occurrences and supported relative motion before adding tooth/region highlights or direction arcs. Keep phase cues distinct from contact simulation, spin distinct from orbit, and cues on the existing common clock.

## Preserve the important invariants

- Resolve the project root three levels above this skill directory. Keep new code, assets, outputs, controlled caches and temporary files inside that root; check real paths and ancestor links/junctions. Do not modify sibling projects, parent orchestration, global skills, configuration or account permissions. An explicitly supplied external source/runtime/configuration may be read or used at its authorized path. Never copy credentials into the repository. Project-local checks are not an operating-system sandbox.
- Preserve source bytes, provenance and third-party terms. Project-authored code and documentation are MIT; assets and upstream components retain their own [notices](../../../THIRD_PARTY_NOTICES.md) and [origins](../../../docs/origins.md). Local authoring does not authorize publishing, paid synthesis, or deletion; follow the actual user request and existing authorization.
- Stable `part_id`/occurrence IDs connect assets, selection, labels and motion. Names, mesh order and proximity do not establish identity. Maintain actual assembly parents and definition/occurrence distinctions.
- Match teardown depth to actual geometry and evidence. A body, source leaf, mesh or provided joint does not establish the internals of an actuator; retain unknowns and obtain source-backed component geometry before claiming finer disassembly.
- Apply units and full coordinate transforms once. Keep source rest, mechanical poses and observation offsets separate as specified by the [scene contract](references/scene-contract.md). One owner writes each mechanical channel; explosion must not change mechanical results.
- New presentations use the shared white-background fine-line style, atlas serif type, near-part labels, short leaders, sequential reveal, same-scene retention and group fade at scene changes. Read the visual and pacing references before generating frames. User preferences override defaults; do not silently restyle old examples.
- Match motion tempo to the part, travel and explanatory purpose; retain useful context between whole and detail views. A single-part close-up follows a real occurrence through extraction, camera magnification and return, without duplicating it or scaling its geometry. Keep the named part and camera settled during reading.
- Public UI, captions and copy default to English. X clips normally omit narration; optional music uses original code synthesis and sparse authored action effects. Requested narration uses the optional provider-neutral [narration workflow](references/narration.md), with explicit speech-capable model/voice/endpoint selection; retain the existing Doubao adapter without forcing it on new examples. Do not regenerate valid paid audio merely to reorganize files.
- Use one seekable time source for mechanics, explosion, process effects, camera plans, captions and audio. Interactive camera transitions retain a captured starting pose; an authored film path samples its continuous pose from that same absolute time. Never add independent wall-clock motion or sound timers.
- The project-local [Blender MCP](../../../tools/blender-mcp/README.md) has four lock-specific operations. It is optional, is not automatically connected, and is not a general CAD backend. Existing authorized Blender CLI tooling can be used without expanding that MCP.

## Deliver evidence

Choose the relevant layers in [teaching and validation](references/teaching-and-validation.md). Check source/identity, model invariants, actual transformed geometry, controls and recovery, relevant time/audio paths, and real desktop/narrow-screen views. Automated checks, generated files and actual browser usability are separate evidence. State unexecuted checks and remaining limits plainly.

Return a working entry point, relevant source/assets/provenance, reproduction commands and validation results. Use the [runtime map](references/runtime-modules.md) for component commands. Do not represent display explosion as collision-checked disassembly, tessellation as exact measurement, or source-based kinematics as a dynamics solver.

For substantial media delivery, cross-agent handoff or reuse of old checks, use [delivery evidence](references/delivery-evidence.md) to bind inputs, reports and outputs to actual file fingerprints. Distinguish implemented, checked, exported and published results; a successful local export or X post does not establish that source changes reached GitHub.
