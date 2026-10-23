/** Run original, project-authored assembly recipes without model downloads. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join, relative } from 'node:path';
import { readGlb, sha256 } from '../../shared/assets/glb.mjs';
import { validateSceneContract } from '../../shared/assets/contract.mjs';
import { buildScore, scoreWavPath } from '../../scripts/build-audio.mjs';
import { checkedPath } from '../video/export.mjs';
import { getExample, PROJECT_ROOT } from './registry.mjs';

const common = ['scene-index.json', 'scene-contract.json', 'provenance.json', 'build-report.json'];
const handoffs = ['brief', 'timeline', 'mechanism-plan', 'explosion-plan', 'camera-plan', 'annotation-plan', 'appearance-plan'];
const recipes = Object.freeze({
  'robot-joint': Object.freeze({
    directory: 'examples/robot-joint', asset: 'assembly.glb',
    scripts: Object.freeze(['examples/robot-joint/build-joint.mjs']),
    inputs: Object.freeze(['examples/robot-joint/spec.mjs', 'examples/robot-joint/geometry.mjs', 'examples/robot-joint/kinematics.mjs',
      'examples/planetary-gears/spec.mjs', 'examples/planetary-gears/geometry.mjs']),
    plans: Object.freeze([]), provenanceKind: 'original-parametric-teaching-model',
  }),
  'planetary-gears': Object.freeze({
    directory: 'examples/planetary-gears', asset: 'assembly.glb',
    scripts: Object.freeze(['examples/planetary-gears/build-planetary.mjs']),
    inputs: Object.freeze(['examples/planetary-gears/spec.mjs', 'examples/planetary-gears/geometry.mjs']),
    plans: Object.freeze([]), provenanceKind: 'original-parametric-teaching-model',
  }),
  gearbox: Object.freeze({
    directory: 'examples/gearbox', asset: 'gearbox.glb',
    scripts: Object.freeze(['examples/gearbox/build-gearbox.mjs', 'examples/gearbox/planning/build-plans.mjs']),
    inputs: Object.freeze(['examples/gearbox/spec.mjs', 'examples/gearbox/geometry.mjs', 'examples/gearbox/kinematics.mjs']),
    plans: Object.freeze(handoffs.map(name => `examples/gearbox/planning/${name}.json`)),
    provenanceKind: 'original-teaching-model',
  }),
});

const artifacts = recipe => [recipe.asset, ...common].map(name => `${recipe.directory}/assets/${name}`).concat(recipe.plans);
const constructionFiles = ['shared/assets/write-glb.mjs', 'shared/assets/glb.mjs', 'shared/assets/contract.mjs'];
const sourceFiles = recipe => [...new Set([...recipe.scripts, ...recipe.inputs, ...constructionFiles,
  `${recipe.directory}/audio/build.mjs`, `${recipe.directory}/audio/synth.mjs`])];
const ensure = (value, message) => { if (!value) throw new Error(message); };
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

export function generationRecipe(entry) {
  // Only the frozen registry object is accepted: callers cannot supply an
  // executable, output folder, source URL or arbitrary path through this API.
  ensure(entry && getExample(entry.id) === entry && entry.generate && recipes[entry.id], 'No registered local generation recipe. Run studio list to see supported original assemblies.');
  const recipe = recipes[entry.id];
  ensure(entry.audio?.metadata === `${recipe.directory}/audio/music-score.json`
    && entry.audio.build.length === 1 && entry.audio.build[0] === `${recipe.directory}/audio/build.mjs`, 'The original recipe must use its own local score builder.');
  return recipe;
}

/** Preflight every known write target, including an existing linked leaf file. */
export async function checkGenerationPaths(recipe, { root = PROJECT_ROOT } = {}) {
  ensure(Object.values(recipes).includes(recipe), 'Use a registered generation recipe.');
  const paths = [...sourceFiles(recipe), `${recipe.directory}/assets`, ...artifacts(recipe)];
  for (const path of paths) await checkedPath(path, { root });
  return paths;
}

