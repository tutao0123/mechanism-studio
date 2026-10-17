import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readGlb, semanticNodes, accessorValues } from '../../../shared/assets/glb.mjs';
import { applyWorkingPoses, bindAssembly } from '../../../shared/viewer/scene.mjs';
import { createRobotJointRig, PINNED_SOURCE_SHA256 } from '../joints.mjs';

const root = new URL('../../', import.meta.url);
const json = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const sourceAssembly = await json('assets/source-assembly.json');
const index = await json('planning/scene-index.json');
const urdfBytes = await readFile(new URL('source/simulation/urdf/so_arm_102.urdf', root));
const urdfText = urdfBytes.toString('utf8');
const glbBytes = await readFile(new URL('assets/robot.glb', root));
const { json: gltf, buffer } = readGlb(glbBytes);
const semantic = semanticNodes(gltf);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// Test-only parser for the seven simple source <joint> elements. It reads the
// retained XML, not the derived inspection JSON or the rig's pinned constants.
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
const vector = value => value.trim().split(/\s+/).map(Number);
const nativeJoints = [...urdfText.matchAll(/<joint\s+([^>]+)>([\s\S]*?)<\/joint>/g)].map(([, header, body]) => {
  const get = name => attributes(body.match(new RegExp(`<${name}\\s+([^>]+)\\s*/>`))?.[1] ?? '');
  const joint = attributes(header), origin = get('origin'), limit = get('limit'), mimic = get('mimic');
  return {
    name: joint.name, type: joint.type, parent: get('parent').link, child: get('child').link,
    origin: { xyz: vector(origin.xyz), rpy: vector(origin.rpy) }, axis: vector(get('axis').xyz),
    limit: Object.fromEntries(Object.entries(limit).map(([key, value]) => [key, Number(value)])),
    ...(mimic.joint ? { mimic: { joint: mimic.joint, multiplier: Number(mimic.multiplier), offset: Number(mimic.offset) } } : {}),
  };
});
const rig = createRobotJointRig(sourceAssembly, index);
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const basis = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];
const inverseBasis = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1];
const id = link => `urdf:${link}`;
const multiply = (a, b) => Array.from({ length: 16 }, (_, entry) => {
  const row = entry % 4, column = Math.floor(entry / 4);
  return [0, 1, 2, 3].reduce((sum, k) => sum + a[4 * k + row] * b[4 * column + k], 0);
});
const apply = (matrix, point) => [0, 1, 2].map(row => matrix[row] * point[0] + matrix[4 + row] * point[1] + matrix[8 + row] * point[2] + matrix[12 + row]);
const near = (actual, expected, message = '', epsilon = 3e-13) => {
  assert.equal(actual.length, expected.length, message);
  actual.forEach((value, n) => assert.ok(Math.abs(value - expected[n]) <= epsilon, `${message} [${n}]: ${value} != ${expected[n]}`));
};
const translation = xyz => { const matrix = identity.slice(); matrix.splice(12, 3, ...xyz); return matrix; };

function nativeMotion(joint, q) {
  const magnitude = Math.hypot(...joint.axis), [x, y, z] = joint.axis.map(value => value / magnitude);
  if (joint.type === 'prismatic') return translation([x * q, y * q, z * q]);
  assert.equal(joint.type, 'revolute');
  // Independent Rodrigues formula, returned column-major.
  const c = Math.cos(q), s = Math.sin(q), t = 1 - c;
  return [
    t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0,
    t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0,
    t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0,
    0, 0, 0, 1,
  ];
}

function expectedWorlds(values = {}) {
  const native = new Map([['base_link', identity.slice()]]);
  for (const joint of nativeJoints) {
    assert.deepEqual(joint.origin.rpy, [0, 0, 0], 'Pinned source joint origins have no Euler rotation');
    const q = joint.mimic ? (values[joint.mimic.joint] ?? 0) * joint.mimic.multiplier + joint.mimic.offset : values[joint.name] ?? 0;
    native.set(joint.child, multiply(multiply(native.get(joint.parent), translation(joint.origin.xyz)), nativeMotion(joint, q)));
  }
  return new Map([...native].map(([link, matrix]) => [id(link), multiply(multiply(basis, matrix), inverseBasis)]));
}

