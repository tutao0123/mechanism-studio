import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Matrix4, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sha256, readGlb, boundsOf, accessorValues } from '../../../shared/assets/glb.mjs';
import { validateSceneContract, assertNearVector } from '../../../shared/assets/contract.mjs';
import { createAssemblyIndex, createAssemblyInspection, sourceToGltfMatrix, multiplyMatrices } from '../../../shared/cad/assembly.mjs';
import { bindAssembly, applyDisplayExplosion, resetDisplay } from '../../../shared/viewer/scene.mjs';
import { extractStepMetadata } from '../../../tools/cad/step-metadata.mjs';

const base = new URL('../', import.meta.url), json = async path => JSON.parse(await readFile(new URL(path, base), 'utf8'));
const [source, bytes, provenance, manifest, contract, report] = await Promise.all([readFile(new URL('source/assembly.step', base)), readFile(new URL('assets/assembly.glb', base)), json('source/provenance.json'), json('assets/assembly-manifest.json'), json('assets/scene-contract.json'), json('assets/import-report.json')]);
const { json: gltf, buffer } = readGlb(bytes), index = createAssemblyIndex(manifest), raw = extractStepMetadata(source.toString('utf8'));
const sourceHash = 'd3a699b72a8cbdf7fc3acc70078870df141efb0a62991f8fa0bebd3ee56405bf';
const byId = new Map(gltf.nodes.filter(node => node.extras?.part_id || node.extras?.assembly_id).map(node => [node.extras.part_id || node.extras.assembly_id, node]));

test('real unmodified STEP, pinned license and complete source product/usage graph agree', () => {
  assert.equal(sha256(source), sourceHash); assert.equal(source.length, 17919625); assert.equal(provenance.sourceSHA256, sourceHash);
  assert.equal(provenance.commit, '98f8a37944d7277cd37231776400553cc402219f'); assert.equal(provenance.license, 'GPL-3.0'); assert.equal(provenance.modified, false);
  assert.equal(raw.products.length, 69); assert.equal(raw.occurrences.length, 146);
  assert.equal(manifest.definitions.length, 69); assert.equal(manifest.occurrences.length, 147); assert.equal(index.leafIds.length, 126);
  // STEP also declares metres for derived density units; geometry contexts use
  // millimetres, as independently returned by OCCT FileUnits.
  assert.deepEqual(raw.lengthUnits.map(unit => unit.unit), ['mm', 'm']);
  assert.deepEqual(report.sourceUnits.sourceLengthNames, ['millimetre']);
  const rawDefinitions = new Map(raw.definitions.map(definition => [definition.entity, definition]));
  const rawOccurrences = new Map(raw.occurrences.map(occurrence => [occurrence.entity, occurrence]));
  for (const definition of manifest.definitions) assert.equal(rawDefinitions.get(definition.source.productDefinitionEntity).product, definition.source.productEntity);
  for (const occurrence of manifest.occurrences) {
    const definition = index.definition(occurrence.definition_id);
    if (!occurrence.parent_id) { assert.equal(occurrence.source.nauoEntity, null); continue; }
    const usage = rawOccurrences.get(occurrence.source.nauoEntity), parent = index.definition(index.get(occurrence.parent_id).definition_id);
    assert.ok(usage); assert.equal(usage.childDefinition, definition.source.productDefinitionEntity); assert.equal(usage.parentDefinition, parent.source.productDefinitionEntity);
  }
  assert.equal(report.identityMapping.unmappedSourceOccurrences, 0);
});

test('repeated real M3 screws share geometry definitions but retain distinct source paths and placements', () => {
  for (const [sourceDefinition, count] of [['#230452', 3], ['#230453', 5]]) {
    const definition = manifest.definitions.find(definition => definition.source.productDefinitionEntity === sourceDefinition);
    const instances = manifest.occurrences.filter(occurrence => occurrence.definition_id === definition.definition_id);
    assert.equal(instances.length, count); assert.equal(new Set(instances.map(instance => instance.occurrence_id)).size, count);
    assert.equal(new Set(instances.map(instance => JSON.stringify(instance.worldMatrixSource))).size, count);
    assert.equal(new Set(instances.map(instance => byId.get(instance.occurrence_id).mesh)).size, 1);
    assert.ok(instances.every(instance => instance.occurrence_id.endsWith(instance.source.nauoEntity.slice(1))));
  }
  const shaft = manifest.definitions.find(definition => definition.source.productDefinitionEntity === '#230437');
  const holder = manifest.definitions.find(definition => definition.source.productDefinitionEntity === '#230427');
  assert.equal(shaft.name, 'Carrier'); assert.equal(holder.name, 'front_bearing_holder');
});