export async function runLocalBuilder(script, { temporaryDirectory }) {
  ensure(Object.values(recipes).some(recipe => recipe.scripts.includes(script) || script === `${recipe.directory}/audio/build.mjs`), 'Unknown local builder.');
  await checkedPath(script);
  await checkedPath(relative(PROJECT_ROOT, temporaryDirectory), { output: true });
  const env = { ...process.env, TMP: temporaryDirectory, TEMP: temporaryDirectory, TMPDIR: temporaryDirectory };
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd: PROJECT_ROOT, env, windowsHide: true, timeout: 120_000 });
    let output = '';
    const collect = bytes => {
      output += bytes.toString();
      if (output.length > 1_000_000) { child.kill(); reject(new Error(`${script}: generator output exceeded its limit.`)); }
    };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.once('error', reject);
    child.once('close', (code, signal) => code === 0 ? resolve(output) : reject(new Error(`${script} failed (${signal || code}): ${output.trim().slice(-2000)}`)));
  });
}

export async function inspectGeneratedAssembly(entry) {
  const recipe = generationRecipe(entry), base = `${recipe.directory}/assets`;
  const load = async name => readJson(await checkedPath(`${base}/${name}`));
  const [index, contract, provenance, report] = await Promise.all(common.map(load));
  const asset = `${base}/${recipe.asset}`, bytes = await readFile(await checkedPath(asset));
  const glb = readGlb(bytes);
  const validated = validateSceneContract(glb.json, contract);
  const ids = index.parts.map(part => part.id), definitions = new Set(index.parts.map(part => part.definitionId));
  ensure(new Set(ids).size === ids.length, 'Generated scene index contains duplicate part IDs.');
  ensure(ids.length === report.partCount && ids.length === contract.parts.length, 'Generated part count does not match its contract/report.');
  ensure(definitions.size === report.definitionCount && definitions.size === glb.json.meshes.length, 'Generated definition count does not match its meshes/report.');
  ensure(index.assemblies.length === report.assemblyCount && index.assemblies.length === glb.json.nodes.filter(node => node.extras?.assembly_id).length, 'Generated assembly count does not match its hierarchy/report.');
  ensure(index.asset.file === `assets/${recipe.asset}` && index.asset.sha256 === sha256(bytes) && report.glbSHA256 === sha256(bytes), 'Generated asset hash does not match its index/report.');
  ensure(report.glbBytes === bytes.length, 'Generated asset byte length does not match its report.');
  ensure(index.geometryRevision === contract.assetRevision && index.geometryRevision === report.geometryRevision, 'Generated geometry revisions disagree.');
  ensure(provenance.kind === recipe.provenanceKind && provenance.license === 'MIT', 'Generated assembly is not the registered original MIT teaching model.');
  ensure(contract.parts.every(part => ids.includes(part.part_id)), 'Generated contract part IDs differ from the scene index.');
  for (const part of index.parts) {
    const actual = validated.byId.get(part.id), declared = contract.parts.find(record => record.part_id === part.id);
    ensure(actual.extras.definitionId === part.definitionId && declared.definitionId === part.definitionId, `${part.id}: reusable definition differs across asset/index/contract.`);
    ensure(part.parentId === declared.parent_id, `${part.id}: index parent differs from the exported contract.`);
  }
  for (const path of recipe.plans) {
    const plan = await readJson(await checkedPath(path));
    ensure(plan.geometryRevision === index.geometryRevision, `${path} is bound to a different geometry revision.`);
  }
  return { asset, partCount: ids.length, definitionCount: definitions.size, assemblyCount: index.assemblies.length,
    geometryRevision: index.geometryRevision, glbSHA256: sha256(bytes), limitation: 'Original tessellated teaching geometry; no manufacturing CAD, loaded contact or collision-free dismantling certification.' };
}

async function fingerprints(paths, optional = false) {
  return Promise.all(paths.map(async file => {
    const path = await checkedPath(file);
    try { const bytes = await readFile(path); return { file, bytes: bytes.length, sha256: sha256(bytes) }; }
    catch (error) { if (optional && error.code === 'ENOENT') return { file, missing: true }; throw error; }
  }));
}

function scoreMatchesGeometry(score, geometryRevision) {
  if (!score || score.geometryRevision !== geometryRevision) return false;
  const matches = value => value === null || typeof value !== 'object'
    || Object.entries(value).every(([key, child]) => key === 'geometryRevision' ? child === geometryRevision : matches(child));
  return matches(score);
}

