/** Rebuild the original robot-joint teaching assembly locally; no model download. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Matrix4, Vector3 } from 'three';
import { writeGlb } from '../../shared/assets/write-glb.mjs';
import { readGlb, sha256, boundsOf } from '../../shared/assets/glb.mjs';
import { validateSceneContract } from '../../shared/assets/contract.mjs';
import { SPEC_REVISION, ROOT_ID, GEAR_SPEC, MOTOR_SPEC, PARTS, ASSEMBLIES, LIMITATIONS, HOUSING, SUPPORT_BEARINGS } from './spec.mjs';
import { buildDefinitions } from './geometry.mjs';
const root = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(root, '../..'), assetDir = path.join(root, 'assets');
const matrix = p => new Matrix4().makeRotationZ(p.restAngle || 0).setPosition(...p.translation).toArray();
const identity = new Matrix4().toArray();
const files = ['examples/robot-joint/spec.mjs', 'examples/robot-joint/geometry.mjs', 'examples/robot-joint/build-joint.mjs',
  'examples/planetary-gears/spec.mjs', 'examples/planetary-gears/geometry.mjs', 'shared/assets/write-glb.mjs'];
const fingerprints = await Promise.all(files.map(async file => ({ file, sha256: sha256(await readFile(path.join(repo, file))) })));
const sourceHash = sha256(Buffer.from(JSON.stringify(fingerprints))), geometryRevision = `${SPEC_REVISION}-${sourceHash.slice(0, 12)}`;
const definitions = buildDefinitions(), definitionIndex = new Map([...definitions.keys()].map((id, i) => [id, i]));
const meshes = [...definitions.entries()].map(([id, b]) => ({ name: id, positions: b.positions, normals: b.normals, indices: b.indices,
  color: [1, 1, 1], extras: { definitionId: id } }));
const nodeIndex = new Map([...ASSEMBLIES, ...PARTS].map((p, i) => [p.id, i]));
const nodes = [...ASSEMBLIES.map(a => ({ name: a.name, matrix: identity, children: a.children.map(id => nodeIndex.get(id)), extras: { assembly_id: a.id } })),
  ...PARTS.map(p => ({ name: p.name, matrix: matrix(p), mesh: definitionIndex.get(p.definitionId), extras: {
    part_id: p.id, definitionId: p.definitionId, motionOwner: p.motionRole === 'fixed' ? 'static' : 'model', motionRole: p.motionRole,
    ...(p.planetIndex === undefined ? {} : { planetIndex: p.planetIndex }) } }))];
if (PARTS.some(p => !definitions.has(p.definitionId))) throw new Error('Missing geometry definition.');
const coordinateBasis = 'Right-handed glTF metres, +Y up; motor, gear and output axes +Z. Positive rotation is counter-clockwise viewed from +Z. Motor lies behind reducer at +Z; robot-link output is at -Z.';
const contract = { schemaVersion: '1.0.0', mechanismId: 'robot-joint-24-24-72', assetRevision: geometryRevision,
  units: { source: 'authored metres and radians', asset: 'm', angle: 'rad' }, coordinateMap: coordinateBasis,
  identity: `Stable rj:<part> occurrences and shared rj-def geometry; ${PARTS.length} parts in five original authored subassemblies. Magnet and coil phase is preserved by source occurrence rotation.`,
  limitations: LIMITATIONS, parts: PARTS.map(p => ({ part_id: p.id, parent_id: p.parentId, label: p.name,
    motionOwner: p.motionRole === 'fixed' ? 'static' : 'model', rest: { matrix: matrix(p) }, explode: [0, 0, 0], definitionId: p.definitionId,
    motionRole: p.motionRole, ...(p.planetIndex === undefined ? {} : { planetIndex: p.planetIndex }) })) };
const glb = writeGlb({ nodes, meshes, scenes: [{ name: 'Original robot joint · assembled rest', nodes: [0] }],
  extras: { geometryRevision, sourceHash, units: 'm', specRevision: SPEC_REVISION, gearSpec: GEAR_SPEC, motorSpec: MOTOR_SPEC, license: 'MIT',
    sourceKind: 'original-parametric-teaching-model' }, generator: 'Mechanism Studio original robot-joint exporter 1' });
validateSceneContract(readGlb(glb).json, contract);
const parts = PARTS.map(p => {
  const b = definitions.get(p.definitionId), points = Array.from({ length: b.positions.length / 3 }, (_, i) => b.positions.slice(i * 3, i * 3 + 3));
  const rest = new Matrix4().fromArray(matrix(p)), localBounds = boundsOf(points), worldBounds = boundsOf(points.map(v => new Vector3(...v).applyMatrix4(rest).toArray()));
  return { ...p, motionOwner: p.motionRole === 'fixed' ? 'static' : 'model', role: p.motionRole, localMatrix: matrix(p), worldMatrix: matrix(p),
    localBounds, worldBounds, worldCenter: worldBounds.min.map((v, i) => (v + worldBounds.max[i]) / 2), triangleCount: b.triangleCount };
});
const assembledWorldBounds = boundsOf(parts.flatMap(p => [p.worldBounds.min, p.worldBounds.max])), glbHash = sha256(glb);
const source = { title: 'Compact robot joint · 12-slot motor and 4:1 planetary reducer', author: 'Mechanism Studio', license: 'MIT', specRevision: SPEC_REVISION };
const index = { schemaVersion: '1.0.0', geometryRevision, units: 'm', coordinateBasis, rootId: ROOT_ID, source,
  asset: { file: 'assets/assembly.glb', sha256: glbHash, assembledWorldBounds }, gearSpec: GEAR_SPEC, motorSpec: MOTOR_SPEC, housingSpec: HOUSING, supportBearingSpec: SUPPORT_BEARINGS,
  parts, assemblies: ASSEMBLIES.map(a => ({ ...a, localMatrix: identity, worldMatrix: identity })),
  boundsMethod: 'Exact authored vertices transformed by each occurrence translation and Z rotation; assembly transforms are identity.', limitations: LIMITATIONS };
const provenance = { schemaVersion: '1.0.0', kind: 'original-parametric-teaching-model', ...source, revision: geometryRevision,
  generator: 'examples/robot-joint/build-joint.mjs', inputFingerprints: fingerprints, sourceHash,
  note: 'Generated from this project’s original dimensional design. Reuses its MIT planetary reducer solids at 0.6 scale and authors new motor, magnetic blocks, tooth-wrapped winding packs, motor case, sensor package and output flange. No downloaded mesh or commercial CAD is used.',
  scope: 'Authoring assumptions and tessellated teaching meshes; not engineering-certified or manufacturing CAD.', limitations: LIMITATIONS };
const report = { schemaVersion: '1.0.0', mechanismId: contract.mechanismId, geometryRevision, sourceHash, glbSHA256: glbHash, glbBytes: glb.length,
  partCount: parts.length, assemblyCount: ASSEMBLIES.length, definitionCount: definitions.size, movingPartCount: parts.filter(p => p.motionOwner === 'model').length,
  triangleCount: parts.reduce((n, p) => n + p.triangleCount, 0), uniqueTriangleCount: meshes.reduce((n, m) => n + m.indices.length / 3, 0),
  assetBoundsMeters: assembledWorldBounds, gearSpec: GEAR_SPEC, motorSpec: MOTOR_SPEC, supportBearingSpec: SUPPORT_BEARINGS,
  fixedRingReduction: 4, motorElectromagneticSimulation: false, bearingContactDynamics: false, checks: { sceneContract: 'passed' }, limitations: LIMITATIONS };
await mkdir(assetDir, { recursive: true });
await writeFile(path.join(assetDir, 'assembly.glb'), glb);
for (const [name, value] of [['scene-index.json', index], ['scene-contract.json', contract], ['build-report.json', report], ['provenance.json', provenance]])
  await writeFile(path.join(assetDir, name), `${JSON.stringify(value, null, 2)}\n`);
console.log(JSON.stringify({ geometryRevision, partCount: parts.length, definitionCount: definitions.size, glbBytes: glb.length, triangleCount: report.triangleCount }));