function wrapperMatrix({ position: [px, py, pz], quaternion: [x, y, z, w], scale: [sx, sy, sz] }) {
  const x2 = 2 * x, y2 = 2 * y, z2 = 2 * z;
  return [
    (1 - y * y2 - z * z2) * sx, (x * y2 + w * z2) * sx, (x * z2 - w * y2) * sx, 0,
    (x * y2 - w * z2) * sy, (1 - x * x2 - z * z2) * sy, (y * z2 + w * x2) * sy, 0,
    (x * z2 + w * y2) * sz, (y * z2 - w * x2) * sz, (1 - x * x2 - y * y2) * sz, 0,
    px, py, pz, 1,
  ];
}

const poses = [
  {},
  { base_to_link1: .3, link1_to_link2: -.4, link2_to_link3: .6, link3_to_link4: -.35, link4_to_link5: .7, clamp1: .021 },
  { base_to_link1: -.7, link1_to_link2: .35, link2_to_link3: -.4, link3_to_link4: .65, link4_to_link5: -.8, clamp1: .0415 },
  Object.fromEntries(nativeJoints.filter(joint => !joint.mimic).map(joint => [joint.name, joint.limit.lower])),
  Object.fromEntries(nativeJoints.filter(joint => !joint.mimic).map(joint => [joint.name, joint.limit.upper])),
];

test('joint evidence is the actual SHA-pinned native URDF, not an authored axis or fake constraint', () => {
  assert.equal(digest(urdfBytes), PINNED_SOURCE_SHA256);
  assert.equal(nativeJoints.length, 7);
  assert.deepEqual(sourceAssembly.joints, nativeJoints);
  assert.equal(digest(glbBytes), index.asset.sha256);
  assert.equal(rig.jointNames.length, 7);
  assert.equal(nativeJoints.filter(joint => joint.type === 'revolute').length, 5);
  assert.equal(nativeJoints.filter(joint => joint.type === 'prismatic').length, 2);
});

test('working wrapper before immutable GLB rest J reproduces the complete nested source chain', () => {
  const unchangedSource = JSON.stringify(sourceAssembly), unchangedIndex = JSON.stringify(index), unchangedGlb = JSON.stringify(gltf);
  for (const q of poses) {
    const actual = rig.worldMatricesAt(q), expected = expectedWorlds(q), wrappers = rig.posesAt(q);
    assert.equal(actual.size, 8); assert.equal(wrappers.size, 7);
    assert.equal(wrappers.has('urdf:base_link'), false, 'The anchored base gains no working owner');
    const applied = new Map();
    for (const part of index.parts) {
      const sourceNode = semantic.get(part.id), wrapper = wrappers.get(part.id);
      const effectiveLocal = wrapper ? multiply(wrapperMatrix(wrapper), sourceNode.matrix) : sourceNode.matrix;
      const effectiveWorld = part.parentId ? multiply(applied.get(part.parentId), effectiveLocal) : effectiveLocal;
      applied.set(part.id, effectiveWorld);
      near(actual.get(part.id), expected.get(part.id), `${part.id} native FK`);
      near(effectiveWorld, expected.get(part.id), `${part.id} actual nested wrapper × GLB rest`);
      if (wrapper) {
        near(wrapper.scale, [1, 1, 1], `${part.id} rigid scale`);
        assert.ok(Math.abs(Math.hypot(...wrapper.quaternion) - 1) < 1e-14, 'Working quaternion stays normalized');
      }
    }
  }
  assert.equal(JSON.stringify(sourceAssembly), unchangedSource);
  assert.equal(JSON.stringify(index), unchangedIndex);
  assert.equal(JSON.stringify(gltf), unchangedGlb);
});

