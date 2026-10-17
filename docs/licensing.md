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
| SO-ARM 102 | `EXAMPLE_ROBOT/source/` selected upstream documentation, URDF/Xacro, STL meshes and metadata; `EXAMPLE_ROBOT/assets/` source-derived geometry/identity data; screenshots or recordings depicting that geometry, including `docs/media/so-arm102-kinetic.jpg` | CC BY 4.0, Robonine; [license map](../EXAMPLE_ROBOT/source/LICENSING.md), [full license](../EXAMPLE_ROBOT/source/DOCS-LICENSE.txt), [hashes and changes](../EXAMPLE_ROBOT/source/provenance.json). The upstream hardware license is retained as contextual evidence, but hardware-design directories were not imported. |
| KFL08 | `examples/step-assembly/source/kfl08.step` and source-derived `examples/step-assembly/assets/` | CC BY 3.0, hasecilu; [full license](../examples/step-assembly/source/CC-BY-3.0.txt), [notice](../examples/step-assembly/source/LICENSE.md), [provenance](../examples/step-assembly/source/provenance.json). |
| Galileo 2 Extruder | `examples/shaft-bearing/source/assembly.step`, `Galileo 2 Extruder.f3d` and source-derived `examples/shaft-bearing/assets/` | GPL-3.0-only, JaredC01 and Galileo 2 contributors; [full license](../examples/shaft-bearing/source/LICENSE.md), [source notice](../examples/shaft-bearing/source/NOTICE.md), [hashes](../examples/shaft-bearing/source/provenance.json). |
| WOLF V1.2 | Upstream files in `examples/wolf-actuator/source/`, source-derived `examples/wolf-actuator/assets/`, and adapted WOLF visual presentations/renders | CC BY-SA 4.0, Anthrobotics and contributors; [full license](../examples/wolf-actuator/source/LICENSE), [notice](../examples/wolf-actuator/source/NOTICE.md), [hashes](../examples/wolf-actuator/source/provenance.json). Keep the upstream acknowledgement of Robin Fröjd's RFX gearbox. |
| Original music | Code synthesis source, score JSON and generated WAVs under `EXAMPLE_ROBOT/audio/`, `EXAMPLE_ROBOT/kinetic/audio/` and `examples/wolf-actuator/audio/` | MIT. No third-party samples or upstream robot soundtrack are used. A combined WOLF visual export still carries the model/presentation's CC BY-SA 4.0 obligations. |
| Optional narration | Doubao-generated MP3 recordings; lesson text, generation scripts and technical manifests are distinct | Provider-generated output is not automatically relicensed as MIT. See [narration policy](#optional-doubao-narration). |

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

For Galileo 2, preserve GPL version 3 and the source/derivative distinction.
The editable native Fusion file accompanies the original STEP and display GLB,
with pinned hashes and the conversion scripts, so redistribution is not based
only on an external download promise. A new binary/model release must continue
to include the corresponding source and any changed conversion source. No
claim is made that the browser edits Fusion files or that STEP alone is the
preferred editable source.

For WOLF, preserve creator credit, source/license links, the RFX acknowledgement
and a description of changes. Adapted model assets and the WOLF visual
presentation are distributed under CC BY-SA 4.0, including later rendered
derivatives. Do not replace that license with MIT. The original reusable runtime
and independently synthesized music can also be used under their MIT license.

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
SOLIDWORKS, Creo, Fusion, VS Code and GitHub names identify appearance references;
they are not claims of affiliation or native CAD compatibility.

## Optional Doubao narration

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
- [Galileo 2 LICENSE](https://github.com/JaredC01/Galileo2/blob/98f8a37944d7277cd37231776400553cc402219f/LICENSE) and [native Fusion source](https://github.com/JaredC01/Galileo2/blob/98f8a37944d7277cd37231776400553cc402219f/galileo2_extruder/cad/Galileo%202%20Extruder.f3d).
- [FreeCAD community library README license](https://github.com/FreeCAD/FreeCAD-library/blob/f5ca01cdcaa2f69b9295a6382719c2d90628780c/README.md#license) and [KFL08 author commit](https://github.com/FreeCAD/FreeCAD-library/commit/14aa0d4947577e296b04a7977c24b37327cd5b8d).
- [Anatomy license](https://github.com/wheresryan22/anatomy/blob/main/LICENSE), [MCP SDK v1.26.0 license](https://github.com/modelcontextprotocol/python-sdk/blob/v1.26.0/LICENSE) and [occt-import-js 0.0.23 license](https://github.com/kovacsv/occt-import-js/blob/0.0.23/LICENSE.md); the installed Three.js license is retained in the notices.

All 21 retained SO-ARM upstream files passed their pinned hash verifier. Original
KFL08, Galileo 2 and WOLF STEP hashes match `source/provenance.json`; the newly
included native Fusion source is 21,384,519 bytes, SHA-256
`ef025f1a9fbdd07e1e94c694ca10db54951fe96173266244baabcd595b9d9377`.
This records the inspected release, not an automated license guarantee for
future additions. New model/media contributions must declare source, version,
license, attribution, changes and any redistribution restrictions before release.
