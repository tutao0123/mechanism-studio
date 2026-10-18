# Complete WOLF tour — one continuous original score

This edition extends Mechanism Studio's gentle original music into one complete
128-beat arrangement. The whole assembly, motor, single magnet, bearing, one
small bearing source part, and final reassembly share a single PCM clock.
It does not join or repeat previously exported videos or their soundtracks.

The warm pad, felt-style key, bass and editorial-air synthesis methods come from
the established motor edition. `engine.mjs` adapts those pure original methods
to the complete tour length and two reading windows. Existing motor and bearing
files are unchanged. WAV encoding and measurement reuse existing pure helpers.
Original composition, code and generated WAV are MIT licensed. No third-party
samples, voice services, paid calls, credentials or downloads are involved.

From the Mechanism Studio project root:

```sh
node examples/wolf-actuator/tour/audio/build.mjs
node --test examples/wolf-actuator/tour/audio/audio.test.mjs
```

The build reads the source scene index and `createWolfTourStory(index)`. It
writes `tour-loop.wav` here and `../music-score.json` beside the viewing page.

## Arrangement and motion

- 112 BPM transport with a gentle 56 BPM feel; 128 beats, 32 bars,
  68.57142857142857 seconds.
- One 44.1 kHz stereo PCM16 buffer: 3,024,000 frames, 12,096,044 bytes.
- Overlapping pads and room reflections span scene changes and wrap only at
  the full-tour loop boundary. The second half develops the first half's harmony.
- The two actual inspection-out/return event pairs define smooth quieter
  reading windows. No narration, drum bed, label dings or scene audio restart.
- Soft slide textures follow actual large-component movement. Each repeated
  family receives one continuous sweep per direction, aggregating its four
  source-bound angular batches; there is no click per small piece.
- Sparse gentle accents mark selected completed returns. The motor-to-bearing
  camera handoff is supported by the composition, without inventing a hardware
  event or impact sound.

Sounds are editorial accents, not recordings or simulations of actuator noise,
magnetic force, bearing rolling, friction, contact or load. Generic source names
remain generic; no sound cue supplies missing engineering evidence.

## Verification

The score records final global event IDs, real occurrence IDs, exact movement
windows, deterministic seeds, notes, reading automation, file SHA256, peak, RMS,
chapter energy, clipping and loop continuity. Tests rebuild the complete PCM,
compare its digest, check a continuous midpoint rather than duplicated halves,
and verify both quieter inspection windows. Objective checks do not claim a
subjective listening review. Audition the actual page and final encoded output
for that separate judgment.
