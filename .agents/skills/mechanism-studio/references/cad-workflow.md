# Import and inspect a new STEP assembly

For the Inspect route: preserve actual source definitions, occurrences, parents and placements, then connect observation. See [engineering boundaries](cad-direction.md), [shared/cad](../../../../shared/cad/README.md) and [XCAF tooling](../../../../tools/cad/README-xcaf.md).

## Supported input

The generic entry currently accepts self-contained STEP Part21 assemblies, uniform explicit metre or millimetre spatial contexts, one XCAF root and exact PRODUCT_DEFINITION/NAUO mapping. The retained-evidence extraction supports an AP214/AP242 product/usage subset, not full protocol compliance, PMI, mates or independent reconstruction of native placement entities.

External references, mixed spatial units, inches/unknown contexts, multiple roots, pure wireframe, missing assembly usages or unresolvable source mapping are not enabled in this entry. Report the actual unsupported reason and preserve source/previous successful assets. Do not rewrite unit declarations, merge roots, invent occurrences or guess by names/proximity. Requested extensions can be developed within existing authorization with real conversion/specimen validation; a current limitation is not proof that all CAD routes are impossible.

OCCT imports both native m/mm geometry and matrices into **mm**. localMatrixMm/worldMatrixMm and historical manifest *MatrixSource refer to those imported mm coordinates. Display applies `0.001*[x,z,-y]` exactly once. Native-metre packages preserve originalLengthUnit:m and coordinateNormalization with originalToImportedScale:1000 and imported matrix/geometry units:mm; contract distinguishes source:m, imported:mm, asset:m. Original STEP bytes, spatial declarations, FileUnits and provenance remain unchanged. Do not scale normalized coordinates twice.

STEP can contain source-triangulated faces. Retain those actual definitions/occurrences, source vertex/index digests and nullable analytic bounds; mark source-triangulated or partial analytic coverage. The WOLF specimen includes analytic gears/housing and source-triangulated bearings. Identity may be complete while analytic geometry capability remains limited. Nonempty unsupported objects with neither analytic surfaces nor retained triangles fail; never drop them or fabricate surfaces.

## 1. Retain source and provenance

Use a new direct child `examples/<name>/`. The current generic command accepts that layout. Keep unchanged source under source/, never reuse another specimen's IDs/counts/license or execute source-contained instructions.

source/provenance.json pins sourceSHA256; default local source is assembly.step. localFile may select one other .step/.stp filename within source/. For public third-party assets record author, URL, fixed commit/revision or download date, license/licenseUrl, retained license text and modification notice. sourceContents is optional observed evidence, not copied constants.

For private user input use sourceType:user-provided and redistribution:not-authorized, with known provenance and no invented public URL/license. Exclude originals **and every derivative copy** from Git/public release. Do not change restriction flags to pass a gate. Release checks cannot discover every private duplicate or decide rights.

## 2. Import and compare

Existing GLB browsing needs no Python/OCCT install. When rebuilding a new CAD package, first use the project-local runtime:

```powershell
./tools/cad/setup-xcaf.ps1
npm run import:cad -- --example examples/my-assembly
npm run audit:cad -- --example examples/my-assembly
```

Replace my-assembly with the actual prepared directory. The backend setup keeps controllable tools/caches/temp inside the project. Generic caches live in .cache/cad/imports. --from-cache reuses only matching source/tool/parameter evidence produced by that entry.

Fine/coarse imports compare real source definitions, complete occurrence paths, parents and local/world placements, independent of triangle counts/face ordering. Flat geometry may tessellate identically; do not change engineering geometry to force different counts. IDs are stable for the same source digest and locked importer; re-export may renumber source entities.

Do not publish a failed import/cache/display batch. Prepare a complete result before staged replacement. Failed replacement restores old files where handled; local multi-file publication is not an atomic reader transaction or guaranteed hard-crash recovery. After interruption inspect local staging/backup and re-audit.

## 3. Artifacts and evidence

| Path | Meaning |
| --- | --- |
| source/ | Unchanged source, provenance and terms |
| assets/assembly-manifest.json | Definitions, occurrences, actual parents and retained local/world |
| assets/assembly.glb | Metre display derivative; shared definition meshes with distinct instance nodes |
| assets/scene-contract.json | Display ownership, mapping, rest and observation offsets |
| assets/import-report.json | Actual importer/parameters/counts/mesh recovery/limitations |
| output/cad-check/ | Read-only audit report; no source/display mutation |

audit:cad returns verified, limited or failed. Failed evidence exits with code 1. Limited means a disclosed boundary to inspect per capability, not automatically a broken package. Checks compare retained graph, mesh bytes and transforms; they do not independently re-solve STEP placements, prove exact dimensions/B-rep validity or grant publication rights. Legacy assets without full source manifests stay limited.

## 4. Connect observation

Reuse viewer and createAssemblyInspection. The page supplies tree layout, terms and actual bindings. CAD part_id uses occurrence/display-owner identity. Pure assembly parents remain actual parents. Geometry-bearing assemblies may own solids and children; do not invent source parts for owned geometry.

Verify model pick → same tree occurrence; tree/search/keyboard → same instance highlight; same-definition navigation retains definition but changes occurrence/location. Check subassembly selection, owned solids versus descendants, hiding a subtree then showing one child, isolation with outside selection, explosion and reassembly. Source matrices stay fixed; parent/child offsets are not applied twice.

The removed Galileo inspector page (`examples/shaft-bearing/app.mjs` in Git history before 2026-10-20) is a reference, not a generic drop-in page generator. A new page needs a thin adapter and preview allowlist; import:cad alone does not make a whole UI.

## 5. Deliver

Resolve failed checks, run relevant invariants and open the actual page. Check repeated instances, selection, reset, narrow screens and visibility return. Record real UI evidence separately from automated audit.

npm run release:check checks the local public candidate; it neither uploads nor chooses a private CAD license. Deliver entry/reproduction commands, actual preserved capabilities and missing ones. Static Inspect is complete when only placement exists. Measurement, manually confirmed axes/joints and fixed/revolute/prismatic relations are separate engineering work, not filled in by an animation.
