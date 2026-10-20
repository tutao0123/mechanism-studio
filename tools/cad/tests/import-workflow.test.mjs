import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rm, symlink, unlink, access, rename } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { projectRoot, resolveScopedPath, resolveExample, readCadSourcePackage, runCadImport, publishCadAssets } from '../import-assembly.mjs';
import { buildXcafDisplay } from '../xcaf-display.mjs';
import { sha256, readGlb } from '../../../shared/assets/glb.mjs';

// Synthetic contract fixtures exercise orchestration only. They are not CAD
// specimens and never count as another successful real STEP import.
const STEP = `ISO-10303-21;
HEADER;FILE_DESCRIPTION(('workflow fixture'),'2;1');ENDSEC;
DATA;
#1=PRODUCT_DEFINITION('root','',#11,#12);
#2=PRODUCT_DEFINITION('screw','',#21,#22);
#3=NEXT_ASSEMBLY_USAGE_OCCURRENCE('a','', '',#1,#2,$);
#4=NEXT_ASSEMBLY_USAGE_OCCURRENCE('b','', '',#1,#2,$);
#5=(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.));
#6=(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNIT_ASSIGNED_CONTEXT((#5)) REPRESENTATION_CONTEXT('','3D'));
/* A derived non-geometry metre unit is allowed. */
#7=(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT($,.METRE.));
ENDSEC;
END-ISO-10303-21;
`;
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const translated = x => { const matrix = [...I]; matrix[12] = x; return matrix; };

async function fixture(t, { step = STEP, provenance = {}, localFile = 'assembly.step' } = {}) {
  const directory = await resolveScopedPath(projectRoot, `.test-output/import-workflow-${randomUUID()}`);
  const example = 'examples/fixture', exampleDirectory = join(directory, example), sourceDirectory = join(exampleDirectory, 'source');
  await mkdir(sourceDirectory, { recursive: true });
  const bytes = Buffer.from(step), record = { title: 'Synthetic workflow contract fixture', sourceSHA256: sha256(bytes), ...provenance };
  await writeFile(join(sourceDirectory, localFile), bytes);
  await writeFile(join(sourceDirectory, 'provenance.json'), JSON.stringify(record));
  const links = [];
  t.after(async () => {
    for (const link of links) await unlink(link);
    // Verify the actual absolute recursive-delete target stays inside project.
    const target = await resolveScopedPath(projectRoot, directory, { mustExist: true });
    const rel = relative(projectRoot, target);
    assert.ok(rel && !rel.startsWith('..') && !isAbsolute(rel));
    await rm(target, { recursive: true, force: true });
  });
  return { root: directory, example, exampleDirectory, sourceDirectory, record, bytes, links };
}

function backendData(hash, { name = 'fine', linearDeflectionMm = .08, angularDeflectionRadians = .4 } = {}) {
  const id = hash.slice(0, 12), rootId = `occ-${id}-root-1`, definitionId = `def-${id}-2`;
  const geometry = {
    positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    indices: name === 'fine' ? [0, 1, 2, 0, 2, 3] : [0, 1, 2], triangleCount: name === 'fine' ? 2 : 1, solidCount: 1,
    boundsMm: { min: [0, 0, 0], max: [1, 1, 0] }, brepBoundsMm: { min: [0, 0, 0], max: [1, 1, 0] },
    faces: [{ faceIndex: 1, firstTriangle: 0, triangleCount: name === 'fine' ? 2 : 1 }],
  };
  const children = [3, 4].map(number => `occ-${id}-root-1-${number}`);
  return {
    schema: 'mechanism-studio-xcaf-1', sourceSHA256: hash,
    importer: { package: 'cadquery-ocp', version: '7.8.1.1.post1', assemblyReader: 'STEPCAFControl_Reader', identityMapping: 'workflow fixture only', linearDeflectionMm, angularDeflectionRadians },
    units: { importedLength: 'mm', sourceLengthNames: ['millimetre'] }, roots: [rootId],
    definitions: [
      { definition_id: `def-${id}-1`, name: 'Fixture root', kind: 'assembly', source: { productDefinitionEntity: '#1' } },
      { definition_id: definitionId, name: 'Repeated screw', kind: 'part', source: { productDefinitionEntity: '#2' }, geometry },
    ],
    occurrences: [
      { occurrence_id: rootId, definition_id: `def-${id}-1`, parent_id: null, kind: 'assembly', name: 'Fixture root', source: { nauoEntity: null }, localMatrixMm: I, worldMatrixMm: I, children },
      ...[3, 4].map((number, offset) => ({ occurrence_id: children[offset], definition_id: definitionId, parent_id: rootId, kind: 'part', name: 'Repeated screw', source: { nauoEntity: `#${number}` }, localMatrixMm: translated(offset * 3), worldMatrixMm: translated(offset * 3), children: [] })),
    ],
    statistics: { sourceNauoCount: 2, unmappedSourceOccurrences: 0, definitionCount: 2, occurrenceCount: 3 },
    limitations: ['Synthetic workflow fixture; not a CAD support claim.'],
  };
}

