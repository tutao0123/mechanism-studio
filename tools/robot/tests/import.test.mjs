import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PROJECT_ROOT, localPath, PROFILES } from '../build-mjcf.mjs';
import { readGlb, sha256, accessorValues, semanticNodes } from '../../../shared/assets/glb.mjs';
import { validateSceneContract } from '../../../shared/assets/contract.mjs';
import { bindAssembly, applyWorkingPoses, applyDisplayExplosion } from '../../../shared/viewer/scene.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const parser = path.resolve(here, '../parse-mjcf.py');
let python = process.env.MECHANISM_PYTHON;
if (!python) { const candidate = path.join(PROJECT_ROOT, '.tools/cad-python/Scripts/python.exe'); try { await access(candidate); python = candidate; } catch { python = process.platform === 'win32' ? 'python' : 'python3'; } }
const readJson = async file => JSON.parse((await readFile(path.join(PROJECT_ROOT, file), 'utf8')).replace(/^\uFEFF/, ''));
const parseFile = file => spawnSync(python, [parser, file], { encoding: 'utf8', windowsHide: true, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, maxBuffer: 4 * 1024 * 1024 });
const parse = file => { const result = parseFile(path.join(PROJECT_ROOT, file)); assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); };
const fixture = `<mujoco model="fixture"><compiler angle="radian" meshdir="assets" autolimits="true"/><default><default class="robot"><mesh scale=".001 .001 .001"/><joint axis="0 1 0" range="-.2 .8"/><default class="visual"><geom type="mesh" mesh="part"/><default class="tip"><geom pos="0 0 .02"/></default></default><default class="collision"><geom type="box" size=".1 .1 .1"/></default></default></default><asset><mesh file="part.stl"/></asset><worldbody><body name="base" childclass="robot"><geom class="tip"/><body name="child" pos="0 0 .1"><joint name="hinge"/><geom class="visual"/><body name="empty"><geom class="collision"/></body></body></body></worldbody></mujoco>`;
async function parseFixture(xml) {
  const output = path.join(here, 'output'); await mkdir(output, { recursive: true });
  const directory = await mkdtemp(path.join(output, 'parser-'));
  try { const file = path.join(directory, 'input.xml'); await writeFile(file, xml); return parseFile(file); }
  finally { assert.ok(directory.startsWith(output + path.sep)); await rm(directory, { recursive: true }); }
}

test('MJCF nested visual/joint defaults resolve, asset defaults remain outside childclass, empty bodies remain', async () => {
  const result = await parseFixture(fixture); assert.equal(result.status, 0, result.stderr);
  const source = JSON.parse(result.stdout);
  assert.deepEqual(source.meshes[0].scale, [1, 1, 1]);
  assert.deepEqual(source.bodies[0].visuals[0].pos, [0, 0, .02]);
  assert.equal(source.bodies[0].visuals[0].mesh, 'part');
  assert.deepEqual(source.bodies[1].joints[0].axis, [0, 1, 0]);
  assert.deepEqual(source.bodies[1].joints[0].range, [-.2, .8]);
  assert.equal(source.bodies[1].joints[0].limited, true);
  assert.equal(source.bodies[2].parent, 'child'); assert.equal(source.bodies[2].visuals.length, 0);
  assert.equal(source.bodies[2].geoms[0].resolvedAttributes.type, 'box');
});

test('unsupported transforms, external syntax, unknown defaults, invalid numeric geometry and joints fail', async () => {
  for (const changed of [
    fixture.replace('name="base"', 'name="base" euler="0 0 0"'),
    fixture.replace('<asset>', '<include file="external.xml"/><asset>'),
    fixture.replace('class="tip"/>', 'class="missing"/>'),
    fixture.replace('name="hinge"', 'name="hinge" type="ball"'),
    fixture.replace('pos="0 0 .1"', 'pos="0 NaN .1"'),
    fixture.replace('file="part.stl"', 'file="../part.stl"'),
    fixture.replace('file="part.stl"', 'file="part.stl" refpos="0 0 0"'),
    fixture.replace('type="mesh" mesh="part"', 'type="sphere" size=".1"'),
    '<!DOCTYPE x [<!ENTITY a "text">]>' + fixture,
  ]) { const result = await parseFixture(changed); assert.notEqual(result.status, 0, changed); assert.ok(result.stderr.includes('ValueError')); }
});

