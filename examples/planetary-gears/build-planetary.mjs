/** Reproduce the original planetary teaching assembly, without external CAD. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeGlb } from '../../shared/assets/write-glb.mjs';
import { readGlb, sha256, boundsOf } from '../../shared/assets/glb.mjs';
import { validateSceneContract } from '../../shared/assets/contract.mjs';
import { SPEC_REVISION, ROOT_ID, GEAR_SPEC, PARTS, LIMITATIONS, HOUSING, SUPPORT_BEARINGS } from './spec.mjs';
import { buildDefinitions } from './geometry.mjs';

const root = path.dirname(fileURLToPath(import.meta.url)), assetDir = path.join(root, 'assets');
const matrix = t => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ...t, 1];
const identity = matrix([0, 0, 0]);
const files = ['spec.mjs', 'geometry.mjs', 'build-planetary.mjs'];
const fingerprints = await Promise.all(files.map(async file => ({ file: `examples/planetary-gears/${file}`, sha256: sha256(await readFile(path.join(root, file))) })));
const sourceHash = sha256(Buffer.from(JSON.stringify(fingerprints)));
const geometryRevision = `${SPEC_REVISION}-${sourceHash.slice(0, 12)}`;
const definitions = buildDefinitions(), definitionIndex = new Map([...definitions.keys()].map((id, i) => [id, i]));
const meshes = [...definitions.entries()].map(([id, b]) => ({ name: id, positions: b.positions, normals: b.normals, indices: b.indices,
  color: [1, 1, 1], extras: { definitionId: id } }));
const nodes = [{ name: 'Three-planet reduction assembly', matrix: identity, children: PARTS.map((_, i) => i + 1), extras: { assembly_id: ROOT_ID } },
  ...PARTS.map(p => ({ name: p.name, matrix: matrix(p.translation), mesh: definitionIndex.get(p.definitionId), extras: {
    part_id: p.id, definitionId: p.definitionId, motionOwner: p.motionRole === 'fixed' ? 'static' : 'model',
    motionRole: p.motionRole, ...(p.planetIndex === undefined ? {} : { planetIndex: p.planetIndex }) } }))];
const coordinateBasis = 'Right-handed glTF metres, +Y up; all gear axes are +Z, gear plane XY. Viewed from +Z, positive rotation is counter-clockwise.';
const contract = { schemaVersion: '1.0.0', mechanismId: 'planetary-24-24-72', assetRevision: geometryRevision,
  units: { source: 'authored metres and radians', asset: 'm', angle: 'rad' }, coordinateMap: coordinateBasis,
  identity: `Stable pg:<part> occurrence IDs; repeated planets, bushings, rolling elements and fasteners share pg-def geometry. All ${PARTS.length} source occurrences belong to one authored assembly.`,
  limitations: LIMITATIONS,
  parts: PARTS.map(p => ({ part_id: p.id, parent_id: ROOT_ID, label: p.name, motionOwner: p.motionRole === 'fixed' ? 'static' : 'model',
    rest: { matrix: matrix(p.translation) }, explode: [0, 0, 0], definitionId: p.definitionId, motionRole: p.motionRole,
    ...(p.planetIndex === undefined ? {} : { planetIndex: p.planetIndex }) })) };
const glb = writeGlb({ nodes, meshes, scenes: [{ name: 'Planetary reduction · authored assembled rest', nodes: [0] }],
  extras: { geometryRevision, sourceHash, units: 'm', specRevision: SPEC_REVISION, gearSpec: GEAR_SPEC, license: 'MIT',
    sourceKind: 'original-parametric-teaching-model' }, generator: 'Mechanism Studio planetary exporter 1' });
validateSceneContract(readGlb(glb).json, contract);
const parts = PARTS.map(p => {
  const b = definitions.get(p.definitionId), points = Array.from({ length: b.positions.length / 3 }, (_, i) => b.positions.slice(i * 3, i * 3 + 3));
  const localBounds = boundsOf(points), worldBounds = { min: localBounds.min.map((v, i) => v + p.translation[i]), max: localBounds.max.map((v, i) => v + p.translation[i]) };
  return { ...p, motionOwner: p.motionRole === 'fixed' ? 'static' : 'model', role: p.motionRole, localMatrix: matrix(p.translation), worldMatrix: matrix(p.translation),
    localBounds, worldBounds, worldCenter: worldBounds.min.map((v, i) => (v + worldBounds.max[i]) / 2), triangleCount: b.triangleCount };
});
const assembledWorldBounds = boundsOf(parts.flatMap(p => [p.worldBounds.min, p.worldBounds.max]));
const glbHash = sha256(glb), source = { title: 'Three-planet reduction · 24 / 24 / 72', author: 'Mechanism Studio', license: 'MIT', specRevision: SPEC_REVISION };
const index = { schemaVersion: '1.0.0', geometryRevision, units: 'm', coordinateBasis, rootId: ROOT_ID, source,
  asset: { file: 'assets/assembly.glb', sha256: glbHash, assembledWorldBounds }, gearSpec: GEAR_SPEC, housingSpec: HOUSING, supportBearingSpec: SUPPORT_BEARINGS,
  parts, assemblies: [{ id: ROOT_ID, name: 'Three-planet reduction assembly', parentId: null, children: PARTS.map(p => p.id), localMatrix: identity, worldMatrix: identity }],
  boundsMethod: 'Exact authored definition vertex bounds plus occurrence translation; no rest rotation or scale.', limitations: LIMITATIONS };
const provenance = { schemaVersion: '1.0.0', kind: 'original-parametric-teaching-model', ...source, revision: geometryRevision,
  generator: 'examples/planetary-gears/build-planetary.mjs', inputFingerprints: fingerprints, sourceHash,
  note: 'Built from the authored tooth counts, dimensional assumptions and involute formulas in this example. No external robot, commercial CAD or third-party mesh is used.',
  revisionNotes: ['v2 adds 59 independently identified housing, sealing, fastening and shaft-support parts while retaining all original IDs and rest transforms.', 'v2 shortens the existing output-hub flange by 1 mm to remove its authored overlap with the rear carrier face; shaft/bore dimensions and rest placement are unchanged.', 'v3 assigns cages and balls to the mechanical adapter and shifts raceway curvature centres to the nominal zero-contact-angle contact radii; all 80 IDs and source rest placements are retained.'],
  scope: 'The displayed meshes are not exact CAD B-reps. All fits and rigid connections are explicitly authored teaching assumptions.', limitations: LIMITATIONS };
const report = { schemaVersion: '1.0.0', mechanismId: contract.mechanismId, geometryRevision, sourceHash, glbSHA256: glbHash, glbBytes: glb.length,
  partCount: parts.length, assemblyCount: 1, definitionCount: definitions.size, movingPartCount: parts.filter(p => p.motionOwner === 'model').length,
  triangleCount: parts.reduce((n, p) => n + p.triangleCount, 0), uniqueTriangleCount: meshes.reduce((n, m) => n + m.indices.length / 3, 0),
  assetBoundsMeters: assembledWorldBounds, gearSpec: GEAR_SPEC, housingSpec: HOUSING, supportBearingSpec: SUPPORT_BEARINGS,
  fixedRingReduction: 4, supportBearingRollingKinematics: 'Ideal no-slip, zero contact angle; shaft-driven inner rings and fixed outer rings.', supportBearingContactDynamics: false, checks: { sceneContract: 'passed' }, limitations: LIMITATIONS };
await mkdir(assetDir, { recursive: true });
await writeFile(path.join(assetDir, 'assembly.glb'), glb);
for (const [name, value] of [['scene-index.json', index], ['scene-contract.json', contract], ['build-report.json', report], ['provenance.json', provenance]])
  await writeFile(path.join(assetDir, name), `${JSON.stringify(value, null, 2)}\n`);
console.log(JSON.stringify({ geometryRevision, partCount: parts.length, definitionCount: definitions.size, glbBytes: glb.length, triangleCount: report.triangleCount }));
