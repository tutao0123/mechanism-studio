/** Derive a display from XCAF's exact source definition / occurrence mapping. */
import { Matrix4, Vector3 } from 'three';
import { createAssemblyIndex, sourceToGltfMatrix } from '../../shared/cad/assembly.mjs';
import { boundsOf, readGlb } from '../../shared/assets/glb.mjs';
import { writeGlb } from '../../shared/assets/write-glb.mjs';
import { validateSceneContract } from '../../shared/assets/contract.mjs';

export function buildXcafDisplay(data, provenance, { mechanismId = 'step-example', sourceFile = 'source/assembly.step' } = {}) {
  if (data.schema !== 'mechanism-studio-xcaf-1' || data.roots.length !== 1) throw new Error('This display requires one self-contained XCAF assembly root.');
  if (data.sourceSHA256 !== provenance.sourceSHA256) throw new Error('XCAF input and retained source provenance disagree.');
  const names = data.units?.sourceLengthNames;
  if (data.units?.importedLength !== 'mm' || !Array.isArray(names) || !names.length || new Set(names).size !== 1 || !['millimetre', 'metre'].includes(names[0])) throw new Error('Display requires one explicit metre or millimetre source unit and OCCT-normalized millimetre geometry/placements.');
  const originalLengthUnit = names[0] === 'metre' ? 'm' : 'mm';
  const limitations = [...data.limitations];
  const sourceTriangleLimitation = 'Some source faces contain embedded triangulation without an analytic surface; their exact source identities and triangles are retained, but analytic B-rep bounds/measurement are unavailable for those faces.';
  if (data.definitions.some(d => d.geometry?.sourceTriangulatedFaceCount) && !limitations.includes(sourceTriangleLimitation)) limitations.push(sourceTriangleLimitation);
  if (provenance.sourceLengthUnit !== undefined && provenance.sourceLengthUnit !== originalLengthUnit) throw new Error('Provenance sourceLengthUnit disagrees with XCAF original source units.');
  // Historical *Source matrices and *SourceMm bounds store OCCT's imported
  // coordinates. Keep mm packages byte-compatible; native-m packages explicitly
  // distinguish unchanged file units from these normalized mm coordinates.
  const normalization = originalLengthUnit === 'm' ? { originalLengthUnit: 'm', importedLengthUnit: 'mm', originalToImportedScale: 1000, matrixCoordinateUnit: 'mm', geometryCoordinateUnit: 'mm', method: 'OCCT xstep.cascade.unit=MM; original STEP bytes and file unit names retained' } : null;
  const manifest = {
    schemaVersion: '1.0.0', root_id: data.roots[0],
    source: { file: sourceFile, sha256: data.sourceSHA256, units: { length: 'mm', angle: 'rad' }, coordinateBasis: 'native STEP axes', sourceUnits: data.units, importer: data.importer, provenance, ...(normalization ? { originalLengthUnit, coordinateNormalization: normalization } : {}) },
    definitions: data.definitions.map(({ geometry, ...definition }) => ({ ...definition, ...(geometry ? { geometry: { triangleCount: geometry.triangleCount, solidCount: geometry.solidCount, boundsSourceMm: geometry.boundsMm, brepBoundsSourceMm: geometry.brepBoundsMm, faceTriangleRanges: geometry.faces,
      ...(geometry.representation ? { representation: geometry.representation, sourceTriangulatedFaceCount: geometry.sourceTriangulatedFaceCount, analyticFaceCount: geometry.analyticFaceCount, boundsEvidence: geometry.boundsEvidence } : {}) } } : {}) })),
    occurrences: data.occurrences.map(({ localMatrixMm, worldMatrixMm, name, ...occurrence }) => ({ ...occurrence, label: name || data.definitions.find(definition => definition.definition_id === occurrence.definition_id).name, localMatrixSource: localMatrixMm, worldMatrixSource: worldMatrixMm })),
    limitations,
  };
  const index = createAssemblyIndex(manifest), definitions = new Map(data.definitions.map(definition => [definition.definition_id, definition]));
  const nodes = [], meshes = [], meshIndices = new Map(), nodeIndices = new Map(), parts = [], worldPoints = [], instanceBounds = new Map(), ownedBodies = [];
  const mapPoint = ([x, y, z]) => [x * .001, z * .001, -y * .001];
  const mapNormal = ([x, y, z]) => [x, z, -y];
  const triples = values => Array.from({ length: values.length / 3 }, (_, i) => values.slice(i * 3, i * 3 + 3));
  for (const definition of data.definitions) if (definition.geometry) {
    const geometry = definition.geometry, positions = triples(geometry.positions).map(mapPoint).flat();
    meshIndices.set(definition.definition_id, meshes.length);
    meshes.push({ name: definition.name, positions, normals: triples(geometry.normals).map(mapNormal).flat(), indices: geometry.indices, color: [.88, .88, .86], extras: { definition_id: definition.definition_id, sourceProductDefinition: definition.source.productDefinitionEntity, faceTriangleRanges: geometry.faces, ...(geometry.representation ? { geometryRepresentation: geometry.representation } : {}) } });
  }
  for (const occurrence of manifest.occurrences) {
    const id = occurrence.occurrence_id, matrix = sourceToGltfMatrix(occurrence.localMatrixSource), source = occurrence.source;
    const hasGeometry = meshIndices.has(occurrence.definition_id);
    const node = { name: occurrence.label, matrix, extras: { [hasGeometry ? 'part_id' : 'assembly_id']: id, definition_id: occurrence.definition_id, source, sourceKind: occurrence.kind, ...(hasGeometry ? { motionOwner: 'static' } : {}) } };
    if (occurrence.kind === 'assembly') node.children = [];
    if (hasGeometry) {
      const meshIndex = meshIndices.get(occurrence.definition_id);
      if (occurrence.kind === 'assembly') ownedBodies.push({ node, meshIndex, id });
      else node.mesh = meshIndex;
      const world = new Matrix4().fromArray(sourceToGltfMatrix(occurrence.worldMatrixSource));
      const positions = triples(meshes[meshIndex].positions), transformed = positions.map(point => new Vector3(...point).applyMatrix4(world).toArray());
      const bounds = boundsOf(transformed); instanceBounds.set(id, bounds); worldPoints.push(...transformed);
      parts.push({ part_id: id, parent_id: occurrence.parent_id, definition_id: occurrence.definition_id, sourceKind: occurrence.kind, label: occurrence.label, motionOwner: 'static', rest: { matrix }, explode: [0, 0, 0], source: { ...source, definition: definitions.get(occurrence.definition_id).source, mapping: 'exact-STEP-NAUO-to-XCAF-reference' }, localBoundsGltfMeters: boundsOf(positions) });
    }
    nodeIndices.set(id, nodes.length); nodes.push(node);
  }
  for (const occurrence of manifest.occurrences) if (occurrence.parent_id) nodes[nodeIndices.get(occurrence.parent_id)].children.push(nodeIndices.get(occurrence.occurrence_id));
  for (const { node, meshIndex, id } of ownedBodies) {
    node.children.push(nodes.length);
    nodes.push({ name: `${node.name} / owned body`, mesh: meshIndex, extras: { displayOnly: true, ownerOccurrenceId: id } });
  }
  const assetBounds = boundsOf(worldPoints), center = new Vector3(...assetBounds.min).add(new Vector3(...assetBounds.max)).multiplyScalar(.5);
  const span = Math.max(...assetBounds.max.map((value, i) => value - assetBounds.min[i]));
  // Observation only: offset each instance away from the fixed assembled centre.
  // Convert the world delta into the real parent axes before applying it to the
  // display wrapper. No source placement is recentered or overwritten.
  for (const part of parts) {
    // A geometry-bearing assembly also parents source components. Moving its
    // wrapper would move those children a second time; leave its own housing
    // body at rest and explode its descendants independently.
    if (part.sourceKind === 'assembly') continue;
    const bounds = instanceBounds.get(part.part_id), position = new Vector3(...bounds.min).add(new Vector3(...bounds.max)).multiplyScalar(.5);
    const delta = position.sub(center);
    if (delta.lengthSq() < 1e-14) delta.set(0, 1, 0);
    delta.normalize().multiplyScalar(span * .28);
    const parent = index.get(part.parent_id), parentWorld = new Matrix4().fromArray(sourceToGltfMatrix(parent.worldMatrixSource));
    const inverse = parentWorld.clone().invert(), origin = new Vector3().applyMatrix4(inverse);
    part.explode = delta.applyMatrix4(inverse).sub(origin).toArray();
  }
  const contract = { schemaVersion: '1.0.0', mechanismId, assetRevision: '1', units: { source: originalLengthUnit, ...(normalization ? { imported: 'mm' } : {}), asset: 'm', angle: 'rad' }, sourceSHA256: data.sourceSHA256, coordinateMap: '0.001*[x,z,-y]; local matrix C*M*C^-1', identity: 'part_id equals occurrence_id; shared definition meshes retain separate occurrence nodes', limitations, parts };
  const glb = writeGlb({ nodes, scenes: [{ name: provenance.title, nodes: [nodeIndices.get(manifest.root_id)] }], meshes, extras: { sourceSHA256: data.sourceSHA256, units: 'm', sourceUnits: originalLengthUnit, ...(normalization ? { importedUnits: 'mm' } : {}), coordinateMap: contract.coordinateMap, importer: data.importer }, generator: 'Mechanism Studio / OCCT XCAF definition-instance exporter' });
  validateSceneContract(readGlb(glb).json, contract);
  const display = { meshDefinitions: meshes.length, semanticPartNodes: parts.length, triangles: parts.reduce((sum, part) => sum + definitions.get(part.definition_id).geometry.triangleCount, 0), uniqueTriangles: meshes.reduce((sum, mesh) => sum + mesh.indices.length / 3, 0), assetBoundsMeters: assetBounds };
  return { manifest, contract, glb, display };
}
