# Module orchestration and handoffs

Mechanism Studio is the single skill entry point. The four specialist modules are authoring contracts, loaded only when relevant. They do not create new autonomous skills, tools, services, or plan-loading APIs.

## Responsibility boundaries

| Owner | Decisions and output | Does not own |
| --- | --- | --- |
| Orchestrator | Input brief, Inspect/Explain/Showcase route, source/model preparation, shared identity, selected timeline, cross-module motion choreography, integration and delivery | Invented engineering data |
| [Assembly & Explode](modules/assembly-explode.md) | Display grouping, offsets, stage order, reassembly and envelope; `explosion-plan` | Source placement, joint solving, collision-free removal proof |
| [Camera Direction](modules/camera-direction.md) | Targets, planned framing, transition behavior and label space; `camera-plan` | Mechanical pose, explosion distance, unseen internal geometry |
| [Materials & Lighting](modules/materials-lighting.md) | Appearance roles bound to actual parts, edges/lights/textures and resource terms; `appearance-plan` | Dimensions, source identity, physical material certification |
| [Mating Close-up](modules/mating-closeup.md) | Evidence-backed pair/interface, local region, phase cues and direction semantics; `mating-closeup-plan` | Mechanical pose, mate/contact solving, independent camera or music control |
| Mechanism adapter | Working motion, gates, readouts and any sourced joint model | Observation state |
| Showcase/study adapter | Story chapters, captions, annotation timing and the common clock | A second set of mechanical formulas |

Start with the [input brief](input-brief.md). Text, images and CAD offer different evidence. Style references must not override source geometry. An image without geometry supports a storyboard or reconstruction proposal, not a verified assembly.

[Motion choreography](motion-choreography.md) is the orchestrator's coordination layer across these owners. It aligns component-specific tempo, context fades, real-occurrence close-ups, reading holds and action-linked sound. It is not an additional contract or executable runtime; the existing example adapters own the implementation.

## Shared authoring records

These names are **handoff conventions**, not a generic runtime schema. Save them in an example's `planning/` when persistent coordination is useful; equivalent notes suffice for a small edit. Existing examples have concrete JSON records, but a new JSON file does not execute itself.

| Record | Required meaning |
| --- | --- |
| `brief` | Goal, inputs, model basis, facts/assumptions/unknowns, route and presentation overrides |
| `scene-index` | Actual asset/contract references, `geometryRevision`, stable part/occurrence IDs, real parents, display ownership, source mapping limits, rest, units/axes and available bounds |
| `timeline` | Selected time domain, intervals and sampling of mechanical/observation state; timed studies also declare action, context transition, focus/read/return and actual sound events; optional for free Inspect |
| `explosion-plan` | Geometry and plan revisions, bound display targets, offset units/parent spaces, stages, maximum envelope and reassembly |
| `camera-plan` | Geometry and explosion-plan dependencies, mechanical/process ranges, real targets, viewport and chapter poses |
| `appearance-plan` | Geometry/plan revisions, role-to-part bindings, visual settings, texture provenance and restoration policy |
| `mating-closeup-plan` | Pair/interface occurrence IDs, evidence basis, adapter and axis conventions, local anchor/section, phase/direction cue windows, camera/appearance dependencies and limits |
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
3. With geometry ready, explosion and appearance may proceed independently; camera direction may draft candidate views. For timed work agree on the movement/read rhythm and continuity together. A repeated-part close-up names its actual occurrence, extraction/return interval and retained context before either offset or camera planning. Inspect remains free observation unless a tour is requested.
   For an interaction close-up, establish the actual pair and supported mechanical adapter before assigning cues. Mating Close-up defines their meaning and phase; camera frames the relation and appearance renders it. An ideal pitch-region anchor is not a measured contact point.
4. Finalize camera envelopes after explosion and mechanical/process ranges are known, including context still visible during fades and intermediate single-part extraction. Appearance that changes geometry or silhouette returns to the geometry step.
5. Integrate through [existing runtimes](runtime-modules.md). One selected clock drives captions, mechanics, offsets, camera plans and actual audio.
6. Verify the combined result, including motion/hold diagnostics and a whole-loop visual review. Keep valid existing assets and longer versions; reorganizing modules does not require rebuilding or resynthesizing them.