test('GLB hierarchy and all local/world matrices preserve the actual engineering occurrence tree', () => {
  validateSceneContract(gltf, contract); assert.equal(sha256(bytes), report.glbSHA256); assert.equal(gltf.extras.sourceSHA256, sourceHash);
  assert.equal(byId.size, manifest.occurrences.length); assert.equal(contract.parts.length, index.displayIds.length);
  const parentIndices = new Map(); gltf.nodes.forEach((node, parent) => (node.children || []).forEach(child => parentIndices.set(child, parent)));
  const worldCache = new Map();
  function world(nodeIndex) { if (worldCache.has(nodeIndex)) return worldCache.get(nodeIndex); const local = gltf.nodes[nodeIndex].matrix || new Matrix4().elements; const parent = parentIndices.get(nodeIndex); const result = parent === undefined ? local : multiplyMatrices(world(parent), local); worldCache.set(nodeIndex, result); return result; }
  for (const occurrence of manifest.occurrences) {
    const node = byId.get(occurrence.occurrence_id), nodeIndex = gltf.nodes.indexOf(node), parent = gltf.nodes[parentIndices.get(nodeIndex)];
    assert.equal(parent?.extras?.assembly_id || parent?.extras?.part_id || null, occurrence.parent_id);
    assertNearVector(node.matrix, sourceToGltfMatrix(occurrence.localMatrixSource), 1e-12);
    assertNearVector(world(nodeIndex), sourceToGltfMatrix(occurrence.worldMatrixSource), 1e-10);
  }
  assert.equal(gltf.animations, undefined);
});

test('binary mesh derivatives have valid indexed geometry and assembled metre bounds', () => {
  const points = [];
  for (const id of index.displayIds) {
    const node = byId.get(id), meshNode = node.mesh === undefined ? gltf.nodes[node.children.find(child => gltf.nodes[child].extras?.displayOnly)] : node;
    const mesh = gltf.meshes[meshNode.mesh], world = new Matrix4().fromArray(sourceToGltfMatrix(index.get(id).worldMatrixSource));
    for (const primitive of mesh.primitives) {
      const positions = accessorValues(gltf, buffer, primitive.attributes.POSITION), normals = accessorValues(gltf, buffer, primitive.attributes.NORMAL), indices = accessorValues(gltf, buffer, primitive.indices).flat();
      assert.equal(positions.length, normals.length); assert.equal(indices.length % 3, 0);
      assert.ok(indices.every(value => value >= 0 && value < positions.length));
      assert.ok(normals.every(normal => Math.abs(Math.hypot(...normal) - 1) < 1e-5));
      for (const point of positions) points.push(new Vector3(...point).applyMatrix4(world).toArray());
    }
  }
  const bounds = boundsOf(points); assertNearVector(bounds.min, report.display.assetBoundsMeters.min, 3e-8); assertNearVector(bounds.max, report.display.assetBoundsMeters.max, 3e-8);
});
test('a corrupted engineering rest matrix or double transform fails the display contract', () => {
  const broken = structuredClone(gltf), part = contract.parts[0], nodeIndex = gltf.nodes.indexOf(byId.get(part.part_id));
  broken.nodes[nodeIndex].matrix[12] += .001;
  assert.throws(() => validateSceneContract(broken, contract), /rest matrix/);
  broken.nodes[nodeIndex].matrix = [...gltf.nodes[nodeIndex].matrix]; broken.nodes[nodeIndex].translation = [0, 0, 0];
  assert.throws(() => validateSceneContract(broken, contract), /one exported transform representation/);
});

test('actual viewer bindings preserve repeated picks and source transforms across observation changes', async () => {
  const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const assembly = bindAssembly(asset.scene, { contract }); asset.scene.updateMatrixWorld(true);
  assert.equal(assembly.parts.size, index.displayIds.length);
  const before = new Map([...assembly.parts].map(([id, binding]) => [id, binding.node.matrix.toArray()]));
  for (const mesh of assembly.meshes) assert.ok(index.displayIds.includes(mesh.userData.selectionId));
  const screwDefinition = manifest.definitions.find(definition => definition.source.productDefinitionEntity === '#230453'), screws = manifest.occurrences.filter(occurrence => occurrence.definition_id === screwDefinition.definition_id);
  assert.equal(new Set(screws.map(screw => assembly.parts.get(screw.occurrence_id).node)).size, 5);
  for (const screw of screws) {
    const binding = assembly.parts.get(screw.occurrence_id); binding.node.updateWorldMatrix(true, false);
    assertNearVector(binding.node.matrixWorld.toArray(), sourceToGltfMatrix(screw.worldMatrixSource), 1e-8);
  }
  const state = createAssemblyInspection(manifest), engineeringBefore = JSON.stringify(state.index.manifest);
  state.select(screws[0].occurrence_id); state.isolate(); state.setExplode(.7);
  applyDisplayExplosion(assembly.parts, .7); resetDisplay(assembly.parts); state.resetObservation();
  assert.equal(JSON.stringify(state.index.manifest), engineeringBefore);
  for (const [id, binding] of assembly.parts) { assertNearVector(binding.node.matrix.toArray(), before.get(id), 1e-12); assert.equal(binding.display.visible, true); assertNearVector(binding.display.position.toArray(), [0, 0, 0]); }
});

test('remeshing comparison is explicit and geometry gaps remain disclosed', () => {
  assert.equal(report.tessellationComparison.definitionAndOccurrenceIdentityUnchanged, true);
  assert.equal(report.tessellationComparison.localAndWorldMatricesUnchanged, true);
  assert.ok(report.tessellationComparison.coarse.triangles < report.tessellationComparison.fine.triangles);
  assert.equal(report.sourceStatistics.sourceNauoCount, 146);
  assert.equal(report.mixedProducts.length, 1);
  assert.ok(Array.isArray(report.meshWarnings));
});
