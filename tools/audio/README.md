# Source-bound study music

`study-score.mjs` composes and synthesizes original music for the Allegro and
Robotiq studies. The two editions use the same gentle sound family with different
voicings and source-bound editorial cues. No voice service, external audio or
recorded robot sounds are used.

```sh
node tools/audio/build-study-score.mjs --example examples/allegro-hand
node tools/audio/build-study-score.mjs --example examples/robotiq-gripper
```

Each example exposes `createMusicStory(index, sourceAssembly)`, its beat clock,
story revision and `MUSIC_EVENTS`. Each cue has an ID, beat, kind, level and actual
part IDs. The score checks those bindings and bakes every cue into the same PCM
clock; browser music is driven by native playback time. The WAV is generated
locally and ignored by Git (`npm run build:audio` builds it with every other
study score); the score metadata, hash and synthesis code are kept.

White-line studies retain quiet pads, felt-like keys, warm bass and sparse air or
wood-like accents. The effects explain editorial release/return/detail events;
they are not simulated contact acoustics. Objective checks cover PCM duration,
headroom and loop continuity. Listening and visual synchronization need separate
review. The exporter supports these two examples deliberately; it does not find
an arbitrary story or create mechanical events from a model.
