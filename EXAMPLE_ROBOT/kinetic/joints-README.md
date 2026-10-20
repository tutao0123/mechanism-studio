# Source-backed robot joint poses

`joints.mjs` drives the eight retained SO-ARM 102 source links using the seven joints in Robonine's original URDF: five revolute joints and two prismatic jaws. The second jaw follows the source mimic relation `clamp2 = -clamp1`. This working rig is specific to this retained model; it does not infer joints for STEP files or other models.

The native URDF is retained at `../source/simulation/urdf/so_arm_102.urdf`, upstream commit `e871f738c97f43de230cb04d340797da6a68c4b9`, SHA-256 `d52437d3f901077d084492d81b4037952273a76d0a229bf7cf7de7ac5836da4f`. The rig checks its parsed source metadata, exact axes, joint origins, limits, mimic relation, source identities, and original rest matrices. Tests also hash the actual retained URDF bytes and compare its joint elements directly with the input metadata. Geometry and original GLB source nodes remain unchanged.

```js
const rig = createRobotJointRig(sourceAssembly, sceneIndex);
const q = { base_to_link1: 0.12, clamp1: 0.012 };
const poses = rig.posesAt(q);
const worlds = rig.worldMatricesAt(q);
const bounds = rig.boundsAt(q);
// The existing viewer consumes an object of poses rather than a Map.
applyWorkingPoses(parts, Object.fromEntries(poses), { target: 'model' });
```

`q` is a plain object keyed by native joint names. Values use radians for revolute joints and metres for prismatic joints. Missing values mean zero. The second jaw is derived automatically; an explicitly supplied `clamp2` must agree with the source mimic relation. Unknown names, non-finite values, and coordinates outside source limits are rejected. Only round-off within `1e-12` of a limit is clamped.

- `posesAt(q)` returns a fresh `Map<partId, {position, quaternion, scale}>` of arrays for the seven child-link working wrappers. The anchored base is omitted.
- `worldMatricesAt(q)` returns fresh column-major matrix arrays for all eight source link identities.
- `boundsAt(q)` returns fresh `{min, max}` array records for all eight source identities, in displayed world metres. These are conservative AABBs formed from the eight corners of each original local mesh AABB transformed by source forward kinematics. They enclose actual posed mesh vertices but are not exact surface bounds, swept volumes, or collision evidence.
- `resolvedValuesAt(q)` returns all seven coordinates including the derived jaw coordinate.

The imported source uses right-handed Z-up coordinates. The display applies the existing basis change `B[x,y,z] = [x,z,-y]` once. A native joint contributes `J × M(q)`, where `J` is its source joint origin and `M(q)` is axis rotation or translation. Each immutable GLB source node already owns its display-basis rest `J`. A separate viewer working wrapper immediately before that source node therefore receives `D = J × M(q) × inverse(J)`, giving `D × J = J × M(q)` without applying the source rest twice. Parents propagate motion through the retained source hierarchy.

The kinetic presentation owns these working wrappers separately from the original static source nodes. It uses zero joint coordinates throughout editorial explosion and reassembly. At zero, every working wrapper is an exact identity, allowing seek, reset, and loop playback without incremental drift. All sampling methods are absolute in `q`, independent of query order, and return fresh data that callers may mutate.

The source supplies kinematic axes and position limits. The authored motion is a visual pose sequence, not a validated controller, load model, collision-free trajectory, or service procedure. Effort and velocity fields remain source evidence; this presentation does not claim to enforce dynamics from them. Source STL visuals merge multiple physical bodies, so the eight link identities do not establish per-screw identity.

Run the focused checks from the project root:

```powershell
node --test EXAMPLE_ROBOT/kinetic/tests/joints.test.mjs
```

The checks independently evaluate the complete native URDF chain with Rodrigues rotation, apply working wrappers before the actual nested GLB source nodes, verify mimic and limits, exercise reset and query order, and check every retained GLB triangle vertex against posed conservative bounds at zero, representative, and source-limit poses. An integration check loads the real GLB through `GLTFLoader`, binds it with the shared viewer, passes `Object.fromEntries(rig.posesAt(q))` to `applyWorkingPoses(..., {target: 'model'})`, and verifies nonzero motion, unchanged source transforms, and a later zero reset.

Source design and URDF: [Robonine SO-ARM-102, pinned revision](https://github.com/roboninecom/SO-ARM-102/tree/e871f738c97f43de230cb04d340797da6a68c4b9). Simulation assets use CC-BY-4.0 under the source's explicit licence mapping. Attribution and the upstream distinction between simulation assets and hardware designs remain in `../source/NOTICE` and `../source/LICENSING.md`.
