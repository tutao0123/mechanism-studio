# Example guide

Start with an original procedural model, then choose its presentation. The agent can author a new assembly from a description or reference image; source-based robots and the STEP inspector remain available when existing device geometry is the task. All commands below run from the Mechanism Studio repository root after `npm ci`.

This catalog describes the current `main` branch, including additions after **v0.4.1-alpha.1**, the latest tagged public alpha. Start with the original robot joint, which needs no external model download:

```sh
npm run studio -- generate robot-joint
npm run studio -- preview robot-joint
```

Open **http://127.0.0.1:4198/** and click **Play with music** for the 36-second English Atlas story. The locally authored motor, reducer, bearings, flange and repeated fasteners remain distinct parts; pause and select through the grouped chooser or model. Node.js 20.10+, npm and a WebGL 2 browser are sufficient for this original recipe and score. The full test suite also requires Python 3; video encoding requires FFmpeg/FFprobe, and optional native geometry rebuilding uses the relevant example's documented tools.

**These are implemented examples, not empty plans.** The maintained lock lives
in `prototype-3d/`, and both SO-ARM robot cuts live in `EXAMPLE_ROBOT/`; neither
is a missing child of this directory. The implemented experiences and exact
public/local distinctions are listed in the [status audit](../docs/examples-status.md).
`lock-comparison/` is an explicitly [historical artifact](lock-comparison/README.md).

## Visual entry points

<a href="robot-joint/README.md"><img src="../docs/media/robot-joint-preview.png" alt="Original 129-part robot joint with motor, planetary reducer, bearings and fasteners separated" width="480"></a>
<a href="gearbox/README.md"><img src="../docs/media/gearbox-readme.gif" alt="Original five-speed teaching gearbox separating and driving through its gears" width="480"></a>
<a href="allegro-hand/README.md"><img src="../docs/media/allegro-hand-preview.png" alt="Allegro source finger chains separated around the palm" width="480"></a>
<a href="robotiq-gripper/README.md"><img src="../docs/media/robotiq-gripper-preview.png" alt="Robotiq source four-bar link groups in an exploded view" width="480"></a>
<a href="humanoid/README.md"><img src="../docs/media/humanoid-g1-preview.jpg" alt="Unitree G1 source-body exploded presentation" width="480"></a>
<a href="../EXAMPLE_ROBOT/kinetic/README.md"><img src="../docs/media/so-arm102-kinetic.jpg" alt="SO-ARM 102 kinetic cut with source robot credit" width="480"></a>
<a href="inline-four/README.md"><img src="../docs/media/inline-four-preview.jpg" alt="Inline-four engine with ignition cues" width="480"></a>
<a href="turbofan/README.md"><img src="../docs/media/turbofan-preview.jpg" alt="Two-spool turbofan teaching model" width="480"></a>
<a href="quadruped/README.md"><img src="../docs/media/quadruped-preview.jpg" alt="Original small quadruped teaching model" width="480"></a>

