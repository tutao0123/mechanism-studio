# Unitree G1 display derivative

`humanoid.glb` derives from the Unitree G1 MJCF and STL visual assets in
MuJoCo Menagerie at commit `71f066ad0be9cd271f7ed58c030243ef157af9f4`.

Copyright (c) 2016-2023 HangZhou YuShu TECHNOLOGY CO.,LTD. ("Unitree Robotics").
The original source model and this geometric derivative retain **BSD-3-Clause**;
the complete applicable license is included in [LICENSE](LICENSE).

Original model:
https://github.com/google-deepmind/mujoco_menagerie/tree/71f066ad0be9cd271f7ed58c030243ef157af9f4/unitree_g1

Conversion by Mechanism Studio: retain the original zero-joint body hierarchy,
convert Z-up metres to Y-up metres, normalize source quaternions per MJCF,
exclude collision/site/light records from the display solid, merge each body's
visual occurrences into one owned display mesh, index exact Float32
attributes, and author a neutral white display material. No source triangles
are simplified or removed. Source bytes, identities and original properties
are retained separately under `../source/` and `source-assembly.json`.

The presentation's explosion and camera movements are editorial. No physical
disassembly, dynamics or manufacturer endorsement is asserted.
