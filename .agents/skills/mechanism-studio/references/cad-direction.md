# CAD capability and engineering boundaries

Use [the CAD workflow](cad-workflow.md) for source layout, supported input, commands, artifact handling and UI checks. This reference explains what the resulting data means.

| Goal | Current basis | Accurate scope |
| --- | --- | --- |
| Teaching mechanism/space | Authored model, Blender/GLB, viewer and lessons | Declared dimensions, computed geometric relationships, display cutaway/explosion |
| Real STEP inspection | Retained STEP, actual importer, identity/unit/tree/mapping reports | Fields read, real source counts versus display fragments, explicit missing fields |
| Exact measurement/section/interference | Requires actual validated B-rep query interface and calibration specimens | Not implemented as a general engineering API; mesh distances/clipping remain approximate/display |
| Native feature editing/mate-driven design/writeback | Requires corresponding format/features/solver | Retaining STEP and exporting GLB does not preserve a native feature tree or solve constraints |

Check format, rights, units, intended operation and precision. Skill instructions do not themselves authorize global tools, external publication or expanded access.

## Keep engineering source distinct

Retain original CAD/STEP with source version/digest/license/importer version; GLB/STL/.blend do not replace it. Preserve actual readable fields and leave absent fields missing:

- Definition versus occurrence, assembly hierarchy and true local placement.
- Original units/coordinates and imported/display conversions.
- Readable mates/joints/DOFs and their solver reference, when actually available.
- Readable part numbers/BOM/material/mass metadata. Derived calculations state units, algorithm and approximation.
- Engineering-to-display part/mesh/face/edge mapping scope; labels are not stable identity.

Baked vertex placement is not proof that engineering local placement was exposed. A display-centroid rest is not source placement. Plausible materials/joints remain unknown without evidence.

Current XCAF normalizes native m/mm to imported mm, retains original unit metadata and converts display once to m/+Y. Manifest *MatrixSource uses the declared imported coordinates. Do not rewrite source unit labels or scale normalized metre-source coordinates again. Mixed spatial units/inches are not enabled.

## Existing specimen boundaries

[KFL08](../../../../examples/step-assembly/README.md) is an early limited-mapping route: retained AP214 has 30 products/29 usages, including 7 subassembly and 22 leaf occurrences, while the legacy display has 7 groups/35 fragments. Nineteen named fragments have named source associations; 16 have grouping-only mapping. Those counts are distinct evidence, not an invented full one-to-one recovery.

[WOLF](../../../../examples/wolf-actuator/README.md) uses XCAF source definitions/occurrences with full retained local/world placements and native-metre AP242 input. Some source assemblies own solids and children; generated anonymous OCCT solids are display subdivisions, not invented engineering occurrences. Mesh retries disclose actual face/settings/results rather than hiding coarser recovery behind nominal fine tolerances.

[WOLF](../../../../examples/wolf-actuator/README.md) is native-metre AP242 with both analytic and source-triangulated geometry. Source triangles retain identity, but do not become analytic CAD because of the STEP extension. Use actual specimen reports, not these examples' constants, for new inputs.

Source NAUO/component references establish current XCAF identity. Different tessellation densities should preserve identity, parents and placement for the same source. Source re-export can renumber entities; no permanent cross-revision identity is promised. Tessellation tolerance is not independently proven per-face error, closed-solid validity or engineering measurement.

## Extending engineering capability

1. Validate source fidelity with retained bytes, units, hierarchy, actual mapping and import differences. A structurally different second specimen gives additional evidence, not universal format support.
2. Record derivative tessellation settings, coordinate conversion, tool versions and hashes. Distinguish solid features/surface relations from triangle edges.
3. Before exact measurement/section/interference claims, implement real B-rep queries and calibrate known-answer specimens. Web clipping, precut shells and mesh distances remain separately labeled.
4. Before mate/DOF claims, obtain explicit relations and validate the actual solver. A separate authored teaching model is acceptable when disclosed; it is not source-mate recovery.
5. Treat explosion as display separation, not collision-free manufacturing removal or assembly sequence.

Technical import never creates source redistribution rights. Project-authored code/docs are MIT; retain source licenses and third-party/derivative notices separately.
