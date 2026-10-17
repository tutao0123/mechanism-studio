import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalLesson, lessonSha256, validateLesson } from './lesson.mjs';
import { buildRequest, normalizeConfig } from './config.mjs';
import { mainCLI } from './cli.mjs';
import { synthesizeLesson } from './generator.mjs';
import { createLessonPlayer } from './player.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');
const englishLesson = () => ({ schemaVersion: 1, language: 'en-US', steps: [
  { id: 'overview', title: 'Overview', narration: 'Watch the assembly turn.', camera: 'front' },
  { id: 'power-stroke', title: 'Power stroke', narration: 'Expanding gas pushes the piston.', angle: 400 },
  { id: 'return', title: 'Return', narration: 'The cycle continues.' },
] });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

class MockAudio {
  constructor() { this.paused = true; this.duration = 10; this.currentTime = 0; this.muted = false; this.listeners = new Map(); this._src = ''; this.playCalls = 0; }
  set src(value) { this._src = value; }
  getAttribute() { return this._src; }
  removeAttribute() { this._src = ''; }
  pause() { this.paused = true; }
  async play() { this.playCalls += 1; this.paused = false; }
  addEventListener(event, fn) { this.listeners.set(event, fn); }
  removeEventListener(event) { this.listeners.delete(event); }
  emit(event) { this.listeners.get(event)?.(); }
}

async function playerFixture({ locale, input = englishLesson(), audioFetch, alterManifest } = {}) {
  const bytes = Buffer.from('verified-english-mp3');
  const manifest = { schemaVersion: 1, provider: 'doubao', resourceId: 'seed-tts-2.0', complete: true, format: 'mp3', lessonHashPolicy: 'narration-v1', lessonSha256: await lessonSha256(input, webcrypto), steps: {} };
  for (const { id } of input.steps) manifest.steps[id] = { src: 'assets/audio/' + id + '.mp3', sha256: digest(bytes), bytes: bytes.length };
  alterManifest?.(manifest);
  const audio = new MockAudio(), created = [], revoked = [], states = [], requests = [];
  let calls = 0;
  const player = createLessonPlayer({ locale, baseURL: 'http://localhost/showcase/story/', lessonURL: 'voice/lesson.json', manifestURL: 'voice/manifest.json', audioElement: audio, cryptoImpl: webcrypto,
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      if (String(url).endsWith('lesson.json')) return Response.json(input);
      if (String(url).endsWith('manifest.json')) return Response.json(manifest);
      calls += 1;
      return audioFetch ? audioFetch({ url, calls, bytes }) : new Response(bytes);
    },
    urlImpl: { createObjectURL: blob => { created.push(blob); return 'blob:verified-' + created.length; }, revokeObjectURL: url => revoked.push(url) },
    onStatus: state => states.push(state), onPlayback: state => states.push(state),
  });
  return { player, audio, created, revoked, states, requests, manifest, bytes, calls: () => calls };
}

test('English narration has a distinct canonical language identity and preserves metadata exclusion', async () => {
  const input = englishLesson(), canonical = canonicalLesson(input);
  assert.deepEqual(JSON.parse(canonical), { schemaVersion: 1, language: 'en-US', steps: input.steps.map(({ id, title, narration }) => ({ id, title, narration })) });
  const moved = structuredClone(input); moved.steps[0].camera = 'rear';
  assert.equal(await lessonSha256(input, webcrypto), await lessonSha256(moved, webcrypto));
  assert.notEqual(await lessonSha256(input, webcrypto), await lessonSha256({ ...input, language: 'zh-CN' }, webcrypto));
  assert.throws(() => validateLesson({ ...input, language: 'en-GB' }));
  const invalid = structuredClone(input); invalid.steps[1].id = invalid.steps[0].id;
  assert.throws(() => validateLesson(invalid), /Invalid step/);
  await assert.rejects(lessonSha256(input, {}), /cannot verify/);
});

