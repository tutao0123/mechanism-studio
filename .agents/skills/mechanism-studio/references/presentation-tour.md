# Replayable mechanism tours

For automatic explanatory pages and public loops; free assembly inspection does not require this layer. Use [visual style](presentation-style.md), [pacing](presentation-pacing.md) and [audio choice](audio-delivery.md). Existing narrated tour code lives in [showcase](../../../../showcase/README.md); music studies use [shared/study](../../../../shared/study/README.md). They are distinct integrations.

## Story contract

Public controls, captions, names, legends and loading/failure states default to English, with requested language overrides. Sound is optional. Initial silent loops do not authorize automatic sound; readers explicitly enable audio.

Each chapter records an observation goal, concise text, real target parts and mechanical/process state. Narrated chapters additionally have matching narration. The existing voice schema requires narration; do not disguise music chapters as verified speech.

Use purposeful whole/detail/explosion/reassembly views. Near-part short leaders and retained scene names follow visual/pacing references, with optional pullback after reading. Labels are not engineering dimensions. Process colors/arrows require their own meaning/legend.

## One replayable timeline

Planned frame = f(story, chapter, chapterTime). Mechanics, planned camera, explosion, process, captions and names consume the selected chapter time. Do not add render-count randomness or duplicate mechanical formulas.

Continuous camera transitions also capture the actual starting camera/time once. Identical captured state and time sequence yields identical transition; arbitrary histories need not. Explicit seek goes to the planned frame. Exploration pauses the tour; return recomputes the frame at the saved time and transitions from the actual user view.

| Transport state | Time source | Behavior |
| --- | --- | --- |
| Silent | One display clock | Finite actual chapter durations, common pause/seek/resume |
| Successful narration playback | Native current chapter Audio.currentTime | Drives visual chapter time; no guessed wall clock; existing Doubao lesson checks remain in its adapter |
| Sound loading/retry | Retained chapter position | Freeze or explicitly switch to silent, without secretly advancing audible mode |
| Play rejection/failure | Explicit silent fallback | Useful captions/controls, accurate English status and retry |
| Music study | One native track currentTime | Global time maps chapters; no per-chapter music restart |
| Explicit frame rendering | Monotonic supplied frame time | Audio paused; continuous transitions still sampled, not repeated force-cut seek |

Study films prefer direct composition of WebGL pixels, SVG annotations and text into fixed-size frames, followed by sequence encoding and audio muxing. `capture.frame(seconds)` is the legacy timeline API name, not screen recording. Canvas pixels alone omit the page's overlays. Set the export layout/output scale independently of host display DPI and validate the actual compositor before claiming the route ready; see [direct frame delivery](delivery-evidence.md#prefer-direct-frame-composition-for-studies).

Measured chapter audio durations replace hints where available. durationHint is bounded preview/fallback information, not word-level timing. Same-mode silent and audible paths share action/duration configuration. Waiting/buffering sound cannot advance an independent audible clock.

Pause preserves location and freezes audio/visual. Scrub pauses old audio before relocating. Chapter/story/mode/restart cancels old asynchronous play/sources; no stale speech. Loop returns to the declared initial state. Browser rejection of later chapter play still gets an operable silent fallback.

[shared/voice](../../../../shared/voice/README.md) verifies lessons, manifests and audio and supplies Blob URLs; the tour owns current external Audio and uses its native clock. Stop it before voice player load/dispose invalidates URLs. Generated MP3s may be available in a local workspace but are excluded from the public package; keep truthful unavailable/fallback status.

## Model meaning

Authored engines demonstrate idealized motion/process with disclosed dimensions, phases and uncomputed quantities. Flow/spray/combustion are qualitative encoding, not CFD, thermal/dynamic/performance results. A non-afterburning turbofan does not acquire an exhaust flame for spectacle.

Real STEP retains source units/identity/placement. Geometry or fragment mapping does not infer shafts, mates, materials, paths or operating cycles. Add explicit source-backed or authored adapters when necessary, and keep missing fields missing. Follow [CAD boundaries](cad-direction.md).

## Acceptance

Check one complete actual loop, chapter boundaries, pause/resume, both seek directions, story/mode switch, exploration return, viewport/visibility recovery and reduced motion. Verify planned-frame determinism and transition continuity separately. No opening jitter, live fit, stale labels, changed mechanical readings from explosion or cropped credit.

For video delivery, retain the fixed output/layout, renderer and composition settings (plus CSS viewport, clip/scale and DPR for a screenshot route) and run the [every-frame source and decoded landmark/scale checks](delivery-evidence.md#validate-captured-frame-geometry). Review continuous encoded playback separately; representative stills or a clean opening frame do not establish absence of intermittent flicker.

Review actual duration/action/result holds, near-name layout and scene fade. For delivered narration, verify matching text, actual sound playback and pause, then exercise missing/corrupt/stale audio and rejected play. For music/silent versions, validate only the chosen path. Objective file generation is not subjective listening or browser evidence. Do not claim a review that was not executed.
