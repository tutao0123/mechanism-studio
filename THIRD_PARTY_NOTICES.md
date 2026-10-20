# Third-party notices

Mechanism Studio's original code, skill instructions, documentation and original
teaching assets are MIT-licensed, copyright 2026 TuTao; see [LICENSE](LICENSE).
This does **not** relicense third-party designs, derived visual assets, service
outputs or dependencies. The path-level policy and redistribution instructions
are in [docs/licensing.md](docs/licensing.md). Primary upstream license evidence
was checked on 2026-10-18.

## Asset license map

| Source | Included material | License |
| --- | --- | --- |
| Unitree Robotics / MuJoCo Menagerie Unitree G1 | Unmodified `examples/humanoid/source/unitree_g1/` XML/license/notes, with STL meshes fetched from the pinned upstream commit; derived `assets/` geometry/identity data and G1 visual renders, including `docs/media/humanoid-g1-preview.jpg` | BSD-3-Clause, **model-directory** license, copyright 2016–2023 Unitree Robotics; not the Menagerie repository's general Apache license |
| Kenney Interface Sounds / Calinou WAV packaging | Five unchanged WAVs in `examples/humanoid/audio/sfx/`; quiet authored uses in `humanoid-loop.wav` | CC0-1.0; source/license/hash records accompany the files |
| Robonine SO-ARM 102 | Selected upstream documentation, simulation URDF/Xacro/metadata under `EXAMPLE_ROBOT/source/`, with STL meshes fetched from the pinned upstream commit; derived `EXAMPLE_ROBOT/assets/` geometry/identity data and robot renders, including the README image | CC BY 4.0 |

Original reusable software, original lesson text and separately code-synthesized
music remain MIT. License notices for source geometry continue to apply when
that geometry appears in a screenshot, animation or exported video. Source
authors do not endorse this project.

## Unitree G1 visual source and derivatives

