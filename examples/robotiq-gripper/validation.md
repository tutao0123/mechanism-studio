# Local validation — 18 October 2026

This is a checked interactive Showcase, with a 64-beat, 108 BPM timeline
(35.555556 seconds). No MP4 export or remote publication was performed for it.

- The full project check ran with **577 passing tests, zero failures or skips**.
  It includes the pinned MJCF importer, example kinematics/pose transforms,
  restored display offsets, geometry camera envelopes, annotation timing,
  HTTP allowlists and deterministic original music.
- Actual browser review covered working motion, source-link explosion, local
  detail and full restoration. Both desktop and 390 × 844 narrow layouts were
  checked; detail names stayed near their parts without horizontal overflow.
- The music control successfully started the real HTML audio element; the
  shared media clock advanced through a loop. Pause and seek were exercised.
  No browser console errors were observed during the review.
- Retained source bytes and derived geometry hashes passed verification.
  The release candidate scan passed after adding the two source models.

Audio checks establish deterministic PCM, no clipping and small loop-boundary
steps. Listening quality has **not** been reviewed by a human. Music is an
original editorial composition, not a recording of the hardware.

The source supplies visual bodies and hinge declarations, not manufacturing
internals. The display explosion is not a collision-checked teardown. No
contact, force, dynamics or hardware-control validation is claimed.

The [delivery record](delivery.json) fingerprints the checked inputs and local
evidence. Ignored WAVs and local browser/test reports can be absent from a fresh
clone; the score builder and public assets remain reproducible.

Full reproduction and focused commands are in the [example README](README.md).