test('source package preflight supports a local filename and geometry mm despite derived metre units', async t => {
  const f = await fixture(t, { localFile: 'retained source.stp', provenance: { localFile: 'retained source.stp' } });
  const result = await readCadSourcePackage(f);
  assert.equal(result.sourceFile, 'source/retained source.stp');
  assert.equal(result.sourcePath, join(f.sourceDirectory, 'retained source.stp'));
  assert.deepEqual(result.sourceBytes, f.bytes);
  assert.equal(result.preflight.sourceNauoCount, 2); assert.equal(result.preflight.productDefinitionCount, 2);
  assert.equal(result.preflight.geometryContextCount, 1);
  await assert.rejects(access(join(f.root, '.cache')));
});

test('real retained KFL08 mm assembly accepts explicitly named unitless 2D surface parameter contexts', async t => {
  const sourceBytes = await readFile(join(projectRoot, 'examples/step-assembly/source/kfl08.step'));
  const provenance = JSON.parse(await readFile(join(projectRoot, 'examples/step-assembly/source/provenance.json'), 'utf8'));
  const f = await fixture(t, { step: sourceBytes, provenance: { ...provenance, localFile: 'assembly.step' } });
  const result = await readCadSourcePackage(f);
  assert.deepEqual(result.sourceBytes, sourceBytes); assert.equal(result.provenance.sourceSHA256, provenance.sourceSHA256);
  assert.equal(result.preflight.productDefinitionCount, 30); assert.equal(result.preflight.sourceNauoCount, 29);
  assert.ok(result.preflight.geometryContextCount > 0); assert.ok(result.preflight.unassignedSurfaceParameterContextCount > 0);
  await assert.rejects(access(join(f.root, '.cache')));
});

test('surface parameter exception does not allow unassigned 3D or unnamed 2D geometry contexts', async t => {
  for (const declaration of [
    'GEOMETRIC_REPRESENTATION_CONTEXT(3) PARAMETRIC_REPRESENTATION_CONTEXT()',
    'GEOMETRIC_REPRESENTATION_CONTEXT(2)',
  ]) await t.test(declaration, async child => {
    const step = STEP.replace('GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNIT_ASSIGNED_CONTEXT((#5))', declaration);
    const f = await fixture(child, { step }); let calls = 0;
    await assert.rejects(runCadImport({ ...f, backendRunner() { calls++; } }), /explicitly declare metre or millimetre units/);
    assert.equal(calls, 0); await assert.rejects(access(join(f.root, '.cache')));
  });
});

