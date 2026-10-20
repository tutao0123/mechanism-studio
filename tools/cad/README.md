# CAD import and evidence checks

Use this workflow to retain source definitions, placed occurrences and display
bindings for a real STEP assembly. The mechanical source stays separate from
the triangulated GLB. Runtime details and OCCT references are in
[README-xcaf.md](README-xcaf.md); the skill's acceptance sequence is in
[cad-workflow.md](../../.agents/skills/mechanism-studio/references/cad-workflow.md).

## Supported input boundary

The current workflow accepts a self-contained STEP Part 21 **assembly**, uniform
explicit metre or millimetre spatial geometry contexts and exactly one XCAF root assembly. Every
source `NEXT_ASSEMBLY_USAGE_OCCURRENCE` (NAUO) must map exactly through OCCT to
its XCAF component and referenced `PRODUCT_DEFINITION`. Names, mesh order and
geometric proximity are never fallback identity rules.

External-file references, mixed or unsupported spatial units, multiple roots,
wire-only geometry, missing assembly usage relationships and unresolved source
mapping are unsupported by this entry point. It retains the unchanged source and
records metre-to-millimetre OCCT normalization explicitly; it does not merge roots
or invent instances. Explicit 2D
`PARAMETRIC_REPRESENTATION_CONTEXT` records without assigned units are accepted
as surface parameter contexts; this exception does not make arbitrary 2D or 3D
geometry unitless. The backend independently retains its actual `FileUnits`
results. Imported coordinates and placement matrices are normalized to millimetres;
the display exporter converts those coordinates to glTF metres exactly once.

The audit's source-entity extraction checks the PRODUCT_DEFINITION/NAUO subset,
not every STEP application protocol or ISO conformance rule. Verified specimens
and their schema are recorded in each actual import report; successful AP242
geometry import does not imply PMI or mate recovery.

## Prepare an example

Create an existing direct child `examples/<name>/`, then retain the unchanged
source in `source/assembly.step` and its metadata in `source/provenance.json`.
The import command accepts only `examples/<name>`, not arbitrary absolute paths
or the project root.

`sourceSHA256` is required and must contain the original file's lowercase
SHA-256. Set `localFile` for another single `.step` or `.stp` filename directly
inside `source/`; the default is `assembly.step`. Optional `sourceByteLength`,
`sourceLengthUnit` and `sourceContents` supply additional checks when known.
Counts must describe this source, not another example.

For public third-party files, retain author, original `url`, fixed revision or
download date, `license`, `licenseUrl`, license text and modification notes.
For a privately supplied model without public authorization, use
`sourceType: "user-provided"` and `redistribution: "not-authorized"`; do not
invent public URLs or license grants. Keep that source and all its derivatives
out of the release candidate. A technical audit can continue locally without
establishing redistribution rights.

## Run from the project root

With Node dependencies installed, create the local CAD runtime only if a fresh
CAD rebuild is needed:

```powershell
./tools/cad/setup-xcaf.ps1
npm run import:cad -- --example examples/<name>
npm run audit:cad -- --example examples/<name>
```

Replace `<name>` with the actual directory. Viewing retained assets and auditing
them do not require a Python/OCCT installation. The equivalent Node commands
are:

```powershell
node tools/cad/import-assembly.mjs --example examples/<name>
node tools/cad/check-assembly.mjs --example examples/<name>
```

The importer reads and preflights retained bytes before starting the backend or
writing a cache. It performs two real XCAF imports: linear/angular deflections
of `0.08 mm / 0.4 rad` and `0.3 mm / 0.7 rad`. Definitions, expanded occurrence
paths, parentage and source local/world matrices must agree across those runs.
Equal triangle counts at different settings are valid, for example on planar
parts; the report discloses equality rather than claiming a density change.
Per-face recovery can use different effective settings, which remain recorded
in the face evidence and warnings.

Caches are isolated by example under `.cache/cad/imports/`; controlled temporary
files stay inside the project. To reuse that entry point's existing caches:

```powershell
npm run import:cad -- --example examples/<name> --from-cache
```

Both caches must match the retained source hash, pinned importer version and
expected tessellation settings. This option does not create missing caches or
borrow another model's cache.

## Generated files and publication failure

| File | Contents |
| --- | --- |
| `assets/assembly-manifest.json` | Source definitions, separate occurrences, actual parentage and normalized millimetre local/world matrices; original unit evidence is retained |
| `assets/assembly.glb` | Metre display derivative, distinct occurrence nodes and shared definition meshes |
| `assets/scene-contract.json` | Semantic display ownership, source bindings, rest and observation-only explosion |
| `assets/import-report.json` | Source/display hashes, actual counts, importer, meshing settings, recovery evidence and limitations |
| `output/cad-check/<name>.json` | Default retained-evidence audit report |

The four CAD asset files are validated before publication. Publication stages
all payloads and backs up existing owned files inside the local cache; ordinary
replacement failures trigger rollback. Other assets, including audio, are not
replaced. An incomplete rollback retains backups and reports their location.
This is not an atomic transaction for concurrent multi-file readers and does
not guarantee automatic recovery from a terminated process or operating-system
crash. After such an interruption, inspect staging/backups and rerun the audit
before treating the package as complete.

Existing ancestors and targets are resolved before reads/writes so junctions
cannot redirect operations outside the project. These checks are application
boundaries, not an operating-system sandbox or an extension of tool permissions.

## Read the audit correctly

`audit:cad` reads retained source and display files without modifying them. It
writes only a local report. An explicit report destination must remain under
`output/`:

```powershell
npm run audit:cad -- --example examples/<name> --output output/cad-check/custom.json
```

- `verified`: every executed evidence check passed within its stated scope.
- `limited`: no contradictory evidence was found, but a check has a disclosed
  limit, such as missing source-entity extraction or recovered mesh faces.
- `failed`: evidence is missing, invalid or contradictory; the CLI exits with
  code `1`. A limited report normally exits with code `0`.

Read `capabilities` and `findings`, not only the overall status. A `verified`
package still has unsupported mates, engineering measurement and physical
simulation. The audit compares retained source references, manifest relations,
exported matrices, actual GLB mesh bindings and face ranges. It does **not**
independently recompute native STEP placements, execute B-rep measurement,
prove geometric precision or validate licensing rights. A complete license
record is evidence retained for a separate publication decision.

No real STEP package is currently retained in this repository, so no included
example exercises this path end to end; prepare one as described above.

## Integrate and maintain

Importing assets does not generate a complete webpage. Reuse
[shared/cad](../../shared/cad/README.md) for source/observation state and
[shared/viewer](../../shared/viewer/README.md) for rendering. A new example still
needs a thin page adapter, labels, tree layout and a scoped preview route.
Verify model/tree selection, repeated-instance switching, hidden children,
isolation, explosion/reset and narrow layouts in the browser. Display explosion
is not a collision-verified disassembly sequence.

`import-assembly.mjs` exports `runCadImport`, `readCadSourcePackage`,
`resolveExample`, `resolveScopedPath` and `publishCadAssets` for local tooling.
`check-assembly.mjs` exports `checkCadExample` and `writeCadAuditReport`;
the in-memory audit is documented in `shared/cad`.

Run `node --test tools/cad/tests/import-workflow.test.mjs` for orchestration
regressions, `node --test shared/cad/audit.test.mjs` for evidence checks, and
`npm test` for the project suite. Synthetic test fixtures test contracts and
failure handling; they do not count as real CAD specimens.
`npm run release:check` checks the current local release candidate and does not
publish files or choose a license for private CAD.
