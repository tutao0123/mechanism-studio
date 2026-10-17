# Humanoid score and sound effects

**Anatomy of a Humanoid** is a gentle original score for the Unitree G1 presentation: 108 BPM with a 54 BPM half-time feel, 64 beats, **35.555555556 seconds**, and exactly **1,568,000 stereo frames at 44.1 kHz**. Soft sustained chords, warm bass and sparse felt keys leave space around the mechanical details. There are no drums or narration.

```sh
node examples/humanoid/audio/build.mjs
node --test examples/humanoid/tests/audio.test.mjs
```

`build.mjs` loads the real source-body index, validates the eight movement groups against `story.mjs`, checks each CC0 input hash, renders the shared PCM timeline, and writes `humanoid-loop.wav` and `music-score.json`. No external service, credentials or downloaded program is executed.

## Timing

All actions and sounds use `seconds = beat * 60 / 108`. Separation begins at beats 8, 10, 12, 14, 16, 18, 20 and 22. Reassembly reverses the group order at beats 42 through 56; each movement lasts 1.4 beats. The score records all group bindings and retained source body IDs, including silent actions.

Four separation starts, four return starts and three final seatings receive a subtle [Kenney CC0 cue](sfx/README.md). These are attenuated by 26 dB against the music's pre-mix peak reference, with soft envelopes and no per-sample normalization. Each reading scene gets only one quieter tick, 1.05 seconds after its start; subsequent retained names stay silent. Completion at beat 58 gets one quiet confirmation. These are editorial sounds, not recorded or simulated actuator/contact acoustics.

## Loop and evidence

The synth uses a fixed seed and circular note/reverb tails. Music is set to a −10 dBFS sample peak before the sparse effects; a −8 dBFS final guard prevents accidental over-level output. The build rejects clipping, inappropriate RMS range and an excessive loop-boundary step. Tests check exact duration, actual source-group timing, unmodified input hashes, quiet reading sections and byte-for-byte reproducibility of the delivered WAV.

`music-score.json` stores the seed, composition events, original geometry/story revisions, precise cue times, third-party input hashes, final digest and waveform analysis. Automated measurements do not constitute subjective listening; that review remains separately recorded by whoever performs it.

Original composition and synthesis code use the project's MIT license. The five Kenney files retain **CC0-1.0**, their source provenance and upstream license. The mix does not relabel those samples as original Mechanism Studio recordings. See [sound-library research](../../../docs/sound-libraries.md).
