# Assembly depth and component studies

Read this when the user asks for finer component breakdown, actuator internals, screws, bearings, or a tour that moves from a whole machine into its subassemblies. Coordinate the result through [Assembly & Explode](modules/assembly-explode.md); this is an authoring contract, not a new geometry reconstruction service or solver.

## Choose a depth the source supports

Plan the explanation as **whole mechanism → sourced subassembly → available physical components**. Each step should answer a new mechanical question rather than repeat the same explosion at a closer camera distance.

| Level | Useful question | Evidence needed |
| --- | --- | --- |
| Whole mechanism | Where does this component sit and what connects to it? | Retained assembly/body hierarchy and visible geometry |
| Sourced subassembly | Which housings, shafts, gears or other members belong together? | Actual source occurrences or independently documented component geometry, with identities and rest transforms |
| Available physical components | How do the supplied bearings, rings, fasteners or rotor parts relate? | Separate retained component geometry and evidence for the names/relationships being explained |

A tree leaf is the lowest node **supplied by that source**, not proof that it is a single manufactured part. One MJCF/URDF body, one STL, one STEP solid, or one render mesh may represent an entire closed assembly. Triangle count, mesh groups and joint axes do not reveal its internal construction. A provided joint allows only the supported kinematic claim; it does not establish a particular actuator, transmission, bearing layout, torque or contact model.

Record the requested depth, available source depth and delivered depth in the brief or explosion plan. Include the target source ID/path, actual child IDs, geometry/source revision, source names, supporting drawing/BOM references, known relationships and missing geometry. Preserve generic names and unknowns. A documented BOM item without a geometry occurrence is **documented but not modeled**, not a selectable or animated part.

For text/image work, an authored teaching model can supply explicitly assumed internals if that is the requested goal; label its basis and dimensions. For a source-specific study, obtain a compatible, licensed source with the requested internals before binding those parts. Keep an unknown component closed or show only its supported exterior until then. Do not fill a simplified humanoid joint with guessed gears, bearing races or screws and present them as that robot's construction.

## Current examples and their limits

- The Unitree G1 example retains thirty MJCF bodies. Its source-body explosion explains the body chains; it is not an internal actuator teardown. To deepen it, first locate component-level source data that actually belongs to the chosen G1 component, or present a separate, clearly identified actuator study.
- The original five-speed gearbox is an authored teaching model: 124 parts in 15 nested assemblies, three levels deep (gearbox → mainshaft → synchronizer → hub, sleeve, rings, keys). Its internals are an explicitly assumed teaching design with declared dimensions, not source evidence about any production gearbox.
- No STEP assembly is currently included. For a sourced component study, supply a licensed STEP package with nested subassemblies and audit its actual source bindings before promising screw-level disassembly. A BOM listing of fasteners alone does not establish a matching modeled occurrence. Source-triangulated definitions and generic names such as `Part N` do not become exact analytic solids or identified hardware through rendering.

When a source contains separately placed copies of one subassembly, such as two bearings, choose one actual assembly path and carry all nested identities; repeated names across copies do not identify the same occurrence. A count of source leaf occurrences describes the supplied hierarchy, not a certified bill of manufactured parts.

Do not rename generic leaves as balls, rollers, cages, seals or inner races merely because a close-up resembles one. A fine breakdown may show their real shapes and source names, and may focus on one existing occurrence, while its precise function remains unknown. Keep the authored observation offsets distinct from a physically feasible bearing disassembly. Do not add missing fasteners or replace source geometry with a cleaner idealized bearing unless a separately identified teaching model is explicitly requested.

Reuse the existing [source-aware CAD workflow](cad-workflow.md) and asset/license notices. A second model or internal assembly needs its own source revision, permitted redistribution and clear relationship to the first; the project MIT license does not replace its terms.

## Layered choreography and handoff

Use an overview to locate the target, expose or isolate the relevant sourced subassembly, perform a **local explosion of its actual children**, hold the result for reading, restore the local assembly, then restore the whole machine. A focused 20–40-second component showcase may work better than crowding every level into one short clip. A longer Explain route or interactive inspection is appropriate when the requested relationships need it; follow the user's duration and depth rather than imposing a clip length.

Hand off these meanings using the example's existing adapter and records, not a second independently maintained engineering tree:

- **Scope:** target assembly/source path, retained child occurrence IDs, fixed/context IDs, requested/available/delivered depth and unresolved evidence.
- **Visible sets:** actual IDs shown at each stage; distinguish moving targets, stationary context and optional ghosted context. Visibility and material emphasis do not create parts or alter source parents.
- **Offsets:** macro and local display layers, units, coordinate spaces, parent bindings, zero references and inheritance compensation. Local restoration returns children relative to the current macro context; final whole restoration returns all display offsets to zero.
- **Time and views:** one shared, seekable timeline for overview, focus, local separation, reading, local restoration and return; actual visible geometry envelopes for each stage and transition. Pass the same IDs/envelopes to camera, labels, appearance and sound.
- **One-component detail, when useful:** choose a real child occurrence, establish its original location, extract it in display space and magnify with the camera. Follow [motion choreography](motion-choreography.md) for readable focus and return without a duplicated or enlarged mesh. Generic source identity stays visible in the explanation where the function is unknown.
- **Evidence:** source and geometry revisions, actual depth achieved, named/unknown parts, binding/restoration checks and remaining engineering limits.

For nested movement, form the intended displayed world offset for each target, subtract the movement inherited from its parent, then convert that residual into the display wrapper's parent space. Do not add a full local offset on top of an already translated parent. Keep source rest and any mechanical pose separate. Inspect hide/isolation, backward seek and local-to-whole return as well as the attractive fully exploded frame.

## Useful requests and acceptance checks

“Use the supplied STEP source occurrences to explain one bearing subassembly. Show it in the whole assembly first, then separate only the children that actually exist, retain source names where identification is unknown, and restore both levels.”

“Make a G1 shoulder component study at the finest depth supported by the supplied source. Inventory what geometry is available; keep unsupported internals unknown. If component CAD is supplied, bind it with its own provenance before animating it.”

Check that the viewer can select each advertised component, repeated occurrences retain separate identities, local context matches the source hierarchy, and each named component has actual geometry or is explicitly described as unmodeled. Verify assembled/intermediate/maximum/local-restored/whole-restored transforms and envelopes, labels on real targets, pause/seek/loop, and desktop/narrow frames. A successful rendering does not establish removal clearance, contact, gear engagement or a manufacturing-valid sequence.
