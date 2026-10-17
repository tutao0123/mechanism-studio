# What is actually in the examples?

Audit date: **2026-10-18**. This inventory describes retained source files and
implemented entry points, not every local development export. There are **ten
implemented experiences**, including the new humanoid. The English Showcase
offers further cuts of the same engine, turbofan and quadruped models; those
are not three more independently modeled assemblies.

## Implemented examples

Run commands from the repository root after `npm ci`. The root server and the
specialized study servers use separate, read-only route allowlists.

| Experience | Actual location / implementation | Open after starting the server | Current boundary |
| --- | --- | --- | --- |
| Unitree G1 humanoid | `examples/humanoid/`: retained complete 29-DoF model visual source, 30 source-body identities, GLB, deterministic story/score and tests | `node examples/humanoid/serve.mjs` → [35.56 s study](http://127.0.0.1:4182/?clean=1) | Static source-pose/link-level separation; no per-screw or actuator internals, native CAD or dynamics claim |
| Five-pin lock | `prototype-3d/`: GLB, controller, line art, key profiles, Blender builder and lesson | `npm run preview` → [lock](http://127.0.0.1:4179/prototype-3d/?palette=line-light) | Authored teaching geometry, idealized pin stack; no lock tolerancing/contact solver |
| Inline-four engine | `examples/inline-four/`: 25 tracked files in the audited release, including GLB, crank/valve/process model and tests | Root server → [engine](http://127.0.0.1:4179/examples/inline-four/) | Prescribed kinematics and qualitative injection/ignition; no combustion simulation |
| Two-spool turbofan | `examples/turbofan/`: 16 tracked files, including GLB, shaft/process model and tests | Root server → [turbofan](http://127.0.0.1:4179/examples/turbofan/) | Teaching rotors/stators and flow, no thermodynamic or CFD solver |
| Small quadruped | `examples/quadruped/`: 18 tracked files, including GLB, FK/IK model, previews and tests | Root server → [quadruped](http://127.0.0.1:4179/examples/quadruped/) | Fixed-body gait/IK illustration, no dynamic balance/contact-force solver |
| KFL08 STEP trial | `examples/step-assembly/`: 14 tracked files, retained STEP, GLB and import reports | Root server → [STEP trial](http://127.0.0.1:4179/examples/step-assembly/) | Historical fragment mapping is incomplete; not the strongest identity inspector |
| Galileo 2 assembly inspector | `examples/shaft-bearing/`: 15 tracked files, native Fusion + STEP source, occurrence manifest, GLB and tests | Root server → [inspector](http://127.0.0.1:4179/examples/shaft-bearing/) | Tree/model linked selection and repeated occurrences; no recovered joint constraints |
| SO-ARM 102 assembly study | `EXAMPLE_ROBOT/`: URDF/STL source, GLB, group plans, score and runtime adapter | `node EXAMPLE_ROBOT/serve.mjs` → [34.3 s study](http://127.0.0.1:4180/?clean=1) | Eight merged source links, grouped observation explosion, not per-screw disassembly |
| SO-ARM 102 kinetic cut | `EXAMPLE_ROBOT/kinetic/`: source-joint adapter, own timeline/score/tests; the whole robot tree has 88 tracked files | Same robot server → [25.7 s kinetic cut](http://127.0.0.1:4180/kinetic/?clean=1) | Source-backed joints and opposed jaws, no hardware-safe control/dynamics claim |
| WOLF actuator | `examples/wolf-actuator/`: retained STEP, real occurrence graph, GLB, plans, score/tests and a separate motor-detail adapter | `node examples/wolf-actuator/serve.mjs` → [whole study](http://127.0.0.1:4181/?clean=1) / [motor detail edition](http://127.0.0.1:4181/detail/?clean=1), both 34.3 s | Actual 86-leaf motor source: 40 `magnet`, 40 unspecified `cc`, six named hardware leaves; editorial separation, no contact/mate solver |

The file counts above are a fixed audit snapshot of Git-tracked files and
exclude dependencies, caches and ignored local outputs. They measure package
contents, not completeness or quality. Source licenses differ: read the
[example guide](../examples/README.md) and [third-party notices](../THIRD_PARTY_NOTICES.md).

The WOLF detail edition reuses the existing source assembly and original WAV;
it does not add an eleventh independent model. It shows a real source motor
subassembly and components, separate from the G1 body-level example. Unknown
source-name functions remain unknown, and no G1 internals are inferred from it.

## Why some folders can look unfinished on GitHub

- **The lock and robot are outside `examples/`.** The lock predates that layout;
  the two SO-ARM cuts live in `EXAMPLE_ROBOT/`. They are real implementations.
- **`lock-comparison/` is historical.** Its one large `anatomy.html` is an early,
  self-contained comparison artifact, not a promised new CAD example. Its
  [new guide](../examples/lock-comparison/README.md) points to the maintained lock.
- **The previous root gallery was stale.** It showed only four teaching models
  and two STEP pages. The robot and WOLF studies were discoverable only through
  documentation and need their own explicit server command. The updated gallery
  exposes those commands and links.
- **Generated delivery files are intentionally absent.** MP4s, captured frames,
  machine-specific `.blend` exports and provider-generated MP3s stay ignored.
  Model GLBs, source builders, original code-music WAVs, lessons, provenance and
  tests are retained. Missing optional media is different from a missing model.
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
