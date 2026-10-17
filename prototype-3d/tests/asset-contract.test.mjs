import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SPEC, KEY_PROFILES, keyOutline } from '../../model.mjs';
import { readGlb, positionArrays as sharedPositionArrays, boundsOf, semanticNodes } from '../../shared/assets/glb.mjs';
import { validateSceneContract } from '../../shared/assets/contract.mjs';

const EPSILON = 1e-7; // 0.0001 illustrative millimetres after metre conversion.
const directory = new URL('../', import.meta.url);
const [binary, specBytes, manifestBytes] = await Promise.all([
  readFile(new URL('assets/lock.glb', directory)),
  readFile(new URL('spec.json', directory)),
  readFile(new URL('assets/asset-manifest.json', directory)),
]);
const parseJson = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const exportedSpec = parseJson(specBytes);
const manifest = parseJson(manifestBytes);

const { json: gltf, buffer } = readGlb(binary);
const nodes = semanticNodes(gltf);
const manifestParts = new Map(manifest.parts.map(part => [part.part_id, part]));
const expectedIds = [
  'shell-back', 'shell-front', 'plug-back', 'plug-front',
  ...Array.from({ length: 5 }, (_, i) => [`lower-${i + 1}`, `driver-${i + 1}`, `spring-${i + 1}`]).flat(),
  ...KEY_PROFILES.map(key => `key-${key.id}`), 'cam', 'base',
];
const sort = values => [...values].sort();

function close(actual, expected, message) {
  assert.ok(Number.isFinite(actual), `${message}: finite value`);
  assert.ok(Math.abs(actual - expected) <= EPSILON,
    `${message}: ${actual} should be ${expected} (tolerance ${EPSILON})`);
}

function vectorClose(actual, expected, message) {
  assert.equal(actual.length, expected.length, `${message}: vector length`);
  actual.forEach((value, i) => close(value, expected[i], `${message}[${i}]`));
}

const positionArrays = node => sharedPositionArrays(gltf, buffer, node);

const actualPositions = new Map(expectedIds.map(id => [id, positionArrays(nodes.get(id)).flatMap(({ values }) => values)]));
const actualBounds = new Map([...actualPositions].map(([id, positions]) => [id, boundsOf(positions)]));

test('actual GLB preserves the 24 semantic top-level part identities and neutral transforms', () => {
  validateSceneContract(gltf, {assetUnits:manifest.assetUnits, parts:manifest.parts.map(p=>({...p,motionOwner:p.motionOwner==='web-model'?'model':p.motionOwner,parent_id:null,rest:{translation:p.restGltfMeters}}))}, {checkOwnersInAsset:false});
  assert.equal(gltf.asset.version, '2.0');
  assert.equal(gltf.nodes.length, 24);
  assert.equal(nodes.size, 24, 'IDs are unique');
  assert.deepEqual(sort(nodes.keys()), sort(expectedIds));
  assert.deepEqual(sort(manifestParts.keys()), sort(expectedIds));
  assert.equal(manifest.parts.length, 24, 'manifest IDs are unique');
  const parented = new Set(gltf.nodes.flatMap(node => node.children ?? []));
  const scene = gltf.scenes[gltf.scene ?? 0];
  assert.deepEqual(sort(scene.nodes), sort(gltf.nodes.map((_, i) => i)), 'default scene exposes all top-level parts');
  assert.equal(parented.size, 0, 'no baked parent hierarchy changes wrapper ownership');
  assert.equal(gltf.animations?.length ?? 0, 0, 'the web model owns motion');
  for (const [id, node] of nodes) {
    assert.equal(node.name, id, 'node name agrees with stable ID');
    assert.equal(node.matrix, undefined, `${id}: neutral TRS is explicit`);
    vectorClose(node.rotation ?? [0, 0, 0, 1], [0, 0, 0, 1], `${id}: rotation`);
    vectorClose(node.scale ?? [1, 1, 1], [1, 1, 1], `${id}: scale`);
    const station = /^(?:lower|driver|spring)-(\d+)$/.exec(id);
    const expectedTranslation = station ? [SPEC.pinXs[Number(station[1]) - 1] * .001, 0, 0]
      : /^(?:plug-|key-)|^cam$/.test(id) ? [0, SPEC.plugAxisZ * .001, 0] : [0, 0, 0];
    vectorClose(node.translation ?? [0, 0, 0], expectedTranslation, `${id}: rest origin`);
    vectorClose(manifestParts.get(id).restGltfMeters, expectedTranslation, `${id}: manifest origin`);
  }
});

