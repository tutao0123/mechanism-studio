# Local short-clip encoding

`export.mjs` turns already generated JPEG frames and an original music track into a
reviewable MP4. It does not capture a browser, run a browser automation library,
upload files or publish posts. Node.js 20.10+ and FFmpeg/FFprobe on PATH are required.

Run from the Mechanism Studio root:

```powershell
node tools/video/export.mjs --frames examples/wolf-actuator/output/frames --audio examples/wolf-actuator/audio/wolf-loop.wav --out examples/wolf-actuator/output/wolf-34s.mp4 --fps 30 --frame-count 1029 --width 1920 --height 1080 --title "Mechanism Studio — WOLF actuator"
```

Use the actual example and audio paths. Frames must start at `00000.jpg` (five
digits) or `000000.jpg` (six digits), with no missing numbered frames and exactly
the declared count. Every JPEG is checked for dimensions and structural markers;
FFmpeg then decodes the complete sequence while encoding. For supported study
pages, prefer **direct frame composition** with
[`shared/study/direct-frame.mjs`](../../shared/study/direct-frame.mjs): the WebGL
drawing buffer, styled SVG annotations/drafting and measured English text are
composed explicitly into a fixed-size 2D canvas. This does not record a desktop,
browser window or screenshot surface. Exporting only the WebGL canvas would omit
the annotations, captions and credit.

Check an actual opening frame and an expanded frame before a full render. Correct
pixel dimensions alone do not prove the frame contains its complete composition;
inspect title, bottom chapter text and credit as well as the geometry. The encoder
cannot infer that a correctly sized image contains cropped content. Check the
static title region on **every** generated frame using the gate below.

Use a deterministic, sequential capture clock, not real-time screen recording or a
loop of force-cut seek calls. In an opt-in capture mode, stop the live RAF/audio
transport and pass `frameIndex / fps` through the same camera, appearance, animation
and annotation update path. The browser's processing speed must not change motion.

## Direct frames from the study shell

The current adapter supports the **atlas study capture shell**. It checks the
known shell elements and rejects unknown visible layers, unsupported nested HTML,
blueprint title-block styling, scrolling or a changed CSS viewport. It is not a
generic HTML renderer. Use a fixed-size study document or same-origin iframe
opened with `?clean=1&capture=1`; keeping that iframe at the output CSS dimensions
isolates the layout from changes to the surrounding viewer window.

```js
import { createStudyFrameRenderer } from '/shared/study/direct-frame.mjs';

await studyApi.ready;
const renderer = createStudyFrameRenderer(studyApi, { width: 1080, height: 1080 });
for (let index = 0; index < 1200; index++) {
  const canvas = await renderer.render(index / 30);
  const jpeg = canvas.toDataURL('image/jpeg', 0.94);
  // The caller writes these JPEG bytes as 00000.jpg, 00001.jpg, …
}
renderer.dispose();
```

`render(t)` starts the study's deterministic capture clock once, samples it at
monotonically increasing times and returns its composed canvas. `restart()`
begins another sequence; `snapshot()` identifies the direct-composition revision,
fixed output, source buffer and current time. Render calls must be awaited in
order. The adapter obtains layout/style/fonts from the WebGL canvas's own
document, so the caller may live in a parent page. A hidden/offscreen document
still gets an explicit scene/feature-line/WebGL render.

The output dimensions are fixed pixels. The source canvas's actual drawing
buffer is mapped to CSS layout coordinates without assuming a host device pixel
ratio. SVG computed styles are inlined and rasterized without `foreignObject`;
HTML text uses the browser's actual `Range` line wrapping and Canvas font metrics.
System fonts must finish loading before the first frame. Helper tests cover
viewport invariants, line grouping and metric requirements. The atlas gearbox's
1080 × 1080 fixed-iframe path was also checked in the browser: styled names,
spec lines and dimensions rendered, a 120-frame moving excerpt passed the
static-region gate, and the same frame produced identical JPEG hashes with the
parent viewer at 1280 × 900 / DPR 1 and 390 × 844 / DPR 1.5. This verifies that
specific composition path, not every example or layout. Each new shell adapter
still needs its own browser smoke check and a complete final-video review.

```sh
node --test shared/study/tests/direct-frame.test.mjs
```

The frame count determines duration. 1,029 frames at 30 fps lasts 34.3 seconds. A
34.285714-second music loop needs only 14.286 milliseconds of silent padding at its
end. Inputs differing by more than one frame are rejected; the encoder never
respeeds the audio or hides a large timing mismatch. A slightly longer audio input
is trimmed only within the same one-frame tolerance.

All paths are project-relative. Their resolved paths and nearest existing ancestors
must remain in Mechanism Studio, including Windows junctions. Outputs must be in
an `output` directory. Existing MP4s, contact sheets and reports are preserved unless
`--overwrite` is explicitly supplied. Temp files and the normalized AAC master are
kept in a unique `.video-cache` folder beside the exported file for review.

The video is H.264 High/4.2, CRF 18, yuv420p, BT.709, with faststart. Dimensions must
be even, with at most 1920×1080 pixels; portrait is supported. Frame rates are 24,
25, 30, 50 or 60 fps. This tool handles clips up to 140 seconds; these are local
tool limits, not a statement of current platform upload limits.

