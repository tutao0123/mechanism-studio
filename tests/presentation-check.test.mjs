import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkExample, inspectPresentation, parseArguments } from '../tools/study/check-presentation.mjs';
import { createGripperPresentation } from '../examples/robotiq-gripper/presentation.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const read = async path => JSON.parse(await readFile(resolve(project, path), 'utf8'));
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sourceIndex = await read('examples/robotiq-gripper/assets/scene-index.json');
const sourceProvenance = await read('examples/robotiq-gripper/source/provenance.json');
const sourceScore = await read('examples/robotiq-gripper/audio/music-score.json');
const expectedChecks = ['revision-and-identities', 'sampled-offsets-and-model-poses', 'absolute-time-seek-determinism', 'reassembly-and-loop-reset', 'annotation-and-appearance-contract', 'authored-camera-envelope', 'source-records-unchanged'];
const check = (report, name) => { const result = report.checks.find(item => item.name === name); assert.ok(result, `Missing check ${name}`); return result; };
function fixture() {
  const index = structuredClone(sourceIndex), source = structuredClone(sourceProvenance);
  return { example: 'robotiq-gripper', index, source, presentation: createGripperPresentation(index), sampleRate: 1 };
}

test('actual adapters pass numerical checks with source hashes and explicitly pending visual review', async () => {
  for (const example of ['gearbox', 'robotiq-gripper']) {
    const report = await checkExample(example);
    assert.equal(report.schemaVersion, 'mechanism-presentation-check-1');
    assert.equal(report.example, example);
    assert.equal(report.status, 'automated-passed', JSON.stringify(report.checks.filter(check => check.status !== 'passed')));
    assert.deepEqual(report.checks.map(check => check.name), [...expectedChecks, 'score-timeline-metadata']);
    assert.ok(report.checks.every(check => check.status === 'passed'));
    assert.equal(report.samples.rate, 30);
    assert.ok(report.samples.count > Math.ceil(report.durationSeconds * 30), 'chapter/channel/annotation boundaries supplement the regular grid');
    assert.equal(check(report, 'sampled-offsets-and-model-poses').detail.count, report.samples.count);
    const index = await read(`examples/${example}/assets/scene-index.json`);
    const provenance = await read(`examples/${example}/${example === 'gearbox' ? 'assets' : 'source'}/provenance.json`);
    assert.equal(report.geometryRevision, index.geometryRevision);
    assert.equal(report.inputHashes.sceneIndex, sha(index));
    assert.equal(report.inputHashes.source, sha(provenance));
    assert.equal(report.inputHashes.score, sha(await read(`examples/${example}/audio/music-score.json`)));
    assert.match(report.inputHashes.plan, /^[a-f0-9]{64}$/);
    assert.equal(report.manualReview.status, 'pending');
    assert.equal(report.manualReview.required.length, 3);
    assert.match(report.manualReview.required.join(' '), /browser.*Phone-sized.*exported video/s);
    assert.match(check(report, 'authored-camera-envelope').detail.scope, /Authored envelopes only.*visual review/);
    assert.match(check(report, 'reassembly-and-loop-reset').detail.scope, /mechanical velocity is not assessed/);
    assert.match(check(report, 'score-timeline-metadata').detail, /Metadata only.*WAV hash/);
  }
});

test('reports detect changed revision, nonfinite offsets and missing source identities', () => {
  const scenarios = [
    ['revision', f => { f.presentation = { ...f.presentation, plan: { ...f.presentation.plan, geometryRevision: 'different' } }; }, 'revision-and-identities', /revision mismatch/],
    ['duplicate index', f => { f.index.parts.push(f.index.parts[0]); }, 'revision-and-identities', /Duplicate part/],
    ['missing offset', f => {
      const original = f.presentation.timeline.stateAt;
      f.presentation.timeline = { ...f.presentation.timeline, stateAt: time => { const state = original(time); delete state.offsetsWorld[f.index.parts[0].id]; return state; } };
    }, 'sampled-offsets-and-model-poses', /Missing display offsets/],
    ['nonfinite offset', f => {
      const original = f.presentation.timeline.stateAt;
      f.presentation.timeline = { ...f.presentation.timeline, stateAt: time => { const state = original(time); state.offsetsWorld[f.index.parts[0].id][0] = NaN; return state; } };
    }, 'sampled-offsets-and-model-poses', /Invalid display offset/],
    ['unknown local offset', f => {
      const original = f.presentation.timeline.localDisplayOffsets;
      f.presentation.timeline = { ...f.presentation.timeline, localDisplayOffsets: (...args) => { const offsets = original(...args); offsets.delete(f.index.parts[0].id); offsets.set('unknown-part', [0, 0, 0]); return offsets; } };
    }, 'sampled-offsets-and-model-poses', /Invalid local offset/],
  ];
  for (const [name, alter, failed, error] of scenarios) {
    const f = fixture(); alter(f); const report = inspectPresentation(f);
    assert.equal(report.status, 'failed', name);
    assert.equal(check(report, failed).status, 'failed', name);
    assert.match(check(report, failed).error, error, name);
  }
});