test('project source/output paths reject escape and unsupported path syntax', async () => {
  for (const name of ['../outside', '/absolute', 'C:/outside', 'examples\\bad', 'https://host/data', 'examples//bad', 'examples/./bad']) await assert.rejects(localPath(name), /project-relative/);
  assert.equal(await localPath('tools/robot/parse-mjcf.py'), parser);
});

const identity = new Matrix4().toArray();
const B = ([x, y, z]) => [x, z, -y];
const rotate = (point, raw) => { const length = Math.hypot(...raw), [w, x, y, z] = raw.map(value => value / length), [px, py, pz] = point;
  const tx = 2 * (y * pz - z * py), ty = 2 * (z * px - x * pz), tz = 2 * (x * py - y * px);
  return [px + w * tx + y * tz - z * ty, py + w * ty + z * tx - x * tz, pz + w * tz + x * ty - y * tx]; };
const near = (actual, expected, epsilon = 2e-7) => actual.forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) <= epsilon, `${value} vs ${expected[axis]}`));

for (const [folder, modelId] of [['allegro-hand', 'allegro-right'], ['robotiq-gripper', 'robotiq-2f85-v4']]) {
  test(`${modelId}: pinned source, resolved declared hierarchy, distinct visual occurrence identity and all triangles survive`, async () => {
    const prefix = `examples/${folder}`, provenance = await readJson(`${prefix}/source/provenance.json`);
    assert.equal(provenance.sha256, PROFILES[modelId].sha256);
    for (const file of provenance.files) { const bytes = await readFile(path.join(PROJECT_ROOT, prefix, 'source', file.localFile)); assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256); }
    const source = parse(`${prefix}/source/${provenance.localFile}`), index = await readJson(`${prefix}/assets/scene-index.json`), contract = await readJson(`${prefix}/assets/scene-contract.json`), report = await readJson(`${prefix}/assets/build-report.json`);
    const bytes = await readFile(path.join(PROJECT_ROOT, prefix, 'assets/assembly.glb')), { json: gltf, buffer } = readGlb(bytes);
    assert.equal(sha256(bytes), index.asset.sha256); assert.equal(report.glbSHA256, index.asset.sha256);
    assert.equal(validateSceneContract(gltf, contract).partCount, PROFILES[modelId].bodyCount);
    const semantic = semanticNodes(gltf), byName = new Map(source.bodies.map(body => [body.name, body]));
    const parents = new Map(); gltf.nodes.forEach((node, parent) => (node.children || []).forEach(child => parents.set(child, parent)));
    const nodeWorld = index => { const local = new Matrix4().fromArray(gltf.nodes[index].matrix); return parents.has(index) ? nodeWorld(parents.get(index)).multiply(local) : local; };
    const sourcePoint = (body, point) => { const local = rotate(point, body.quatWxyz).map((value, axis) => value + body.pos[axis]); return body.parent ? sourcePoint(byName.get(body.parent), local) : local; };
    let triangles = 0, visuals = 0;
    const occurrenceIds = new Set();
    for (const body of source.bodies) {
      const part = index.parts.find(item => item.id === `mjcf:${body.name}`), node = semantic.get(part.id);
      assert.equal(part.parentId, body.parent ? `mjcf:${body.parent}` : null);
      assert.equal(node.mesh, undefined); assert.equal(node.extras.motionOwner, body.joints.length ? 'model' : 'static');
      assert.deepEqual(node.matrix, part.localMatrix);
      near(nodeWorld(gltf.nodes.indexOf(node)).toArray(), part.worldMatrix, 1e-12);
      near(part.worldMatrix.slice(12, 15), B(sourcePoint(body, [0, 0, 0])), 1e-12);
      if (!body.visuals.length) { assert.equal(part.hasGeometry, false); assert.equal(part.displayBinding.ownedBodyNodeIndex, null); continue; }
      const owned = gltf.nodes[part.displayBinding.ownedBodyNodeIndex]; assert.deepEqual(owned.matrix, identity); assert.equal(owned.extras.ownerPartId, part.id);
      const primitive = gltf.meshes[owned.mesh].primitives[0], positions = accessorValues(gltf, buffer, primitive.attributes.POSITION), indices = accessorValues(gltf, buffer, primitive.indices).flat();
      const world = new Matrix4().fromArray(part.worldMatrix); let at = 0;
      for (let i = 0; i < body.visuals.length; i++) {
        const visual = body.visuals[i], record = part.source.visuals[i], mesh = source.meshes.find(item => item.name === visual.mesh);
        assert.equal(record.visualOccurrenceId, `${part.id}/geom:${visual.sourceGeomIndex}`); assert.ok(!occurrenceIds.has(record.visualOccurrenceId)); occurrenceIds.add(record.visualOccurrenceId);
        assert.equal(record.definitionId, `mjcf-mesh:${visual.mesh}`); assert.equal(record.firstIndex, at);
        const raw = await readFile(path.join(PROJECT_ROOT, prefix, 'source/assets', mesh.file));
        const count = raw.readUInt32LE(80); assert.equal(raw.length, 84 + 50 * count); assert.equal(record.triangleCount, count);
        for (let vertex = 0; vertex < count * 3; vertex++) {
          const offset = 84 + Math.floor(vertex / 3) * 50 + 12 + (vertex % 3) * 12;
          const source = [0, 1, 2].map(axis => raw.readFloatLE(offset + axis * 4) * mesh.scale[axis]);
          const local = rotate(source, visual.quatWxyz).map((value, axis) => value + visual.pos[axis]);
          const expected = B(sourcePoint(body, local));
          const actual = new Vector3(...positions[indices[at + vertex]]).applyMatrix4(world).toArray(); near(actual, expected);
        }
        at += count * 3; triangles += count; visuals++;
      }
      assert.equal(indices.length, at);
    }
    assert.equal(visuals, PROFILES[modelId].visualCount); assert.equal(triangles, report.triangleCount);
    assert.equal(report.geometrySimplified, false); assert.equal(report.constraintsSolved, false);
  });
}

