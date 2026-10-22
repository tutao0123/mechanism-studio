# Robotiq 2F-85: a grasp, connected

A **35.56-second English Showcase**: coupled grasp → source-body separation → one right-side linkage detail → reassembly → grasp again. White fine-line rendering, the shared atlas typography and nearby retained names follow Mechanism Studio's four authoring modules. A quiet original code score uses the same 108 BPM, 64-beat timeline; narration is optional and is not included here.

## Run

From the Mechanism Studio repository root, after `npm ci`:

```sh
node tools/audio/build-study-score.mjs --example examples/robotiq-gripper
node examples/robotiq-gripper/serve.mjs
```

Open [the local study](http://127.0.0.1:4186/) or [the clean presentation](http://127.0.0.1:4186/?clean=1). Click **Play with music** to enable sound. Pause enables free inspection; seek and restart use the same deterministic mechanical and editorial time. The score WAV is generated locally and is not required for silent viewing. The source and generated GLB are retained so ordinary viewing does not require an online model fetch.

The dedicated server shares the common preview runtime while keeping explicit
example routes. The root gallery lists its launch command; the root preview
does not serve this study under `/examples/robotiq-gripper/`.

## Optional geometry rebuild

Viewing needs Node.js and npm dependencies only. To regenerate the included
visual assets from the retained model bytes, also provide Python 3:

```sh
node tools/robot/build-mjcf.mjs --example examples/robotiq-gripper
```

The [bounded MJCF importer guide](../../tools/robot/README.md) explains Python
selection, byte verification and supported source syntax. The builder uses
Python's standard library, installs nothing globally and runs no upstream code.

## What is actually sourced

- [MuJoCo Menagerie / Robotiq 2F-85 v4](https://github.com/google-deepmind/mujoco_menagerie/tree/62ab00f2bc44f6f20c1c9b7a13f3fb1dd41a4e35/robotiq_2f85_v4), pinned at `62ab00f2bc44f6f20c1c9b7a13f3fb1dd41a4e35`.
- Eleven source bodies, nine with visible geometry; thirteen mesh occurrences from eight referenced STL definitions. The two pad bodies contain only source collision geometry, so they retain semantic identity but add no invented visual part.
- Six retained hinge joints, two closed-loop `connect` constraints and the source equality between driver angles. The fixed tendon and actuator metadata remain source evidence; no torque or controller model is run in the browser.
- [Exact upstream bytes and SHA-256 inventory](source/provenance.json), [source MJCF](source/2f85.xml), [upstream model notes](source/README.md) and [BSD-2-Clause license](source/LICENSE).

The imported meshes are already in metres. The importer preserves the asset's effective scale of one: a body `childclass` does not alter a separately declared mesh asset. Every local frame is converted with `B=[x,z,-y]`; the mechanical adapter applies the same basis to hinge axes and anchors exactly once.

## Mechanical relationship

The adapter in [kinematics.mjs](kinematics.mjs) drives both input hinges equally. For each side, it computes the coupler endpoint from the retained source rest placement, intersects the two link-length circles, keeps the branch continuous from the source zero pose, then solves the follower angle about its actual axis. It preserves the small left/right geometric differences instead of replacing both sides with a guessed `q=q=q` linkage.

The checked range is **0 to 0.75 radians**; the story uses at most 0.72 radians. Source connect anchors remain coincident within numerical precision, and all six angles stay within their source limits. The moving model channel and the later editorial separation channel remain distinct. Both working pulses return to zero before any separation begins. At the loop boundary all angles and display offsets return to zero.

This is a source-based rigid **kinematic inspection**, not a contact, force, adaptive-grasp or dynamics simulation. The STL source is not an exact B-rep CAD assembly or a fastener inventory. No hidden motor, screw or bearing is invented. The source `connect` relationship establishes the linkage explanation; it does not certify manufacturing clearance or collision-free dismantling.

## Authoring handoff

[The example plan](planning/module-plan.json) assigns responsibilities to Assembly & Explode, Camera Direction, Materials & Lighting and Mating Close-up. The mechanism adapter owns working angles. The other modules share real `mjcf:<body>` IDs and the common clock.

[`example.mjs`](example.mjs) supplies the study configuration to the shared
bootstrap. [`presentation.mjs`](presentation.mjs) compiles the actual
`mechanism-presentation-1` plan: source-body display translations, fixed camera
envelopes, label windows and label accents all execute from that data. The live
immutable plan is available at `window.mechanismStudy.presentation.plan`, and
`createGripperPresentation(index, { plan })` accepts an edited serialized plan
bound to the same geometry revision. The driver pulses stay in `story.mjs` and
the source linkage solution stays in `kinematics.mjs`.

The detail shot retains the original right-side source occurrences and uses camera magnification, not duplicated or scaled parts. Its two names appear one at a time after settling, remain beside their parts, and fade together at the next scene. The static detail is intentionally an exploded structure view; the assembled opening and closing shots carry the working-motion evidence.

## Verify and delivery scope

```sh
node --test examples/robotiq-gripper/tests/*.test.mjs
```

Checks cover retained-source hashes/constraints, 751 closed-loop poses and source limits, actual nested transform composition, complete reset, separation only at zero pose, mobile/desktop framing envelopes, label timing and the local HTTP allowlist. They do not establish visual reading quality or acoustic listening quality; those require a separate real browser/media review.

Executable-plan tests also compare 1,794 sampled states and 36 camera views
against frozen pre-migration fingerprints, exercise plan edits through the
actual adapter, and check reverse seeks, paused inspection and exact chapter
boundaries. At an exact boundary the next chapter starts deterministically;
floating-point modulo rounding no longer retains the preceding chapter for
that single sample.

The deliverable here is a live looping example and reproducible generated score. A captured MP4, encoded-video downscale review, X post and GitHub publication are separate deliverables; their existence is not implied by the live page.

The [18 October validation notes](validation.md) and [delivery fingerprints](delivery.json)
record the original local review against the pre-sync runtime.
[`delivery-drift.json`](delivery-drift.json) records reviewed non-runtime
changes, while the strict historical media fingerprint check intentionally
reports changed runtime inputs in the current alpha. Passing current numerical
tests does not certify a new export or visual/audio review. The
[19 October integration report](../../docs/robot-studies-release.md) records
the shared-server checks at that date; it does not certify current media delivery.

## License

Original adaptation code, authored presentation and synthesized music: repository MIT license. Retained and adapted Robotiq/Menagerie model assets: **BSD-2-Clause**, copyright 2013 ROS-Industrial. Keep [the full source license](source/LICENSE) and attribution with redistributed assets. This example is an independent visualization and implies no endorsement by Robotiq, ROS-Industrial or Google DeepMind.

## Upstream files fetched on demand

The upstream STL meshes in `source/assets/` are not stored in Git. `npm run fetch:sources`
downloads them from the pinned upstream commit recorded in `source/provenance.json` and
accepts them only if the SHA-256 matches; `npm test` does this first. The pinned
list is [`scripts/upstream-sources.json`](../../scripts/upstream-sources.json).
