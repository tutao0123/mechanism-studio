# Teaching goals and layered evidence

Use [existing runtimes](runtime-modules.md) and [input evidence](input-brief.md). For modular tasks distinguish concept/bound/validated; design-only work cannot claim real mesh/UI checks before geometry exists.

## Choose a question, then a view

Define one observable relationship: input-to-output, a gate blocking motion, a phase relationship, or which source assembly fields remain unknown. Geometry, cameras and controls serve that question; a camera change is not itself an explanation.

| View | Useful evidence |
| --- | --- |
| Whole | Input/fixed/output parts and reference direction |
| Cutaway/hidden cover | Internal contact, pivots/links/channels; disclose display removal |
| Axial/side | Rotation/sliding direction, phase, axial occlusion and lengths |
| Detail | Joint/seam/valve/foot/connection, with enough context |
| Explosion/reassembly | Stable part identity, hierarchy and reversible observation; readouts still describe the mechanism |

Detail, CAD colors and screw counts do not certify dimensions, contact or precision.

## Bind each lesson to actual state

Use stable step IDs/titles/narration plus necessary model targets/cameras/parts. The example owns its schema details, not a universal five/six-step template. Each step states the question, involved parts, visible evidence, actual model input/target, computed readouts, stop/cancel/reset behavior and uncomputed physics.

Switching steps cancels old targets/audio. If the target is already reached, hold it. Manual mechanical input exits old narration. Observation changes must not alter mechanical results. A temporary disabled control during explosion is an interface restriction, not a new mechanical gate.

## Evidence layers

| Layer | Check | Does not prove |
| --- | --- | --- |
| Source/import | Hash/terms/units/definitions/occurrences/import differences/mapping | All CAD formats/fields/mates supported |
| Text/image basis | Provided/observed/assumed/unknown and dimension references | Original scale/hidden internals recovered |
| Mechanics | Valid/invalid inputs, limits, lengths, phase, gates, IK/FK, pause/reset | Collision freedom, forces, dynamic stability |
| Display contract | GLB/accessors, actual IDs/parents/rest/units/ownership | Mechanism equations or certified dimensions |
| Runtime/observation | Pose binding, selection, camera, explosion, unchanged readouts, interruption/recovery | Engineering removal/mate solution |
| Process | Phase events/regions and deterministic pause/back seek | CFD/combustion/pressure/temperature |
| Selected audio, optional | Speech digest/protocol/bytes or music source/score/duration/decode; actual transport/listening | A file alone is audible, synchronized or good; silence does not need sound |
| Visual/environment | Actual screenshots, occlusion, labels, controls, keyboard, narrow/visibility/reduced motion | Engineering correctness |

Run relevant shared checks, mechanism-specific invariants, then actual transformed nodes and page. State tested inputs/poses/viewports/runtime and untested limits. Never count a requirement as executed evidence.

## Example-specific invariants

- Lock: alignment versus full insertion, wrong-key gate, return-before-removal and rapid-step interruption.
- Inline-four: slider-crank lengths/dead centers, crank/cam 2:1 phase and four-stroke targets; stage descriptions are not pressure calculations.
- Turbofan: independent spool rates and part ownership; rpm is not thrust/thermal efficiency.
- Quadruped: foot target → IK → FK, fixed link lengths, limits and diagonal phase; reachability is not balance or hardware execution.
- STEP: distinguish definitions, occurrences, subassemblies and fragments; full mapping checks repeated paths/parents/local/world/full basis conversion and mixed owned geometry. Legacy partial mappings remain limited. Audit does not replace actual tree↔model/same-definition/hide/isolate/reassembly interaction checks.
- Source robot rig: validate actual URDF axes/origins/limits/mimic relation and working-pose restoration; no collision/contact/dynamics claim.

Select invariants for the actual task, not a mandatory checklist for every mechanism. Add meaningful boundary/failure coverage, not wording-matching tests.

## Actual delivery review

Apply [visual style](presentation-style.md) and [pacing](presentation-pacing.md) to the current output. Check stable envelopes/transitions, near labels/read/retain/group fade, typography, no horizontal overflow, reachable controls, long text and source credit. A short Showcase uses independently authored motion/result holds, not just shorter hints/global playback multiplier; retain full versions.

Check pause/seek/loop/mode switch/exploration/viewport/visibility return/reduced motion. Stopped numbers and geometry agree. Static scenes redraw on demand; animations advance only under their chosen clock. Missing graphics/audio retain usable text/numbers and honest status, with the failed layer identified.

For selected narration/music measure the actual files and verify matching timeline. Claim subjective listening only when performed. Existing screenshots/reports do not automatically validate changed assets. Passing release checks does not grant publication rights or replace user authorization.

For a substantial handoff, use [delivery evidence](delivery-evidence.md) to retain input/output fingerprints and declared review evidence. Its checker reports byte integrity and unavailable local files; it does not perform these substantive checks or certify a report's claims.
