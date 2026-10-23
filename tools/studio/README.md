# Unified Studio entry

One project-local command generates an original teaching assembly, selects an existing preview or runs a supported direct-frame export adapter. Run it from the repository root after `npm ci`:

```sh
npm run studio -- list
npm run studio -- generate robot-joint
npm run studio -- preview robot-joint
npm run studio -- export robot-joint
```

Preview and export print a local URL. Open that URL in a WebGL 2 browser. `preview` with no ID opens the gallery; `npm run preview` and all existing example server commands continue to work.

## Original local generation

Use `generate` when the model should come from this project's authored construction code. The registered recipes require no model download, Blender connection, CAD importer, credentials or remote synthesis service:

| Example ID | Construction | Result |
| --- | --- | --- |
| `robot-joint` | Original motor, magnets, stator coils and a compact planetary reducer | 129 part occurrences / 44 reusable definitions / 6 assemblies |
| `planetary-gears` | Authored involute gears, enclosure, shafts, bearings and fasteners | 80 part occurrences / 29 reusable mesh definitions |
| `gearbox` | Authored five-speed train, shafts, bearings, synchronizers and enclosure | 124 part occurrences / 68 definitions / 15 assemblies |

```sh
npm run studio -- generate gearbox
npm run studio -- preview gearbox
npm run studio -- export gearbox
```

Generation rebuilds the selected example's GLB, scene index, scene contract, provenance and build report **in place** from its current dimensional specification. Gearbox then rebuilds its seven geometry-bound planning handoffs. Stable occurrence IDs, actual parents and shared geometry definitions survive rebuilding. The command verifies GLB identity, hashes, revisions and provenance, then prepares the original code-generated music. When the model revision changes, the local score builder regenerates the score metadata and WAV so action cues refer to the new model. Otherwise a valid existing WAV is reused; missing music is synthesized locally and checked against its recorded hash. Both the score's overall binding and any nested geometry references must match. Only installed project Node dependencies are needed for these recipes; FFmpeg is needed later for video export.

Every invocation writes a receipt under `output/studio/generate-<id>-<random>/generation.json`, recording the Node runtime, before/after asset and source fingerprints, builder stages, output counts, elapsed time and audio identity. A source change during generation rejects the run, rather than treating mixed revisions as one reproducible result. Existing films and their review evidence are preserved. A failed build stops before later stages and leaves an explicit failed receipt; generated model files can be partially rebuilt, so rerun the recipe after correcting its reported error.

The command executes explicit construction recipes. It does not turn arbitrary text or pictures into arbitrary CAD, expose an executable/path override, or fetch a replacement model. New text/image requests still need an authored specification, real geometry builder and mechanical adapter before being added to the registry. These outputs are original MIT teaching meshes with declared assumptions, rather than manufacturing-ready B-reps or contact simulation. Source-based STEP inspection remains an optional separate route: `npm run studio -- preview step-bearing-assembly`.

## Preview

The registry includes the original teaching models, robot studies, authored story pages, gearbox editions and real STEP inspector. Entries reuse their existing read-only server factories and route allowlists. Choosing a page does not import CAD, generate a lesson or infer mechanical constraints.

Where an original score is registered, preview checks the recorded WAV hash and synthesizes only a missing or mismatched local track. It preserves the committed score metadata. Click **Play with music** in the page to enable sound. There are no speech-provider calls, credentials or paid synthesis in this command. STEP inspection stays silent.

Each example retains its usual port. To run multiple pages sharing one default port, use an explicit override:

```sh
npm run studio -- preview gearbox --port 4200
```

`--port` takes precedence over `PORT`. Occupied ports produce an actionable error; Studio never stops an existing process or silently switches to an unrelated server. All listeners bind to `127.0.0.1`.

## Direct-frame export

See the [integration validation](../../docs/studio-entry-validation.md) for the
real STEP browser checks and complete local export runs.

Unified export adapters use the example's fixed-size renderers:

| Example ID | Duration | Output | Renderer |
| --- | --- | --- | --- |
| `robot-joint` | 36 seconds | 1920 × 1080, 30 fps | `jointFilm` |
| `planetary-gears` | 36 seconds | 1920 × 1080, 30 fps | `planetaryFilm` |
| `gearbox` | 40 seconds | 1080 × 1080, 30 fps | `gearboxFilm` |
| `gearbox-cinematic` | 24 seconds | 1920 × 1080, 30 fps | `cinematicFilm` |

