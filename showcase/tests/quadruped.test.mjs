import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bindAssembly, applyWorkingPoses, applyDisplayExplosion, isWorldVisible } from '../../shared/viewer/scene.mjs';
import { robotState, motionPoses, SPEC, bodyToGLTF } from '../../examples/quadruped/model.mjs';
import { createAdapter, sampleChapter } from '../adapters/quadruped.mjs';
import { createQuadrupedFraming, explosionVector, motionRanges } from '../adapters/quadruped-framing.mjs';

const chapters = ['overview', 'joints', 'trajectory', 'gait', 'stance', 'assembly'];
const aspects = [.5, .65, 1, 1.6, 2.4];
async function fixture() {
  const base = new URL('../../examples/quadruped/assets/', import.meta.url), bytes = await readFile(new URL('quadruped.glb', base));
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
const frame = (chapterId, time = 4.173, progress = .43, explode = 0) => ({ chapterId, localTime: time, totalTime: time, chapterProgress: progress, explode });
function cameraFrom(pose, aspect) {
  const camera = new THREE.OrthographicCamera(-pose.halfHeight * aspect, pose.halfHeight * aspect, pose.halfHeight, -pose.halfHeight, .001, 20);
  camera.position.fromArray(pose.position); camera.lookAt(new THREE.Vector3(...pose.target)); camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); return camera;
}
function plannedBox(plan) { return new THREE.Box3(new THREE.Vector3(...plan.min), new THREE.Vector3(...plan.max)); }
function assertVertices(viewer, box, filter = () => true) {
  viewer.scene.updateMatrixWorld(true);
  const point = new THREE.Vector3();
  for (const mesh of viewer.meshes) if (isWorldVisible(mesh) && filter(mesh.userData.selectionId)) {
    const attribute = mesh.geometry.getAttribute('position');
    for (let index = 0; index < attribute.count; index++) {
      point.fromBufferAttribute(attribute, index).applyMatrix4(mesh.matrixWorld);
      assert.ok(box.containsPoint(point), `${mesh.userData.selectionId}: actual source vertex left its camera envelope`);
    }
  }
}
function transformSnapshot(viewer) {
  viewer.scene.updateMatrixWorld(true);
  return [...viewer.parts].map(([id, part]) => [id, part.node.matrix.toArray(), part.model.matrix.toArray(), part.display.matrix.toArray(), part.display.visible, part.node.parent.uuid]);
}

test('quadruped chapters have deterministic editorial states and reject invalid inputs', () => {
  for (const chapterId of chapters) {
    const input = frame(chapterId); assert.deepEqual(sampleChapter(input), sampleChapter(input));
  }
  assert.equal(sampleChapter({ chapterId: 'assembly', chapterProgress: .5 }).explode, 1);
  assert.equal(sampleChapter({ chapterId: 'assembly', chapterProgress: 1 }).explode, 0);
  assert.equal(sampleChapter({ chapterId: 'gait', explode: 1 }).explode, 0);
  assert.equal(sampleChapter({ chapterId: 'joints', chapterProgress: 1 }).singleLift, 40);
  for (const input of [{ chapterId: 'other' }, { totalTime: NaN }, { localTime: -1 }, { chapterProgress: Infinity }, { explode: -1 }]) assert.throws(() => sampleChapter(input));
});

test('quadruped continuous target bounds contain all showcase IK outputs, not only reference poses', () => {
  const ranges = motionRanges();
  for (let index = 0; index < 257; index++) for (const stepHeight of [10, 27.3, 40, 60]) {
    const model = robotState({ mode: 'trot', phase: (index + .37) / 257, stepHeight });
    for (const [id, pose] of Object.entries(motionPoses(model))) {
      const range = ranges[id];
      for (let axis = 0; axis < 3; axis++) assert.ok(pose.position[axis] >= range.position.min[axis] - 1e-10 && pose.position[axis] <= range.position.max[axis] + 1e-10, `${id} translation`);
      assert.ok(pose.rotation[2] >= range.rotationZ[0] - 1e-10 && pose.rotation[2] <= range.rotationZ[1] + 1e-10, `${id} rotation`);
    }
  }
});

test('quadruped envelope planning preserves the actual live source hierarchy, pose and visibility', async () => {
  const viewer = await fixture();
  viewer.applyPoses(motionPoses(robotState({ mode: 'trot', phase: .137, stepHeight: 57 })), { target: 'node' });
  viewer.setExplode(.63, { vectorForPart: explosionVector }); viewer.setCutaway(true);
  const before = transformSnapshot(viewer), plan = createQuadrupedFraming(THREE, viewer);
  assert.deepEqual(transformSnapshot(viewer), before);
  assert.ok(plan.assembly.max.y > plan.overview.max.y + .08, 'cover explosion uses the correct already-metre basis');
  assert.ok(plan.assembly.max.z > plan.overview.max.z + .1, 'lateral leg explosion retains its full scale');
});

