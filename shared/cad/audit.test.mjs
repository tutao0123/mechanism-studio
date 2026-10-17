import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectCadEvidence } from './audit.mjs';
import { multiplyMatrices } from './assembly.mjs';
import { sha256, readGlb } from '../assets/glb.mjs';
import { buildXcafDisplay } from '../../tools/cad/xcaf-display.mjs';
import { extractStepMetadata } from '../../tools/cad/step-metadata.mjs';

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function fixture({ unit = 'mm', schema = 'AUTOMOTIVE_DESIGN', extraUnits = '', sourceTriangles = false } = {}) {
  const sourceBytes = Buffer.from(`ISO-10303-21;HEADER;FILE_SCHEMA(('${schema}'));ENDSEC;DATA;\n#1=PRODUCT('root','root','',());\n#2=PRODUCT('housing','housing','',());\n#3=PRODUCT('screw','same display name','',());\n#11=PRODUCT_DEFINITION_FORMATION('','',#1);\n#12=PRODUCT_DEFINITION_FORMATION('','',#2);\n#13=PRODUCT_DEFINITION_FORMATION('','',#3);\n#21=PRODUCT_DEFINITION('','',#11,#99);\n#22=PRODUCT_DEFINITION('','',#12,#99);\n#23=PRODUCT_DEFINITION('','',#13,#99);\n#31=NEXT_ASSEMBLY_USAGE_OCCURRENCE('housing:1','', '',#21,#22,$);\n#32=NEXT_ASSEMBLY_USAGE_OCCURRENCE('screw:1','', '',#22,#23,$);\n#33=NEXT_ASSEMBLY_USAGE_OCCURRENCE('screw:2','', '',#22,#23,$);\n#90=(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(${unit === 'm' ? '$' : '.MILLI.'},.METRE.));\n#91=(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNIT_ASSIGNED_CONTEXT((#90)) REPRESENTATION_CONTEXT('','3D'));\n${extraUnits}\nENDSEC;END-ISO-10303-21;`);
  const provenance = { sourceSHA256: sha256(sourceBytes), sourceLengthUnit: unit, author: 'Test fixture author', title: 'Small assembly evidence fixture', url: 'https://example.org/cad/source', license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' };
  const geometry = () => ({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2], triangleCount: 1, solidCount: 1, boundsMm: { min: [0, 0, 0], max: [1, 1, 0] }, brepBoundsMm: { min: [0, 0, 0], max: [1, 1, 0] }, faces: [{ faceIndex: 1, firstTriangle: 0, triangleCount: 1 }] });
  const definition = (n, kind, hasGeometry = false) => ({ definition_id: `def-${n}`, name: n === 3 ? 'same display name' : `Definition ${n}`, kind, source: { productDefinitionEntity: `#2${n}`, productEntity: `#${n}`, productId: String(n), productName: String(n) }, ...(hasGeometry ? { geometry: geometry() } : {}) });
  const housingLocal = [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1];
  const screwA = identity(), screwB = identity(); screwA[14] = 5; screwB[13] = 10; screwB[14] = 5;
  const occurrence = (id, definitionId, parent, kind, local, world, entity, token) => ({ occurrence_id: id, definition_id: `def-${definitionId}`, parent_id: parent, name: 'Deliberately repeated display label', kind, localMatrixMm: local, worldMatrixMm: world, source: { nauoEntity: entity, occurrenceId: token, ...(parent ? { parentDefinitionEntity: parent === 'root' ? '#21' : '#22', childDefinitionEntity: `#2${definitionId}` } : {}) } });
  const data = { schema: 'mechanism-studio-xcaf-1', sourceSHA256: sha256(sourceBytes), units: { importedLength: 'mm', sourceLengthNames: ['millimetre'], sourceAngleNames: ['radian'] }, importer: { package: 'fixture', version: '1', linearDeflectionMm: 0.08, angularDeflectionRadians: 0.4 }, roots: ['root'], definitions: [definition(1, 'assembly'), definition(2, 'assembly', true), definition(3, 'part', true)], occurrences: [occurrence('root', 1, null, 'assembly', identity(), identity(), null, null), occurrence('housing', 2, 'root', 'assembly', housingLocal, housingLocal, '#31', 'housing:1'), occurrence('screw-a', 3, 'housing', 'part', screwA, multiplyMatrices(housingLocal, screwA), '#32', 'screw:1'), occurrence('screw-b', 3, 'housing', 'part', screwB, multiplyMatrices(housingLocal, screwB), '#33', 'screw:2')], limitations: ['Fixture is a topology evidence test, not usable engineering CAD.'] };
  data.units.sourceLengthNames = [unit === 'm' ? 'metre' : 'millimetre'];
  if (sourceTriangles) {
    const geometry = data.definitions[2].geometry;
    Object.assign(geometry, { solidCount: 0, brepBoundsMm: null, representation: 'source-triangulated', sourceTriangulatedFaceCount: 1, analyticFaceCount: 0, boundsEvidence: { analytic: 'unavailable', display: 'actual retained/imported triangle positions', note: 'Fixture source triangle has no analytic surface.' } });
    Object.assign(geometry.faces[0], { representation: 'source-triangulated', sourceTriangleCount: 1, sourceNodeCount: 3, sourceTriangulationSHA256: 'a'.repeat(64) });
  }
  const display = buildXcafDisplay(data, provenance);
  return { sourceBytes, provenance, manifest: display.manifest, contract: display.contract, glbBytes: display.glb, sourceMetadata: extractStepMetadata(sourceBytes.toString('utf8')), importReport: { sourceSHA256: sha256(sourceBytes), glbSHA256: sha256(display.glb), importer: data.importer, sourceUnits: data.units, sourceStatistics: { definitionCount: 3, occurrenceCount: 4, leafOccurrences: 2, assemblyOccurrences: 2, geometryBearingAssemblies: 1, sourceNauoCount: 3, unmappedSourceOccurrences: 0, recoveredMeshFaces: 0, unmeshedFaces: 0, ...(sourceTriangles ? { sourceTriangulatedDefinitions: 1, sourceTriangulatedOccurrences: 2, sourceTriangulatedFaces: 1 } : {}) }, sourceGeometryRepresentations: data.definitions.filter(d => d.geometry?.representation).map(d => ({ definition_id: d.definition_id, name: d.name, representation: d.geometry.representation, sourceTriangulatedFaceCount: d.geometry.sourceTriangulatedFaceCount, analyticFaceCount: d.geometry.analyticFaceCount, boundsEvidence: d.geometry.boundsEvidence })), display: display.display, identityMapping: { unmappedSourceOccurrences: 0 }, meshWarnings: [] } };
}
function editGlb(input, edit) {
  const { json, buffer } = readGlb(input.glbBytes); edit(json);
  const jsonBytes = Buffer.from(JSON.stringify(json)), payload = Buffer.concat([jsonBytes, Buffer.alloc((4 - jsonBytes.length % 4) % 4, 32)]);
  const head = Buffer.alloc(20), binHead = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67); head.writeUInt32LE(2, 4); head.writeUInt32LE(28 + payload.length + buffer.length, 8); head.writeUInt32LE(payload.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  binHead.writeUInt32LE(buffer.length); binHead.writeUInt32LE(0x004e4942, 4);
  input.glbBytes = Buffer.concat([head, payload, binHead, buffer]); input.importReport.glbSHA256 = sha256(input.glbBytes);
}
const check = (report, id) => report.checks.find(c => c.id === id);

