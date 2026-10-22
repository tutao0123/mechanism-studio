# Planetary gears — original loop score

`Epicyclic / Common Motion` is an original 36-second, 100 BPM, 60-beat composition for the planetary study. Edition `planetary-quiet-motion-v2` retains the gentle white-line style while accommodating the expanded enclosure and detailed bearing assembly. Warm pads, sparse rounded keys and restrained bass leave quieter space for both the gear pair (15–19.2 seconds) and bearing parts (21–25.8 seconds). The motif returns during reassembly. There is no narration or external recording.

The v3 rolling-bearing update retains these exact PCM bytes (SHA-256 `04f5806626904907590d648b1f91bafe8cd136ef7214aba9927792a1120a824e`). The bearing chapter now continues to 27.6 seconds: its names and seating remain in the established quiet passage, then the same score accompanies working motion. The builder checks that reading windows remain inside their chapters, and tests bind actual name-reading intervals to the quiet score without retiming the music.

The example owns its notes, harmony and final action bindings in `synth.mjs`; it reuses the project's analytic oscillator, seeded-noise, circular-reflection and PCM encoder implementation in [`tools/audio/study-score.mjs`](../../../tools/audio/study-score.mjs). The original score and synthesis source follow the project's MIT license.

Build from the project root after generating the planetary geometry:

```sh
node examples/planetary-gears/audio/build.mjs
```

The build loads the actual scene index and shared `choreography.mjs` schedule. Every sound cue records its actual part IDs, geometry revision, story revision, beat, seconds and envelope duration. That schedule's `MUSIC_EVENTS` controls quiet housing release, separation, bearing detail and seating accents when the corresponding parts actually move. A camera change or label reveal does not independently trigger a sound. These effects are authored editorial cues, not a gear-contact, rolling-bearing or acoustics simulation.

The WAV has 1,587,600 stereo frames at 44,100 Hz, PCM16. Music and effects are mixed into one seekable track; note and reflection tails wrap around the same buffer. Pause, seek, export and looping therefore use the study's single transport.

`music-score.json` records the SHA-256, byte length, composition, cue bindings and objective diagnostics. The build checks sample headroom, RMS level, clipping and the encoded PCM loop boundary. `listeningReviewed: false` explicitly distinguishes those measurements from a human audition. The WAV is generated locally and excluded from Git; the project's audio builder reproduces its recorded bytes.
