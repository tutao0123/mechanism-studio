# Complete WOLF tour v2 — original music

This edition extends the existing gentle score to 160 beats at 112 BPM: exactly 3,780,000 stereo PCM frames at 44,100 Hz, or 85.714285714 seconds. It reuses the previous tour's synthesis engine, instruments, harmonic vocabulary and restrained mix. Four additional eight-beat phrases give the two new mechanical views space; the ending still resolves to the original D palette.

`tour-loop.wav` is one deterministic continuous arrangement, with room tails carried across scene changes. The two source-part close-ups use smooth level reductions. Movement textures and sparse return accents bind directly to the current story's source-identified motion events. Gear and bearing rotations receive music without fabricated recordings of tooth contact or rolling friction.

Rebuild from the project root:

```sh
node examples/wolf-actuator/tour-v2/audio/build.mjs
node --test examples/wolf-actuator/tour-v2/audio/audio.test.mjs
```

The score, code and synthesized sounds are original Mechanism Studio work under MIT. No external samples, speech services, credentials or paid APIs are used. The WOLF geometry and derived visual media retain their separate CC BY-SA attribution requirements. Audio checks cover duration, binding, digest, peak/RMS, macro levels and loop continuity; these checks do not claim a subjective listening review.