test('asset units and source hash identify the unchanged shared teaching model', () => {
  assert.equal(exportedSpec.units, 'illustrative-mm');
  assert.equal(exportedSpec.metersPerUnit, .001);
  assert.deepEqual(exportedSpec.spec, SPEC);
  assert.deepEqual(exportedSpec.keys.map(key => ({ id: key.id, outline: key.outline })),
    KEY_PROFILES.map(key => ({ id: key.id, outline: keyOutline(key.id) })));
  assert.equal(manifest.assetUnits, 'meters');
  assert.equal(manifest.sourceUnits, exportedSpec.units);
  assert.equal(manifest.metersPerSourceUnit, exportedSpec.metersPerUnit);
  assert.equal(manifest.sourceSpecSha256, createHash('sha256').update(specBytes).digest('hex'));
  assert.equal(gltf.buffers.length, 1, 'asset has one self-contained buffer');
  assert.equal(gltf.buffers[0].uri, undefined, 'no external geometry dependency');
  assert.ok(buffer.length >= gltf.buffers[0].byteLength && buffer.length - gltf.buffers[0].byteLength < 4,
    'embedded bytes cover declared buffer, with only GLB padding');
});

test('POSITION accessor and manifest bounds agree with actual binary geometry', () => {
  for (const [id, node] of nodes) {
    for (const { accessor, values } of positionArrays(node)) {
      const bounds = boundsOf(values);
      vectorClose(accessor.min, bounds.min, `${id}: accessor min`);
      vectorClose(accessor.max, bounds.max, `${id}: accessor max`);
    }
    const bounds = actualBounds.get(id);
    vectorClose(manifestParts.get(id).localBoundsGltfMeters.min, bounds.min, `${id}: manifest min`);
    vectorClose(manifestParts.get(id).localBoundsGltfMeters.max, bounds.max, `${id}: manifest max`);
  }
});

test('actual lower and driver pin meshes keep model-driven bottom and length contracts', () => {
  for (let i = 1; i <= 5; i++) {
    for (const [role, height] of [['lower', SPEC.pinLengths[i - 1]], ['driver', SPEC.driverLength]]) {
      const bounds = actualBounds.get(`${role}-${i}`);
      close(bounds.min[1], 0, `${role}-${i}: bottom`);
      close(bounds.max[1], height * .001, `${role}-${i}: top`);
      close(bounds.max[1] - bounds.min[1], height * .001, `${role}-${i}: height`);
    }
  }
});

test('actual shell and plug halves retain the cutaway plane after attached details are joined', () => {
  const splitTolerance = 1e-6;
  for (const role of ['shell', 'plug']) {
    const back = actualBounds.get(`${role}-back`);
    const front = actualBounds.get(`${role}-front`);
    // Blender Y is negated into glTF Z. Fixtures must be cut with their owner,
    // rather than leaving an uncut front-facing solid in the visible back half.
    assert.ok(back.max[2] <= splitTolerance, `${role}-back: all actual vertices have glTF Z <= 0`);
    assert.ok(front.min[2] >= -splitTolerance, `${role}-front: all actual vertices have glTF Z >= 0`);
    assert.ok(back.min[2] < -splitTolerance && front.max[2] > splitTolerance,
      `${role}: both halves contain nonzero-depth geometry`);
  }
});

test('actual spring meshes retain canonical glTF Y height for runtime compression', () => {
  for (let i = 1; i <= 5; i++) {
    const bounds = actualBounds.get(`spring-${i}`);
    close(bounds.min[1], 0, `spring-${i}: bottom`);
    close(bounds.max[1], 1, `spring-${i}: canonical one metre top`);
    assert.ok(bounds.max[0] - bounds.min[0] < .02 && bounds.max[2] - bounds.min[2] < .02,
      `spring-${i}: transverse wire dimensions remain in metre scale`);
  }
});

test('all three key blades preserve both side vertices of the exact shared contact contour', () => {
  for (const key of KEY_PROFILES) {
    const positions = actualPositions.get(`key-${key.id}`);
    for (const [sourceX, height] of keyOutline(key.id)) {
      const x = sourceX * .001;
      const y = (SPEC.restTipZ + height - SPEC.plugAxisZ) * .001;
      for (const sideZ of [-.0024, .0024]) {
        const present = positions.some(point => Math.abs(point[0] - x) <= EPSILON
          && Math.abs(point[1] - y) <= EPSILON && Math.abs(point[2] - sideZ) <= EPSILON);
        assert.ok(present, `${key.id}: original top contact vertex at x=${sourceX}, sideZ=${sideZ}`);
      }
    }
  }
});
