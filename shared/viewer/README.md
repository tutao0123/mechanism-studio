# Shared mechanism viewer

The lock, inline-four and new examples import `viewer.mjs`. It owns GLB loading,
stable part bindings, OrbitControls, orthographic camera presets, mesh picking,
visible-mesh bounds, line art and the display explosion layer. An example owns
its mechanical equations, lesson state, palette and part descriptions.

```js
import { createMechanismViewer } from '../../shared/viewer/viewer.mjs';
const viewer = createMechanismViewer({
  viewport: document.getElementById('viewport'),
  assetUrl: './assets/assembly.glb',
  contractUrl: './assets/scene-contract.json',
  cameraPresets: {
    overview: { position: [.8, .6, .8], target: [0, 0, 0], scale: .4 },
  },
  lineStyle: { enabled: true, color: '#161616', detailColor: '#81817e' },
  onPick(id) { /* update the example's selected part */ },
});
await viewer.ready;
viewer.setCamera('overview', { fit: true });
viewer.setExplode(.5, { fit: true });
viewer.resetObservation();
```

GLB semantic nodes have `extras.part_id`. When a contract is supplied, its
`parts[].part_id` must match the GLB identities exactly. Each binding in
`viewer.parts` has `{ id, node, model, display, record, sourceParent }`. Source
node transforms and assembly parents are preserved through identity wrappers:
`source assembly → display → model → source node`. Nested semantic nodes own
their own meshes. `viewer.meshes` contains each solid once.

`applyPoses(poses)` updates working `model` wrappers. The optional
`{ target: 'node' }` retains compatibility with assets whose original local
transform is the motion baseline. It accepts position, quaternion, scale,
Euler rotation and individual rotationX/Y/Z. Missing IDs fail. Neither it nor
`resetObservation()` changes source geometry.

`setExplode(progress)` only updates display positions. By default a contract's
`explode` is a three-component GLTF metre vector. An example with another
coordinate convention supplies `explodeVector(record, binding)`; an explicit
`{ vectorForPart(binding) }` overrides it per call. `setCutaway(enabled)` hides
parts whose record has `cutawayHidden`, or accepts a custom predicate.
`resetObservation()` restores display position, orientation, scale and visibility
without resetting the mechanical pose or camera.

Use `setCamera(idOrPreset, { offset, zoom, fit })`, `fitVisibleAssembly()` and
`pick(clientX, clientY)` for observation. Bounds come from visible solid meshes;
feature-line buffers and hidden ancestors do not influence the fit. Source B-rep
or STEP geometry is not modified or measured by this display viewer.

`requestDraw()` redraws static viewers on changes, resize and visibility. For
an animated example use `autoRender: false`, call `draw()` from the example's
model loop, and set its dirty flag in `onControlsChange` and `onResize`.
`afterDraw(viewer)` can place HTML labels. `dispose()` removes observers,
controls and owned line/renderer resources; example assets remain source-owned.

The historical `prototype-3d/line-art.mjs` is a compatibility re-export. The
implementation exists once, in this directory.

## Spec labels and drafting marks

`spec-label.mjs` defines the optional spec-label grammar for near-part names:
`specLabel({ index, name, spec })` returns a frozen label with a two-digit
index, the name, and at most one spec line. `writeLabel`, `measureLabel` and
`placeLabelText` fill, measure and position an SVG `<text>` as two centred
lines. A plain string keeps the original single text node and measurement, so
existing labels are unaffected. The example computes spec numbers from its own
data; this module only lays them out.

`drafting.mjs` draws marks on the model itself. `centreLinePositions(from, to)`
returns a long–short centre line along a real axis. `dimensionPositions(a, b,
side, offset)` returns extension lines, the dimension line and 45° ticks
between two real points, with an anchor for the number. Both return
`Float32Array` segment pairs in world metres. `formatMillimetres(m)` writes whole
millimetres, with one decimal below 10 mm. `createDraftingOverlay(viewport)` is
an SVG layer for dimension numbers and one framed stamp at projected screen
points. The builders are pure. The example decides when a mark is true: a
dimension of the assembled state must be hidden once its parts move.

Tests: `node --test shared/viewer/tests/drafting.test.mjs`.