test('the actual viewer adapter applies joint Maps to working wrappers and resets the real GLB tree', async () => {
  const arrayBuffer = glbBytes.buffer.slice(glbBytes.byteOffset, glbBytes.byteOffset + glbBytes.byteLength);
  const loaded = await new GLTFLoader().parseAsync(arrayBuffer, '');
  const contract = await json('assets/scene-contract.json');
  const assembly = bindAssembly(loaded.scene, { contract });
  assert.equal(assembly.parts.size, 8);
  const rest = new Map([...assembly.parts].map(([partId, binding]) => [partId, {
    matrix: binding.node.matrix.toArray(), position: binding.node.position.toArray(),
    quaternion: binding.node.quaternion.toArray(), scale: binding.node.scale.toArray(),
    identity: JSON.stringify(binding.node.userData),
  }]));
  const q = poses[1], expected = expectedWorlds(q);
  // The actual shared viewer accepts an object, so this adapter is required.
  applyWorkingPoses(assembly.parts, Object.fromEntries(rig.posesAt(q)), { target: 'model' });
  loaded.scene.updateWorldMatrix(true, true);
  for (const [partId, binding] of assembly.parts) {
    near(binding.node.matrixWorld.toArray(), expected.get(partId), `${partId} bound viewer native FK`);
    assert.deepEqual(binding.node.matrix.toArray(), rest.get(partId).matrix, `${partId} immutable source matrix`);
    assert.deepEqual(binding.node.position.toArray(), rest.get(partId).position);
    assert.deepEqual(binding.node.quaternion.toArray(), rest.get(partId).quaternion);
    assert.deepEqual(binding.node.scale.toArray(), rest.get(partId).scale);
    assert.equal(JSON.stringify(binding.node.userData), rest.get(partId).identity, 'Part identity and static source ownership are retained');
    assert.deepEqual(binding.display.matrix.toArray(), identity, 'Working motion never becomes an editorial explosion');
    if (partId === 'urdf:base_link') assert.deepEqual(binding.model.matrix.toArray(), identity, 'The source base stays anchored');
    else assert.notDeepEqual(binding.model.matrix.toArray(), identity, `${partId} really received a nonzero working pose`);
  }
  applyWorkingPoses(assembly.parts, Object.fromEntries(rig.posesAt()), { target: 'model' });
  loaded.scene.updateWorldMatrix(true, true);
  for (const part of index.parts) {
    const binding = assembly.parts.get(part.id);
    near(binding.model.matrix.toArray(), identity, `${part.id} working wrapper resets`);
    assert.deepEqual(binding.node.matrix.toArray(), rest.get(part.id).matrix);
    near(binding.node.matrixWorld.toArray(), part.worldMatrix, `${part.id} actual source world pose restores`);
  }
});

test('clamp2 is always the source mimic and the jaws move in opposite native directions', () => {
  for (const opening of [0, .012, .0415]) {
    const resolved = rig.resolvedValuesAt({ clamp1: opening });
    assert.equal(resolved.clamp2, -resolved.clamp1);
    const explicitlyConsistent = rig.posesAt({ clamp1: opening, clamp2: -opening });
    assert.deepEqual(explicitlyConsistent, rig.posesAt({ clamp1: opening }));
    const worlds = rig.worldMatricesAt({ clamp1: opening });
    const zero = rig.worldMatricesAt();
    for (const link of ['clamp1_1', 'clamp2_1']) {
      const actual = [12, 13, 14].map(n => worlds.get(id(link))[n] - zero.get(id(link))[n]);
      const joint = nativeJoints.find(item => item.child === link);
      const q = link === 'clamp1_1' ? opening : -opening;
      const expected = apply(basis, joint.axis.map(v => v / Math.hypot(...joint.axis) * q));
      near(actual, expected, `${link} prismatic displacement`);
    }
  }
  assert.throws(() => rig.posesAt({ clamp2: -.01 }), /mimic/);
  assert.throws(() => rig.posesAt({ clamp1: .01, clamp2: .01 }), /mimic/);
});

test('zero, reset and query order are absolute and cannot accumulate source or output mutations', () => {
  const zero = rig.posesAt(), worlds = rig.worldMatricesAt(), bounds = rig.boundsAt();
  for (const pose of zero.values()) {
    assert.deepEqual(pose.position, [0, 0, 0]);
    assert.deepEqual(pose.quaternion, [0, 0, 0, 1]);
    assert.deepEqual(pose.scale, [1, 1, 1]);
  }
  for (const part of index.parts) near(worlds.get(part.id), part.worldMatrix, `${part.id} original zero pose`);
  const q = poses[1], first = rig.posesAt(q), firstWorlds = rig.worldMatricesAt(q), firstBounds = rig.boundsAt(q);
  for (const other of [...poses].reverse()) { rig.posesAt(other); rig.worldMatricesAt(other); rig.boundsAt(other); }
  assert.deepEqual(rig.posesAt(q), first); assert.deepEqual(rig.worldMatricesAt(q), firstWorlds); assert.deepEqual(rig.boundsAt(q), firstBounds);
  assert.deepEqual(rig.posesAt(), zero); assert.deepEqual(rig.worldMatricesAt(), worlds); assert.deepEqual(rig.boundsAt(), bounds);
  first.get('urdf:link1_1').position[0] = 100;
  firstWorlds.get('urdf:link1_1')[12] = 100;
  firstBounds.get('urdf:link1_1').min[0] = 100;
  assert.notEqual(rig.posesAt(q).get('urdf:link1_1').position[0], 100);
  assert.notEqual(rig.worldMatricesAt(q).get('urdf:link1_1')[12], 100);
  assert.notEqual(rig.boundsAt(q).get('urdf:link1_1').min[0], 100);
});

