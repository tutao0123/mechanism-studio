# Bearing component study — original code music

The bearing study keeps the motor v2 edition's gentle original music language:
breathing pads, felt-style keys, rounded bass, and a quieter individual-part
close-up. Its action sound is newly bound to actual bearing movement events and
the complete WAV is freshly synthesized. No motor movement cue or old PCM is
reused. No narration, third-party samples, credentials or paid services are used.

The existing pure synthesis engine is imported from
`../../detail/audio/synth.mjs`; the motor edition's files are unchanged. Only the
explicitly selected music-role note events are retained from its score. The new
manifest records a hash of those note events and all bearing motion references.
Original music, synthesis code and generated WAV are MIT licensed.

From the Mechanism Studio root:

```sh
node examples/wolf-actuator/bearing/audio/build.mjs
node --test examples/wolf-actuator/bearing/audio/audio.test.mjs
```

The build reads the pinned scene index and `createWolfBearingStory(index)`.
Outputs are `bearing-loop.wav` here and the view's `../music-score.json`.

- 112 BPM transport, gentle 56 BPM feel, 64 beats, 34.285714285714285 seconds.
- 44.1 kHz stereo PCM16: 1,512,000 frames and 6,048,044 WAV bytes.
- Continuous soft slide/air sounds follow the four large-component movements.
- The four batches of 66 small source parts share one restrained sweep per
  direction; individual pieces do not each receive a click.
- The real selected source occurrence gets one inspection-out and one return
  air cue. Its 28–38 beat close-up has quieter music and reading space.
- Only the completed returns of `Part 62` and the source-named outer ring get
  gentle seating accents. Generic source names retain their uncertainty.

These effects are editorial accents, not bearing recordings or simulations of
friction, contact, load or rolling motion. They share the same PCM buffer and
seekable timeline as the music; there are no secondary timers or chapter audio
restarts. Pause, seek and replay therefore cannot leave separate sounds running.

The manifest records source IDs, actual action windows, file digest, peak, RMS,
per-chapter energy, clipping and loop continuity. Tests rebuild the entire PCM
and compare the retained hash. Objective measurements do not constitute a
subjective listening review; audition the page and final encoded media separately.
