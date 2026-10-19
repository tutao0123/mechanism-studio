# Transmission / Revealed

A separate **24-second cinematic edition**, composed directly at **1920 × 1080,
30 fps**. It takes the original gearbox from a complete assembly through an
exploded view, the power path, a synchronizer close-up and full reassembly.
English titles and an original instrumental score share the same timeline.

This is an optional presentation example. The [40-second white atlas study](../README.md)
remains available, and the cinematic treatment does not change Mechanism
Studio's default white-background, fine-line style.

## What changes

| Layer | Cinematic edition |
| --- | --- |
| Materials and light | Procedural PBR steel, bronze and graphite finishes; filtered machining grain; warm key light, cool rim light and a procedural studio environment |
| Camera | Perspective close-ups on a C1 path: position, target and field of view have continuous first derivatives, including the loop seam |
| Mechanical motion | The original working poses, part identities, gear ratios and synchronizer sequence; a continuous remap runs the rotating interval at 1.5× |
| Power emphasis | A restrained emissive accent follows the original model's active power-path IDs and transition weights |
| Typography | Large English Canvas titles and subtitles, a fixed identity strip and a progress line |
| Audio | 24 seconds / 48 beats at 120 BPM: sub-bass pulse, airy plucks, suspended chords and sparse action cues |

The model is the repository's **original MIT-licensed teaching gearbox**. It is
not an imported commercial CAD assembly or a validated real gearbox. PBR
finishes are visual choices, not verified engineering material grades; the
power highlight is an explanatory cue, not a measured torque or heat map. The
original [mechanical limitations](../README.md#limitations) still apply.

## Play locally

From the Mechanism Studio root:

```sh
npm ci
node examples/gearbox/cinematic/audio/build.mjs
node examples/gearbox/serve.mjs
```

Open [the live cinematic model](http://127.0.0.1:4183/cinematic/) and click
**Play with music**. Pause, restart and the time slider support replay and
inspection. Playback follows the native audio clock. The soundtrack must be
built locally; see [audio/README.md](audio/README.md) for its exact event
bindings, synthesis parameters, file hash and measured headroom.

After generating the MP4, open
[the encoded-film review page](http://127.0.0.1:4183/cinematic/review.html).
Its route is `/cinematic/review.html`; it loads
`examples/gearbox/output/gearbox-cinematic-24s-v1.mp4`. The review page does not
generate that file. It offers authored-speed playback, looping and a narrower
review width. The original white atlas edition is linked from both pages.

## Compose frames directly

Open [the render workspace](http://127.0.0.1:4183/cinematic/render.html). A fixed
1920 × 1080 engine document renders the mechanical model into WebGL. Canvas 2D
then composes those pixels with the vignette, titles, captions and
credit into the final frame. The WebGL drawing buffer uses a fixed pixel ratio
of 1, independent of the surrounding window's size and display scale.

This is direct **WebGL + Canvas frame composition**, not browser-window
recording or screenshot capture. It has its own compositor; it does not use
the atlas shell's SVG/HTML adapter. Browser processing time does not advance
the film: each frame receives an explicit authored timestamp.

The workspace exposes this API:

```js
await cinematicFilm.ready;
await cinematicFilm.start();
for (let index = 0; index < 720; index++) {
  const jpeg = await cinematicFilm.frame(index / 30);
  // The local driver must decode this JPEG data URL and save it as
  // output/cinematic-v1/frames/00000.jpg … 00719.jpg before continuing.
}
cinematicFilm.stop();
```

The API returns JPEG data URLs; it does not write files or publish media. A
local caller supplies file persistence. Await frame requests in order and
save every returned frame. The last sample is at 23.966667 seconds; 720 frames
at 30 fps encode exactly 24 seconds. Do not replace sequential rendering with
real-time playback recording or discard inconvenient frames.

Inspect an opening frame and a moving/detail frame before a complete render.
Check the static identity strip in all 720 source frames with an approved first
frame. This edition's fixed header occupies the top 80 pixels:

```sh
node tools/video/check-static-region.mjs --frames examples/gearbox/output/cinematic-v1/frames --reference 00000.jpg --x 0 --y 0 --width 1920 --height 80 --max-mae 1 --out examples/gearbox/output/cinematic-v1/static-region-check.json
```

Investigate a failure before encoding. A pass checks the selected static
region's consistency; it cannot establish that moving gears, shadows or
transitions look correct.

## Encode and review

With all 720 JPEGs and the rebuilt score available, run:

```sh
node tools/video/export.mjs --frames examples/gearbox/output/cinematic-v1/frames --audio examples/gearbox/cinematic/audio/gearbox-cinematic-loop.wav --out examples/gearbox/output/gearbox-cinematic-24s-v1.mp4 --fps 30 --frame-count 720 --width 1920 --height 1080 --title "Mechanism Studio — Transmission / Revealed"
```

The shared exporter requires FFmpeg and FFprobe on PATH. It checks frame count,
dimensions, duration and full decoding, and produces an H.264 MP4 with AAC
music, a contact sheet and a verification JSON. Its export-only audio master
targets −20 LUFS; the original WAV remains unchanged. See the
[video tool instructions](../../../tools/video/README.md) for validation,
normalization and explicit overwrite behavior.

Frames, MP4s, contact sheets and verification reports under `output/` are
generated local artifacts excluded from Git. Rebuild them from the retained
model, timeline, renderer and score source.

Final encoded-film playback and listening review are still required. This
README does not certify the final MP4 as reviewed. Watch the full loop at
authored speed and a phone-sized display width, checking tooth motion, macro
framing, text readability, fades and the loop seam; listen to the actual muxed
track and check cues against visible actions. A contact sheet or successful
automatic report is not a substitute for that review.

## Source and focused checks

| File | Responsibility |
| --- | --- |
| [`timeline.mjs`](timeline.mjs) | 24-second shots, continuous source-time remap and exact inverse mapping of mechanical events |
| [`camera.mjs`](camera.mjs) | Fixed authored perspective poses and a continuous Hermite camera path |
| [`renderer.mjs`](renderer.mjs) | PBR finishes, lighting, original assembly bindings and direct fixed-buffer WebGL rendering |
| [`app.mjs`](app.mjs) | Audio-clock playback, source mechanics, power-path weights and Canvas graphics |
| [`render.mjs`](render.mjs) | Sequential frame API in the fixed engine document |
| [`audio/build.mjs`](audio/build.mjs) | Deterministic instrumental synthesis and real-part cue bindings |

```sh
node --test examples/gearbox/cinematic/timeline.test.mjs examples/gearbox/cinematic/camera.test.mjs
```

The focused tests cover source-order preservation, mechanical event timing,
bounded gear/spline sampling at 30 fps, finite camera poses, camera continuity
and the loop seam. The [original gearbox tests](../README.md#evidence) remain
the evidence for its authored geometry and ideal kinematics. Neither set
validates manufacturing tolerances, loaded tooth contact, collision-free
service disassembly or real hardware performance.

Original code, teaching model and synthesized score: MIT, © Mechanism Studio
contributors. Third-party dependencies retain their own licenses in the
repository's notices.
