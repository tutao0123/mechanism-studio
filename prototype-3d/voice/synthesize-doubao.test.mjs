import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, rm, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENDPOINT, PLAN_ENDPOINT, STEP_IDS, buildRequest, main, normalizeConfig, parseConfigText,
  parseDoubaoStream, synthesizeLesson, validateLesson,
} from './synthesize-doubao.mjs';

const VOICE = dirname(fileURLToPath(import.meta.url));
const config = normalizeConfig({ apiKey: 'mock-test-key' });
const lesson = JSON.parse(await readFile(join(VOICE, 'lesson.json'), 'utf8'));
const packet = (audio = Buffer.from('ID3-mock-audio')) =>
  JSON.stringify({ code: 0, data: audio.toString('base64') }) + '\n'
  + JSON.stringify({ code: 20000000, data: null, usage: { text_words: 18 } }) + '\n';
async function* chunks(bytes, sizes = [1, 2, 7, 3]) {
  for (let offset = 0, index = 0; offset < bytes.length; index += 1) {
    const size = sizes[index % sizes.length];
    yield bytes.subarray(offset, offset + size); offset += size;
  }
}
const quiet = () => {};

test('fragmented network chunks and split UTF-8 preserve audio and metadata', async () => {
  const source = JSON.stringify({ code: 0, data: null, sentence: { text: '剪切线：你好 } \\"' } }) + '\n'
    + packet(Buffer.from([0, 1, 2, 254, 255]));
  const result = await parseDoubaoStream(chunks(Buffer.from(source)));
  assert.deepEqual(result.audio, Buffer.from([0, 1, 2, 254, 255]));
  assert.deepEqual(result.usage, { text_words: 18 });
});

test('multiple pretty-printed JSON objects in one chunk concatenate audio in order', async () => {
  const source = [
    { code: 0, data: Buffer.from('first').toString('base64') },
    { code: 0, data: Buffer.from('second').toString('base64') },
    { code: 20000000, data: null },
  ].map((frame) => JSON.stringify(frame, null, 2)).join('');
  assert.equal((await parseDoubaoStream([Buffer.from(source)])).audio.toString(), 'firstsecond');
});

test('a provider error after audio rejects without printing the server message', async () => {
  const source = JSON.stringify({ code: 0, data: 'SUQz' }) + '\n'
    + JSON.stringify({ code: 45000000, message: 'echoed-mock-private-credential' });
  await assert.rejects(parseDoubaoStream([Buffer.from(source)]), (error) => {
    assert.equal(error.code, 45000000);
    assert.ok(!error.message.includes('echoed-mock-private-credential'));
    return true;
  });
});

test('EOF without the completion frame and truncated JSON fail closed', async () => {
  await assert.rejects(parseDoubaoStream([Buffer.from('{"code":0,"data":"SUQz"}')]), /成功结束帧/);
  await assert.rejects(parseDoubaoStream([Buffer.from('{"code":0,"data":')]), /中途结束/);
});

test('HTTP 200 cannot compensate for empty audio, malformed base64, or wrong protocol', async () => {
  await assert.rejects(parseDoubaoStream([Buffer.from('{"code":20000000,"data":null}')]), /非空音频/);
  await assert.rejects(parseDoubaoStream([Buffer.from('{"code":0,"data":"not base64!"}')]), /base64/);
  await assert.rejects(parseDoubaoStream([Buffer.from('data: {"code":20000000}')]), /HTTP JSON/);
  await assert.rejects(parseDoubaoStream([Buffer.from('{"code":"0","data":"SUQz"}')]), /不符合协议/);
});

test('frames after completion and incomplete UTF-8 are rejected', async () => {
  await assert.rejects(parseDoubaoStream([Buffer.from(packet() + '{"code":0,"data":"SUQz"}')]), /不符合协议/);
  await assert.rejects(parseDoubaoStream([Buffer.from([0xe4, 0xb8])]), /UTF-8/);
});

test('new API key and legacy App ID headers are separate and use the fixed official endpoint', () => {
  const modern = buildRequest('测试', normalizeConfig({ apiKey: 'mock-key', appId: 'mock-id', accessKey: 'mock-access' }));
  assert.equal(ENDPOINT, 'https://openspeech.bytedance.com/api/v3/tts/unidirectional');
  assert.equal(modern.headers['X-Api-Key'], 'mock-key');
  assert.ok(!('X-Api-App-Id' in modern.headers));
  assert.equal(modern.headers['X-Api-Resource-Id'], 'seed-tts-2.0');
  assert.equal(modern.body.req_params.audio_params.format, 'mp3');
  const legacy = buildRequest('测试', normalizeConfig({ appId: 'mock-id', accessKey: 'mock-access' }));
  assert.equal(legacy.headers['X-Api-App-Id'], 'mock-id');
  assert.equal(legacy.headers['X-Api-Access-Key'], 'mock-access');
  assert.ok(!('X-Api-Key' in legacy.headers));
  assert.throws(() => buildRequest('测试', normalizeConfig({ apiKey: 'your_api_key', appId: 'mock-id', accessKey: 'mock-access' })), /有效/);
});

