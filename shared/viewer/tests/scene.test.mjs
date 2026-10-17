import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bindAssembly, applyDisplayExplosion, applyWorkingPoses, resetDisplay, visibleBounds, isWorldVisible } from '../scene.mjs';

function fixture() {
  const root = new THREE.Group(), assembly = new THREE.Group();
  root.add(assembly); assembly.position.set(.4, .3, -.2); assembly.rotation.z = .3;
  const rotor = new THREE.Group(); rotor.userData.part_id = 'rotor'; rotor.position.set(.12, .08, .03); assembly.add(rotor);
  const solid = new THREE.Mesh(new THREE.BoxGeometry(.2, .1, .1), new THREE.MeshBasicMaterial()); rotor.add(solid);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(.5, .3, .2), new THREE.MeshBasicMaterial());
  housing.userData.part_id = 'housing'; housing.position.set(-.1, 0, 0); assembly.add(housing);
  const contract = { parts: [{ part_id: 'rotor', explode: [.4, .2, 0] }, { part_id: 'housing', explode: [0, -.3, 0] }] };
  root.updateMatrixWorld(true); return { root, assembly, rotor, solid, housing, contract };
}
const matrix = node => { node.updateWorldMatrix(true, false); return node.matrixWorld.toArray(); };
function close(actual, expected) { actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-10)); }

test('binding retains GLB local pose, world pose, source assembly and geometry identity', () => {
  const f = fixture(), before = matrix(f.rotor), pose = f.rotor.position.toArray(), geometry = f.solid.geometry;
  const { parts, meshes } = bindAssembly(f.root, { contract: f.contract });
  assert.equal(parts.size, 2); assert.equal(meshes.length, 2); assert.equal(parts.get('rotor').sourceParent, f.assembly);
  assert.equal(parts.get('rotor').display.parent, f.assembly); assert.equal(f.rotor.parent, parts.get('rotor').model);
  assert.deepEqual(f.rotor.position.toArray(), pose); close(matrix(f.rotor), before); assert.equal(f.solid.geometry, geometry);
  assert.equal(f.solid.userData.selectionId, 'rotor'); assert.equal(f.housing.userData.selectionId, 'housing');
});

test('explicit working-group reparenting retains the source world pose', () => {
  const f = fixture(), target = new THREE.Group(); f.root.add(target); target.position.set(.2, -.1, .4);
  const before = matrix(f.rotor), binding = bindAssembly(f.root, { contract: f.contract, parentForPart: () => target }).parts.get('rotor');
  assert.equal(binding.display.parent, target); close(matrix(f.rotor), before);
});

test('explosion and reset leave working pose, source geometry and mechanical input untouched', () => {
  const f = fixture(), binding = bindAssembly(f.root, { contract: f.contract }), mechanical = Object.freeze({ angle: 1.2 });
  applyWorkingPoses(binding.parts, { rotor: { rotationX: mechanical.angle, position: [.1, .2, .3] } });
  const work = binding.parts.get('rotor').model, sourceTransform = f.rotor.position.toArray(), geometry = f.solid.geometry;
  const workBefore = { position: work.position.toArray(), quaternion: work.quaternion.toArray() };
  const boundsBefore = visibleBounds(binding.meshes);
  assert.equal(applyDisplayExplosion(binding.parts, .5), .5);
  assert.deepEqual(binding.parts.get('rotor').display.position.toArray(), [.2, .1, 0]);
  assert.notDeepEqual(visibleBounds(binding.meshes).toArray?.() || visibleBounds(binding.meshes).max.toArray(), boundsBefore.max.toArray());
  binding.parts.get('housing').display.visible = false;
  assert.equal(isWorldVisible(f.housing), false); resetDisplay(binding.parts);
  assert.equal(isWorldVisible(f.housing), true); assert.deepEqual(binding.parts.get('rotor').display.position.toArray(), [0, 0, 0]);
  assert.deepEqual(work.position.toArray(), workBefore.position); assert.deepEqual(work.quaternion.toArray(), workBefore.quaternion);
  assert.deepEqual(f.rotor.position.toArray(), sourceTransform); assert.equal(f.solid.geometry, geometry); assert.equal(mechanical.angle, 1.2);
});

