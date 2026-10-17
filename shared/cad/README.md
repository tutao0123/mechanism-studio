# Source assembly inspection

`assembly.mjs` preserves the distinction between a reusable CAD definition and
each placed occurrence of that definition. It contains no mesh importer,
rendering dependency, geometry measurement or joint solver. The importer owns
source identity and placement extraction; this module checks the supplied data
and manages observation state without modifying engineering transforms.

## Identity manifest

```js
{
  root_id: 'assembly-root',
  source: { units: 'mm', /* native file, hash, importer, provenance, etc. */ },
  definitions: [
    { definition_id: 'support-design', name: 'Bearing support', kind: 'assembly' },
    { definition_id: 'screw-design', name: 'Socket screw', kind: 'part' },
  ],
  occurrences: [
    {
      occurrence_id: 'assembly-root', parent_id: null,
      definition_id: 'support-design', kind: 'assembly', label: 'Bearing support',
      source: { /* actual source references, never inferred from mesh order */ },
      localMatrixSource: [/* 16 column-major numbers */],
      worldMatrixSource: [/* 16 column-major numbers */],
    },
    // Each screw has its own occurrence_id, actual parent, and placement.
  ],
}
```

Matrices retain the manifest's declared coordinate units. For historical XCAF
exports those are OCCT-imported millimetres, which may differ from a retained
STEP file's original metres. A native-metre package explicitly records
`source.originalLengthUnit: 'm'` and `source.coordinateNormalization` with
`importedLengthUnit`, `matrixCoordinateUnit` and `geometryCoordinateUnit` all
`'mm'` and `originalToImportedScale: 1000`; `source.sourceUnits` retains original
`sourceLengthNames: ['metre']`. The `*MatrixSource` field names refer to retained
engineering placements in that declared imported coordinate system, not raw
native-metre numbers. A child must satisfy
`world = parent.world * local`; the root satisfies `world = local`. Validation
uses absolute tolerance `1e-7` plus relative tolerance `1e-9`. Matrices must be
finite and affine. The tree has exactly one declared root, existing parents,
matching definition kinds, and no cycles. Parts cannot parent other occurrences.
Several occurrences may reference the same definition; duplicate labels are
valid and are never used as identity. `source.units` also accepts an object such
as `{length: 'mm', angle: 'rad'}`. A unit declaration does not prove its importer
converted or interpreted the native file correctly.

`createAssemblyIndex(manifest)` clones and deeply freezes the source data. The
index provides `manifest`, `rootId`, `occurrenceIds`, `leafIds`, `get(id)`,
`definition(definitionId)`, `children(id)`, `ancestors(id)` (nearest first),
`descendants(id, {includeSelf})`, and `leafDescendants(id)`. Here a leaf is a
semantic occurrence with `kind: 'part'`, not an individual tessellation fragment.
Lookup arrays and records are immutable. Missing direct lookups return
`undefined`; traversal of a missing ID throws.

A real source assembly definition may own geometry **and** actual child
occurrences. Declare its own geometry metadata in `definitions[].geometry`
(an object); keep `kind: 'assembly'` and its actual source children. Do not
invent a child source part to hold that body. `displayIds` lists all source part
occurrences plus occurrences of geometry-bearing assembly definitions;
`displayDescendants(id)` includes these display owners within the selected
subtree, including `id` itself when it owns geometry. `leafIds` and
`leafDescendants()` retain their literal source-part meaning. The GLB can give
an assembly occurrence node a `part_id` for its own body while retaining its
actual child nodes. Mesh descendants belonging to child occurrences must remain
owned by their respective occurrence IDs.

`multiplyMatrices(parent, local)` uses column-major matrix storage.
`sourceToGltfMatrix(matrix, {metersPerUnit: 0.001})` specifically converts a
right-handed **+Z source** to right-handed **+Y glTF**. It conjugates the full
matrix by the basis mapping `metersPerUnit * [x, z, -y]`. An importer with another
source basis must supply its own conversion. This helper does not convert
geometry vertices or infer their unit/basis.

## Observation controller

```js
import { createAssemblyInspection } from '../../shared/cad/assembly.mjs';

const inspection = createAssemblyInspection(manifest);
inspection.select('one-screw-occurrence'); // model pick or tree item
inspection.select('one-support-occurrence'); // highlights descendant parts
inspection.toggleHidden('one-support-occurrence');
inspection.setHidden('one-screw-occurrence', false); // reveals only this child
inspection.isolate('one-support-occurrence');
inspection.setExplode(0.5); // display progress only; app owns display vectors
const state = inspection.resetObservation();
```

Every action returns the same structure as `inspection.snapshot()`, a deeply
frozen value that does not change when later actions run:

- `selected_id`: one occurrence or `null`; `highlighted_ids`: its descendant
  display owners, including itself when it is a part or an assembly with a body.
- `hidden_part_ids`: explicit manual hides of display owners. This historical
  field name includes geometry-bearing assemblies as well as source parts.
  Hiding an assembly hides its own body and descendant display owners;
  showing one child later reveals that child without exposing its siblings.
- `isolated_id`: the isolation target or `null`. Isolation restricts the visible
  subtree while retaining its ancestors. It respects manual hides. Selecting a
  different tree item does not silently change the isolation target.
- `visible_part_ids`: effective visible display owners, including geometry-bearing
  assembly occurrences. `visible_ids` and `hidden_ids` describe tree node
  visibility, with isolation included. Assembly ancestors remain in `visible_ids`
  when any descendant display owner is visible; their own body can remain hidden
  and absent from `visible_part_ids`.
