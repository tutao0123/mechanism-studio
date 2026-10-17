# Quiet assembly score

`node examples/wolf-actuator/audio/build.mjs` verifies and copies the project's
original `quiet-assembly-v2` PCM from `EXAMPLE_ROBOT/audio/`, without synthesizing
new audio or calling a service. The existing four motion intervals match the WOLF
editorial groups at beats 8/12/16/20 and 40/44/48/52, each lasting two beats. Its
new metadata binds cues to WOLF's actual STEP occurrence IDs and geometry revision.

The original Mechanism Studio composition uses sustained pads, sparse rounded
keys and warm bass, with 56 BPM half-time feel on a 112 BPM motion grid. Quiet
air/servo textures follow movement; soft seating sounds mark return completion.
Sounds are editorial accents, not a physical motor, impact or gear simulation.
Names do not produce ticks or chimes. There is no narration or third-party sample.

The PCM is 44.1 kHz stereo 16-bit, 1,512,000 frames, 34.285714 seconds. The score
records its SHA-256, level analysis, source composition and new source bindings.
The page verifies the bytes and uses native `Audio.currentTime`; it only enables
sound after a reader clicks. Actual listening review is recorded separately.
