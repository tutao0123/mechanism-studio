/** Pinned source URDF -> static display GLB. No upstream scripts are executed. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Matrix4, Vector3, Quaternion, Euler } from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { writeGlb } from '../shared/assets/write-glb.mjs';
import { readGlb, sha256, boundsOf } from '../shared/assets/glb.mjs';
import { validateSceneContract } from '../shared/assets/contract.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const provenance = JSON.parse(await readFile(path.join(root, 'source/provenance.json'), 'utf8'));
const sourcePath = path.join(root, 'source', provenance.localFile);
const sourceBytes = await readFile(sourcePath);
if (sha256(sourceBytes) !== 'd52437d3f901077d084492d81b4037952273a76d0a229bf7cf7de7ac5836da4f' || provenance.sha256 !== sha256(sourceBytes)) throw new Error('Pinned URDF hash changed');
const originalFiles = new Map();
for (const file of provenance.files) {
  if (path.isAbsolute(file.localFile) || file.localFile.split(/[\\/]/).includes('..')) throw new Error('Source path must remain local');
  const bytes = await readFile(path.join(root, 'source', file.localFile));
  if (sha256(bytes) !== file.sha256 || bytes.length !== file.bytes) throw new Error(`Source byte verification failed: ${file.localFile}`);
  originalFiles.set(file.localFile, { ...file, data: bytes });
}
const python = path.resolve(root, '../.tools/cad-python/Scripts/python.exe');
const parsed = spawnSync(python, [path.join(root, 'parse-urdf.py'), sourcePath], { encoding: 'utf8', windowsHide: true, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, maxBuffer: 2 ** 20 });
if (parsed.status !== 0) throw new Error(`URDF parse failed: ${parsed.error?.message ?? parsed.stderr}`);
const source = JSON.parse(parsed.stdout);
const linkMap = new Map(source.links.map(link => [link.name, link]));
const jointForChild = new Map(source.joints.map(joint => [joint.child, joint]));
if (linkMap.size !== 8 || jointForChild.size !== 7 || source.links.length !== 8 || source.joints.length !== 7) throw new Error('Expected original 8-link robot');
const rootLinks = source.links.filter(link => !jointForChild.has(link.name));
if (rootLinks.length !== 1 || rootLinks[0].name !== 'base_link') throw new Error('Expected one original base_link root');
const B = new Matrix4().set(1,0,0,0, 0,0,1,0, 0,-1,0,0, 0,0,0,1), inverseB = B.clone().invert();
const matrixForOrigin = origin => new Matrix4().compose(new Vector3(...origin.xyz), new Quaternion().setFromEuler(new Euler(...origin.rpy, 'ZYX')), new Vector3(1,1,1));
const sourceWorld = new Map(), localMatrices = new Map(), worldMatrices = new Map();
function worldFor(name, visiting = new Set()) {
  if (sourceWorld.has(name)) return sourceWorld.get(name);
  if (!linkMap.has(name) || visiting.has(name)) throw new Error('Broken/cyclic source link tree');
  const joint = jointForChild.get(name); const local = joint ? matrixForOrigin(joint.origin) : new Matrix4();
  if (joint && !['revolute','prismatic','fixed','continuous'].includes(joint.type)) throw new Error(`Unsupported zero-pose joint ${joint.type}`);
  localMatrices.set(name, B.clone().multiply(local).multiply(inverseB));
  const world = joint ? worldFor(joint.parent, new Set([...visiting, name])).clone().multiply(local) : local;
  sourceWorld.set(name, world); worldMatrices.set(name, B.clone().multiply(world).multiply(inverseB)); return world;
}
source.links.forEach(link => worldFor(link.name));
const id = name => `urdf:${name}`;
const meshIdentity = provenance.files.filter(file => file.localFile.endsWith('.stl')).map(file => `${file.localFile}:${file.sha256}`).sort().join('\n');
const geometryRevision = `so-arm102-${sha256(sourceBytes).slice(0,12)}-${sha256(Buffer.from(meshIdentity)).slice(0,12)}-urdf-display-2`;
const nodes = [], meshes = [], parts = [], sceneParts = [], allWorldPoints = [], ownedBodies = [];
const loader = new STLLoader();
for (const link of source.links) {
  if (link.visuals.length !== 1) throw new Error('Expected exactly one original visual mesh per link');
  const visual = link.visuals[0], file = originalFiles.get(`simulation/urdf/${visual.mesh}`);
  if (!file || visual.scale.some(value => value !== .001)) throw new Error('Pinned millimetre mesh scale or source changed');
  const joint = jointForChild.get(link.name), parentId = joint ? id(joint.parent) : null;
  const geometry = loader.parse(file.data.buffer.slice(file.data.byteOffset, file.data.byteOffset + file.data.byteLength));
  const geometryTransform = B.clone().multiply(matrixForOrigin(visual.origin)).scale(new Vector3(...visual.scale));
  geometry.applyMatrix4(geometryTransform);
  const positions = Array.from(geometry.attributes.position.array), normals = Array.from(geometry.attributes.normal.array);
  const indices = Array.from({ length: positions.length / 3 }, (_, index) => index);
  const triples = Array.from({ length: positions.length / 3 }, (_, index) => positions.slice(index * 3, index * 3 + 3));
  const localBounds = boundsOf(triples), worldMatrix = worldMatrices.get(link.name), worldPoints = triples.map(point => new Vector3(...point).applyMatrix4(worldMatrix).toArray());
  const worldBounds = boundsOf(worldPoints), worldCenter = worldBounds.min.map((value, axis) => (value + worldBounds.max[axis]) / 2);
  for (const point of worldPoints) allWorldPoints.push(point);
  const localMatrix = localMatrices.get(link.name).toArray();
  const sourceIdentity = { link: link.name, ...(joint ? { joint: joint.name, parentLink: joint.parent } : {}), mesh: `source/simulation/urdf/${visual.mesh}`, meshSHA256: file.sha256 };
  // Keep source link nodes as Groups. A display-only identity child owns the
  // solid, so hiding a local-shot solid never hides downstream source links.
  nodes.push({ name: link.name, matrix: localMatrix, children: [], extras: { part_id: id(link.name), motionOwner: 'static', source: sourceIdentity } });
  ownedBodies.push({ ownerIndex: nodes.length - 1, ownerPartId: id(link.name), meshIndex: meshes.length, name: link.name });
  meshes.push({ name: link.name, positions, normals, indices, color: [1,1,1], extras: { sourceLink: link.name, sourceMeshSHA256: file.sha256, geometryRevision } });
  parts.push({ part_id: id(link.name), parent_id: parentId, label: link.name, sourceKind: 'urdf-link', motionOwner: 'static', rest: { matrix: localMatrix }, explode: [0,0,0], source: sourceIdentity, localBoundsGltfMeters: localBounds });
  sceneParts.push({ id: id(link.name), name: link.name, parentId, worldBounds, worldCenter, localBounds, localMatrix, worldMatrix: worldMatrix.toArray(), mesh: { file: sourceIdentity.mesh, sha256: file.sha256, triangleCount: indices.length / 3 }, source: sourceIdentity, zeroPose: true });
  geometry.dispose();
}
const indexByName = new Map(source.links.map((link,index) => [link.name,index]));
for (const joint of source.joints) nodes[indexByName.get(joint.parent)].children.push(indexByName.get(joint.child));
for (const body of ownedBodies) {
  const bodyNodeIndex = nodes.length;
  nodes[body.ownerIndex].children.push(bodyNodeIndex);
  nodes.push({ name: `${body.name} / owned body`, mesh: body.meshIndex, matrix: new Matrix4().toArray(), extras: { displayOnly: true, ownerPartId: body.ownerPartId } });
  sceneParts[body.ownerIndex].displayBinding = { semanticNodeIndex: body.ownerIndex, ownedBodyNodeIndex: bodyNodeIndex, ownedBodyRest: 'identity; geometry is local to its source link' };
}
for (const node of nodes) if (node.children && !node.children.length) delete node.children;
const bounds = boundsOf(allWorldPoints);
const contract = { schemaVersion: '1.0.0', mechanismId: 'open-robot-so-arm102', assetRevision: geometryRevision, units: { source: 'URDF m; visual STL mm scaled 0.001', asset: 'm', angle: 'rad' }, sourceSHA256: provenance.sha256, coordinateMap: 'B:[x,z,-y]; node B*M*B^-1; geometry B*visualOrigin*meshScale; URDF translation remains metres', identity: 'part_id is urdf:<original link name>; original zero-pose joint hierarchy', limitations: provenance.geometrySubset.limitations, parts };
const glb = writeGlb({ nodes, meshes, scenes: [{ name: 'SO-ARM 102 source CAD pose', nodes: [indexByName.get('base_link')] }], extras: { sourceSHA256: provenance.sha256, geometryRevision, units: 'm', coordinateMap: contract.coordinateMap, source: { repository: provenance.repository, revision: provenance.revision, license: provenance.license } }, generator: 'Mechanism Studio pinned URDF visual exporter 2' });
validateSceneContract(readGlb(glb).json, contract);
const glbHash = sha256(glb);
const sceneIndex = { schemaVersion: '1.0.0', geometryRevision, units: 'm', coordinateBasis: 'glTF right-handed Y up; B=[x,z,-y]', source: { title: provenance.title, author: provenance.author, repository: provenance.repository, revision: provenance.revision, license: provenance.license, urdfFile: `source/${provenance.localFile}`, sha256: provenance.sha256 }, asset: { file: 'assets/robot.glb', sha256: glbHash, assembledWorldBounds: bounds, assembledWorldCenter: bounds.min.map((value,axis)=>(value+bounds.max[axis])/2) }, parts: sceneParts };
const sourceAssembly = { schemaVersion: '1.0.0', sourceSHA256: provenance.sha256, robotName: source.robotName, sourceUnits: { length: 'm', visualMeshNumeric: 'mm', angle: 'rad' }, sourceCoordinateBasis: 'right-handed Z up', zeroPose: 'Original source CAD pose (all URDF joint coordinates zero)', links: source.links, joints: source.joints, sourceWorldMatrices: Object.fromEntries([...sourceWorld].map(([name,matrix]) => [name,matrix.toArray()])), limitations: provenance.geometrySubset.limitations };
const report = { schemaVersion: '1.0.0', mechanismId: contract.mechanismId, exporter: 'mechanism-studio-urdf-display-2', geometryRevision, sourceSHA256: provenance.sha256, glbSHA256: glbHash, glbBytes: glb.length, originalFilesVerified: originalFiles.size, partCount: parts.length, meshCount: meshes.length, sourceJointCount: source.joints.length, displayOnlyBodyNodeCount: ownedBodies.length, gltfNodeCount: nodes.length, displayBodyOwnership: 'Eight original source-link Groups retain their direct source parents and rest matrices; each owns one display-only, identity-transform solid child. Body visibility is independent of downstream source links. These children are not new URDF links.', triangleCount: meshes.reduce((sum,mesh)=>sum+mesh.indices.length/3,0), assetBoundsMeters: bounds, geometrySimplified: false, sourcePoseModified: false, mcpUsed: false, motionOwner: 'static; authored display offsets belong to Showcase wrapper', limitations: provenance.geometrySubset.limitations };
await mkdir(path.join(root,'assets'),{recursive:true}); await mkdir(path.join(root,'planning'),{recursive:true});
for (const [name,value] of [['scene-contract.json',contract],['source-assembly.json',sourceAssembly],['build-report.json',report]]) await writeFile(path.join(root,'assets',name), `${JSON.stringify(value,null,2)}\n`);
await writeFile(path.join(root,'assets/robot.glb'), glb);
await writeFile(path.join(root,'planning/scene-index.json'), `${JSON.stringify(sceneIndex,null,2)}\n`);
console.log(JSON.stringify({ ...report, parts: sceneParts.map(part => ({ id: part.id, parentId: part.parentId, bounds: part.worldBounds })) },null,2));
