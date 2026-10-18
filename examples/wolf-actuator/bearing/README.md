# Inside a WOLF bearing

A separate **34.285714-second English component study** of the retained WOLF
`bearing-assembly-A <1>`. White surfaces, fine dark edges, quiet original music
and continuous framing follow the motor v2 presentation language. The motor
study remains available separately, including its newer video typography edition.

Open `http://127.0.0.1:4181/bearing/?clean=1` on the WOLF preview server, then
**Play with music**. The browser exposes `window.wolfBearingStudy`; deterministic
capture is available only with `?capture=1`.

## Actual source depth

The assembly is `occ-b352183e1bd0-root-953098-923`, STEP usage `#923`.
Its two original child assemblies contain **70 actual leaf occurrences**:

| Original source label | Leaves | Presentation |
| --- | ---: | --- |
| `outer-ring-A` | 1 | Separate original named outer ring. |
| `Part 59`, `Part 69`, `Part 62` | 3 | Three larger original components, separated axially. |
| Other original `Part N` labels | 66 | Small components revealed in four geometric angular sectors. |

The focused occurrence is the original **Part 1**,
`occ-b352183e1bd0-root-953098-923-922-864` (716 source-derived triangles).
Its source mesh is about 7 mm across. The same occurrence moves further outward,
receives a camera close-up, returns to its expanded ring, then joins reassembly.
There is no enlarged mesh, duplicate, replacement model or invented internal
cut. A generic source name does not establish whether that item is a ball,
roller, cage or other functional bearing part; no such role is asserted.

All **245 actuator leaf IDs**, original source parents and rest matrices remain
in the scene and complete display-offset map. Only the 70 selected bearing
leaves move. The other bearing assembly and motor are preserved as context.
Outside-bearing context fades during the approach. Nonfocus bearing components
remain faintly visible during the close-up and recover before reassembly.

## Timing and camera

Six chapters cover beats **0–6 / 6–16 / 16–28 / 28–38 / 38–60 / 60–64** at
112 BPM. Four larger parts have distinct intervals; 66 smaller occurrences are
sorted by their actual radial angle, then revealed in contiguous sectors.
The focus excursion occupies beats 28–30.5 and 35.3–38. All display translations
are exactly zero after beat 57.4 and at the loop boundary.

The camera uses the tested motor-v2 component choreography through a small
identity adapter in `framing.mjs`. This reuses framing logic, not motor geometry.
It follows the selected bearing component while the view is wide, then zooms;
on return it widens first and hands the target back to the assembly. Names only
appear while their target and camera are stationary. Reduced motion uses fixed
wide views during travel and a fixed, readable macro during the settled hold.

`MOTION_EVENTS` binds every action interval to actual occurrence IDs.
`audio/bearing-loop.wav` is a newly rendered original score; it is not the old
motor WAV with replacement metadata. One native audio clock or the matching
silent/capture time drives geometry, opacity, captions, camera and sound.

## Source, license and limits

WOLF is by Anthrobotics and contributors, at pinned revision
[776a5654](https://github.com/Anthrobotics/wolf-actuator/tree/776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea).
Original source geometry and this adapted component presentation retain
**CC BY-SA 4.0** attribution. See [source provenance](../source/provenance.json),
[license](../source/LICENSE) and [notice](../source/NOTICE.md). The upstream
project credits Robin Fröjd's RFX gearbox as inspiration. Mechanism Studio adds
source-bound observation offsets, framing, line rendering, annotations and music.

This is editorial disassembly, not a service sequence, clearance study or mate
solver. Geometry alone does not establish rolling contact, bearing constraints,
material, friction, force, preload, load ratings or dynamics. No physical bearing
rotation is invented. Bounds and automated tests do not replace browser review.

From the Mechanism Studio project root:

```powershell
node examples/wolf-actuator/bearing/audio/build.mjs
node examples/wolf-actuator/bearing/build-plans.mjs
node --test examples/wolf-actuator/tests/bearing.test.mjs examples/wolf-actuator/bearing/audio/audio.test.mjs
node examples/wolf-actuator/serve.mjs
```

The local video, captured frames and review evidence are generated outputs and
are not included by these builders. `plan.json` records timing, identities, path
extrema and the actual audio digest. Motion/hold diagnostics aid editing; they
are not a measure of physical realism or subjective animation quality.

## Video delivery

The local recording is `output/wolf-bearing-34s-v1.mp4` (1920×1080, 30 fps,
1,029 frames, 34.3 seconds). `/bearing/review.html` plays it after capture and
encoding; a fresh clone does not include the ignored MP4. The dedicated capture
profile uses 58 px main titles, 46 px chapter headings and 36 px captions and part
names. Ordinary interactive page typography is separate. The existing 34.285714
second score receives only 14.286 ms of end padding to match whole video frames.