Source: [MuJoCo Menagerie, Unitree G1 at revision 71f066a](https://github.com/google-deepmind/mujoco_menagerie/tree/71f066ad0be9cd271f7ed58c030243ef157af9f4/unitree_g1).
Copyright (c) 2016–2023 HangZhou YuShu TECHNOLOGY CO.,LTD. (Unitree Robotics).
The pinned [model README](https://github.com/google-deepmind/mujoco_menagerie/blob/71f066ad0be9cd271f7ed58c030243ef157af9f4/unitree_g1/README.md)
and [model-specific license](https://github.com/google-deepmind/mujoco_menagerie/blob/71f066ad0be9cd271f7ed58c030243ef157af9f4/unitree_g1/LICENSE)
identify BSD-3-Clause. All original terms and the disclaimer are retained in
[`examples/humanoid/source/unitree_g1/LICENSE`](examples/humanoid/source/unitree_g1/LICENSE);
the same notice accompanies documentation renders in [media notices](docs/media/LICENSE.md).

Mechanism Studio preserves the 39 retained upstream files byte-for-byte and adds
a display exporter, Y-up conversion, source-body identities, merged body visuals,
editorial explosion/reassembly, neutral materials, camera/annotations and sound.
The 35 source visuals become 30 display body meshes without triangle decimation.
These are visual link/body representations, not a newly authored G1 design,
per-screw CAD assembly, actuator-internal model or verified dynamics/control.
Keep the full BSD copyright, conditions and disclaimer with source/binary asset
redistribution and accompanying rendered-media materials. Unitree and Menagerie
contributors do not endorse Mechanism Studio.

## Kenney sound effects

The humanoid uses `maximize_003.wav`, `minimize_003.wav`, `click_003.wav`,
`tick_002.wav` and `confirmation_001.wav` from
[Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds), via
[Calinou's WAV packaging at revision 4596a49](https://github.com/Calinou/kenney-interface-sounds/tree/4596a49eaf5a533948d49a47467f606bcdea70ff).
These are **CC0-1.0**. The unchanged upstream
[license](examples/humanoid/audio/sfx/LICENSE.Kenney.txt) and
[per-file provenance](examples/humanoid/audio/sfx/provenance.json) are retained.
Credit is optional under the pack's notice; it is preserved here for traceability.
The downloaded sample bytes are unchanged. Quiet gain/envelope treatment occurs
in the derived score; these are editorial cues, not recordings of G1 hardware.
Original composition and synthesis code remain MIT; this does not relabel the
Kenney samples as original Mechanism Studio recordings. Other researched sound
libraries in [the survey](docs/sound-libraries.md) are not bundled.

## Anatomy

Source: [wheresryan22/anatomy](https://github.com/wheresryan22/anatomy).
Early skill text adapted its mechanism-first approach, shared motion/readout
model, staged verification and rendered-view review. That lineage and its MIT
notice remain visible. The current project uses its own 3D/runtime interfaces;
no sibling Anatomy checkout or drawing toolkit is packaged or required.
The [upstream license](https://github.com/wheresryan22/anatomy/blob/main/LICENSE)
is preserved below; this notice does not imply author participation.

```text
MIT License

Copyright (c) 2026 Ryan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Three.js

Source: [mrdoob/three.js](https://github.com/mrdoob/three.js), locked npm
`three@0.186.1`. GLTFLoader, STLLoader and OrbitControls are part of this
dependency. It is installed with `npm ci`, not vendored in Git. Retain the
installed package's copyright/license if distributing a bundled application.
The installed version's notice is reproduced here:

```text
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## MCP Python SDK

The project-written bridge in `tools/blender-mcp/` uses
[modelcontextprotocol/python-sdk v1.26.0](https://github.com/modelcontextprotocol/python-sdk/tree/v1.26.0).
It is a four-operation, project-scoped lock-model bridge, not the community
Blender MCP add-on by ahujasid. No upstream community add-on code is packaged.
The optional SDK and transitive dependencies install in ignored `.tools/`;
keep their own licenses if distributing those runtimes. SDK notice:

```text
MIT License

Copyright (c) 2024 Anthropic, PBC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Open CASCADE XCAF runtime

The optional native XCAF workflow installs `cadquery-ocp==7.8.1.1.post1`
([OCP](https://github.com/CadQuery/OCP), Apache-2.0), its Open CASCADE dependencies,
and `vtk==9.3.1` ([VTK BSD license](https://vtk.org/about/#license)) under ignored
`.tools/cad-python`. No wheel, DLL, installed runtime or modified upstream code
is packaged. See `tools/cad/requirements-xcaf.txt` and
`tools/cad/README-xcaf.md`. Installing a runtime is distinct from licensing
the project-written import adapter. Underlying
[Open CASCADE Technology](https://dev.opencascade.org/resources/licensing)
has its own LGPL/exception licensing.

## Blender

[Blender](https://www.blender.org/about/license/) is an optional external GPL
modeling environment. Portable executables, archives, caches and installed
libraries under `.tools/` are excluded. Original modeling Python scripts and
prebuilt GLB teaching assets are included. Local generated `.blend` files are
excluded from this source release; use the scripts to rebuild them. Using
Blender does not automatically assign Blender's GPL to independently authored
model output.

## SO-ARM 102

**Robonine, SO-ARM 102**, revision
`e871f738c97f43de230cb04d340797da6a68c4b9`.
The [pinned licensing map](https://github.com/roboninecom/SO-ARM-102/blob/e871f738c97f43de230cb04d340797da6a68c4b9/LICENSING.md)
explicitly assigns **all simulation files** to CC BY 4.0, including descriptions,
meshes and export metadata. This is distinct from the fabrication CAD license.
Original files, the full
[CC BY 4.0 text](EXAMPLE_ROBOT/source/DOCS-LICENSE.txt),
[upstream NOTICE](EXAMPLE_ROBOT/source/NOTICE), file-level map and hashes are
retained in [EXAMPLE_ROBOT/source/](EXAMPLE_ROBOT/source/SOURCES.md).

Mechanism Studio converts selected link meshes to GLB, preserves source identity,
and authors white line rendering, source-bound joint poses, editorial exploded
separation, camera choreography and English annotations. Robot renders and the
README image retain **CC BY 4.0** attribution/source/license/change notices.
Code music is original oscillator/noise synthesis. No Robonine video,
Musopen recording or other upstream soundtrack is redistributed. Upstream NOTICE
contains broader design/music lineage for the original repository; retaining it
does not mean that its preview soundtrack is used here.

## Optional Doubao / Volcengine narration

Generated narration is service output, distinct from original MIT lesson text
and client scripts. Preset voices and provider models are not MIT software or
project-owned voice assets. An unrestricted downstream MIT-sublicensing grant
for the recordings was not established in this audit; no claim is made that
ordinary narration use is prohibited. The first public source release excludes
provider-generated MP3 recordings while keeping lesson text, technical
manifests and opt-in generation scripts. Existing local recordings are retained
locally. [docs/licensing.md](docs/licensing.md#optional-doubao-narration) records
the scope/evidence; recipients must confirm their own account/voice/service
rights before generating or redistributing narration. No credentials or account
configuration is published. Code-synthesized music is original MIT work;
its generated WAVs are not in Git and are rebuilt locally from the included
scripts with `npm run build:audio`.

## Allegro and Robotiq source robot descriptions

The new `examples/allegro-hand/source/` and `examples/robotiq-gripper/source/`
packages retain selected right-hand and 2F-85 v4 descriptions from
[MuJoCo Menagerie revision 62ab00f](https://github.com/google-deepmind/mujoco_menagerie/tree/62ab00f2bc44f6f20c1c9b7a13f3fb1dd41a4e35).
The model directories each use **BSD-2-Clause**, rather than the repository's
general Apache license. Allegro retains **Copyright (c) 2016, SimLab**;
Robotiq retains **Copyright (c) 2013, ROS-Industrial**. Preserve each complete
copyright, conditions and disclaimer in accompanying material for redistributed
assets or visual derivatives:
[Allegro license](examples/allegro-hand/source/LICENSE),
[Robotiq license](examples/robotiq-gripper/source/LICENSE).

Per-file provenance keeps upstream revisions and hashes. Mechanism Studio adds
coordinate/visual conversion, source-bound kinematics, display separation,
camera, English annotations and independently synthesized music. This does not
claim robot authorship, source-author endorsement, native CAD mates or verified
contact/dynamics. Original adapters, exporter and music remain MIT; retained
model geometry and derivatives carry their source BSD notices.

## Fonts, references and trademarks

System-font CSS stacks are used; no font binaries or stock textures are bundled.
SOLIDWORKS, Creo, Fusion, VS Code and GitHub names identify appearance references.
They do not imply affiliation, bundled commercial software or native file
compatibility. Official screenshots, CAD manuals/reference render captures used
only for private appearance research are excluded; original reference URLs and
written observations may remain.

### Design ideas from lemo-opuscar

The opt-in blueprint study style, the index–name–spec label grammar, drawn
dimensions and the wave lift of repeated parts follow ideas described in
[lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) by lemomo-ai, whose
code and documentation are MIT-licensed and whose films are CC BY 4.0. These
features are implemented independently in `shared/appearance/styles.mjs`,
`shared/viewer/spec-label.mjs`, `shared/viewer/drafting.mjs`, the study CSS and
the gearbox example. No lemo-opuscar code, film, frame, font or other asset is
bundled, and nothing from the related lemo-wake project (CC BY-NC 4.0) is included.
