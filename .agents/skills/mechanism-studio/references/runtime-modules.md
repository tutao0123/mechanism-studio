# Runtime and example map

The [public module catalog](../../../../docs/modules.md) explains responsibilities, inputs/outputs, limits and focused checks. This map points authoring tasks to their existing implementation. Exact API parameters belong in component READMEs/source, not a second copied interface manual.

The [input brief](input-brief.md) and [module handoffs](module-orchestration.md) coordinate text/image/CAD tasks. The [executable presentation subset](executable-presentation.md) runs supported study channels; mechanics and broader handoffs need actual adapters. There is no automatic image reconstruction API.

| Work | Reuse | Example-owned content |
| --- | --- | --- |
| Original generation, registered preview and supported direct-frame export | [Studio entry](../../../../tools/studio/README.md) | Fixed local construction recipe, server/route/audio metadata and film adapter. `npm run studio -- list`, `generate <id>`, `preview <id>`, `export <id>`; use the registry's declared capabilities rather than assuming every example supports generation or export |
| GLB loading, stable binding, camera/orbit/picking, line art, display explosion | [shared/viewer](../../../../shared/viewer/README.md) | Mechanical equations, working-pose adapter, lessons and part descriptions |
| Explosion groups/stages and envelope | [explosion contract](modules/assembly-explode.md), viewer display API | Real targets, coordinate-aware offsets and recovery checks |
| Planned views, transitions and safe areas | [camera contract](modules/camera-direction.md), [director](../../../../showcase/camera-director.mjs) | Full motion/explosion bounds, targets, viewports and anchors |
| Fill/edges/lights/textures | [appearance contract](modules/materials-lighting.md), viewer/Blender adapter | Real part roles, licensed resources, parameters and restoration |
| Reversible chapter color accents | [shared/appearance](../../../../shared/appearance/README.md) | Same-clock actual part cues |
| Music-led assembly study, near labels, capture transport | [shared/study](../../../../shared/study/README.md) | Thin timeline/index/framing/annotation/offset/score adapter |
| Executable display-offset, orthographic-shot, label and accent/opacity plan | [plan compiler and bootstrap](../../../../shared/study/README.md), [example template](../../../../templates/study/README.md) | `mechanism-presentation-1` data, real revision/IDs/bounds, mechanism and source-specific adapters |
| Numerical presentation report | [presentation checker](../../../../tools/study/check-presentation.mjs) | Registered example inputs, project-local report; browser/video review remains pending |
| Pinned Allegro / Robotiq MJCF visual import | [tools/robot](../../../../tools/robot/README.md) | Retained model hashes, source body hierarchy and per-example kinematics; this importer only supports the two pinned sources |
| Original robot-study score and action accents | [tools/audio](../../../../tools/audio/README.md) | Actual part IDs and story events; reproducible local WAV, no service calls |
| Captured frames + verified track → MP4 | [tools/video](../../../../tools/video/README.md) | Actual input paths/counts and reviewed output; the tool does not capture or publish |
| Input/report/output fingerprint handoff | [delivery evidence](delivery-evidence.md), [checker](../../../../scripts/check-delivery.mjs) | Declared paths, hashes, check scope and storage; the helper checks integrity and availability, not report truth or publication |
| Optional provider-neutral speech API; existing Doubao lesson/digest/browser playback | [shared/voice](../../../../shared/voice/README.md) | Text, explicit speech model/voice/endpoint, media-clock binding; old lesson integration stays separate |
| GLB/accessor/units/identity/hierarchy/rest/ownership checks | [shared/assets](../../../../shared/assets/README.md) | Mechanism length/phase/contact/mapping invariants |
| Definition/occurrence identity, linked tree/model selection, repeated-instance navigation, hide/isolate | [shared/cad](../../../../shared/cad/README.md), `mountAssemblyInspector` in `shared/cad/inspector.mjs` | Actual XCAF graph/provenance/matrices, viewer bindings and page elements; source hierarchy stays unchanged |
| New STEP import and retained-evidence audit | [CAD workflow](cad-workflow.md), [tools/cad](../../../../tools/cad/README.md) | Per-source provenance and thin page; never copied specimen constants |
| Flow paths, pulses and explanatory process graphics | [shared/animation](../../../../shared/animation/README.md) | Pure process model, regions, phase and assumptions |
| Narrated/silent mechanism tours | [showcase](../../../../showcase/README.md) | Story registration, mechanism/framing adapters and measured chapter timing |

## Choose a nearby example

