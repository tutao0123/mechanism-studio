import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, symlink } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalLesson, validateLesson, lessonSha256 } from './lesson.mjs';
import { normalizeConfig } from './config.mjs';
import { synthesizeLesson } from './generator.mjs';
import { createLessonPlayer, validateManifest, audioURL } from './player.mjs';
import { optionalAssetSet } from '../../tests/optional-assets.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const config = normalizeConfig({ apiKey: 'mock-shared-key' });
const quiet = () => {};
const lesson = (count = 2) => ({ schemaVersion: 1, language: 'zh-CN', steps: Array.from({ length: count }, (_, index) => ({ id: 'stage-' + (index + 1), title: '步骤 ' + (index + 1), narration: '通过同一个机械模型观察本步骤。', angle: index * 10 })) });
const success = bytes => new Response(JSON.stringify({ code: 0, data: bytes.toString('base64') }) + '\n' + JSON.stringify({ code: 20000000 }));
async function fixture(t) {
  const parent = join(ROOT, '.test-output', 'shared-voice'); await mkdir(parent, { recursive: true });
  const rootDir = await mkdtemp(join(parent, 'case-'));
  t.after(async () => { assert.ok(rootDir.startsWith(parent)); await rm(rootDir, { recursive: true, force: true }); });
  return { rootDir, audioDir: join(rootDir, 'assets', 'audio'), manifestPath: join(rootDir, 'voice', 'audio-manifest.json'), logger: quiet };
}
async function existing(t) {
  const output = await fixture(t); await mkdir(dirname(output.manifestPath), { recursive: true });
  await writeFile(output.manifestPath, 'previous-complete-manifest'); return output;
}

test('shared lesson accepts arbitrary ordered step counts, rejecting duplicate/unsafe IDs and long narration', () => {
  for (const count of [1, 2, 7]) assert.equal(validateLesson(lesson(count)).steps.length, count);
  const duplicate = lesson(); duplicate.steps[1].id = duplicate.steps[0].id;
  assert.throws(() => validateLesson(duplicate), /步骤/);
  for (const id of ['../outside', 'UPPER', '__proto__', 'has space']) {
    const input = lesson(); input.steps[0].id = id; assert.throws(() => validateLesson(input), /步骤/);
  }
  const long = lesson(); long.steps[0].narration = '中'.repeat(342); assert.throws(() => validateLesson(long), /1024/);
  assert.throws(() => validateLesson(lesson(0)), /1 至 100/);
});

test('canonical audio hash ignores mechanical metadata and key insertion order, but includes text and step order', async () => {
  const input = lesson(), hash = await lessonSha256(input, webcrypto);
  const same = { steps: input.steps.map(s => ({ narration: s.narration, angle: 123, title: s.title, id: s.id, camera: 'rear' })), language: 'zh-CN', schemaVersion: 1 };
  assert.equal(await lessonSha256(same, webcrypto), hash);
  same.steps[0].narration += '改动。'; assert.notEqual(await lessonSha256(same, webcrypto), hash);
  assert.notEqual(digest(canonicalLesson({ ...input, steps: [...input.steps].reverse() })), hash);
});

test('lesson and manifest identities remain compatible, with complete optional local audio verified', async t => {
  for (const example of ['prototype-3d', 'examples/inline-four']) {
    const root = join(ROOT, example), input = JSON.parse(await readFile(join(root, 'voice', 'lesson.json')));
    const manifest = JSON.parse(await readFile(join(root, 'voice', 'audio-manifest.json')));
    assert.equal(manifest.lessonSha256, await lessonSha256(input, webcrypto));
    await validateManifest(manifest, input, { baseURL: 'http://localhost/' + example + '/', cryptoImpl: webcrypto });
    const records = Object.values(manifest.steps);
    const files = await optionalAssetSet(records.map(record => join(root, record.src)));
    if (!files) { t.diagnostic(`${example}: optional provider MP3s are absent from the public source release; lesson identity remains verified.`); continue; }
    for (const [index, record] of records.entries()) {
      const audio = files[index]; assert.equal(audio.length, record.bytes); assert.equal(digest(audio), record.sha256);
    }
  }
});