test('English requests set the documented explicit language without changing Chinese request bodies', () => {
  const config = normalizeConfig({ apiKey: 'mock-private-key', speaker: 'en_female_jane_uranus_bigtts' });
  const english = buildRequest('English narration.', config, 'test-id', { language: 'en-US' });
  assert.equal(english.headers['X-Api-Resource-Id'], 'seed-tts-2.0');
  assert.equal(english.body.req_params.speaker, 'en_female_jane_uranus_bigtts');
  assert.deepEqual(JSON.parse(english.body.req_params.additions), { explicit_language: 'en' });
  assert.equal(Object.hasOwn(buildRequest('中文旁白', config, 'test-id', { language: 'zh-CN' }).body.req_params, 'additions'), false);
});

test('English CLI is a local dry run by default and mocked generation publishes the same integrity contract', async t => {
  const parent = join(ROOT, '.test-output', 'shared-voice-english'); await mkdir(parent, { recursive: true });
  const rootDir = await mkdtemp(join(parent, 'case-')); t.after(async () => rm(rootDir, { recursive: true, force: true }));
  const lessonPath = join(rootDir, 'lesson.json'); await writeFile(lessonPath, JSON.stringify(englishLesson()));
  const logs = []; let calls = 0;
  assert.deepEqual(await mainCLI([], { rootDir, lessonPath, logger: line => logs.push(line), fetchImpl: async () => { calls += 1; throw new Error('unexpected'); } }), { mode: 'dry-run', steps: 3, ready: false });
  assert.equal(calls, 0); assert.ok(logs.every(line => !/[\u3400-\u9fff]/.test(line)));
  const config = normalizeConfig({ apiKey: 'mock-private-key', speaker: 'en_female_jane_uranus_bigtts' });
  const manifest = await synthesizeLesson(englishLesson(), config, { rootDir, logger: line => logs.push(line), fetchImpl: async (_url, request) => {
    calls += 1; assert.deepEqual(JSON.parse(JSON.parse(request.body).req_params.additions), { explicit_language: 'en' });
    return new Response(JSON.stringify({ code: 0, data: Buffer.from('mock-audio-' + calls).toString('base64') }) + '\n' + JSON.stringify({ code: 20000000 }));
  } });
  assert.equal(calls, 3); assert.equal(manifest.speaker, config.speaker);
  assert.equal(manifest.lessonSha256, await lessonSha256(englishLesson(), webcrypto));
  assert.equal(JSON.parse(await readFile(join(rootDir, 'voice', 'audio-manifest.json'))).complete, true);
  assert.ok(logs.every(line => !line.includes('mock-private-key') && !/[\u3400-\u9fff]/.test(line)));
});

test('English player infers locale; explicit locale also covers initial and failure messages', async () => {
  const fixture = await playerFixture(); await fixture.player.load();
  assert.equal(fixture.player.snapshot().locale, 'en-US'); assert.match(fixture.player.snapshot().message, /Ready/);
  await assert.rejects(fixture.player.preloadStep('unknown'), /not ready/);
  const invalid = await playerFixture({ locale: 'en-US', alterManifest: manifest => { manifest.lessonSha256 = '0'.repeat(64); } });
  assert.match(invalid.player.snapshot().message, /Checking/); assert.equal((await invalid.player.load()).status, 'unavailable');
  assert.match(invalid.player.snapshot().message, /narration has changed/);
  assert.ok(invalid.states.every(state => !/[\u3400-\u9fff]/.test(state.message)));
  const overridden = await playerFixture({ locale: 'en-US', input: { ...englishLesson(), language: 'zh-CN' } });
  await overridden.player.load(); assert.equal(overridden.player.snapshot().locale, 'en-US');
});

