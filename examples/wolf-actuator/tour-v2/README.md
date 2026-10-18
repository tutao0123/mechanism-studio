# WOLF: teeth, rollers, and the complete assembly

An **85.714286-second English tour**, 160 beats at 112 BPM, built around the same
245 original source leaves. This edition adds source-derived gear and bearing
motion to the complete assembly → magnet → bearing → reassembly sequence. The
white fine-line rendering, smooth camera language, large capture typography and
gentle original code music continue from the earlier film.

On a fresh checkout, build the deterministic music once, then start the WOLF
server from the repository root. The generated 15 MB WAV stays local to keep
the source release within its existing size budget:

```powershell
node examples/wolf-actuator/tour-v2/audio/build.mjs
node examples/wolf-actuator/serve.mjs
```

Open [`/tour-v2/`](http://127.0.0.1:4181/tour-v2/) and choose **Play with music**.
`?clean=1` hides the controls. The default server port is 4181; use the port
printed by the server when `PORT` is overridden. The
[video review page](http://127.0.0.1:4181/tour-v2/review.html) plays the separately
generated local MP4 when present.

The local October 18, 2026 delivery is `output/wolf-motion-86s-v2.mp4`:
85.733333 seconds, 1920 × 1080, 30 fps, H.264/AAC, 27,057,439 bytes.
SHA-256: `22f8af47aaf3a671fd3c255f13e17eeaa0e1985ace8d54edc24ff693e587ea5a`.
The complete web loop and all 2,572 encoded video frames were checked; native
playback reported zero dropped or corrupted frames. Encoded 640-pixel-wide
gear, bearing and both focus views were visually inspected. The local
`output/delivery-review.json` records the checks and their limits. Technical
audio validation was performed; no subjective listening review is claimed.
The MP4 and capture evidence remain ignored local outputs and are not bundled
with a fresh GitHub checkout.

| Tour beats | Observation |
| --- | --- |
| 0–20 | Whole actuator and staged expansion. |
| 20–44 | Source gears return to their meshing positions, move slowly forward and back, then reopen for the motor hand-off. |
| 44–82 | Motor layers, one original magnet in close-up, local restoration. |
| 82–88 | Wide camera transfer toward bearing A. |
| 88–104 | Internally assembled bearing: the outer race turns, the cage orbits and the crossed rollers spin, then return to their original phase. |
| 104–142 | Bearing layers, the original roller `Part 1` in close-up, local restoration. |
| 142–160 | Complete actuator reassembly and the matching opening view. |

During the gear passage, both bearings follow the calculated gearbox output.
The bearing close-up is a separate, isolated demonstration: bearing A receives
an independent outer-race input of 60° forward and back while the gearbox is
at rest. Its speed is not presented as a continuation of the gearbox output.

The operating passages use the same deterministic time source as the music,
camera, captions and teardown. Mechanical poses return to zero before parts
separate. Bearing geometry stays internally assembled while operating; selected
race/context visibility changes reveal the motion. Transparency is a viewing
choice, not removal of a load path. Every extracted focus object remains its
actual source occurrence, with no enlarged replacement mesh.

## What the source supports

The retained assembly manual establishes fixed front/back plates, a motor-driven
sun, planets meshing with both the toothed plates and central rings, and two
output supports keyed to the central rings and bolted together. Independent
section measurements of the retained geometry identify:

| Member | Teeth |
| --- | ---: |
| Sun | 96 |
| Each planet, middle and end sections | 24 |
| Central output rings | 144 |
| Fixed toothed front/back plates | 156 |

For sun angle `s`, the ideal source-derived angle increments are
`orbit = 8s/21`, `planet spin = −44s/21`, and `output = −2s/63`.
The orbit coordinate does not add an invented physical carrier. These counts
give a **reverse 31.5:1 reduction for this retained CAD**. The upstream README
states **34:1**; that discrepancy remains unresolved. This version follows the
measured geometry and discloses the mismatch instead of forcing the published
number. Original tooth phases and source identities remain intact.

See the [gear evidence](../tour/research-v2/gear-evidence.md),
[independent section/phase audit](../tour/research-v2/audit-transmission.md), and
[primary WOLF source revision](https://github.com/Anthrobotics/wolf-actuator/tree/776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea).

The [pinned modular-bearing generator](https://github.com/Anthrobotics/modular-bearing/blob/2b63192188d81eea663c04e5a2b98c44d60186f2/ModularBearingGenerator.scad)
and its assembly instructions agree with the retained source geometry: **66
rollers per bearing**, 88.25 mm pitch radius, 5.98 mm modeled roller diameter,
5.50 mm length and alternating 45° axes. Shape measurements and the generator
positively identify `Part 59` as the inner race, `Part 69` as the outer race,
`Part 62` as the cage, and the small `Part N` leaves—including `Part 1`—as rollers.
The presentation uses explanatory aliases while preserving those source names.
The outer race remains one source occurrence; no independent halves are invented.

The ideal bearing model enforces no slip at two nominal contacts. With the inner
race fixed, the cage angle is `0.5119787494 × outer angle`, and each roller's
spin relative to the cage frame is `14.7490548287 × outer angle`. Alternating
tilted axes are retained. The source specifies **10 μm rolling clearance**;
this ideal model neglects that clearance and elastic deformation. See the
[bearing evidence and derivation](../tour/research-v2/bearing-evidence.md) and
[geometry bindings](../tour/research-v2/bearing-bindings.json).

## Runtime ownership and checks

- [`gearing.mjs`](gearing.mjs): `createWolfGearRig(index)` exposes
  `posesForAngle`, `worldMotionsForAngle`, `coordinatesForAngle` and
  `boundsAtAngle`. It owns 62 source leaves: 46 input members, 12 planets and
  four output rings.
- [`bearings.mjs`](bearings.mjs): `createWolfBearingRig(index)` exposes
  `posesForAngles`, `worldMotionsForAngles`, `boundsAtAngles` and
  `contactResiduals`. It owns 138 source leaves: inner/outer race, cage and
  66 rollers on each side. The gearbox-owned output supports are excluded.
- [`story.mjs`](story.mjs) schedules the operating passages, teardown, source
  focus objects and exact returns. Mechanical world deltas are converted
  through actual source parent matrices; source rest transforms remain immutable.
  Display explosion is a separate channel.

The pose APIs include identity resets, so the caller combines only each rig's
declared `ownedIds`. Seeking computes poses directly from angles. Forward/reverse
demonstrations return all occurrences to zero; one outer-race revolution would
not reset the individual cage and roller phases.

```powershell
node examples/wolf-actuator/tour-v2/audio/build.mjs
node examples/wolf-actuator/tour-v2/build-plans.mjs
node --test examples/wolf-actuator/tests/tour-gearing-v2.test.mjs examples/wolf-actuator/tests/tour-bearings-v2.test.mjs examples/wolf-actuator/tests/tour-v2.test.mjs examples/wolf-actuator/tour-v2/audio/audio.test.mjs
```

Tests cover tooth-count relations, actual occurrence ownership, source/parent
transforms, gear phase samples, independent finite-difference velocities at both
ideal bearing contacts, motion bounds, and exact restoration. The source bearings
contain embedded AP242 triangulations rather than analytic bearing solids. These
checks support an ideal kinematic illustration; they do **not** validate full
3D B-rep contact, recovered CAD mates, preload, backlash, collision-free teardown,
friction, torque, dynamics, stresses or service life. The internal motor rigid
group remains an explicitly authored mechanical interpretation.

## Sound, older editions and licensing

The [score](audio/README.md) extends the same original sound palette into one
continuous 160-beat arrangement. It uses no voice API or recorded hardware sound;
movement accents are editorial. Rebuild and audio checks are separate from
browser playback, subjective listening and encoded-video review.

The [69-second complete tour](../tour/README.md), [motor cut](../detail/README.md),
[bearing cut](../bearing/README.md), their local recordings and original source
assets remain available. This is another edition of the same WOLF source, not a
new imported assembly. MP4s, capture frames and media QA remain local ignored
outputs; GitHub source browsing does not play the page.

WOLF and modular-bearing are by Anthrobotics and contributors. Geometry,
source-derived observations and adapted visual media retain **CC BY-SA 4.0**;
preserve [source attribution](../source/NOTICE.md), [provenance](../source/provenance.json)
and [license](../source/LICENSE). The upstream project credits Robin Fröjd's RFX
gearbox as inspiration. Mechanism Studio's original runtime, analysis code and
code music are MIT. This local change does not imply an upload or publication.
