import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { BPM, TOTAL_BEATS, DURATION, GROUPS, CHAPTERS, MAXIMUM_OFFSETS, stateAt, normalizeTime, localDisplayOffsets } from '../story.mjs';
import { readGlb, accessorValues } from '../../shared/assets/glb.mjs';
import { bindAssembly, applyDisplayExplosion, isWorldVisible } from '../../shared/viewer/scene.mjs';

const root = new URL('../', import.meta.url);
const sceneIndex = JSON.parse(await readFile(new URL('planning/scene-index.json', root), 'utf8'));
const contract = JSON.parse(await readFile(new URL('assets/scene-contract.json', root), 'utf8'));
const { json: gltf, buffer } = readGlb(await readFile(new URL('assets/robot.glb', root)));
const second = beat => beat * 60 / BPM;
const near = (actual, expected, tolerance = 1e-10) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) <= tolerance, `axis ${axis}: ${value} differs from ${expected[axis]}`));
};

// Reconstruct the actual retained mesh nodes and hierarchy, then exercise the
// same display wrappers as the browser. This deliberately does not substitute a
// flat list of mock positions for the nested URDF source assembly.
function boundRobot() {
  const nodes = gltf.nodes.map(node => {
    let object;
    if (node.mesh !== undefined) {
      const primitive = gltf.meshes[node.mesh].primitives[0];
      const positions = accessorValues(gltf, buffer, primitive.attributes.POSITION).flat();
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeBoundingBox();
      object = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    } else object = new THREE.Group();
    object.name = node.name || '';
    object.userData = structuredClone(node.extras || {});
    if (node.matrix) object.matrix.fromArray(node.matrix);
    object.matrix.decompose(object.position, object.quaternion, object.scale);
    return object;
  });
  for (const [index, node] of gltf.nodes.entries()) for (const child of node.children || []) nodes[index].add(nodes[child]);
  const asset = new THREE.Group();
  for (const index of gltf.scenes[gltf.scene || 0].nodes) asset.add(nodes[index]);
  const assembly = bindAssembly(asset, { contract });
  asset.updateMatrixWorld(true);
  const bodiesOf = binding => assembly.meshes.filter(mesh => mesh.userData.selectionId === binding.id);
  const centerOf = binding => {
    const bounds = new THREE.Box3();
    const ownedBodies = bodiesOf(binding);
    assert.ok(ownedBodies.length > 0, `Actual owned display geometry exists for ${binding.id}`);
    for (const mesh of ownedBodies) bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
    return bounds.getCenter(new THREE.Vector3()).toArray();
  };
  return { asset, assembly, centerOf, bodiesOf };
}

test('robot story and music share one 64-beat loop with complete chapter coverage', async () => {
  const music = JSON.parse(await readFile(new URL('audio/music-score.json', root), 'utf8'));
  assert.equal(BPM, 112); assert.equal(TOTAL_BEATS, 64);
  assert.equal(DURATION, 240 / 7); assert.equal(music.durationSeconds, DURATION);
  assert.equal(music.frames / music.sampleRate, DURATION);
  assert.equal(CHAPTERS[0].firstBeat, 0); assert.equal(CHAPTERS.at(-1).lastBeat, TOTAL_BEATS);
  for (let index = 0; index < CHAPTERS.length; index++) {
    const chapter = CHAPTERS[index];
    assert.ok(chapter.lastBeat > chapter.firstBeat);
    if (index) assert.equal(chapter.firstBeat, CHAPTERS[index - 1].lastBeat);
    assert.equal(stateAt(second((chapter.firstBeat + chapter.lastBeat) / 2)).chapter.id, chapter.id);
  }
});

