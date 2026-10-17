# Audio choice and delivery

Use this reference to select sound and evidence. Doubao credentials/protocol/versioning belong in [narration](narration.md); visual duration and transport belong in [pacing](presentation-pacing.md) and [tour transport](presentation-tour.md).

## Defaults and actual implementation

| Delivery | Default | Current route |
| --- | --- | --- |
| Free CAD inspection | Silent | No automatic score, speech or camera tour |
| Short social clip | No narration; optional gentle original code music and sparse action effects | shared/study and example score/timeline |
| Explanatory lesson or requested speech | Doubao, English publicly unless overridden | shared/voice and existing showcase |
| Looping page | Silence, music or Doubao according to request | Music study and narrated showcase are distinct integrations |

[Robot score/synthesizer](../../../../EXAMPLE_ROBOT/audio/README.md), [kinetic score](../../../../EXAMPLE_ROBOT/kinetic/audio/README.md) and [shared/study](../../../../shared/study/README.md) are maintained music references. Old ignored output scripts are not the only source for a new example. The study owns music transport; the example owns BPM, event mapping, framing and score identity. It is not a universal music-composition service.

The old showcase uses lesson/manifests and may prepare voice even for silent preview; its capture helpers use measured narration timing. A new pure-silent story needs real display durations and optional voice initialization, not a fabricated valid TTS manifest or compulsory synthesis. Not all existing stories have migrated to study music or new labels.

## Compose with the display

Use traceable authored melody/rhythm/synthesis parameters. Record sample rate, duration, algorithm/seed and file digest. Third-party samples/tracks need separate provenance and terms.

Default music supports white-line observation: sparse soft keys/pads, restrained bass/percussion and space. A half-time feel or lower percussion density may soften music without slowing the entire animation. BPM is per-example, not a global skill constant.

Sparse editorial cues may mark a group beginning separation, a short joint detail, or completed reassembly. Bind cue identity/time/beat/envelope to the actual authored action stage, not each rendered frame or screw. Use smooth attacks/releases and low levels, then measure and listen. These are authored sound cues, not recorded hardware or solved collision/friction/torque.

Use one deterministic timeline. Mix events into one seekable track or use a cancellable schedule on the same audio clock. No independent wall-clock timers or replay-on-every-RAF effects. Pause, backwards seek, restart, loop and fallback cannot leave old sounds running.

Review transient peaks, clipping, balance and the loop seam. Silent viewing must still explain the key relationship. Keep new scores/revisions separate from previous music/narrated/long cuts; never retain an old hash for new waveform bytes.

## Timing and review

- **Silent:** one pauseable/seekable display clock and actual authored chapter durations.
- **Doubao:** once native playback succeeds, Audio.currentTime drives that chapter; use measured audio durations and matching lesson digest.
- **Music:** one media clock maps to global chapter offsets, never one restart per chapter or old narration duration. Offline capture uses deterministic frame time and final media duration checks.

First audible playback requires a user gesture. Failed playback leaves readable controls/captions and an honest silent fallback. Validate the selected sound path only: silent Inspect does not need a music loop or TTS.

For recording, [study capture](../../../../shared/study/README.md) monotonically advances frame times with continuous transitions; repeated seek calls force cuts and are not equivalent. [Video export](../../../../tools/video/README.md) checks captured frames/audio timing and encoded media. Inspect/listen to the actual output before claiming those reviews; file existence and objective measurements do not prove subjective quality.

## Public repository terms

Original code-generated WAV scores and synthesis sources are included under the project's stated terms. Generated Doubao MP3s are excluded from public Git packaging because service-output redistribution/MIT sublicensing has not been established. Keep text, digest manifests and opt-in regeneration scripts; a missing public MP3 yields a text/silent fallback, not claimed ready narration. Users synthesize with their own authorized account and applicable service terms. Never distribute credentials or imply MIT relicenses third-party/service content.
