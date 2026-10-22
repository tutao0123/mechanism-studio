# Documentation media

These are reviewed Mechanism Studio example renders, not official CAD product
screenshots. Original documentation text is MIT. Depicted third-party geometry
retains its own terms; the image filenames do not inherit MIT merely by living
in this documentation directory.

| File | Depicted source / author | Applicable notice |
| --- | --- | --- |
| `lock-preview.jpg` | Original five-pin teaching lock, TuTao | Project MIT; source in `prototype-3d/` |
| `inline-four-preview.jpg` | Original inline-four teaching model, TuTao | Project MIT; source in `examples/inline-four/` |
| `turbofan-preview.jpg` | Original two-spool teaching model, TuTao | Project MIT; source in `examples/turbofan/` |
| `quadruped-preview.jpg` | Original eight-DoF teaching model, TuTao | Project MIT; source in `examples/quadruped/` |
| `gearbox-readme.gif` | Original five-speed teaching gearbox, Mechanism Studio | Project MIT; model, score and capture source in `examples/gearbox/` |
| `gearbox-editions.jpg` | Same gearbox study in the default and blueprint editions, Mechanism Studio | Project MIT; capture source in `examples/gearbox/`. Blueprint style idea from lemo-opuscar (MIT); no third-party pixels |
| `planetary-gears-preview.jpg` | Original 80-part planetary reducer teaching model, Mechanism Studio / TuTao | Project MIT; model and direct frame composition in `examples/planetary-gears/`. Resized from frame 00372 at 12.4 s of the 36 s Atlas study; no third-party geometry |
| `so-arm102-kinetic.jpg` | SO-ARM 102, Robonine | CC BY 4.0; source and change notice below |
| `humanoid-g1-preview.jpg` | Unitree G1, Unitree Robotics / MuJoCo Menagerie contributors | BSD-3-Clause; model-specific notice and full terms below |
| `allegro-hand-preview.png` | Allegro Hand V3, SimLab / Wonik Robotics / MuJoCo Menagerie contributors | Model-specific BSD-2-Clause; retained source license and change notice below |
| `robotiq-gripper-preview.png` | Robotiq 2F-85 v4, ROS-Industrial / Robotiq / MuJoCo Menagerie contributors | Model-specific BSD-2-Clause; retained source license and change notice below |

## Allegro Hand and Robotiq gripper

`allegro-hand-preview.png` depicts the **Allegro Hand V3 right-hand model**,
copyright (c) 2016, SimLab, from
[the pinned Menagerie model](https://github.com/google-deepmind/mujoco_menagerie/tree/62ab00f2bc44f6f20c1c9b7a13f3fb1dd41a4e35/wonik_allegro).
Retain its [complete BSD-2-Clause license](../../examples/allegro-hand/source/LICENSE),
[source notice](../../examples/allegro-hand/source/NOTICE.md) and
[provenance](../../examples/allegro-hand/source/provenance.json) with redistributed
model or image material.

`robotiq-gripper-preview.png` depicts the **Robotiq 2F-85 v4 model**, copyright
(c) 2013, ROS-Industrial, from
[the pinned Menagerie model](https://github.com/google-deepmind/mujoco_menagerie/tree/62ab00f2bc44f6f20c1c9b7a13f3fb1dd41a4e35/robotiq_2f85_v4).
Retain its [complete BSD-2-Clause license](../../examples/robotiq-gripper/source/LICENSE),
[source and change notes](../../examples/robotiq-gripper/README.md) and
[provenance](../../examples/robotiq-gripper/source/provenance.json) with redistributed
model or image material. Both licenses require retaining their copyright,
conditions and disclaimer; the general Menagerie repository license does not
replace the model-specific terms.

Mechanism Studio converts source meshes and coordinate frames, preserves body
identity, and adds working poses, display separation, white-line materials,
camera framing and English annotations. These renders depict simulation link
geometry; they do not establish individual internal fasteners, contact dynamics
or manufacturing clearances. They imply no endorsement by source authors.
Original rendering software and documentation text remain MIT; that grant does
not replace the source model notices accompanying these visual derivatives.

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
