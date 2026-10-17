/** Project-local, one-root, explicit metre/millimetre STEP assembly import workflow.
 * The Python XCAF reader owns CAD interpretation. This module verifies its
 * retained source and derives display assets; it is not a general STEP parser.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, realpath, lstat, stat, rename, copyFile, unlink, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, relative, isAbsolute, dirname, basename, resolve, sep } from 'node:path';
import { sha256 } from '../../shared/assets/glb.mjs';
import { buildXcafDisplay } from './xcaf-display.mjs';

export const projectRoot = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
const PINNED_OCP_VERSION = '7.8.1.1.post1'; // requirements-xcaf.txt
const SETTINGS = Object.freeze([
  Object.freeze({ name: 'fine', linearDeflectionMm: .08, angularDeflectionRadians: .4 }),
  Object.freeze({ name: 'coarse', linearDeflectionMm: .3, angularDeflectionRadians: .7 }),
]);
function inside(root, path, allowRoot = false) {
  const rel = relative(root, path);
  if ((!allowRoot && !rel) || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error('CAD paths must stay inside Mechanism Studio and cannot target the project root.');
  }
  return path;
}

/** Follow every existing ancestor junction before either reading or creating. */
export async function resolveScopedPath(root, path, { mustExist = false, allowRoot = false } = {}) {
  root = inside(projectRoot, await realpath(root), true);
  const candidate = inside(root, resolve(root, path), allowRoot);
  if (mustExist) return inside(root, await realpath(candidate), allowRoot);
  let cursor = candidate; const tail = [];
  for (;;) {
    try { await lstat(cursor); break; } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      tail.unshift(basename(cursor)); const parent = dirname(cursor);
      if (parent === cursor) throw error;
      cursor = parent;
    }
  }
  return inside(root, join(await realpath(cursor), ...tail), allowRoot);
}

/** Public examples are existing, direct children of this root's examples/. */
export async function resolveExample(root, example) {
  if (typeof example !== 'string') throw new Error('Use --example examples/<directory>.');
  const normalized = example.replaceAll('\\', '/').replace(/\/$/, '');
  if (!/^examples\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(normalized) || /\/(?:\.|\.\.)$/.test(normalized)) {
    throw new Error('Example must be an existing examples/<directory>, not an absolute path or project root.');
  }
  const examples = await resolveScopedPath(root, 'examples', { mustExist: true });
  const directory = await resolveScopedPath(root, normalized, { mustExist: true });
  if (dirname(directory) !== examples || !(await stat(directory)).isDirectory()) {
    throw new Error('Example must resolve to a direct directory inside examples/.');
  }
  return directory;
}

