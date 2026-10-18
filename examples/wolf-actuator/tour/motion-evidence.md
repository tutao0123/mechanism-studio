# Evidence for the illustrative WOLF input rotation

This edition adds one **authored input turn**, separate from display explosion.
It does not infer the complete Wolfrom transmission or recover CAD mates.

## Retained primary evidence

The original WOLF V1.2 STEP is pinned to
`776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea`, SHA-256
`b352183e1bd0d55c403a6f406c3b2886a3b1b374b47cf32bcb69d4277d252e35`.
[Source provenance](../source/provenance.json) binds its original source bytes to
the imported occurrence tree. Each runtime ID is a real source occurrence path,
not a name, mesh index or inferred visual split.

The retained official [V1.1 Assembly and Usage Guide](../source/WOLF-Assembly-Guide-V1.1.pdf)
has SHA-256 `fb1aea34edd40510d8bb681856b0035ac25a1c5782fff4e04d53003e41ffe58a`.
The [pinned V1.2 README](https://github.com/Anthrobotics/wolf-actuator/blob/776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea/README.md)
directs users to this guide and explains the minor encoder-housing change.

The guide provides three useful assembly relationships:

| Guide step | Source relationship | How this edition uses it |
| --- | --- | --- |
| 2, printed page 10 | The motor mounts to the back plate with four M4 fasteners. | The stator/mount remain fixed relative to the source body. |
| 3, printed page 11 | The encoder magnet holder fits the rear motor hex nut. | The holder joins the authored input group. |
| 12, printed page 19 | The sun gear is fastened to the motor with four M3 fasteners. | The sun joins the same authored input angle, while displayed clear of planet contact. |

Those fasteners are described by the physical guide. They are not additional
separate meshes fabricated for this STEP-derived scene.

Upstream describes a **carrierless Wolfrom train** with twelve planet gears and
two internal ring gears. Its nominal reduction specification does not supply
the two signed ring relationships, exact tooth counts, attachment constraints,
tooth contact or rolling-element kinematics required to reconstruct the full
transmission. This edition consequently does not animate a conventional planet
carrier, assign invented tooth counts, or derive output motion from that number.

## Actual source bindings and the explicit interpretation

The source motor is `occ-b352183e1bd0-root-953098-1010`, source usage `#1010`,
definition `#953195`. Its 86 independent leaves contain 40 named `magnet`, 40
generic `cc`, and six named hardware components. The following group is an
**authored mechanical interpretation**, supported by names/coaxial placement and
the guide's coarse attachments; it is not a set of recovered STEP rigid mates.

| Role | Source occurrence ID suffix after `occ-b352183e1bd0-root-953098` |
| --- | --- |
| `rotor` | `-1010-956` |
| `rotor-body` | `-1010-970` |
| `motor-shaft` | `-1010-934` |
| `motor-hex-nut` | `-1010-992` |
| Forty individually named `magnet` occurrences | Actual source motor children selected by the exact name; enumerated in `motion-evidence.json`. |
| `sun-gear` | `-767` |
| `encoder-magnet-holder` | `-761` |

These **46 source leaves** co-rotate for this input illustration. The stator
(`-1010-960`), motor mounting plate (`-1010-946`), forty `cc` pieces and every
other actuator component remain stationary in the working-pose layer.
`cc` keeps its supplied generic name; it is not relabelled as a copper winding
or assigned a force/current model. Rotor internals and shaft/nut attachment have
not been independently validated as manufacturer engineering constraints.

The pivot is the original `motor-shaft` rest-frame origin:
`[0, 0.0149995213351072, 0]` metres in displayed coordinates. Its local +Y basis
maps to the coaxial world direction `[0,-1,0]`. Any point on that same axis line
produces the same rotation. This avoids using the slightly asymmetric
tessellated rotor bounding-box centroid as an engineering axis. Axis selection
is still an authored interpretation; the STEP occurrence tree contains no
declared revolute joint.

## Runtime contract

`createWolfWorkingMotion(index)` in `kinematics.mjs` consumes the exact WOLF
metre scene index and returns:

- `workingPoses(state)`: full absolute identity/reset map for all 245 leaves,
  with the 46 input poses updated from `state.motionDemoProgress` in `[0,1]`.
  The timeline owns easing and the beat-20–28 demonstration window. One complete
  turn uses `2*pi*progress`; both endpoints return exact identity.
- `boundsAt(progress)`: a Map of every source ID to a conservative world-metre
  `{min,max}` box after the working pose, before display offsets.
- `rotationEnvelope()`: a conservative full-turn world-metre box Map for
  camera planning. Add the timeline's separate display offsets as appropriate.
- `rotatingIds`, `axisWorld`, `pivotWorld`, and explicit `evidence` metadata.

For parent world placement `P`, the model wrapper receives
`P^-1 * T(pivot) * R(axis,angle) * T(-pivot) * P`. The original source node keeps
its rest matrix. Display translations are applied outside this working wrapper.
No geometry, parent wiring or retained source matrix is rewritten. This adapter
supports rigid source placements and rejects unsupported non-rigid parents.

The demonstration should say **“Input rotation — illustrative”**. Suppress labels
on moving targets during the turn, since the shared near-part label planner
uses static source geometry bounds. Keep source gears separated in this shot;
no planet/ring/rolling contact or reduction is claimed. Rotation is prescribed,
not a torque, speed, electromagnetic, control, balance or dynamics simulation.

Source model and rendered adaptations retain **CC BY-SA 4.0**, with Anthrobotics
attribution and the [existing change notice](../source/NOTICE.md). Original
Mechanism Studio implementation code remains MIT.