test('quadruped real GLB link endpoints, English annotations and teaching guides follow the same model', async t => {
  const viewer = await fixture(), adapter = createAdapter(THREE, viewer); t.after(() => adapter.dispose());
  assert.equal(viewer.parts.size, 20); assert.equal(viewer.meshes.length, 291);
  for (const chapter of chapters) for (const time of [.11, 1.417, 3.281]) {
    adapter.update(frame(chapter, time)); const snapshot = adapter.snapshot();
    for (const leg of snapshot.mechanical.legs) {
      const thighEnd = viewer.parts.get(`thigh-${leg.id}`).node.localToWorld(new THREE.Vector3(0, -SPEC.thigh * .001, 0));
      const knee = viewer.parts.get(`shin-${leg.id}`).node.getWorldPosition(new THREE.Vector3());
      const shinEnd = viewer.parts.get(`shin-${leg.id}`).node.localToWorld(new THREE.Vector3(0, -SPEC.shin * .001, 0));
      const foot = viewer.parts.get(`foot-${leg.id}`).node.getWorldPosition(new THREE.Vector3());
      assert.ok(thighEnd.distanceTo(knee) < 1e-7, 'real upper link endpoint meets knee');
      assert.ok(shinEnd.distanceTo(foot) < 1e-7, 'real lower link endpoint meets foot');
      assert.ok(foot.distanceTo(new THREE.Vector3(...bodyToGLTF(leg.footPositionMM))) < 1e-7);
      assert.ok(leg.residualMM < 1e-8 && leg.withinLimits);
    }
    assert.ok(snapshot.annotations.length <= 2);
    for (const label of snapshot.annotations) {
      assert.ok(viewer.parts.has(label.id)); assert.ok(label.point.every(Number.isFinite)); assert.ok(label.labelY > 0 && label.labelY < 1);
      assert.match(label.label, /[a-z]/); assert.doesNotMatch(label.label, /[\u3400-\u9fff]/);
    }
    assert.doesNotMatch(JSON.stringify(snapshot.mechanical), /[\u3400-\u9fff]/);
    assert.equal(snapshot.effects.geometryOnly, true); assert.equal(snapshot.effects.forceSimulation, false);
  }
  adapter.update(frame('joints')); assert.equal(adapter.snapshot().effects.chainVisible, true);
  adapter.update(frame('trajectory')); assert.deepEqual(adapter.snapshot().effects.visiblePathLegs, ['fl']);
  const trajectory = adapter.snapshot().mechanical;
  for (const leg of trajectory.legs.slice(1)) assert.equal(leg.footPositionMM[2], SPEC.footRadius);
  const anchor = adapter.annotations('trajectory')[0];
  assert.ok(new THREE.Vector3(...anchor.point).distanceTo(viewer.parts.get('foot-fl').node.getWorldPosition(new THREE.Vector3())) < 1e-10);
  adapter.update(frame('gait')); assert.deepEqual(adapter.snapshot().effects.visiblePathLegs, ['fl', 'fr', 'rl', 'rr']);
  const legs = adapter.snapshot().mechanical.legs;
  assert.equal(legs[0].localPhase, legs[3].localPhase); assert.equal(legs[1].localPhase, legs[2].localPhase);
  assert.ok(Math.abs(Math.abs(legs[0].localPhase - legs[1].localPhase) - .5) < 1e-10);
  adapter.update(frame('stance')); assert.deepEqual(adapter.snapshot().effects.contactCueLegs, adapter.snapshot().mechanical.contactLegs);
});

test('quadruped explosion is an observation transform and reassembly restores the same working pose', async t => {
  const viewer = await fixture(), adapter = createAdapter(THREE, viewer); t.after(() => adapter.dispose());
  adapter.update(frame('assembly', 4, .2, 0)); const mechanical = adapter.snapshot().mechanical;
  const poses = [...viewer.parts].map(([id, part]) => [id, part.node.position.toArray(), part.node.quaternion.toArray()]);
  for (const explode of [.13, .57, 1, 0]) {
    adapter.update(frame('assembly', 8, .8, explode));
    assert.deepEqual(adapter.snapshot().mechanical, mechanical);
    assert.deepEqual([...viewer.parts].map(([id, part]) => [id, part.node.position.toArray(), part.node.quaternion.toArray()]), poses);
    assert.equal(viewer.parts.get('cover').display.visible, true);
    assert.deepEqual(adapter.snapshot().effects.visiblePathLegs, []);
  }
  for (const part of viewer.parts.values()) assert.ok(part.display.position.toArray().every(value => value === 0));
  adapter.dispose(); adapter.dispose(); assert.equal(adapter.snapshot().disposed, true);
  assert.equal(viewer.scene.getObjectByName('showcase/quadruped/teaching-guides'), undefined);
});