test('CAD audit derives counts and verifies pure assemblies, mixed bodies, repeated definitions and rotated placements', () => {
  const report = inspectCadEvidence(fixture());
  assert.equal(report.status, 'verified', JSON.stringify(report.findings));
  assert.equal(report.summary.definitions, 3); assert.equal(report.summary.occurrences, 4); assert.equal(report.summary.displayOccurrences, 3);
  assert.equal(report.summary.geometryBearingAssemblies, 1); assert.equal(report.summary.reusedDisplayDefinitions, 1);
  assert.equal(report.capabilities.sourceIdentity.status, 'supported'); assert.equal(report.capabilities.placementConsistency.status, 'supported');
  assert.equal(report.capabilities.mates.status, 'unsupported'); assert.equal(report.capabilities.engineeringMeasurement.status, 'unsupported');
});

test('AP242 product/usage evidence and original metre to imported mm normalization are explicitly supported', () => {
  const input = fixture({ unit: 'm', schema: 'AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF' });
  const report = inspectCadEvidence(input);
  assert.equal(report.status, 'verified', JSON.stringify(report.findings));
  assert.equal(report.capabilities.sourceIdentity.status, 'supported');
  assert.equal(report.capabilities.placementConsistency.status, 'supported');
  assert.match(check(report, 'source-definition-usage').details.scope, /not full protocol conformance/);
  assert.match(check(report, 'coordinate-convention').message, /convert once/);
});