/** Rebind editorial cues only when their referenced model revision changed. */
export async function prepareOriginalScore(entry, geometryRevision, {
  temporaryDirectory, runBuilder = runLocalBuilder, prepareScore = buildScore, log = () => {},
  readMetadata = async () => readJson(await checkedPath(entry.audio.metadata)),
} = {}) {
  const recipe = generationRecipe(entry); let rebuild = null;
  if (!scoreMatchesGeometry(await readMetadata(), geometryRevision)) {
    const script = `${recipe.directory}/audio/build.mjs`;
    log(`Rebinding original music to the generated geometry: ${script}`);
    const output = await runBuilder(script, { temporaryDirectory });
    rebuild = { script, status: 'complete', reason: 'geometry-revision-changed', output: String(output).trim() };
  }
  ensure(scoreMatchesGeometry(await readMetadata(), geometryRevision), 'Original score metadata is bound to a different geometry revision.');
  const score = await prepareScore(entry.audio);
  return { score, rebuild };
}

export async function generateExample(entry, { log = () => {}, runBuilder = runLocalBuilder, prepareScore = buildScore } = {}) {
  const recipe = generationRecipe(entry);
  await checkGenerationPaths(recipe);
  const audioMetadata = await checkedPath(entry.audio.metadata);
  const audio = scoreWavPath(entry.audio.metadata, await readJson(audioMetadata));
  await checkedPath(audio);
  // One job receipt per invocation. Existing films, review evidence and source
  // drawings remain untouched; the registered derived model files are rebuilt.
  const outputDirectory = `output/studio/generate-${entry.id}-${randomUUID()}`;
  const folder = await checkedPath(outputDirectory, { output: true });
  await mkdir(folder, { recursive: true });
  const temporaryDirectory = await checkedPath(`${outputDirectory}/tmp`, { output: true });
  await mkdir(temporaryDirectory);
  const reportPath = `${outputDirectory}/generation.json`, started = performance.now();
  const record = { schema: 'mechanism-local-generation-1', example: entry.id, startedAt: new Date().toISOString(), runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    status: 'running', recipe: [...recipe.scripts], inputs: await fingerprints(sourceFiles(recipe)),
    before: await fingerprints(artifacts(recipe), true), stages: [],
    modelSource: 'Original project-authored dimensions and mesh construction; no external model request.',
    scope: 'Rebuilds one registered example in place. Does not generate arbitrary designs from text or images.' };
  const persist = () => writeFile(join(folder, 'generation.json'), `${JSON.stringify(record, null, 2)}\n`);
  await persist();
  try {
    for (const script of recipe.scripts) {
      await checkGenerationPaths(recipe);
      log(`Building locally: ${script}`);
      const output = await runBuilder(script, { temporaryDirectory });
      record.stages.push({ script, status: 'complete', output: String(output).trim() });
      await persist();
    }
    await checkGenerationPaths(recipe);
    const result = await inspectGeneratedAssembly(entry);
    await checkedPath(entry.audio.metadata);
    await checkedPath(audio);
    log(`Preparing original code-generated music: ${audio}`);
    const { score, rebuild } = await prepareOriginalScore(entry, result.geometryRevision, { temporaryDirectory, runBuilder, prepareScore, log });
    if (rebuild) { record.stages.push(rebuild); await persist(); }
    record.audio = { ...score, ...(await fingerprints([audio]))[0], metadata: (await fingerprints([entry.audio.metadata]))[0], geometryRevision: result.geometryRevision };
    record.result = result;
    record.after = await fingerprints(artifacts(recipe));
    record.inputsAfter = await fingerprints(sourceFiles(recipe));
    ensure(JSON.stringify(record.inputs) === JSON.stringify(record.inputsAfter), 'Sources changed during local generation; rerun after edits settle.');
    record.status = 'complete'; record.elapsedSeconds = Number(((performance.now() - started) / 1000).toFixed(3));
    await persist();
    return { ...result, report: reportPath, outputDirectory, elapsedSeconds: record.elapsedSeconds };
  } catch (error) {
    record.status = 'failed'; record.error = error.message;
    record.elapsedSeconds = Number(((performance.now() - started) / 1000).toFixed(3));
    await persist();
    throw new Error(`${error.message}\nGeneration stopped; inspect ${reportPath}. Derived files may be partially rebuilt.`, { cause: error });
  }
}
