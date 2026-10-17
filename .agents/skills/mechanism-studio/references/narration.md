# Lessons and optional narration APIs

Read only when speech is requested or existing narration is maintained. [Audio delivery](audio-delivery.md) selects sound; social music clips and silent Inspect do not require lessons or TTS. Reuse [shared/voice](../../../../shared/voice/README.md), not copied lock-specific protocol code.

## New optional speech interface

Use Node-only `shared/voice/speech.mjs` for new provider-neutral narration. The
caller explicitly selects a supported model, matching voice, output format and
endpoint. The current OpenRouter route is its documented dedicated
`https://openrouter.ai/api/v1/audio/speech`, not an arbitrary chat completion.
Read the [module's current primary-source references and API contract](../../../../shared/voice/README.md#provider-neutral-speech-api)
before choosing model/voice IDs. Not every model supports speech, every voice,
speed control or delivery instructions.

The thin `speech-cli.mjs` validates by default without reading a key. Explicit
`--generate` reads only the configured API-key environment variable and sends
one request; the config contains the variable name, never its value. The fixed
OpenRouter/OpenAI presets reject endpoint overrides. A custom HTTPS endpoint
needs the caller's separate origin allowlist, supplied with `--allow-origin` in
the CLI. Redirects are rejected; no key or paid fallback is exposed to a page.

The adapter collects bounded binary HTTP chunks, checks status/MIME/container
signature and writes content-addressed files plus an identity sidecar only
after a complete response. Explicit custom JSON-base64 services have a separate
mode. It does not parse chat SSE, perform word alignment, verify subjective
sound quality or convert raw PCM into MP3. Measure/decode/listen to final audio
and bind playable audio to the existing single media clock. Files and outputs
stay within the example; service-output redistribution terms require review.

The generic sidecar is **not** an old Doubao lesson manifest. Existing
`createLessonPlayer()` remains a Doubao-v1 integration; preserve valid old audio
and avoid compulsory regeneration or relabeling provider identities.

## Lesson and identity

Courses support zh-CN/en-US and 1–100 legal ordered unique step IDs. A step has id/title/narration plus example-owned mechanical targets, camera, selection or display metadata. Captions read the same narration text. Public UI/status/controls/captions default to English; locale:'en-US' gives English status before a lesson loads. Preserve existing Chinese lessons.

The narration-v1 digest covers the fixed projection:
`{schemaVersion, language, steps:[{id,title,narration}]}`.
Trim title/narration; order matters. Angle, camera and selected-part metadata do not affect audio identity. No current word-level alignment is supplied. One step's narration is limited to 1024 UTF-8 bytes.

The example applies model targets; the player does not own mechanics. Changing steps stops old audio; manual mechanical inputs cancel the old lesson. Narrate the actually visible state and distinguish computed values from phase descriptions.

Preserve valid local audio when moving files or changing cameras. Changed titles/narration/step identity invalidate the digest; do not force-play stale audio. Showcase and Explain retain separate text/audio/manifest identities, including the quadruped short and full directories. Shorten content before synthesis rather than globally speeding old speech.

## Existing Doubao lesson synthesis (optional)

The default thin CLI validates only:

```powershell
node examples/inline-four/voice/synthesize-doubao.mjs
```

Only an explicit `--generate --config <user-designated-local-file>` calls the fixed official provider endpoint. Read that authorized file, without searching unrelated directories, copying keys or printing provider bodies/credential errors. Text-model API credentials do not establish speech access.

English uses language en-US and an explicitly compatible English speaker. The repository's pinned reference is Jane, `en_female_jane_uranus_bigtts`, resource seed-tts-2.0, verified in the retained [English voice reference](../../../../shared/voice/english-voice-reference.md). Use `--speaker en_female_jane_uranus_bigtts`. English adds the provider additions JSON string `{"explicit_language":"en"}`; Chinese request behavior is unchanged. This records the implementation's chosen voice, not a promise of current account entitlement or permanent provider availability. Inspect actual authorized responses.

HTTP network chunks are not JSON frames. The shared parser reassembles UTF-8/JSON and requires successful termination plus nonempty audio. A failed segment stops the batch; HTTP 200/partial bytes do not mean success. Generate immutable stepID-fullSHA256.mp3 files and atomically publish the complete manifest last. Failed local publication retains prior valid manifest/audio; unreferenced complete files do not make a lesson ready.

Output stays within the example root. The generator checks actual paths before writes and after network waits, rejecting symlinks/junctions/out-of-scope paths. This is an application guard, not an OS sandbox.

## Browser transport and failure

Load valid lesson/complete manifest and verify Doubao identity, digest, step coverage and safe relative paths. Verify byte length/hash before playback/preload. Missing, corrupt or stale audio preserves text and a precise unavailable state.

preloadStep/preloadAll return verified Blob URLs without creating Audio or playing. The player owns their lifetime: stop preserves cache, load/dispose revoke it. Stop external Audio before invalidating URLs. Limits and cancellation behavior remain authoritative in the module README.

Audible playback comes from a user gesture. Native Audio.currentTime is the successful speech clock; pause/seek/chapter/story changes synchronize image and audio. Rejected play or absent speech yields usable text/silent transport and retry, without repeated forced autoplay or another provider fallback.

Test protocol mocks, failure retention, digest and actual MP3 bytes separately from real browser playback/pause/seek/interruption. A file, successful provider response and usable page are different evidence. Without synthesis authorization, finish text, dry-run and mock validation; never invent real audio.

Public Git packaging excludes generated Doubao MP3s while retaining lessons/manifests/CLI. Do not claim MIT redistributes service output or that a fresh public checkout has playable speech. Follow [audio delivery](audio-delivery.md) and third-party notices.