test('invalid hash, external references, unsupported units and malformed source start no backend and publish no assets', async t => {
  for (const invalid of [
    { provenance: { sourceSHA256: '0'.repeat(64) }, message: /differs from its reviewed provenance/ },
    { provenance: { sourceSHA256: null }, message: /pin sourceSHA256/ },
    { provenance: { localFile: '../assembly.step' }, message: /localFile/ },
    { provenance: { sourceLengthUnit: 'm' }, message: /sourceLengthUnit disagrees/ },
    { provenance: { sourceLengthUnit: 'inch' }, message: /metre or millimetre source provenance/ },
    { step: STEP.replace('#7=', "#8=DOCUMENT_FILE('external','','',#1,#2);\n#7="), message: /External-file/ },
    { step: STEP.replace('END-ISO-10303-21;', ''), message: /ISO-10303-21/ },
    { step: STEP.replace('SI_UNIT(.MILLI.,.METRE.)', 'SI_UNIT(.CENTI.,.METRE.)'), message: /metre or millimetre geometry/ },
    { step: STEP.replace('SI_UNIT(.MILLI.,.METRE.)', "CONVERSION_BASED_UNIT('inch',#70)"), message: /metre or millimetre geometry/ },
    { step: STEP.replace('#7=', '#8=(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNIT_ASSIGNED_CONTEXT((#7)) REPRESENTATION_CONTEXT(\'\',\'3D\'));\n#7='), message: /mixed spatial units/ },
    { provenance: { sourceContents: { usageRelations: 30 } }, message: /usages disagree/ },
  ]) await t.test(invalid.message.source, async child => {
    const f = await fixture(child, invalid); let calls = 0;
    const assets = join(f.exampleDirectory, 'assets'); await mkdir(assets);
    await writeFile(join(assets, 'assembly.glb'), 'keep existing display');
    await assert.rejects(runCadImport({ ...f, backendRunner() { calls++; throw new Error('must not run'); } }), invalid.message);
    assert.equal(calls, 0); assert.equal(await readFile(join(assets, 'assembly.glb'), 'utf8'), 'keep existing display');
    await assert.rejects(access(join(f.root, '.cache')));
  });
});

test('explicit metre source is retained unchanged and OCCT mm geometry/placements convert exactly once', async t => {
  const step = STEP.replace('SI_UNIT(.MILLI.,.METRE.)', 'SI_UNIT($,.METRE.)');
  const f = await fixture(t, { step, provenance: { sourceLengthUnit: 'm' } });
  const result = await runCadImport({ ...f, backendRunner(options) {
    const data = backendData(f.record.sourceSHA256, options);
    data.units.sourceLengthNames = ['metre'];
    // A known normalized 3000 mm displacement from an original-metre file.
    data.occurrences[2].localMatrixMm = translated(3000); data.occurrences[2].worldMatrixMm = translated(3000);
    return data;
  } });
  assert.deepEqual(await readFile(join(f.sourceDirectory, 'assembly.step')), f.bytes);
  assert.equal(result.manifest.source.units.length, 'mm');
  assert.equal(result.manifest.source.originalLengthUnit, 'm');
  assert.deepEqual(result.manifest.source.sourceUnits.sourceLengthNames, ['metre']);
  assert.equal(result.manifest.source.coordinateNormalization.originalToImportedScale, 1000);
  assert.equal(result.manifest.occurrences[2].localMatrixSource[12], 3000);
  assert.deepEqual(result.contract.units, { source: 'm', imported: 'mm', asset: 'm', angle: 'rad' });
  const gltf = readGlb(result.glb).json;
  assert.equal(gltf.nodes.find(node => node.extras?.part_id === result.manifest.occurrences[2].occurrence_id).matrix[12], 3);
  assert.ok(Math.abs(result.display.assetBoundsMeters.max[0] - 3.001) < 1e-8);
  assert.equal(gltf.extras.sourceUnits, 'm'); assert.equal(gltf.extras.importedUnits, 'mm');
  assert.equal(result.report.coordinateConversion.originalToImportedScale, 1000);
});