test('real source defaults retain Allegro thumb reference mismatch and Robotiq closure evidence without asset rescaling', () => {
  const hand = parse('examples/allegro-hand/source/right_hand.xml');
  const thumb = hand.bodies.find(body => body.name === 'th_base').joints[0];
  assert.equal(thumb.ref, 0); assert.deepEqual(thumb.range, [.263, 1.396]); assert.deepEqual(thumb.axis, [-1, 0, 0]);
  assert.deepEqual(hand.bodies.find(body => body.name === 'ff_tip').visuals[0].pos, [0, 0, .0267]);
  const gripper = parse('examples/robotiq-gripper/source/2f85.xml');
  assert.ok(gripper.meshes.every(mesh => mesh.class === 'main' && mesh.scale.every(value => value === 1)));
  assert.equal(gripper.equalities.filter(item => item.type === 'connect').length, 2);
  assert.equal(gripper.equalities.find(item => item.type === 'joint').sourceAttributes.polycoef, '0 1 0 0 0');
  assert.deepEqual(gripper.bodies.find(body => body.name === 'left_spring_link').joints[0].range, [-.29670597283, .9]);
  assert.equal(gripper.bodies.filter(body => !body.visuals.length).length, 2);
});

test('the real viewer binds all eleven Robotiq identities, including empty pad bodies, independently of nine owned solids', async () => {
  const prefix = 'examples/robotiq-gripper', bytes = await readFile(path.join(PROJECT_ROOT, prefix, 'assets/assembly.glb'));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const contract = await readJson(`${prefix}/assets/scene-contract.json`);
  const bound = bindAssembly(gltf.scene, { contract });
  assert.equal(bound.parts.size, 11); assert.equal(bound.meshes.length, 9);
  for (const side of ['left', 'right']) {
    const pad = bound.parts.get(`mjcf:${side}_pad`), follower = bound.parts.get(`mjcf:${side}_follower`);
    assert.ok(pad && follower); assert.equal(pad.sourceParent, follower.node);
    assert.equal(bound.meshes.some(mesh => mesh.userData.selectionId === pad.id), false);
  }
  const original = new Map([...bound.parts].map(([id, part]) => [id, part.node.matrix.toArray()]));
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), .2);
  applyWorkingPoses(bound.parts, { 'mjcf:left_driver': { position: [0, 0, 0], quaternion: q.toArray(), scale: [1, 1, 1] } });
  applyDisplayExplosion(bound.parts, 1, binding => binding.id === 'mjcf:left_driver' ? [.02, 0, 0] : [0, 0, 0]);
  assert.ok(bound.parts.get('mjcf:left_driver').model.quaternion.angleTo(q) < 1e-7);
  for (const [id, part] of bound.parts) assert.deepEqual(part.node.matrix.toArray(), original.get(id));
  applyWorkingPoses(bound.parts, Object.fromEntries([...bound.parts].map(([id]) => [id, { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] }])));
  applyDisplayExplosion(bound.parts, 0);
  for (const part of bound.parts.values()) { assert.deepEqual(part.display.position.toArray(), [0, 0, 0]); assert.deepEqual(part.model.quaternion.toArray(), [0, 0, 0, 1]); }
});
