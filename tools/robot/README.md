# Pinned robot visual import

This local builder supports two retained packages at MuJoCo Menagerie revision
`62ab00f2bc44f6f20c1c9b7a13f3fb1dd41a4e35`: Wonik Allegro **right** hand and
Robotiq 2F-85 **v4**. It reads XML and binary STL bytes; it never imports upstream
Python, runs a simulator, downloads dependencies or reconstructs missing hardware.
This is a deliberately bounded adapter, not a general MJCF/URDF importer.

```sh
node tools/robot/build-mjcf.mjs --example examples/allegro-hand
node tools/robot/build-mjcf.mjs --example examples/robotiq-gripper
node --test tools/robot/tests/import.test.mjs
```

Node uses the repository's Three.js dependency. The XML reader uses Python's
standard library, choosing `MECHANISM_PYTHON`, the existing project-local CAD
Python, or `python` / `python3` on PATH. It installs nothing. All input/output
paths remain in this checkout; links and traversal are rejected.

## Input and output

Each example supplies `source/provenance.json` with source-relative `localFile`,
`licenseFile`, `sha256`, `revision`, `license`, `repository`, `title`, and a
`files` array of `{ localFile, bytes, sha256 }`. Original bytes are verified before
conversion. `source/import-config.json` identifies `modelId` (`allegro-right` or
`robotiq-2f85-v4`) and may restate the expected body/joint/visual counts. Source
SHA and counts are independently fixed in the importer; a different model needs
an explicit adapter review.

The builder writes these derivatives under the example's `assets/`:

- `assembly.glb`: one semantic node per original body, preserving its direct
  source parent; separate identity children own the visible solid meshes.
- `scene-index.json`: stable `mjcf:<body-name>` IDs, source visual occurrence and
  mesh-definition IDs, source rest matrices, actual mesh bounds and display
  bindings. Collision-only bodies retain their semantic node and a clearly
  marked point bound (`hasGeometry: false`), with no invented solid.
- `scene-contract.json`: rest matrices, units, parents and motion ownership.
- `source-assembly.json`: native body placements, resolved visual/joint defaults,
  original geometry attributes, hinge ranges/reference values, equalities,
  contacts, actuators, tendons and keyframes. Constraints are retained, not solved.
- `build-report.json` and `LICENSE`: measured geometry counts/hashes, scope and
  the retained model-specific license.

Both sources use metre geometry and radians. `B=[x,z,-y]` changes Z-up source
coordinates to Y-up display exactly once: body nodes use `B * M * inverse(B)`;
visual vertices use `B * geomTransform * meshScale`. Non-unit source quaternions
are normalized when forming rotation matrices while their original values stay
in the evidence. Triangles are retained; only identical Float32 position/normal
attributes are indexed together.

Default classes inherit by XML nesting, and a body's `childclass` applies only
inside that body. In particular, Robotiq's named `2f85` mesh scale of `0.001`
does **not** apply to unnamed assets outside that body: those STL files already
use metres and resolve to scale `1`. Visual geometry derives from the `visual`
default hierarchy; collision classes and their primitive geoms are preserved as
evidence but excluded from the display derivative. Unsupported compiler,
transform, external include, non-hinge joint or visual geometry syntax fails.

## Working motion remains example-owned

The shared viewer wraps an immutable source node `J` in a separate `model`
channel. For a hinge in the source body's local coordinates, form
`M(q) = T(p) * R(axis, q-ref) * T(-p)`, convert it with `B`, and give the viewer
`D = J * M(q) * inverse(J)`. Its effective local pose is then `D * J = J * M(q)`.
Compose multiple joints in source declaration order if a future reviewed profile
needs them. Return complete absolute poses, including identities at reset; do not
accumulate rotations frame by frame or overwrite source rest nodes.

`motionOwner: model` marks bodies with a declared hinge; fixed bodies retain
static local placement while inheriting parent motion. Equalities require an
explicit example-specific closure model and residual checks. The exporter does
not convert them into a simulation or infer mechanically valid gestures.

Allegro's `thj0` reference is zero but its declared minimum is `0.263` rad. The
export keeps the original reference geometry. The showcase adapter must explicitly
choose a legal operating baseline and account for its posed parent frames when
converting world-space observation offsets; it must not silently claim the source
reference is within every limit. Camera bounds should include actual articulated
poses. The shared study's retained names require stationary target solids.

Model packages retain their BSD licenses. The importer and its documentation are
original Mechanism Studio MIT code. These source meshes do not supply screws,
bearings, actuator internals or collision-checked servicing instructions.