- [Lock](../../../../prototype-3d/README.md): working gates, wrong/matching keys, cutaway and legacy asset compatibility.
- [Inline-four](../../../../examples/inline-four/README.md): one slider-crank computation drives poses/readouts and four-stroke explanations.
- [Turbofan](../../../../examples/turbofan/README.md): authored two-spool teaching motion and qualitative process regions.
- [Quadruped](../../../../examples/quadruped/README.md): fixed-body geometric gait, foot trajectory, analytic IK and FK checks; not dynamic balance.
- [Leader Arm STEP inspector](../../../../examples/step-bearing-assembly/README.md): a real Apache-2.0 AP242 source with one root, 99 part occurrences and 43 placements of one screw definition. `npm run studio -- preview step-bearing-assembly` opens the silent source-tree/model inspector. The actual source tree is flat; six bearings, bearing housings and rotors remain real source instances, not invented joint assemblies. `npm run fetch:sources` restores pinned source bytes for `audit:cad` and source tests; existing GLB viewing needs no CAD runtime. The [CAD workflow](cad-workflow.md) covers adding a different source.
- [SO-ARM 102 study](../../../../EXAMPLE_ROBOT/README.md): sourced URDF link identity, music clock, grouped explosion, near sequential labels and scene-group fades. Eight merged links are not per-screw/native STEP solids.
- [SO-ARM kinetic cut](../../../../EXAMPLE_ROBOT/kinetic/README.md): explicit 25.714-second variant using five revolute/two prismatic source-backed joints, opposed jaws, zero-pose gate before explosion, deliberate detail/whole cuts and original score; original study retained.
- [Gearbox](../../../../examples/gearbox/README.md): original 124-part teaching model in 15 nested assemblies, exact tooth-ratio kinematics, power-path accents and a synchronizer close-up with solved dog-tooth alignment; atlas, blueprint and cinematic editions of one model. Its `presentation.mjs` demonstrates the executable study subset; the cinematic adapter remains separate. Authored internals, not source CAD.
- [Planetary reducer](../../../../examples/planetary-gears/README.md): original 80-part teaching assembly, ideal coupled gear/bearing motion and 36-second Atlas study. It is also a supported Studio direct-frame export adapter, not an imported commercial CAD assembly.
- [Original robot joint](../../../../examples/robot-joint/README.md): 129 authored occurrences, 44 geometry definitions and five subassemblies beneath the root. Its motor, 4:1 reducer, detailed bearings and output flange have local generation, linked part selection, a 36-second Atlas story and direct-frame export; motor motion is illustrative, with no electromagnetic or load solver.
- [Allegro hand](../../../../examples/allegro-hand/README.md): source-axis finger gestures, valid neutral thumb pose, parent-aware link explosion and one original finger close-up; source references stay immutable.
- [Robotiq gripper](../../../../examples/robotiq-gripper/README.md): analytic four-bar closure, equal driver angles, source-link separation and reassembly, with a `presentation.mjs` adapter for the executable study subset. No contact adaptation or hidden actuator internals.

Use actual current reports, not this map's prose, for counts and hashes. Do not turn an example's axes, IDs, formulas, steps or tool paths into universal constraints.

The Studio registry currently lists 19 preview IDs. The three original generation
recipes are `robot-joint`, `planetary-gears` and `gearbox`. Unified exports support
`robot-joint`, `planetary-gears`, `gearbox` and `gearbox-cinematic`; dimensions, duration,
score and frame rate belong to their adapters. `export` starts a local
browser-assisted workbench, then the user reviews calibration views and clicks
Generate. The browser and local command must stay open; FFmpeg/FFprobe encode
and check the result. Other entries remain preview-only. Keep completed-film
review distinct from numerical checks; the tool neither publishes online nor
turns a static STEP into motion.

## Integration invariants

Source parent → display → model → source node. Default applyPoses writes model wrappers; absolute-node assets opt into target:'node' and do not also apply the same pose to model. Default explosion is glTF metres in display-parent space; body-space legacy vectors need an explicit conversion.

The voice player owns narrative playback, not mechanical judgments. Example input changes cancel old lessons. The canonical narration digest excludes angle/camera/part metadata.

Checks cannot restore engineering fields lost during import. Keep legacy compatibility limited; new assets declare canonical identity, actual parents and motionOwner. Root npm test aggregates appropriate checks; it does not call paid synthesis or publish remotely.

Public packaging retains code-music builders with their score metadata, and text/manifests/CLI for narration. Generated score WAVs are ignored; `npm run build:audio` rebuilds all of them and verifies each recorded hash. Generated Doubao MP3s and local .blend exports may also exist locally but are excluded from the public Git package; do not claim they are shipped. Rebuild Blender assets using their source builders, and generate speech only with the user's own authorized account and applicable service terms.
