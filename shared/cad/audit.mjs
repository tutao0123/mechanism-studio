/** In-memory evidence audit. Verifies a retained CAD/display package; never solves mates or measures B-reps. */
import { createAssemblyIndex, multiplyMatrices, sourceToGltfMatrix } from './assembly.mjs';
import { readGlb, sha256, accessorValues } from '../assets/glb.mjs';
import { validateSceneContract } from '../assets/contract.mjs';

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const COORDINATE_MAP = '0.001*[x,z,-y]; local matrix C*M*C^-1';
const requireEvidence = (condition, message) => { if (!condition) throw new Error(message); };
const equalSet = (actual, expected) => actual.length === expected.length && new Set(actual).size === actual.length && actual.every(id => expected.includes(id));
const nearMatrix = (actual, expected) => Array.isArray(actual) && actual.length === 16 && actual.every((n, i) => Number.isFinite(n) && Math.abs(n - expected[i]) <= 1e-8 + Math.abs(expected[i]) * 1e-9);
const clone = value => JSON.parse(JSON.stringify(value));

/** Restricted spatial-unit evidence only, not a STEP conformance parser. */
function retainedSpatialLengthUnit(bytes) {
  const text = bytes.toString('latin1').replace(/\/\*[\s\S]*?\*\/|'(?:[^']|'')*'/g, ' ');
  const units = new Map(), contexts = [];
  for (const [, id, raw] of text.matchAll(/#(\d+)\s*=\s*([^;]*);/g)) {
    if (/\bLENGTH_UNIT\s*\(/i.test(raw)) units.set(`#${id}`, /\bSI_UNIT\s*\(\s*\.MILLI\.\s*,\s*\.METRE\.\s*\)/i.test(raw) ? 'mm' : /\bSI_UNIT\s*\(\s*\$\s*,\s*\.METRE\.\s*\)/i.test(raw) ? 'm' : 'unsupported');
    if (!/\bGEOMETRIC_REPRESENTATION_CONTEXT\s*\(/i.test(raw)) continue;
    const assigned = raw.match(/\bGLOBAL_UNIT_ASSIGNED_CONTEXT\s*\(\s*\(([^)]*)\)\s*\)/i);
    if (!assigned && /\bGEOMETRIC_REPRESENTATION_CONTEXT\s*\(\s*2\s*\)/i.test(raw) && /\bPARAMETRIC_REPRESENTATION_CONTEXT\s*\(\s*\)/i.test(raw)) continue;
    requireEvidence(assigned, 'Retained STEP spatial context has no explicit length unit.');
    contexts.push(assigned[1].match(/#\d+/g) || []);
  }
  const lengths = contexts.map(refs => {
    const assigned = refs.filter(ref => units.has(ref)).map(ref => units.get(ref));
    requireEvidence(assigned.length === 1 && ['m', 'mm'].includes(assigned[0]), 'Retained STEP has unsupported or ambiguous spatial length units.');
    return assigned[0];
  });
  requireEvidence(lengths.length && new Set(lengths).size === 1, 'Retained STEP must declare uniform explicit metre or millimetre spatial contexts.');
  return lengths[0];
}

/**
 * `sourceMetadata` is optional output from a separately chosen source parser.
 * Only the retained AP214/AP242 PRODUCT_DEFINITION/NAUO subset is checked.
 * A missing manifest/parser is reported as limited, never promoted to source identity.
 */
export function inspectCadEvidence({ sourceBytes, provenance, manifest, contract, importReport, glbBytes, sourceMetadata } = {}) {
  const checks = [], capabilities = {}, summary = {};
  function check(id, action) {
    try {
      const result = action() || {};
      checks.push({ id, status: result.limited ? 'limited' : 'passed', message: result.message || 'Evidence agrees.', ...(result.details ? { details: result.details } : {}) });
      return true;
    } catch (error) { checks.push({ id, status: 'failed', message: error.message }); return false; }
  }
  let gltf, buffer, index, parents, semantic, bindings;
  check('source-integrity', () => {
    requireEvidence(Buffer.isBuffer(sourceBytes) && sourceBytes.length > 0, 'Retained nonempty source bytes are required.');
    summary.sourceSHA256 = sha256(sourceBytes);
    const declarations = [['provenance', provenance?.sourceSHA256], ['scene contract', contract?.sourceSHA256], ['import report', importReport?.sourceSHA256 ?? importReport?.source?.sourceSHA256]];
    if (manifest) declarations.push(['assembly manifest', manifest.source?.sha256]);
    for (const [label, hash] of declarations) requireEvidence(hash === summary.sourceSHA256, `${label} source hash is missing or differs from retained source bytes.`);
    if (provenance?.sourceByteLength !== undefined) requireEvidence(provenance.sourceByteLength === sourceBytes.length, 'Provenance source byte length differs.');
    return { message: 'Retained bytes agree with every declared source hash.', details: { sourceByteLength: sourceBytes.length } };
  });
  check('source-provenance', () => {
    if (provenance?.sourceType === 'user-provided' && provenance?.redistribution === 'not-authorized') {
      return { limited: true, message: 'Local inspection permitted; public redistribution not established. User-provided source has no inferred public license grant.', details: { sourceType: 'user-provided', redistribution: 'not-authorized', author: provenance.author || null } };
    }
    requireEvidence(provenance && typeof provenance.author === 'string' && provenance.author.length > 0, 'Source author is required.');
    requireEvidence(typeof provenance.license === 'string' && provenance.license.length > 0, 'Source license is required.');
    requireEvidence(typeof provenance.url === 'string' && /^https?:\/\//.test(provenance.url), 'Source URL is required.');
    requireEvidence(typeof provenance.licenseUrl === 'string' && /^https?:\/\//.test(provenance.licenseUrl), 'License evidence URL is required.');
    return { message: 'Author, source URL and declared license evidence are retained; this audit does not grant a license.', details: { author: provenance.author, license: provenance.license, url: provenance.url, revision: provenance.commit || null } };
  });
  const assetValid = check('display-contract', () => {
    ({ json: gltf, buffer } = readGlb(glbBytes));
    summary.glbSHA256 = sha256(glbBytes);
    requireEvidence(gltf.extras?.sourceSHA256 === summary.sourceSHA256, 'GLB source hash is missing or differs from retained source.');
    requireEvidence(importReport?.glbSHA256 === summary.glbSHA256, 'Import report GLB hash is missing or differs from actual GLB bytes.');
    validateSceneContract(gltf, contract);
    return { message: 'Self-contained GLB, source hash and scene contract agree.', details: { displayParts: contract.parts.length } };
  });
  if (!manifest) {
    checks.push({ id: 'assembly-manifest', status: 'limited', message: 'No source definition/occurrence manifest is supplied. Mesh fragments cannot establish engineering identity.' });
  } else check('assembly-manifest', () => {
    index = createAssemblyIndex(manifest);
    Object.assign(summary, { definitions: manifest.definitions.length, occurrences: index.occurrenceIds.length, leafOccurrences: index.leafIds.length, displayOccurrences: index.displayIds.length, geometryBearingAssemblies: manifest.definitions.filter(d => d.kind === 'assembly' && d.geometry).length });
    return { message: 'Unique source identities, rooted parentage and parent-world × local placements are internally consistent.' };
  });
  if (index) {
    check('source-definition-usage', () => {
      if (!sourceMetadata || !/AUTOMOTIVE_DESIGN|AP214|AP242/i.test(sourceMetadata.schema || '')) return { limited: true, message: 'No supported AP214/AP242 product/usage source extraction was supplied; manifest identities have not been checked against STEP entities.' };
      const definitions = new Map(sourceMetadata.definitions?.map(d => [d.entity, d]) || []);
      const usages = new Map(sourceMetadata.occurrences?.map(o => [o.entity, o]) || []);
      requireEvidence(definitions.size > 0 && usages.size > 0, 'Source extraction must contain product definitions and usage relationships.');
      requireEvidence(equalSet(manifest.definitions.map(d => d.source?.productDefinitionEntity), [...definitions.keys()]), 'Manifest definitions do not exactly cover extracted source product definitions.');
      for (const definition of manifest.definitions) requireEvidence(definitions.get(definition.source.productDefinitionEntity).product === definition.source.productEntity, `${definition.definition_id} source PRODUCT and PRODUCT_DEFINITION disagree.`);
      for (const id of index.occurrenceIds) {
        const occurrence = index.get(id), definition = index.definition(occurrence.definition_id), entity = definition.source.productDefinitionEntity;
        const expected = [...usages.values()].filter(usage => usage.parentDefinition === entity).map(usage => usage.entity);
        const actual = index.children(id).map(child => index.get(child).source.nauoEntity);
        requireEvidence(equalSet(actual, expected), `${id} source usage children are missing, duplicated or unrelated.`);
        requireEvidence((expected.length > 0 ? 'assembly' : 'part') === occurrence.kind, `${id} kind disagrees with extracted source usage relationships.`);
        if (occurrence.parent_id === null) { requireEvidence(occurrence.source.nauoEntity === null, 'Source root must not claim a NAUO instance.'); continue; }
        const usage = usages.get(occurrence.source.nauoEntity), parentDefinition = index.definition(index.get(occurrence.parent_id).definition_id);
        requireEvidence(usage && usage.childDefinition === entity && usage.parentDefinition === parentDefinition.source.productDefinitionEntity, `${id} source parent/child definition mapping disagrees with NAUO.`);
        requireEvidence(usage.occurrenceId === occurrence.source.occurrenceId, `${id} source occurrence token differs from NAUO.`);
      }
      summary.sourceUsageRelations = usages.size;
      return { message: 'Every extracted source definition and per-parent NAUO expansion agrees. Names and mesh order are not identity evidence.', details: { schema: sourceMetadata.schema, scope: 'AP214/AP242 PRODUCT_DEFINITION and NAUO subset; not full protocol conformance, native placement re-evaluation or mate extraction' } };
    });
  }
  let coordinateSupported = false;
  if (index && assetValid) {
    check('coordinate-convention', () => {
      requireEvidence(gltf.extras?.coordinateMap === contract.coordinateMap && gltf.extras?.units === contract.units?.asset && gltf.extras?.sourceUnits === contract.units?.source, 'GLB coordinate convention disagrees with the scene contract.');
      const original = contract.units?.source;
      const declaresSpatialContexts = Buffer.isBuffer(sourceBytes) && /\bGEOMETRIC_REPRESENTATION_CONTEXT\s*\(/i.test(sourceBytes.toString('latin1').replace(/\/\*[\s\S]*?\*\/|'(?:[^']|'')*'/g, ' '));
      if (declaresSpatialContexts || original === 'm') requireEvidence(retainedSpatialLengthUnit(sourceBytes) === original, 'Declared original source unit disagrees with retained STEP spatial units.');
      if (['mm', 'm'].includes(original)) requireEvidence(provenance?.sourceLengthUnit === undefined || provenance.sourceLengthUnit === original, 'Provenance sourceLengthUnit contradicts retained STEP.');
      if (original === 'm') {
        const normalization = manifest.source.coordinateNormalization;
        requireEvidence(manifest.source.units?.length === 'mm' && manifest.source.originalLengthUnit === 'm' && normalization?.originalLengthUnit === 'm' && normalization.importedLengthUnit === 'mm' && normalization.originalToImportedScale === 1000 && normalization.matrixCoordinateUnit === 'mm' && normalization.geometryCoordinateUnit === 'mm', 'Native-metre package must explicitly declare OCCT-normalized millimetre coordinates and a 1000 original-to-imported scale.');
        for (const [label, units] of [['manifest', manifest.source.sourceUnits], ['import report', importReport.sourceUnits]]) requireEvidence(units?.importedLength === 'mm' && Array.isArray(units.sourceLengthNames) && units.sourceLengthNames.length && units.sourceLengthNames.every(name => name === 'metre'), `${label} original metre unit names and imported millimetre unit are missing or contradictory.`);
        requireEvidence(contract.units.imported === 'mm' && gltf.extras?.importedUnits === 'mm', 'Contract and GLB must identify their OCCT-normalized millimetre input coordinate unit.');
      }
      coordinateSupported = contract.coordinateMap === COORDINATE_MAP && ['mm', 'm'].includes(original) && contract.units?.asset === 'm' && manifest.source.units?.length === 'mm';
      if (!coordinateSupported) return { limited: true, message: 'This audit only converts mm coordinates (+Z to m/+Y) via C*M*C^-1, with explicit normalization evidence required for original metre files. No other mapping is assumed.' };
      return { message: original === 'm' ? 'Retained STEP declares metres; OCCT-normalized mm coordinates convert once to m/[x,z,-y] display placements.' : 'Explicit mm/[x,z,-y] source-to-display matrix convention is supported.' };
    });
    check('exported-identity-hierarchy', () => {
      semantic = new Map(); parents = new Map();
      gltf.nodes.forEach((node, nodeIndex) => {
        const id = node.extras?.part_id ?? node.extras?.assembly_id;
        if (id !== undefined) { requireEvidence(!semantic.has(id), `Duplicate exported identity ${id}.`); semantic.set(id, nodeIndex); }
        for (const child of node.children || []) parents.set(child, nodeIndex);
      });
      requireEvidence(equalSet([...semantic.keys()], index.occurrenceIds), 'Exported semantic identities differ from source occurrences.');
      requireEvidence(equalSet(contract.parts.map(p => p.part_id), index.displayIds), 'Contract display owners differ from geometry-bearing source occurrences.');
      const scene = gltf.scenes?.[gltf.scene ?? 0];
      requireEvidence(scene?.nodes?.length === 1 && scene.nodes[0] === semantic.get(index.rootId), 'Exported scene must root at the actual source assembly occurrence.');
      for (const id of index.occurrenceIds) {
        const occurrence = index.get(id), nodeIndex = semantic.get(id), node = gltf.nodes[nodeIndex], parent = gltf.nodes[parents.get(nodeIndex)];
        requireEvidence((parent?.extras?.part_id ?? parent?.extras?.assembly_id ?? null) === occurrence.parent_id, `${id} exported parent differs from source hierarchy.`);
        requireEvidence(node.extras.definition_id === occurrence.definition_id && node.extras.sourceKind === occurrence.kind, `${id} exported definition or engineering kind differs.`);
        const exportedIdKind = index.displayIds.includes(id) ? 'part_id' : 'assembly_id';
        requireEvidence(node.extras[exportedIdKind] === id, `${id} must retain its correct source/display ownership.`);
        if (index.displayIds.includes(id)) { const part = contract.parts.find(p => p.part_id === id); requireEvidence(part.definition_id === occurrence.definition_id && part.sourceKind === occurrence.kind, `${id} contract definition or source kind differs.`); }
      }
      return { message: 'Pure assemblies, parts and geometry-bearing assemblies retain exact exported parentage and semantic ownership.' };
    });
    if (semantic && coordinateSupported) check('engineering-display-placements', () => {
      const cache = new Map();
      function world(nodeIndex) {
        if (cache.has(nodeIndex)) return cache.get(nodeIndex);
        const node = gltf.nodes[nodeIndex];
        requireEvidence(node.matrix && !node.translation && !node.rotation && !node.scale, `${nodeIndex} must have one explicit matrix transform.`);
        const parent = parents.get(nodeIndex), result = parent === undefined ? node.matrix : multiplyMatrices(world(parent), node.matrix);
        cache.set(nodeIndex, result); return result;
      }
      for (const id of index.occurrenceIds) {
        const occurrence = index.get(id), nodeIndex = semantic.get(id), node = gltf.nodes[nodeIndex];
        requireEvidence(nearMatrix(node.matrix, sourceToGltfMatrix(occurrence.localMatrixSource)), `${id} display local matrix differs from source C*M*C^-1.`);
        requireEvidence(nearMatrix(world(nodeIndex), sourceToGltfMatrix(occurrence.worldMatrixSource)), `${id} display world matrix differs from source C*M*C^-1.`);
      }
      return { message: 'Actual exported local/world matrices agree with the retained source manifest, including rotations; source placements are not independently recomputed from STEP.' };
    });
    if (semantic) check('definition-mesh-binding', () => {
      bindings = new Map(); const ownedMeshNodes = new Set(), definitionBindings = new Map();
      for (const id of index.displayIds) {
        const nodeIndex = semantic.get(id), node = gltf.nodes[nodeIndex], meshNodes = node.mesh === undefined ? [] : [nodeIndex];
        for (const childIndex of node.children || []) {
          const child = gltf.nodes[childIndex];
          if (child.mesh === undefined || child.extras?.part_id || child.extras?.assembly_id) continue;
          requireEvidence(child.extras?.displayOnly === true && child.extras.ownerOccurrenceId === id, `${id} anonymous body needs explicit ownerOccurrenceId.`);
          requireEvidence(nearMatrix(child.matrix || IDENTITY, IDENTITY) && !child.translation && !child.rotation && !child.scale, `${id} owned body applies an additional transform.`);
          meshNodes.push(childIndex);
        }
        requireEvidence(meshNodes.length > 0, `${id} has no owned display geometry.`);
        const definitionId = index.get(id).definition_id, meshIndices = meshNodes.map(n => gltf.nodes[n].mesh).sort((a, b) => a - b);
        for (const n of meshNodes) {
          ownedMeshNodes.add(n);
          const mesh = gltf.meshes?.[gltf.nodes[n].mesh];
          requireEvidence(mesh && mesh.extras?.definition_id === definitionId, `${id} mesh binds to a different source definition.`);
          requireEvidence(mesh.extras.sourceProductDefinition === index.definition(definitionId).source.productDefinitionEntity, `${id} mesh source PRODUCT_DEFINITION differs from its manifest definition.`);
        }
        const previous = definitionBindings.get(definitionId);
        if (previous) requireEvidence(JSON.stringify(previous) === JSON.stringify(meshIndices), `${definitionId} repeated instances do not share the same mesh bindings.`);
        else definitionBindings.set(definitionId, meshIndices);
        bindings.set(id, meshIndices);
      }
      requireEvidence(gltf.nodes.every((node, i) => node.mesh === undefined || ownedMeshNodes.has(i)), 'An exported mesh lacks an actual source display owner.');
      const counts = new Map(); for (const id of index.displayIds) { const d = index.get(id).definition_id; counts.set(d, (counts.get(d) || 0) + 1); }
      summary.reusedDisplayDefinitions = [...counts.values()].filter(n => n > 1).length;
      summary.displayMeshBindings = [...bindings.values()].reduce((n, meshes) => n + meshes.length, 0);
      return { message: 'Repeated definitions share actual meshes; occurrence nodes and geometry-bearing assembly bodies retain separate ownership.', details: { reusedDisplayDefinitions: summary.reusedDisplayDefinitions } };
    });
    if (bindings) check('mesh-face-evidence', () => {
      let uniqueTriangles = 0, recoveredFaces = 0, unmeshedFaces = 0; const diagnostics = [], seenWarnings = new Set();
      const warnings = importReport?.meshWarnings;
      requireEvidence(Array.isArray(warnings), 'Import report must explicitly retain meshWarnings, even when empty.');
      for (const definition of manifest.definitions.filter(d => d.geometry)) {
        const geometry = definition.geometry, occurrence = index.displayIds.find(id => index.get(id).definition_id === definition.definition_id);
        requireEvidence(occurrence, `${definition.definition_id} geometry has no source occurrence.`);
        const meshes = bindings.get(occurrence).map(i => gltf.meshes[i]); let triangleCount = 0;
        for (const mesh of meshes) for (const primitive of mesh.primitives || []) {
          requireEvidence((primitive.mode ?? 4) === 4, `${definition.definition_id} display primitive is not triangles.`);
          const positions = accessorValues(gltf, buffer, primitive.attributes.POSITION), indices = accessorValues(gltf, buffer, primitive.indices).flat();
          requireEvidence(indices.length % 3 === 0 && positions.length > 0 && positions.every(point => point.length === 3 && point.every(Number.isFinite)), `${definition.definition_id} has invalid triangle geometry.`);
          requireEvidence(indices.every(i => Number.isInteger(i) && i >= 0 && i < positions.length), `${definition.definition_id} indices escape vertex positions.`);
          triangleCount += indices.length / 3;
        }
        requireEvidence(triangleCount === geometry.triangleCount, `${definition.definition_id} triangle count differs from manifest.`);
        uniqueTriangles += triangleCount;
        const faces = geometry.faceTriangleRanges;
        requireEvidence(Array.isArray(faces) && faces.length > 0, `${definition.definition_id} is missing retained face ranges.`);
        requireEvidence(meshes.length === 1 && JSON.stringify(meshes[0].extras?.faceTriangleRanges) === JSON.stringify(faces), `${definition.definition_id} GLB face ranges disagree with source manifest.`);
        let next = 0; const faceIds = new Set();
        for (const face of faces) {
          requireEvidence(Number.isInteger(face.faceIndex) && face.faceIndex > 0 && !faceIds.has(face.faceIndex) && Number.isInteger(face.triangleCount) && face.triangleCount >= 0 && face.firstTriangle === next, `${definition.definition_id} has invalid/overlapping face ranges.`);
          faceIds.add(face.faceIndex); next += face.triangleCount;
          const exceptional = face.recovered === true || face.triangleCount === 0;
          if (!exceptional) continue;
          const key = `${definition.definition_id}/${face.faceIndex}`, matches = warnings.filter(w => w.definition_id === definition.definition_id && w.faceIndex === face.faceIndex);
          requireEvidence(matches.length === 1, `${key} recovered or unmeshed face is missing a unique import warning.`);
          const warning = matches[0]; seenWarnings.add(key);
          for (const field of ['firstTriangle', 'triangleCount', 'recovered', 'status', 'linearDeflectionMm', 'angularDeflectionRadians', 'nominalLinearDeflectionMm', 'nominalAngularDeflectionRadians']) requireEvidence(warning[field] === face[field], `${key} warning ${field} disagrees with retained face evidence.`);
          requireEvidence(JSON.stringify(warning.attempts) === JSON.stringify(face.attempts), `${key} warning recovery attempts disagree with retained face evidence.`);
          if (face.recovered === true) {
            recoveredFaces++;
            requireEvidence(face.triangleCount > 0 && Number.isFinite(face.linearDeflectionMm) && face.linearDeflectionMm > 0 && Number.isFinite(face.angularDeflectionRadians) && face.angularDeflectionRadians > 0, `${key} lacks effective recovery deflections.`);
            requireEvidence(face.nominalLinearDeflectionMm === importReport.importer?.linearDeflectionMm && face.nominalAngularDeflectionRadians === importReport.importer?.angularDeflectionRadians, `${key} nominal recovery settings differ from the importer configuration.`);
            requireEvidence(Array.isArray(face.attempts) && face.attempts.length > 0 && face.attempts.every(a => Number.isFinite(a.linearDeflectionMm) && a.linearDeflectionMm > 0 && Number.isFinite(a.angularDeflectionRadians) && a.angularDeflectionRadians > 0 && Number.isInteger(a.triangleCount) && a.triangleCount >= 0 && typeof a.mesherDone === 'boolean') && face.attempts.some(a => a.mesherDone === true && a.triangleCount === face.triangleCount && a.linearDeflectionMm === face.linearDeflectionMm && a.angularDeflectionRadians === face.angularDeflectionRadians), `${key} lacks a successful retained recovery attempt.`);
          } else unmeshedFaces++;
          diagnostics.push({ definition_id: definition.definition_id, faceIndex: face.faceIndex, triangleCount: face.triangleCount, recovered: face.recovered === true, effectiveLinearDeflectionMm: face.linearDeflectionMm ?? null, effectiveAngularDeflectionRadians: face.angularDeflectionRadians ?? null });
        }
        requireEvidence(next === triangleCount, `${definition.definition_id} face ranges do not cover actual mesh triangles.`);
      }
      requireEvidence(warnings.length === seenWarnings.size && warnings.every(w => seenWarnings.has(`${w.definition_id}/${w.faceIndex}`)), 'Import report has duplicate or unbound mesh warnings.');
      const statistics = importReport.sourceStatistics || {};
      requireEvidence(statistics.recoveredMeshFaces === recoveredFaces && statistics.unmeshedFaces === unmeshedFaces, 'Reported recovery or unmeshed face counts disagree with actual face evidence.');
      requireEvidence(importReport.display?.uniqueTriangles === uniqueTriangles, 'Reported unique display triangle count differs from actual meshes.');
      Object.assign(summary, { uniqueTriangles, recoveredFaces, unmeshedFaces });
      return { limited: recoveredFaces > 0 || unmeshedFaces > 0, message: unmeshedFaces ? 'Some source faces have no display triangles; gaps remain explicitly disclosed.' : recoveredFaces ? 'Display faces are present, with per-face recovery settings that differ from nominal tessellation.' : 'Every retained face range covers actual mesh triangles without reported recovery.', details: { nominalLinearDeflectionMm: importReport.importer?.linearDeflectionMm ?? null, nominalAngularDeflectionRadians: importReport.importer?.angularDeflectionRadians ?? null, diagnostics } };
    });
    check('source-geometry-representation', () => {
      const representations = [], sourceDefinitions = new Set(); let sourceFaces = 0;
      for (const definition of manifest.definitions.filter(d => d.geometry)) {
        const geometry = definition.geometry, faces = geometry.faceTriangleRanges;
        const triangulated = faces.filter(face => face.representation === 'source-triangulated');
        if (!triangulated.length) {
          requireEvidence(!geometry.representation && !geometry.sourceTriangulatedFaceCount && !geometry.boundsEvidence, `${definition.definition_id} declares source triangulation without retained source face evidence.`);
          continue;
        }
        const sourceOnly = triangulated.length === faces.length;
        requireEvidence(geometry.representation === (sourceOnly ? 'source-triangulated' : 'mixed-brep-and-source-triangulation'), `${definition.definition_id} source representation differs from its face evidence.`);
        requireEvidence(geometry.sourceTriangulatedFaceCount === triangulated.length && geometry.analyticFaceCount === faces.length - triangulated.length, `${definition.definition_id} source/analytic face counts disagree.`);
        for (const face of triangulated) requireEvidence(face.sourceTriangleCount === face.triangleCount && Number.isInteger(face.sourceNodeCount) && face.sourceNodeCount > 0 && /^[a-f0-9]{64}$/.test(face.sourceTriangulationSHA256 || ''), `${definition.definition_id}/${face.faceIndex} lacks retained source triangulation evidence.`);
        requireEvidence(geometry.boundsEvidence?.display === 'actual retained/imported triangle positions', `${definition.definition_id} display bounds lack their triangle basis.`);
        if (sourceOnly) requireEvidence(geometry.brepBoundsSourceMm === null && geometry.boundsEvidence.analytic === 'unavailable', `${definition.definition_id} source-only triangles cannot claim analytic B-rep bounds.`);
        else requireEvidence(geometry.boundsEvidence.analytic === (geometry.brepBoundsSourceMm === null ? 'unavailable' : 'partial'), `${definition.definition_id} mixed analytic bounds must disclose partial coverage.`);
        const occurrence = index.displayIds.find(id => index.get(id).definition_id === definition.definition_id);
        requireEvidence(bindings.get(occurrence).every(i => gltf.meshes[i].extras.geometryRepresentation === geometry.representation), `${definition.definition_id} GLB source representation differs.`);
        sourceDefinitions.add(definition.definition_id); sourceFaces += triangulated.length;
        representations.push({ definition_id: definition.definition_id, name: definition.name, representation: geometry.representation, sourceTriangulatedFaceCount: geometry.sourceTriangulatedFaceCount, analyticFaceCount: geometry.analyticFaceCount, boundsEvidence: geometry.boundsEvidence });
      }
      const sourceOccurrences = manifest.occurrences.filter(o => sourceDefinitions.has(o.definition_id)).length;
      const statistics = importReport.sourceStatistics;
      for (const [field, actual] of [['sourceTriangulatedDefinitions', sourceDefinitions.size], ['sourceTriangulatedOccurrences', sourceOccurrences], ['sourceTriangulatedFaces', sourceFaces]]) requireEvidence((statistics[field] ?? 0) === actual, `Reported ${field} differs from retained representation evidence.`);
      requireEvidence(JSON.stringify(importReport.sourceGeometryRepresentations ?? []) === JSON.stringify(representations), 'Import representation report differs from retained definitions.');
      Object.assign(summary, { sourceTriangulatedDefinitions: sourceDefinitions.size, sourceTriangulatedOccurrences: sourceOccurrences, sourceTriangulatedFaces: sourceFaces });
      return { limited: sourceDefinitions.size > 0, message: sourceDefinitions.size ? 'Some real STEP occurrences retain source triangulated faces without analytic surfaces; they remain inspectable, with no exact B-rep measurement claim.' : 'No source-only triangulated faces are declared in this retained package.', details: { sourceTriangulatedDefinitions: sourceDefinitions.size, sourceTriangulatedOccurrences: sourceOccurrences, sourceTriangulatedFaces: sourceFaces } };
    });
    check('reported-counts', () => {
      const statistics = importReport.sourceStatistics, display = importReport.display;
      requireEvidence(statistics && display, 'Import statistics are required.');
      for (const [field, actual] of [['definitionCount', summary.definitions], ['occurrenceCount', summary.occurrences], ['leafOccurrences', summary.leafOccurrences], ['assemblyOccurrences', summary.occurrences - summary.leafOccurrences], ['geometryBearingAssemblies', summary.geometryBearingAssemblies]]) requireEvidence(statistics[field] === actual, `Import report ${field} differs from retained manifest.`);
      requireEvidence(display.semanticPartNodes === summary.displayOccurrences, 'Report semantic display count differs from actual occurrences.');
      if (summary.sourceUsageRelations !== undefined) requireEvidence(statistics.sourceNauoCount === summary.sourceUsageRelations, 'Report source usage count differs from extracted STEP.');
      requireEvidence(importReport.identityMapping?.unmappedSourceOccurrences === 0 && statistics.unmappedSourceOccurrences === 0, 'Source occurrences remain unmapped or their mapping count is undisclosed.');
      return { message: 'Counts are derived from this package, never fixed to one specimen.' };
    });
  }
  const state = id => checks.find(c => c.id === id)?.status;
  const capability = (ids, scope) => ({ status: ids.some(id => state(id) === 'failed') ? 'failed' : ids.every(id => state(id) === 'passed') ? 'supported' : 'limited', scope });
  capabilities.sourceIdentity = capability(['source-integrity', 'assembly-manifest', 'source-definition-usage', 'exported-identity-hierarchy'], 'Exact retained-source product/usage identities; no name-based assignment.');
  capabilities.placementConsistency = capability(['assembly-manifest', 'coordinate-convention', 'exported-identity-hierarchy', 'engineering-display-placements'], 'Manifest parent/local/world consistency and display conversion; no independent native placement re-evaluation.');
  capabilities.sharedDefinitionGeometry = capability(['definition-mesh-binding'], 'Separate occurrence owners referencing shared definition meshes.');
  capabilities.displayFaceCoverage = capability(['mesh-face-evidence'], 'Triangulated face ranges and disclosed effective recovery settings; no precision guarantee.');
  capabilities.analyticGeometryCoverage = capability(['source-geometry-representation'], 'Retained source representation evidence; source-only triangulation is disclosed, and analytic surfaces are not reconstructed from meshes.');
  capabilities.publicRedistribution = provenance?.sourceType === 'user-provided' && provenance?.redistribution === 'not-authorized'
    ? { status: 'unsupported', scope: 'Local inspection only; no public redistribution authorization was supplied.' }
    : { status: 'not-assessed', scope: 'Source license declarations are retained as evidence; this technical audit does not determine publication or derivative licensing rights.' };
  for (const [name, scope] of [['mates', 'STEP placements do not establish mates or joint constraints.'], ['engineeringMeasurement', 'No exact B-rep measurement is executed by this inspector.'], ['physicalSimulation', 'No force, contact or collision solver is executed.']]) capabilities[name] = { status: 'unsupported', scope };
  const status = checks.some(c => c.status === 'failed') ? 'failed' : checks.some(c => c.status === 'limited') ? 'limited' : 'verified';
  return clone({ schemaVersion: '1.0.0', status, checks, summary, capabilities, findings: checks.filter(c => c.status !== 'passed').map(({ id, status: severity, message, details }) => ({ check: id, severity, message, ...(details ? { details } : {}) })) });
}
