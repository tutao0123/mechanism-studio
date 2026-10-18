# WOLF: from whole to detail

A **68.571429-second**, 112 BPM English tour in one original 245-leaf WOLF scene.
Open `/tour/` on the WOLF preview server and choose **Play with music**.
Use `/tour/?clean=1` for the unobstructed visual presentation; it hides the controls.
`window.wolfCompleteTour` exposes the same pause, seek and deterministic capture
interface as the component studies. Existing motor and bearing editions remain.

| Tour beats | Observation |
| --- | --- |
| 0–20 | Original actuator, then staged whole-level expansion. |
| 20–28 | One illustrative input turn, completed by beat 26 before camera hand-off. |
| 28–66 | Motor components, one original magnet in close-up, local reassembly. |
| 66–72 | Wide transfer toward bearing A. |
| 72–110 | Bearing layers, original Part 1 in close-up, local reassembly. |
| 110–128 | Whole-level reassembly and the matching opening pose. |

This is not joined recordings. One audio buffer and one timeline compute the
working poses, nested display offsets, context opacity, camera, captions and
annotations. Motor and bearing choreography reuse their tested source bindings
through an explicit piecewise beat mapping. Both macro scenes receive eight
beats, with readable settled labels. Local offsets compose with the persistent
whole-level offsets, then convert through the actual source-parent matrices.
The motor is locally restored at beat 66; bearing A at 110. Whole offsets reach
exact zero by 122, and the final view matches the initial one.

The two focus subjects remain the same original occurrence: motor magnet
`…-1010-926` and bearing **Part 1** `…-923-922-864`. No clone, enlarged mesh,
replacement geometry or inferred bearing role is introduced. The bearing contains
70 real leaves; the motor contains 86. Generic `cc` and `Part N` names are retained.

The input turn is deliberately labelled **illustrative**. The retained assembly
manual supports sun-to-motor and encoder-holder-to-nut attachments. Co-rotation
of the selected 46 source pieces is an explicitly authored teaching linkage,
not recovered STEP mates. The stator, mount, generic `cc` pieces, planets, rings
and bearings do not acquire inferred transmission motion. See
[motion evidence](motion-evidence.md) and its [bound record](motion-evidence.json).
There is no contact, signed 34:1 gearing, dynamics, torque or load calculation.
Source/rest transforms remain static and immutable; the runtime rig owns only
the separate model wrappers, with display offsets applied afterward.

Framing includes the source bounds, whole/local/focus paths and the rig's analytic
rotation envelope. Camera motion follows a selected source part while wide,
then magnifies; it widens before transferring back to the assembly. Nonfocus
context fades before tight input/macro views. Reduced motion uses fixed wide
views and a real, readable fixed macro. Names appear only after the camera and
labelled target settle. The shared capture typography preserves the white-line,
serif atlas style at social-feed viewing sizes.

The original score in `audio/tour-loop.wav` is one new 128-beat rendering, with
two quieter reading windows and source-ID-bound movement accents. It contains
no narration, recordings or assembled PCM segments. Effects are editorial sound
design, not measured hardware acoustics.

```powershell
node examples/wolf-actuator/tour/audio/build.mjs
node examples/wolf-actuator/tour/build-plans.mjs
node --test examples/wolf-actuator/tests/tour.test.mjs examples/wolf-actuator/tests/tour-kinematics.test.mjs examples/wolf-actuator/tour/audio/audio.test.mjs
node examples/wolf-actuator/serve.mjs
```

WOLF by Anthrobotics and contributors, pinned revision
[776a5654](https://github.com/Anthrobotics/wolf-actuator/tree/776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea),
retains **CC BY-SA 4.0** attribution and share-alike terms for its geometry and
adapted presentation. See [provenance](../source/provenance.json),
[license](../source/LICENSE) and [notice](../source/NOTICE.md). The upstream
project credits Robin Fröjd's RFX gearbox as inspiration. Mechanism Studio adds
source-bound illustration, camera, line rendering, annotations and original music.
Editorial explosion is not a validated disassembly path. Tests and bounds do not
replace browser or encoded-video review; recorded media and QA are local outputs.

The local complete-film edition is `output/wolf-complete-69s-v1.mp4`:
1920 × 1080, 30 fps, 2,058 frames, 68.6 seconds, with H.264 video and AAC music.
Open [`review.html`](review.html) to play it. Its frame sequence, source hashes,
encoding verification, contact sheet and viewing checks live in `output/` and
are excluded from repository publication. The earlier component videos remain.
