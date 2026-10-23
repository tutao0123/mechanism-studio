# Original procedural assemblies

Use this for a mechanical demonstration requested through text or an image. Author the mechanism locally; an external model search or download is not a prerequisite. Keep the user's requested subject, depth, style and output. Reuse existing geometry when the request only changes presentation.

If the user supplies CAD or requests a particular real assembly, use the [input brief](input-brief.md) and [CAD workflow](cad-workflow.md) instead. A reference photo can guide an original design, but cannot establish hidden dimensions or internals of the pictured device.

## From brief to parts

Choose a coherent, reviewable teaching design. Record the mechanism, units/axes, key dimensions, repeated components, intended degrees of freedom and explicit connection assumptions in a specification. Distinguish supplied facts from authored choices. Include actual component geometry at the requested depth: for example, a detailed bearing needs its rings, balls and cage, with matching seats and clearances; adding labels to one solid does not create those parts.

Use stable definition IDs for reusable geometry and stable occurrence IDs for each placed part. The same screw definition may appear many times; its occurrences remain independently selectable and return to their own assembled transforms. Derive the part list and quantities from those occurrences, not from triangle/mesh counts or a separately typed inventory. Preserve IDs across revisions when the part's identity remains unchanged.

Record intended mates such as shaft-to-inner-ring fixation, housing-to-outer-ring fixation, gear axes and ideal tooth ratios. These are authored relationships with stated assumptions, not recovered CAD mates or a general constraint solver. Keep the geometry specification, mechanical adapter and presentation offsets separate under the [scene contract](scene-contract.md).

## Existing executable recipes

From the project root after `npm ci`:

```sh
npm run studio -- generate robot-joint
npm run studio -- preview robot-joint
npm run studio -- export robot-joint
```

`planetary-gears` and `gearbox` are the other named generation recipes. The commands rebuild the existing authored designs; they do not accept arbitrary natural-language prompts or silently select an external asset. Preview and export remain separate actions. The [Studio entry](../../../../tools/studio/README.md) describes the actual build checks and export dependencies.

| Recipe | Reusable implementation | Authored model |
| --- | --- | --- |
| `robot-joint` | [spec](../../../../examples/robot-joint/spec.mjs), [geometry](../../../../examples/robot-joint/geometry.mjs), [builder](../../../../examples/robot-joint/build-joint.mjs) | 129 occurrences, 44 definitions, root plus five subassemblies; motor, reducer, detailed bearings, output flange and fasteners |
| `planetary-gears` | [spec](../../../../examples/planetary-gears/spec.mjs), [geometry](../../../../examples/planetary-gears/geometry.mjs), [builder](../../../../examples/planetary-gears/build-planetary.mjs) | 80 independently identified occurrences; shared gear, bearing and fastener definitions |
| `gearbox` | [spec](../../../../examples/gearbox/spec.mjs), [geometry](../../../../examples/gearbox/geometry.mjs), [builder](../../../../examples/gearbox/build-gearbox.mjs) | 124 occurrences with nested shaft/synchronizer assemblies and repeated definitions |

These recipes produce their model GLB, `scene-contract.json`, `scene-index.json`, `provenance.json` and `build-report.json` in their example's `assets/` folder. The scene index carries the authored parts and assemblies; it is not an imported STEP tree. Geometry and design choices remain reproducible in local source code, without external meshes or a Blender connection.

## New mechanisms

For a new description, author the corresponding specification and builder in a new project-local example, using the existing recipes and [shared asset tools](../../../../shared/assets/README.md) where appropriate. A generation recipe is a runnable implementation, not a prompt string registered under a new name.

Provide actual geometry, a matching scene contract/index and provenance, then implement the mechanism adapter needed for the requested motion. Keep a static model when motion is not requested or not yet established. Bind the existing four [authoring contracts](module-orchestration.md) only after geometry and identities exist: explosion uses real occurrences, camera uses their actual bounds, appearance uses their material groups, and mating close-ups use explicit mechanical relationships. Geometry authoring precedes those contracts; it does not create another separately installed skill.

Register preview or export only when the associated server and frame adapter work. The renderer needs deterministic sampling from the shared time source. A new GLB alone does not create animation, a film adapter or automatic narration.

## Check before presentation

- Rebuild and verify the asset's identities, actual assembly parents, rest transforms, units, source fingerprints and agreement with the scene contract. Confirm repeated instances share the intended definition and that their listed quantities match the exported geometry.
- Check meaningful geometry against the design: for example, bores are actually open, race and ball dimensions agree, screw axes meet their seats, and gear centre distances/phases match the specified tooth counts. State the extent of sampled clearance checks; they do not establish continuous collision freedom.
- Check the intended mechanism equations and the actual transformed nodes at representative and boundary times. Selection, camera changes and explosion must leave the mechanical state unchanged; reassembly restores display offsets without overwriting motion.
- Review the assembled/exploded model and requested close-ups in the real viewer, then follow [delivery evidence](delivery-evidence.md) for any exported film. A successful builder does not prove visibility, readability or encoded-video quality.

Describe these assets as original parametric teaching models. The current recipes generate display meshes, not validated manufacturing B-reps. If native CAD is part of the request, create and retain that separate native representation and validate its actual capabilities; converting a GLB to a file named `.step` cannot supply engineering accuracy. Keep original authorship, any reused licensed source, and unexecuted checks explicit.