test('source limits reject authored overshoot, non-finite, unknown and ambiguous inputs', () => {
  for (const joint of nativeJoints.filter(item => !item.mimic)) {
    assert.throws(() => rig.posesAt({ [joint.name]: joint.limit.lower - 1e-7 }), /outside source limits/);
    assert.throws(() => rig.posesAt({ [joint.name]: joint.limit.upper + 1e-7 }), /outside source limits/);
    for (const bad of [NaN, Infinity, -Infinity, '0', null]) assert.throws(() => rig.posesAt({ [joint.name]: bad }), /finite/);
  }
  for (const bad of [null, [], new Map(), new Date(), Object.create({ base_to_link1: .2 })]) assert.throws(() => rig.posesAt(bad), /plain object/);
  assert.throws(() => rig.posesAt({ invented_hinge: .1 }), /Unknown source joint/);
  assert.throws(() => rig.posesAt({ [Symbol('joint')]: 0 }), /Unknown source joint/);
  assert.throws(() => rig.posesAt({ clamp1: 0, clamp2: -.01 }), /mimic/);
  assert.equal(rig.resolvedValuesAt({ clamp1: .0415 + 5e-13 }).clamp1, .0415, 'Only floating-point noise at a source bound is clamped');
  assert.equal(rig.resolvedValuesAt({ clamp1: -5e-13 }).clamp1, 0);
  assert.deepEqual(rig.posesAt(Object.create(null)), rig.posesAt({}));
});

test('source identity, parent wiring, units, rest placement and pinned motion fields are validated', () => {
  const cases = [
    [source => { source.sourceSHA256 = 'wrong'; }, null, /pinned SO-ARM/],
    [null, scene => { scene.source.revision = 'wrong'; }, /revision/],
    [source => { source.sourceUnits.length = 'mm'; }, null, /metre/],
    [null, scene => { scene.coordinateBasis = 'Z up'; }, /basis/],
    [source => { source.joints[0].axis[2] = 1; }, null, /Pinned URDF joint/],
    [source => { source.joints[6].mimic.multiplier = 1; }, null, /Pinned URDF joint/],
    [source => { source.sourceWorldMatrices.link2_1[12] += .001; }, null, /native source world/],
    [null, scene => { scene.parts[2].parentId = 'urdf:base_link'; }, /identity\/parent/],
    [null, scene => { scene.parts[2].localMatrix[12] += .001; }, /local.*rest matrix/],
    [null, scene => { scene.parts[2].worldMatrix[12] += .001; }, /world.*rest matrix/],
    [null, scene => { scene.parts[2].zeroPose = false; }, /original zero/],
    [null, scene => { scene.parts[2].localBounds.min[0] = NaN; }, /Finite ordered/],
    [null, scene => { scene.parts[2].localBounds.max[0] = -10; }, /Finite ordered/],
  ];
  for (const [changeSource, changeIndex, pattern] of cases) {
    const source = structuredClone(sourceAssembly), scene = structuredClone(index);
    changeSource?.(source); changeIndex?.(scene);
    assert.throws(() => createRobotJointRig(source, scene), pattern);
  }
});

test('posed bounds enclose every real GLB vertex under independently evaluated native FK', () => {
  const geometry = new Map(); let vertexCount = 0;
  for (const part of index.parts) {
    const node = semantic.get(part.id);
    const body = (node.children ?? []).map(n => gltf.nodes[n]).find(child => child.extras?.ownerPartId === part.id);
    assert.ok(body); assert.deepEqual(body.matrix, identity);
    const points = gltf.meshes[body.mesh].primitives.flatMap(primitive => accessorValues(gltf, buffer, primitive.attributes.POSITION));
    geometry.set(part.id, points); vertexCount += points.length;
  }
  assert.equal(vertexCount, 62064 * 3, 'Every retained source triangle vertex participates');
  for (const q of poses) {
    const worlds = expectedWorlds(q), bounds = rig.boundsAt(q);
    for (const part of index.parts) {
      const box = bounds.get(part.id), matrix = worlds.get(part.id);
      assert.ok(box.min.every((v, axis) => Number.isFinite(v) && v <= box.max[axis]));
      for (const point of geometry.get(part.id)) {
        const world = apply(matrix, point);
        for (let axis = 0; axis < 3; axis++) assert.ok(world[axis] >= box.min[axis] - 3e-13 && world[axis] <= box.max[axis] + 3e-13, `${part.id} actual vertex outside conservative bounds on axis ${axis}`);
      }
    }
  }
  assert.match(rig.boundsMethod, /Conservative.*eight corners.*not collision/);
});
