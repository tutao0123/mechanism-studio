# Continuous motor study — original code music

This is a newly synthesized score for the v2 WOLF motor presentation. The older
whole-actuator score and exported v1 clip remain separate. No narration,
third-party samples, paid services, credentials or network access are involved.
Original composition, sound synthesis and generated WAV are MIT licensed.

From the Mechanism Studio project root:

```sh
node examples/wolf-actuator/detail/audio/build.mjs
node --test examples/wolf-actuator/detail/audio/audio.test.mjs
```

The build reads the retained source scene index and
`createWolfMotorDetail(index).MOTION_EVENTS`. It writes `motor-loop.wav` here and
the view's `../music-score.json`. It rejects unknown part IDs, changed source
identity, incompatible story revisions or events outside the actual timeline.

## Arrangement

- 112 BPM transport with a gentle 56 BPM feel, 64 beats, 34.285714285714285 seconds.
- Quiet opening, more continuous melodic replies during separation, a quieter
  one-magnet close-up, and a rising return that resolves back into the loop.
- Soft pads, felt-style sine keys and rounded bass. No drum bed, voice, label
  dings, repeated metronome ticks or artificial impact for each small part.
- Filtered air and restrained mechanical slide textures follow actual movement
  windows. Each forty-part repeated family receives one continuous wave per
  direction, with all four source-bound batches listed in the score.
- Three soft seating cues occur at the completed return of the rotor body,
  mounting plate and hex nut. Inspection out/return receives a gentle air cue.

These sounds are editorial design, not recordings or simulations of friction,
collision, force or real actuator acoustics. Generic source parts named `cc`
retain that name; music does not infer their physical function.

## Timing and evidence

One deterministic 44.1 kHz stereo PCM16 buffer contains both music and effects:
1,512,000 frames, 6,048,044 WAV bytes. The displayed animation uses that same
seekable media clock. There are no secondary timers, scene restarts or sound
effects created on every animation frame.

Synthesis uses a retained seed, smooth envelopes, periodic note/room tails and
matching loop gain. The manifest records composition, chapter boundaries,
source occurrence IDs, exact motion-event references, file hash, peak, RMS,
per-chapter RMS, clipping and the loop boundary. The test regenerates the full
WAV and compares its SHA256 to the retained bytes. Objective checks do not claim
a subjective listening review; audition the actual page or encoded output for
that separate judgment.