test('seven mocked provider completions publish immutable files and one complete manifest', async t => {
  const output = await fixture(t); let calls = 0;
  const manifest = await synthesizeLesson(lesson(7), config, { ...output, fetchImpl: async () => success(Buffer.from('audio-' + ++calls)) });
  assert.equal(calls, 7); assert.equal(manifest.lessonHashPolicy, 'narration-v1');
  assert.equal(Object.keys(manifest.steps).length, 7);
  for (const record of Object.values(manifest.steps)) { assert.match(record.src, /-[a-f0-9]{64}\.mp3$/); assert.equal(digest(await readFile(join(output.rootDir, record.src))), record.sha256); }
  assert.equal(JSON.parse(await readFile(output.manifestPath)).complete, true);
});

test('provider rejection, truncated stream, timeout, and server body never replace an existing manifest', async t => {
  const failures = [async () => new Response('mock-private-echo', { status: 403 }), async () => new Response('{"code":0,"data":"SUQz"}'), async () => { throw new Error('mock-private-echo'); }];
  for (const fetchImpl of failures) {
    const output = await existing(t);
    await assert.rejects(synthesizeLesson(lesson(), config, { ...output, fetchImpl }), error => !error.message.includes('mock-private-echo'));
    assert.equal(await readFile(output.manifestPath, 'utf8'), 'previous-complete-manifest');
    await assert.rejects(readdir(output.audioDir), { code: 'ENOENT' });
  }
});

test('local audio collision aborts publication while retaining the old manifest and old bytes', async t => {
  const output = await existing(t), bytes = Buffer.from('new-audio');
  await mkdir(output.audioDir, { recursive: true });
  const target = join(output.audioDir, 'stage-1-' + digest(bytes) + '.mp3'); await writeFile(target, 'previous-audio');
  await assert.rejects(synthesizeLesson(lesson(), config, { ...output, fetchImpl: async () => success(bytes) }), /摘要冲突/);
  assert.equal(await readFile(target, 'utf8'), 'previous-audio');
  assert.equal(await readFile(output.manifestPath, 'utf8'), 'previous-complete-manifest');
  assert.equal((await readdir(output.audioDir)).length, 1);
});

test('a later local publish failure leaves the old manifest and referenced audio intact', async t => {
  const output = await existing(t), bytes = Buffer.from('new-audio');
  await mkdir(output.audioDir, { recursive: true });
  const oldAudio=join(output.audioDir,'old.mp3');await writeFile(oldAudio,'old referenced bytes');
  await writeFile(join(output.audioDir,'stage-2-'+digest(bytes)+'.mp3'),'conflicting existing bytes');
  await assert.rejects(synthesizeLesson(lesson(),config,{...output,fetchImpl:async()=>success(bytes)}),/摘要冲突/);
  assert.equal(await readFile(output.manifestPath,'utf8'),'previous-complete-manifest');
  assert.equal(await readFile(oldAudio,'utf8'),'old referenced bytes');
  assert.equal(digest(await readFile(join(output.audioDir,'stage-1-'+digest(bytes)+'.mp3'))),digest(bytes));
});

