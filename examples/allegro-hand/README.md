# Allegro Hand — link by link

A 35.56-second English loop: **curl → thumb opposition → link separation → one
finger close-up → complete reassembly**. White solids, fine black contours,
near-part names and an original code-generated score follow the Mechanism Studio
Showcase defaults.

## Run

Run from the repository root. The source and generated GLB are included;
ordinary viewing needs Node.js and the installed npm dependencies, not Python.

```sh
npm ci
node tools/audio/build-study-score.mjs --example examples/allegro-hand
node examples/allegro-hand/serve.mjs
```

Open [the local study](http://127.0.0.1:4185/?clean=1). Autoplay is silent; use
**Play with music** to enable audio. Pause, drag to inspect, seek, restart and
resize use the shared study transport. Reduced-motion visitors start paused.
The WAV is generated locally; a missing WAV leaves a usable silent presentation.

This dedicated server uses the shared preview runtime with an explicit example
allowlist. The root gallery lists its server command; the root preview does not
serve `/examples/allegro-hand/`. `?capture=1` enables the existing deterministic capture API through
`window.allegroStudy.capture`; this is not an exported MP4. No new video or public
post is implied by this example's existence.

## Optional geometry rebuild

To regenerate the included visual assets from the pinned MJCF and STL bytes:

```sh
npm run fetch:sources   # downloads the pinned STL meshes
node tools/robot/build-mjcf.mjs --example examples/allegro-hand
```

This optional step requires Python 3's standard library as well as Node.js.
See the [bounded MJCF importer guide](../../tools/robot/README.md) for Python
selection, source checks and conversion limits. It installs nothing globally
and runs no upstream Python code.

## Source and exact scope

The source is the **Allegro Hand V3 right-hand simulation model** from
[MuJoCo Menagerie](https://github.com/google-deepmind/mujoco_menagerie/tree/62ab00f2bc44f6f20c1c9b7a13f3fb1dd41a4e35/wonik_allegro),
pinned at `62ab00f2bc44f6f20c1c9b7a13f3fb1dd41a4e35`.
There are **21 semantic bodies, 21 visible link meshes, 11 mesh definitions and
16 source hinge joints**. Source XML, all referenced STLs, license and original
README are retained and fingerprinted in [provenance](source/provenance.json).
Model and derived geometry retain **BSD-2-Clause**; see [source notice](source/NOTICE.md).

This example demonstrates articulated link geometry and the source joint axes,
limits and hierarchy. It does not supply manufacturing STEP data or invent the
motors, tendons, screws or bearings hidden inside a modeled link. The separation
paths are presentation offsets, not a validated servicing procedure. There is no
contact simulation, grasp-force calculation or claim of hardware-safe motion.

The source thumb joint `thj0` has a zero reference outside its declared
`[0.263, 1.396]` radian range. The GLB retains that reference; the working model
uses a valid neutral angle of **0.263 radians** throughout explosion and restore.
Every animated joint remains in the source range. Exploded-view compensation uses
the posed parent's world matrix, so nested finger offsets do not accumulate.

## Four-module handoff

| Owner | This example |
| --- | --- |
| Assembly & Explode | Actual `mjcf:*` body IDs; four staggered chains; source parents preserved; all offsets restored |
| Camera Direction | Precomputed working and explosion envelopes; continuous overview/detail paths; no live refit |
| Materials & Lighting | Shared neutral white-line study; context solids and contours fade together for the close-up |
| Mating Close-up | No gear/contact effect: the source first-finger chain is shown with its real serial hinge arrangement |

[The plan](plan.json) records the 64-beat timeline at 108 BPM. `motion.mjs` owns
joint transforms; `story.mjs` owns display offsets; `framing.mjs` owns camera
plans; `annotations.mjs` reveals names only after their parts and camera settle.
The selected first-finger occurrences remain original parts at unit scale.

## Reproducible checks

```sh
node --test examples/allegro-hand/tests/study.test.mjs
```

Checks cover joint bounds, source transform preservation, posed-parent explosion
compensation, camera envelopes, original-part detail identity, loop/seek recovery,
stationary annotation windows, music event identity and the preview allowlist.
Browser usability, actual listening and any encoded-video readability are
separate checks; see the delivery notes produced for the current run.

The [18 October validation notes](validation.md) and [delivery fingerprints](delivery.json)
are a historical record of the original local review against the pre-sync
runtime. Later changes to its inputs are listed, with reasons and evidence, in
[`delivery-drift.json`](delivery-drift.json), so `npm run check:delivery` passes
while any undocumented change still fails. The [19 October integration report](../../docs/robot-studies-release.md)
records the shared-server compatibility checks for this publication. Viewing,
media export and public posting remain separate delivery states.
