# Audio choice and delivery

Use this reference to select sound and evidence. Optional speech providers, credentials and protocol/versioning belong in [narration](narration.md); visual duration and transport belong in [pacing](presentation-pacing.md) and [tour transport](presentation-tour.md).

## Defaults and actual implementation

| Delivery | Default | Current route |
| --- | --- | --- |
| Free CAD inspection | Silent | No automatic score, speech or camera tour |
| Short social clip | No narration; optional gentle original code music and sparse action effects | shared/study and example score/timeline |
| Explanatory lesson or requested speech | Optional provider-neutral speech API, English publicly unless overridden | shared/voice/speech.mjs; existing Doubao lesson integration retained |
| Looping page | Silence, music or explicitly selected narration according to request | Music study and old narrated showcase are distinct integrations |

[Robot score/synthesizer](../../../../EXAMPLE_ROBOT/audio/README.md), [kinetic score](../../../../EXAMPLE_ROBOT/kinetic/audio/README.md) and [shared/study](../../../../shared/study/README.md) are maintained music references. Old ignored output scripts are not the only source for a new example. The study owns music transport; the example owns BPM, event mapping, framing and score identity. It is not a universal music-composition service.

The old showcase uses lesson/manifests and may prepare voice even for silent preview; its capture helpers use measured narration timing. A new pure-silent story needs real display durations and optional voice initialization, not a fabricated valid TTS manifest or compulsory synthesis. Not all existing stories have migrated to study music or new labels.

## Compose with the display

Use traceable authored melody/rhythm/synthesis parameters. Record sample rate, duration, algorithm/seed and file digest. Third-party samples/tracks need separate provenance and terms.

For reusable effects, consult the [reviewed sound libraries](../../../../docs/sound-libraries.md) and the [humanoid's retained CC0 subset](../../../../examples/humanoid/audio/sfx/README.md). Prefer original synthesis or explicitly licensed CC0 samples. Preserve source bytes, creator, pinned URL, license and hash; record processing in the derived mix. Do not treat an entire recording website as one license, or bundle NC/redistribution-restricted files into the default library. Reusing a WAV in a new story also needs new event-to-part bindings; the previous story's component IDs do not describe the new actions.

Default music supports white-line observation: sparse soft keys/pads, restrained bass/percussion and space. A half-time feel or lower percussion density may soften music without slowing the entire animation. BPM is per-example, not a global skill constant.

For an optional [Cinematic edition](presentation-cinematic.md#motion-and-music-pacing), the score may use a more present bass pulse, sustained tones and sparse action accents. Follow that edition's exact remapped mechanical events and preserve headroom; a shot boundary alone does not establish an engagement sound. The [cinematic gearbox score](../../../../examples/gearbox/cinematic/audio/README.md) is one implemented arrangement, not a required instrument set or 120 BPM preset.

Sparse editorial cues may mark a group beginning separation, a selected part settling into a close-up, or completed reassembly. Bind cue identity/time/beat/envelope and affected real part/group IDs to the final authored motion event, not each rendered frame or screw. When movement is retimed, recheck those bindings against its actual start/settle/return; a chapter timestamp alone is insufficient. Label reveal does not itself need a ding. Use smooth attacks/releases and low levels, then measure and listen. These are authored sound cues, not recorded hardware or solved collision/friction/torque. [Motion choreography](motion-choreography.md) coordinates this handoff with the visual adapters.

Use one deterministic timeline. Mix events into one seekable track or use a cancellable schedule on the same audio clock. No independent wall-clock timers or replay-on-every-RAF effects. Pause, backwards seek, restart, loop and fallback cannot leave old sounds running.

Review transient peaks, clipping, balance and the loop seam. Silent viewing must still explain the key relationship. Keep new scores/revisions separate from previous music/narrated/long cuts; never retain an old hash for new waveform bytes.

## Timing and review

- **Silent:** one pauseable/seekable display clock and actual authored chapter durations.
- **Narration:** once native playback succeeds, Audio.currentTime drives that chapter; use measured audio durations and matching text/audio identity. Existing Doubao lessons retain their manifest-v1 checks; generic speech output does not silently replace them.
- **Music:** one media clock maps to global chapter offsets, never one restart per chapter or old narration duration. Offline capture uses deterministic frame time and final media duration checks.

First audible playback requires a user gesture. Failed playback leaves readable controls/captions and an honest silent fallback. Validate the selected sound path only: silent Inspect does not need a music loop or TTS.

For recording, [study capture](../../../../shared/study/README.md) monotonically advances frame times with continuous transitions; repeated seek calls force cuts and are not equivalent. [Video export](../../../../tools/video/README.md) checks captured frames/audio timing and encoded media. Inspect/listen to the actual output before claiming those reviews; file existence and objective measurements do not prove subjective quality.

## Public repository terms

Original code-generated WAV scores and synthesis sources are included under the project's stated terms. Generated Doubao MP3s are excluded from public Git packaging because service-output redistribution/MIT sublicensing has not been established. Keep text, digest manifests and opt-in regeneration scripts; a missing public MP3 yields a text/silent fallback, not claimed ready narration. Users synthesize with their own authorized account and applicable service terms. Never distribute credentials or imply MIT relicenses third-party/service content.