The command prepares a local **browser-assisted export workbench**. Open its printed URL, inspect the opening and expanded calibration images, confirm that their complete composition is visible, and choose **Generate checked MP4**. Keep both the command and browser page open while it runs. Frames are composed directly from the example's absolute-time rendering API and sent to the local encoder; this is not screen recording and does not depend on display scaling. FFmpeg and FFprobe must be available on PATH for video encoding and media checks; see [video tools](../video/README.md).

Use the output directory printed by the command for the new MP4 and its reports. Generated frames and videos remain ignored local outputs. Rendering and encoding do not establish visual acceptance: watch the completed film, check small-screen text, movement and audio, and retain that review separately from automated results. This command does not upload or publish anything.

Every run owns a new `output/studio/<example>-<timestamp>-<random>/` directory, preserving previous exports. Successful jobs contain:

- `job.json`: registered film settings, original score hash, renderer capture metadata and source/display/dependency fingerprints. The encoder rejects a changed renderer snapshot before encoding.
- `status.json`: persisted job stage, received-frame checkpoint, errors and completed delivery; cancellation preserves the exact received count.
- `frames/`: sequential directly composed JPEGs; `decoded/`: frames decoded from the finished MP4.
- `film.mp4`, `film-contact-sheet.jpg`, `film-verification.json`: video and objective encoding checks.
- `source-static-region.json`, `encoded-static-region.json`: every-frame stationary-landmark checks before and after encoding.
- `delivery.json`, `encoding.log`: delivery summary, evidence paths, remaining review limits and encoder output.

**Cancel frame generation** preserves received files and prevents that job from continuing. Once encoding begins, wait for its result. A failed or cancelled job must be retried with a new export command; it does not silently resume or overwrite a prior delivery. Automatic checks do not certify mechanical validity or subjective audiovisual quality.

Other registry entries are explicitly **preview only**. In particular, the blueprint edition is not silently exported using the Atlas renderer, and opening the real STEP inspector does not invent an animation. Frame rate, duration and dimensions follow each supported adapter; there is no generic `--fps` or aspect-ratio override that would promise an unreviewed composition.

## Registry and extension contract

`registry.mjs` is an explicit catalog, not a scan of arbitrary local paths. Its entries provide:

- `id`, `title`: stable CLI ID and user-facing name.
- `preview.createServer`, `defaultPort`, `path`: the existing allowlisted server and local page route.
- `audio`: an optional entry from `scripts/build-audio.mjs`, which verifies original score bytes.
- `generate`: whether `generate.mjs` has a fixed original local construction recipe for this exact registry entry. Alternate visual editions reuse the base assembly; they do not masquerade as separate generators.
- `export`: an optional adapter with `renderPath`, `apiName`, `duration`, `width`, `height`, `fps`, `audioPath`, a calibration `reviewTime`, and a genuinely stationary `staticRegion` for stability checks.

Only add an export capability when its browser adapter is available and its output dimensions, timeline, audio and stationary region have been checked. A title or animation on a preview page is insufficient. The supported browser API exposes `ready`, `start()`, `frame(seconds)`, `stop()` and `snapshot()`; frames must be deterministic samples of the authored timeline.

Register the adapter's reviewed source roots in `fingerprints.mjs` too. The snapshot is a conservative local dependency set, not a general JavaScript dependency crawler. Original audio is hashed separately; generated output and raw CAD source are not renderer inputs. Source snapshots detect changes between job creation and encoding, not edits changed back between those two checks.

`list --json` returns serializable capability metadata for tooling:

```sh
npm run studio -- list --json
node --test tools/studio/cli.test.mjs
node --test tools/studio/tests/generate.test.mjs
node --test tools/studio/tests/export.test.mjs
```

The focused CLI tests exercise invalid IDs/options, environment/port precedence, every registered page's HTTP entry, real GLB/runtime serving, private-route refusal and preservation of an occupied server. Generation tests check dispatch order, fixed recipe identity, generated-asset contracts, failed-build handling, stale audio bindings and linked-directory scope rejection. They use existing committed geometry when testing orchestration, so the regular test suite does not overwrite an author's model edits. Real builder reproduction is a separate `generate` run: compare its receipt's before/after hashes to assess whether unchanged sources reproduce the same assets. Protocol tests check local Host/origin/session boundaries, calibration, frame dimensions and ordering, incomplete finish, success/failure transitions and preserved cancellation files. They inject a test encoder and do not claim to validate decoded video. `npm test` includes these tests alongside the media tools' checks; browser composition and full encoded playback require their own review.