test('quadruped stance caption always identifies a genuine planned-contact foot and its visible ground cue', async t => {
  const viewer = await fixture(), adapter = createAdapter(THREE, viewer); t.after(() => adapter.dispose());
  const seen = new Set();
  for (const phase of [0, .0137, .231, .49999, .5, .713, .99999]) {
    adapter.update(frame('stance', phase / .32));
    const snapshot = adapter.snapshot(), annotation = snapshot.annotations.find(label => label.label === 'Planned stance phase');
    const id = annotation.id.slice('foot-'.length), leg = snapshot.mechanical.legs.find(leg => leg.id === id);
    seen.add(id);
    assert.ok(leg.contact, `phase ${phase}: stance label cannot identify a swinging foot`);
    assert.ok(snapshot.effects.contactCueLegs.includes(id));
    const cue = viewer.scene.getObjectByName(`planned-contact/${id}`);
    assert.ok(isWorldVisible(cue), 'the associated planned-contact ground cue must be visible');
    const foot = viewer.parts.get(annotation.id).node.getWorldPosition(new THREE.Vector3()), marker = cue.getWorldPosition(new THREE.Vector3());
    assert.ok(foot.distanceTo(new THREE.Vector3(...annotation.point)) < 1e-10, 'caption endpoint follows the actual source foot');
    assert.ok(Math.abs(marker.x - foot.x) < 1e-10 && Math.abs(marker.z - foot.z) < 1e-10, 'ground cue corresponds to this foot');
  }
  assert.ok(seen.size > 1, 'contact identity changes when the diagonal stance group changes');
});

test('quadruped camera plans stay fixed across live movement, chapter progress and display explosion', async t => {
  const viewer = await fixture(), adapter = createAdapter(THREE, viewer); t.after(() => adapter.dispose());
  const original = adapter.snapshot().cameraPlan;
  for (const aspect of aspects) {
    const expected = Object.fromEntries(chapters.map(chapter => [chapter, adapter.camera(chapter, .37, aspect)]));
    for (const totalTime of [.013, .711, 3.271, 7.113, 12.123]) for (const progress of [0, .19, .67, 1]) {
      adapter.update(frame('gait', totalTime, progress));
      for (const chapter of chapters) assert.deepEqual(adapter.camera(chapter, progress, aspect), expected[chapter]);
      adapter.update(frame('assembly', totalTime, progress, progress)); assert.deepEqual(adapter.camera('assembly', progress, aspect), expected.assembly);
    }
  }
  assert.deepEqual(adapter.snapshot().cameraPlan, original);
  assert.throws(() => adapter.camera('overview', 0, 0));
});

test('quadruped all chapter envelopes and real annotation anchors fit portrait through ultrawide cameras', async t => {
  const viewer = await fixture(), adapter = createAdapter(THREE, viewer); t.after(() => adapter.dispose());
  for (const chapter of chapters) for (const aspect of aspects) for (const progress of [.13, .59, .91]) {
    adapter.update(frame(chapter, progress * 7.19, progress, chapter === 'assembly' ? progress : 0));
    const camera = cameraFrom(adapter.camera(chapter, progress, aspect), aspect), box = plannedBox(adapter.snapshot().cameraPlan[chapter]);
    const points = adapter.annotations(chapter).map(label => new THREE.Vector3(...label.point));
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z));
    for (const point of points) { point.project(camera); assert.ok(Math.abs(point.x) <= .8 && Math.abs(point.y) <= .8, `${chapter}/${aspect}: crop`); assert.ok(point.z > -1 && point.z < 1); }
  }
});

test('quadruped planned envelopes contain actual off-grid moving GLB vertices, including intermediate explosion', async t => {
  const viewer = await fixture(), adapter = createAdapter(THREE, viewer); t.after(() => adapter.dispose());
  const plan = adapter.snapshot().cameraPlan;
  for (const time of [.013, .711, 3.271, 7.113]) {
    adapter.update(frame('gait', time)); assertVertices(viewer, plannedBox(plan.overview));
    adapter.update(frame('trajectory', time)); assertVertices(viewer, plannedBox(plan.trajectory), id => id.endsWith('-fl'));
    for (const explode of [0, .19, .53, 1]) { adapter.update(frame('assembly', time, .37, explode)); assertVertices(viewer, plannedBox(plan.assembly)); }
  }
  // The full declared input range is wider than this tour's default 40 mm
  // swing. Check true source vertices at 60 mm too, including phase seams.
  for (const phase of [0, .0173, .2317, .4991, .5321, .7993]) {
    viewer.applyPoses(motionPoses(robotState({ mode: 'trot', phase, stepHeight: 60 })), { target: 'node' }); viewer.setExplode(0, { vectorForPart: explosionVector });
    assertVertices(viewer, plannedBox(plan.overview));
  }
});
