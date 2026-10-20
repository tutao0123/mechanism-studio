# Unitree G1 source package

This example uses the **complete 29-DoF Unitree G1 visual description** from
[MuJoCo Menagerie](https://github.com/google-deepmind/mujoco_menagerie/tree/71f066ad0be9cd271f7ed58c030243ef157af9f4/unitree_g1),
pinned to revision `71f066ad0be9cd271f7ed58c030243ef157af9f4`.
The robot design and original model are by Unitree Robotics. The Menagerie
contributors curate and adapt the MJCF. Mechanism Studio authors the display
exporter, editorial separation, presentation and score.

The upstream [model-specific LICENSE](unitree_g1/LICENSE) is BSD-3-Clause.
The original [model README](unitree_g1/README.md) explicitly states the same
model license. The upstream repository states that each model's XML **and
assets** use that model directory's license; the repository-wide Apache license
is not substituted for it. This example's source meshes and derivative GLB
retain BSD-3-Clause, separately from Mechanism Studio's MIT code.

## What is retained

- Unmodified `g1.xml`, 35 referenced binary STL meshes, the model's LICENSE,
  README and changelog: **39 upstream files**.
- `provenance.json`: pinned public URLs, byte counts, SHA-256 hashes and Git
  blob SHA-1s for every retained upstream file.
- `upstream-blobs.json`: expected immutable Git tree blob identifiers, obtained
  from GitHub's public Git Trees API for the pinned revision. The downloader
  verifies them before writing the provenance manifest.

The unmodified upstream README contains links to optional preview pictures,
other MJCF variants and papers. Those files are not needed by this example and
are not bundled. No upstream scripts, plugins or executable code are run.

## Display conversion

Run from the Mechanism Studio repository root:

```powershell
# Optional: fetch exactly the same public source again; uses no account token.
./examples/humanoid/source/download-source.ps1

# Rebuild checked-in assets using Node plus Python 3's standard library.
node examples/humanoid/build-humanoid.mjs
node --test examples/humanoid/tests/asset.test.mjs
```

The builder uses the existing project-local Python if available. Otherwise it
uses `python` on Windows or `python3` elsewhere; `MECHANISM_PYTHON` can select
another already installed interpreter. It installs nothing.

The output is a static **zero-joint source pose**, not a dynamics simulation.
Source body `pos` and normalized `quat` placements are preserved. MJCF's
right-handed Z-up metres convert once to glTF's right-handed Y-up metres with
`B(x,y,z)=(x,z,-y)`: semantic node matrices use `B*M*B^-1`, and mesh vertices use
`B*geomTransform*meshScale`. The original `stand` keyframe is retained in
`source-assembly.json`, but is not applied or presented as an authored motion.

There are **30 semantic body identities**, each `mjcf:<original body name>`,
with their direct original source parents. Each semantic Group has one
identity-transform owned visual child. The 35 visual occurrences are merged
into 30 body meshes without changing triangle count, positions or ownership.
Exact Float32 attribute indexing reduces duplication; there is no geometric
decimation or tolerance-based vertex welding. All **393,270 source triangles**
remain. Body-local geom indices identify visual occurrences; `mjcf-mesh:*`
identifies mesh definitions. These are different concepts.

The source head is a visual owned by `torso_link`; rubber hands are visuals
owned by the wrist-yaw bodies. They are not fabricated articulated body IDs.
Source hinge axes and ranges, inertial declarations and actuators remain in the
XML and extracted source JSON, separate from presentation offsets.

## Outputs and evidence

`../assets/scene-index.json` binds identity, source visual spans, full rest
matrices, original hierarchy and measured metre bounds to `humanoid.glb`.
`scene-contract.json` declares immutable rest placement and the static motion
owner. `build-report.json` records hashes, counts and limitations. Generated
asset bounds are approximately 0.446 m × 1.323 m × 0.363 m in the displayed
zero-joint pose.

The tests independently read source XML body nesting and quaternion placements,
then compare every emitted triangle vertex to original STL bytes transformed
through that source hierarchy. They also check all retained blob hashes,
visual ownership, actual world bounds, and rejection of corrupted rest or
parent wiring. They do not prove contacts, assembly clearance or physical
serviceability.

This is a source-backed **MJCF visual assembly**. It is not a native STEP or
parametric CAD assembly; per-screw identity, B-rep geometry, collision-checked
disassembly, balance, control and dynamics validation are outside its scope.

## Upstream files fetched on demand

The upstream STL meshes are not stored in Git. `npm run fetch:sources` downloads
them from the pinned upstream commit recorded in `provenance.json` and accepts
them only if the SHA-256 matches; `npm test` does this first. The pinned list
is [`scripts/upstream-sources.json`](../../../scripts/upstream-sources.json).