test('reports catch altered mechanical poses and accumulated seek state', () => {
  for (const [name, badPose, error] of [
    ['quaternion', { position: [0, 0, 0], quaternion: [0, 0, 0, 2] }, /Non-unit rotation/],
    ['scale', { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [2, 1, 1] }, /scale changed/],
  ]) {
    const f = fixture(); f.presentation.workingPoses = () => ({ [f.index.parts[0].id]: badPose });
    const report = inspectPresentation(f);
    assert.equal(report.status, 'failed', name);
    assert.match(check(report, 'sampled-offsets-and-model-poses').error, error);
  }
  const f = fixture(), original = f.presentation.timeline.stateAt;
  let calls = 0;
  f.presentation.timeline = { ...f.presentation.timeline, stateAt: time => ({ ...original(time), accumulated: ++calls }) };
  const report = inspectPresentation(f);
  assert.equal(report.status, 'failed');
  assert.match(check(report, 'absolute-time-seek-determinism').error, /Seek changed/);
});

test('a stale score cannot pass solely because its duration and tempo match', () => {
  const valid = { ...fixture(), score: structuredClone(sourceScore) };
  const good = inspectPresentation(valid);
  assert.equal(good.status, 'automated-passed');
  assert.equal(check(good, 'score-timeline-metadata').status, 'passed');
  assert.equal(good.inputHashes.score, sha(sourceScore));
  for (const [name, alter, error] of [
    ['old geometry', score => { score.geometryRevision = 'previous-geometry-revision'; }, /geometry revision.*scene index/],
    ['missing geometry', score => { delete score.geometryRevision; }, /geometry revision.*scene index/],
    ['zero sample rate', score => { score.sampleRate = 0; }, /sample rate.*positive integer/],
    ['nonfinite duration', score => { score.durationSeconds = NaN; }, /duration.*timeline/],
    ['wrong duration', score => { score.durationSeconds += .1; }, /duration.*timeline/],
    ['wrong tempo', score => { score.bpm += 1; }, /tempo.*timeline/],
  ]) {
    const score = structuredClone(sourceScore); alter(score);
    const report = inspectPresentation({ ...fixture(), score });
    assert.equal(report.status, 'failed', name);
    assert.equal(check(report, 'score-timeline-metadata').status, 'failed', name);
    assert.match(check(report, 'score-timeline-metadata').error, error, name);
    assert.equal(report.manualReview.status, 'pending');
  }
});

test('reports catch displaced loop boundaries, invalid cues and source mutations', () => {
  const scenarios = [
    ['unassembled ending', f => {
      const original = f.presentation.timeline.stateAt;
      f.presentation.timeline = { ...f.presentation.timeline, stateAt: time => { const state = original(time); if (time > f.presentation.timeline.DURATION - .00001) state.offsetsWorld[f.index.parts[0].id][0] = .1; return state; } };
    }, 'reassembly-and-loop-reset', /still displaced/],
    ['camera not settled', f => { f.presentation.annotations = { ...f.presentation.annotations, annotationCues: () => [{ id: f.index.parts[0].id, opacity: .5 }] }; }, 'annotation-and-appearance-contract', /unsettled/],
    ['invalid accent', f => { f.presentation.appearanceCues = () => [{ id: f.index.parts[0].id, weight: 2 }]; }, 'annotation-and-appearance-contract', /Invalid appearance cue/],
    ['invalid opacity', f => { f.presentation.presentationOpacity = () => Infinity; }, 'annotation-and-appearance-contract', /Invalid presentation opacity/],
    ['mutating source', f => {
      const original = f.presentation.workingPoses;
      f.presentation.workingPoses = state => { f.source.mutatedBySampling = true; return original(state); };
    }, 'source-records-unchanged', /modified source/],
  ];
  for (const [name, alter, failed, error] of scenarios) {
    const f = fixture(); alter(f); const report = inspectPresentation(f);
    assert.equal(report.status, 'failed', name);
    assert.match(check(report, failed).error, error, name);
    assert.equal(report.manualReview.status, 'pending', 'failure never promotes manual review');
  }
});