test('preload deduplicates verified blobs, never starts audio, preserves order and releases only on load/dispose', async () => {
  const { player, audio, created, revoked, calls, requests } = await playerFixture({ locale: 'en-US' });
  await player.load(); const [a, b] = await Promise.all([player.preloadStep('overview'), player.preloadStep('overview')]);
  assert.strictEqual(a, b); assert.equal(calls(), 1); assert.equal(audio.playCalls, 0); assert.equal(created.length, 1);
  assert.deepEqual(Object.keys(a), ['id', 'url', 'bytes', 'sha256']); assert.equal(Object.isFrozen(a), true);
  const all = await player.preloadAll(); assert.deepEqual(Object.keys(all), ['overview', 'power-stroke', 'return']); assert.equal(calls(), 3);
  assert.equal(player.snapshot().preloadedSteps, 3); player.stop(); assert.equal(revoked.length, 0);
  assert.ok(requests.every(({ options }) => options.redirect === 'error' && options.credentials === 'same-origin'));
  await player.load(); assert.equal(revoked.length, 3); assert.equal(player.snapshot().preloadedSteps, 0);
  await player.preloadStep('overview'); player.dispose(); assert.equal(revoked.length, 4);
});

test('preload refuses altered bytes, advertised size and provider errors before creating blob URLs', async () => {
  for (const audioFetch of [async () => new Response('short'), async ({ bytes }) => new Response(Buffer.alloc(bytes.length, 0)), async ({ bytes }) => new Response(bytes, { headers: { 'content-length': String(bytes.length + 1) } }), async () => new Response('private-server-error', { status: 403 }), async () => { throw new Error('private-server-error'); }]) {
    const { player, created, audio } = await playerFixture({ locale: 'en-US', audioFetch }); await player.load();
    await assert.rejects(player.preloadStep('overview'), error => !error.message.includes('private-server-error') && !/[\u3400-\u9fff]/.test(error.message));
    assert.equal(created.length, 0); assert.equal(audio.playCalls, 0);
  }
});

test('reload and dispose cancel in-flight preloads without creating stale URLs; cancelled loads can retry', async () => {
  for (const action of ['load', 'dispose']) {
    const gate = deferred(), started = deferred();
    const { player, created, calls } = await playerFixture({ locale: 'en-US', audioFetch: async ({ calls, bytes }) => { if (calls === 1) { started.resolve(); await gate.promise; } return new Response(bytes); } });
    await player.load(); const pending = player.preloadAll(); const rejection = assert.rejects(pending, /cancelled/);
    await started.promise; await player[action](); gate.resolve(); await rejection;
    assert.equal(created.length, 0); assert.equal(calls(), 1);
    if (action === 'load') { assert.equal((await player.preloadStep('overview')).id, 'overview'); assert.equal(created.length, 1); }
  }
});

test('seek, mute and native playback events expose the audio clock without an independent timer', async () => {
  const { player, audio, states } = await playerFixture({ locale: 'en-US' }); await player.load();
  assert.throws(() => player.seek(1), /Prepare/); player.setMuted(true);
  assert.equal(await player.playStep('overview', { startTime: 2.5 }), true); assert.equal(audio.muted, true); assert.equal(player.snapshot().currentTime, 2.5);
  assert.equal(player.seek(25), 10); player.pause(); assert.equal(player.snapshot().phase, 'paused');
  assert.equal(player.seek(4), 4); assert.equal(audio.paused, true);
  for (const time of [-1, NaN, Infinity]) assert.throws(() => player.seek(time), /finite/);
  await assert.rejects(player.playStep('overview', { startTime: -1 }), /finite/);
  const before = states.length; audio.currentTime = 4.2; audio.emit('timeupdate');
  assert.equal(states.length, before + 1); assert.equal(player.snapshot().currentTime, 4.2);
  player.setMuted(false); assert.equal(player.snapshot().muted, false); assert.throws(() => player.setMuted('yes'), /boolean/);
  audio.emit('ended'); assert.equal(player.snapshot().ended, true); assert.equal(player.snapshot().playing, false);
  player.dispose(); assert.equal(audio.listeners.size, 0);
});