test('escaping root/manifest paths and junction ancestors reject before network calls', async t => {
  const output = await fixture(t); let calls = 0; const fetchImpl = async () => { calls += 1; return success(Buffer.from('test')); };
  await assert.rejects(synthesizeLesson(lesson(), config, { ...output, audioDir: join(output.rootDir, '..', 'escape'), fetchImpl }), /实例内/);
  await assert.rejects(synthesizeLesson(lesson(), config, { ...output, manifestPath: join(output.rootDir, '..', 'escape.json'), fetchImpl }), /实例内/);
  const sibling = await fixture(t), link = join(output.rootDir, 'linked');
  await symlink(sibling.rootDir, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(synthesizeLesson(lesson(), config, { ...output, audioDir: join(link, 'audio'), fetchImpl }), /链接|连接/);
  assert.equal(calls, 0);
});

test('a junction introduced during provider latency is rechecked before publication', async t => {
  const output = await existing(t), sibling = await fixture(t); let calls = 0;
  const fetchImpl = async () => {
    if (++calls === 2) { await mkdir(dirname(output.audioDir), { recursive: true }); await symlink(sibling.rootDir, output.audioDir, process.platform === 'win32' ? 'junction' : 'dir'); }
    return success(Buffer.from('test'));
  };
  await assert.rejects(synthesizeLesson(lesson(), config, { ...output, fetchImpl }), /链接|连接/);
  assert.equal(await readFile(output.manifestPath, 'utf8'), 'previous-complete-manifest');
  assert.deepEqual(await readdir(sibling.rootDir), []);
});

class MockAudio {
  constructor() { this.paused = true; this.duration = 1; this.currentTime = 0; this.listeners = new Map(); this._src = ''; this.playCalls = 0; }
  set src(value) { this._src = value; } getAttribute() { return this._src; }
  removeAttribute() { this._src = ''; } pause() { this.paused = true; }
  async play() { this.paused = false; this.playCalls += 1; }
  addEventListener(event, fn) { this.listeners.set(event, fn); } removeEventListener(event) { this.listeners.delete(event); }
}
async function playerFixture({ changeManifest, audioBytes } = {}) {
  const input = lesson(), goodAudio = Buffer.from('mock-browser-audio');
  const manifest = { schemaVersion: 1, provider: 'doubao', complete: true, format: 'mp3', resourceId: 'seed-tts-2.0', lessonSha256: await lessonSha256(input, webcrypto), steps: {} };
  for (const step of input.steps) manifest.steps[step.id] = { src: 'assets/audio/' + step.id + '.mp3', bytes: goodAudio.length, sha256: digest(goodAudio) };
  changeManifest?.(manifest);
  const audio = new MockAudio(), blobs = [], revoked = [], states = [];
  const fetchImpl = async url => {
    if (String(url).endsWith('lesson.json')) return Response.json(input);
    if (String(url).endsWith('manifest.json')) return Response.json(manifest);
    return new Response(audioBytes ?? goodAudio);
  };
  const player = createLessonPlayer({ lessonURL: 'voice/lesson.json', manifestURL: 'voice/manifest.json', baseURL: 'http://localhost/example/', fetchImpl, audioElement: audio, cryptoImpl: webcrypto,
    urlImpl: { createObjectURL: blob => { blobs.push(blob); return 'blob:mock-' + blobs.length; }, revokeObjectURL: value => revoked.push(value) }, onPlayback: state => states.push(state.phase) });
  return { player, audio, blobs, revoked, states, manifest };
}

test('shared player verifies complete manifest, exposes metadata, and supports pause/resume/stop without mechanical changes', async () => {
  const { player, audio, blobs, revoked, states } = await playerFixture();
  const loaded = await player.load(); assert.equal(loaded.status, 'ready'); assert.equal(loaded.lesson.steps[1].angle, 10);
  assert.equal(await player.playStep('stage-1'), true); assert.equal(player.snapshot().playing, true); assert.equal(blobs.length, 1);
  await player.toggleStep('stage-1'); assert.equal(audio.paused, true);
  await player.toggleStep('stage-1'); assert.equal(audio.playCalls, 2); assert.equal(blobs.length, 1);
  player.stop(); assert.equal(player.snapshot().stepId, null); assert.equal(revoked.length, 0); assert.ok(states.includes('paused'));
  player.dispose(); assert.equal(audio.listeners.size, 0); assert.equal(revoked.length, 1);
});

test('incomplete, hash-mismatched, foreign provider, missing steps and escaping audio manifests are rejected', async () => {
  for (const changeManifest of [m => { m.complete = false; }, m => { m.lessonSha256 = '0'.repeat(64); }, m => { m.provider = 'other'; }, m => { delete m.steps['stage-1']; }, m => { m.steps['stage-1'].src = '../outside.mp3'; }]) {
    const { player, audio } = await playerFixture({ changeManifest }); assert.equal((await player.load()).manifest, null);
    await assert.rejects(player.playStep('stage-1'), /尚未就绪/); assert.equal(audio.playCalls, 0);
  }
  for (const src of ['https://other/audio.mp3', '/audio.mp3', 'audio/../bad.mp3', 'audio\\bad.mp3']) assert.throws(() => audioURL(src, 'http://localhost/example/'), /路径/);
});

test('audio bytes and digest are verified before playback, and unknown steps cannot play', async () => {
  for (const audioBytes of [Buffer.from('short'), Buffer.from('mock-browser-wrong')]) {
    const { player, audio } = await playerFixture({ audioBytes }); await player.load();
    assert.equal(await player.playStep('stage-1'), false); assert.equal(audio.playCalls, 0);
  }
  const { player } = await playerFixture(); await player.load(); await assert.rejects(player.playStep('unknown'), /尚未就绪/);
});