test('four distinct groups expand on beats and reassemble in reverse order', () => {
  assert.equal(GROUPS.length, 4);
  assert.deepEqual(GROUPS.map(group => group.id), ['shoulder', 'forearm', 'wrist', 'jaws']);
  assert.deepEqual(GROUPS.map(group => group.outBeat), [8, 12, 16, 20]);
  assert.deepEqual([...GROUPS].sort((a, b) => a.inBeat - b.inBeat).map(group => group.id), ['jaws', 'wrist', 'forearm', 'shoulder']);
  assert.equal(new Set(GROUPS.flatMap(group => group.ids)).size, 7);
  for (const group of GROUPS) {
    assert.equal(stateAt(second(group.outBeat - 1e-6)).progress[group.id], 0);
    assert.ok(Math.abs(stateAt(second(group.outBeat + 1)).progress[group.id] - .5) < 1e-12);
    assert.equal(stateAt(second(group.outBeat + 2.001)).progress[group.id], 1);
    assert.equal(stateAt(second(group.inBeat - 1e-6)).progress[group.id], 1);
    assert.ok(Math.abs(stateAt(second(group.inBeat + 1)).progress[group.id] - .5) < 1e-12);
    assert.equal(stateAt(second(group.inBeat + 2.001)).progress[group.id], 0);
  }
  assert.ok(Object.values(stateAt(second(28)).progress).every(value => value === 1));
  assert.ok(Object.values(stateAt(second(58)).progress).every(value => value === 0));
});

test('timeline supports deterministic backward seeks and exact loop rest without accumulated state', () => {
  const opening = stateAt(0);
  assert.deepEqual(stateAt(DURATION), opening);
  assert.deepEqual(stateAt(DURATION * 9), opening);
  for (const time of [0, .2, second(9), second(27), second(41), second(55), DURATION - .001]) {
    const expected = stateAt(time);
    stateAt(time + 17); stateAt(time - 29);
    assert.deepEqual(stateAt(time), expected);
    const periodic = stateAt(time + DURATION);
    for (const id of Object.keys(MAXIMUM_OFFSETS)) near(periodic.offsetsWorld[id], expected.offsetsWorld[id]);
    assert.ok(Object.values(expected.offsetsWorld).flat().every(Number.isFinite));
  }
  near([normalizeTime(-.25)], [DURATION - .25]);
  for (const input of [NaN, Infinity, -Infinity, undefined, '1', null]) assert.throws(() => stateAt(input), /finite/);
});

test('real nested source meshes receive exactly their desired world displacement, without inherited double movement', () => {
  const { asset, assembly, centerOf } = boundRobot();
  const originalSource = new Map([...assembly.parts].map(([id, binding]) => [id, { matrix: binding.node.matrix.toArray(), parent: binding.sourceParent, center: centerOf(binding) }]));
  for (const part of sceneIndex.parts) near(originalSource.get(part.id).center, part.worldCenter, 1e-9);
  const indexBefore = JSON.stringify(sceneIndex);
  const gltfBefore = JSON.stringify(gltf);
  // Non-monotonic deterministic samples exercise random seeking, not frame
  // integration. Later descendants must compensate for every parent offset.
  let random = 0x102cafe;
  const times = [0, second(9), second(15), second(22), second(28), second(41), second(49), second(54), DURATION];
  for (let index = 0; index < 24; index++) { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; times.push(random / 2 ** 32 * DURATION); }
  for (const time of times) {
    const state = stateAt(time);
    const local = localDisplayOffsets(sceneIndex, state.offsetsWorld, THREE.Matrix4, THREE.Vector3);
    applyDisplayExplosion(assembly.parts, 1, binding => local.get(binding.id));
    asset.updateMatrixWorld(true);
    for (const [id, binding] of assembly.parts) {
      const original = originalSource.get(id);
      near(centerOf(binding), original.center.map((value, axis) => value + state.offsetsWorld[id][axis]), 1e-9);
      near(binding.node.matrix.toArray(), original.matrix, 1e-12);
      assert.equal(binding.sourceParent, original.parent);
      assert.deepEqual(binding.model.position.toArray(), [0, 0, 0]);
    }
  }
  const rest = localDisplayOffsets(sceneIndex, stateAt(DURATION).offsetsWorld, THREE.Matrix4, THREE.Vector3);
  applyDisplayExplosion(assembly.parts, 1, binding => rest.get(binding.id)); asset.updateMatrixWorld(true);
  for (const [id, binding] of assembly.parts) near(centerOf(binding), originalSource.get(id).center, 1e-12);
  assert.equal(JSON.stringify(sceneIndex), indexBefore); assert.equal(JSON.stringify(gltf), gltfBefore);
});

