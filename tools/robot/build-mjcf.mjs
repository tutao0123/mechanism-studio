/** Two pinned MJCF visual packages -> deterministic source-body GLB. No physics. */
import { readFile, writeFile, mkdir, access, realpath, lstat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { writeGlb } from '../../shared/assets/write-glb.mjs';
import { readGlb, sha256, boundsOf } from '../../shared/assets/glb.mjs';
import { validateSceneContract } from '../../shared/assets/contract.mjs';

const toolRoot = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(toolRoot, '../..');
export const IMPORTER_REVISION = 'pinned-mjcf-visual-1';
export const PROFILES = Object.freeze({
  'allegro-right': { sha256: 'cec3efe34be49c8220c23afdae0cfacbce10164a5bc7c34075b6668ee0a862a6', bodyCount: 21, jointCount: 16, visualCount: 21, root: 'palm' },
  'robotiq-2f85-v4': { sha256: '8d4a4f840ff5f928d56e387a8325d1f34437b35f72b82792e4d46f8de879e133', bodyCount: 11, jointCount: 6, visualCount: 13, root: 'base' },
});
const SOURCE_REVISION = '62ab00f2bc44f6f20c1c9b7a13f3fb1dd41a4e35';
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const id = name => `mjcf:${name}`;
export const BASIS = new Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);
const inverseB = BASIS.clone().invert();
const matrixFor = ({ pos, quatWxyz: [w, x, y, z] }) => new Matrix4().compose(new Vector3(...pos), new Quaternion(x, y, z, w).normalize(), new Vector3(1, 1, 1));
const json = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));

/** Reject links, traversal and source roots outside this checkout. */
export async function localPath(relative, { allowMissing = false } = {}) {
  ensure(typeof relative === 'string' && relative && !path.isAbsolute(relative) && !relative.includes('\\') && !relative.includes(':') && !relative.includes('\0') && relative.split('/').every(item => item && item !== '.' && item !== '..'), 'A project-relative forward-slash path is required');
  let current = PROJECT_ROOT;
  for (const segment of relative.split('/')) {
    current = path.join(current, segment);
    try { ensure(!(await lstat(current)).isSymbolicLink(), 'Source/output links are unsupported'); }
    catch (error) { if (allowMissing && error.code === 'ENOENT') continue; throw error; }
  }
  const root = await realpath(PROJECT_ROOT);
  let ancestor = current;
  while (true) { try { ancestor = await realpath(ancestor); break; } catch (error) { if (!allowMissing || error.code !== 'ENOENT') throw error; ancestor = path.dirname(ancestor); } }
  const check = path.relative(root, ancestor);
  ensure(!check.startsWith('..') && !path.isAbsolute(check), 'Path leaves the project');
  return current;
}

