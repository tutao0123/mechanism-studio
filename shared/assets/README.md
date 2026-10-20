# Asset checks shared by the examples

These modules inspect delivered display assets. They do not calculate B-rep precision, validate mechanical constraints or infer original CAD identity from a rendered mesh.

- `glb.mjs`: self-contained GLB 2 header/chunks/buffer validation, dense accessor bounds, semantic IDs, actual position bounds and SHA-256. It fails on malformed data rather than returning a partial asset.
- `contract.mjs`: metre display units, unique part/assembly IDs, complete mapping, real exported parent links, cycle detection, finite rest/explode/axis values, and static/model/clip ownership. A glTF animation may target only a clip-owned semantic node.
- `write-glb.mjs`: a small deterministic writer used for CAD display derivatives. The engineering source remains separate.

`validateSceneContract(gltf, contract, options)` accepts `restToAsset` for an explicit body-to-asset conversion and `epsilon` in asset metres. The engine uses its model's conversion, while CAD display derivatives declare metre rest values directly. The lock's older manifest uses `web-model` and `restGltfMeters`; its test performs a visible compatibility adapter into the normalized shape. Its legacy GLB does not carry owner extras, so the adapter explicitly sets `checkOwnersInAsset:false`; ownership remains enforced by lock-specific runtime tests. New assets must carry matching owner extras.

The XCAF assembly derivative uses `rest.matrix` for the full source local placement after its coordinate-basis conversion. The validator checks all 16 values and refuses a node that also declares TRS, preventing accidental double transforms. Source definition and occurrence metadata are validated separately by `shared/cad`; a display mesh may be shared by several distinct source occurrence nodes.

Existing mechanism tests retain their own geometric invariants: pin lengths and exact key contacts for the lock, cam profile and initial working poses for the engine. Common format checks supplement those invariants; they do not replace them with a generic “file loads” assertion.

`node --test shared/assets/assets.test.mjs` exercises invalid length, truncation, duplicate IDs, accessor overruns, wrong units, wrong parents, cycles, rest mismatches and animation ownership conflicts.
