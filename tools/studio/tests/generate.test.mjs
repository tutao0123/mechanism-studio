import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PROJECT_ROOT, getExample } from '../registry.mjs';
import { generationRecipe, checkGenerationPaths, inspectGeneratedAssembly, generateExample, prepareOriginalScore, runLocalBuilder } from '../generate.mjs';

test('local generation rejects imported studies and caller-supplied executable/path overrides', () => {
  for (const input of [null, getExample('step-bearing-assembly'), getExample('gearbox-cinematic'),
    { ...getExample('gearbox'), generate: true }, { id: '../gearbox' }, { id: 'https://example.com/model.step' }]) {
    assert.throws(() => generationRecipe(input));
  }
  assert.equal(generationRecipe(getExample('planetary-gears')).scripts.length, 1);
  assert.equal(generationRecipe(getExample('robot-joint')).scripts.length, 1);
  assert.equal(generationRecipe(getExample('gearbox')).scripts.length, 2);
});

test('registered original assets satisfy their generated identity, hierarchy and provenance contracts', async () => {
  const planetary = await inspectGeneratedAssembly(getExample('planetary-gears'));
  const gearbox = await inspectGeneratedAssembly(getExample('gearbox'));
  const joint = await inspectGeneratedAssembly(getExample('robot-joint'));
  assert.equal(planetary.partCount, 80);
  assert.equal(planetary.definitionCount, 29);
  assert.equal(gearbox.partCount, 124);
  assert.equal(gearbox.definitionCount, 68);
  assert.equal(gearbox.assemblyCount, 15);
  assert.equal(joint.partCount, 129);
  assert.equal(joint.definitionCount, 44);
  assert.equal(joint.assemblyCount, 6);
});

test('generation dispatches geometry before bound plans, verifies outputs, and preserves a job receipt', async () => {
  // Reuse the actual committed assets, without rewriting them in the normal
  // test suite. Real builder reproduction is a separate deliberate smoke run.
  const calls = [], entry = getExample('gearbox');
  const result = await generateExample(entry, { runBuilder: async (script, options) => {
    calls.push(script);
    assert.ok(options.temporaryDirectory.startsWith(PROJECT_ROOT));
    return 'fixture: existing committed output left unchanged';
  } });
  assert.deepEqual(calls, ['examples/gearbox/build-gearbox.mjs', 'examples/gearbox/planning/build-plans.mjs']);
  const report = JSON.parse(await readFile(join(PROJECT_ROOT, result.report), 'utf8'));
  assert.equal(report.status, 'complete');
  assert.equal(report.result.partCount, 124);
  assert.equal(report.before.length, 12);
  assert.deepEqual(report.before, report.after);
  assert.match(report.audio.sha256, /^[a-f0-9]{64}$/);
  assert.equal(report.stages.length, 2);
  assert.match(report.modelSource, /no external model request/);
});

test('failed generation stops the sequence, skips music and keeps an explicit failed receipt', async () => {
  const calls = []; let failure;
  await assert.rejects(generateExample(getExample('gearbox'), {
    runBuilder: async script => { calls.push(script); throw new Error('deliberate generator failure'); },
    prepareScore: async () => { throw new Error('must not run music after a builder failure'); },
  }), error => {
    assert.match(error.message, /deliberate generator failure/);
    assert.match(error.message, /Derived files may be partially rebuilt/);
    failure = error;
    return true;
  });
  assert.deepEqual(calls, ['examples/gearbox/build-gearbox.mjs']);
  const receiptPath = failure.message.match(/inspect (output\/studio\/generate-[^\n]+?\/generation\.json)\./)[1];
  const receipt = JSON.parse(await readFile(join(PROJECT_ROOT, receiptPath), 'utf8'));
  assert.equal(receipt.status, 'failed');
  assert.deepEqual(receipt.stages, []);
  assert.equal(receipt.audio, undefined);
  assert.equal(receipt.error, 'deliberate generator failure');
});

test('linked output ancestors cannot redirect generation outside the chosen project root', async () => {
  const base = join(PROJECT_ROOT, 'output', 'studio-generation-tests');
  await mkdir(base, { recursive: true });
  const fixture = await mkdtemp(join(base, 'scope-'));
  const taskRoot = join(fixture, 'project'), sibling = join(fixture, 'sibling');
  await mkdir(join(taskRoot, 'examples', 'planetary-gears'), { recursive: true });
  await mkdir(sibling);
  await symlink(sibling, join(taskRoot, 'examples', 'planetary-gears', 'assets'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(checkGenerationPaths(generationRecipe(getExample('planetary-gears')), { root: taskRoot }), /resolves outside the project/);
  await assert.rejects(checkGenerationPaths({ scripts: ['../outside.mjs'] }, { root: taskRoot }), /registered generation recipe/);
  await assert.rejects(runLocalBuilder('../arbitrary-script.mjs', { temporaryDirectory: fixture }), /Unknown local builder/);
});

test('music bound to an older model rebuilds locally before its bytes can be accepted', async () => {
  const entry = getExample('robot-joint'), calls = []; let revision = 'old';
  const result = await prepareOriginalScore(entry, 'new', {
    readMetadata: async () => ({ geometryRevision: revision, cues: [{ geometryRevision: revision }] }),
    runBuilder: async script => { calls.push(script); revision = 'new'; return 'rebuilt original score'; },
    prepareScore: async score => { calls.push(score.metadata); return { status: 'present' }; },
  });
  assert.deepEqual(calls, ['examples/robot-joint/audio/build.mjs', 'examples/robot-joint/audio/music-score.json']);
  assert.equal(result.rebuild.reason, 'geometry-revision-changed');
  assert.equal(result.score.status, 'present');
});

test('music with a stale nested cue is rejected if its builder leaves the binding stale', async () => {
  const entry = getExample('robot-joint'); let attempted = false;
  await assert.rejects(prepareOriginalScore(entry, 'new', {
    readMetadata: async () => ({ geometryRevision: 'new', cues: [{ source: { geometryRevision: 'old' } }] }),
    runBuilder: async () => { attempted = true; return ''; },
    prepareScore: async () => { throw new Error('WAV verification must wait for corrected geometry binding.'); },
  }), /different geometry revision/);
  assert.equal(attempted, true);
});

test('current music keeps its score and is only verified, without unnecessary regeneration', async () => {
  const result = await prepareOriginalScore(getExample('gearbox'), 'unchanged', {
    readMetadata: async () => ({ geometryRevision: 'unchanged', cues: [{ geometryRevision: 'unchanged' }] }),
    runBuilder: async () => { throw new Error('Valid music must not be rebuilt.'); },
    prepareScore: async () => ({ status: 'present' }),
  });
  assert.equal(result.rebuild, null);
  assert.equal(result.score.status, 'present');
});