test('source-triangulated CAD occurrences keep identity and geometry while analytic coverage stays limited', () => {
  const input = fixture({ sourceTriangles: true });
  const report = inspectCadEvidence(input);
  assert.equal(report.status, 'limited', JSON.stringify(report.findings));
  assert.equal(report.capabilities.sourceIdentity.status, 'supported');
  assert.equal(report.capabilities.placementConsistency.status, 'supported');
  assert.equal(report.capabilities.displayFaceCoverage.status, 'supported');
  assert.equal(report.capabilities.analyticGeometryCoverage.status, 'limited');
  assert.equal(report.summary.sourceTriangulatedDefinitions, 1);
  assert.equal(report.summary.sourceTriangulatedOccurrences, 2);
  assert.equal(input.manifest.definitions[2].geometry.brepBoundsSourceMm, null);
});

test('source triangle evidence rejects fabricated analytic bounds, missing source digest and false counts', async t => {
  const edits = [
    input => { input.manifest.definitions[2].geometry.brepBoundsSourceMm = { min: [0,0,0], max:[1,1,0] }; },
    input => { delete input.manifest.definitions[2].geometry.faceTriangleRanges[0].sourceTriangulationSHA256; },
    input => { input.importReport.sourceStatistics.sourceTriangulatedOccurrences = 1; },
    input => { input.importReport.sourceGeometryRepresentations = []; },
    input => { editGlb(input, json => { delete json.meshes[1].extras.geometryRepresentation; }); },
  ];
  for (const [i, edit] of edits.entries()) await t.test(`contradiction ${i}`, () => {
    const input = fixture({ sourceTriangles: true }); edit(input);
    const report = inspectCadEvidence(input);
    assert.equal(report.status, 'failed');
    assert.equal(check(report, 'source-geometry-representation').status, 'failed');
  });
});

test('native metre audit rejects absent or contradictory normalization evidence', async t => {
  const edits = [
    input => { delete input.manifest.source.coordinateNormalization; },
    input => { input.manifest.source.coordinateNormalization.originalToImportedScale = .001; },
    input => { input.manifest.source.units.length = 'm'; },
    input => { input.importReport.sourceUnits = { importedLength: 'mm', sourceLengthNames: ['millimetre'] }; },
    input => { input.provenance.sourceLengthUnit = 'mm'; },
    input => { input.contract.units.imported = 'm'; },
    input => { editGlb(input, json => { json.extras.importedUnits = 'm'; }); },
  ];
  for (const [i, edit] of edits.entries()) await t.test(`contradiction ${i}`, () => {
    const input = fixture({ unit: 'm' }); edit(input);
    const report = inspectCadEvidence(input);
    assert.equal(report.capabilities.placementConsistency.status, 'failed');
  });
});

test('audit reads raw spatial contexts instead of trusting rewritten unit labels or mixed native units', () => {
  const mixed = fixture({ unit: 'm', extraUnits: '#92=(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.));\n#93=(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNIT_ASSIGNED_CONTEXT((#92)) REPRESENTATION_CONTEXT(\'\',\'3D\'));' });
  assert.equal(check(inspectCadEvidence(mixed), 'coordinate-convention').status, 'failed');
  const relabeled = fixture({ unit: 'm' });
  relabeled.contract.units.source = 'mm'; relabeled.provenance.sourceLengthUnit = 'mm';
  delete relabeled.manifest.source.coordinateNormalization; delete relabeled.manifest.source.originalLengthUnit;
  editGlb(relabeled, json => { json.extras.sourceUnits = 'mm'; });
  assert.equal(check(inspectCadEvidence(relabeled), 'coordinate-convention').status, 'failed');
});

test('CAD audit detects retained source corruption without trusting the import status', () => {
  const input = fixture(); input.sourceBytes = Buffer.concat([input.sourceBytes, Buffer.from('changed')]); input.importReport.status = 'source-occurrence-identity-verified';
  const report = inspectCadEvidence(input); assert.equal(report.status, 'failed'); assert.equal(check(report, 'source-integrity').status, 'failed');
});

