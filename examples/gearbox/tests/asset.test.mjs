import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readGlb, sha256, positionArrays } from '../../../shared/assets/glb.mjs';
import { validateSceneContract } from '../../../shared/assets/contract.mjs';
import { lathe, ringExtrude, gearOutline, circleLike, sphere, extrudePolygon, stadium } from '../geometry.mjs';
import { TEETH, BEARINGS, AXES, tipRadius, rootRadius, bearingGeometry, SYNCHROS } from '../spec.mjs';
import { createGearboxStory } from '../story.mjs';

const read = path => readFile(new URL(path, import.meta.url));
const glbBytes = await read('../assets/gearbox.glb');
const { json: gltf, buffer } = readGlb(glbBytes);
const contract = JSON.parse(await read('../assets/scene-contract.json'));
const index = JSON.parse(await read('../assets/scene-index.json'));
const report = JSON.parse(await read('../assets/build-report.json'));

/** Every triangle's geometric normal must agree with its vertex normals,
 * otherwise front-face rendering drops it. Returns the worst agreement. */
function windingAgreement(builder) {
  const P = builder.positions, N = builder.normals, I = builder.indices; let worst = 1;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]], v = i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
    const u = v(b).map((x, k) => x - v(a)[k]), w = v(c).map((x, k) => x - v(a)[k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], length = Math.hypot(...n);
    const s = [0, 1, 2].map(k => N[a * 3 + k] + N[b * 3 + k] + N[c * 3 + k]);
    worst = Math.min(worst, (n[0] * s[0] + n[1] * s[1] + n[2] * s[2]) / (length * Math.hypot(...s)));
  }
  return worst;
}

