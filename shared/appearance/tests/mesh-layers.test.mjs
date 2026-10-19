import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, BufferGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial } from 'three';
import { createMeshColorLayer, createMeshVisibilityLayer } from '../mesh-color-layer.mjs';
import { isWorldVisible } from '../../viewer/scene.mjs';

// Mirrors the viewer binding: source assembly → display → model → mesh, with
// a depth-tested feature-line child that does not write depth.
function occurrence(id, materials) {
  const mesh = new Mesh(new BoxGeometry(), materials); mesh.userData.selectionId = id;
  const line = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ depthWrite: false }));
  line.userData.isLineArt = true; mesh.add(line);
  const display = new Group(), model = new Group(); display.add(model); model.add(mesh);
  return { mesh, line, display };
}
const opacities = mesh => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(material => material.opacity);

test('multi-material solids fade and restore every owned slot without touching source materials', () => {
  const sources = [new MeshStandardMaterial({ opacity: 1 }), new MeshStandardMaterial({ opacity: .8, transparent: true })];
  const { mesh, line } = occurrence('housing', sources);
  const colors = createMeshColorLayer([mesh]), fades = createMeshVisibilityLayer([mesh]);
  assert.notEqual(mesh.material[0], sources[0]); assert.notEqual(mesh.material[1], sources[1]);
  fades.apply(() => .5);
  assert.deepEqual(opacities(mesh), [.5, .4]); assert.equal(line.material.opacity, .5);
  assert.ok(mesh.material.every(material => material.transparent && material.depthWrite));
  colors.apply(new Map([['housing', { color: '#b7d5df' }]]));
  assert.ok(mesh.material.every(material => material.color.getHexString() === 'b7d5df'));
  assert.deepEqual(sources.map(material => [material.opacity, material.color.getHexString()]), [[1, 'ffffff'], [.8, 'ffffff']]);
  fades.restore();
  assert.deepEqual(opacities(mesh), [1, .8]); assert.deepEqual(mesh.material.map(material => material.transparent), [false, true]);
  colors.dispose(); assert.deepEqual(mesh.material, sources);
});

test('opacity is absolute per frame: repeated, reordered and restarted samples never accumulate', () => {
  const { mesh } = occurrence('rotor', new MeshStandardMaterial());
  const colors = createMeshColorLayer([mesh]), fades = createMeshVisibilityLayer([mesh]);
  for (let frame = 0; frame < 5; frame++) fades.apply(() => .5);
  assert.equal(mesh.material.opacity, .5);
  // Seek backwards, then forwards again: the same time gives the same frame.
  fades.apply(() => .2); fades.apply(() => .5);
  assert.equal(mesh.material.opacity, .5);
  // Colour and fade commute because each owns a different property.
  colors.apply(new Map([['rotor', { color: '#123456' }]])); fades.apply(() => .3);
  const first = [mesh.material.color.getHexString(), mesh.material.opacity];
  fades.apply(() => .3); colors.apply(new Map([['rotor', { color: '#123456' }]]));
  assert.deepEqual([mesh.material.color.getHexString(), mesh.material.opacity], first);
  fades.restore(); fades.restore();
  assert.equal(mesh.material.opacity, 1); assert.equal(mesh.material.transparent, false);
  fades.apply(() => .25); assert.equal(mesh.material.opacity, .25);
  colors.dispose();
});

test('a context fade cannot reveal a part hidden by cutaway or isolation on its display wrapper', () => {
  const kept = occurrence('kept', new MeshStandardMaterial()), cut = occurrence('cut', new MeshStandardMaterial());
  const colors = createMeshColorLayer([kept.mesh, cut.mesh]), fades = createMeshVisibilityLayer([kept.mesh, cut.mesh]);
  cut.display.visible = false; // viewer.setCutaway hides the display wrapper, not the mesh.
  fades.apply(() => 1);
  assert.equal(cut.mesh.visible, true);
  assert.equal(isWorldVisible(cut.mesh), false);
  assert.equal(isWorldVisible(kept.mesh), true);
  fades.apply(id => id === 'kept' ? 0 : 1);
  assert.equal(isWorldVisible(kept.mesh), false, 'a zero-opacity part leaves picking and bounds');
  fades.restore();
  assert.equal(isWorldVisible(kept.mesh), true); assert.equal(isWorldVisible(cut.mesh), false);
  colors.dispose();
});

test('documented limitation: create the visibility layer after the colour layer', () => {
  // The visibility layer captures each mesh's material when it is created. The
  // colour layer then swaps in owned clones, so a visibility layer created first
  // fades materials that are no longer drawn. shared/study creates colour first.
  const { mesh } = occurrence('nut', new MeshStandardMaterial());
  const early = createMeshVisibilityLayer([mesh]), colors = createMeshColorLayer([mesh]);
  early.apply(() => .4);
  assert.equal(mesh.material.opacity, 1, 'the drawn clone is not faded');
  const late = createMeshVisibilityLayer([mesh]); late.apply(() => .4);
  assert.equal(mesh.material.opacity, .4);
  late.restore(); early.restore(); colors.dispose();
});