test('local config keeps only known fields and does not expand shell expressions', () => {
  const env = parseConfigText('UNRELATED_PRIVATE_KEY=do-not-keep\nDOUBAO_API_KEY="mock-key"\nDOUBAO_TTS_SPEECH_RATE=-10 # slower');
  assert.equal(env.apiKey, 'mock-key');
  assert.equal(env.speechRate, -10);
  assert.equal(parseConfigText('VOLC_SPEECH_API_KEY=mock-volc-key\nTAO55S_TTS_VOICE=do-not-keep').apiKey, 'mock-volc-key');
  assert.ok(!JSON.stringify(env).includes('do-not-keep'));
  const json = parseConfigText('\ufeff{"apiKey":"mock-key","unused_secret":"do-not-keep"}');
  assert.ok(!('unused_secret' in json));
  assert.equal(parseConfigText('DOUBAO_API_KEY=$(echo not-executed)').apiKey, '$(echo not-executed)');
  assert.throws(() => normalizeConfig({ resourceId: 'another-service' }), /资源/);
  assert.throws(() => normalizeConfig({ apiMode: 'https://another-service' }), /资源/);
});

test('Agent Plan is an explicit fixed Doubao API choice with new key authentication', async (t) => {
  const options = await scopedFixture(t);
  const planConfig = normalizeConfig({ apiKey: 'mock-plan-key', apiMode: 'agent-plan' });
  let calls = 0;
  await synthesizeLesson(lesson, planConfig, { ...options, fetchImpl: async (url) => {
    assert.equal(url, PLAN_ENDPOINT); calls += 1;
    return new Response(packet(), { status: 200 });
  } });
  assert.equal(calls, 5);
  assert.throws(() => buildRequest('测试', normalizeConfig({ apiMode: 'agent-plan', appId: 'id', accessKey: 'key' })), /新 API Key/);
});

test('the lesson has exactly five ordered IDs and rejects narration contract drift', () => {
  assert.deepEqual(validateLesson(lesson).steps.map((step) => step.id), STEP_IDS);
  const altered = structuredClone(lesson); altered.steps[1].id = 'unknown';
  assert.throws(() => validateLesson(altered), /步骤/);
});

test('default execution is a dry run and explicit generation requires a local config path', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; throw new Error('Must not call network'); };
  assert.deepEqual(await main([], { logger: quiet, fetchImpl }), { mode: 'dry-run', steps: 5, ready: false });
  await assert.rejects(main(['--generate'], { logger: quiet, fetchImpl }), /--config/);
  assert.equal(calls, 0);
});

async function scopedFixture(t) {
  const parent = join(VOICE, '.test-output'); await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, 'stream-'));
  t.after(async () => {
    assert.ok(!relative(parent, resolve(directory)).startsWith('..'));
    await rm(directory, { recursive: true, force: true });
  });
  return { audioDir: join(directory, 'audio'), manifestPath: join(directory, 'audio-manifest.json'), logger: quiet };
}

test('five complete mocked responses publish audio and a complete manifest together', async (t) => {
  const options = await scopedFixture(t); let calls = 0;
  const fetchImpl = async (url, request) => {
    assert.equal(url, ENDPOINT); assert.equal(request.method, 'POST'); assert.equal(request.redirect, 'error');
    calls += 1; return new Response(packet(Buffer.from('ID3-mock-' + calls)), { status: 200 });
  };
  const manifest = await synthesizeLesson(lesson, config, { ...options, fetchImpl });
  assert.equal(calls, 5); assert.equal(manifest.complete, true); assert.equal(manifest.provider, 'doubao');
  assert.deepEqual(Object.keys(manifest.steps), STEP_IDS);
  for (const [index, id] of STEP_IDS.entries()) {
    assert.equal((await readFile(resolve(dirname(VOICE), manifest.steps[id].src))).toString(), 'ID3-mock-' + (index + 1));
    assert.match(manifest.steps[id].sha256, /^[a-f0-9]{64}$/);
  }
  const saved = await readFile(options.manifestPath, 'utf8');
  assert.ok(!saved.includes(config.apiKey));
  assert.deepEqual(JSON.parse(saved), manifest);
});

test('failure on the third mocked response publishes no new files or completion manifest', async (t) => {
  const options = await scopedFixture(t); let calls = 0;
  const fetchImpl = async () => new Response(++calls === 3 ? '{"code":55000000}' : packet(), { status: 200 });
  await assert.rejects(synthesizeLesson(lesson, config, { ...options, fetchImpl }), /55000000/);
  assert.equal(calls, 3);
  await assert.rejects(access(options.manifestPath));
  await assert.rejects(access(options.audioDir));
});

test('provider failure preserves an earlier complete manifest and does not log raw HTTP errors', async (t) => {
  const options = await scopedFixture(t);
  const previous = '{"provider":"doubao","complete":true,"previousRun":true}\n';
  await writeFile(options.manifestPath, previous);
  const fetchImpl = async () => new Response('mock-private-server-body', { status: 401 });
  await assert.rejects(synthesizeLesson(lesson, config, { ...options, fetchImpl }), (error) => {
    assert.match(error.message, /401/); assert.ok(!error.message.includes('mock-private-server-body')); return true;
  });
  assert.equal(await readFile(options.manifestPath, 'utf8'), previous);
});
