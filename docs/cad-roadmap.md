# CAD roadmap

Updated 2026-10-18. Mechanism Studio is a working authoring/presentation prototype
with source-aware assembly inspection. The next engineering milestones need
known-answer fixtures and source-bound evidence, beyond attractive display motion.

| Area | Current evidence | Next acceptance criterion |
| --- | --- | --- |
| Teaching and shared runtime | Lock, inline-four, turbofan and quadruped; seven shared runtime libraries | Keep mechanism-specific invariants when adding an example |
| Source assembly identity | WOLF XCAF definitions/usages/local-world placements, audited against the source; the tree ↔ mesh inspector page left with the GPL Galileo example | A permissively licensed inspector example; broader source fixtures without weakening identity checks |
| Import coverage | KFL08 historical trial and WOLF source packages; verified metre/mm contexts within the documented subset | Explicit format/unit/topology failure fixtures and repeatable results |
| Source-backed kinematics | SO-ARM URDF axis/limits and opposed-jaw mimic in the kinetic adapter | A reusable joint schema with independent known-answer FK and limit tests |
| Exact B-rep measurement | Not implemented in the viewer | Source face/edge references, distance/angle/volume algorithms, units and error bounds |
| Assembly constraints | STEP placements retained; mate recovery/solving not implemented | Explicit fixed/revolute/prismatic references, degrees of freedom, limits and failed states |
| Disassembly planning | Authored visual offsets and reverse restoration | Connection dependencies, removal order, collision checks and demonstrated clearance |
| Public reuse | MIT implementation, explicit asset-license exceptions, clean-checkout tests, module guide and example catalog | Maintain reproducible examples and review source/media rights for new contributions |

## What the source specimens establish

[KFL08](../examples/step-assembly/README.md) retains 22 source leaf instances and
7 subassembly instances, while the first importer emits 35 display fragments.
Some name-based associations exist; anonymous fragments have no exact leaf map.
It remains a historical limited importer trial, not the generic identity path.

The GPL-3.0 Galileo 2 example, which demonstrated XCAF identity with a linked
source-tree inspector, was removed on 2026-10-20 to keep included models under
permissive licenses; it remains in Git history. WOLF now carries the real-source
XCAF audit. Byte-identical source identity is not a promise of cross-version
feature identity after a new STEP export.

[WOLF](../examples/wolf-actuator/README.md) retains 184 definitions, 252 usages and
245 leaf occurrences from a native-metre source. Its 69 source-triangulated
bearing definitions appear in 138 occurrences. Those meshes do not become exact
analytic solids by being stored inside STEP. The demonstration's axial separation
and gear views are observation choreography, not a recovered gear/mate solver.

[SO-ARM 102](../EXAMPLE_ROBOT/kinetic/README.md) provides a different source path:
actual URDF joints and eight merged visual links. Its kinetic edit respects source
axes, limits and mimic; it does not certify hardware control or collision safety.

## Sequence of the next engineering work

1. Add a small dimensioned B-rep fixture with independently known distances,
   angles and volumes. Save native source references, unit conversion and numeric
   tolerances with each result.
2. Define fixed, revolute and prismatic relationships from explicit source or
   manually reviewed references. Validate DOF, FK, limits and failure reasons
   independently of the render adapter.
3. Describe actual connections and removal dependencies. Compare visual explosion
   paths with geometric collision/clearance evidence before calling them service
   instructions.
4. Generalize only after multiple source specimens establish the reusable
   boundary. Preserve explicit unsupported/limited results rather than guessing
   missing mechanical facts from names or appearance.

Blender supplies presentation geometry; MCP is a communication interface. Neither
alone establishes CAD kernel accuracy, constraint solving, physical contact,
thermal behaviour or robot balance. Each requires its own evidence and scope.
