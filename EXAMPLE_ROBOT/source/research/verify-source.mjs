import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const revision = 'e871f738c97f43de230cb04d340797da6a68c4b9';
const repository = 'https://github.com/roboninecom/SO-ARM-102';
const records = (await readFile(path.join(sourceRoot, 'research/upstream-tree-records.txt'), 'utf8')).trim().split(/\r?\n/);
const files = [];
for (const record of records) {
  const match = /^100644 blob ([a-f0-9]{40})\t(.+)$/.exec(record);
  if (!match) throw new Error(`Unexpected upstream tree record: ${record}`);
  const [, gitBlobSha1, localFile] = match;
  const bytes = await readFile(path.join(sourceRoot, localFile));
  const actualBlob = createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
  if (actualBlob !== gitBlobSha1) throw new Error(`Upstream bytes changed: ${localFile}`);
  files.push({ localFile, upstreamPath: localFile, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), gitBlobSha1, url: `https://raw.githubusercontent.com/roboninecom/SO-ARM-102/${revision}/${localFile}` });
}
const xml = await readFile(path.join(sourceRoot, 'simulation/urdf/so_arm_102.urdf'), 'utf8');
const attributes = text => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const vector = text => text.trim().split(/\s+/).map(Number);
const links = [];
for (const match of xml.matchAll(/<link\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/link>/g)) {
  const visual = /<visual>([\s\S]*?)<\/visual>/.exec(match[2])?.[1];
  if (!visual) throw new Error(`No visual on source link ${match[1]}`);
  const mesh = attributes(/<mesh\s+([^>]+)\/>/.exec(visual)[1]);
  const origin = attributes(/<origin\s+([^>]+)\/>/.exec(visual)[1]);
  const bytes = await readFile(path.join(sourceRoot, 'simulation/urdf', mesh.filename));
  const triangleCount = bytes.readUInt32LE(80);
  if (bytes.length !== 84 + triangleCount * 50) throw new Error(`Unexpected binary STL size ${mesh.filename}`);
  const minimum = [Infinity, Infinity, Infinity]; const maximum = [-Infinity, -Infinity, -Infinity];
  for (let triangle = 0; triangle < triangleCount; triangle++) for (let vertex = 0; vertex < 3; vertex++) for (let axis = 0; axis < 3; axis++) {
    const value = bytes.readFloatLE(84 + triangle * 50 + 12 + vertex * 12 + axis * 4);
    if (!Number.isFinite(value)) throw new Error(`Non-finite STL coordinate ${mesh.filename}`);
    minimum[axis] = Math.min(minimum[axis], value); maximum[axis] = Math.max(maximum[axis], value);
  }
  links.push({ name: match[1], mesh: mesh.filename, meshScale: vector(mesh.scale), visualOrigin: { xyz: vector(origin.xyz), rpy: vector(origin.rpy) }, triangleCount, rawMeshBoundsMillimetres: { minimum, maximum } });
}
const joints = [...xml.matchAll(/<joint\s+([^>]+)>([\s\S]*?)<\/joint>/g)].map(match => {
  const joint = attributes(match[1]); const get = tag => attributes(new RegExp(`<${tag}\\s+([^>]+)\\/>`).exec(match[2])?.[1] ?? '');
  const origin = get('origin'); const limit = get('limit');
  return { ...joint, parent: get('parent').link, child: get('child').link, origin: { xyz: vector(origin.xyz), rpy: vector(origin.rpy) }, axis: vector(get('axis').xyz), limit: Object.fromEntries(Object.entries(limit).map(([key,value]) => [key, Number(value)])), ...(match[2].includes('<mimic') ? { mimic: get('mimic') } : {}) };
});
if (links.length !== 8 || joints.length !== 7) throw new Error('Unexpected source link/joint count');
const provenance = {
  schemaVersion: '1.0.0', title: 'SO-ARM 102 follower: source-authored robot description and visual meshes',
  author: 'Robonine', copyright: 'Copyright (c) 2026 Robonine', sourceType: 'upstream-open-robot-description',
  repository, revision, retrievedDate: '2026-10-17', license: 'CC-BY-4.0', licenseFile: 'DOCS-LICENSE.txt',
  licensingEvidence: ['LICENSING.md', 'REUSE.toml', 'NOTICE'],
  sourceUrl: `${repository}/tree/${revision}/simulation/urdf`, localFile: 'simulation/urdf/so_arm_102.urdf',
  sha256: files.find(file => file.localFile === 'simulation/urdf/so_arm_102.urdf').sha256,
  attribution: 'Robonine, SO-ARM 102, https://github.com/roboninecom/SO-ARM-102, CC BY 4.0',
  changes: 'Upstream source files retained byte-for-byte. Mechanism Studio derives a white-background line rendering, authored exploded-link offsets, camera choreography, English annotations and a separately code-synthesized music score. No upstream video or soundtrack is reused.',
  obligations: ['Retain credit, source URL, CC BY 4.0 link and change notice alongside redistributed visual derivatives.', 'Do not imply Robonine endorsement.'],
  geometrySubset: { kind: 'URDF visual STL meshes', links: 8, joints: 7, meshUnitBeforeUrdfScale: 'millimetres', urdfLengthUnit: 'metres', meshScale: [0.001,0.001,0.001], sourceFrame: 'right-handed, Z up', sourcePose: 'URDF q=0 is the current source CAD pose, as declared in export_metadata.json.', limitations: ['Per-link visual STL meshes merge multiple physical bodies; this source package does not retain per-screw identity or a native STEP assembly tree.', 'The exploded layout is editorial link separation, not collision-checked service disassembly.', 'Source collision and inertial estimates are preserved as provenance, not independently validated dynamics.'] },
  files
};
await writeFile(path.join(sourceRoot, 'provenance.json'), `${JSON.stringify(provenance,null,2)}\n`);
const summary = { revision, originalFilesVerified: files.length, sourceFilesBytes: files.reduce((total,file)=>total+file.bytes,0), totalVisualTriangles: links.reduce((total,link)=>total+link.triangleCount,0), links, joints };
await writeFile(path.join(sourceRoot, 'research/source-inspection.json'), `${JSON.stringify(summary,null,2)}\n`);
console.log(JSON.stringify({ originalFilesVerified: files.length, links: links.length, joints: joints.length, visualTriangles: summary.totalVisualTriangles, urdfSha256: provenance.sha256 },null,2));
