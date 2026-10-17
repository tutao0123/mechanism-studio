# Quiet Assembly / Return

Original instrumental score and sparse editorial effects for the robot explosion
loop. Sustained pads, rounded keys and warm bass give it a relaxed half-time feel
of **56 BPM**. The underlying **112 BPM** transport remains unchanged so the
34.29-second animation keeps its original action timing. There are no drums,
busy arpeggios, ticking patterns, label dings, voice, samples, credentials or
network calls. Oscillators and seeded, low-pass-filtered noise create all sound.

Generate with `node EXAMPLE_ROBOT/audio/build.mjs` from the project root. The output
is `robot-loop.wav`, stereo PCM 16-bit / 44.1 kHz, 1,512,000 frames, exactly
34.2857142857 seconds: 16 bars of 4/4 at 112 BPM. `music-score.json` contains every
note event, the deterministic seed, beat frame grid, action cues, SHA-256 and
sample-level analysis. The mix has 8 dB sample-peak headroom and an RMS check of
-24 to -19 dBFS. These are sample measurements, not an inter-sample true-peak or
perceptual loudness certification. All audio stays in this example.

The eight airy servo textures follow `GROUPS` in `../story.mjs`: shoulder,
forearm, wrist and jaws move out at beats 8, 12, 16 and 20, then return at beats
52, 48, 44 and 40 respectively. Each motion lasts two beats. Four quiet seating
accents occur at the return completions, beats 42, 46, 50 and 54. They are
designed editorial sounds, **not simulated motor recordings, collision results
or evidence of physically valid assembly**. Stable detail inspection is quiet.
`music-score.json` binds each effect to the actual group IDs, part IDs, phase and
movement start/end beat.

The webpage should use one `Audio.currentTime` clock for both sound and image.
`beat = currentTime * 112 / 60`. Start sound only after the visitor's gesture.
Pause, seek, restart and loop must update the same transport; no per-chapter audio
restarts. Effects are already rendered into the same PCM buffer; never replay
them from independent timers, caption events or camera callbacks. Keep a silent
fallback. If action beats change, update the story, regenerate this audio and
recheck the handoff together.

The circular synth preserves note/reverb tails across the loop boundary. A sample
boundary check finds clicks and clipping, but does not prove that the composition
sounds good. Audition the file, then audition two consecutive loops before claiming
listening review. This code and score are project-authored; no separate third-party
music license is required. The project author's eventual distribution license still
applies.

The earlier, busier `Assembly / Return` edition remains verbatim in
`editions/assembly-return-v1/`: its WAV, score, synth and build script are kept
together. The current webpage still loads the top-level `robot-loop.wav`; no
second audio player or automatic switch is introduced. Rebuild the preserved
edition only inside its own directory if needed.
