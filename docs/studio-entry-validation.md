# Unified entry, original robot joint and real STEP inspection — validation

Checked locally on 23 October 2026. This records development work after the
`v0.4.1-alpha.1` tag. The current `main` update is distinct from that tagged
release; media publication is identified separately below.

## Scope

- One `studio` command lists 19 registered previews, three original generation
  recipes and four direct-frame export adapters. Existing example servers
  retain their route allowlists.
- The original robot joint has 129 occurrences, 44 geometry definitions and
  five subassemblies beneath its root. It builds locally without an external
  model download and has a 36-second English Atlas story with original music.
- The export workbench requires a browser, two calibration-frame checks and
  **Generate checked MP4**. It composes fixed-time frames, checks the input
  sequence, encodes the original score and checks decoded output frames.
- The new Leader Arm example is static, silent STEP inspection. The included
  display assets work without native CAD software.

## Automated checks

- `npm test` on the complete pending update: **691 passed, 0 failed, 0 skipped**.
  Local log: `output/robot-joint-release/npm-test.log`. This supersedes the
  earlier 667-test run before the robot joint was added.
- Robot-joint mechanics and presentation contribute 14 focused checks;
  the full suite also covers the unified CLI, generation and export protocols.
- `npm run audit:cad -- --example examples/step-bearing-assembly`: `verified`,
  22 definitions, 100 nodes including the root, 99 bound part occurrences,
  zero recovered or unmeshed faces. Fine/coarse imports retain the same source
  identities and placements.
- `npm run release:check`: candidate file, sensitive-pattern and packaging
  checks passed. `git diff --check` passed. These checks do not publish files.

The downloader's provenance check now covers every registered source rather
than four hardcoded robot directories. It requires both the recorded SHA-256
and byte length for the CAD single-file and robot multi-file contracts.

## Clean source reproduction

Before committing, the staged Git files were materialized into a new directory
under ignored `output/robot-joint-release/`, without the working checkout's
dependencies, downloaded sources or generated audio. `npm ci` installed the
locked dependency, then `studio generate robot-joint` rebuilt all 129 parts and
the original score without downloading a mechanical model. All five generated
geometry/identity/provenance artifacts matched the staged hashes exactly.
The 14 robot-joint mechanics/presentation tests passed in that clean copy.

Fresh loopback servers served the robot-joint page, film renderer, GLB, identity
index, score and bearing-cue module, and the STEP inspector's page, GLB and
manifest. Private/configuration/source routes returned 403. This is HTTP and
reproduction evidence, not a second browser or complete video render review.
Local reports are `output/robot-joint-release/clean-validation.json` and
`output/robot-joint-release/clean-joint-tests.log`.

## Actual browser checks

The 1280 × 720 desktop view and 390 × 844 responsive viewport were inspected.
Desktop tree and details scroll independently; the phone layout places the
model and controls above the tree. No horizontal page overflow was observed.

Model picking selected the source `base` occurrence ending in `-538` and the
matching tree row. Selecting bearing `-493` from the tree linked the same
occurrence to its source metadata. Filtering screws, selecting `-481` and using
Next instance selected `-482`: the definition stayed shared, while the occurrence
changed from 1/43 to 2/43. Isolation showed one part, hide showed zero, and reset
restored all 99. Search remains active when the next selected item matches it.
The separation slider and Fit visible were checked, followed by reset.

![Real STEP inspector and linked bearing-housing selection](media/step-bearing-inspector.png)

The screenshot depicts Apache-2.0 geometry; see [media notices](media/LICENSE.md).
Source STEP has a flat hierarchy and whole bearing parts. No mate solver,
bearing internals or collision-free disassembly was inferred. Some close-up
edge detail still reflects source tessellation; no source-face line cleanup was
added in this change.

## Actual export runs

All four browser adapters completed real frame composition and FFmpeg encoding
at 30 fps, with passing source and decoded stationary-landmark gates:

| Adapter | Frames | Format | Local job directory under `output/studio/` |
| --- | --- | --- | --- |
| Planetary Atlas | 1080 / 36 s | 1920 × 1080 | `planetary-gears-2026-10-23T12-44-38-198Z-d2186529` |
| Gearbox Cinematic | 720 / 24 s | 1920 × 1080 | `gearbox-cinematic-2026-10-23T12-48-56-238Z-c4851636` |
| Gearbox Atlas | 1200 / 40 s | 1080 × 1080 | `gearbox-2026-10-23T12-52-05-991Z-62fa2477` |
| Robot joint Atlas | 1080 / 36 s | 1920 × 1080 | `robot-joint-2026-10-23T13-24-39-594Z-7aab6f58` |

Each job retains its MP4, contact sheet, frame/encoding checks and delivery
report. Calibration frames for the first three and contact sheets for the planetary
and Cinematic runs were visually reviewed. The completed Atlas MP4 also loaded
in the workbench player with the expected 40-second duration.

The planetary run preceded renderer fingerprint integration. Both subsequent
gearbox runs also passed the new launch-to-encode renderer/asset/dependency
snapshot check. Fingerprint regressions independently cover changed source,
assets, dependencies and linked paths. Failed/cancelled jobs retain status and
partial frames; protocol checks use a test encoder and are not media evidence.

The robot-joint browser completed a muted 36-second MP4 playback with no media
error, dropped frames or corrupted frames. Selected encoded motor/bearing frames
were reviewed at 640/960 px widths, along with its contact sheet. The live page
was inspected at 390 × 844 without horizontal overflow; chooser/model selection
and restart were checked. Full frame decode and stationary-region checks passed.
Its review record is retained locally at `output/robot-joint-review/review.json`;
that pre-publication record is not rewritten to claim later actions.

These checks do not certify continuous subjective visual review or listening.
Phone/readability checks above apply specifically to the robot joint; no new
equivalent claim is made for the other three exports. The original 36-second
robot-joint video was subsequently [published on X](https://x.com/tutao0123/status/2113647451538419915),
with the project link in a reply. Rendered MP4s, frame sequences, browser captures
and per-machine logs remain ignored local outputs; the reproducible source and
curated README preview are the repository deliverables.
