# Source, model and display contract

Implemented binding/validation live in [viewer](../../../../shared/viewer/README.md) and [assets](../../../../shared/assets/README.md). This contract defines identity and transform meaning, not a second API manual. Text/image inputs first use the [input brief](input-brief.md); plans reference actual geometry/IDs through [orchestration](module-orchestration.md).

## Identity and hierarchy

Each logical displayed part has one unique part_id, carried in GLB node extras.part_id and the contract parts list. A part may own multiple solid meshes; child meshes do not repeatedly claim the ID. Debug names and array indices are not identity.

Source assemblies use extras.assembly_id; parent_id matches the actual exported parent. Validate existence, uniqueness, acyclicity and full semantic-node coverage. Parent/child organization is not a mechanical mate.

CAD retains a reusable definition and each placed occurrence separately, then declares display mappings. Legacy grouping-only mappings remain limited. Mesh count does not equal source part count. Mixed source assemblies can own geometry and real children; do not invent an engineering child to hold owned solids or attribute descendant geometry twice.

## Units and full basis conversion

Declare source/body lengths, angles, axes and pose baseline. Some teaching models use mm/+Z/degrees; that is not a universal input convention. glTF display is metres/radians/right-handed/+Y. Existing mm/+Z adapters use:

```text
point_gltf = 0.001 * [body.x, body.z, -body.y]
M_gltf = C * M_body * inverse(C)
```

Apply the full basis change to orientation/axes and matrices, not translation alone. Direction vectors do not acquire an extra length scale. Quaternions use [x,y,z,w]. Do not shrink already-metre GLB nodes again.

Current XCAF normalizes both native m/mm geometry and matrices to imported mm; original unit metadata remains separate. The display converts those imported coordinates once. Legacy body-space explode vectors need explicit adaptation; public default vectors are glTF metres.

## Working and observation layers

```text
actual source assembly parent
  → display wrapper
    → model wrapper
      → original semantic node
        → owned solid meshes
```

Original GLB local TRS is the asset baseline. Default working poses write model wrappers; identity must reproduce the original assembly, without repeating rest. Existing engine/quadruped absolute-node poses explicitly use applyPoses(...,{target:'node'}), with model identity. Never write the same motion to both.

Display owns presentation offsets/visibility. Its offsets are in the display-parent coordinate space, requiring inverse-parent conversion for world directions. Children inherit parents; do not duplicate parent movement/explosion. Reassembly clears display offsets while preserving mechanical state.

Declare whether an adapter outputs absolute local, parent-relative, rest-relative delta or world poses. Convert world to actual parent-local before binding. Keep immutable declared rest evidence even where legacy runtime animation writes source-node working TRS.

## One mechanical writer

Each semantic node declares static, model or clip ownership; new GLB extras.motionOwner matches its contract.

- static retains source assembly pose.
- model uses the mechanism calculation.
- clip uses explicit baked mechanical channels, with an example-owned playback/time adapter.

A TRS/morph channel cannot be driven by clip and model simultaneously. Permitting clip-owned channels in validation does not implement clip playback, Blender rigid bodies, drivers or constraints automatically.

Display remains observation-owned independently. Disabling controls during explosion is a UI choice, not a newly discovered mechanical gate.

## Acceptance

Check real GLB buffers/accessors, identity, actual parents, rest, units, finite axes and ownership. Then check the mechanism's own lengths/phases/limits/FK/IK and actual transformed nodes. Switching camera, selection, cutaway or explosion at one mechanical state must not change readouts. Parseable geometry is not proof of interference-free motion, contact or engineering precision. Legacy lock compatibility is explicit; do not propagate its exceptions to new assets.