test('native source/backend unit disagreement and mixed source names cannot publish', async t => {
  for (const names of [['millimetre'], ['metre', 'millimetre'], ['inch'], []]) await t.test(JSON.stringify(names), async child => {
    const f = await fixture(child, { step: STEP.replace('SI_UNIT(.MILLI.,.METRE.)', 'SI_UNIT($,.METRE.)'), provenance: { sourceLengthUnit: 'm' } });
    await assert.rejects(runCadImport({ ...f, backendRunner(options) {
      const data = backendData(f.record.sourceSHA256, options); data.units.sourceLengthNames = names; return data;
    } }), /original source unit names disagree/);
    await assert.rejects(access(join(f.exampleDirectory, 'assets', 'assembly.glb')));
  });
});

test('example and output boundaries reject roots, traversal and ancestor junctions', async t => {
  const f = await fixture(t);
  for (const example of ['', '.', '..', 'examples/..', 'examples/fixture/../fixture', f.exampleDirectory, 'shared/viewer']) {
    await assert.rejects(resolveExample(f.root, example), /Example|--example/);
  }
  await assert.rejects(resolveScopedPath(f.root, '../outside'), /inside Mechanism Studio/);
  await assert.rejects(resolveScopedPath(f.root, f.root), /project root/);
  // The link stays inside the real project, but escapes the deliberately
  // narrower fixture root. No out-of-project link is created by this test.
  const link = join(f.root, 'examples', 'escape');
  await symlink(projectRoot, link, process.platform === 'win32' ? 'junction' : 'dir'); f.links.push(link);
  await assert.rejects(resolveExample(f.root, 'examples/escape'), /inside Mechanism Studio/);
  await assert.rejects(resolveScopedPath(f.root, join(link, '.cache', 'new-output.json')), /inside Mechanism Studio/);
  await assert.rejects(runCadImport({ ...f, cacheDirectory: 'examples/fixture/source' }), /caches must stay/);
});

test('workflow publishes a definition-reusing display only after two consistent changed tessellations', async t => {
  const f = await fixture(t, { provenance: { sourceContents: { usageRelations: 2 } } });
  const calls = [];
  const result = await runCadImport({ ...f, mechanismId: 'test-contract-fixture', backendRunner(options) {
    calls.push(options);
    assert.ok(options.outputPath.startsWith(join(f.root, '.cache', 'cad', 'imports')));
    assert.equal(options.temporaryPath, join(f.root, '.cache', 'cad', 'tmp'));
    return backendData(f.record.sourceSHA256, options);
  } });
  assert.deepEqual(calls.map(call => call.name), ['fine', 'coarse']);
  assert.equal(result.manifest.definitions.length, 2); assert.equal(result.manifest.occurrences.length, 3);
  assert.equal(result.contract.mechanismId, 'test-contract-fixture'); assert.equal(result.report.sourceStatistics.sourceNauoCount, 2);
  assert.equal(result.display.meshDefinitions, 1); assert.equal(result.display.semanticPartNodes, 2);
  assert.equal(result.display.triangles, 4); assert.equal(result.coarseTriangles, 2);
  const gltf = readGlb(result.glb).json, parts = gltf.nodes.filter(node => node.extras?.part_id);
  assert.equal(parts.length, 2); assert.equal(parts[0].mesh, parts[1].mesh); assert.notEqual(parts[0].extras.part_id, parts[1].extras.part_id);
  const replay = await runCadImport({ ...f, mechanismId: 'test-contract-fixture', fromCache: true, backendRunner() { throw new Error('cache must skip backend'); } });
  assert.equal(sha256(replay.glb), sha256(result.glb)); assert.deepEqual(replay.manifest, result.manifest);
});