test('display-delta conversion retains physical magnitude through rotated and scaled parent frames', () => {
  const world = new THREE.Matrix4().compose(new THREE.Vector3(12, -9, 5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 3), new THREE.Vector3(2, 3, .5));
  const index = { parts: [{ id: 'parent', parentId: null, worldMatrix: world.toArray() }, { id: 'child', parentId: 'parent' }] };
  const desired = { parent: [.03, .01, -.06], child: [.21, -.08, .04] };
  const local = localDisplayOffsets(index, desired, THREE.Matrix4, THREE.Vector3);
  const converted = new THREE.Vector3(...local.get('child'));
  const origin = new THREE.Vector3().applyMatrix4(world);
  converted.applyMatrix4(world).sub(origin).add(new THREE.Vector3(...desired.parent));
  near(converted.toArray(), desired.child, 1e-12);
  near(local.get('parent'), desired.parent);
  assert.throws(() => localDisplayOffsets(index, { ...desired, child: [0, NaN, 1] }, THREE.Matrix4, THREE.Vector3), /finite display offset/);
  assert.throws(() => localDisplayOffsets(index, { parent: [0, 0, 0] }, THREE.Matrix4, THREE.Vector3), /Missing finite/);
});

test('hiding an ancestor owned body preserves descendant wrist geometry and explicit restore reveals the complete robot', () => {
  const { asset, assembly, centerOf, bodiesOf } = boundRobot();
  const original = new Map([...assembly.parts].map(([id, binding]) => [id, { matrix: binding.node.matrix.toArray(), center: centerOf(binding) }]));
  for (const binding of assembly.parts.values()) {
    assert.equal(binding.node.isMesh, undefined, `${binding.id} source identity is a group`);
    const bodies = bodiesOf(binding);
    assert.equal(bodies.length, 1, `${binding.id} has exactly one retained link-body derivative`);
    assert.equal(bodies[0].parent, binding.node);
  }
  const focus = new Set(['urdf:link4_1', 'urdf:link5_1', 'urdf:clamp1_1', 'urdf:clamp2_1']);
  const state = stateAt(second(28));
  const offsets = localDisplayOffsets(sceneIndex, state.offsetsWorld, THREE.Matrix4, THREE.Vector3);
  applyDisplayExplosion(assembly.parts, 1, binding => offsets.get(binding.id));
  for (const binding of assembly.parts.values()) for (const body of bodiesOf(binding)) body.visible = focus.has(binding.id);
  asset.updateMatrixWorld(true);
  assert.equal(bodiesOf(assembly.parts.get('urdf:link1_1'))[0].visible, false);
  for (const [id, binding] of assembly.parts) {
    assert.equal(isWorldVisible(binding.node), true, `${id} source hierarchy remains visible`);
    for (const body of bodiesOf(binding)) assert.equal(isWorldVisible(body), focus.has(id), `${id} only owned geometry is hidden`);
    near(binding.node.matrix.toArray(), original.get(id).matrix, 1e-12);
    near(centerOf(binding), original.get(id).center.map((value, axis) => value + state.offsetsWorld[id][axis]), 1e-9);
  }
  // Whole/return views restore body visibility independently of display offsets.
  const rest = localDisplayOffsets(sceneIndex, stateAt(second(58)).offsetsWorld, THREE.Matrix4, THREE.Vector3);
  for (const body of assembly.meshes) body.visible = true;
  applyDisplayExplosion(assembly.parts, 1, binding => rest.get(binding.id)); asset.updateMatrixWorld(true);
  assert.ok(assembly.meshes.every(isWorldVisible));
  for (const [id, binding] of assembly.parts) {
    near(centerOf(binding), original.get(id).center, 1e-12);
    near(binding.node.matrix.toArray(), original.get(id).matrix, 1e-12);
  }
});
