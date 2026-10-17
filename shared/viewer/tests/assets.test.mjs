import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bindAssembly, applyDisplayExplosion, applyWorkingPoses, resetDisplay } from '../scene.mjs';
import { SPEC as LOCK_SPEC } from '../../../model.mjs';
import { engineState, motionPoses, bodyToGLTF } from '../../../examples/inline-four/model.mjs';

const root = new URL('../../../', import.meta.url);
async function load(relative) {
  const bytes = await readFile(new URL(relative, root));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
function world(node) { node.updateWorldMatrix(true, false); return node.matrixWorld.toArray(); }
function close(actual, expected) { actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-9)); }

test('shared loader bindings preserve all 24 lock parts through rotor grouping and display restoration', async () => {
  const asset = await load('prototype-3d/assets/lock.glb'), scene = new THREE.Scene(), machine = new THREE.Group(), rotor = new THREE.Group();
  scene.add(asset.scene, machine); machine.add(rotor); rotor.position.set(0, LOCK_SPEC.plugAxisZ / 1000, 0);
  scene.updateMatrixWorld(true); const originals = new Map();
  asset.scene.traverse(node => { if (node.userData.part_id) originals.set(node.userData.part_id, world(node)); });
  const binding = bindAssembly(asset.scene, { parentForPart: id => /^(plug|key|lower)-/.test(id) || id === 'cam' ? rotor : machine });
  assert.equal(binding.parts.size, 24); assert.equal(binding.meshes.length, 26);
  for (const [id, { node }] of binding.parts) close(world(node), originals.get(id));
  rotor.rotation.x = Math.PI / 2;
  const working = new Map([...binding.parts].map(([id, { node }]) => [id, world(node)]));
  applyDisplayExplosion(binding.parts, 1, () => [.02, .01, .03]); resetDisplay(binding.parts);
  assert.equal(rotor.rotation.x, Math.PI / 2);
  for (const [id, { node }] of binding.parts) close(world(node), working.get(id));
});

test('shared bindings apply actual engine model poses, explode and restore without changing them', async () => {
  const asset = await load('examples/inline-four/assets/inline-four.glb');
  const contract = JSON.parse(await readFile(new URL('examples/inline-four/assets/scene-contract.json', root), 'utf8'));
  const binding = bindAssembly(asset.scene, { contract });
  assert.equal(binding.parts.size, 46); assert.equal(binding.meshes.length, 423);
  const state = engineState(137.5), poses = motionPoses(state);
  applyWorkingPoses(binding.parts, poses, { target: 'node' });
  for (const [id, pose] of Object.entries(poses)) {
    const node = binding.parts.get(id).node;
    if (pose.position) close(node.position.toArray(), pose.position);
    if (pose.rotationX !== undefined) assert.equal(node.rotation.x, pose.rotationX);
  }
  const before = new Map([...binding.parts].map(([id, { node }]) => [id, world(node)]));
  applyDisplayExplosion(binding.parts, .7, binding => bodyToGLTF(binding.record.explode)); resetDisplay(binding.parts);
  for (const [id, { node }] of binding.parts) close(world(node), before.get(id));
  assert.equal(state.angle, 137.5);
});
