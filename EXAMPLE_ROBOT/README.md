# SO-ARM 102, revealed

For the faster, source-backed moving-joint edit, see the [25.7-second kinetic
cut](kinetic/README.md). This page documents the retained 34.3-second study.
The [example catalog](../examples/README.md) describes what ships in a public clone.

A **34.285714-second** English robot assembly study made with the Mechanism Studio input, explosion, camera and appearance workflows. The eight source-authored links separate in four groups and return to their original placements. Fine dark feature lines sit on a white background; stable orthographic views, serif captions and restrained leaders follow the same visual rules as the studio.

## Watch locally

From the Mechanism Studio root, with its existing Node dependencies installed:

```powershell
node EXAMPLE_ROBOT/serve.mjs
```

Open [the robot study](http://127.0.0.1:4180/) or [the clean presentation](http://127.0.0.1:4180/?clean=1). This example has its own scoped preview so the original port-4179 server and existing pages need no changes. It reuses the parent project's shared viewer, line-art implementation and camera director; it is not a standalone copy of those modules.

A silent visual preview starts automatically. Click **Play with music** to enable the original score. After activation, native `Audio.currentTime` drives the complete presentation, including when muted. Pause/resume, restart and seek control the same timeline. Dragging pauses the presentation for free inspection; resume returns smoothly from that view. Reduced-motion preference starts paused. The source credit remains visible in clean mode.

## Musical structure

The score is original code synthesis: a **56 BPM half-time feel on the unchanged 112 BPM motion grid**, 16 bars / 64 transport beats, stereo 44.1 kHz/16-bit WAV. Sparse rounded keys, warm bass and soft pads replace the earlier percussion and arpeggios. Eight quiet motion textures follow the actual link-group movements; four soft seating accents mark return completion. They are editorial cues, not simulated motor or contact sounds. Music and effects are mixed into one buffer so pause/seek/restart keep both synchronized. No speech, third-party samples or upstream soundtrack is used. Exact duration is 1,512,000 frames. The prior music edition is retained under `audio/editions/assembly-return-v1/`; see [audio notes](audio/README.md).

| Time | Figure |
| --- | --- |
| 0–4.29 s | Complete source assembly |
| 4.29–12.86 s | Shoulder, forearm, wrist and jaws separate on the beat |
| 12.86–17.14 s | Wrist and gripper connection |
| 17.14–21.43 s | Opposed sliding-jaw arrangement |
| 21.43–30 s | Jaws, wrist, forearm and shoulder return in reverse order |
| 30–34.29 s | Restored assembly; opening view and musical loop resolve |

The native source parent hierarchy is retained. Each display delta subtracts its parent's inherited displacement before conversion into display-parent coordinates, so nested links do not move twice. Source geometry, source joint-zero placement and the original URDF stay unchanged. The two jaws are visually separated for inspection; the display does not claim to execute the gripper's source mimic constraint or verify a collision-free teardown.

Wrist and jaw close-ups isolate their relevant solid meshes so unrelated links do not intrude at the frame edges. The source parent wrappers remain visible, and the return chapter restores the complete eight-link view.

Names appear **one new name at a time beside the relevant part**, after the camera and that part settle. Earlier names remain in the same scene (at most two); all names fade out together over the final 0.32 seconds before the next scene. A short 10–15 px line touches a real projected mesh vertex, with 15–20 px between the part and its name. In the wrist and gripper details, reading time is followed by one gentle 6% pullback; the cached layout follows that planned projection with a constant font size and short leader. The opening, moving assembly views and final loop framing stay stable.

Labels avoid other links' complete chapter sweeps, earlier names and the source credit. Narrow views can put a name above/below the part or omit it if no clear position fits. Text is measured and placed in the base camera once per scene/viewport, so backward seeks reproduce the same arrangement. Paused names stay readable; future names and previous scenes stay hidden. Manual orbit hides cues until the planned presentation resumes. The source geometry, explosion timing and 34.29-second duration are unchanged.

## Open robot source and attribution

**SO-ARM 102 by Robonine**, pinned commit `e871f738c97f43de230cb04d340797da6a68c4b9`:

- [Original URDF and visual meshes](https://github.com/roboninecom/SO-ARM-102/tree/e871f738c97f43de230cb04d340797da6a68c4b9/simulation/urdf)
- [File-level licensing map](https://github.com/roboninecom/SO-ARM-102/blob/e871f738c97f43de230cb04d340797da6a68c4b9/LICENSING.md)
- [Retained provenance and hashes](source/provenance.json), [source notes and attribution](source/SOURCES.md), [license text](source/DOCS-LICENSE.txt)

The selected `simulation/` description and visual meshes are **CC BY 4.0** under the upstream licensing map, distinct from hardware designs elsewhere in that repository. Original files are retained byte for byte; converted GLB, white line presentation, editorial exploded offsets, cameras, English captions and the separate music score are changes made for this example. Preserve the credit, source/license links and change notice when redistributing the visual derivative. This study does not imply upstream endorsement.

There are **8 link meshes and 62,064 triangles**. Each mesh merges multiple physical bodies. This is a source-based **link-level exploded presentation**, with no per-screw/native STEP assembly identity, collision-checked disassembly, engineering measurement or validated physics. Upstream collision/inertial estimates are retained as source material, not independently certified here.

## Inputs, modules and reproducibility

`planning/brief.json` records the input and scope. `scene-index.json` binds actual source links to GLB parts. `explosion-plan.json`, `camera-plan.json`, `appearance-plan.json`, `annotation-plan.json` and `timeline.json` record the shared geometry revision and actual implementation adapters. These are inspectable authoring handoffs; the page executes `story.mjs`, `framing.mjs`, `annotations.mjs` and the existing viewer APIs, rather than a generic JSON plan engine.

```powershell
node EXAMPLE_ROBOT/source/research/verify-source.mjs
node EXAMPLE_ROBOT/build-robot.mjs
node EXAMPLE_ROBOT/audio/build.mjs
node EXAMPLE_ROBOT/write-plans.mjs
node --test EXAMPLE_ROBOT/tests/*.test.mjs
```

The geometry build uses the already installed project-local Python runtime for XML parsing and existing Three.js for STL conversion; it executes no upstream scripts and installs no new dependencies. All generated geometry, audio, plans, tests and controlled output stay in this folder. Original source hashes are verified before the geometry build. `.cache/`, `output/` and the ignored source research checkout are not release assets or preview routes.

The current shared study/colour integration is recorded in
[verification-color-study.json](verification-color-study.json); `verification.json`
preserves the earlier retained-scene review. The optional **Color cues** switch
restores neutral line art. Active targets use pale blue from the same name/fade
timeline, through independent owned materials. `app.mjs` only supplies the robot's
timeline, identities, framing and asset paths to `shared/study`.

Representative screenshots are kept under ignored `output/`. Audio checks record
duration, peak/headroom, clipping and cyclic boundary continuity, without claiming
a subjective listening review. The separate WOLF example has a local MP4 delivery;
neither example automatically grants social-posting or remote-publishing authority.