Resolve conflicts in this order: source/model correctness, the observable relationship and interaction, then appearance. Fix obstructive lights in appearance, cropping in camera, and crowded separation in explosion. Another module must not silently move parts.

## Invalidation

Before reusing checked work, apply the dependency rules below and retain the
affected input/report/output fingerprints through [delivery evidence](delivery-evidence.md).

| Changed input | Recheck |
| --- | --- |
| Geometry, hierarchy, rest, units or identity | Scene index and every dependent binding/plan |
| Explosion distance/group/direction, cohort timing, focus occurrence or motion range | Offset/recovery checks, contextual/focus framing envelopes, anchors and action sound bindings |
| Visibility/focus fade intervals | Still-displayed context envelopes, solid/edge appearance, selection policy, valid labels and restoration |
| Aspect ratio, text or reserved UI areas | Affected composition and annotation layouts |
| Color, roughness or light only | Appearance/selection/process/label readability; no invented geometry revision |
| Pair, tooth/region phase, mechanical relation or direction convention | Pair evidence and binding, cue following and zero/reversal behavior, relevant framing/visibility and seek/loop recovery |
| Duration, score or chapter order | Timeline, synchronization and loop; retain unchanged geometry and narration |

A sourced STEP explosion targets actual occurrences without changing placement. A text-designed gearbox uses authored dimensions and IDs. A requested 12-second image showcase honors that duration and discloses unknown internals. None adds automatic reconstruction, mate solving, or collision checking.

## Worked handoff: WOLF sun and one planet

The [v4 plan](../../../../examples/wolf-actuator/tour-v4/plan.json) and
[delivery record](../../../../examples/wolf-actuator/tour-v4/delivery.json) bind a
real example of these contracts. The observation question is: **how does the
selected planet spin about its own axis while its center orbits the sun?**

Shared binding for this example:

```json
{
  "geometryRevision": "wolf-b352183e1bd0-2793c41488d0-xcaf-1",
  "sunOccurrence": "occ-b352183e1bd0-root-953098-767",
  "planetOccurrence": "occ-b352183e1bd0-root-953098-774",
  "axisSpace": "world",
  "axis": [0, -1, 0],
  "distanceUnit": "metre",
  "timeDomain": "seconds derived from the existing 112 BPM, 160-beat story"
}
```

These IDs belong to this source revision; other assemblies resolve their own.
This snippet is an explanatory handoff, not an executable JSON schema.

| Owner | Consumes → returns | Concrete implementation / required recovery |
| --- | --- | --- |
| Mechanism adapter | Source tooth-count evidence and input phase → sun spin, planet spin and orbit | `tour-v2/gearing.mjs` and `kinematics.mjs`; owns the signed motion, independent of display offsets |
| Assembly & Explode | Existing groups and pose ownership → retained whole-to-detail separation | Reuse the existing tour offsets; the selected meshing pair remains in its supported relationship, with no extra extraction or scaling |
| Mating Close-up | Actual pair, measured axial tooth phase and adapter state → tooth-region weights and signed spin/orbit marks | `tour-v4/tooth-phase.mjs` and `direction-cues.mjs`; fade in at beats 28–29, out at 35–36, hide at rest and follow reversal |
| Camera Direction | Actual pair, inherited motion envelope and display context → retained approach/detail/return poses | `tour-v3/framing.mjs`; world Y=0.004 m is an ideal pitch-region observation anchor, not a solved contact point |
| Materials & Lighting | Current appearance/selection and cue weights → occurrence-owned vertex colors and neutral rotation arcs | `tour-v4/pair-layer.mjs`; preserve source mesh coordinates and restore neutral colors when disabled or outside the passage |
| Orchestrator | All adapters and existing score → one integrated story and scoped evidence | `tour-v4/app.mjs` supplies `createPresentationLayer`; the shared study calls it on the common clock before drawing |

`validated` here is scoped to the retained source binding, phase/direction cues,
inherited kinematics and the recorded delivery checks. The measured CAD ratio
and upstream specification still disagree; tooth contact, stress and collision
response remain uncomputed. Those limits travel with the handoff, even after
the video is exported. A new camera or tooth mask invalidates the affected
evidence rather than inheriting this example's status by copying its plan.
