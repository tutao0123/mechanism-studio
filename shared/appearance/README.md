# Timeline colour accents

`sampleColorAccents(partIds, cues, options)` in `color-accents.mjs` returns a fresh
`Map<stablePartId, { weight, color }>` for every part, including neutral parts.
Each cue is `{ id, weight }`; use the existing timeline's revealed-name opacity
for a part cue. The default solid is `#f1f1ed`, and its sole accent is pale blue
`#b7d5df`. Weights clamp to 0–1, repeated cues combine by maximum, and unknown IDs
are ignored. The output is independent of query order. Setting `enabled: false`
restores the complete neutral assignment immediately.

The optional `createMeshColorLayer(meshes, { canApply })` adapter clones each
solid's materials once, applies absolute sampled colours, and restores/disposes
its owned materials on disposal. It reads `mesh.userData.selectionId`. It leaves
line materials, geometry, visibility, hierarchy and source transforms untouched.
Replaced materials and meshes marked `userData.selected` are skipped, so an
inspection layer can own selection appearance. Custom selection systems should
provide `canApply` or compose selection after this layer. An animation should not
modify a material shared by repeated occurrences directly.

Colour is an explanatory overlay, not a physical material or simulation result.
Use one restrained accent with names or a legend; do not encode information only
in hue. Recompute from the same scene/annotation time on play, pause, seek and
restart. Expired cues return to baseline without accumulating tint. If a scene
fade also removes text, its part accent should use that same fade. Keep a
keyboard-accessible `Color cues` switch for neutral line-art viewing.

Tests: `node --test shared/appearance/tests/*.test.mjs`.
