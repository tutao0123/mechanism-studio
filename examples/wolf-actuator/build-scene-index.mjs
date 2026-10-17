/** Derive camera/annotation bounds from the actual CAD display, without editing placement. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Matrix4, Vector3, Box3 } from 'three';
import { readGlb, sha256 } from '../../shared/assets/glb.mjs';
import { sourceToGltfMatrix } from '../../shared/cad/assembly.mjs';
const base = new URL('./', import.meta.url);

export async function buildSceneIndex() {
  const [bytes, manifest, contract, provenance] = await Promise.all([
    readFile(new URL('assets/assembly.glb', base)),
    readFile(new URL('assets/assembly-manifest.json', base), 'utf8').then(JSON.parse),
    readFile(new URL('assets/scene-contract.json', base), 'utf8').then(JSON.parse),
    readFile(new URL('source/provenance.json', base), 'utf8').then(JSON.parse),
  ]);
  assert.equal(manifest.source.sha256, provenance.sourceSHA256);
  const { json, buffer } = readGlb(bytes), glbSHA256 = sha256(bytes);
  const occurrenceMap = new Map(manifest.occurrences.map(row => [row.occurrence_id, row]));
  const definitions = new Map(manifest.definitions.map(row => [row.definition_id, row]));
  const semanticNodes = new Map(json.nodes.filter(node => node.extras?.part_id).map(node => [node.extras.part_id, node]));
  const boxRecord = box => ({ min: box.min.toArray(), max: box.max.toArray() });
  const allBounds = new Box3();
  const vertex = new Vector3();
  const parts = contract.parts.map(part => {
    const occurrence = occurrenceMap.get(part.part_id);
    assert.ok(occurrence, 'Display part belongs to the retained occurrence graph');
    const node = semanticNodes.get(part.part_id);
    assert.ok(node, 'One source-bound semantic node per part');
    const meshNodes = node.mesh !== undefined ? [node] : (node.children ?? []).map(i => json.nodes[i]).filter(child => child.extras?.displayOnly && child.extras.ownerOccurrenceId === part.part_id);
    assert.ok(meshNodes.length, 'Real owned CAD geometry exists');
    const local = new Matrix4().fromArray(sourceToGltfMatrix(occurrence.localMatrixSource));
    const world = new Matrix4().fromArray(sourceToGltfMatrix(occurrence.worldMatrixSource));
    const worldBounds = new Box3();
    for (const meshNode of meshNodes) for (const primitive of json.meshes[meshNode.mesh].primitives) {
      const accessor = json.accessors[primitive.attributes.POSITION];
      assert.equal(accessor.type, 'VEC3'); assert.equal(accessor.componentType, 5126);
      const view = json.bufferViews[accessor.bufferView];
      const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), stride = view.byteStride ?? 12;
      for (let i=0; i<accessor.count; i++) {
        const offset = start+i*stride;
        vertex.set(buffer.readFloatLE(offset), buffer.readFloatLE(offset+4), buffer.readFloatLE(offset+8)).applyMatrix4(world);
        worldBounds.expandByPoint(vertex);
      }
    }
    assert.ok(!worldBounds.isEmpty()); allBounds.union(worldBounds);
    return { id: part.part_id, name: occurrence.label, parentId: occurrence.parent_id, definitionId: part.definition_id, sourceKind: occurrence.kind,
      worldBounds: boxRecord(worldBounds), worldCenter: worldBounds.getCenter(new Vector3()).toArray(),
      localBounds: part.localBoundsGltfMeters, localMatrix: local.toArray(), worldMatrix: world.toArray(),
      triangleCount: definitions.get(part.definition_id).geometry.triangleCount,
      source: part.source, zeroPose: true };
  });
  const index = {
    schemaVersion: '1.0.0', geometryRevision: 'wolf-' + provenance.sourceSHA256.slice(0,12) + '-' + glbSHA256.slice(0,12) + '-xcaf-1', units: 'm',
    sourceRevision: provenance.commit, sourceSHA256: provenance.sourceSHA256, rootId: manifest.root_id,
    asset: { file: 'assets/assembly.glb', sha256: glbSHA256, assembledWorldBounds: boxRecord(allBounds), assembledWorldCenter: allBounds.getCenter(new Vector3()).toArray() },
    parts,
    assemblies: manifest.occurrences.filter(row => row.kind === 'assembly').map(row => ({ id: row.occurrence_id, name: row.label, parentId: row.parent_id, definitionId: row.definition_id, children: row.children,
      localMatrix: sourceToGltfMatrix(row.localMatrixSource), worldMatrix: sourceToGltfMatrix(row.worldMatrixSource), source: row.source })),
    boundsMethod: 'Every actual GLB FLOAT position transformed by the corresponding immutable OCCT-normalized occurrence world matrix; no source recentering.',
    limitations: ['Bounds describe triangulated display geometry, not exact B-rep measurement.', 'Source placements contain no recovered mates or validated physical assembly sequence.'],
  };
  await writeFile(new URL('assets/scene-index.json', base), JSON.stringify(index, null, 2)+'\n');
  return index;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildSceneIndex();
  console.log(JSON.stringify({ geometryRevision: result.geometryRevision, parts: result.parts.length, assemblies: result.assemblies.length, asset: result.asset }, null, 2));
}
