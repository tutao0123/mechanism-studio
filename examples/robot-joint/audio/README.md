# Joint / Connected Motion

Original music for the robot joint's **36-second, 60-beat** loop. The score runs at **100 BPM**, with a quieter 50 BPM half-time feel: sustained chords, sparse rounded keys, a restrained bass pulse and a few soft synthesized action cues. There is no narration or external recording.

From the repository root:

```sh
npm run studio -- generate robot-joint
# Music alone, after the model's scene index exists:
node examples/robot-joint/audio/build.mjs
```

The build writes `joint-loop.wav` and `music-score.json` in this directory. The WAV is an ignored local output; the synthesis source and metadata are retained. Unified preview and export also prepare the registered score. A browser needs **Play with music** to enable audio; silent viewing remains available.

## Timing and provenance

[`synth.mjs`](synth.mjs) defines the composition and deterministic seed, using the shared MIT oscillator/noise renderer in `tools/audio/study-score.mjs`. It produces 44.1 kHz, stereo, 16-bit PCM. Every sample is synthesized from code; no downloaded sound library, music service, speech model or API key is used.

[`choreography.mjs`](../choreography.mjs) supplies the final action cues and actual occurrence IDs. The score records the geometry revision and story revision; the builder verifies that the music and story share their duration and musical grid. Quiet reading windows sit inside the motor, gear and bearing chapters. Release, movement, detail and seating cues are editorial accents, not recordings or predictions of physical machine sounds.

## Numerical checks and listening

The audio builder measures the rendered signal and encoded PCM, checks clipping, bounds peak/RMS levels and checks the loop seam. Metadata retains the output digest, length, cue bindings and measurements. These objective checks do not establish subjective balance or listening quality; the score explicitly keeps listening review separate.

When retiming the film, update the authored chapter/action timings and score together, then regenerate and review the full loop. Playback speed is not a substitute for a newly timed composition.

Original composition and synthesis code: [MIT](../../../LICENSE), © Mechanism Studio contributors.