- `visibility`: each occurrence is `visible`, `partial`, or `hidden`. An empty
  assembly without its own body is `hidden` because it has no displayable geometry.
- `explode`: finite display progress in `[0, 1]`.

`isolate()` defaults to the selected occurrence and requires a selection.
`clearIsolation()` retains manual hides. `resetObservation()` clears hides,
isolation and explosion while retaining selection. These operations never alter
the manifest or source matrices. The app applies visibility and explosion to
viewer **display wrappers**, and maps each `occurrence_id` to one semantic part
node that may own several mesh fragments. An assembly tree is not a set of CAD
mates; this module does not establish contacts, constraints or physical motion.

Run the focused checks with `node --test shared/cad/assembly.test.mjs`, or the
whole project with `npm test`.

## Retained-evidence audit

`audit.mjs` inspects an already retained source/display package in memory. It
does not launch OCCT, read files or publish assets:

```js
import { inspectCadEvidence } from '../../shared/cad/audit.mjs';

const report = inspectCadEvidence({
  sourceBytes,   // Buffer containing the unchanged STEP
  provenance,   // source hash, origin/license declarations or private-source marker
  manifest,     // assembly-manifest.json; missing legacy manifest stays limited
  contract,     // scene-contract.json
  importReport, // import-report.json
  glbBytes,     // retained GLB Buffer
  sourceMetadata, // optional separately extracted AP214/AP242 product/usage subset
});
```

The result contains `schemaVersion`, `status`, `checks`, `summary`,
`capabilities` and `findings`. Individual checks use `passed`, `limited` or
`failed`; findings contain the limited/failed checks and their details. Counts
come from the supplied package rather than a named specimen.

The audit checks source/display hashes, retained provenance declarations,
manifest identity and parent/world consistency, actual exported hierarchy,
full local/world display-matrix conversion, repeated-definition mesh reuse,
geometry-bearing assembly ownership, indexed triangles, retained face ranges,
mesh recovery warnings and reported counts. Optional `sourceMetadata` currently
supports the AP214/AP242 `PRODUCT_DEFINITION`/NAUO subset. It checks source references
and each parent's expanded usage relationships; absent or unsupported source
extraction remains limited instead of promoting display names to source IDs.
This is not a full AP242 conformance, PMI, mate or native-placement validator.
For native-metre inputs it checks unchanged STEP spatial unit declarations,
provenance, original XCAF unit names and explicit normalization metadata. Those
coordinates are imported in mm, then converted once to metre display units.
Mixed spatial units and contradictory or missing normalization evidence fail;
raw source unit labels must never be replaced to make a package pass.

Overall status is `failed` if any executed check fails, `limited` if a check has
a disclosed limitation, otherwise `verified`. Per-face recovery can therefore
make a package limited even when every displayed face is present. A missing
legacy source manifest also remains limited; it is not reconstructed from
fragments by this module.

Capabilities are separate from overall evidence status:

| Capability | Assessed scope |
| --- | --- |
| `sourceIdentity` | Retained source hashes, product/usage references and exported occurrence hierarchy |
| `placementConsistency` | Manifest parent/local/world consistency and imported mm/+Z to m/+Y display conversion; explicit normalization required for native metres |
| `sharedDefinitionGeometry` | Distinct occurrence owners bound to shared actual definition meshes |
| `displayFaceCoverage` | Actual triangle ranges and disclosed effective recovery settings |
| `publicRedistribution` | `not-assessed`, or `unsupported` for an explicitly unauthorized user-provided source |
| `mates`, `engineeringMeasurement`, `physicalSimulation` | `unsupported` by this inspector |

An assessed technical capability can be `supported`, `limited` or `failed`.
Even `verified` does not mean every capability is implemented. Placement checks
compare retained matrices and their export; they do **not** independently
re-evaluate placement entities in native STEP. Face coverage does not establish
meshing-error bounds, exact dimensions, B-rep validity or closed solids. The
audit does not solve constraints, measure B-reps, run contact/collision physics,
or determine source/derivative licensing rights. A retained license declaration
does not become a publication grant through a passing report.

## Generic project commands

Use the Node wrappers for scoped filesystem access and report writing:

```powershell
npm run import:cad -- --example examples/<name>
npm run audit:cad -- --example examples/<name>
npm run audit:cad -- --example examples/<name> --output output/cad-check/custom.json
```

The importer currently accepts self-contained STEP assemblies with uniform
explicit metre or millimetre spatial contexts, exact source usage mapping and
one XCAF root. OCCT imports geometry and matrices in mm for either native unit;
the source bytes and original unit names remain unchanged. Mixed native spatial
units, inches and unknown contexts are not enabled by this route.
The source must be retained under that example's `source/` with a pinned
`sourceSHA256`; `localFile` selects another single STEP filename if needed.
It compares two actual tessellations without changing engineering identity.
Use `--from-cache` on `import:cad` only after that example's generic caches exist.
The audit reads source/assets without modifying them and writes a local report
under `output/`; a failed audit exits `1`, while a disclosed limitation is not
itself a CLI failure.

See [CAD tooling](../../tools/cad/README.md) for setup, provenance, generated
files, cache layouts, staged replacement/rollback and source restrictions.
The workflow does not generate an entire interactive page, promise atomic
multi-file reads or guarantee automatic crash recovery. A page still connects
these modules to the shared viewer and verifies its actual interactions.

Run `node --test shared/cad/audit.test.mjs` for audit regressions. The existing
Galileo inspection and an isolated real KFL08 generic import provide specimen
evidence; they do not establish support for every STEP schema or assembly.