test('primitives are closed outward-facing solids', () => {
  const outline = gearOutline(17);
  for (const [name, builder] of [
    ['lathe', lathe([[0, .01], [.02, .01], [.02, .03], [0, .03]])], ['gear', ringExtrude(outline, circleLike(outline, .01), -.01, .01)],
    ['sphere', sphere(.005)], ['plate', extrudePolygon(stadium(.04, .09).map(({ point }) => point), 0, .01)],
  ]) assert.ok(windingAgreement(builder) > 0, `${name} triangles face their normals`);
  // A ball's every face points away from its centre.
  const ball = sphere(.01), P = ball.positions, I = ball.indices;
  for (let t = 0; t < I.length; t += 3) {
    const centre = [0, 1, 2].map(k => (P[I[t] * 3 + k] + P[I[t + 1] * 3 + k] + P[I[t + 2] * 3 + k]) / 3);
    const u = [0, 1, 2].map(k => P[I[t + 1] * 3 + k] - P[I[t] * 3 + k]), w = [0, 1, 2].map(k => P[I[t + 2] * 3 + k] - P[I[t] * 3 + k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    assert.ok(n[0] * centre[0] + n[1] * centre[1] + n[2] * centre[2] > 0);
  }
});

test('the GLB, contract and index agree and stay reproducible', () => {
  const { partCount } = validateSceneContract(gltf, contract);
  assert.equal(partCount, index.parts.length); assert.equal(partCount, report.partCount);
  assert.equal(index.asset.sha256, sha256(glbBytes)); assert.equal(report.glbSHA256, index.asset.sha256);
  assert.equal(index.geometryRevision, contract.assetRevision); assert.equal(gltf.extras.geometryRevision, index.geometryRevision);
  assert.ok(index.parts.length >= 120, 'a structurally deep example');
  assert.ok(report.maximumAssemblyDepth >= 3, 'synchronizers and bearings nest inside shaft assemblies');
  const ids = new Set([...index.parts, ...index.assemblies].map(record => record.id));
  assert.equal(ids.size, index.parts.length + index.assemblies.length);
  for (const record of [...index.parts, ...index.assemblies]) if (record.parentId) assert.ok(ids.has(record.parentId), record.id);
  for (const part of contract.parts) assert.equal(gltf.nodes.find(node => node.extras?.part_id === part.part_id).extras.motionOwner, part.motionOwner);
});

test('repeated occurrences share one definition and mesh', () => {
  const byDefinition = new Map();
  for (const node of gltf.nodes.filter(n => n.extras?.part_id)) {
    const list = byDefinition.get(node.extras.definitionId) ?? []; list.push(node); byDefinition.set(node.extras.definitionId, list);
  }
  for (const [key, bearing] of Object.entries(BEARINGS)) {
    const balls = byDefinition.get(`gb-def:ball-${key}`);
    assert.equal(balls.length, bearing.balls, key);
    assert.equal(new Set(balls.map(node => node.mesh)).size, 1, `${key} balls share one mesh`);
  }
  assert.equal(byDefinition.get('gb-def:bolt-front').length, 10);
  assert.equal(byDefinition.get('gb-def:end-plate').length, 2);
  assert.equal(gltf.meshes.length, report.definitionCount);
});

const parts = new Map(index.parts.map(part => [part.id, part]));
/** Largest distance from the shaft axis over the delivered GLB vertices. */
const radialExtent = id => {
  const node = gltf.nodes.find(n => n.extras?.part_id === id);
  return Math.max(...positionArrays(gltf, buffer, node).flatMap(({ values }) => values.map(([, y, z]) => Math.hypot(y, z))));
};
test('gear and bearing geometry matches the authored specification', () => {
  const gears = { 'gb:main/gear-1': 'main1', 'gb:main/gear-2': 'main2', 'gb:main/gear-3': 'main3', 'gb:main/gear-5': 'main5', 'gb:main/gear-r': 'mainR',
    'gb:counter/gear-drive': 'counterDrive', 'gb:counter/gear-1': 'counter1', 'gb:counter/gear-5': 'counter5', 'gb:counter/gear-r': 'counterR', 'gb:idler/gear': 'idler' };
  for (const [id, key] of Object.entries(gears)) {
    const extent = radialExtent(id);
    assert.ok(Math.abs(extent - tipRadius(TEETH[key])) < 1e-6, `${id} tip radius ${extent}`);
  }
  for (const [key, bearing] of Object.entries(BEARINGS)) {
    const g = bearingGeometry(bearing), asm = key.startsWith('counter') ? 'counter' : key === 'input' ? 'input' : 'main';
    const ball = parts.get(`gb:${asm}/bearing-${key}/ball-1`);
    assert.ok(Math.abs(Math.hypot(ball.localMatrix[13], ball.localMatrix[14]) - g.pitch) < 1e-12, `${key} ball on pitch circle`);
    assert.ok(g.innerRace < g.pitch - g.ball / 2 + g.ball * .2 && g.outerRace > g.pitch + g.ball / 2 - g.ball * .2, `${key} races hold the balls`);
  }
  const counter = index.assemblies.find(a => a.id === 'gb-asm:counter'), idler = index.assemblies.find(a => a.id === 'gb-asm:idler');
  assert.deepEqual([counter.worldMatrix[13], counter.worldMatrix[14]], [...AXES.counter]);
  assert.deepEqual([idler.worldMatrix[13], idler.worldMatrix[14]], [...AXES.idler]);
  for (const synchro of Object.values(SYNCHROS)) assert.ok(rootRadius(TEETH[{ s34: 'main3', s12: 'main1', s5r: 'main5' }[synchro.id]]) > 0.016 + .002, `${synchro.id} gears clear the shaft`);
});

test('every moving part receives a complete unit-quaternion working pose; static parts none', () => {
  const story = createGearboxStory(index), moving = index.parts.filter(part => part.role !== 'static').map(part => part.id).sort();
  for (const t of [0, 15, 24.7, 33.3, 39.99]) {
    const poses = story.workingPoses(story.stateAt(t));
    assert.deepEqual(Object.keys(poses).sort(), moving);
    for (const [id, pose] of Object.entries(poses)) {
      assert.ok(Math.abs(Math.hypot(...pose.quaternion) - 1) < 1e-9, id);
      assert.ok(pose.position.every(Number.isFinite), id);
    }
  }
  // A ball's pose rotates it about the shaft axis: its distance to the axis holds.
  const story2 = createGearboxStory(index), pose = story2.workingPoses(story2.stateAt(25))['gb:main/bearing-rear/ball-3'];
  const ball = parts.get('gb:main/bearing-rear/ball-3'), [qx, , , qw] = pose.quaternion;
  assert.ok(Math.abs(qx * qx + qw * qw - 1) < 1e-12, 'rotation purely about the shaft (X) axis');
  assert.equal(Math.hypot(ball.localMatrix[13], ball.localMatrix[14]) > 0, true);
});
