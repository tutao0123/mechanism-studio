# Kinetic score

`A Connected Gesture` is an independent original 48-beat composition for the kinetic robot cut. It keeps the previous 64-beat audio untouched. The opening motif, expansion build, sparse reading section and descending return provide phrase contrast at the same −8 dBFS sample peak ceiling. No voice service, external sample, recorded robot sound or drum bed is used.

From the Mechanism Studio root:

```sh
node EXAMPLE_ROBOT/kinetic/audio/build.mjs
node --test EXAMPLE_ROBOT/kinetic/tests/audio.test.mjs
```

The build reads the real retained `EXAMPLE_ROBOT/planning/scene-index.json`, validates it through `createKineticStory(index)`, then calls `createScore(story, index.geometryRevision)`. `renderScore(score)` returns stereo float channels; `encodeWav(audio)` produces PCM16 WAV. The generated score records source part IDs, group IDs, geometry and story revisions, exact beat times, frame rounding and SHA-256. The media clock is 112 BPM, 48 beats, 1,134,000 frames at 44.1 kHz: 25.714285714 seconds.

Eight air-motion cues follow the actual 1.25-beat outward/return moves; four soft seat cues mark display return completion. They are editorial accents, not evidence of contact, motors, collision or dynamics. Sustains and short room reflections wrap around the same buffer. Automated peak, waveform and seam checks do not replace a listening review.
