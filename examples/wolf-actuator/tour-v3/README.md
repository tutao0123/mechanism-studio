# WOLF: inside one tooth interface

The complete WOLF tour now approaches one actual sun–planet pair, follows its
meshing region while the gears move, and pulls back to the full gear train.
The film retains the existing magnet and bearing close-ups, full reassembly,
white fine-line rendering, large atlas-style typography and gentle original
music. Its authored duration remains **85.714286 seconds: 160 beats at 112 BPM**.

## Run locally

From the Mechanism Studio root, build the shared deterministic music once on a
fresh checkout, then start the WOLF server:

```powershell
node examples/wolf-actuator/tour-v2/audio/build.mjs
node examples/wolf-actuator/serve.mjs
```

Open [`/tour-v3/`](http://127.0.0.1:4181/tour-v3/) and choose **Play with music**.
Add `?clean=1` to hide controls. The default port is 4181; use the port printed
by the server if `PORT` is overridden. The
[local video review page](http://127.0.0.1:4181/tour-v3/review.html) targets the
separately generated `output/wolf-mesh-closeup-86s-v3.mp4` when present.

The page loads the **same v2 WAV and score**, rather than synthesizing a new
arrangement. Source WAV SHA-256:
`6f1afefecdcd9229fe7f80ec024b0c0d90d63c12df97398fe01279c4f0885513`.
The generated WAV and local MP4/capture evidence are excluded from the source
release. A fresh GitHub checkout therefore needs the music build above and a
separate capture/export to obtain a video file.

## The new gear close-up

The selected pair consists of the retained source occurrences:

| Member | Source occurrence |
| --- | --- |
| `sun-gear` | `occ-b352183e1bd0-root-953098-767` |
| `planet-4` | `occ-b352183e1bd0-root-953098-774` |

The camera frames the selected planet and a local portion of the sun. Their
actual geometry, source placements, tooth phases and mesh scales remain intact.
The presentation retains all 245 source leaves and the existing v2 mechanical
ownership; only observation framing, contextual visibility and the chapter
caption change.

| Tour beats | Observation |
| --- | --- |
| 20–25 | The gear train returns to its assembled meshing positions and establishes the overall layout. |
| 25–28 | The camera approaches the chosen sun–planet interface. |
| 28–36 | The camera maintains a fixed magnification and follows that pair's known orbital path as the teeth move. |
| 36–39 | The camera pulls back to the overall gear view. |
| 39–44 | The established gear passage completes its hand-off into the motor teardown. |

Unused gear context fades between beats 24.5–25.75 and returns between
38.5–39. Visibility changes reveal the same assembled mechanism; they do not
change mechanical results or establish a physical removal sequence. Mechanical
input, return phases, motion-event times and all other chapters are inherited
unchanged from [tour v2](../tour-v2/README.md).

The macro uses a slightly more oblique approach, approximately 41° from the
source shaft axis, compared with approximately 24° in the overview. Its direction
is the normalized combination `0.80 × axis + 0.40 × radialU + 0.56 × radialV`.
This reveals the wider middle tooth row that meshes with the sun; the planet's
narrower end rows mesh the fixed toothed plates.

The camera target is an **ideal pitch-region anchor**: 0.8 times the selected
planet's radial center distance, at world Y=0.004 m, rotated by the existing
planet-center orbit angle. The factor follows the measured 96:24 tooth counts.
It is an observation target, not a measured contact point. The camera does not
track an individual rotating tooth or refit changing bounds on every frame.
Fixed magnification and an analytic orbital target prevent repeated auto-fit
changes. The [source sightline audit](research/mesh-closeup-audit.md) documents
candidate selection; that initial diagnostic used the earlier overview direction
and is not a claim of final screen visibility.

## Mechanical evidence and limits

This edition reuses the [v2 gearing adapter](../tour-v2/gearing.mjs),
[bearing adapter](../tour-v2/bearings.mjs) and their existing evidence. Measured
source sections contain 96 sun teeth, 24 teeth per planet section, 144 teeth in
the central output rings and 156 in the fixed plates. For sun angle `s`, the
ideal increments are:

```text
planet-center orbit =  8s/21
absolute planet spin = -44s/21
output rotation      = -2s/63
```

These counts imply a **reverse 31.5:1 reduction for the retained CAD**. The
upstream README states **34:1**; that discrepancy remains unresolved. See the
[gear evidence](../tour/research-v2/gear-evidence.md) and
[independent section/phase audit](../tour/research-v2/audit-transmission.md).
The close-up adds no tooth-contact or force solver. Sampled source sections and
consistent ideal kinematics do not certify continuous 3D contact, backlash,
manufacturing tolerance, torque, load capacity or collision-free disassembly.

The inherited bearing passage retains the verified crossed-roller identities
and ideal no-slip model. During gearbox operation both bearings follow the
calculated output. Its later isolated bearing demonstration has its own authored
outer-race input. The ideal model neglects the generator's 10 μm rolling
clearance and elastic deformation; its limits are recorded in the
[bearing evidence](../tour/research-v2/bearing-evidence.md).

## Runtime and validation

- [`story.mjs`](story.mjs) adds the selected pair, macro interval and context fade
  while inheriting the full v2 mechanics and teardown timeline.
- [`framing.mjs`](framing.mjs) computes the fixed-scale orbital focus and smooth
  approach/return. Source geometry and mechanical poses remain separate.
- [`app.mjs`](app.mjs) binds these presentation adapters to the shared viewer,
  existing source asset, v2 annotations, mechanical rig and original music.

Run focused checks from the repository root:

```powershell
node --test examples/wolf-actuator/tests/tour-v3.test.mjs
node --test examples/wolf-actuator/tests/tour-gearing-v2.test.mjs examples/wolf-actuator/tests/tour-bearings-v2.test.mjs examples/wolf-actuator/tour-v2/audio/audio.test.mjs
```

The new checks compare the v3 timeline and working states with v2, inspect the
selected real occurrence, and sample camera framing, transitions and recovery.
They are separate from browser occlusion review, encoded-video review and
subjective listening. A 30 fps export uses 2,572 sequential frames for a
85.733333-second MP4; the sub-frame end padding does not respeed the source music.
See the [local capture and encoding workflow](../../../tools/video/README.md).
The October 18, 2026 local delivery is `output/wolf-mesh-closeup-86s-v3.mp4`:
1920 × 1080, 30 fps, H.264/AAC, 85.733333 seconds, 28,130,630 bytes.
SHA-256: `f1117552d9eccab2f45f6a8c136b01959deaa51bf69ca0827a37c97a2e184e26`.
The changed passage was recorded again; unchanged scenes retain their verified
v2 frames. The replacement boundaries match the previous JPEGs exactly. The
whole new MP4 was encoded, decoded and played through its loop boundary:
2,572 native frames, zero dropped or corrupted frames. Encoded close-ups were
visually reviewed at 640 and 960 pixels wide. Local capture and delivery records
are in `output/capture-review.json` and `output/delivery-review.json`; they are
ignored outputs, not included in a fresh checkout. Technical sound verification
was performed; no new subjective listening review is claimed.

## Source, older editions and licenses

The [v2 motion tour](../tour-v2/README.md),
[v1 complete tour](../tour/README.md), [motor cut](../detail/README.md) and
[bearing cut](../bearing/README.md) remain available with their existing local
recordings. This is a further presentation of the same pinned source assembly.

WOLF and modular-bearing are by **Anthrobotics and contributors**. The retained
[WOLF source revision](https://github.com/Anthrobotics/wolf-actuator/tree/776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea)
and [modular-bearing generator](https://github.com/Anthrobotics/modular-bearing/blob/2b63192188d81eea663c04e5a2b98c44d60186f2/ModularBearingGenerator.scad)
support the source evidence. Geometry, source-derived observations and adapted
visual media retain **CC BY-SA 4.0**. Preserve the
[source notice](../source/NOTICE.md), [provenance](../source/provenance.json) and
[source license](../source/LICENSE); the upstream project credits Robin Fröjd's
RFX gearbox as inspiration. Mechanism Studio's original code, analysis and
code-synthesized music are MIT. No external samples or speech APIs are needed.