[Original robot joint](robot-joint/README.md) ([36-second published video](https://x.com/tutao0123/status/2113647451538419915)) ·
[Planetary gear set](planetary-gears/README.md) ·
[Gearbox](gearbox/README.md) ·
[G1 humanoid](humanoid/README.md) ·
[SO-ARM kinetic cut](../EXAMPLE_ROBOT/kinetic/README.md) ·
[Quadruped](quadruped/README.md) ·
[Original lock preview](../prototype-3d/assets/lock-preview.png).
Preview licenses are listed in [media notices](../docs/media/LICENSE.md): G1
retains BSD-3-Clause, Allegro and Robotiq BSD-2-Clause and SO-ARM CC BY 4.0;
original teaching-model previews use the project's MIT terms.
Videos are generated local deliveries, not missing source assets: captured
frames and MP4 exports are intentionally excluded from Git. GitHub does not run
these pages; use a local server below to load models and play music.

## Viewing routes

Use `npm run studio -- list` for the registered recipes and pages, then
`npm run studio -- preview <id>`. The command selects the existing read-only
server and builds the selected original score. For the optional real STEP inspector use
`npm run studio -- preview step-bearing-assembly` → **http://127.0.0.1:4194/**.
Its unchanged Apache-2.0 source has 99 parts, six bearings and 43 repeated screws;
the flat source hierarchy, definitions and placements remain intact.

`npm run studio -- export robot-joint --port 4199` opens the browser-assisted export
workbench. Run `studio list` to distinguish film adapters from preview-only
entries. See the [unified entry guide](../tools/studio/README.md)
for fixed formats, calibration, frame checks, outputs and remaining manual review.

| Example | Server command | Local route | Included experience |
| --- | --- | --- | --- |
| [Original robot joint](robot-joint/README.md) | `npm run studio -- preview robot-joint` | `http://127.0.0.1:4198/` | 36-second English Atlas loop: 129 locally authored parts, motor/gear/bearing close-ups, grouped chooser ↔ model selection, reassembly and synthesized music |
| Planetary reducer: More than gears | `node examples/planetary-gears/serve.mjs` | `http://127.0.0.1:4193/?clean=1` | 36-second original 80-part study: enclosure/transmission separation, ideal 4:1 gear motion, sun/planet close-up, 13-component bearing teardown, seated ball/cage motion and reassembly |
| Five-speed gearbox | `node examples/gearbox/serve.mjs` | `http://127.0.0.1:4183/?clean=1`, blueprint edition `/blueprint/?clean=1`, 24-second cinematic edition `/cinematic/` | 40-second original teaching model: case off, explosion to synchronizer keys and bearing balls, power path through 1st–5th, synchronizer close-up, restoration. Spec labels and measured dimensions; the blueprint edition is the same study drawn white-on-blue |
| [Leader Arm STEP inspector](step-bearing-assembly/README.md), optional | `npm run studio -- preview step-bearing-assembly` | `http://127.0.0.1:4194/` | Original assembly tree, occurrence selection in tree/model, repeated-instance navigation, hide/isolate/restore; silent Inspect mode |
| Allegro dexterous hand | `node examples/allegro-hand/serve.mjs` | `http://127.0.0.1:4185/?clean=1` | 35.56-second articulated finger/ thumb study, source-link expansion, local view and restoration |
| Robotiq 2F-85 gripper | `node examples/robotiq-gripper/serve.mjs` | `http://127.0.0.1:4186/?clean=1` | 35.56-second jaw motion, four-bar closure, link-level explosion and reassembly |
| Unitree G1 humanoid | `node examples/humanoid/serve.mjs` | `http://127.0.0.1:4182/?clean=1` | 35.555556-second body-level explosion/reassembly, close reading views, original score and sparse CC0 effects |
| Five-pin lock | `npm run preview` | `http://127.0.0.1:4179/prototype-3d/?palette=line-light` | Key profiles, insertion and turning, shear-line view, camera presets and display explosion |
| Inline-four | `npm run preview` | `http://127.0.0.1:4179/examples/inline-four/` | Crank-slider motion, valve timing, port spray, ignition and exhaust cues |
| Two-spool turbofan | `npm run preview` | `http://127.0.0.1:4179/examples/turbofan/` | Independent shaft controls, rotor/stator groups and core/bypass flow |
| Small quadruped | `npm run preview` | `http://127.0.0.1:4179/examples/quadruped/` | Leg controls, FK/IK, limits, foot path, diagonal gait and explosion |
| English story pages | `npm run preview` | `http://127.0.0.1:4179/showcase/?story=quadruped&clean=1` | Timed camera, captions and near-part labels; short/full quadruped editions |
| SO-ARM 102 assembly study | `node EXAMPLE_ROBOT/serve.mjs` | `http://127.0.0.1:4180/?clean=1` | 34.285714-second music-driven exploded view and restoration |
| SO-ARM 102 kinetic cut | `node EXAMPLE_ROBOT/serve.mjs` | `http://127.0.0.1:4180/kinetic/?clean=1` | 25.714286-second source-backed joint motion and assembly edit |

The root server handles the gallery, lock, engine, turbofan and quadruped. Robot joint, STEP inspector, SO-ARM, humanoid, gearbox, Allegro, Robotiq and planetary studies use dedicated servers with explicit read-only route allowlists. The mechanical film studies share one declared runtime list (`shared/study/preview-server.mjs`) that `tests/preview-pages.test.mjs` checks against their served pages. `clean=1` removes surrounding presentation chrome where that page supports it. It does not change source credit or engineering claims. Do not infer other URL options from an authoring mode name.

The Allegro and Robotiq pages require their dedicated servers; their root-gallery
cards expose the launch commands instead of a root `/examples/` route. The
[19 October integration report](../docs/robot-studies-release.md) records their
shared-runtime compatibility checks. Their retained 18 October `validation.md`
and `delivery.json` files describe the earlier local review and its pre-sync
inputs, rather than certifying the current checkout or an exported video.

Generate the gearbox score with `node examples/gearbox/audio/build.mjs`; its
optional cinematic edition at `/cinematic/` uses
`node examples/gearbox/cinematic/audio/build.mjs`.
Generate the planetary score with `node examples/planetary-gears/audio/build.mjs`.

Each study server prints its local address; a `PORT` override changes the URL.
Generated score WAVs and exported videos are excluded from Git; the synthesis
source, score and viewing adapters are retained. Recording and encoded-media
review remain separate from running the interactive page.

## What a fresh clone includes

Build the soundtracks before music playback: `npm run build:audio` renders every
study score once and checks it against its recorded hash. Original synthesis
code and score metadata are retained; the generated WAVs stay local. To build
only the two robot soundtracks:

```sh
node tools/audio/build-study-score.mjs --example examples/allegro-hand
node tools/audio/build-study-score.mjs --example examples/robotiq-gripper
```

Their visual assets are included, so these viewing commands need no Python.
Optional regeneration from the retained MJCF and pinned STL meshes (`npm run fetch:sources`
downloads the meshes) uses the
[pinned robot importer](../tools/robot/README.md) and Python 3's standard library;
it is separate from launching a page or generating its score.

- GLB display geometry, scene contracts, models, lessons, source/provenance records and implementation adapters.
- Deterministic original-music synthesis source and score metadata for every study. No generated score WAV is in Git; `npm run build:audio` builds them all. The humanoid additionally retains five separately licensed Kenney CC0 effects and their provenance. Click **Play with music** to enable audio; the media clock controls motion, camera, labels and effects together.
- Local Node.js builders for the original robot joint, planetary reducer and gearbox; Blender Python builders for the earlier teaching mechanisms. Local `.blend` exports remain on the author's machine because their binary metadata embeds machine-specific paths; rebuild them if needed.
- Third-party model descriptions (MJCF, URDF/Xacro) with their licenses, notices and provenance. The upstream STL meshes are not in Git: `npm run fetch:sources` downloads each from its pinned upstream commit and verifies its SHA-256. These assets are separately licensed from the MIT runtime.

Provider-generated Doubao MP3s are deliberately not in the public source release: the reviewed material did not establish a downstream MIT sublicensing grant. This is not a claim that using Doubao output is prohibited. Silent visuals, captions and the code-music studies remain usable. Lesson scripts/manifests and opt-in generation commands remain for users with their own service account and rights; see [voice setup](../shared/voice/README.md) and [licensing](../docs/licensing.md). Old example notes that describe delivered local narration or Blender files record the development workspace, not a promise that those ignored files are in a fresh clone.

## Teaching models

`npm run studio -- generate robot-joint`, `npm run studio -- generate planetary-gears` and `npm run studio -- generate gearbox` rebuild the named original models, identities, provenance and music locally. They do not fetch an external model. For a different description, the agent authors a specification, builder and working adapter following [original generation](../.agents/skills/mechanism-studio/references/original-generation.md); the CLI is not a generic prompt-to-CAD API.

The [robot joint](robot-joint/README.md) extends the original planetary geometry at 0.6 scale with a newly authored motor, sensing representations and output flange. It has 129 occurrences, 44 geometry definitions and five subassemblies beneath its root. Its 12 winding packs and 14 magnet blocks are separate geometry; the 4:1 reducer and two detailed bearings use ideal kinematics. Its builder, Atlas story and original score are MIT. Electromagnetics, torque, heat, contact loads and manufacturing tolerances are not solved.

The [planetary set](planetary-gears/README.md) and [five-speed gearbox](gearbox/README.md)
have original parameterized Node.js builders, included GLBs and ideal tooth-ratio
motion. The planetary reducer has 80 independently identified components using
29 geometry definitions: the original 21 transmission parts plus 59 enclosure,
fastening, sealing and shaft-support parts. It retains plain planet bushings
and adds two 13-component ball bearings. Their ideal rolling kinematics follow
the input/output shafts; one bearing is dismantled, seated and driven in close-up.
No bearing contact, slip or load is solved. Its 36-second presentation, authored geometry and music are MIT; no Blender or
third-party mesh download is needed to rebuild it. Authored separation remains
a display choice, not a validated maintenance procedure.

The [lock](../prototype-3d/README.md), [inline-four](inline-four/README.md), [turbofan](turbofan/README.md) and [quadruped](quadruped/README.md) have authored geometry, explicit dimensions/assumptions and a model-owned working state. Their source code, builders and GLB exports are under the project's MIT license. Blender 4.5 LTS is the documented build environment; it is not needed for viewing.

Read the mechanism's model and README before using its diagrams as engineering evidence. The lock has ideal pin-stack alignment; the engine uses prescribed kinematics and process cues; the turbofan does not solve a thermodynamic cycle; the quadruped has no balance/contact-force solver. Their explosion controls are observation states, separate from working motion.

## Source-based specimens

| Specimen | Source and identity | Asset license and limits |
| --- | --- | --- |
| [Allegro right hand](allegro-hand/README.md) | SimLab / Wonik Robotics model via MuJoCo Menagerie; retained MJCF bodies, sixteen hinges and visual meshes | Model-specific BSD-2-Clause; source-link geometry, no separate tendons, motors, screws or force/contact model |
| [Robotiq 2F-85 v4](robotiq-gripper/README.md) | ROS-Industrial / Robotiq model via MuJoCo Menagerie; retained hinge axes, limits and loop-closure constraints | Model-specific BSD-2-Clause; analytic linkage visualization on the authored free-space branch, not a dynamics or gripping-force model |
| [Unitree G1](humanoid/README.md) | Unitree Robotics / Menagerie MJCF; 30 source bodies, 35 visual occurrences, 29 hinge declarations, 393,270 triangles | BSD-3-Clause at model-directory scope. Static zero-joint source pose; merged link visuals, no individual screws or actuator internals. |
| [SO-ARM 102](../EXAMPLE_ROBOT/README.md) | Robonine simulation URDF and STL meshes; 8 links, 7 joints, 62,064 triangles | CC BY 4.0 under the upstream file-level map. Selected simulation files only; hardware elsewhere has different terms. |

Each source folder retains the pinned upstream revision, source links, hashes and a change notice. Never label all example files MIT. The new whole-repository MIT license applies to original implementation code; [third-party notices](../THIRD_PARTY_NOTICES.md) and [license scope](../docs/licensing.md) identify asset exceptions.

The robot kinetic adapter reads five revolute and two prismatic joints, including the opposed-jaw mimic relation. It resets working poses before display explosion. This is source-backed kinematics, not validated motor control, collision checking or per-screw disassembly. It provides no general CAD mate, contact or dynamics solver.

## Reproduction and checks

Before running the full suite, make Python 3 available as `python` on Windows,
`python3` elsewhere, or through `MECHANISM_PYTHON`. Tests use it for the MJCF
parser even when using the included GLBs. The first test run also fetches pinned
source meshes; viewing does not require this download or Python. FFmpeg-dependent
integration checks skip explicitly when the tools are absent.

```sh
npm test
npm run release:check
npm run check:delivery -- --manifest examples/allegro-hand/delivery.json
```

The Allegro [delivery record](allegro-hand/delivery.json) fingerprints the
recorded inputs, evidence and local outputs. Its checker treats absent ignored
local files as unavailable in a fresh clone; changed files or missing repository
assets fail. Add `--require-local` when checking a complete local delivery. The
[delivery rules](../.agents/skills/mechanism-studio/references/delivery-evidence.md)
separate implementation, verification, export and publication; a matching hash
does not independently validate a mechanical claim or a recorded review.

Use [CAD import setup](../tools/cad/README.md) and [XCAF setup](../tools/cad/README-xcaf.md) before rebuilding engineering derivatives. The root `npm run import:cad -- --example examples/<name>` command requires a supported source package and project-local OCCT backend; it does not generate a new viewer page or recover joints.

`npm run build:audio` runs every music build below and verifies each recorded hash. Individual music rebuild commands include `node EXAMPLE_ROBOT/audio/build.mjs` and `node EXAMPLE_ROBOT/kinetic/audio/build.mjs`. Rebuilding visual assets may require the example's documented Python/Blender environment. Recording is separate from viewing: deterministic capture plus [video encoding](../tools/video/README.md) can produce an MP4, while captured frames, exports and browser review screenshots remain local ignored outputs.

The humanoid rebuilds with `node examples/humanoid/build-humanoid.mjs` (Node and
Python 3 standard library) and `node examples/humanoid/audio/build.mjs` (Node,
retained CC0 samples). Read its [detail limits](humanoid/README.md#source-identity-and-detail-limits)
before treating a source-body explosion as a deeper engineering teardown.

## Adding another example

Follow the [skill guide](../docs/skill-guide.md) and [module catalog](../docs/modules.md). Begin with an input brief, then author actual component geometry, a part list, stable definition/occurrence IDs, assembly parents and explicit mate assumptions. Use source import when the user supplies CAD or asks for an existing assembly. Reuse the explosion/camera/appearance handoffs and select Mating Close-up for an evidenced component relationship. Bind plans to working runtime adapters, test seek/reset/loop invariants, and document unsupported claims. Original teaching meshes are not validated manufacturing CAD; authored hidden parts must not be presented as facts about a photographed or imported device.