test('private user-provided CAD can be inspected without public license or source URLs', () => {
  const input = fixture(); input.provenance = { sourceSHA256: input.provenance.sourceSHA256, sourceType: 'user-provided', redistribution: 'not-authorized' };
  const report = inspectCadEvidence(input); assert.equal(report.status, 'limited'); assert.equal(report.capabilities.sourceIdentity.status, 'supported');
  assert.equal(check(report, 'source-provenance').status, 'limited'); assert.equal(report.capabilities.publicRedistribution.status, 'unsupported');
  assert.match(check(report, 'source-provenance').message, /public redistribution not established/);
});

test('CAD audit catches source usage reassignment even when assembly graph remains valid', () => {
  const input = fixture(); input.manifest.occurrences[2].source.nauoEntity = '#33';
  const report = inspectCadEvidence(input); assert.equal(report.status, 'failed'); assert.equal(check(report, 'source-definition-usage').status, 'failed');
});

test('CAD audit checks exported pure assembly placement independently of display part rest validation', () => {
  const input = fixture(); editGlb(input, json => { json.nodes.find(n => n.extras?.assembly_id === 'root').matrix[12] = 0.01; });
  const report = inspectCadEvidence(input); assert.equal(check(report, 'display-contract').status, 'passed'); assert.equal(check(report, 'engineering-display-placements').status, 'failed');
});

test('CAD audit rejects lost mixed source body ownership', () => {
  const input = fixture(); editGlb(input, json => { const body = json.nodes.find(n => n.extras?.ownerOccurrenceId === 'housing'); body.extras.ownerOccurrenceId = 'screw-a'; });
  const report = inspectCadEvidence(input); assert.equal(report.status, 'failed'); assert.equal(check(report, 'definition-mesh-binding').status, 'failed');
});

test('CAD audit rejects a display wrapper inserted above the actual source assembly root', () => {
  const input = fixture(); editGlb(input, json => { const root = json.scenes[0].nodes[0]; json.nodes.push({ name: 'Unexpected presentation wrapper', children: [root] }); json.scenes[0].nodes = [json.nodes.length - 1]; });
  const report = inspectCadEvidence(input); assert.equal(report.status, 'failed'); assert.equal(check(report, 'display-contract').status, 'passed'); assert.equal(check(report, 'exported-identity-hierarchy').status, 'failed');
});

test('CAD audit rejects silently dropped source usage while remaining graph data is internally consistent', () => {
  const input = fixture(); input.manifest.occurrences = input.manifest.occurrences.filter(o => o.occurrence_id !== 'screw-b'); input.contract.parts = input.contract.parts.filter(p => p.part_id !== 'screw-b');
  const report = inspectCadEvidence(input); assert.equal(report.status, 'failed'); assert.equal(check(report, 'assembly-manifest').status, 'passed'); assert.equal(check(report, 'source-definition-usage').status, 'failed');
});

test('CAD audit catches contract definition drift and extra display occurrence IDs', () => {
  const input = fixture(); input.contract.parts.find(p => p.part_id === 'screw-a').definition_id = 'def-2';
  const report = inspectCadEvidence(input); assert.equal(report.status, 'failed'); assert.equal(check(report, 'exported-identity-hierarchy').status, 'failed');
});

test('CAD audit checks actual shared mesh reuse instead of names or repeated-instance counters', () => {
  const input = fixture(); editGlb(input, json => { const node = json.nodes.find(n => n.extras?.part_id === 'screw-b'); json.meshes.push(structuredClone(json.meshes[node.mesh])); node.mesh = json.meshes.length - 1; });
  const report = inspectCadEvidence(input); assert.equal(check(report, 'definition-mesh-binding').status, 'failed');
});

test('CAD audit does not assume an undeclared coordinate convention or a source parser', () => {
  const input = fixture(); delete input.sourceMetadata; input.contract.coordinateMap = 'an unknown coordinate map'; editGlb(input, json => { json.extras.coordinateMap = input.contract.coordinateMap; });
  const report = inspectCadEvidence(input); assert.equal(report.status, 'limited'); assert.equal(check(report, 'coordinate-convention').status, 'limited'); assert.equal(check(report, 'source-definition-usage').status, 'limited');
  assert.equal(report.capabilities.placementConsistency.status, 'limited'); assert.equal(report.capabilities.sourceIdentity.status, 'limited');
});

