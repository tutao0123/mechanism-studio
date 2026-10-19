# What is actually in the examples?

Audit date: **2026-10-19**. This inventory describes retained source files and
implemented entry points, not every local development export. There are **eleven
implemented experiences**, including the new gearbox. The English Showcase
offers further cuts of the same engine, turbofan and quadruped models; those
are not three more independently modeled assemblies.

## Implemented examples

Run commands from the repository root after `npm ci`. The root server and the
specialized study servers use separate, read-only route allowlists.

| Experience | Actual location / implementation | Open after starting the server | Current boundary |
| --- | --- | --- | --- |
| Five-speed gearbox | `examples/gearbox/`: original authored spec, exact-ratio kinematics, 124-part GLB in 15 nested assemblies, deterministic story/score, plans and tests | `node examples/gearbox/serve.mjs` → [40 s study](http://127.0.0.1:4183/?clean=1), [blueprint edition](http://127.0.0.1:4183/blueprint/?clean=1) | Original teaching model; ideal rigid tooth ratios and authored synchronizer timing; no load, friction, clutch or contact simulation |
| Unitree G1 humanoid | `examples/humanoid/`: retained complete 29-DoF model visual source, 30 source-body identities, GLB, deterministic story/score and tests | `node examples/humanoid/serve.mjs` → [35.56 s study](http://127.0.0.1:4182/?clean=1) | Static source-pose/link-level separation; no per-screw or actuator internals, native CAD or dynamics claim |
| Five-pin lock | `prototype-3d/`: GLB, controller, line art, key profiles, Blender builder and lesson | `npm run preview` → [lock](http://127.0.0.1:4179/prototype-3d/?palette=line-light) | Authored teaching geometry, idealized pin stack; no lock tolerancing/contact solver |
| Inline-four engine | `examples/inline-four/`: 25 tracked files in the audited release, including GLB, crank/valve/process model and tests | Root server → [engine](http://127.0.0.1:4179/examples/inline-four/) | Prescribed kinematics and qualitative injection/ignition; no combustion simulation |
| Two-spool turbofan | `examples/turbofan/`: 16 tracked files, including GLB, shaft/process model and tests | Root server → [turbofan](http://127.0.0.1:4179/examples/turbofan/) | Teaching rotors/stators and flow, no thermodynamic or CFD solver |
| Small quadruped | `examples/quadruped/`: 18 tracked files, including GLB, FK/IK model, previews and tests | Root server → [quadruped](http://127.0.0.1:4179/examples/quadruped/) | Fixed-body gait/IK illustration, no dynamic balance/contact-force solver |
| KFL08 STEP trial | `examples/step-assembly/`: 14 tracked files, retained STEP, GLB and import reports | Root server → [STEP trial](http://127.0.0.1:4179/examples/step-assembly/) | Historical fragment mapping is incomplete; not the strongest identity inspector |
| Galileo 2 assembly inspector | `examples/shaft-bearing/`: 15 tracked files, native Fusion + STEP source, occurrence manifest, GLB and tests | Root server → [inspector](http://127.0.0.1:4179/examples/shaft-bearing/) | Tree/model linked selection and repeated occurrences; no recovered joint constraints |
| SO-ARM 102 assembly study | `EXAMPLE_ROBOT/`: URDF/STL source, GLB, group plans, score and runtime adapter | `node EXAMPLE_ROBOT/serve.mjs` → [34.3 s study](http://127.0.0.1:4180/?clean=1) | Eight merged source links, grouped observation explosion, not per-screw disassembly |
| SO-ARM 102 kinetic cut | `EXAMPLE_ROBOT/kinetic/`: source-joint adapter, own timeline/score/tests; the whole robot tree has 88 tracked files | Same robot server → [25.7 s kinetic cut](http://127.0.0.1:4180/kinetic/?clean=1) | Source-backed joints and opposed jaws, no hardware-safe control/dynamics claim |
| WOLF actuator | `examples/wolf-actuator/`: retained STEP, 245-leaf occurrence graph, GLB, whole/component cuts and continuous tour adapters | Build shared score below; `node examples/wolf-actuator/serve.mjs` → [85.71 s v4 tour](http://127.0.0.1:4181/tour-v4/); earlier [68.57 s v1 tour](http://127.0.0.1:4181/tour/?clean=1) and 34.3 s [whole](http://127.0.0.1:4181/?clean=1), [motor](http://127.0.0.1:4181/detail/?clean=1) and [bearing](http://127.0.0.1:4181/bearing/?clean=1) cuts remain | Source-bound ideal gear/bearing kinematics and phase/direction cues; CAD-derived −31.5:1 differs from upstream 34:1. Bearing model neglects 10 μm clearance; no recovered mates, full B-rep contact or dynamics validation |

The file counts above are a fixed audit snapshot of Git-tracked files and
exclude dependencies, caches and ignored local outputs. They measure package
contents, not completeness or quality. Source licenses differ: read the
[example guide](../examples/README.md) and [third-party notices](../THIRD_PARTY_NOTICES.md).

The latest WOLF [tooth-pair and direction edition](../examples/wolf-actuator/tour-v4/README.md)
opens at [`/tour-v4/`](http://127.0.0.1:4181/tour-v4/) on its dedicated server.
It adds subtle source-tooth highlights and short arcs distinguishing sun/planet
spin from the planet center's orbit, while retaining the v3 camera, v2 mechanics,
magnet/roller close-ups and full reassembly. The authored timeline is
**85.714286 seconds: 160 beats at 112 BPM**. The recorded 30 fps MP4 contains
2,572 frames and lasts **85.733333 seconds**. Its [edition guide](../examples/wolf-actuator/tour-v4/README.md#validation-and-export-status)
records completed local capture and verification; MP4s and detailed local reports
remain ignored outputs. Fresh clones include the renderer and source; the recorded
film is a separate generated artifact.
The portable [delivery record](../examples/wolf-actuator/tour-v4/delivery.json)
lists file fingerprints and the scope of each recorded check. Run
`npm run check:delivery -- --manifest examples/wolf-actuator/tour-v4/delivery.json`
from the root to check integrity. Missing local reports or video are unavailable
on a fresh clone, not a claim that their recorded reviews were rerun. Add
`--require-local` when the complete local delivery is expected.
The cues explain source-based phase and relative motion, without solving loaded
contact or changing the retained gear-ratio discrepancy.

On a fresh checkout, build the shared local score before playing v2, v3 or v4:

```sh
node examples/wolf-actuator/tour-v2/audio/build.mjs
node examples/wolf-actuator/serve.mjs
```

The long WAV is excluded from Git; its deterministic source and score are
retained. The server defaults to port **4181**; use its printed address when
`PORT` is overridden. The earlier [v3 tooth-interface edition](../examples/wolf-actuator/tour-v3/README.md)
at [`/tour-v3/`](http://127.0.0.1:4181/tour-v3/) remains available with the same
85.71-second timeline and original close-up camera, without the v4 pair cues.
These are editions of WOLF, not additional independently modeled assemblies.

The WOLF detail edition reuses the existing source assembly. Its v2 cut adds
continuous camera direction, a close-up of one real magnet and a newly synthesized
score bound to those movements; it does not add an eleventh independent model. It shows a real source motor
subassembly and components, separate from the G1 body-level example. Unknown
source-name functions remain unknown, and no G1 internals are inferred from it.

The [bearing study](../examples/wolf-actuator/bearing/README.md) adds another
34.3-second cut of the same WOLF source at `/bearing/?clean=1` on its server:
70 actual bearing-A leaves, four larger layers, 66 small components and a
close-up/return of the original Part 1. Generic source names remain generic.
The bearing recording and motor video edition 3 use a separate, larger capture
type hierarchy; both retain the existing interactive page style. Local recordings
remain ignored output artifacts, rather than another imported CAD model.

The [complete WOLF tour](../examples/wolf-actuator/tour/README.md) connects those
views into **one 245-leaf source scene and one music clock**: whole assembly →
illustrative input rotation → motor and one real magnet → bearing A and its
original Part 1 → full restoration. Its 128 beats at 112 BPM last 68.571429
seconds. The motor restores before the bearing opens, and both component
studies restore before the overall actuator closes. Input rotation is an
authored limited illustration, not a solved transmission, contact model or
recovered CAD constraint. See the retained [motion evidence](../examples/wolf-actuator/tour/motion-evidence.md).
The [tour review page](http://127.0.0.1:4181/tour/review.html) is the entry point
for a separately generated local MP4. This v1 entry records the implemented
tour and source files; it does not claim completed capture or encoded-video
verification for that older edition. Earlier cuts remain available, and the tour adds no independently
imported assembly to the experience count.

The retained [v2 complete motion tour](../examples/wolf-actuator/tour-v2/README.md)
extends that same source scene to **160 beats at 112 BPM / 85.714286 seconds**.
The gear operating passage occupies beats 20–44; an internally assembled bearing
operating passage occupies beats 88–104. The existing magnet and small-part
close-ups, complete restoration, white-line style and original music palette
remain. Gear counts are independently measured as sun 96, planets 24, output
rings 144 and fixed toothed plates 156. Their ideal signed ratio is −31.5:1,
with the upstream 34:1 specification still an unresolved discrepancy. The
modular-bearing generator and source geometry positively identify the old
generic `Part 1` as a roller; source names are preserved alongside the new alias.
The bearing model assumes ideal no slip and neglects the source's 10 μm rolling
clearance. See [gear evidence](../examples/wolf-actuator/tour/research-v2/gear-evidence.md)
and [bearing evidence](../examples/wolf-actuator/tour/research-v2/bearing-evidence.md).
That edition's [review page](http://127.0.0.1:4181/tour-v2/review.html) loads its
separately generated local film when available. The v4 delivery verification
described above applies to the v4 output, not automatically to other recordings.
All older cuts remain.

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
  Model GLBs, source builders, music synthesis code, lessons, provenance and
  tests are retained. Earlier code-music WAVs are bundled; the longer WOLF
  v2/v3/v4 WAV must be built with the command above. Missing optional media is
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
