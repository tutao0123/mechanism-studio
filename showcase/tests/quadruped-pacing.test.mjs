import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bindAssembly, applyWorkingPoses, applyDisplayExplosion } from '../../shared/viewer/scene.mjs';
import { SPEC, bodyToGLTF } from '../../examples/quadruped/model.mjs';
import { createAdapter, sampleChapter } from '../adapters/quadruped.mjs';

const chapters = ['overview', 'joints', 'trajectory', 'gait', 'stance', 'assembly'];
const frame = (chapterId, localTime, totalTime = localTime, chapterProgress = .5) => ({ chapterId, localTime, totalTime, chapterProgress });
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-10, `${message}: ${actual} != ${expected}`);

async function fixture() {
  const base = new URL('../../examples/quadruped/assets/', import.meta.url);
  const bytes = await readFile(new URL('quadruped.glb', base));
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

test('quadruped explicit Explain preserves the original default editorial timing', () => {
  for (const chapterId of chapters) for (const time of [0, .37, 4.173, 15.999]) {
    const input = frame(chapterId, time, time, .5);
    assert.deepEqual(sampleChapter(input), sampleChapter(input, 'explain'));
  }
  const gait = sampleChapter(frame('gait', 1, 1), 'explain');
  close(gait.phase, .32, 'original 0.32 Hz');
  assert.equal(sampleChapter(frame('joints', 1, 1, .5), 'explain').singleLift, 20);
  assert.equal(sampleChapter(frame('assembly', 1, 1, .5), 'explain').explode, 1);
  assert.equal(sampleChapter(frame('assembly', 20, 20, 1), 'explain').explode, 0);
  assert.equal(sampleChapter(frame('assembly', 1), 'explain').mode, 'stand');
  for (const mode of ['fast', '', null, 1, {}]) assert.throws(() => sampleChapter({}, mode), /presentation mode/);
});

test('Showcase lifts the demonstration leg in one second, holds, returns and repeats independently of narration length', () => {
  const lift = seconds => sampleChapter(frame('joints', seconds, 8, .01), 'showcase').singleLift;
  assert.equal(lift(0), 0); assert.equal(lift(.5), 20); assert.equal(lift(1), 40);
  assert.equal(lift(1.3), 40); assert.equal(lift(1.45), 40);
  close(lift(1.95), 20, 'return midpoint'); assert.equal(lift(2.45), 0);
  assert.equal(lift(2.8), 0); assert.equal(lift(3), 0); assert.equal(lift(4), 40);
  assert.equal(sampleChapter(frame('joints', 1, 8, 1), 'showcase').singleLift, 40);
});

test('Showcase repeats gait, path and changing stance cues at 0.76 Hz', () => {
  for (const chapterId of ['overview', 'trajectory', 'gait', 'stance']) {
    const input = frame(chapterId, 1, 1);
    close(sampleChapter(input, 'showcase').phase, .76, 'short gait frequency');
    assert.notEqual(sampleChapter(input, 'showcase').phase, sampleChapter(input, 'explain').phase);
    close(sampleChapter(frame(chapterId, 1 + 1 / .76, 1 + 1 / .76), 'showcase').phase, .76, 'complete gait cycle');
  }
});

test('Showcase assembly completes smooth reassembly in seconds and holds the loop opening pose', () => {
  const state = seconds => sampleChapter(frame('assembly', seconds, 30 + seconds, .5), 'showcase');
  assert.equal(state(0).explode, 0); close(state(.6).explode, .5, 'half expanded');
  assert.equal(state(1.2).explode, 1); assert.equal(state(2.2).explode, 1);
  close(state(2.8).explode, .5, 'half reassembled');
  for (const time of [3.4, 4, 6, 7.3, 30]) assert.equal(state(time).explode, 0);
  assert.equal(state(6).mode, 'trot'); assert.equal(state(6).phase, sampleChapter({}, 'showcase').phase);
  const delta = 1e-5;
  for (const edge of [0, 1.2, 2.2, 3.4]) {
    const before = state(Math.max(0, edge - delta)).explode, after = state(edge + delta).explode;
    assert.ok(Math.abs(after - before) < 1e-8, 'boundaries have zero endpoint velocity');
  }
  assert.equal(sampleChapter({ ...frame('assembly', 4), explode: .37 }, 'showcase').explode, .37, 'explicit observation overrides still work');
  assert.equal(sampleChapter({ ...frame('gait', 4), explode: 1 }, 'showcase').explode, 0);
});

test('Showcase states are bounded and repeatable for arbitrary seeks and repeated sampling', () => {
  for (const chapterId of chapters) for (let index = 0; index < 157; index++) {
    const input = frame(chapterId, (index + .137) * .0417, 13 + index * .0417, index / 156);
    const value = sampleChapter(input, 'showcase');
    assert.deepEqual(sampleChapter(input, 'showcase'), value);
    assert.ok(value.phase >= 0 && value.phase < 1);
    assert.ok(value.explode >= 0 && value.explode <= 1);
    assert.ok(value.singleLift >= 0 && value.singleLift <= 40);
  }
});

test('Showcase adapter preserves source link endpoints, honest contact labels and fixed camera framing at the faster tempo', async t => {
  const viewer = await fixture(), adapter = createAdapter(THREE, viewer, { mode: 'showcase' });
  t.after(() => adapter.dispose());
  const plan = adapter.snapshot().cameraPlan, contactIds = new Set();
  assert.equal(adapter.snapshot().presentationMode, 'showcase');
  assert.equal(adapter.snapshot().pacing.gaitHz, .76);
  for (const chapterId of chapters) {
    const camera = adapter.camera(chapterId, 0, 1.6);
    for (const seconds of [.013, .37, .713, 1, 1.47, 2.45, 3.17, 3.91, 5.89]) {
      adapter.update(frame(chapterId, seconds, seconds + 12));
      const snapshot = adapter.snapshot();
      assert.deepEqual(adapter.camera(chapterId, .9, 1.6), camera);
      assert.deepEqual(snapshot.cameraPlan, plan);
      for (const leg of snapshot.mechanical.legs) {
        const knee = viewer.parts.get(`shin-${leg.id}`).node.getWorldPosition(new THREE.Vector3());
        const foot = viewer.parts.get(`foot-${leg.id}`).node.getWorldPosition(new THREE.Vector3());
        const thighEnd = viewer.parts.get(`thigh-${leg.id}`).node.localToWorld(new THREE.Vector3(0, -SPEC.thigh * .001, 0));
        const shinEnd = viewer.parts.get(`shin-${leg.id}`).node.localToWorld(new THREE.Vector3(0, -SPEC.shin * .001, 0));
        // Display explosion deliberately separates neighbouring source parts.
        // Their model-owned endpoints must coincide in every working view.
        if (snapshot.explode === 0) {
          assert.ok(thighEnd.distanceTo(knee) < 1e-7); assert.ok(shinEnd.distanceTo(foot) < 1e-7);
          assert.ok(foot.distanceTo(new THREE.Vector3(...bodyToGLTF(leg.footPositionMM))) < 1e-7);
        }
        assert.ok(leg.residualMM < 1e-8 && leg.withinLimits);
      }
      if (chapterId === 'stance') {
        const id = snapshot.annotations[0].id.slice(5); contactIds.add(id);
        assert.ok(snapshot.mechanical.contactLegs.includes(id));
        assert.ok(snapshot.effects.contactCueLegs.includes(id));
      }
    }
  }
  assert.ok(contactIds.size > 1, 'stance chapter changes the actual diagonal support group');
});

test('Showcase display reassembly and the next loop restore exactly matching source mechanical poses', async t => {
  const viewer = await fixture(), adapter = createAdapter(THREE, viewer, { mode: 'showcase' });
  t.after(() => adapter.dispose());
  const poses = () => [...viewer.parts].map(([id, part]) => [id, part.node.position.toArray(), part.node.quaternion.toArray()]);
  adapter.update(frame('assembly', 2, 32)); assert.equal(adapter.snapshot().explode, 1);
  adapter.update(frame('assembly', 6, 36)); const ending = poses();
  for (const part of viewer.parts.values()) assert.ok(part.display.position.toArray().every(value => value === 0));
  adapter.update(frame('overview', 0, 0, 0)); assert.deepEqual(poses(), ending);
  adapter.update(frame('gait', 1.371, 19.371)); const sought = poses();
  adapter.update(frame('trajectory', .317, 12.317)); adapter.update(frame('gait', 1.371, 19.371));
  assert.deepEqual(poses(), sought, 'seeking back reproduces actual GLB transforms');
  assert.throws(() => createAdapter(THREE, viewer, { mode: 'invalid' }), /presentation mode/);
});
