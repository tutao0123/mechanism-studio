# What is actually in the examples?

Audit date: **2026-10-19**. This inventory describes retained source files and
implemented entry points, not every local development export. There are **ten
implemented experiences**, including the gearbox, Allegro hand and Robotiq gripper. The English Showcase
offers further cuts of the same engine, turbofan and quadruped models; those
are not three more independently modeled assemblies.

## Implemented examples

Run commands from the repository root after `npm ci`. The root server and the
specialized study servers use separate, read-only route allowlists.

The [19 October robot integration report](robot-studies-release.md) records the
Allegro and Robotiq compatibility checks after the upstream shared-runtime sync.
Their 18 October validation notes and delivery manifests remain historical
records of earlier inputs; they do not certify the current runtime or an MP4.

| Experience | Actual location / implementation | Open after starting the server | Current boundary |
| --- | --- | --- | --- |
| Five-speed gearbox | `examples/gearbox/`: original authored spec, exact-ratio kinematics, 124-part GLB in 15 nested assemblies, deterministic story/score, plans and tests | `node examples/gearbox/serve.mjs` → [40 s study](http://127.0.0.1:4183/?clean=1), [blueprint edition](http://127.0.0.1:4183/blueprint/?clean=1) | Original teaching model; ideal rigid tooth ratios and authored synchronizer timing; no load, friction, clutch or contact simulation |
| Allegro dexterous hand | `examples/allegro-hand/`: pinned MJCF/STL, source-body GLB, joint adapter, story and source-bound music | Build score below; `node examples/allegro-hand/serve.mjs` → [35.56 s hand](http://127.0.0.1:4185/?clean=1) | Sixteen hinges; motion stays in source limits, valid neutral pose differs from XML zero reference; no tendon/force model or fastener internals |
| Robotiq 2F-85 gripper | `examples/robotiq-gripper/`: pinned source meshes, six-hinge linkage model, source connect constraints and story | Build score below; `node examples/robotiq-gripper/serve.mjs` → [35.56 s gripper](http://127.0.0.1:4186/?clean=1) | Analytic closed linkage on an authored free-space branch; no object-contact, force or hardware-control validation |
| Unitree G1 humanoid | `examples/humanoid/`: retained complete 29-DoF model visual source, 30 source-body identities, GLB, deterministic story/score and tests | `node examples/humanoid/serve.mjs` → [35.56 s study](http://127.0.0.1:4182/?clean=1) | Static source-pose/link-level separation; no per-screw or actuator internals, native CAD or dynamics claim |
| Five-pin lock | `prototype-3d/`: GLB, controller, line art, key profiles, Blender builder and lesson | `npm run preview` → [lock](http://127.0.0.1:4179/prototype-3d/?palette=line-light) | Authored teaching geometry, idealized pin stack; no lock tolerancing/contact solver |
| Inline-four engine | `examples/inline-four/`: 25 tracked files in the audited release, including GLB, crank/valve/process model and tests | Root server → [engine](http://127.0.0.1:4179/examples/inline-four/) | Prescribed kinematics and qualitative injection/ignition; no combustion simulation |
| Two-spool turbofan | `examples/turbofan/`: 16 tracked files, including GLB, shaft/process model and tests | Root server → [turbofan](http://127.0.0.1:4179/examples/turbofan/) | Teaching rotors/stators and flow, no thermodynamic or CFD solver |
| Small quadruped | `examples/quadruped/`: 18 tracked files, including GLB, FK/IK model, previews and tests | Root server → [quadruped](http://127.0.0.1:4179/examples/quadruped/) | Fixed-body gait/IK illustration, no dynamic balance/contact-force solver |
| SO-ARM 102 assembly study | `EXAMPLE_ROBOT/`: URDF/STL source, GLB, group plans, score and runtime adapter | `node EXAMPLE_ROBOT/serve.mjs` → [34.3 s study](http://127.0.0.1:4180/?clean=1) | Eight merged source links, grouped observation explosion, not per-screw disassembly |
| SO-ARM 102 kinetic cut | `EXAMPLE_ROBOT/kinetic/`: source-joint adapter, own timeline/score/tests; the whole robot tree has 88 tracked files | Same robot server → [25.7 s kinetic cut](http://127.0.0.1:4180/kinetic/?clean=1) | Source-backed joints and opposed jaws, no hardware-safe control/dynamics claim |

The file counts above are a fixed audit snapshot of Git-tracked files and
exclude dependencies, caches and ignored local outputs. They measure package
contents, not completeness or quality. Source licenses differ: read the
[example guide](../examples/README.md) and [third-party notices](../THIRD_PARTY_NOTICES.md).

## Why some folders can look unfinished on GitHub

The new Allegro and Robotiq music loops are local deterministic outputs. Build
them with `node tools/audio/build-study-score.mjs --example examples/allegro-hand`
and `node tools/audio/build-study-score.mjs --example examples/robotiq-gripper`.
They share the [music tool](../tools/audio/README.md) and a narrowly supported
[MJCF visual exporter](../tools/robot/README.md); neither is an automatic CAD
reconstruction or arbitrary robot-dynamics service.
Their source and GLBs are included. Python is needed only for optional geometry
rebuilding; the Node.js preview and score commands do not require it. Each study
uses its documented dedicated server, not a root-server `/examples/` route.

- **The lock and robot are outside `examples/`.** The lock predates that layout;
  the two SO-ARM cuts live in `EXAMPLE_ROBOT/`. They are real implementations.
- **`lock-comparison/` is historical.** Its one large `anatomy.html` is an early,
  self-contained comparison artifact, not a promised new CAD example. Its
  [new guide](../examples/lock-comparison/README.md) points to the maintained lock.
- **The previous root gallery was stale.** It showed only four teaching models
  and two STEP pages. The robot studies were discoverable only through
  documentation and need their own explicit server command. The updated gallery
  exposes those commands and links.
- **Generated delivery files are intentionally absent.** MP4s, captured frames,
  machine-specific `.blend` exports and provider-generated MP3s stay ignored.
  Model GLBs, source builders, music synthesis code, lessons, provenance and
  tests are retained. Code-music WAVs are not bundled: `npm run build:audio`
  renders every study score once and checks its recorded hash. Missing optional media is
  different from a missing model.
- **GitHub does not execute the pages.** A repository folder is source browsing.
  Clone and run the documented local server to load Three.js, models and audio.

The public package does not promise narration on a fresh clone. New narration
uses the [optional provider-neutral API](../shared/voice/README.md); old Doubao
lessons retain their own manifests and local-only recordings. Silent viewing
and the code-music studies do not need a speech account.

## Status vocabulary for additions

Use **concept** for a documented plan without a bound model, **implemented**
for real files and a runnable entry point, and **checked** only with a named
verification report. A new imported model is not automatically a native CAD
workflow; an exported video is not proof of validated dynamics. New examples
should provide a README, source/license record, working route, representative
preview, reproduction command and explicit limitations before being promoted.