function preflightStep(bytes) {
  // Ignore comments and quoted strings when testing syntax keywords. This is a
  // restricted input gate, not ISO 10303 conformance validation; OCCT reads CAD.
  const text = bytes.toString('latin1').replace(/\/\*[\s\S]*?\*\/|'(?:[^']|'')*'/g, ' ');
  if (!/^\s*ISO-10303-21\s*;/i.test(text) || !/END-ISO-10303-21\s*;\s*$/i.test(text) || !/\bHEADER\s*;/i.test(text) || !/\bDATA\s*;/i.test(text)) {
    throw new Error('Source must be an ISO-10303-21 STEP document with HEADER and DATA sections.');
  }
  if (/\b(?:DOCUMENT_FILE|EXTERNALLY_DEFINED_REPRESENTATION|EXTERNAL_SOURCE|EXTERNALLY_DEFINED_ITEM)\s*\(|\bREFERENCE\s*;/i.test(text)) {
    throw new Error('External-file STEP references are not enabled; use a self-contained assembly.');
  }
  const units = new Map(), contexts = []; let sourceNauoCount = 0, productDefinitionCount = 0, unassignedSurfaceParameterContextCount = 0;
  for (const match of text.matchAll(/#(\d+)\s*=\s*([^;]*);/g)) {
    const raw = match[2];
    if (/^\s*NEXT_ASSEMBLY_USAGE_OCCURRENCE\s*\(/i.test(raw)) sourceNauoCount++;
    if (/^\s*PRODUCT_DEFINITION\s*\(/i.test(raw)) productDefinitionCount++;
    if (/\bLENGTH_UNIT\s*\(/i.test(raw)) units.set(`#${match[1]}`, /\bSI_UNIT\s*\(\s*\.MILLI\.\s*,\s*\.METRE\.\s*\)/i.test(raw) ? 'mm' : /\bSI_UNIT\s*\(\s*\$\s*,\s*\.METRE\.\s*\)/i.test(raw) ? 'm' : 'unsupported');
    if (/\bGEOMETRIC_REPRESENTATION_CONTEXT\s*\(/i.test(raw)) {
      const assigned = raw.match(/\bGLOBAL_UNIT_ASSIGNED_CONTEXT\s*\(\s*\(([^)]*)\)\s*\)/i);
      // A surface's UV parameter space can be declared separately from its
      // spatial model. Accept only the explicitly named 2D parametric form
      // without assigned units here; do not treat arbitrary 2D/3D geometry
      // contexts as unitless or bypass the backend's FileUnits check.
      if (!assigned && /\bGEOMETRIC_REPRESENTATION_CONTEXT\s*\(\s*2\s*\)/i.test(raw) && /\bPARAMETRIC_REPRESENTATION_CONTEXT\s*\(\s*\)/i.test(raw)) {
        unassignedSurfaceParameterContextCount++;
        continue;
      }
      if (!assigned) throw new Error('Geometry context must explicitly declare metre or millimetre units.');
      contexts.push(assigned[1].match(/#\d+/g) || []);
    }
  }
  if (!sourceNauoCount || productDefinitionCount < 2) throw new Error('This workflow requires a STEP assembly with source product definitions and NAUO relationships.');
  const spatialUnits = contexts.map(refs => {
    const lengths = refs.filter(ref => units.has(ref)).map(ref => units.get(ref));
    if (lengths.length !== 1 || !['m', 'mm'].includes(lengths[0])) throw new Error('Only explicit metre or millimetre geometry contexts are supported by this workflow.');
    return lengths[0];
  });
  if (!spatialUnits.length || new Set(spatialUnits).size !== 1) throw new Error('Geometry contexts must use one uniform explicit metre or millimetre unit; mixed spatial units are not supported.');
  return { scope: 'self-contained STEP assembly; uniform explicit m or mm geometry contexts normalized by OCCT to mm; one XCAF root required after import', sourceLengthUnit: spatialUnits[0], importedLengthUnit: 'mm', productDefinitionCount, sourceNauoCount, geometryContextCount: contexts.length, unassignedSurfaceParameterContextCount };
}

/** Read and reject unreviewed source before runtime startup or cache writes. */
export async function readCadSourcePackage({ root = projectRoot, example } = {}) {
  root = await resolveScopedPath(projectRoot, root, { mustExist: true, allowRoot: true });
  const exampleDirectory = await resolveExample(root, example);
  const sourceDirectory = await resolveScopedPath(root, join(exampleDirectory, 'source'), { mustExist: true });
  inside(exampleDirectory, sourceDirectory);
  const provenancePath = await resolveScopedPath(root, join(sourceDirectory, 'provenance.json'), { mustExist: true });
  if (dirname(provenancePath) !== sourceDirectory || !(await stat(provenancePath)).isFile()) throw new Error('Source provenance must be a regular file inside this example source/.');
  const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
  if (!/^[a-f0-9]{64}$/.test(provenance.sourceSHA256 || '')) throw new Error('Provenance must pin sourceSHA256 as a lowercase SHA-256.');
  const localFile = provenance.localFile ?? 'assembly.step';
  if (typeof localFile !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9 ._-]*\.(?:step|stp)$/i.test(localFile) || basename(localFile) !== localFile) {
    throw new Error('provenance.localFile must be a STEP filename directly inside source/.');
  }
  const sourcePath = await resolveScopedPath(root, join(sourceDirectory, localFile), { mustExist: true });
  if (dirname(sourcePath) !== sourceDirectory || !(await stat(sourcePath)).isFile()) throw new Error('Source must be a regular STEP file inside this example source/.');
  const sourceBytes = await readFile(sourcePath);
  if (sha256(sourceBytes) !== provenance.sourceSHA256) throw new Error('The source differs from its reviewed provenance.');
  if (provenance.sourceByteLength !== undefined && provenance.sourceByteLength !== sourceBytes.length) throw new Error('The source byte length differs from its reviewed provenance.');
  if (provenance.sourceLengthUnit !== undefined && !['m', 'mm'].includes(provenance.sourceLengthUnit)) throw new Error('Only metre or millimetre source provenance is supported.');
  const preflight = preflightStep(sourceBytes);
  if (provenance.sourceLengthUnit !== undefined && provenance.sourceLengthUnit !== preflight.sourceLengthUnit) throw new Error('Provenance sourceLengthUnit disagrees with retained STEP spatial units.');
  if (provenance.sourceContents?.usageRelations !== undefined) assert.equal(preflight.sourceNauoCount, provenance.sourceContents.usageRelations, 'Retained STEP usages disagree with provenance.');
  if (provenance.sourceContents?.productDefinitions !== undefined) assert.equal(preflight.productDefinitionCount, provenance.sourceContents.productDefinitions, 'Retained STEP definitions disagree with provenance.');
  return { root, exampleDirectory, sourceDirectory, sourcePath, sourceBytes, provenance, sourceFile: `source/${localFile}`, preflight };
}

function projection(data) {
  return { sourceSHA256: data.sourceSHA256, roots: data.roots, definitions: data.definitions.map(({ geometry, ...definition }) => definition), occurrences: data.occurrences };
}

async function defaultBackendRunner({ root, sourcePath, outputPath, temporaryPath, linearDeflectionMm, angularDeflectionRadians, name }) {
  const python = await resolveScopedPath(root, process.platform === 'win32' ? '.tools/cad-python/Scripts/python.exe' : '.tools/cad-python/bin/python', { mustExist: true });
  const script = await resolveScopedPath(root, 'tools/cad/import-xcaf.py', { mustExist: true });
  const result = spawnSync(python, [script, '--source', relative(root, sourcePath), '--output', relative(root, outputPath), '--linear-deflection', String(linearDeflectionMm), '--angular-deflection', String(angularDeflectionRadians)], {
    cwd: root, env: { ...process.env, TEMP: temporaryPath, TMP: temporaryPath, TMPDIR: temporaryPath, PYTHONDONTWRITEBYTECODE: '1' }, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`XCAF ${name} import failed (${result.status}).`);
}

const ASSET_NAMES = Object.freeze(['assembly-manifest.json', 'scene-contract.json', 'import-report.json', 'assembly.glb']);

/** Stage and back up all owned assets, then replace them with rollback on error.
 * This protects ordinary failed publication; it is not a multi-file atomic
 * reader transaction and does not promise recovery from process/OS termination.
 */
export async function publishCadAssets({ root = projectRoot, assetsDirectory, stagingDirectory, payloads, renameFile = rename } = {}) {
  if (!(payloads instanceof Map) || payloads.size !== ASSET_NAMES.length || ASSET_NAMES.some(name => !payloads.has(name))) throw new Error('Publish exactly the four owned CAD asset files.');
  const assets = await resolveScopedPath(root, assetsDirectory);
  const records = [];
  async function checkedTarget(name) {
    const path = join(assets, name), target = await resolveScopedPath(root, path);
    if (dirname(target) !== assets) throw new Error('CAD asset target redirects outside its assets directory.');
    try {
      const entry = await lstat(path);
      if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`CAD asset target must be a regular file: ${name}`);
      return { name, path, existed: true };
    } catch (error) { if (error.code !== 'ENOENT') throw error; return { name, path, existed: false }; }
  }
  for (const name of ASSET_NAMES) records.push(await checkedTarget(name));
  const stage = await resolveScopedPath(root, join(stagingDirectory, `publish-${randomUUID()}`));
  const staged = join(stage, 'staged'), backups = join(stage, 'backups');
  let published = false, rollbackComplete = true; const changed = [];
  try {
    await mkdir(await resolveScopedPath(root, staged), { recursive: true }); await mkdir(await resolveScopedPath(root, backups));
    for (const record of records) {
      await writeFile(await resolveScopedPath(root, join(staged, record.name)), payloads.get(record.name), { flag: 'wx' });
      if (record.existed) await copyFile((await checkedTarget(record.name)).path, await resolveScopedPath(root, join(backups, record.name)));
    }
    await mkdir(await resolveScopedPath(root, assets), { recursive: true });
    for (const record of records) {
      const current = await checkedTarget(record.name);
      if (current.existed !== record.existed) throw new Error(`CAD asset changed during publication: ${record.name}`);
      await renameFile(await resolveScopedPath(root, join(staged, record.name), { mustExist: true }), current.path);
      changed.push(record);
    }
    published = true;
  } catch (error) {
    const rollbackErrors = [];
    for (const record of changed.reverse()) {
      try {
        const current = await checkedTarget(record.name);
        if (record.existed) await copyFile(await resolveScopedPath(root, join(backups, record.name), { mustExist: true }), current.path);
        else if (current.existed) await unlink(current.path);
      } catch (failure) { rollbackErrors.push(failure); }
    }
    rollbackComplete = rollbackErrors.length === 0;
    if (!rollbackComplete) throw new AggregateError([error, ...rollbackErrors], `CAD publication failed; rollback incomplete. Retained backups: ${relative(root, backups)}`);
    throw error;
  } finally {
    if (published || rollbackComplete) {
      // The recursive target is this freshly scoped, unique staging directory.
      // No other cache or example assets are removed.
      const target = await resolveScopedPath(root, stage);
      await rm(target, { recursive: true, force: true });
    }
  }
}

/** The backendRunner injection is for workflow tests; production uses XCAF. */
export async function runCadImport({ root = projectRoot, example, fromCache = false, cacheDirectory, cachePrefix = '', mechanismId, backendRunner = defaultBackendRunner } = {}) {
  const source = await readCadSourcePackage({ root, example });
  ({ root } = source);
  const exampleKey = `${basename(source.exampleDirectory)}-${sha256(Buffer.from(relative(root, source.exampleDirectory).replaceAll('\\', '/'))).slice(0, 8)}`;
  cacheDirectory ??= `.cache/cad/imports/${exampleKey}`;
  if (!/^(?:\.cache\/cad\/imports\/[a-zA-Z0-9._-]+|output\/cad-research(?:\/[a-zA-Z0-9._-]+)?)$/.test(cacheDirectory.replaceAll('\\', '/')) || !/^[a-zA-Z0-9_-]*$/.test(cachePrefix)) {
    throw new Error('CAD import caches must stay in .cache/cad/imports/<key> or output/cad-research.');
  }
  const cache = await resolveScopedPath(root, cacheDirectory);
  const temporaryPath = await resolveScopedPath(root, '.cache/cad/tmp');
  const paths = new Map();
  // Check every target before any mkdir/backend call, including existing links.
  for (const { name } of SETTINGS) {
    const target = await resolveScopedPath(root, join(cache, `${cachePrefix}${name}.json`));
    if (dirname(target) !== cache) throw new Error('Cache files cannot redirect outside their cache directory.');
    paths.set(name, target);
  }
  const assets = await resolveScopedPath(root, join(source.exampleDirectory, 'assets'));
  inside(source.exampleDirectory, assets);
  const assetPaths = new Map();
  for (const name of ['assembly-manifest.json', 'scene-contract.json', 'import-report.json', 'assembly.glb']) {
    const target = await resolveScopedPath(root, join(assets, name));
    if (dirname(target) !== assets) throw new Error('Display assets cannot redirect outside this example assets/.');
    assetPaths.set(name, target);
  }
  if (!fromCache) {
    await mkdir(cache, { recursive: true }); await mkdir(temporaryPath, { recursive: true });
    await resolveScopedPath(root, cache, { mustExist: true }); await resolveScopedPath(root, temporaryPath, { mustExist: true });
    for (const setting of SETTINGS) {
      const outputPath = await resolveScopedPath(root, paths.get(setting.name));
      const returned = await backendRunner({ root, sourcePath: source.sourcePath, outputPath, temporaryPath, ...setting });
      if (returned !== undefined) await writeFile(await resolveScopedPath(root, outputPath), JSON.stringify(returned) + '\n');
    }
  }
  const [fine, coarse] = await Promise.all(SETTINGS.map(async ({ name }) => JSON.parse(await readFile(await resolveScopedPath(root, paths.get(name), { mustExist: true }), 'utf8'))));
  for (const [i, data] of [fine, coarse].entries()) {
    const setting = SETTINGS[i];
    assert.equal(data.sourceSHA256, source.provenance.sourceSHA256, 'Cache belongs to a different STEP source.');
    assert.equal(data.schema, 'mechanism-studio-xcaf-1');
    assert.equal(data.importer?.package, 'cadquery-ocp', 'The exact XCAF backend is required.');
    assert.equal(data.importer?.version, PINNED_OCP_VERSION, 'The pinned XCAF backend version is required.');
    assert.equal(data.importer?.linearDeflectionMm, setting.linearDeflectionMm, 'Cache tessellation setting differs.');
    assert.equal(data.importer?.angularDeflectionRadians, setting.angularDeflectionRadians, 'Cache tessellation setting differs.');
    assert.equal(data.statistics?.unmappedSourceOccurrences, 0, 'Every source occurrence requires exact XCAF mapping.');
    assert.equal(data.statistics?.sourceNauoCount, source.preflight.sourceNauoCount, 'XCAF source usages disagree with retained STEP.');
    assert.equal(data.units?.importedLength, 'mm', 'XCAF geometry and placements must be normalized to millimetres.');
    const expectedName = source.preflight.sourceLengthUnit === 'm' ? 'metre' : 'millimetre';
    assert.ok(Array.isArray(data.units.sourceLengthNames) && data.units.sourceLengthNames.length && data.units.sourceLengthNames.every(name => name === expectedName), 'XCAF original source unit names disagree with retained STEP spatial units.');
  }
  assert.deepEqual(projection(fine), projection(coarse), 'Source definitions, occurrences, parent paths and every placement must survive remeshing unchanged.');
  assert.equal(fine.importer.version, coarse.importer.version, 'Both tessellations must use the same importer version.');
  assert.deepEqual(fine.units, coarse.units, 'Source units must survive remeshing unchanged.');
  const result = buildXcafDisplay(fine, source.provenance, { mechanismId: mechanismId ?? `step-${basename(source.exampleDirectory)}`, sourceFile: source.sourceFile });
  const coarseDefinitions = new Map(coarse.definitions.map(definition => [definition.definition_id, definition]));
  const coarseTriangles = coarse.occurrences.reduce((sum, occurrence) => sum + (coarseDefinitions.get(occurrence.definition_id).geometry?.triangleCount || 0), 0);
  const geometryDensityChanged = coarseTriangles !== result.display.triangles;
  const report = {
    schemaVersion: '1.0.0', status: 'source-occurrence-identity-verified', sourceSHA256: sha256(source.sourceBytes), glbSHA256: sha256(result.glb), importer: fine.importer,
    sourceStatistics: fine.statistics, sourceUnits: fine.units, display: result.display,
    identityMapping: { method: fine.importer.identityMapping, unmappedSourceOccurrences: 0, partId: 'source occurrence path, never mesh order or display name', definitionsReusedAsGlbMeshes: true, sourceGraphSHA256: sha256(Buffer.from(JSON.stringify(projection(fine)))) },
    meshWarnings: fine.meshWarnings || [], generatedGeometryComponents: fine.generatedGeometryComponents || [],
    sourceGeometryRepresentations: fine.definitions.filter(definition => definition.geometry?.sourceTriangulatedFaceCount).map(definition => ({ definition_id: definition.definition_id, name: definition.name, representation: definition.geometry.representation, sourceTriangulatedFaceCount: definition.geometry.sourceTriangulatedFaceCount, analyticFaceCount: definition.geometry.analyticFaceCount, boundsEvidence: definition.geometry.boundsEvidence })),
    tessellationComparison: { fine: { linearDeflectionMm: .08, angularDeflectionRadians: .4, triangles: result.display.triangles }, coarse: { linearDeflectionMm: .3, angularDeflectionRadians: .7, triangles: coarseTriangles }, definitionAndOccurrenceIdentityUnchanged: true, localAndWorldMatricesUnchanged: true, ...(!geometryDensityChanged ? { geometryDensityChanged: false, note: 'Distinct tessellation settings produced equal triangle counts; no density change is claimed.' } : {}) },
    coordinateConversion: { source: `native STEP axes, ${source.preflight.sourceLengthUnit}`, ...(source.preflight.sourceLengthUnit === 'm' ? { imported: 'native STEP axes, mm; normalized by OCCT', originalToImportedScale: 1000 } : {}), display: 'm, +Y up', points: '0.001*[x,z,-y]', placements: 'C*M_source*inverse(C), including rotations' },
    mixedProducts: result.manifest.definitions.filter(definition => definition.kind === 'assembly' && definition.geometry).map(definition => ({ definition_id: definition.definition_id, name: definition.name, note: 'Own shape kept on the real source occurrence; synthetic XCAF solid labels are not engineering occurrences.' })),
    observation: 'Hidden, isolated and exploded states belong to display wrappers; source matrices remain immutable. Radial explosion is not a collision-verified disassembly sequence.',
    limitations: result.manifest.limitations,
  };
  // No public assets are written until source, both backend graphs and display
  // contract pass. Equal counts at distinct settings are legitimate for planes.
  const payloads = new Map([['assembly-manifest.json', JSON.stringify(result.manifest, null, 2) + '\n'], ['scene-contract.json', JSON.stringify(result.contract, null, 2) + '\n'], ['import-report.json', JSON.stringify(report, null, 2) + '\n'], ['assembly.glb', result.glb]]);
  await publishCadAssets({ root, assetsDirectory: assets, stagingDirectory: cache, payloads });
  return { ...result, report, coarseTriangles, cacheDirectory: cache, exampleDirectory: source.exampleDirectory };
}

function parseArguments(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--example' && args[i + 1] && !args[i + 1].startsWith('--')) options.example = args[++i];
    else if (args[i] === '--from-cache') options.fromCache = true;
    else throw new Error('Usage: node tools/cad/import-assembly.mjs --example examples/<directory> [--from-cache]');
  }
  if (!options.example) throw new Error('Use --example examples/<directory>.');
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runCadImport(parseArguments(process.argv.slice(2)));
    console.log(JSON.stringify({ ...result.report.sourceStatistics, display: result.display, coarseTriangles: result.coarseTriangles, glbSHA256: result.report.glbSHA256 }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
