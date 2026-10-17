import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bindAssembly, applyWorkingPoses, applyDisplayExplosion, isWorldVisible } from '../../shared/viewer/scene.mjs';
import { createAdapter as inlineFour } from '../adapters/inline-four.mjs';
import { createAdapter as turbofan } from '../adapters/turbofan.mjs';
import { createFramingEnvelopes } from '../adapters/camera-envelope.mjs';

const definitions = [
  { id: 'inline-four', file: 'inline-four', create: inlineFour, chapters: ['overview', 'intake', 'compression', 'ignition', 'exhaust', 'assembly'] },
  { id: 'turbofan', file: 'turbofan', create: turbofan, chapters: ['overview', 'fan', 'compression', 'combustion', 'exhaust', 'assembly'] },
];
const aspects = [.5, .65, 1, 1.6, 2.4];
async function fixture(definition) {
  const base = new URL(`../../examples/${definition.id}/assets/`, import.meta.url);
  const bytes = await readFile(new URL(`${definition.file}.glb`, base));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const contract = JSON.parse(await readFile(new URL('scene-contract.json', base), 'utf8'));
  const scene = new THREE.Scene(); scene.add(gltf.scene);
  const binding = bindAssembly(gltf.scene, { contract });
  return { ...binding, scene,
    applyPoses: (poses, options) => applyWorkingPoses(binding.parts, poses, options),
    setExplode: (value, options) => applyDisplayExplosion(binding.parts, value, options.vectorForPart),
    setCutaway: enabled => { for (const part of binding.parts.values()) part.display.visible = !(enabled && part.record.cutawayHidden); },
  };
}
function cameraFrom(pose, aspect) {
  const camera = new THREE.OrthographicCamera(-pose.halfHeight * aspect, pose.halfHeight * aspect, pose.halfHeight, -pose.halfHeight, .001, 20);
  camera.position.fromArray(pose.position); camera.lookAt(new THREE.Vector3(...pose.target));
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); return camera;
}
function boxFrom(record) { return new THREE.Box3(new THREE.Vector3(...record.min), new THREE.Vector3(...record.max)); }
function corners(box) {
  const result = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) result.push(new THREE.Vector3(x, y, z));
  return result;
}

for (const definition of definitions) {
  test(`${definition.id}: camera state is independent of live mechanical phase and explosion`, async t => {
    const viewer = await fixture(definition), adapter = definition.create(THREE, viewer); t.after(() => adapter.dispose());
    const planned = adapter.snapshot().cameraPlan;
    for (const aspect of aspects) {
      const expected = Object.fromEntries(definition.chapters.map(chapter => [chapter, adapter.camera(chapter, .37, aspect)]));
      for (const totalTime of [.013, .711, 3.27, 7.1, 12.123, 23.371]) {
        adapter.update({ chapterId: 'overview', chapterProgress: .37, totalTime });
        for (const chapter of definition.chapters) assert.deepEqual(adapter.camera(chapter, .37, aspect), expected[chapter], `${chapter} follows live mechanical bounds`);
        for (const explode of [0, .19, .53, 1]) {
          adapter.update({ chapterId: 'assembly', chapterProgress: .37, totalTime, explode });
          assert.deepEqual(adapter.camera('assembly', .37, aspect), expected.assembly, 'explosion cannot refit the camera');
        }
      }
      for (const chapter of ['overview', 'assembly']) {
        const held = adapter.camera(chapter, 0, aspect);
        for (const progress of [.1, .33, .5, .83, 1]) assert.deepEqual(adapter.camera(chapter, progress, aspect), held, `${chapter} must hold its opening composition`);
      }
    }
    assert.deepEqual(adapter.snapshot().cameraPlan, planned, 'camera plans are immutable after loading');
  });

  test(`${definition.id}: complete planned envelopes fit mobile/desktop cameras and contain actual moving geometry`, async t => {
    const viewer = await fixture(definition), adapter = definition.create(THREE, viewer); t.after(() => adapter.dispose());
    const plan = adapter.snapshot().cameraPlan;
    for (const chapter of ['overview', 'assembly']) {
      const box = boxFrom(plan[chapter]);
      for (const aspect of aspects) for (const progress of [0, .17, .5, .83, 1]) {
        const camera = cameraFrom(adapter.camera(chapter, progress, aspect), aspect);
        for (const corner of corners(box)) {
          const point = corner.project(camera);
          assert.ok(Math.abs(point.x) < .95 && Math.abs(point.y) < .95 && point.z > -1 && point.z < 1, `${chapter}/${aspect}: planned envelope crop`);
        }
      }
      // Off-grid phases exercise the continuous analytic sweeps, not merely
      // discrete geometry samples used to design a camera.
      for (const totalTime of [.013, .711, 3.27, 7.1]) for (const explode of chapter === 'assembly' ? [0, .53, 1] : [0]) {
        adapter.update({ chapterId: chapter, chapterProgress: .37, totalTime, explode });
        viewer.scene.updateMatrixWorld(true);
        for (const mesh of viewer.meshes) {
          if (!isWorldVisible(mesh)) continue;
          const attribute = mesh.geometry.getAttribute('position'), point = new THREE.Vector3();
          for (let index = 0; index < attribute.count; index++) {
            point.fromBufferAttribute(attribute, index).applyMatrix4(mesh.matrixWorld);
            assert.ok(box.containsPoint(point), `${chapter}/${totalTime}/${explode}: ${mesh.userData.selectionId} left its planned envelope`);
          }
        }
      }
    }
  });
}

test('envelope planning preserves a live source pose and bounds a continuous rotational sweep plus explosion', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 2, 1, .2, 1, 2, -.2, 1, 1], 3));
  const source = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()); source.userData.part_id = 'rotor'; source.position.set(.4, .1, -.2); root.add(source);
  const binding = bindAssembly(root, { contract: { parts: [{ part_id: 'rotor', cutawayHidden: false, explode: [0, .3, 0] }] } });
  applyWorkingPoses(binding.parts, { rotor: { rotationX: 1.337 } }, { target: 'node' });
  applyDisplayExplosion(binding.parts, .73); scene.updateMatrixWorld(true);
  const before = [...binding.parts.values()].map(part => [part.node.matrix.toArray(), part.display.matrix.toArray(), part.node.parent.uuid]);
  const plan = createFramingEnvelopes(THREE, { ...binding, scene }, {
    referencePoses: { rotor: { rotationX: 0 } }, motionRanges: { rotor: { rotationX: 'full' } }, explodeVector: part => part.record.explode,
  });
  scene.updateMatrixWorld(true);
  assert.deepEqual([...binding.parts.values()].map(part => [part.node.matrix.toArray(), part.display.matrix.toArray(), part.node.parent.uuid]), before);
  const radius = Math.sqrt(5);
  assert.ok(Math.abs(plan.overview.max.y - (.1 + radius + .001)) < 1e-8);
  assert.ok(Math.abs(plan.assembly.max.y - (.4 + radius + .001)) < 1e-8);
  assert.ok(Math.abs(plan.overview.min.z - (-.2 - radius - .001)) < 1e-8);
  geometry.dispose(); source.material.dispose();
});
