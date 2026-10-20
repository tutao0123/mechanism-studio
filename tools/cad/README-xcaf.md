# STEP assembly identity backend

`import-xcaf.py` uses OCCT's XCAF assembly model through the pinned
`cadquery-ocp` Python bindings. It reads source product definitions, follows each
real STEP `NEXT_ASSEMBLY_USAGE_OCCURRENCE` to its XCAF component with
`STEPCAFControl_Reader.FindInstance`, and retains the referenced definition,
parent, local placement and accumulated world placement.

Names are labels only. IDs use the source SHA-256 plus actual STEP entity labels
and the occurrence path. They remain stable across tessellation settings for
the same source and pinned importer. Re-exporting a STEP may renumber its
entities and produce new IDs. XCAF labels are kept as diagnostic references.
Exact label lookup advances from the previous resolved native reader rank and
retries from zero when ordering differs. It never equates file entity numbers
with reader ranks; this avoids repeated full-model scans on large assemblies
without using the pinned bindings' unreliable derived-wrapper `IdentLabel`.

## Local runtime

On Windows, run this from the project root using an existing `uv` executable:

```powershell
./tools/cad/setup-xcaf.ps1
& ./.tools/cad-python/Scripts/python.exe tools/cad/import-xcaf.py `
  --source examples/wolf-actuator/source/assembly.step `
  --output output/cad-research/wolf-actuator-fine.json
```

The setup script installs fixed package versions in `.tools/cad-python` and
keeps uv caches, downloaded Python runtimes and temporary files inside the
project. An existing compatible Python may be used read-only. No global
configuration, PATH or skill installation is changed. `.tools` and `.cache`
are ignored and excluded from public release files.

`vtk` is installed without its optional plotting dependency stack because this
CLI only needs its DLLs for the OCP import. This runtime is not a general
CadQuery, VTK plotting or Blender environment. On another platform create an
equivalent project-local Python 3.12 virtual environment and install
`requirements-xcaf.txt` with `--no-deps`, with all controllable caches and temp
directories inside the project.

## JSON contract

- `definitions` contain source product metadata and one shared mesh for every
  geometry-bearing definition. Geometry vertices are in definition-local native
  STEP axes, imported in millimetres.
- `occurrences` contain distinct source occurrence paths, parents, children,
  referenced definitions and column-major `localMatrixMm` / `worldMatrixMm`.
  Root occurrences are explicit and have no NAUO entity.
- A source assembly can own geometry as well as child occurrences. OCCT may
  synthesize anonymous SOLID component labels for that own geometry. Those
  labels are listed in `generatedGeometryComponents`, then folded into their
  owning source definition mesh. They are never invented as source occurrences.
- A source part containing multiple solids remains one source part. Its
  tessellation can contain several face groups in one shared display mesh.
- STEP may also contain source triangulated faces without an analytic surface.
  Those real definitions and occurrences remain intact. The importer preserves
  their source vertex/index SHA-256 across both display settings, marks each
  face and definition `source-triangulated`, and supplies actual triangle bounds
  with `brepBoundsMm: null` where analytic bounds are unavailable. A mixed
  definition declares partial analytic coverage. A non-analytic face with no
  retained triangles still fails; unsupported geometry is never silently dropped.
- Each face range records an imported OCCT face index and triangle range.
  These indices are not persistent native CAD feature IDs.
- If whole-shape meshing omits a face, the importer measures its B-rep surface
  area and retries that face independently. `meshWarnings` preserves nominal
  and actual tolerances, every retry and its result. A recovered coarser face
  must not be described as meeting the nominal fine setting. `unmeshedFaces`
  counts remaining zero-triangle faces; recovered faces are counted separately.
- Original source unit names and the explicit millimetre import unit are
  retained. Display exporters must apply a proper basis change to matrices;
  the source coordinate axes themselves are not rewritten here.

The generic wrapper accepts one uniform, explicitly assigned spatial length
unit: SI metres or SI millimetres. It compares the retained STEP contexts with
`provenance.sourceLengthUnit` when supplied and with XCAF `sourceLengthNames`.
Unassigned spatial contexts, mixed metre/mm spatial contexts, inches and other
unimplemented units are rejected before publication. A separately declared 2D
surface parameter context may omit units; that exception does not apply to 3D
spatial coordinates. Derived units outside spatial contexts do not change the
native geometry unit.

OCCT imports **both** source units into millimetres (`xstep.cascade.unit=MM`).
Vertices, `localMatrixMm`, `worldMatrixMm` and `boundsMm` therefore stay in mm.
The display applies `0.001*[x,z,-y]` exactly once to those imported coordinates;
it must not multiply an already normalized metre-source model by another 1000.
For native-metre packages the generated manifest keeps the historical
`source.units.length: "mm"` declaration for `localMatrixSource`,
`worldMatrixSource` and `boundsSourceMm`, and adds:

```js
source: {
  originalLengthUnit: 'm',
  coordinateNormalization: {
    originalLengthUnit: 'm', importedLengthUnit: 'mm',
    originalToImportedScale: 1000,
    matrixCoordinateUnit: 'mm', geometryCoordinateUnit: 'mm',
    // method describes the existing OCCT MM import setting
  },
  // sourceUnits retains the backend's original sourceLengthNames: ['metre']
}
```

The native-metre scene contract declares `units: {source: 'm', imported: 'mm',
asset: 'm', angle: 'rad'}` and the GLB retains corresponding `sourceUnits` and
`importedUnits`. Neither the original STEP byte content nor its FileUnits names
or provenance are rewritten. Existing mm package output is byte-compatible.

The read-only evidence audit checks the retained AP214/AP242
`PRODUCT_DEFINITION` and `NEXT_ASSEMBLY_USAGE_OCCURRENCE` subset. This narrow
identity check does not establish full AP242 protocol conformance or recover
native mates, PMI, tolerances or placement entities independently of OCCT.

The WOLF V1.2 native-metre AP242 specimen includes analytic gear/housing bodies
and 69 source-triangulated bearing definitions reused by 138 occurrences. Its
display can retain every source identity while its audit is explicitly
`limited` for analytic geometry coverage. `sourceGeometryRepresentations`, face
digests, nullable analytic bounds and source-triangulation counts travel with
the generated manifest, GLB metadata and import report. Source triangles do not
become analytic CAD merely because they are packaged inside STEP.

The backend rejects paths outside this project and currently accepts only
self-contained STEP files. It fails when source occurrences lack an exact
mapping, instead of guessing identity from names or geometric proximity. This
is a STEP viewing/import foundation; it does not recover CAD mates, solve
constraints, perform physical simulation, or provide an exact section or
interference API.

## Technical references and licenses

- [OCCT XCAF shape tool](https://dev.opencascade.org/doc/refman/html/class_x_c_a_f_doc___shape_tool.html)
- [OCCT STEPCAF reader](https://dev.opencascade.org/doc/refman/html/class_s_t_e_p_c_a_f_control___reader.html)
- [OCP bindings](https://github.com/CadQuery/OCP) — Apache-2.0 binding project;
  OCCT's own license and additional terms remain applicable to its runtime.
- [CadQuery installation](https://cadquery.readthedocs.io/en/stable/installation.html)

Runtime libraries are installed locally rather than vendored in the published
repository. CAD source licenses are recorded separately with each example.
