# Allegro Hand V3 source notice

The right-hand MJCF and its eleven referenced, unmodified STL files come from
[MuJoCo Menagerie](https://github.com/google-deepmind/mujoco_menagerie/tree/62ab00f2bc44f6f20c1c9b7a13f3fb1dd41a4e35/wonik_allegro),
revision `62ab00f2bc44f6f20c1c9b7a13f3fb1dd41a4e35`.
The model is developed by Wonik Robotics and derived from SimLab's publicly
available Allegro Hand URDF. The package explicitly releases these models under
BSD-2-Clause; retain [LICENSE](LICENSE), copyright (c) 2016 SimLab, with the data
and adapted visual assets. The original package README is retained as
[README.md](README.md).

Mechanism Studio converts source geometry to GLB with unchanged semantic body
parents and source reference transforms. Coordinates are converted once from
native `[x,y,z]` to display `[x,z,-y]`. Mesh vertices, joint axes and anchors use
the same basis. This is a simulation link model, not a STEP assembly or a source
of internal tendons, gears, bearings and fasteners. None are invented here.

The original source reference for `thj0` is 0 radians, below its declared minimum
of 0.263. That source reference is retained in the asset; the presentation uses
0.263 radians as its valid neutral thumb position, including during explosion.
The animation is authored kinematics within the given limits, without contact,
grasp-force, torque or collision validation.

Original Mechanism Studio code, story and music remain under the root MIT
license. This notice does not relicense the third-party model.

## Upstream files fetched on demand

The upstream STL meshes are not stored in Git. `npm run fetch:sources`
downloads them from the pinned upstream commit recorded in `provenance.json` and
accepts them only if the SHA-256 matches; `npm test` does this first. The pinned
list is [`scripts/upstream-sources.json`](../../../scripts/upstream-sources.json).
