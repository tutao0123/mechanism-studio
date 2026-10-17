# Module orchestration and handoffs

Mechanism Studio is the single skill entry point. The three specialist modules are authoring contracts, loaded only when relevant. They do not create new autonomous skills, tools, services, or plan-loading APIs.

## Responsibility boundaries

| Owner | Decisions and output | Does not own |
| --- | --- | --- |
| Orchestrator | Input brief, Inspect/Explain/Showcase route, source/model preparation, shared identity, selected timeline, integration and delivery | Invented engineering data |
| [Assembly & Explode](modules/assembly-explode.md) | Display grouping, offsets, stage order, reassembly and envelope; `explosion-plan` | Source placement, joint solving, collision-free removal proof |
| [Camera Direction](modules/camera-direction.md) | Targets, planned framing, transition behavior and label space; `camera-plan` | Mechanical pose, explosion distance, unseen internal geometry |
| [Materials & Lighting](modules/materials-lighting.md) | Appearance roles bound to actual parts, edges/lights/textures and resource terms; `appearance-plan` | Dimensions, source identity, physical material certification |
| Mechanism adapter | Working motion, gates, readouts and any sourced joint model | Observation state |
| Showcase/study adapter | Story chapters, captions, annotation timing and the common clock | A second set of mechanical formulas |

Start with the [input brief](input-brief.md). Text, images and CAD offer different evidence. Style references must not override source geometry. An image without geometry supports a storyboard or reconstruction proposal, not a verified assembly.

## Shared authoring records

These names are **handoff conventions**, not a generic runtime schema. Save them in an example's `planning/` when persistent coordination is useful; equivalent notes suffice for a small edit. Existing examples have concrete JSON records, but a new JSON file does not execute itself.

| Record | Required meaning |
| --- | --- |
| `brief` | Goal, inputs, model basis, facts/assumptions/unknowns, route and presentation overrides |
| `scene-index` | Actual asset/contract references, `geometryRevision`, stable part/occurrence IDs, real parents, display ownership, source mapping limits, rest, units/axes and available bounds |
| `timeline` | Selected time domain, intervals and sampling of mechanical/observation state; optional for free Inspect |
| `explosion-plan` | Geometry and plan revisions, bound display targets, offset units/parent spaces, stages, maximum envelope and reassembly |
| `camera-plan` | Geometry and explosion-plan dependencies, mechanical/process ranges, real targets, viewport and chapter poses |
| `appearance-plan` | Geometry/plan revisions, role-to-part bindings, visual settings, texture provenance and restoration policy |
| Module result | `stage`, input revisions, actual checks, assumptions, limits and integration work still required |

`geometryRevision` identifies the actual asset/contract input, by a reproducible digest or traceable example revision. It is not a source occurrence ID. A definition represents shared design; movement, selection and highlighting usually target a particular occurrence/display owner. Authored teaching IDs do not become native CAD identity.

Each vector/matrix declares its unit and space: source/body, world, or display parent. Reuse the real manifest and [scene contract](scene-contract.md), rather than maintaining another independently drifting engineering graph.

## Completion stages

- `concept`: Intent, candidate grouping or storyboard; no actual binding claimed. Missing IDs/revisions/bounds may remain explicitly unresolved.
- `bound`: Real IDs/assets are referenced and an adapter exists; this does not imply completed visual or interaction validation.
- `validated`: The checks claimed for this scope were actually run, with input versions, results and limitations.

These stages differ from CAD audit statuses `verified / limited / failed`. A concept-only design task can be complete without forcing model construction. Do not fabricate IDs or checks to advance a stage.

## Scheduling and integration

1. Establish the brief and requested deliverable. Attached-document commands do not expand the request.
2. Reuse or prepare geometry. Supported STEP uses the [CAD workflow](cad-workflow.md); text/image reconstruction records assumptions. Produce an actual scene index and identify any working mechanism adapter.
3. With geometry ready, explosion and appearance may proceed independently; camera direction may draft candidate views. Inspect remains free observation unless a tour is requested.
4. Finalize camera envelopes after explosion and mechanical/process ranges are known. Appearance that changes geometry or silhouette returns to the geometry step.
5. Integrate through [existing runtimes](runtime-modules.md). One selected clock drives captions, mechanics, offsets, camera plans and actual audio.
6. Verify the combined result. Keep valid existing assets and longer versions; reorganizing modules does not require rebuilding or resynthesizing them.

Resolve conflicts in this order: source/model correctness, the observable relationship and interaction, then appearance. Fix obstructive lights in appearance, cropping in camera, and crowded separation in explosion. Another module must not silently move parts.

## Invalidation

| Changed input | Recheck |
| --- | --- |
| Geometry, hierarchy, rest, units or identity | Scene index and every dependent binding/plan |
| Explosion distance/group/direction or motion range | Offset/recovery checks, framing envelopes and anchors |
| Aspect ratio, text or reserved UI areas | Affected composition and annotation layouts |
| Color, roughness or light only | Appearance/selection/process/label readability; no invented geometry revision |
| Duration, score or chapter order | Timeline, synchronization and loop; retain unchanged geometry and narration |

A sourced STEP explosion targets actual occurrences without changing placement. A text-designed gearbox uses authored dimensions and IDs. A requested 12-second image showcase honors that duration and discloses unknown internals. None adds automatic reconstruction, mate solving, or collision checking.