export async function buildExample(example) {
  const exampleRoot = await localPath(example);
  const provenance = json(await readFile(await localPath(`${example}/source/provenance.json`)));
  const config = json(await readFile(await localPath(`${example}/source/import-config.json`)));
  const profile = PROFILES[config.modelId];
  ensure(profile && provenance.revision === SOURCE_REVISION && provenance.sha256 === profile.sha256, 'Only the pinned Allegro right hand and Robotiq 2F-85 v4 packages are supported');
  ensure(Array.isArray(provenance.files) && provenance.files.length > 0, 'Pinned source file manifest required');
  const files = new Map();
  for (const file of provenance.files) {
    ensure(!files.has(file.localFile), 'Duplicate retained source path');
    const bytes = await readFile(await localPath(`${example}/source/${file.localFile}`));
    ensure(bytes.length === file.bytes && sha256(bytes) === file.sha256, `Retained source changed: ${file.localFile}`);
    files.set(file.localFile, { ...file, data: bytes });
  }
  ensure(files.get(provenance.localFile)?.sha256 === provenance.sha256, 'Pinned XML file must be retained in the source manifest');
  ensure(files.has(provenance.licenseFile || 'LICENSE'), 'Retained model-specific license is required');
  let python = process.env.MECHANISM_PYTHON;
  if (!python) { const local = path.join(PROJECT_ROOT, '.tools/cad-python/Scripts/python.exe'); try { await access(local); python = local; } catch { python = process.platform === 'win32' ? 'python' : 'python3'; } }
  const parsed = spawnSync(python, [path.join(toolRoot, 'parse-mjcf.py'), await localPath(`${example}/source/${provenance.localFile}`)], { encoding: 'utf8', windowsHide: true, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, maxBuffer: 4 * 1024 * 1024 });
  ensure(parsed.status === 0, `MJCF parser failed: ${parsed.error?.message ?? parsed.stderr}`);
  const source = JSON.parse(parsed.stdout);
  const counts = { bodyCount: source.bodies.length, jointCount: source.bodies.reduce((n, body) => n + body.joints.length, 0), visualCount: source.bodies.reduce((n, body) => n + body.visuals.length, 0) };
  for (const [key, value] of Object.entries(counts)) ensure(value === profile[key] && (!config.expected?.[key] || value === config.expected[key]), `Pinned ${key} differs`);
  const bodyMap = new Map(source.bodies.map(body => [body.name, body]));
  const meshMap = new Map(source.meshes.map(mesh => [mesh.name, mesh]));
  const roots = source.bodies.filter(body => !body.parent);
  ensure(roots.length === 1 && roots[0].name === profile.root, 'Pinned source root differs');
  const sourceWorld = new Map(), local = new Map(), displayWorld = new Map();
  function worldFor(name) {
    if (sourceWorld.has(name)) return sourceWorld.get(name);
    const body = bodyMap.get(name), rest = matrixFor(body);
    local.set(name, BASIS.clone().multiply(rest).multiply(inverseB));
    const world = body.parent ? worldFor(body.parent).clone().multiply(rest) : rest;
    sourceWorld.set(name, world); displayWorld.set(name, BASIS.clone().multiply(world).multiply(inverseB)); return world;
  }
  source.bodies.forEach(body => worldFor(body.name));
  const meshIdentity = source.meshes.map(mesh => { const file = files.get(`assets/${mesh.file}`); ensure(file, `Retained mesh missing: ${mesh.file}`); return `${mesh.file}:${file.sha256}`; }).sort().join('\n');
  const geometryRevision = `${config.modelId}-${provenance.sha256.slice(0, 12)}-${sha256(Buffer.from(meshIdentity)).slice(0, 12)}-${IMPORTER_REVISION}`;
  const nodes = [], meshes = [], parts = [], sceneParts = [], allWorldPoints = [], owned = [];
  const loader = new STLLoader();
  for (const body of source.bodies) {
    const positions = [], normals = [], indices = [], visualRecords = [], unique = new Map();
    for (const visual of body.visuals) {
      const asset = meshMap.get(visual.mesh), file = files.get(`assets/${asset.file}`), bytes = file.data;
      const geometry = loader.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      geometry.applyMatrix4(BASIS.clone().multiply(matrixFor(visual)).scale(new Vector3(...asset.scale)));
      const p = geometry.attributes.position.array, n = geometry.attributes.normal.array, firstIndex = indices.length;
      for (let vertex = 0; vertex < p.length / 3; vertex++) {
        const at = vertex * 3, values = [p[at], p[at + 1], p[at + 2], n[at], n[at + 1], n[at + 2]];
        ensure(values.every(Number.isFinite), 'Source mesh has non-finite vertices/normals');
        const key = values.join(','); let index = unique.get(key);
        if (index === undefined) { index = positions.length / 3; unique.set(key, index); positions.push(...values.slice(0, 3)); normals.push(...values.slice(3)); }
        indices.push(index);
      }
      visualRecords.push({ visualOccurrenceId: `${id(body.name)}/geom:${visual.sourceGeomIndex}`, sourceGeomIndex: visual.sourceGeomIndex,
        definitionId: `mjcf-mesh:${visual.mesh}`, meshName: visual.mesh, file: `source/${file.localFile}`, sha256: file.sha256,
        sourceGeomTransform: { pos: visual.pos, quatWxyz: visual.quatWxyz }, meshScale: asset.scale, materialName: visual.material,
        firstIndex, indexCount: indices.length - firstIndex, triangleCount: (indices.length - firstIndex) / 3 });
      geometry.dispose();
    }
    const points = Array.from({ length: positions.length / 3 }, (_, i) => positions.slice(i * 3, i * 3 + 3));
    const worldMatrix = displayWorld.get(body.name), worldPoints = points.map(point => new Vector3(...point).applyMatrix4(worldMatrix).toArray());
    // Empty semantic pad bodies get a labelled point bound, never fake geometry.
    const localBounds = boundsOf(points.length ? points : [[0, 0, 0]]);
    const worldBounds = boundsOf(worldPoints.length ? worldPoints : [new Vector3().applyMatrix4(worldMatrix).toArray()]);
    for (const point of worldPoints) allWorldPoints.push(point);
    const rest = local.get(body.name).toArray(), parentId = body.parent ? id(body.parent) : null;
    const sourceIdentity = { body: body.name, parentBody: body.parent, visuals: visualRecords };
    const motionOwner = body.joints.length ? 'model' : 'static', semanticNodeIndex = nodes.length;
    nodes.push({ name: body.name, matrix: rest, children: [], extras: { part_id: id(body.name), motionOwner, source: sourceIdentity } });
    parts.push({ part_id: id(body.name), parent_id: parentId, label: body.name, sourceKind: 'mjcf-body', motionOwner,
      rest: { matrix: rest }, explode: [0, 0, 0], source: sourceIdentity, localBoundsGltfMeters: localBounds });
    sceneParts.push({ id: id(body.name), name: body.name, parentId, worldBounds,
      worldCenter: worldBounds.min.map((value, axis) => (value + worldBounds.max[axis]) / 2), localBounds,
      localMatrix: rest, worldMatrix: worldMatrix.toArray(), source: sourceIdentity, zeroPose: true,
      hasGeometry: points.length > 0, boundsKind: points.length ? 'visual-mesh-AABB' : 'semantic-origin-point-no-geometry',
      mesh: { file: 'assets/assembly.glb', sha256: null, triangleCount: indices.length / 3, sourceVisualCount: body.visuals.length },
      displayBinding: { semanticNodeIndex, ownedBodyNodeIndex: null, ownedBodyRest: 'identity; source-local visual geometry' } });
    if (points.length) { owned.push({ ownerIndex: semanticNodeIndex, body, meshIndex: meshes.length }); meshes.push({ name: body.name, positions, normals, indices, color: [1, 1, 1], extras: { sourceBody: body.name, geometryRevision } }); }
  }
  const indexByName = new Map(source.bodies.map((body, index) => [body.name, index]));
  for (const body of source.bodies) if (body.parent) nodes[indexByName.get(body.parent)].children.push(indexByName.get(body.name));
  for (const { ownerIndex, body, meshIndex } of owned) {
    const ownedBodyNodeIndex = nodes.length;
    nodes[ownerIndex].children.push(ownedBodyNodeIndex);
    nodes.push({ name: `${body.name} / owned visual`, mesh: meshIndex, matrix: new Matrix4().toArray(), extras: { displayOnly: true, ownerPartId: id(body.name) } });
    sceneParts[ownerIndex].displayBinding.ownedBodyNodeIndex = ownedBodyNodeIndex;
  }
  for (const node of nodes) if (node.children && !node.children.length) delete node.children;
  const bounds = boundsOf(allWorldPoints);
  const limitations = [...(provenance.limits || provenance.geometrySubset?.limitations || []),
    'Visual mesh conversion preserves source bodies and declared joints; it does not solve constraints, dynamics, contacts or collision-free disassembly.',
    'Collision primitives and inertial/actuation metadata are retained as source evidence, not displayed as manufacturing components.',
    'Source reference pose uses each hinge q=ref, even where that reference is outside a declared limit; authored working motion must validate its own joint limits.'];
  const contract = { schemaVersion: '1.0.0', mechanismId: config.modelId, assetRevision: geometryRevision, units: { source: 'MJCF m; rad', asset: 'm', angle: 'rad' }, sourceSHA256: provenance.sha256,
    coordinateMap: 'B=[x,z,-y]; source body B*M*B^-1; visual B*geomTransform*meshScale; once only', limitations, parts };
  const glb = writeGlb({ nodes, meshes, scenes: [{ name: `${source.robotName} source reference pose`, nodes: [0] }], extras: { geometryRevision, sourceSHA256: provenance.sha256, units: 'm', source: { repository: provenance.repository, revision: provenance.revision, license: provenance.license } }, generator: IMPORTER_REVISION });
  validateSceneContract(readGlb(glb).json, contract);
  const glbSHA256 = sha256(glb); sceneParts.forEach(part => { part.mesh.sha256 = glbSHA256; });
  const index = { schemaVersion: '1.0.0', geometryRevision, units: 'm', coordinateBasis: 'glTF right-handed Y up; B=[x,z,-y]',
    source: { title: provenance.title, repository: provenance.repository, revision: provenance.revision, license: provenance.license, sourceFile: `source/${provenance.localFile}`, sha256: provenance.sha256 },
    asset: { file: 'assets/assembly.glb', sha256: glbSHA256, assembledWorldBounds: bounds, assembledWorldCenter: bounds.min.map((value, axis) => (value + bounds.max[axis]) / 2) }, parts: sceneParts };
  const assembly = { schemaVersion: '1.0.0', sourceSHA256: provenance.sha256, sourceUnits: { length: 'm', angle: 'rad' }, sourceCoordinateBasis: 'right-handed Z up',
    zeroPose: 'Original reference body placements; q=joint.ref. This geometric reference may be outside a declared joint range.', ...source,
    sourceWorldMatrices: Object.fromEntries([...sourceWorld].map(([name, matrix]) => [name, matrix.toArray()])), limitations };
  const report = { schemaVersion: '1.0.0', mechanismId: config.modelId, importer: IMPORTER_REVISION, geometryRevision, sourceSHA256: provenance.sha256, glbSHA256, glbBytes: glb.length,
    originalFilesVerified: files.size, partCount: parts.length, meshCount: meshes.length, sourceJointCount: counts.jointCount, sourceVisualCount: counts.visualCount,
    emptySemanticBodies: source.bodies.filter(body => !body.visuals.length).map(body => id(body.name)), sourceEqualityCount: source.equalities.length,
    triangleCount: meshes.reduce((total, mesh) => total + mesh.indices.length / 3, 0), assetBoundsMeters: bounds, geometrySimplified: false, exactAttributeDeduplication: true,
    sourcePoseModified: false, mcpUsed: false, constraintsSolved: false, limitations };
  const output = await localPath(`${example}/assets`, { allowMissing: true }); await mkdir(output, { recursive: true });
  for (const [name, bytes] of [['assembly.glb', glb], ['LICENSE', files.get(provenance.licenseFile || 'LICENSE').data],
    ...[['scene-index.json', index], ['scene-contract.json', contract], ['source-assembly.json', assembly], ['build-report.json', report]].map(([name, value]) => [name, `${JSON.stringify(value, null, 2)}\n`])]) {
    await localPath(`${example}/assets/${name}`, { allowMissing: true }); await writeFile(path.join(output, name), bytes);
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const args = process.argv.slice(2); ensure(args.length === 2 && args[0] === '--example', 'Usage: node tools/robot/build-mjcf.mjs --example examples/<pinned-model>'); console.log(JSON.stringify(await buildExample(args[1]), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
