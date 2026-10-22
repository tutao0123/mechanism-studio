import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Scene, Group, Vector3 } from 'three';
import { bindAssembly, applyWorkingPoses, applyDisplayExplosion } from '../../../shared/viewer/scene.mjs';
import { createPlanetaryRig } from '../kinematics.mjs';
import { createPlanetaryPresentation } from '../presentation.mjs';
import { createBearingCues } from '../bearing-cues.mjs';
import { PARTS, ROOT_ID, SUPPORT_BEARINGS } from '../spec.mjs';

const index = JSON.parse(await readFile(new URL('../assets/scene-index.json', import.meta.url), 'utf8'));
const rig = createPlanetaryRig(index), presentation = createPlanetaryPresentation(index);
const cueIds = [
  ...Array.from({ length: 10 }, (_, i) => `pg:support-bearing-front-ball-${i + 1}`),
  'pg:support-bearing-front-inner', 'pg:support-bearing-front-cage',
];
const near = (a, b, epsilon = 1e-11) => assert.ok(Math.abs(a - b) < epsilon, `${a} vs ${b}`);
const nearArray = (a, b, epsilon = 1e-11) => a.forEach((value, i) => near(value, b[i], epsilon));
const semanticIds = scene => {
  const ids = [];
  scene.traverse(node => { if (node.userData.part_id) ids.push(node.userData.part_id); });
  return ids.sort();
};

function fixture() {
  const scene = new Scene(), assembly = new Group();
  assembly.userData.assembly_id = ROOT_ID;
  // A nontrivial assembly placement makes a local/model-only cue copy fail.
  assembly.position.set(.013, -.007, .021);
  assembly.rotation.set(.13, -.21, .08);
  scene.add(assembly);
  for (const part of PARTS) {
    const node = new Group(); node.userData.part_id = part.id;
    node.position.fromArray(part.translation); assembly.add(node);
  }
  const { parts } = bindAssembly(assembly), viewer = { scene, parts };
  const layer = createBearingCues({ viewer });
  const groupFor = id => scene.getObjectByName(`${id}/orientation-ink`);
  const update = (angle, weight = 1, manualCamera = false, time = 0) => {
    applyWorkingPoses(parts, rig.workingPoses({ sunAngle: angle }));
    applyDisplayExplosion(parts, 1, part => part.id.startsWith('pg:support-bearing-front-') ? [.005, -.003, .14] : [0, 0, 0]);
    layer.update({ state: { time, progress: { 'bearing-roll': weight } }, manualCamera });
    scene.updateMatrixWorld(true);
  };
  return { scene, assembly, parts, layer, groupFor, update };
}

test('orientation cues follow each actual occurrence through source placement, explosion, orbit and material spin', () => {
  const f = fixture();
  try {
    for (const angle of [0, .37, 2.8, -1.4, .37]) {
      f.update(angle);
      for (const id of cueIds) {
        const group = f.groupFor(id), source = f.parts.get(id).node;
        assert.ok(group.visible, id);
        nearArray(group.matrixWorld.elements, source.matrixWorld.elements);
        // A material-space ink vertex must follow the ball/race itself, not
        // just the orbiting centre or a second independently computed spin.
        const ink = group.children.find(child => child.isLine);
        const point = new Vector3().fromBufferAttribute(ink.geometry.attributes.position, 19 % ink.geometry.attributes.position.count);
        const expected = point.clone().applyMatrix4(source.matrixWorld);
        const actual = point.clone().applyMatrix4(ink.matrixWorld);
        nearArray(actual.toArray(), expected.toArray());
      }
      const ball = f.groupFor('pg:support-bearing-front-ball-3');
      const worldDirection = new Vector3(1, 0, 0).transformDirection(ball.matrixWorld);
      const expectedSpin = rig.motionState(angle).bearings.front.ballSpinAngle;
      const expectedDirection = new Vector3(Math.cos(expectedSpin), Math.sin(expectedSpin), 0).transformDirection(f.assembly.matrixWorld);
      nearArray(worldDirection.toArray(), expectedDirection.toArray());
    }
  } finally { f.layer.dispose(); }
});

