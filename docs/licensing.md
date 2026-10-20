# Licensing and source-asset policy

Mechanism Studio's original code, skill instructions, documentation and original
teaching geometry are licensed under [MIT](../LICENSE), copyright 2026 TuTao.
Third-party material keeps its own license. A repository-level MIT badge is not a
license grant over every CAD model, recording or dependency in the repository.

## What the licenses apply to

| Material | Scope | License and retained evidence |
| --- | --- | --- |
| Mechanism Studio | Original `.agents/skills/mechanism-studio/` workflows, scripts, shared runtime, example adapters, lesson text and procedural lock/inline-four/turbofan/quadruped geometry | MIT; [project license](../LICENSE). Existing upstream notices remain applicable to adapted workflow material. |
| Anatomy workflow lineage | Mechanism-first explanation, one model for motion and readouts, staged verification and rendered-view review informed early skill text | MIT, Ryan; [full notice](../THIRD_PARTY_NOTICES.md#anatomy). No sibling checkout, Anatomy drawing kit or runtime is needed. |
| Allegro right hand | `examples/allegro-hand/source/`, source-derived `assets/`, screenshots and animation | Model-specific BSD-2-Clause, SimLab. [Full license](../examples/allegro-hand/source/LICENSE) and [pinned provenance](../examples/allegro-hand/source/provenance.json). Retain copyright, conditions and disclaimer with binary/visual redistribution. |
| Robotiq 2F-85 v4 | `examples/robotiq-gripper/source/`, source-derived `assets/`, screenshots and animation | Model-specific BSD-2-Clause, ROS-Industrial. [Full license](../examples/robotiq-gripper/source/LICENSE) and [pinned provenance](../examples/robotiq-gripper/source/provenance.json); not the Menagerie repository-wide license. |
| Unitree G1 visual description | `examples/humanoid/source/unitree_g1/` retained XML, LICENSE, README and changelog, with STL meshes fetched from the pinned upstream commit; source-derived `assets/` data and G1 screenshots/animations, including `docs/media/humanoid-g1-preview.jpg` | BSD-3-Clause, Unitree Robotics, under the **individual model directory's** license. [Full notice](../examples/humanoid/source/unitree_g1/LICENSE), [pinned provenance](../examples/humanoid/source/provenance.json), [conversion and limits](../examples/humanoid/source/README.md). The Menagerie repository's general Apache license is not substituted. |
| SO-ARM 102 | `EXAMPLE_ROBOT/source/` selected upstream documentation, URDF/Xacro and metadata, with STL meshes fetched from the pinned upstream commit; `EXAMPLE_ROBOT/assets/` source-derived geometry/identity data; screenshots or recordings depicting that geometry, including `docs/media/so-arm102-kinetic.jpg` | CC BY 4.0, Robonine; [license map](../EXAMPLE_ROBOT/source/LICENSING.md), [full license](../EXAMPLE_ROBOT/source/DOCS-LICENSE.txt), [hashes and changes](../EXAMPLE_ROBOT/source/provenance.json). The upstream hardware license is retained as contextual evidence, but hardware-design directories were not imported. |
| KFL08 | `examples/step-assembly/source/kfl08.step` (fetched from the pinned upstream commit) and source-derived `examples/step-assembly/assets/` | CC BY 3.0, hasecilu; [full license](../examples/step-assembly/source/CC-BY-3.0.txt), [notice](../examples/step-assembly/source/LICENSE.md), [provenance](../examples/step-assembly/source/provenance.json). |
| WOLF V1.2 | Upstream license and README in `examples/wolf-actuator/source/` (STEP and assembly guide fetched from the pinned upstream commit), source-derived `examples/wolf-actuator/assets/`, and adapted WOLF visual presentations/renders | CC BY-SA 4.0, Anthrobotics and contributors; [full license](../examples/wolf-actuator/source/LICENSE), [notice](../examples/wolf-actuator/source/NOTICE.md), [hashes](../examples/wolf-actuator/source/provenance.json). Keep the upstream acknowledgement of Robin Fröjd's RFX gearbox. |
| Original music | Code synthesis source, score JSON and original composition under `EXAMPLE_ROBOT/audio/`, `EXAMPLE_ROBOT/kinetic/audio/`, `examples/wolf-actuator/audio/` and `examples/humanoid/audio/` | MIT for original composition/code. The first three scores use no third-party samples; the humanoid's derived WAV includes the separately retained CC0 effects below. A combined WOLF visual export still carries the model/presentation's CC BY-SA 4.0 obligations. |
| Kenney Interface Sounds | Five unchanged WAV files and source license in `examples/humanoid/audio/sfx/`, with authored low-level cues in `humanoid-loop.wav` | CC0-1.0. [Upstream notice](../examples/humanoid/audio/sfx/LICENSE.Kenney.txt), [per-file origins/hashes](../examples/humanoid/audio/sfx/provenance.json) and [processing guide](../examples/humanoid/audio/README.md). Not original project recordings. |
| Optional narration | Speech-service-generated recordings, including retained local Doubao MP3s; lesson text, generation scripts and technical manifests are distinct | Provider-generated output is not automatically relicensed as MIT. See [narration policy](#optional-narration). |

The robot-study music in `tools/audio/` and its locally generated Allegro/Robotiq
tracks are original code synthesis under MIT, without third-party sound samples.

The source-dependent example adapters and reusable software remain MIT. This
separation does not remove the license from copied or adapted source geometry,
identity records or rendered derivatives. Keep both layers' notices when sharing
the runnable example as a collection.

## Attribution and redistribution

For SO-ARM 102, keep **Robonine, SO-ARM 102**, the pinned source link,
CC BY 4.0 link and a change notice with redistributed models, images and clips.
This project changes display representation, neutral line rendering, camera
choreography, labels, editorial exploded offsets and the soundtrack. These are
link-level merged meshes, not original fastener-level CAD authored here.

For KFL08, preserve hasecilu's attribution, the upstream source and CC BY 3.0
link. Display conversion includes tessellation, per-fragment recentering and
millimetre/Z-up to metre/Y-up mapping; the source STEP stays byte-identical.

The Galileo 2 example (GPL-3.0-only) was removed on 2026-10-20 to keep every
included model under a permissive or attribution license; it remains in Git
history together with its complete source and license. New models with a
copyleft license that requires shipping corresponding source are not accepted.

Upstream STEP, STL and PDF files are referenced rather than redistributed:
`scripts/upstream-sources.json` pins each to an upstream commit URL and SHA-256,
and `npm run fetch:sources` downloads and verifies them. Every included model
license allows this. Attribution, license texts, notices, model descriptions
and provenance stay in each example's `source/` folder.

For WOLF, preserve creator credit, source/license links, the RFX acknowledgement
and a description of changes. Adapted model assets and the WOLF visual
presentation are distributed under CC BY-SA 4.0, including later rendered
derivatives. Do not replace that license with MIT. The original reusable runtime
and independently synthesized music can also be used under their MIT license.

For G1, retain Unitree Robotics' full BSD-3-Clause copyright, conditions and
disclaimer, with the model-specific source and a description of the display
conversion. Do not replace the model license with MIT or Menagerie's general
repository license. [Media notices](media/LICENSE.md) accompany the G1 preview
and explain redistributing rendered derivatives. The source has body/link-level
visuals: the presentation does not establish separate fasteners or actuator
internals. G1 source poses are unchanged; separation is editorial display work.

For the Kenney effects, the retained pack notice declares CC0. Attribution is
optional, but this project retains creator, packaging revision, license and
per-file hashes so future examples can trace their inputs. No other library
listed in [sound research](sound-libraries.md) is installed or redistributed.

Do not imply endorsement by any source author. Display animation is not a
verified joint/contact solver, a collision-free service procedure or a hardware
safety assessment.

## Dependencies and external tools

`npm ci` installs the locked dependencies. They are not vendored in this source
release. [Third-party notices](../THIRD_PARTY_NOTICES.md) record Three.js (MIT)
and occt-import-js (LGPL-2.1). Browser pages consume Three.js and prebuilt GLB;
OCCT/WASM is used by local import tools rather than embedded in the viewer.

Optional project-local Python/Blender tooling uses the MCP Python SDK (MIT),
cadquery-ocp (Apache-2.0), Open CASCADE Technology (LGPL with its additional
exception), VTK (BSD) and Blender (GPL). Those installed runtimes, wheels, DLLs,
archives and caches are excluded. Their own licenses apply if someone later
distributes a packaged runtime. Install-time acquisition does not turn them into
MIT-licensed project files. Distributing modified or bundled LGPL/GPL libraries
requires a new binary/source compliance review.

System-font stacks are used. No font binaries, stock textures, sampled music,
commercial CAD applications or official CAD-reference screenshots are bundled.
The only third-party sampled audio currently bundled is the five-file Kenney
CC0 **sound-effect** subset, distinct from the original music composition.
SOLIDWORKS, Creo, Fusion, VS Code and GitHub names identify appearance references;
they are not claims of affiliation or native CAD compatibility.
The blueprint style and drafting annotation grammar take ideas from the
MIT-licensed lemo-opuscar style library; they are independent implementations
with no copied code or media ([notice](../THIRD_PARTY_NOTICES.md#design-ideas-from-lemo-opuscar)).

<a id="optional-doubao-narration"></a>

## Optional narration

New narration uses a provider-neutral [server/CLI interface](../shared/voice/README.md#provider-neutral-speech-api),
with explicit endpoint, speech model, matching voice and format. OpenRouter's
[dedicated speech endpoint](https://openrouter.ai/docs/guides/overview/multimodal/tts)
is supported; its model availability, account access and output terms must be
checked for the selected service. API compatibility does not grant an audio
license. The interface's MIT code does not relicense service models, voices or
generated output. Credentials stay in the caller's server/CLI environment;
generation is opt-in and preview/tests do not make paid calls. Keep outputs in
ignored example-local delivery directories until redistribution terms are clear.

### Existing Doubao recordings

The original narration text and client code are MIT. The recordings were
generated using Doubao/Volcengine preset voices; speaker/resource identifiers,
durations and hashes are technical provenance, not proof of an open audio
license. Provider models, preset voices and service access are not included in
the MIT grant.

The first public source release excludes provider-generated MP3 recordings
while retaining original text, technical manifests and optional generation
scripts. Existing local recordings are not deleted. Geometry, text and original
code-synthesized music can be used without a narration service account.

The [official voice documentation](https://docs.volcengine.com/docs/DoubaoVoice/Tonelist-1?lang=zh)
and [console guide](https://docs.volcengine.com/docs/DoubaoVoice/console-guidance?lang=zh)
describe supported preset voices and agreement acceptance. This audit did not
establish an unrestricted, worldwide downstream sublicensing grant for the
specific generated recordings. This is an unresolved open-redistribution
entitlement, not a claim that ordinary narration use is prohibited. Confirm the
actual account, voice and service terms before adding those recordings to an
open asset release. Generating new speech is an explicit, optional paid-service
operation using the recipient's own account; never commit credentials.

## Audit evidence

Licenses were checked against primary upstream sources on **2026-10-18**:

- [SO-ARM 102 file-level licensing at the imported revision](https://github.com/roboninecom/SO-ARM-102/blob/e871f738c97f43de230cb04d340797da6a68c4b9/LICENSING.md): all `simulation/` files are CC BY 4.0, distinct from fabrication geometry.
- [WOLF LICENSE at the imported revision](https://github.com/Anthrobotics/wolf-actuator/blob/776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea/LICENSE) and [README](https://github.com/Anthrobotics/wolf-actuator/blob/776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea/README.md).
- [FreeCAD community library README license](https://github.com/FreeCAD/FreeCAD-library/blob/f5ca01cdcaa2f69b9295a6382719c2d90628780c/README.md#license) and [KFL08 author commit](https://github.com/FreeCAD/FreeCAD-library/commit/14aa0d4947577e296b04a7977c24b37327cd5b8d).
- [Anatomy license](https://github.com/wheresryan22/anatomy/blob/main/LICENSE), [MCP SDK v1.26.0 license](https://github.com/modelcontextprotocol/python-sdk/blob/v1.26.0/LICENSE) and [occt-import-js 0.0.23 license](https://github.com/kovacsv/occt-import-js/blob/0.0.23/LICENSE.md); the installed Three.js license is retained in the notices.
- [G1 model-specific BSD-3-Clause license](https://github.com/google-deepmind/mujoco_menagerie/blob/71f066ad0be9cd271f7ed58c030243ef157af9f4/unitree_g1/LICENSE) and [model README](https://github.com/google-deepmind/mujoco_menagerie/blob/71f066ad0be9cd271f7ed58c030243ef157af9f4/unitree_g1/README.md); 39 retained upstream file hashes/blob IDs are recorded locally.
- [Kenney Interface Sounds CC0 pack](https://kenney.nl/assets/interface-sounds), [pinned Calinou packaging](https://github.com/Calinou/kenney-interface-sounds/tree/4596a49eaf5a533948d49a47467f606bcdea70ff) and [retained original license](../examples/humanoid/audio/sfx/LICENSE.Kenney.txt).

All 21 retained SO-ARM upstream files passed their pinned hash verifier. Original
KFL08 and WOLF STEP hashes match `source/provenance.json`.
This records the inspected release, not an automated license guarantee for
future additions. New model/media contributions must declare source, version,
license, attribution, changes and any redistribution restrictions before release.
