# Runtime and example map

The [public module catalog](../../../../docs/modules.md) explains responsibilities, inputs/outputs, limits and focused checks. This map points authoring tasks to their existing implementation. Exact API parameters belong in component READMEs/source, not a second copied interface manual.

The [input brief](input-brief.md) and [module handoffs](module-orchestration.md) coordinate text/image/CAD tasks. Plans need actual adapters; there is no general plan loader or automatic image reconstruction API.

| Work | Reuse | Example-owned content |
| --- | --- | --- |
| GLB loading, stable binding, camera/orbit/picking, line art, display explosion | [shared/viewer](../../../../shared/viewer/README.md) | Mechanical equations, working-pose adapter, lessons and part descriptions |
| Explosion groups/stages and envelope | [explosion contract](modules/assembly-explode.md), viewer display API | Real targets, coordinate-aware offsets and recovery checks |
| Planned views, transitions and safe areas | [camera contract](modules/camera-direction.md), [director](../../../../showcase/camera-director.mjs) | Full motion/explosion bounds, targets, viewports and anchors |
| Fill/edges/lights/textures | [appearance contract](modules/materials-lighting.md), viewer/Blender adapter | Real part roles, licensed resources, parameters and restoration |
| Reversible chapter color accents | [shared/appearance](../../../../shared/appearance/README.md) | Same-clock actual part cues |
| Music-led assembly study, near labels, capture transport | [shared/study](../../../../shared/study/README.md) | Thin timeline/index/framing/annotation/offset/score adapter |
| Captured frames + verified track → MP4 | [tools/video](../../../../tools/video/README.md) | Actual input paths/counts and reviewed output; the tool does not capture or publish |
| Optional provider-neutral speech API; existing Doubao lesson/digest/browser playback | [shared/voice](../../../../shared/voice/README.md) | Text, explicit speech model/voice/endpoint, media-clock binding; old lesson integration stays separate |
| GLB/accessor/units/identity/hierarchy/rest/ownership checks | [shared/assets](../../../../shared/assets/README.md) | Mechanism length/phase/contact/mapping invariants |
| Definition/occurrence identity, tree selection, hide/isolate | [shared/cad](../../../../shared/cad/README.md) | Actual XCAF graph/provenance/matrices and page layout |
| New STEP import and retained-evidence audit | [CAD workflow](cad-workflow.md), [tools/cad](../../../../tools/cad/README.md) | Per-source provenance and thin page; never copied specimen constants |
| Flow paths, pulses and explanatory process graphics | [shared/animation](../../../../shared/animation/README.md) | Pure process model, regions, phase and assumptions |
| Narrated/silent mechanism tours | [showcase](../../../../showcase/README.md) | Story registration, mechanism/framing adapters and measured chapter timing |

## Choose a nearby example

- [Lock](../../../../prototype-3d/README.md): working gates, wrong/matching keys, cutaway and legacy asset compatibility.
- [Inline-four](../../../../examples/inline-four/README.md): one slider-crank computation drives poses/readouts and four-stroke explanations.
- [Turbofan](../../../../examples/turbofan/README.md): authored two-spool teaching motion and qualitative process regions.
- [Quadruped](../../../../examples/quadruped/README.md): fixed-body geometric gait, foot trajectory, analytic IK and FK checks; not dynamic balance.
- [KFL08 STEP](../../../../examples/step-assembly/README.md): retained source, grouping/fragment mapping and display separation; limited legacy identity.
- [Galileo 2 inspection](../../../../examples/shaft-bearing/README.md): XCAF definitions/repeated occurrences, actual local/world/tree, linked selection/hide/isolate/reassembly and mixed assemblies with owned geometry.
- [SO-ARM 102 study](../../../../EXAMPLE_ROBOT/README.md): sourced URDF link identity, music clock, grouped explosion, near sequential labels and scene-group fades. Eight merged links are not per-screw/native STEP solids.
- [SO-ARM kinetic cut](../../../../EXAMPLE_ROBOT/kinetic/README.md): explicit 25.714-second variant using five revolute/two prismatic source-backed joints, opposed jaws, zero-pose gate before explosion, deliberate detail/whole cuts and original score; original study retained.
- [WOLF actuator](../../../../examples/wolf-actuator/README.md): source-native-metre AP242 with analytic and source-triangulated geometry, actual occurrences, shared study and authored separation. Source triangles are not recovered analytic solids.

Use actual current reports, not this map's prose, for counts and hashes. Do not turn an example's axes, IDs, formulas, steps or tool paths into universal constraints.

## Integration invariants

Source parent → display → model → source node. Default applyPoses writes model wrappers; absolute-node assets opt into target:'node' and do not also apply the same pose to model. Default explosion is glTF metres in display-parent space; body-space legacy vectors need an explicit conversion.

The voice player owns narrative playback, not mechanical judgments. Example input changes cancel old lessons. The canonical narration digest excludes angle/camera/part metadata.

Checks cannot restore engineering fields lost during import. Keep legacy compatibility limited; new assets declare canonical identity, actual parents and motionOwner. Root npm test aggregates appropriate checks; it does not call paid synthesis or publish remotely.

Public packaging retains code-generated WAV music and text/manifests/CLI for narration. Generated Doubao MP3s and local .blend exports may exist locally but are excluded from the public Git package; do not claim they are shipped. Rebuild Blender assets using their source builders, and generate speech only with the user's own authorized account and applicable service terms.
