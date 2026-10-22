# Camera Direction

Called by [the orchestrator](../module-orchestration.md) for authored views, tours or framing fixes. A camera-plan is a handoff record. The [executable presentation subset](../executable-presentation.md) runs fixed-envelope orthographic shots; broader paths and CAD-specific framing need adapters. Read [visual style](../presentation-style.md); tours also use [pacing](../presentation-pacing.md), [motion choreography](../motion-choreography.md) and [transport](../presentation-tour.md).

## Responsibility and inputs

Translate an observation question into purposeful overview/detail/exploded views, transitions and near-part annotation space. Read geometry and motion; never change mechanical poses or explosion distances to fit a shot. Inspect keeps free orbit, explicit fit and manual presets unless a tour is requested. No geometry means storyboard intent only.

| Input | Required meaning |
| --- | --- |
| `brief` | Route, observation goal, actual target aspect ratios, autoplay, duration/style overrides |
| `scene-index` | Actual part/occurrence IDs, bindings, parents, units/basis, source/display conversion and geometryRevision |
| `explosion-plan` | Geometry and plan revisions, offsets/spaces, full progress range and intermediate envelope; explicitly disabled if unused |
| Mechanical/process adapter | Ownership, supported motion intervals, process paths, visibility/cutaway rules and implementation revision |
| `timeline` | Chapter IDs, local times, durations, action stages, loop boundary and selected profile |
| Layout constraints | Real viewport sizes, controls/title/caption/credit areas and crowded chapter cases |

Single images do not prove hidden structure, size or motion bounds. Bind reconstructed teaching geometry using its actual new IDs/version and disclosed assumptions.

## Plan in two stages

First choose candidate directions, target IDs, anchors and text space. Static bounds can support candidates, but do not prove the final motion/explosion envelope.

After offsets, motion ranges, visibility and process paths are finalized:

1. Resolve real targets and units/parents; repeated screws are occurrences, not a name lookup.
2. Compute in copied transforms or independent calculation space. Trial framing must not mutate source, working or display state.
3. Include geometry, intended motion, maximum/intermediate explosion and process paths. During contextual fades include still-displayed surrounding geometry; a selected repeated part also needs bounds through extraction and return. Curve endpoints alone are insufficient. Disclose sample ranges and uncovered risks.
4. Use causal overview → necessary detail → expansion/reassembly views. A stable view may serve several chapters.
5. Fit actual desktop, narrow-window and phone aspects with title, labels and credit reserves.
6. Recheck after actual annotations are placed.

Geometry/rest/basis/identity, explosion, motion or process-range changes invalidate final framing. Chapter objectives, text, aspect or safety areas invalidate affected layouts. Color-only edits still need contrast review.

“Keep the viewpoint” normally preserves direction/composition intent. Recheck the old plan against larger bounds and adjust orthographic scale/margins if needed. If all camera values are explicitly locked and cannot cover the new envelope, report the concrete conflict.

## Output: camera-plan

Record stage and revisions for geometry, explosion, mechanics/processes, timeline and profile; each chapter includes observation purpose, real target IDs, position/target/orthographic halfHeight, envelope inputs and method. Include viewport fitting rules, reserved areas, near-outline candidate anchors/regions, actual projection coordinates, and optional authored pullback.

For a single-part close-up, record the same occurrence's set/context, observation position, camera approach, settled read and pullback intervals. Magnify through framing, without mesh scaling or source changes. A fixed authored target/scale path can follow the known extraction; it must not chase changing live bounds or carry moving labels through the approach.

Specify first frame, continuous transitions, pause, explicit seek, loop, exploration return, resize and reduced-motion behavior. Attach actual range checks, sampled camera poses, representative screenshots, unresolved targets and limits. Inspect may deliver static presets without chapters. A handoff needs a supported compiled presentation or explicit adapter before it executes.

## Existing runtime

- [Presentation compiler](../executable-presentation.md): binds declared orthographic shots to chapters and fixed envelopes. It checks the supported data; the author supplies bounds for real motion/offset ranges and reviews the result.
- [createCameraDirector](../../../../../showcase/camera-director.mjs): `createCameraDirector({ duration })` returns sample/reset/snapshot. `sample({ chapterKey, localTime, pose, cut })` interpolates actual to planned pose; `reset(actualPose)` supports exploration return. It owns no clock, geometry, DOM or audio.
- [Camera envelopes](../../../../../showcase/adapters/camera-envelope.mjs): the current helper handles its declared X-axis rotations and bounded translations; it is not a universal multi-joint solver.
- [Quadruped framing](../../../../../showcase/adapters/quadruped-framing.mjs) handles that model's own Z-axis pitching/ranges. A new topology needs corresponding math and validation.
- [Viewer](../../../../../shared/viewer/README.md): orbit controls, setCamera and explicit fitVisibleAssembly. Actual visible-solid bounds are useful for checks/manual fit, not continuous auto-fit.
- [Study shell](../../../../../shared/study/README.md): example framing returns `cameraFor(chapterId, aspect, localTime)`. Optional annotationCameraFor supplies a settled layout reference.
- [Robot framing](../../../../../EXAMPLE_ROBOT/framing.mjs) and [kinetic framing](../../../../../EXAMPLE_ROBOT/kinetic/framing.mjs) are actual instance-specific adapters; do not copy their chapters/bounds into another model.

## Stability and timing

For a requested [Cinematic film](../presentation-cinematic.md#camera-and-composition), a fixed authored perspective path may replace the default orthographic transition pattern below. Require continuous position/target/lens velocity for smooth passages and matching endpoint pose/velocity for a loop; sample the common absolute time. Conservative envelope checks, source identity and recovery responsibilities remain the same. This profile is implemented by an example adapter, not by assuming the shared director already supplies perspective film rendering.

Open directly on the planned first pose. Use precomputed conservative envelopes; rotating or separating geometry must not cause camera breathing, jitter or target chasing.

At continuous chapter transitions, capture the actual starting camera once, use quintic smoothstep, shortest azimuth arc and smooth scale. Use the selected profile's duration unless a purposeful approach has its own authored interval. Explicit seek/restart/paused selection cuts to the planned pose; exploration return starts from the actual user pose. Coordinate approach and context fades before entering a tight close-up. When a continuous composition cannot communicate the change well, use a deliberate editorial cut; membership changes alone do not require one. Never reveal the whole arm inside a jaw macro frame.

Pause freezes chapter time and transitions. Planned frames are deterministic from story/time; continuous interpolation also depends on captured start pose/time. Do not claim identical transition frames for arbitrary playback histories. Resize refits without resetting phase/play state; capture repaint must not restart transitions.

Reduced motion pauses autoplay and uses still planned views until deliberate playback. A short detail entry arc must settle before names appear. A once-authored 6–10% pullback after reading is optional; no live bounds chasing.

## Checks and handoff

Validate actual meshes/envelopes at intended ranges and intermediate states, first/last loop poses, chapter boundaries, pause/resume, seek, exploration, resize, reduced motion and target aspect ratios. Verify near labels remain short and truthful, moving/hidden/offscreen targets do not get false clamped leaders, and key relationships are not obscured.

The shared director tests establish interpolation behavior, not a new model's envelope. Missing ranges/geometry/anchors return candidate status and exact missing inputs. Failed framing returns to the orchestrator or explosion owner; do not silently move source parts or retain a stale validated plan.