test('node pose application is compatible with GLB rest transforms and never writes display', () => {
  const f = fixture(), { parts } = bindAssembly(f.root, { contract: f.contract });
  applyDisplayExplosion(parts, 1); applyWorkingPoses(parts, { rotor: { position: [.2, .1, 0], rotationX: .5 } }, { target: 'node' });
  assert.deepEqual(f.rotor.position.toArray(), [.2, .1, 0]); assert.equal(f.rotor.rotation.x, .5);
  assert.deepEqual(parts.get('rotor').display.position.toArray(), [.4, .2, 0]);
  assert.throws(() => applyWorkingPoses(parts, { absent: { rotationX: 1 } }), /缺少运动零件/);
  assert.throws(() => applyWorkingPoses(parts, {}, { target: 'display' }), /工作姿态/);
});

test('rejects missing, duplicate and mismatched stable identities before rendering', () => {
  const empty = new THREE.Group(); assert.throws(() => bindAssembly(empty), /稳定零件/);
  const f = fixture(); f.housing.userData.part_id = 'rotor'; assert.throws(() => bindAssembly(f.root), /重复零件/);
  const other = fixture(); assert.throws(() => bindAssembly(other.root, { contract: { parts: [{ part_id: 'rotor' }] } }), /数量/);
  const wrong = fixture(); assert.throws(() => bindAssembly(wrong.root, { contract: { parts: [{ part_id: 'rotor' }, { part_id: 'wrong' }] } }), /缺少零件/);
});

test('nested semantic parts bind their own meshes once', () => {
  const root = new THREE.Group(), parent = new THREE.Group(), child = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  parent.userData.part_id = 'carrier'; child.userData.part_id = 'insert'; parent.add(child); root.add(parent);
  const { parts, meshes } = bindAssembly(root);
  assert.equal(parts.size, 2); assert.equal(meshes.length, 1); assert.equal(child.userData.selectionId, 'insert');
});

test('bounds omit hidden ancestors and invalid explosion vectors cannot partially move assembly', () => {
  const f = fixture(), { parts, meshes } = bindAssembly(f.root);
  const all = visibleBounds(meshes); parts.get('housing').display.visible = false;
  const hidden = visibleBounds(meshes); assert.ok(hidden.min.x > all.min.x);
  assert.throws(() => applyDisplayExplosion(parts, 1, binding => binding.id === 'rotor' ? [.4, 0, 0] : [NaN, 0, 0]), /向量无效/);
  assert.deepEqual(parts.get('rotor').display.position.toArray(), [0, 0, 0]);
  assert.throws(() => applyDisplayExplosion(parts, NaN), /有限数字/);
});

test('invalid poses reject atomically, while typed finite transforms are supported', () => {
  const f = fixture(), { parts } = bindAssembly(f.root), work = parts.get('rotor').model;
  assert.throws(() => applyWorkingPoses(parts, { rotor: { position: [1, 2, 3] }, housing: { rotationY: NaN } }), /姿态/);
  assert.deepEqual(work.position.toArray(), [0, 0, 0]);
  assert.throws(() => applyWorkingPoses(parts, { rotor: { position: [1, 2] } }), /position/);
  assert.throws(() => applyWorkingPoses(parts, { rotor: { quaternion: [0, 0, 0, 0] } }), /单位四元数/);
  applyWorkingPoses(parts, { rotor: { position: new Float64Array([.1, .2, .3]), quaternion: [0, 0, 0, 1] } });
  assert.deepEqual(work.position.toArray(), [.1, .2, .3]);
});
