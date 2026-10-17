# Mechanism Stories

Three live 3D mechanisms with four narrated editions, combining mechanical motion, guided cameras, English annotations, process cues and English Doubao narration. They reuse the existing mechanism assets and shared runtime, with the project's default white mechanical-plate style.

**Public source release:** geometry, English lesson text, timing and manifests
are included. Provider-generated MP3s are excluded pending verified downstream
audio sublicensing rights; existing local files are preserved. A fresh clone runs
the silent visual/text tours. To enable narration, use the documented Doubao
generation commands with your own service account and rights. See the
[example catalog](../examples/README.md) and [license policy](../docs/licensing.md).

## Open a story

From the repository root:

```powershell
npm ci
npm run preview
```

- [Four-stroke engine](http://127.0.0.1:4179/showcase/) — 86.712 seconds of narration.
- [Two-spool turbofan](http://127.0.0.1:4179/showcase/?story=turbofan) — 93.696 seconds of narration.
- [Small quadruped · Showcase](http://127.0.0.1:4179/showcase/?story=quadruped) — **33.984 seconds**, the default short edit.
- [Small quadruped · Explain](http://127.0.0.1:4179/showcase/?story=quadruped&mode=explain) — the preserved **91.944-second** full lesson.

A WebGL 2 browser is required. Models are served locally. Playback of locally
generated narration requires no live speech request; generating it is an optional
service operation. No speech credentials or provider MP3s are in Git.

## Controls

The visual tour loops silently on load. A reduced-motion preference starts it paused and uses stationary chapter cameras.

| Control | Behavior |
| --- | --- |
| **Play with narration** | Starts the English story from the beginning after a user gesture. Audio becomes the timeline source. |
| **Mute narration / Unmute narration** | Changes audibility while the narrated timeline continues. |
| **Play / Pause** or **Space** | Runs or freezes the tour, including the current process state. Space applies when focus is outside a control. |
| Timeline slider or chapter button | Seeks while preserving the play/pause state. |
| **↺** | Returns to the beginning, preserving the play/pause state. |
| **Explore model** | Pauses the tour and enables drag-to-rotate inspection. **Resume tour** restarts guided playback. |
| Story selector | Loads the selected mechanism and begins its silent preview. |
| **Presentation mode**, in the quadruped stage header | Switches between Showcase and Explain, cancels the previous sound and starts the selected edition silently from the beginning. Available in clean view too. |
| **Present ↗** | Requests browser fullscreen. |

Leaving the page's tab pauses a playing tour; returning resumes it. Audible playback requires a browser user gesture. If audio is unavailable, the silent presentation and English text remain available.

For a cleaner capture view, open `/showcase/?clean=1` or `/showcase/?story=turbofan&clean=1`. This hides the header, introduction and footer; the assembly, narration panel and transport remain visible. These pages do not export MP4 files, upload videos, host a remote site or post to social media.

The quadruped's clean view is `/showcase/?story=quadruped&clean=1`. Its chapter buttons provide a whole-robot view, a front-left hip/knee view, a foot-path view, diagonal gait, planned stance, and explosion/restoration. Use **Explore model** for free rotation.

For the full edition use `/showcase/?story=quadruped&mode=explain&clean=1`. An omitted mode uses the quadruped's Showcase edit. Unsupported modes fall back to an actual available edition; the two older engine stories retain Explain and do not pretend to have a short soundtrack.

Showcase is the authoring skill's default for new public examples. The quadruped short edit has new 79-word English narration rather than speeding up the original audio. Its gait runs at 0.76 cycles per second; a single-leg lift takes one second, holds briefly and returns. Display explosion takes 1.2 seconds, holds for one second, reassembles over 1.2 seconds and finishes assembled. The next loop starts at the same mechanical pose. These are prescribed teaching speeds, not hardware specifications.

## What the stories explain

| Four-stroke engine | Two-spool turbofan |
| --- | --- |
| Four cylinders sharing a crankshaft | Two concentric, independently rotating spools |
| Intake air joining a schematic port-fuel spray | Fan and bypass air path |
| Closed valves and shrinking chamber volume | High-pressure core compression |
| A finite spark followed by expansion | Steady annular combustion |
| Exhaust leaving through the valve | Hot core exhaust and turbine coupling |
| Display explosion and restoration | Shaft relationships through explosion and restoration |

Four-cylinder chapters slow and stage the cycle for explanation; this is not a constant-RPM recording. The turbofan uses prescribed low/high spool rates of 36/66 degrees per second. Its combustion is continuous rather than triggered by shaft angle. Effects disappear while parts are separated and return on reassembly. Flow, spray, gas and flame indicate process relationships; neither story solves combustion, pressure, heat, CFD or engine performance.

The quadruped keeps its body fixed. Its existing 8DOF model supplies hip/knee angles, foot positions and a forward/inverse kinematics check. A single front-left foot follows a closed path; the diagonal chapter pairs front-left with rear-right, half a cycle apart from the other pair. Thin paths and stance rings are prescribed geometry cues, with no balance, contact-force, terrain or hardware simulation. Explosion affects only display wrappers and restores the same standing pose. The authored GLB and original Chinese lesson remain unchanged.

## Code and data

```text
app.mjs / timeline.mjs       Transport, audio clock, chapter timing and rendering
stories.mjs                 Asset, contract, adapter and lesson locations
presentation.mjs            Edition resolution, camera/label timing and narration registry
adapters/                   Mechanism poses, effects, cameras and stable-ID anchors
voice/<story>/lesson.json    Six English chapters and narration text
voice/<story>/voice/         Verified Doubao audio manifest
voice/<story>/assets/audio/  Content-hashed MP3 files
voice/<story>/durations.json Measured durations bound to the lesson hash
```

Adapters expose `update`, `camera`, `annotations`, `snapshot` and `dispose`. They reuse the original models and process effects, have no independent animation loop or audio player, and keep explosion in the viewer's display layer. Callouts follow real part IDs and moving source transforms. Wide shots use precomputed motion and explosion envelopes: moving pistons or rotors never recenter or rescale the camera. Close-ups deliberately focus on the process being explained.

The quadruped has a separate framing planner for its Z-axis leg motion and body-axis, metre-valued explosion vectors. It does not use the engines' X-axis helper. See the [default presentation rules](../.agents/skills/mechanism-studio/references/presentation-style.md) for camera, label and type defaults; new adapters must verify their own complete motion bounds.

The opening is held steady. Showcase uses a 0.8-second eased camera move from the last actual view; Explain retains 2.4 seconds. Explicit scrubbing cuts directly to the requested view. Free-orbit resume starts from the reader's actual camera. All progress comes from the same chapter clock, so pausing also holds a camera transition. Serif captions, open chapter navigation and fine leaders keep the page close to a printed mechanical plate. Showcase labels begin after 0.15 seconds and fade in over 0.25 seconds, becoming visible in the last 40% of a camera move; Explain retains its slower label timing. Text stays in a fixed position and uses a small endpoint rather than an arrowhead.

During narrated playback, the active clip's `Audio.currentTime` drives chapter progress, poses, captions and camera motion. The shared voice player validates the lesson/manifest, byte counts and SHA-256 hashes before the shell uses its local audio URLs. Silent playback uses the same deterministic chapter timeline.

The short edit's initial duration hints are its measured clip lengths. Once verified audio metadata is ready, the shell uses the same measured chapter lengths in both silent and audible playback. Speed and label/camera timing come from the selected edition in both modes; changing only the output volume never changes the timeline.

## Audio and verification

The twenty-four English clips use Doubao `seed-tts-2.0` with `en_female_jane_uranus_bigtts` (Jane). They are separate from the optional Chinese lessons in the detailed examples. `voice/quadruped-short/` owns the short edit; all original files in `voice/quadruped/` are retained.

Run these from the repository root:

```powershell
# Measure all English stories, validate hashes and fully decode each MP3.
node showcase/voice/measure-durations.mjs
# Or measure one story.
node showcase/voice/measure-durations.mjs --story turbofan
node showcase/voice/measure-durations.mjs --story quadruped
node showcase/voice/measure-durations.mjs --story quadruped-short
# Audit all 45 locally generated Chinese and English clips, without generation.
npm run verify:audio
# Check adapter state, real assets, English anchors and camera framing.
node --test showcase/tests/*.test.mjs
```

Measurement requires `ffprobe` and `ffmpeg` on PATH. It writes a story's `durations.json` only after that story passes, with `{schemaVersion: 1, lessonSha256, steps: {id: durationSeconds}}`. The audit writes `output/audio-verification.json`. Neither command reads speech credentials or calls the provider.

Generation is a separate, explicit operation through each story's `synthesize-doubao.mjs`; default invocation only validates. See the [shared voice documentation](../shared/voice/README.md) for configuration and English speaker selection. Credentials must remain outside release files.

Project scope, source attribution and CAD limitations remain those in the [main README](../README.md), [AGENTS.md](../AGENTS.md), [origins](../docs/origins.md) and [third-party notices](../THIRD_PARTY_NOTICES.md).