test('cue creation, seek updates and disposal preserve all source identities, rest transforms and mechanical scales', () => {
  const originalIndex = JSON.stringify(index), f = fixture();
  try {
    assert.deepEqual(semanticIds(f.scene), PARTS.map(part => part.id).sort());
    assert.equal(f.parts.size, 80);
    for (const angle of [.5, 17.4, -8, 0]) {
      f.update(angle);
      for (const part of PARTS) {
        const binding = f.parts.get(part.id);
        nearArray(binding.node.position.toArray(), part.translation);
        nearArray(binding.node.quaternion.toArray(), [0, 0, 0, 1]);
        for (const object of [binding.node, binding.model, binding.display]) nearArray(object.scale.toArray(), [1, 1, 1]);
      }
      assert.deepEqual(semanticIds(f.scene), PARTS.map(part => part.id).sort());
    }
  } finally { f.layer.dispose(); }
  assert.deepEqual(semanticIds(f.scene), PARTS.map(part => part.id).sort());
  assert.equal(JSON.stringify(index), originalIndex);
});

test('ink appears only in the authored rolling window and hides during manual exploration', () => {
  const f = fixture();
  try {
    for (const time of [0, 12, 21.5, 24, 25.3, 26.2, 27.7, 28.5, 35.9]) {
      const state = presentation.timeline.stateAt(time), weight = state.progress['bearing-roll'];
      f.layer.update({ state, manualCamera: false });
      for (const id of cueIds) {
        const group = f.groupFor(id);
        assert.equal(group.visible, weight > 1e-5, `${id} at ${time}`);
        for (const child of group.children) near(child.material.opacity, .72 * weight);
      }
      f.layer.update({ state, manualCamera: true });
      for (const id of cueIds) assert.equal(f.groupFor(id).visible, false);
    }
    f.layer.update({ state: { progress: {} }, manualCamera: false });
    for (const id of cueIds) assert.equal(f.groupFor(id).visible, false);
  } finally { f.layer.dispose(); }
});

test('ball ink stays just above its real sphere with depth-tested, nonselectable surface marks', () => {
  const f = fixture(), radius = SUPPORT_BEARINGS.front.ballRadius;
  try {
    for (const id of cueIds.filter(id => id.includes('-ball-'))) {
      const group = f.groupFor(id), line = group.children.find(child => child.isLine), dot = group.children.find(child => child.isMesh);
      assert.ok(line && dot);
      const P = line.geometry.attributes.position;
      for (let i = 0; i < P.count; i++) {
        const distance = Math.hypot(P.getX(i), P.getY(i), P.getZ(i));
        assert.ok(distance > radius * 1.001 && distance < radius * 1.02, `${id} uses a small surface offset`);
      }
      assert.ok(dot.position.length() > radius && dot.position.length() < radius * 1.02);
      dot.geometry.computeBoundingSphere();
      assert.ok(dot.geometry.boundingSphere.radius < radius * .1, 'Orientation dot does not replace the ball shape');
      for (const child of group.children) {
        assert.equal(child.material.depthTest, true);
        assert.equal(child.material.depthWrite, false);
        const hits = []; child.raycast({}, hits);
        assert.equal(hits.length, 0, 'Presentation ink cannot steal a source part pick');
      }
    }
  } finally { f.layer.dispose(); }
});

test('seeking is clock-free and deterministic, and disposal releases every owned GPU resource', () => {
  const f = fixture(), originalNow = Date.now;
  const timers = new Map(['setTimeout', 'setInterval', 'requestAnimationFrame'].map(key => [key, globalThis[key]]));
  try {
    Date.now = () => { throw new Error('Cue motion must use the supplied state, not the wall clock'); };
    for (const key of timers.keys()) globalThis[key] = () => { throw new Error('Cue layer must not start an independent timer'); };
    f.update(.713, .6, false, 26);
    const first = cueIds.map(id => ({ matrix: [...f.groupFor(id).matrix.elements], visible: f.groupFor(id).visible,
      opacity: f.groupFor(id).children[0].material.opacity }));
    f.update(-10, 1, false, 1e9); f.update(48, 0, true, -300);
    f.update(.713, .6, false, 26);
    const repeated = cueIds.map(id => ({ matrix: [...f.groupFor(id).matrix.elements], visible: f.groupFor(id).visible,
      opacity: f.groupFor(id).children[0].material.opacity }));
    assert.deepEqual(repeated, first);
  } finally {
    Date.now = originalNow;
    for (const [key, value] of timers) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
  const resources = new Set();
  for (const id of cueIds) f.groupFor(id).traverse(node => {
    if (node.geometry) resources.add(node.geometry);
    if (node.material) resources.add(node.material);
  });
  const disposed = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
  f.layer.dispose();
  assert.ok(resources.size > cueIds.length);
  for (const count of disposed.values()) assert.equal(count, 1);
  for (const id of cueIds) assert.equal(f.groupFor(id), undefined);
  assert.deepEqual(semanticIds(f.scene), PARTS.map(part => part.id).sort());
});
