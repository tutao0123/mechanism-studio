# SO-ARM 102 — kinetic cut

Open `http://127.0.0.1:4180/kinetic/?clean=1` after running
`node EXAMPLE_ROBOT/serve.mjs` from the Mechanism Studio root.
The original 34-second study remains at `/`.

Start with the [repository quick start](../../README.md) or the
[example catalog](../../examples/README.md). The browser presentation and original
code-generated WAV score are included in the public repository. Recorded MP4s,
capture frames and review screenshots under `output/` remain local outputs.
[Watch the published clip](https://x.com/tutao0123/status/2111501272419582272).

This separate 25.714-second cut starts with a real opposing-jaw gesture, pulls
back to a small assembled arm movement, cascades through four display-explosion
groups, holds two readable detail views, then reassembles on the musical cues.
The opening and final macro framing match. Detail/whole membership changes use
deliberate cuts, so newly shown arm links never pop into a jaw macro camera.
Whole-to-whole views retain the short smooth transition. White line art, atlas typography and
short near-part leaders reuse the common study shell. Sound requires a click.

`app.mjs` composes the shared shell with `story.mjs`, `framing.mjs`,
`annotations.mjs` and the source-backed `joints.mjs`. `audio/` contains the
separate deterministic score, synthesis source, cue bindings and checksum.
Tests under `tests/` run with the project `npm test` command.

Working poses are absolute transforms on the viewer's `model` layer. Original
GLB nodes and their rest transforms remain unchanged. The rig uses the actual
five revolute and two prismatic URDF joints, including the opposed-jaw mimic
relation. Every working joint returns to zero before any editorial explosion.
No labels are attached during working movement; the two still detail scenes
finish their short camera arc before names appear, retain names, then fade the
whole group. See [joint evidence](joints-README.md).

Framing uses precomputed sampled kinematic envelopes with a stated guard, not
live auto-fit. Detail camera arcs settle before names appear. Explosion offsets
are authored visual separation, not a mechanically validated removal path.
There is no collision detection, contact/dynamics solver, or hardware-trajectory
certification. The asset has eight merged link meshes, not individually editable
fasteners or native CAD solids.

Source: [Robonine SO-ARM 102 simulation URDF](https://github.com/roboninecom/SO-ARM-102/tree/e871f738c97f43de230cb04d340797da6a68c4b9/simulation/urdf),
CC BY 4.0. Retained provenance and notices remain in `../source/`.