test('CAD audit fails mesh diagnostics when recovered source faces are omitted from the report', () => {
  const input = fixture(), definition = input.manifest.definitions.find(d => d.definition_id === 'def-3');
  const face = definition.geometry.faceTriangleRanges[0]; Object.assign(face, { recovered: true, status: 'recovered-per-face', nominalLinearDeflectionMm: 0.08, nominalAngularDeflectionRadians: 0.4, linearDeflectionMm: 0.3, angularDeflectionRadians: 0.7, attempts: [{ linearDeflectionMm: 0.3, angularDeflectionRadians: 0.7, triangleCount: 1, mesherDone: true }] });
  editGlb(input, json => { json.meshes.find(m => m.extras.definition_id === 'def-3').extras.faceTriangleRanges = structuredClone(definition.geometry.faceTriangleRanges); });
  const report = inspectCadEvidence(input); assert.equal(report.status, 'failed'); assert.match(check(report, 'mesh-face-evidence').message, /missing a unique import warning/);
});

test('CAD audit limits documented effective recovery and rejects contradictory recovery attempts', () => {
  const input = fixture(), definition = input.manifest.definitions.find(d => d.definition_id === 'def-3');
  const face = definition.geometry.faceTriangleRanges[0]; Object.assign(face, { recovered: true, status: 'recovered-per-face', nominalLinearDeflectionMm: 0.08, nominalAngularDeflectionRadians: 0.4, linearDeflectionMm: 0.3, angularDeflectionRadians: 0.7, attempts: [{ linearDeflectionMm: 0.3, angularDeflectionRadians: 0.7, triangleCount: 1, mesherDone: true }] });
  input.importReport.meshWarnings = [{ definition_id: 'def-3', ...structuredClone(face) }]; input.importReport.sourceStatistics.recoveredMeshFaces = 1;
  editGlb(input, json => { json.meshes.find(m => m.extras.definition_id === 'def-3').extras.faceTriangleRanges = structuredClone(definition.geometry.faceTriangleRanges); });
  let report = inspectCadEvidence(input); assert.equal(report.status, 'limited'); assert.equal(report.capabilities.sourceIdentity.status, 'supported'); assert.equal(report.capabilities.displayFaceCoverage.status, 'limited');
  assert.equal(check(report, 'mesh-face-evidence').details.diagnostics[0].effectiveLinearDeflectionMm, 0.3);
  face.attempts[0].triangleCount = 0;
  input.importReport.meshWarnings = [{ definition_id: 'def-3', ...structuredClone(face) }];
  editGlb(input, json => { json.meshes.find(m => m.extras.definition_id === 'def-3').extras.faceTriangleRanges = structuredClone(definition.geometry.faceTriangleRanges); });
  report = inspectCadEvidence(input); assert.equal(report.status, 'failed'); assert.match(check(report, 'mesh-face-evidence').message, /successful retained recovery attempt/);
});

test('CAD audit validates the real retained Galileo assembly with disclosed per-face recovery', async () => {
  const root = new URL('../../examples/shaft-bearing/', import.meta.url), readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const [sourceBytes, glbBytes, provenance, manifest, contract, importReport] = await Promise.all([readFile(new URL('source/assembly.step', root)), readFile(new URL('assets/assembly.glb', root)), readJson('source/provenance.json'), readJson('assets/assembly-manifest.json'), readJson('assets/scene-contract.json'), readJson('assets/import-report.json')]);
  const report = inspectCadEvidence({ sourceBytes, glbBytes, provenance, manifest, contract, importReport, sourceMetadata: extractStepMetadata(sourceBytes.toString('utf8')) });
  assert.equal(report.status, 'limited', JSON.stringify(report.findings));
  assert.equal(report.capabilities.sourceIdentity.status, 'supported'); assert.equal(report.capabilities.placementConsistency.status, 'supported');
  assert.equal(report.summary.recoveredFaces, importReport.meshWarnings.length); assert.equal(report.summary.definitions, manifest.definitions.length);
});

test('legacy KFL08 fragment display is not promoted to source occurrence identity', async () => {
  const root = new URL('../../examples/step-assembly/', import.meta.url), readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const [sourceBytes, glbBytes, provenance, contract, importReport] = await Promise.all([readFile(new URL('source/kfl08.step', root)), readFile(new URL('assets/assembly.glb', root)), readJson('source/provenance.json'), readJson('assets/scene-contract.json'), readJson('assets/import-report.json')]);
  const report = inspectCadEvidence({ sourceBytes, glbBytes, provenance, contract, importReport });
  assert.equal(report.status, 'limited', JSON.stringify(report.findings)); assert.equal(report.capabilities.sourceIdentity.status, 'limited'); assert.equal(report.capabilities.placementConsistency.status, 'limited');
});