test('changed placements, source hashes or backend version cannot overwrite an existing display', async t => {
  const changes = [
    data => { data.occurrences[1].localMatrixMm[12] = 90; },
    data => { data.sourceSHA256 = '0'.repeat(64); },
    data => { data.importer.version = 'unreviewed'; },
  ];
  for (const [i, change] of changes.entries()) await t.test(`inconsistent backend ${i}`, async child => {
    const f = await fixture(child), assets = join(f.exampleDirectory, 'assets'); await mkdir(assets);
    await writeFile(join(assets, 'assembly.glb'), 'keep existing display');
    await assert.rejects(runCadImport({ ...f, backendRunner(options) {
      const data = backendData(f.record.sourceSHA256, options); if (options.name === 'coarse') change(data); return data;
    } }));
    assert.equal(await readFile(join(assets, 'assembly.glb'), 'utf8'), 'keep existing display');
    await assert.rejects(access(join(assets, 'assembly-manifest.json')));
  });
});

test('different tolerances may legitimately retain equal triangle counts without claiming a density change', async t => {
  const f = await fixture(t);
  const result = await runCadImport({ ...f, backendRunner(options) {
    const data = backendData(f.record.sourceSHA256, options);
    if (options.name === 'coarse') { data.definitions[1].geometry.indices = [0, 1, 2, 0, 2, 3]; data.definitions[1].geometry.triangleCount = 2; }
    return data;
  } });
  assert.equal(result.display.triangles, result.coarseTriangles);
  assert.equal(result.report.tessellationComparison.geometryDensityChanged, false);
  assert.match(result.report.tessellationComparison.note, /equal triangle counts/);
});

test('publication failure rolls back previous files and removes newly created owned files', async t => {
  const f = await fixture(t), assets = join(f.exampleDirectory, 'assets'); await mkdir(assets);
  const names = ['assembly-manifest.json', 'scene-contract.json', 'import-report.json', 'assembly.glb'];
  await writeFile(join(assets, names[0]), 'original manifest');
  await writeFile(join(assets, names[3]), 'original glb');
  await writeFile(join(assets, 'unrelated-audio.mp3'), 'preserve unrelated asset');
  let calls = 0;
  await assert.rejects(publishCadAssets({ root: f.root, assetsDirectory: assets, stagingDirectory: join(f.root, '.cache', 'publish-test'), payloads: new Map(names.map(name => [name, `new ${name}`])), async renameFile(from, to) {
    calls++; if (calls === 3) throw new Error('injected publication failure');
    await rename(from, to);
  } }), /injected publication failure/);
  assert.equal(calls, 3);
  assert.equal(await readFile(join(assets, names[0]), 'utf8'), 'original manifest');
  assert.equal(await readFile(join(assets, names[3]), 'utf8'), 'original glb');
  await assert.rejects(access(join(assets, names[1]))); await assert.rejects(access(join(assets, names[2])));
  assert.equal(await readFile(join(assets, 'unrelated-audio.mp3'), 'utf8'), 'preserve unrelated asset');
});

test('non-file publication target is rejected before any owned asset is replaced', async t => {
  const f = await fixture(t), assets = join(f.exampleDirectory, 'assets'); await mkdir(assets);
  const names = ['assembly-manifest.json', 'scene-contract.json', 'import-report.json', 'assembly.glb'];
  await writeFile(join(assets, names[0]), 'original manifest'); await mkdir(join(assets, names[3]));
  let calls = 0;
  await assert.rejects(publishCadAssets({ root: f.root, assetsDirectory: assets, stagingDirectory: join(f.root, '.cache', 'publish-test'), payloads: new Map(names.map(name => [name, 'new'])), renameFile() { calls++; } }), /regular file/);
  assert.equal(calls, 0); assert.equal(await readFile(join(assets, names[0]), 'utf8'), 'original manifest');
  await assert.rejects(access(join(f.root, '.cache')));
});

test('CLI requires an explicit example and rejects unknown options before starting CAD', () => {
  const result = spawnSync(process.execPath, ['tools/cad/import-assembly.mjs', '--from-cache'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stderr, /--example/);
  const unknown = spawnSync(process.execPath, ['tools/cad/import-assembly.mjs', '--example', 'examples/wolf-actuator', '--global'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(unknown.status, 1); assert.match(unknown.stderr, /Usage/);
});