test('camera checks reject cropped envelopes and degenerate view bases', () => {
  for (const [name, change, error] of [
    ['cropped', view => ({ ...view, halfHeight: view.halfHeight * .01 }), /cropped/],
    ['coincident', view => ({ ...view, position: [...view.target] }), /differ|nonzero|direction|target/i],
    ['parallel', view => ({ ...view, position: view.target.map((n, i) => n + (i === 1 ? 1 : 0)) }), /parallel/],
  ]) {
    const f = fixture(), original = f.presentation.framing.cameraFor;
    f.presentation.framing = { ...f.presentation.framing, cameraFor: (...args) => change(original(...args)) };
    const report = inspectPresentation(f);
    assert.equal(report.status, 'failed', name);
    assert.match(check(report, 'authored-camera-envelope').error, error, name);
  }
});

test('argument parser rejects missing, duplicate and unsupported arguments', async () => {
  assert.deepEqual(parseArguments(['--example', 'gearbox', '--output', 'output/report.json']), { example: 'gearbox', output: 'output/report.json' });
  assert.deepEqual(parseArguments(['--help']), { help: true });
  for (const [args, error] of [
    [[], /Select --example/],
    [['--example'], /Missing --example/],
    [['--example', '--output', 'output/a.json'], /Missing --example/],
    [['--example', 'missing', '--output', 'output/a.json'], /Select --example/],
    [['--example', 'gearbox', '--output'], /Missing --output/],
    [['--example', 'gearbox', '--output', 'output/a.txt'], /\.json/],
    [['--example', 'gearbox', '--example', 'robotiq-gripper', '--output', 'output/a.json'], /Duplicate --example/],
    [['--example', 'gearbox', '--output', 'output/a.json', '--output', 'output/b.json'], /Duplicate --output/],
    [['--sample-rate', '60'], /Unknown argument/],
    [['gearbox'], /Unknown argument/],
  ]) assert.throws(() => parseArguments(args), error);
  await assert.rejects(checkExample('unsupported'), /Supported examples/);
  for (const sampleRate of [0, -1, 1.5, 121, NaN]) assert.throws(() => inspectPresentation({ ...fixture(), sampleRate }), /Sample rate/);
});

test('CLI writes a real adapter report and exposes its limited numerical scope', async t => {
  const outputRoot = resolve(project, 'output');
  await mkdir(outputRoot, { recursive: true });
  const directory = await mkdtemp(resolve(outputRoot, 'presentation-check-test-')), output = resolve(directory, 'report.json');
  t.after(async () => { await unlink(output).catch(error => { if (error.code !== 'ENOENT') throw error; }); await rmdir(directory); });
  const outputArg = relative(project, output).replaceAll('\\', '/');
  const result = spawnSync(process.execPath, ['tools/study/check-presentation.mjs', '--example', 'robotiq-gripper', '--output', outputArg], { cwd: project, encoding: 'utf8', windowsHide: true });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout.trim()), { example: 'robotiq-gripper', status: 'automated-passed', report: outputArg, manualReview: 'pending' });
  const report = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(report.status, 'automated-passed');
  assert.equal(report.manualReview.status, 'pending');
  const invalid = spawnSync(process.execPath, ['tools/study/check-presentation.mjs', '--example', 'missing', '--output', outputArg], { cwd: project, encoding: 'utf8', windowsHide: true });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Presentation check: Select --example/);
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), report, 'invalid CLI arguments do not replace an existing report');
  const help = spawnSync(process.execPath, ['tools/study/check-presentation.mjs', '--help'], { cwd: project, encoding: 'utf8', windowsHide: true });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Numerical checks only.*review remains pending/s);
});
