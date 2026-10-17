# Example guide

Choose an example by the evidence it can demonstrate: a teaching model, a source assembly inspector, or a short presentation. All commands below run from the Mechanism Studio repository root after `npm ci`.

## Viewing routes

| Example | Server command | Local route | Included experience |
| --- | --- | --- | --- |
| Five-pin lock | `npm run preview` | `http://127.0.0.1:4179/prototype-3d/?palette=line-light` | Key profiles, insertion and turning, shear-line view, camera presets and display explosion |
| Inline-four | `npm run preview` | `http://127.0.0.1:4179/examples/inline-four/` | Crank-slider motion, valve timing, port spray, ignition and exhaust cues |
| Two-spool turbofan | `npm run preview` | `http://127.0.0.1:4179/examples/turbofan/` | Independent shaft controls, rotor/stator groups and core/bypass flow |
| Small quadruped | `npm run preview` | `http://127.0.0.1:4179/examples/quadruped/` | Leg controls, FK/IK, limits, foot path, diagonal gait and explosion |
| English story pages | `npm run preview` | `http://127.0.0.1:4179/showcase/?story=quadruped&clean=1` | Timed camera, captions and near-part labels; short/full quadruped editions |
| KFL08 STEP trial | `npm run preview` | `http://127.0.0.1:4179/examples/step-assembly/` | Historical import with explicit identity-mapping limits |
| Galileo 2 inspector | `npm run preview` | `http://127.0.0.1:4179/examples/shaft-bearing/` | Source tree, repeated occurrences, mesh selection, hide/isolate and restoration |
| SO-ARM 102 assembly study | `node EXAMPLE_ROBOT/serve.mjs` | `http://127.0.0.1:4180/?clean=1` | 34.285714-second music-driven exploded view and restoration |
| SO-ARM 102 kinetic cut | `node EXAMPLE_ROBOT/serve.mjs` | `http://127.0.0.1:4180/kinetic/?clean=1` | 25.714286-second source-backed joint motion and assembly edit |
| WOLF actuator | `node examples/wolf-actuator/serve.mjs` | `http://127.0.0.1:4181/?clean=1` | 34.285714-second real STEP-derived music study |

The root server handles the studio and original mechanisms; robot and WOLF studies use their own explicit read-only route allowlists. `clean=1` removes surrounding presentation chrome where that page supports it. It does not change source credit or engineering claims. Do not infer other URL options from an authoring mode name.

## What a fresh clone includes

- GLB display geometry, scene contracts, models, lessons, source/provenance records and implementation adapters.
- Original code-synthesized WAV music and its deterministic synthesis source for the robot and WOLF studies. Click **Play with music** to enable audio; the media clock controls motion, camera, labels and effects together.
- Blender Python builders for the original teaching models. Local `.blend` exports remain on the author's machine because their binary metadata embeds machine-specific paths; rebuild them if needed.
- Original third-party CAD/URDF files with licenses. Galileo also retains its upstream native Fusion source. These assets are separately licensed from the MIT runtime.

Provider-generated Doubao MP3s are deliberately not in the public source release: the reviewed material did not establish a downstream MIT sublicensing grant. This is not a claim that using Doubao output is prohibited. Silent visuals, captions and the code-music studies remain usable. Lesson scripts/manifests and opt-in generation commands remain for users with their own service account and rights; see [voice setup](../shared/voice/README.md) and [licensing](../docs/licensing.md). Old example notes that describe delivered local narration or Blender files record the development workspace, not a promise that those ignored files are in a fresh clone.

## Teaching models

The [lock](../prototype-3d/README.md), [inline-four](inline-four/README.md), [turbofan](turbofan/README.md) and [quadruped](quadruped/README.md) have authored geometry, explicit dimensions/assumptions and a model-owned working state. Their source code, builders and GLB exports are under the project's MIT license. Blender 4.5 LTS is the documented build environment; it is not needed for viewing.

Read the mechanism's model and README before using its diagrams as engineering evidence. The lock has ideal pin-stack alignment; the engine uses prescribed kinematics and process cues; the turbofan does not solve a thermodynamic cycle; the quadruped has no balance/contact-force solver. Their explosion controls are observation states, separate from working motion.

## Source-based specimens

| Specimen | Source and identity | Asset license and limits |
| --- | --- | --- |
| [KFL08](step-assembly/README.md) | FreeCAD-library model by hasecilu; 22 leaf instances and 7 subassembly instances | CC BY 3.0. Historical display has 35 fragments; only partial source mapping. |
| [Galileo 2](shaft-bearing/README.md) | JaredC01 and contributors; OCCT XCAF retains 69 definitions, 146 usages and 147 root-inclusive occurrences | GPL v3 for CAD source and derivatives. Includes original STEP, preferred native Fusion source and license. Six faces required recorded meshing retries. |
| [WOLF](wolf-actuator/README.md) | Anthrobotics V1.2 STEP; 184 definitions, 252 usages, 245 leaf occurrences | CC BY-SA 4.0 for the model and adapted visual presentation. Includes source-triangulated bearing geometry; not all geometry is analytic. |
| [SO-ARM 102](../EXAMPLE_ROBOT/README.md) | Robonine simulation URDF and STL meshes; 8 links, 7 joints, 62,064 triangles | CC BY 4.0 under the upstream file-level map. Selected simulation files only; hardware elsewhere has different terms. |

Each source folder retains the pinned upstream revision, source links, hashes and a change notice. Never label all example files MIT. The new whole-repository MIT license applies to original implementation code; [third-party notices](../THIRD_PARTY_NOTICES.md) and [license scope](../docs/licensing.md) identify asset exceptions.

The robot kinetic adapter reads five revolute and two prismatic joints, including the opposed-jaw mimic relation. It resets working poses before display explosion. This is source-backed kinematics, not validated motor control, collision checking or per-screw disassembly. WOLF's movement is authored observation separation; it has no gear/contact/mate solver.

## Reproduction and checks

```sh
npm test
npm run release:check
npm run audit:cad -- --example examples/shaft-bearing
npm run audit:cad -- --example examples/wolf-actuator
```

Use [CAD import setup](../tools/cad/README.md) and [XCAF setup](../tools/cad/README-xcaf.md) before rebuilding engineering derivatives. The root `npm run import:cad -- --example examples/<name>` command requires a supported source package and project-local OCCT backend; it does not generate a new viewer page or recover joints.

Music rebuild commands are `node EXAMPLE_ROBOT/audio/build.mjs`, `node EXAMPLE_ROBOT/kinetic/audio/build.mjs`, and `node examples/wolf-actuator/audio/build.mjs`. Rebuilding visual assets may require the example's documented Python/Blender environment. Recording is separate from viewing: deterministic capture plus [video encoding](../tools/video/README.md) can produce an MP4, while captured frames, exports and browser review screenshots remain local ignored outputs.

## Adding another example

Follow the [skill guide](../docs/skill-guide.md) and [module catalog](../docs/modules.md). Begin with an input brief, provenance and real part IDs. Reuse the explosion/camera/appearance handoffs, bind them to existing runtime adapters, test seek/reset/loop invariants, and document unsupported claims. A text prompt or image supplies a design brief; it does not prove hidden fasteners, native CAD identity or assembly constraints.
