# Executable study presentation

Use this path when a study needs the supported combination of display separation,
orthographic shots, near-part names and timed accents/opacity. The four
[authoring contracts](module-orchestration.md) still decide what to show and why.
`shared/study/plan.mjs` executes a bounded subset of their output; mechanics and
specialized presentation behavior remain explicit example adapters.

## Bind the plan to real inputs

Start from [the reusable example template](../../../../templates/study/README.md).
Keep the actual GLB, scene contract, index, provenance, score and source ownership
inside the example. A plan is plain JSON data with schema
`mechanism-presentation-1`; it is not an older `planning/*-plan.json` handoff.

`compilePresentationPlan(plan, index)` requires an exact `geometryRevision` match
and unique stable part IDs. Bind every offset, label and appearance cue to these
IDs. Define contiguous chapters covering the duration, named rise/fall channels
in absolute seconds, chapter-local label windows and a fixed orthographic
envelope for every shot. Read the [canonical API](../../../../shared/study/README.md#executable-presentation-plan)
for accepted fields and sampling semantics; unsupported fields fail instead of
quietly becoming unimplemented instructions.

The compiler samples complete world display offsets without modifying source or
working poses. The example converts them into real display-parent residuals,
including inherited parent motion. Prepare conservative envelopes from actual
geometry and the full working/offset range; compilation does not prove that an
authored box contains all moving geometry. Preserve the existing common-clock,
source identity, pause/seek and restoration contracts.

`startStudyExample(definition)` in `shared/study/example.mjs` supplies the common
page bootstrap. Its `createPresentation(index)` factory composes the compiled
channels with the example's mechanical state, world-to-parent conversion and any
specialized hooks. The [gearbox](../../../../examples/gearbox/presentation.mjs)
and [Robotiq gripper](../../../../examples/robotiq-gripper/presentation.mjs) are
working integration references with distinct kinematics, not sources of universal
IDs, axes or bounds. Start from the template rather than copying their formulas.

Atlas remains the default. This runtime does not automatically reconstruct CAD,
simulate forces/collisions, infer mates or generate arbitrary cinematic camera,
PBR, film graphics and soundtrack treatments. The existing Cinematic edition
keeps its own adapter. Broader texture/light, mating-phase/direction and audio
authoring still follow their specialist references.

## Check the plan and the delivery

From the project root:

```sh
node tools/study/check-presentation.mjs --example gearbox --output output/presentation-checks/gearbox.json
node tools/study/check-presentation.mjs --example robotiq-gripper --output output/presentation-checks/robotiq-gripper.json
```

The checker writes a reproducible numerical report tied to input hashes and the
geometry revision. Read the actual `samples`, `checks` and `status`, and retain
the report with the task's evidence. `manualReview` keeps browser/video work
explicitly pending. A numerical pass does not establish readable labels, an
unclipped transition, good sound or an inspected MP4.

Open the real page and inspect whole, detail, most-expanded and restored views
at desktop and narrow aspects; exercise seek, pause, restart and the loop. For a
video deliverable, review the actual encoded sequence and its text at delivery
sizes using [delivery evidence](delivery-evidence.md). Only mark those checks
complete after performing them. Keep `bound`, numerically checked, visually
reviewed, exported and published outcomes distinct.

Geometry/identity, offset ranges, timing or visibility changes invalidate the
affected envelopes, label windows and evidence. Recompile against the current
index and rerun relevant numerical checks, then review changed visual behavior.
Do not update hashes merely to disguise stale evidence.
