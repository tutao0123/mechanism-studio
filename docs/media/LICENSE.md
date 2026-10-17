# Documentation media

These are reviewed Mechanism Studio browser renders, not official CAD product
screenshots. Original documentation text is MIT. Depicted third-party geometry
retains its own terms; the image filenames do not inherit MIT merely by living
in this documentation directory.

| File | Depicted source / author | Applicable notice |
| --- | --- | --- |
| `lock-preview.jpg` | Original five-pin teaching lock, TuTao | Project MIT; source in `prototype-3d/` |
| `inline-four-preview.jpg` | Original inline-four teaching model, TuTao | Project MIT; source in `examples/inline-four/` |
| `turbofan-preview.jpg` | Original two-spool teaching model, TuTao | Project MIT; source in `examples/turbofan/` |
| `quadruped-preview.jpg` | Original eight-DoF teaching model, TuTao | Project MIT; source in `examples/quadruped/` |
| `so-arm102-kinetic.jpg` | SO-ARM 102, Robonine | CC BY 4.0; source and change notice below |
| `kfl08-preview.jpg` | KFL08, hasecilu / FreeCAD community library | CC BY 3.0; source and change notice below |
| `shaft-bearing-preview.jpg` | Galileo 2, JaredC01 and contributors | Retains source-derived GPL-3.0-only notice; source and conversion materials below |
| `wolf-preview.jpg` | WOLF V1.2, Anthrobotics and contributors | CC BY-SA 4.0; source and change notice below |
| `wolf-motor-detail.jpg` | WOLF V1.2 motor subassembly, Anthrobotics and contributors | Same CC BY-SA 4.0 terms; actual source components, separate from G1 |
| `humanoid-g1-preview.jpg` | Unitree G1, Unitree Robotics / MuJoCo Menagerie contributors | BSD-3-Clause; model-specific notice and full terms below |

## SO-ARM 102

`so-arm102-kinetic.jpg` is a Mechanism Studio rendered frame depicting
**SO-ARM 102 by Robonine**, copyright (c) 2026 Robonine, from
[simulation assets at revision e871f73](https://github.com/roboninecom/SO-ARM-102/tree/e871f738c97f43de230cb04d340797da6a68c4b9/simulation/urdf).

The image is distributed under
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/),
with the retained [full license](../../EXAMPLE_ROBOT/source/DOCS-LICENSE.txt).
Mechanism Studio converted the source visual meshes and authored line rendering,
joint/display poses, camera framing and English annotations. Keep creator,
source/license credit and this change notice when redistributing the image.
No source-author endorsement is implied. This asset is excluded from the
repository-level MIT grant; original documentation text remains MIT.

## KFL08

`kfl08-preview.jpg` depicts the KFL08 flange-bearing source by **hasecilu**,
retained from the
[FreeCAD library at revision f5ca01c](https://github.com/FreeCAD/FreeCAD-library/tree/f5ca01cdcaa2f69b9295a6382719c2d90628780c).
The image retains [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), with
[source provenance](../../examples/step-assembly/source/provenance.json),
[retained license](../../examples/step-assembly/source/CC-BY-3.0.txt) and
[author notice](../../examples/step-assembly/source/LICENSE.md).
Mechanism Studio imported/tessellated the retained STEP, authored grouped
display separation, line rendering and a local viewer. The historical import's
incomplete identity mapping remains documented; a render does not remedy it.
Keep author/source/license credit and this change notice when sharing the image.

## Galileo 2

`shaft-bearing-preview.jpg` depicts **Galileo 2 by JaredC01 and contributors**,
at [revision 98f8a37](https://github.com/JaredC01/Galileo2/tree/98f8a37944d7277cd37231776400553cc402219f).
The retained source and source-derived material use **GPL-3.0-only**; retain the
[full license](../../examples/shaft-bearing/source/LICENSE.md),
[source notice](../../examples/shaft-bearing/source/NOTICE.md) and
[provenance](../../examples/shaft-bearing/source/provenance.json).
Original native Fusion and STEP files, conversion code and derived GLB are
included in the example package rather than being represented only by an image.
Mechanism Studio adds XCAF occurrence import, linked selection, neutral line
rendering and display explosion. This image's geometry is excluded from the
repository-level MIT grant. Redistribution of model derivatives must keep the
corresponding source and applicable GPL notices; the independent reusable
viewer/software remains under its own MIT terms.

## WOLF

`wolf-preview.jpg` and `wolf-motor-detail.jpg` depict **WOLF V1.2 by Anthrobotics and contributors**,
at [revision 776a565](https://github.com/Anthrobotics/wolf-actuator/tree/776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea).
The model and adapted visual presentation retain
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), with the
[full license](../../examples/wolf-actuator/source/LICENSE),
[source notice](../../examples/wolf-actuator/source/NOTICE.md) and
[provenance](../../examples/wolf-actuator/source/provenance.json).
Keep the upstream acknowledgement of Robin Fröjd's RFX gearbox. Mechanism Studio
adds source-mapped display conversion, editorial separation, line materials,
camera, annotations and sound. Keep creator/source/license credit and a change
notice; redistribute the adapted visual under CC BY-SA 4.0, not MIT.
The detail image depicts the real source motor subassembly and its retained
component names; it is not a representation of Unitree G1 hardware, nor does it
assign a function to generically named `cc` components. The same source license
and change notice cover both WOLF editions.

## Unitree G1

`humanoid-g1-preview.jpg` depicts the Unitree G1 visual model from
[MuJoCo Menagerie at revision 71f066a](https://github.com/google-deepmind/mujoco_menagerie/tree/71f066ad0be9cd271f7ed58c030243ef157af9f4/unitree_g1).
The model directory's [BSD-3-Clause license](../../examples/humanoid/source/unitree_g1/LICENSE)
applies to XML and assets; the repository-wide Apache license is not substituted.
Mechanism Studio converts coordinate/visual representation, retains source body
identity, groups visual occurrences, and authors white-line rendering, display
separation, cameras, English labels and sound. It does not claim authorship of
the robot or validation of its dynamics/control. Retain the notice below in
documentation or accompanying materials when redistributing the derivative
model/render. Unitree Robotics and Menagerie contributors do not endorse this
project. The full source terms are reproduced here:

```text
Copyright (c) 2016-2023 HangZhou YuShu TECHNOLOGY CO.,LTD. ("Unitree Robotics")
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of the copyright holder nor the names of its
  contributors may be used to endorse or promote products derived from
  this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
