# WOLF: tooth pairing, spin and orbit

This edition adds subtle tooth-pair highlights and short rotation cues to the
existing sun–planet close-up. The same actual source teeth approach, pass through
the observation region and move away as the mechanism runs. The rest of the film
retains the whole actuator, magnet and crossed-roller details, full reassembly,
white fine-line rendering, large atlas-style type and gentle original music.

The authored duration remains **85.714286 seconds: 160 beats at 112 BPM**. Camera
poses and motion are inherited directly from [tour v3](../tour-v3/README.md);
mechanical poses remain in the [v2 rig](../tour-v2/kinematics.mjs). This edition
adds presentation cues rather than new gear geometry or a new motion solver.

## Run and review

From the Mechanism Studio root, build the shared deterministic music on a fresh
checkout if needed, then start the existing WOLF server:

```powershell
node examples/wolf-actuator/tour-v2/audio/build.mjs
node examples/wolf-actuator/serve.mjs
```

Open [`/tour-v4/`](http://127.0.0.1:4181/tour-v4/) and choose **Play with music**.
The default port is 4181; use the printed port when `PORT` is overridden. Add
`?clean=1` to hide transport controls. The [video review page](review.html) points
to the separately generated `output/wolf-pair-cues-86s-v4.mp4`.

This page reuses `../tour-v2/audio/tour-loop.wav` and its score without
resynthesis or respeeding. WAV SHA-256:
`6f1afefecdcd9229fe7f80ec024b0c0d90d63c12df97398fe01279c4f0885513`.
Generated audio, MP4s and local capture records are excluded from the source
release. A fresh checkout needs the music build above and a separate frame
capture/export to obtain the film.

## What the new cues mean

| Member | Retained source occurrence | Cue |
| --- | --- | --- |
| Sun gear | `occ-b352183e1bd0-root-953098-767` | Selected teeth within its 96-tooth band; absolute input spin |
| `planet-4` | `occ-b352183e1bd0-root-953098-774` | Selected teeth within the 24-tooth middle band; absolute spin, then center orbit |

The two narrower end tooth bands of `planet-4` are excluded. Every other source
part retains its original identity; the scene still contains 245 source leaves.
The close-up does not duplicate a planet, scale a tooth, extract the gears from
their meshing positions or modify the reduction ratio.

The tooth binding measures the actual world-transformed GLB at **15 axial
sections per gear**, using 16,384 radial samples per section and the Fourier
phase at the measured tooth count. The middle teeth are herringbone: their phase
changes along the axis, plateaus at the center and reverses in the other half.
Axial phase compensation keeps a highlight on the same physical tooth instead
of drawing a straight angular stripe across several teeth. Source surface
regions provide the color mask; the retained geometry supplies their shape.

At the existing Y=4 mm observation section, sun and planet phase coordinates
select a paired set of tooth indices. The existing gear adapter supplies the
rotation and orbital angles. An invariant pair sum makes forward and reverse
motion visit the same pairs; a short blend hands the cue to neighboring teeth.
The highlight fades in at beats 28–29 and out at beats 35–36, within the existing
fixed-magnification passage. See the [section measurements and limitations](research/tooth-phase-evidence.md).

Rotation marks explain two different quantities. **Spin** is rotation about a
gear's own axis; **orbit** is travel of the planet center around the sun. Short
arcs use the actual source axis and signed velocity, then project through the
current camera. They do not hard-code screen clockwise/counterclockwise. The
marks are staged to avoid crowding the interface, reverse when their underlying
motion reverses, and hide near zero speed. Names and geometry retain the
existing near-part, fine-line treatment.

These are **source-bound phase and direction cues**, not solved contact patches,
force arrows or stress colors. The camera's pitch-region anchor is an idealized
observation target. The cue does not establish exact loaded tooth contact,
pressure, friction, backlash, deformation, torque or collision response.

## Engineering basis and reusable module

The retained CAD implies a **reverse 31.5:1 reduction** from measured 96/24/144/156
tooth counts; upstream states 34:1. That discrepancy remains unresolved and is
not changed by highlighting. The [gear evidence](../tour/research-v2/gear-evidence.md)
and [independent audit](../tour/research-v2/audit-transmission.md) explain the
actual ring/plate ownership and source geometry. The bearing passage retains
the [ideal no-slip crossed-roller model](../tour/research-v2/bearing-evidence.md),
including its disclosed clearance and load-model limitations.

The reusable [Mating Close-up contract](../../../.agents/skills/mechanism-studio/references/modules/mating-closeup.md)
now guides future component-pair explanations: source occurrence binding,
evidence, local observation region, phase cues, spin/orbit direction and zero/
reversal behavior. It is the fourth internal authoring contract within one
Mechanism Studio skill. It neither installs a new autonomous skill nor provides
an automatic CAD mate/contact solver. Example adapters implement its handoffs.

`story.mjs` retains the v3 clock and replaces only the gear chapter's copy.
`tooth-phase.mjs` binds source teeth and samples phase weights;
`direction-cues.mjs` samples world-space rotation marks. `app.mjs` connects the
presentation layer to the [shared study hook](../../../shared/study/README.md).
The existing source/working/display transform ownership remains unchanged.

## Validation and export status

The October 18, 2026 local delivery is
`output/wolf-pair-cues-86s-v4.mp4`: **1920 × 1080, 30 fps, 2,572 frames,
85.733333 seconds**, H.264/AAC, 28,188,358 bytes. SHA-256:
`88fbadcd191b6dd857353701a000ca1b692101d05b26936bed45e7b01bc2b76f`.

The changed passage was captured again: frames 320–710 inclusive, 391 frames.
The other 2,181 frames retain the verified v3 recordings. Five recorded patch
boundary comparisons have zero pixel difference. Four fresh outside-passage
samples agree exactly in three cases; frame 1900 has a mean absolute difference
of 0.002577 and maximum difference of 5 on an 8-bit channel scale. Two checks
after responsive-layout changes preserve the captured HD images exactly.

The whole MP4 passed full decode and native looping playback. The retained
native-playback snapshot records 26 completed loops, 67,258 total frames,
one dropped frame, zero corrupted frames and no errors. Encoded detail views
were reviewed at 640px and 960px widths. That delivery snapshot recorded 502
passing tests in the full suite and eight in the focused tooth/direction suite.
Its release check covered 647 files, and the difference-format check passed.
These are historical counts; rerun the checks for a later source revision.

Technical audio checks confirm the unchanged source WAV, no respeeding and
19.047 ms of end padding. The encoded track measures −20.01 LUFS and −7.35 dBTP.
No new subjective listening review is claimed. These presentation and media
checks do not establish physical tooth contact or resolve the gear-ratio
discrepancy above.

Run the focused source/phase and inherited camera/mechanical checks:

```powershell
node --test examples/wolf-actuator/tests/tooth-phase-v4.test.mjs examples/wolf-actuator/tests/pair-cues-v4.test.mjs
node --test examples/wolf-actuator/tests/tour-v3.test.mjs examples/wolf-actuator/tests/tour-gearing-v2.test.mjs examples/wolf-actuator/tests/tour-bearings-v2.test.mjs
```

Local evidence is retained in `output/delivery-review.json`,
`output/wolf-pair-cues-86s-v4-verification.json`, `output/native-playback.json`
and `output/capture-v4/`. These generated records and the MP4 are ignored
outputs, not shipped in a fresh source checkout. Reproduce capture and encoding
with the [local workflow](../../../tools/video/README.md).

The portable [delivery record](delivery.json) lists the source, evidence and
output fingerprints without bundling ignored local files. Check it from the
repository root:

```powershell
npm run check:delivery -- --manifest examples/wolf-actuator/tour-v4/delivery.json
```

Add `--require-local` to require the full authoring-machine delivery. A fresh
checkout reports missing local films and raw evidence as unavailable; a present
file whose bytes changed fails. This checks integrity and evidence availability,
not the truth of recorded reviews or whether files have been published. See
[delivery and reuse rules](../../../.agents/skills/mechanism-studio/references/delivery-evidence.md).

The capture input manifest retains its historical plan hash. Final changes to
this README and the plan's delivery status are metadata only: no renderer,
source geometry, camera, timeline or audio input changed, so no new frame
capture is needed for that documentation update.

### Shared shell change after delivery

The [delivery record](delivery.json) is kept as captured. Since then the shared
study shell `shared/study/study.mjs` has gained an opt-in appearance option,
spec labels and drafting hooks (study styles revision `study-styles-1`). Its
digest therefore no longer matches the record
(`9fb1f306…c04f` at capture, `fa3dd0f2…7c4b` now), and `npm run check:delivery`
reports that one file as failed by design. The record is not re-hashed to make
it pass. This edition passes no `appearance` option, so it renders with the
default `atlas` style, whose values are those the shell used before.

The [pixel-identity record](../../../shared/study/evidence/default-style-pixels.json)
compares deterministic Chromium frames from before and after the change on six
existing study pages. These include this tour at 10, 40 and 70 s and at twelve
settled seek points. All 90 frames are byte-identical, as are the label names.
That evidence covers the sampled frames under software rendering. It is not a
recapture of the 2572-frame film. Issue a new delivery record if this tour is
recaptured or its own inputs change.

## Source and older editions

[Tour v3](../tour-v3/README.md), [v2](../tour-v2/README.md), the [v1 complete film](../tour/README.md),
[motor cut](../detail/README.md) and [bearing cut](../bearing/README.md) remain
available. WOLF and modular-bearing are by Anthrobotics and contributors;
retained geometry and adapted visual media use **CC BY-SA 4.0**. Preserve the
[source notice](../source/NOTICE.md), [provenance](../source/provenance.json) and
[source license](../source/LICENSE). Original Mechanism Studio code, skill
documentation, analysis and code-synthesized music are MIT. No new external
sample, speech API or permission is required.
