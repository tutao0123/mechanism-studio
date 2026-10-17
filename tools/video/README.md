# Local short-clip encoding

`export.mjs` turns already captured JPEG frames and an original music track into a
reviewable MP4. It does not capture a browser, run a browser automation library,
upload files or publish posts. Node.js 20.10+ and FFmpeg/FFprobe on PATH are required.

Run from the Mechanism Studio root:

```powershell
node tools/video/export.mjs --frames examples/wolf-actuator/output/frames --audio examples/wolf-actuator/audio/wolf-loop.wav --out examples/wolf-actuator/output/wolf-34s.mp4 --fps 30 --frame-count 1029 --width 1920 --height 1080 --title "Mechanism Studio — WOLF actuator"
```

Use the actual example and audio paths. Frames must start at `00000.jpg` (five
digits) or `000000.jpg` (six digits), with no missing numbered frames and exactly
the declared count. Every JPEG is checked for dimensions and structural markers;
FFmpeg then decodes the complete sequence while encoding. Capture the full page
through the approved browser tools so SVG annotations, English captions and source
attribution are included. A canvas-only export omits the surrounding DOM.

Check a real opening frame and an expanded frame before a full recording. Correct
pixel dimensions alone do not prove the browser captured its whole CSS viewport;
inspect title, bottom chapter text and credit as well as the geometry. The encoder
cannot infer that a correctly sized image contains a cropped browser surface.

Use a deterministic, sequential capture clock, not real-time screen recording or a
loop of force-cut seek calls. In an opt-in capture mode, stop the live RAF/audio
transport and pass `frameIndex / fps` through the same camera, appearance, animation
and annotation update path. The browser's processing speed must not change motion.

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
