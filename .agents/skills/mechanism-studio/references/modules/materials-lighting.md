# Materials & Lighting

An internal [authoring contract](../module-orchestration.md), not a separate skill or general material-plan executor. It maps a visual intention onto the actual renderer and stable component identities. Read [visual style](../presentation-style.md) for the common tokens.

For a continuous whole-to-component focus, read [motion choreography](../motion-choreography.md). Appearance owns the planned contrast/opacity treatment while explosion owns movement and camera owns magnification; no visual focus operation changes source identity or geometry.

## Responsibility and preconditions

Own base fills, feature/silhouette edges, surface parameters, lights, optional textures and their source/terms. Preserve dimensions, identity, parents, mechanical state and quantitative readouts. Physical material grade, manufacturing finish and measured roughness are engineering facts only when supported by source data; renderer metalness is a visual parameter.

Inputs: brief and target renderer, scene-index with real IDs/geometryRevision, any sourced material facts, intended process/selection semantics, existing assets and licensing, visibility/cutaway policy, and required whole/detail/explosion views. With no geometry, return a concept palette/role proposal without claiming applied materials. Text/images are appearance references, not material certification.

## Output: appearance-plan

Record stage, geometryRevision, planRevision, actual role-to-part/occurrence bindings, neutral fallback, renderer-specific fill/roughness/metalness/opacity values, edge hierarchy, lights/environment and declared coordinates. Include:

- Selection/hover/process/cutaway/hidden/isolation priorities and restoration behavior.
- If requested, context fade intervals and affected occurrence IDs for both solids and edges, plus depth/selection/label policy. Bind these to the supplied timeline and restore the current user observation state.
- Only needed local texture files, purpose, color space, provenance/license, UV/mapping scale and fallback.
- Target renderer/color management, actual adapter and effects that cannot be reproduced equivalently.
- Actual visual/interaction checks, missing resources and unresolved bindings.

A lighting intention should survive chapter changes: soft upper key, restrained contrast, visible structure. Document any camera-relative lighting exception and inspect all planned views. Equivalent numeric settings in Blender and Three.js do not guarantee identical pixels.

## Appearance choices

1. **Default white line art:** neutral pale solids for occlusion and light volume, fine dark contours, softer detail lines. Use features/silhouettes, not every tessellation triangle.
2. **CAD-inspired style:** specify referenced background, fill, edges and selection behavior. Product names are reference directions, not fixed universal appearances of SolidWorks, Creo or Fusion.
3. **Surface rendering:** prefer explainable metal/plastic parameters. Do not add scratches, grime or decals without a useful purpose.
4. **Textures when needed:** local files with clear terms; verify UV, physical visual scale, direction and repeated occurrences. Distinguish color textures from normal/roughness/metalness data maps and state renderer normal-axis convention.

The optional [Cinematic profile](../presentation-cinematic.md#materials-light-and-typography) coordinates surface rendering with a dark studio environment, restrained highlights, filtered stable grain and large sans-serif film graphics. Apply it only to the requested edition, leaving default Atlas materials/type intact. Verify the actual perspective/PBR adapter and motion stability rather than passing an unsupported style name to the orthographic line renderer.

Base colors must not consume process meanings: airflow/fuel/combustion have their own legend. Structure remains readable in neutral viewing and without hue.

## Interaction and restoration

- Explicit hidden/isolation/cutaway states determine visibility. Material changes must not reveal hidden parts.
- Temporary selection/hover restores the current appearance plan, not stale source defaults. Avoid permanently editing source materials.
- Preserve process semantics when a selected part has process color; use an additional outline or clearly explained treatment.
- Shared definitions/materials do not authorize changing every occurrence. Selecting one screw must not tint all repeats.
- A repeated-part close-up accents the chosen real occurrence only. Context fades must handle edges as well as fills; inspect intermediate transparency rather than assuming a material opacity change makes a clear scene. Explicit hidden/isolation choices take precedence over authored context restoration.
- Transparency changes depth and line readability; inspect it. Disabling depth to expose all hidden lines does not establish understandable structure.
- Geometry/displacement/topology/UV asset changes that affect bindings or silhouette return to the orchestrator for a new geometryRevision and dependent explosion/camera checks. Pure color/light changes do not invent geometry identity.

## Existing runtime

[createMechanismViewer](../../../../../shared/viewer/README.md) accepts configureMesh and lineStyle; viewer.lineArt.setStyle updates lines. There is no general appearance-plan JSON loader.

[Line art](../../../../../shared/viewer/line-art.mjs) currently expects individual static Mesh objects and an orthographic camera. Parent motion/nonuniform scale are supported; this does not imply skinned, InstancedMesh or arbitrary perspective support. lineArtSmooth is an explicit visual treatment, not permission to erase real structural edges.

[shared/appearance](../../../../../shared/appearance/README.md) provides deterministic color accents and an occurrence-safe mesh material layer. sampleColorAccents returns a complete neutral/accent map; disabling cues restores neutral immediately. createMeshColorLayer clones owned solid materials, preserves selected/replaced materials and can use a canApply policy. It does not change geometry, visibility or source transforms.

For the default white line art, start from [line-art-style.mjs](../../../../../shared/appearance/line-art-style.mjs): `LINE_ART_LINE_STYLE`, `createLineArtFill()` and `addLineArtLighting(scene)` carry the shared fill, edge and light tokens, and appearance plans should record its `LINE_ART_STYLE_REVISION`. Override a value only for a stated reason; existing pages are migrated deliberately, not in bulk.

The [gearbox](../../../../../examples/gearbox/README.md) atlas and blueprint editions draw feature edges on one model under two declared styles. Blender and web adapters each implement the intention; record actual parameters and differences. Missing textures/UV/environment resources fall back to a declared neutral style and a specific limitation, without downloading unrelated replacements.

## Acceptance and failure handoff

Check binding coverage and repeated occurrences, source/pose invariance, selection/unselection, hidden/isolation and reassembly restoration. Inspect whole/detail/max-explosion/rest frames in the actual renderer and viewport: no triangle noise, lost fits, overbright reflections, unreadable labels or confusing process colors.

Verify local texture reads, license/provenance and the real fallback. Unknown IDs or geometry revisions return for rebinding; unresolved resources return a neutral limited result. A written plan is not an applied material, and realistic shading does not validate CAD or physics.
