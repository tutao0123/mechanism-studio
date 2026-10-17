# Assembly & Explode

An internal [authoring contract](../module-orchestration.md), not a separate skill, plan loader or disassembly solver. The viewer implements linear display explosion; grouping and staged choreography require an example adapter.

## Responsibility

Choose fixed components, local/group separation, ordering, result holds and reassembly to expose the requested relationship. Return offsets and a complete display envelope while preserving source identity, real assembly parents, mechanics and selection. Camera and appearance consume the result; this module does not own either.

It does not recover mates, solve joints, remove threads, alter source placement, or prove collision-free assembly. Radial separation is an observation aid. A paused mechanism is an editorial choice, not a newly solved constraint.

## Inputs and preconditions

| Input | Required content | Missing-input behavior |
| --- | --- | --- |
| `brief` | Goal, route, sources and known/assumed/unknown relations | State uncertainty; do not promote assumptions to facts |
| `scene-index` | Actual occurrence/display IDs, parents, geometry revision, units/basis, display ownership and geometry | With no geometry, return candidate groups at concept stage |
| Mechanical pose contract | static/model/clip ownership, absolute/incremental pose semantics and intended motion range | Keep source pose if no adapter is declared |
| `timeline` | Caller-owned time domain, intervals, pause/seek/loop behavior | Free Inspect can use a user-controlled progress function |
| Display restrictions | Fixed parts, hidden/isolation state, grouping intent and target surfaces | Inspect this model; do not copy another example's constants |

Text/image reconstruction uses explicitly authored IDs after geometry exists; it does not provide native CAD occurrence identity. CAD placement does not imply mates.

## Output: explosion-plan

Record `stage` (concept/bound/validated), `geometryRevision`, `planRevision`, mechanical pose/range reference, and:

- Authored display group → actual occurrence/display-ID list, preserving repeated instances and source parents.
- Per-target offset vector, unit, space, applicable parent, zero reference and parent/child inheritance policy.
- Stage intervals and offset/progress functions on the supplied timeline, holds and reassembly; a simple Inspect may need only progress.
- Bounds covering intended poses, all stages and necessary intermediate offsets; calculation method and sampling limitations.
- Actual identity, transform, restoration and frame checks, plus unverified collision/engineering meaning.

A definition shared by repeated screws does not make them one part. Visual groups do not rewrite the assembly tree. Geometry changes require rebinding. Offset/group/range changes update planRevision and invalidate affected camera envelopes and anchors. These dependencies are author-managed; there is no automatic dependency executor.

## Transform rules

Follow [the scene contract](../scene-contract.md): source parent → display → model → source node. Write observation offsets only to display; source rest and mechanical state remain intact.

1. Default offsets are **glTF metres in the display wrapper's parent space**, not universally world space or source millimetres.
2. Transform a world direction by the corresponding inverse linear parent transform; do not contaminate it with translation. Convert units once. If a parent moves, a fixed-world-direction plan needs the declared pose-dependent conversion.
3. Children inherit parent movement. Move the parent group or offset its children individually. If both are required, apply only the child's residual after inheritance and verify the resulting world transform.
4. A pure assembly node may not appear in `viewer.parts`; a planning group is not automatically a binding. Use actual child bindings or implement and test a dedicated adapter.
5. A mixed assembly may own solids and children. Moving its wrapper moves descendants; moving only owned solids needs explicit owner-aware adaptation. Do not invent an engineering child or double-count descendant meshes.

The [XCAF display adapter](../../../../../tools/cad/xcaf-display.mjs) converts radial offsets to actual parent coordinates. Assemblies with owned solids conservatively keep their wrapper at zero while descendants separate. This is a presentation strategy, not a universal removal sequence.

## Runtime integration

Use [the viewer API](../../../../../shared/viewer/README.md):

```js
await viewer.ready;
viewer.setExplode(progress); // existing contract vectors
viewer.setExplode(progress, {
  vectorForPart: binding => vectorsById.get(binding.id),
});
viewer.setExplode(0); // reassemble without clearing hidden/isolation choices
```

The adapter-created map must cover every binding, including fixed parts with `[0, 0, 0]`. Progress is clamped to [0,1]; all finite 3D vectors are checked before assigning `display.position = vector * progress`. This API does not infer groups, stages or joints.

A staged example computes complete offsets from the caller's timeline, without competing timers. `resetObservation()` additionally resets display rotation, scale and visibility; use it for a full observation reset, not merely reassembly. `fitVisibleAssembly()` supports explicit interactive fitting; never fit the automatic camera each animation frame. Pass the finalized envelope to [camera direction](camera-direction.md).

## Validation and failure handoff

Check actual unique bindings/repeated occurrences, rotated parents, nested groups, mixed-owned solids, zero/intermediate/full separation and return to zero. No cumulative drift; mechanical inputs/readouts/source matrices stay unchanged, while displayed world matrices change by the intended offset. Verify hidden/isolation/select/full-reset semantics independently.

For timed work, test pause, backward/forward seek, motion overlap, all stages and the loop. Inspect real full/close/most-expanded frames and narrow viewports for clipping, target readability and labels. Existing [scene tests](../../../../../shared/viewer/tests/scene.test.mjs) validate shared invariants, not a new plan's bindings or engineering feasibility.

Missing geometry, ambiguous units or unmapped IDs returns a specific unresolved handoff or concept plan. Do not publish a partially applied offset set as validated; retain the previous working asset/plan.