The original audio is preserved. An export-only AAC-LC stereo master uses 48 kHz,
256 kb/s and two-pass normalization to -20 LUFS, with a -2.5 dBTP normalization
ceiling. The final AAC must measure at most -2 dBTP and within ±1 LU of the target.
Music and editorial action effects must already share the input track's timeline;
the encoder does not invent effects or create a second event clock.

Next to the MP4, the tool writes a twelve-image contact sheet and a verification
JSON with source/output hashes, tools, frame count, measured duration, full decode,
black-frame intervals, changing one-second samples, faststart, AAC packet
preservation and final loudness/true peak. Objective checks do not establish smooth
camera direction, correct labels, good music, source licensing or mechanical
validity. Visually inspect the sheet and clip, then listen to the actual file before
claiming those reviews. `subjectiveListeningReviewed` and
`contactSheetVisuallyReviewed` are deliberately false in the automated report.

Run focused checks with:

```powershell
node --test tools/video/export.test.mjs tools/video/integration.test.mjs
```

These tests use temporary folders under `output/video-tool-tests`; no browser,
credentials or network are involved. The integration test exercises the full
encoder with a two-second generated fixture; it skips if FFmpeg/FFprobe is absent.

## Check capture scale on every frame

Run `check-static-region.mjs` **before encoding** when the captured page has a
fixed title, logo or other distinctive region. A browser can intermittently
capture the page at the wrong CSS/device-pixel scale while still producing the
expected image dimensions. Those isolated zoom/crop frames are easily missed by
a contact sheet. The checker compares every frame's pixels in the chosen region
against an approved reference frame; it does not compare average brightness alone.

For the gearbox's 1080 × 1080 square layout, the top 125 pixels contain its static
title and eyebrow:

```sh
node tools/video/check-static-region.mjs --frames examples/gearbox/output/frames --reference 00000.jpg --x 0 --y 0 --width 1080 --height 125 --max-mae 1 --out examples/gearbox/output/static-region-check.json
```

Coordinates use captured image pixels. Select a **visually approved** reference
and a region containing stationary, high-contrast content throughout the entire
clip. A blank background cannot detect a scale change; moving captions, fading
text or rotating model parts do not make a valid reference region. A different
layout needs its own region. Review the actual reference framing first: an
entire sequence captured consistently at the wrong scale could pass this check.

The input is a contiguous sequence starting at `00000.jpg`, `000000.jpg`,
`00000.png` or `000000.png`; padding and extension must stay consistent. Every
image header is checked against the reference dimensions, then FFmpeg decodes
the complete sequence. The default threshold is **1 grayscale level of mean
absolute pixel error** on the 0–255 scale, allowing small JPEG differences.
An unchanged region normally measures zero. Do not raise the threshold merely
to accept an unexplained jump: investigate the affected frames first.

The JSON report records source/reference hashes, dimensions, every region's
error and `badFrameIndexes`. A failed comparison, dimension mismatch or decode
error exits with status **1**; a successful check exits **0**. Report paths must
stay in a project `output` directory, separate from the source frames; existing
reports require `--overwrite`. The checker never modifies the frames.

This is an explicit gate; `export.mjs` does not call it automatically. Stop the
export if it fails, stabilize the capture and recapture at the original timeline
times. Cropped content cannot be recovered by resizing the bad images, and
dropping frames changes the timing. A pass proves only consistency of the
chosen static region. Still watch the **entire encoded clip** for movement,
tooth shimmer, scene transitions and audiovisual timing.

```sh
node --test tools/video/check-static-region.test.mjs
```

The regression fixture includes an isolated 1.5× scale/crop error with unchanged
file dimensions, normal motion outside the checked region, PNG and JPEG input,
dimension changes and corrupt image data. It needs FFmpeg; integration cases
skip explicitly if FFmpeg is absent. No additional packages are required.

## README previews

`readme-preview.mjs` turns the same numbered frames into README-sized media:
an animated GIF, which GitHub renders inline from the repository, and a small
silent H.264 MP4 for places that accept video uploads.

```sh
node tools/video/readme-preview.mjs --frames examples/gearbox/output/frames --fps 30 --out examples/gearbox/output/gearbox-readme --gif-width 800 --gif-fps 15
```

`--start`/`--end` take an excerpt in seconds, and `--only gif|mp4` encodes one
format, so a short GIF excerpt and a full-length MP4 can come from one capture. The GIF keeps every n-th frame,
where n must divide the capture rate exactly, so motion stays evenly spaced; its
palette is built from frame differences. Size gates (`--max-gif-mb`, default 8;
`--max-mp4-mb`, default 4) fail with a concrete suggestion instead of shipping a
heavy README. The tool writes `<stem>.gif`, `<stem>.mp4` and
`<stem>-preview.json` (hashes, dimensions, decoded frame counts) inside an
`output` directory and refuses to overwrite without `--overwrite`.

It checks size and decoding only. Before publishing, watch the GIF at its README
width: fast gear teeth can strobe at low GIF frame rates, and small labels or
credits may become unreadable. Copy reviewed files into `docs/media/` and list
their terms in `docs/media/LICENSE.md`.
