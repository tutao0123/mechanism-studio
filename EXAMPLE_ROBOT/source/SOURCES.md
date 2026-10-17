# SO-ARM 102 source package

Robot design: **Robonine, SO-ARM 102**. The visualization uses the project's
source-authored follower robot description and visual meshes at revision
`e871f738c97f43de230cb04d340797da6a68c4b9`.

- [Pinned upstream robot description and meshes](https://github.com/roboninecom/SO-ARM-102/tree/e871f738c97f43de230cb04d340797da6a68c4b9/simulation/urdf)
- [Pinned licensing map](https://github.com/roboninecom/SO-ARM-102/blob/e871f738c97f43de230cb04d340797da6a68c4b9/LICENSING.md)
- [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)

The upstream `LICENSING.md` and `REUSE.toml` explicitly cover **all files in
`simulation/`**, including the URDF, STL meshes and export metadata, under
**CC BY 4.0**. They separately license manufacturable designs in `models/` under
CERN-OHL-P-2.0. No `models/` CAD, upstream video or soundtrack is used here.
The retained root hardware licence explains that separate category; its presence
does not change the licence on this selected simulation package.

Required attribution: **Robonine, SO-ARM 102,
https://github.com/roboninecom/SO-ARM-102, CC BY 4.0**.
Retain the credit, source link, licence link and modification notice with
redistributed visual derivatives. No endorsement by Robonine is implied.

Original source files are retained byte for byte. Mechanism Studio adds white
line rendering, editorial link separation, camera choreography, English labels
and an independently code-synthesized soundtrack. These are presentation changes.
The showcase does not establish a collision-free service disassembly procedure.

The selected source has **8 visual links, 7 joints and 62,064 visual triangles**.
All visual meshes use URDF scale `0.001 0.001 0.001`: their numeric millimetre
coordinates become metres. Link visual origins and joint parent/child transforms
must both be applied. The URDF uses a right-handed Z-up frame. The retained
`export_metadata.json` declares URDF zero as the current source CAD pose.

The visual meshes merge several physical bodies per link. This example preserves
source link and joint identities, rather than claiming individual screw identity
or a native STEP assembly tree. Estimated collision boxes and inertial parameters
are retained upstream evidence; they are not independently validated simulation.

`provenance.json` lists URLs, byte counts, SHA-256 hashes and original Git blob
identities for every retained upstream file. Run
`node EXAMPLE_ROBOT/source/research/verify-source.mjs` from the project root to
verify the retained bytes and regenerate the compact structural inspection.

`research/so-arm-102-repository/`, if still present, is a temporary sparse Git
metadata cache used to obtain original blob identities. It is not an input to the
example and must be excluded from preview and release inventories.
