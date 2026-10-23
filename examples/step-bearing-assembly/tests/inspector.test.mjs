import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createAssemblyInspection } from '../../../shared/cad/assembly.mjs';
import { bindAssembly, applyDisplayExplosion, isWorldVisible } from '../../../shared/viewer/scene.mjs';
import { sameDefinitionOccurrences, describeOccurrence, matchingTreeIds, createInspectionBinding } from '../../../shared/cad/inspector.mjs';
import { createStepBearingServer, publicFile } from '../serve.mjs';

const manifest = JSON.parse(await readFile(new URL('../assets/assembly-manifest.json', import.meta.url)));
const contract = JSON.parse(await readFile(new URL('../assets/scene-contract.json', import.meta.url)));
const bytes = await readFile(new URL('../assets/assembly.glb', import.meta.url));
const screwId = 'occ-0332d1eb757d-root-30863-481';
const bearingId = 'occ-0332d1eb757d-root-30863-493';
async function setup() {
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const scene = new THREE.Scene(); scene.add(gltf.scene);
  const viewer = bindAssembly(gltf.scene, { contract });
  viewer.setExplode = progress => applyDisplayExplosion(viewer.parts, progress);
  viewer.requestDraw = () => {};
  const inspection = createAssemblyInspection(manifest), binding = createInspectionBinding(inspection, viewer);
  return { scene, viewer, inspection, binding };
}

test('real STEP repeated screws share definitions but retain their source usage and path', () => {
  const inspection = createAssemblyInspection(manifest), index = inspection.index;
  const details = describeOccurrence(index, screwId), peers = sameDefinitionOccurrences(index, screwId);
  assert.equal(peers.length, 43);
  assert.equal(details.sourceUsage, '#481');
  assert.equal(details.sourceProduct, '#30865');
  assert.deepEqual(details.path, [index.rootId, screwId]);
  assert.equal(describeOccurrence(index, peers[1]).definitionId, details.definitionId);
  assert.notEqual(describeOccurrence(index, peers[1]).sourceUsage, details.sourceUsage);
  assert.equal(describeOccurrence(index, bearingId).name, '608 bearing');
});

test('search finds source instances while retaining the actual root and no invented hierarchy', () => {
  const { index } = createAssemblyInspection(manifest);
  const matches = matchingTreeIds(index, 'M3x10 PH Screw');
  assert.equal(matches.size, 44);
  assert.ok(matches.has(index.rootId));
  assert.deepEqual([...matchingTreeIds(index, '#481')], [screwId, index.rootId]);
  assert.equal(matchingTreeIds(index, 'no-such-bearing').size, 0);
  assert.equal(matchingTreeIds(index).size, 100);
});

test('one actual screw highlights independently while repeated geometry remains shared', async () => {
  const { viewer, inspection, binding } = await setup();
  const peers = sameDefinitionOccurrences(inspection.index, screwId);
  const first = viewer.meshes.find(mesh => mesh.userData.selectionId === peers[0]);
  const second = viewer.meshes.find(mesh => mesh.userData.selectionId === peers[1]);
  assert.equal(first.geometry, second.geometry);
  assert.notEqual(first.material, second.material);
  binding.apply(inspection.select(peers[0]));
  assert.notEqual(first.material.color.getHex(), second.material.color.getHex());
  binding.apply(inspection.select(peers[1]));
  assert.notEqual(first.material.color.getHex(), second.material.color.getHex());
  assert.deepEqual(inspection.snapshot().highlighted_ids, [peers[1]]);
  binding.dispose();
});

test('hide root then reveal one source child, isolate, explode and reset preserve source placements', async () => {
  const { scene, viewer, inspection, binding } = await setup();
  const manifestBefore = JSON.stringify(inspection.index.manifest);
  const originalMatrices = new Map([...viewer.parts].map(([id, part]) => [id, part.node.matrix.toArray()]));
  binding.apply(inspection.setHidden(inspection.index.rootId));
  assert.ok(viewer.meshes.every(mesh => !isWorldVisible(mesh)));
  binding.apply(inspection.setHidden(bearingId, false));
  assert.deepEqual(viewer.meshes.filter(isWorldVisible).map(mesh => mesh.userData.selectionId), [bearingId]);
  binding.apply(inspection.resetObservation());
  inspection.select(screwId);
  binding.apply(inspection.isolate());
  assert.deepEqual(viewer.meshes.filter(isWorldVisible).map(mesh => mesh.userData.selectionId), [screwId]);
  binding.apply(inspection.select(bearingId));
  assert.deepEqual(inspection.snapshot().visible_part_ids, [screwId]);
  binding.apply(inspection.setExplode(.7));
  assert.ok([...viewer.parts.values()].some(part => part.display.position.length() > 0));
  binding.apply(inspection.resetObservation());
  scene.updateMatrixWorld(true);
  assert.equal(viewer.meshes.filter(isWorldVisible).length, 99);
  assert.equal(inspection.snapshot().selected_id, bearingId);
  assert.ok([...viewer.parts.values()].every(part => part.display.position.length() === 0));
  for (const [id, part] of viewer.parts) assert.deepEqual(part.node.matrix.toArray(), originalMatrices.get(id));
  assert.equal(JSON.stringify(inspection.index.manifest), manifestBefore);
  binding.dispose();
});

test('geometry-bearing parent visibility leaves independently owned child geometry reachable', () => {
  const identity = new THREE.Matrix4().toArray();
  const source = { units: 'mm' };
  const definitions = [
    { definition_id: 'housing', name: 'Fixture housing', kind: 'assembly', geometry: {} },
    { definition_id: 'bolt', name: 'Fixture bolt', kind: 'part' },
  ];
  const occurrence = (id, definition_id, parent_id, kind) => ({ occurrence_id: id, label: id, definition_id, parent_id, kind, source: {}, localMatrixSource: identity, worldMatrixSource: identity });
  const inspection = createAssemblyInspection({ root_id: 'body', source, definitions, occurrences: [occurrence('body', 'housing', null, 'assembly'), occurrence('child', 'bolt', 'body', 'part')] });
  const root = new THREE.Group(); root.userData.part_id = 'body';
  new THREE.Scene().add(root);
  const own = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); root.add(own);
  const child = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); child.userData.part_id = 'child'; root.add(child);
  const viewer = bindAssembly(root); viewer.setExplode = () => {}; viewer.requestDraw = () => {};
  const binding = createInspectionBinding(inspection, viewer);
  inspection.setHidden('body'); binding.apply(inspection.setHidden('child', false));
  assert.equal(own.visible, false); assert.equal(isWorldVisible(child), true);
  binding.dispose();
});

test('preview serves only the inspected asset, UI and source notice while denying code tools and raw STEP', async t => {
  const server = createStepBearingServer().listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/', '/app.mjs', '/assets/assembly.glb', '/assets/assembly-manifest.json', '/source/provenance.json', '/source/LICENSE.txt', '/source/NOTICE.md', '/shared/cad/assembly.mjs', '/shared/cad/inspector.mjs', '/shared/cad/inspector.css', '/shared/viewer/viewer.mjs']) {
    const response = await fetch(base + path); assert.equal(response.status, 200, path); await response.arrayBuffer();
  }
  for (const path of ['/source/assembly.step', '/serve.mjs', '/tools/cad/import-xcaf.py', '/.env', '/package.json', '/output/private.json']) assert.equal((await fetch(base + path)).status, 403, path);
  assert.equal(publicFile('/../secret'), null);
});
