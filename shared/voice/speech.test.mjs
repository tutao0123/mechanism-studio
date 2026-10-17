import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile, symlink, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { SpeechError, normalizeSpeechConfig, requestSpeech, synthesizeSpeech } from './speech.mjs';
import { mainSpeechCLI } from './speech-cli.mjs';

const project = fileURLToPath(new URL('../../', import.meta.url));
await mkdir(join(project, '.test-output'), { recursive: true });
const sandbox = await mkdtemp(join(project, '.test-output/speech-'));
test.after(() => rm(sandbox, { recursive: true, force: true }));
const config = { provider: 'openrouter', model: 'example/speech-model', voice: 'example-voice', format: 'mp3' };
const audio = Buffer.from('ID3\u0004\u0000\u0000example-audio-payload');
const options = { apiKey: 'mock-secret', fetchImpl: async () => new Response(audio, { headers: { 'content-type': 'audio/mpeg' } }) };
const rejectsCode = (promise, code) => assert.rejects(promise, error => error instanceof SpeechError && error.code === code);

test('speech POST uses the documented dedicated endpoint and model-specific configuration', async () => {
  let sent;
  const result = await requestSpeech('  A robot shoulder.  ', { ...config, instructions: 'Calm and clear.', speed: 1 }, { apiKey: 'mock-secret', fetchImpl: async (url, init) => {
    sent = { url, init }; return new Response(audio, { headers: { 'content-type': 'audio/mpeg; charset=binary' } });
  } });
  assert.equal(sent.url, 'https://openrouter.ai/api/v1/audio/speech');
  assert.equal(sent.init.redirect, 'error');
  assert.deepEqual(JSON.parse(sent.init.body), { model: config.model, input: 'A robot shoulder.', voice: config.voice, response_format: 'mp3', speed: 1, instructions: 'Calm and clear.' });
  assert.equal(sent.init.headers.Authorization, 'Bearer mock-secret');
  assert.ok(result.bytes.equals(audio));
  assert.equal(result.metadata.endpointOrigin, 'https://openrouter.ai');
  assert.equal(result.metadata.bytes, audio.length);
  assert.doesNotMatch(JSON.stringify(result.metadata), /mock-secret|Authorization/);
});

test('known model and voice placeholders fail before any speech request', async () => {
  const example = JSON.parse(await readFile(new URL('./speech-config.example.json', import.meta.url), 'utf8'));
  assert.throws(() => normalizeSpeechConfig(example), error => error.code === 'CONFIG');
  let calls = 0;
  for (const field of ['model', 'voice']) for (const value of ['replace-with-current-speech-model-id', 'REPLACE_WITH_THAT_VOICE', 'your-model', 'your_voice', '<model-id>', '  <voice>  ']) {
    const invalid = { ...config, [field]: value };
    assert.throws(() => normalizeSpeechConfig(invalid), error => error.code === 'CONFIG');
    await rejectsCode(requestSpeech('Robot.', invalid, { apiKey: 'mock-secret', fetchImpl: async () => { calls++; throw new Error('must not request'); } }), 'CONFIG');
  }
  assert.equal(calls, 0);
  for (const [model, voice] of [['openai/gpt-4o-mini-tts-2025-12-15', 'alloy'], ['mistralai/voxtral-mini-tts-2603', 'neutral'], ['yourcompany/speech-model', 'yourcompany-voice'], ['provider/your-tts', 'replaceable-voice']]) {
    const normalized = normalizeSpeechConfig({ ...config, model, voice });
    assert.equal(normalized.model, model); assert.equal(normalized.voice, voice);
  }
});

test('custom endpoint origin must be independently allowed and credentials never follow redirects', async () => {
  const custom = { ...config, provider: 'custom', endpoint: 'https://speech.example/v1/audio/speech' };
  assert.throws(() => normalizeSpeechConfig(custom), error => error.code === 'ORIGIN');
  assert.equal(normalizeSpeechConfig(custom, { allowedOrigins: ['https://speech.example'] }).origin, 'https://speech.example');
  const authenticatedFixture = new URL('https://speech.example/tts');
  authenticatedFixture.username = 'example'; authenticatedFixture.password = 'example';
  for (const endpoint of ['http://speech.example/v1/audio/speech', authenticatedFixture.href, 'https://speech.example/tts?key=abc', 'https://speech.example/tts#key', 'file:///tts']) {
    assert.throws(() => normalizeSpeechConfig({ ...custom, endpoint }, { allowedOrigins: ['https://speech.example'] }), error => error.code === 'ENDPOINT');
  }
  assert.throws(() => normalizeSpeechConfig({ ...config, endpoint: custom.endpoint }), error => error.code === 'ENDPOINT');
  await rejectsCode(requestSpeech('Robot.', config, { apiKey: 'mock-secret', fetchImpl: async (_url, init) => { assert.equal(init.redirect, 'error'); throw new Error('mock-secret provider redirect'); } }), 'NETWORK');
});

test('HTTP failures omit response body and network details', async () => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(requestSpeech('Robot.', config, { apiKey: 'mock-secret', fetchImpl: async () => new Response(body, { status: 401 }) }), error => error.code === 'HTTP' && !error.message.includes('mock-secret'));
  assert.equal(cancelled, true);
  await assert.rejects(requestSpeech('Robot.', config, { apiKey: 'mock-secret', fetchImpl: async () => { throw new Error('mock-secret'); } }), error => error.code === 'NETWORK' && !error.message.includes('mock-secret'));
});

test('HTTP 200 JSON, HTML and SSE are not written as MP3', async () => {
  for (const type of ['application/json', 'text/html', 'text/event-stream', 'application/octet-stream', '']) {
    await rejectsCode(requestSpeech('Robot.', config, { apiKey: 'mock-secret', fetchImpl: async () => new Response('{"error":"hidden"}', { headers: { 'content-type': type } }) }), 'TYPE');
  }
  await rejectsCode(requestSpeech('Robot.', config, { apiKey: 'mock-secret', fetchImpl: async () => new Response('{"error":"hidden"}', { headers: { 'content-type': 'audio/mpeg' } }) }), 'AUDIO');
});

test('binary HTTP chunks are joined and finite; truncated/oversized streams fail', async () => {
  const chunks = [audio.subarray(0, 1), audio.subarray(1, 4), audio.subarray(4)];
  const streamed = await requestSpeech('Robot.', config, { apiKey: 'mock-secret', fetchImpl: async () => new Response(new ReadableStream({ start(controller) { chunks.forEach(chunk => controller.enqueue(chunk)); controller.close(); } }), { headers: { 'content-type': 'audio/mpeg' } }) });
  assert.ok(streamed.bytes.equals(audio));
  await rejectsCode(requestSpeech('Robot.', { ...config, maxBytes: 16 }, options), 'LIMIT');
  await rejectsCode(requestSpeech('Robot.', config, { apiKey: 'mock-secret', fetchImpl: async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(audio.subarray(0, 8)); controller.error(new Error('mock-secret')); } }), { headers: { 'content-type': 'audio/mpeg' } }) }), 'STREAM');
  await rejectsCode(requestSpeech('Robot.', config, { apiKey: 'mock-secret', fetchImpl: async () => new Response(new Uint8Array(), { headers: { 'content-type': 'audio/mpeg' } }) }), 'EMPTY');
});

test('explicit custom JSON base64 adapter validates field, bytes and canonical encoding', async () => {
  const custom = { ...config, provider: 'custom', endpoint: 'https://speech.example/tts', responseMode: 'json-base64', base64Field: 'audio.data' };
  const customOptions = { apiKey: 'mock-secret', allowedOrigins: ['https://speech.example'], fetchImpl: async () => Response.json({ audio: { data: audio.toString('base64') } }) };
  const result = await requestSpeech('Robot.', custom, customOptions);
  assert.ok(result.bytes.equals(audio));
  for (const value of ['not base64', '', '====', 'SGVsbG8']) await rejectsCode(requestSpeech('Robot.', custom, { ...customOptions, fetchImpl: async () => Response.json({ audio: { data: value } }) }), 'BASE64');
  assert.throws(() => normalizeSpeechConfig({ ...custom, base64Field: '__proto__.audio' }, customOptions), error => error.code === 'CONFIG');
  assert.throws(() => normalizeSpeechConfig({ ...config, responseMode: 'json-base64' }), error => error.code === 'RESPONSE');
});

test('PCM needs declared framing and WAV requires an actual container header', async () => {
  assert.throws(() => normalizeSpeechConfig({ ...config, format: 'pcm' }), error => error.code === 'CONFIG');
  const pcmConfig = { ...config, format: 'pcm', channels: 2, sampleRate: 24000, encoding: 's16le' };
  const pcm = await requestSpeech('Robot.', pcmConfig, { apiKey: 'mock-secret', fetchImpl: async () => new Response(new Uint8Array([0, 0, 1, 0]), { headers: { 'content-type': 'audio/pcm' } }) });
  assert.equal(pcm.metadata.encoding, 's16le');
  await rejectsCode(requestSpeech('Robot.', pcmConfig, { apiKey: 'mock-secret', fetchImpl: async () => new Response(new Uint8Array([0, 0]), { headers: { 'content-type': 'audio/pcm' } }) }), 'AUDIO');
  const wav = Buffer.alloc(44); wav.write('RIFF'); wav.write('WAVE', 8);
  const wavResult = await requestSpeech('Robot.', { ...config, provider: 'openai', model: 'example-tts', format: 'wav' }, { apiKey: 'mock-secret', fetchImpl: async () => new Response(wav, { headers: { 'content-type': 'audio/wav' } }) });
  assert.ok(wavResult.bytes.equals(wav));
  assert.throws(() => normalizeSpeechConfig({ ...config, format: 'wav' }), error => error.code === 'FORMAT');
});

test('s16le speech rejects big-endian audio/L16 rather than mislabeling its bytes', async () => {
  const pcmConfig = { ...config, format: 'pcm', channels: 1, sampleRate: 24000, encoding: 's16le' };
  const networkOrderSamples = new Uint8Array([0x7f, 0xff, 0x80, 0x00]);
  await rejectsCode(requestSpeech('Robot.', pcmConfig, { apiKey: 'mock-secret', fetchImpl: async () => new Response(networkOrderSamples, { headers: { 'content-type': 'audio/L16; rate=24000; channels=1' } }) }), 'TYPE');
  const littleEndianSamples = new Uint8Array([0xff, 0x7f, 0x00, 0x80]);
  for (const contentType of ['audio/pcm', 'application/octet-stream']) {
    const accepted = await requestSpeech('Robot.', pcmConfig, { apiKey: 'mock-secret', fetchImpl: async () => new Response(littleEndianSamples, { headers: { 'content-type': contentType } }) });
    assert.equal(accepted.metadata.encoding, 's16le'); assert.deepEqual(accepted.bytes, Buffer.from(littleEndianSamples));
  }
});

test('content-addressed output stays example-local and never overwrites prior files', async () => {
  const rootDir = join(sandbox, 'complete'); await mkdir(rootDir);
  const first = await synthesizeSpeech('Robot.', config, { ...options, rootDir });
  const repeated = await synthesizeSpeech('Robot.', config, { ...options, rootDir });
  assert.equal(first.path, repeated.path); assert.equal(first.recordPath, repeated.recordPath);
  assert.ok((await readFile(first.path)).equals(audio));
  assert.deepEqual(JSON.parse(await readFile(first.recordPath, 'utf8')), first.metadata);
  let calls = 0;
  await assert.rejects(synthesizeSpeech('Robot.', config, { ...options, rootDir, outputDir: resolve(rootDir, '..', 'escape'), fetchImpl: async () => { calls++; } }));
  assert.equal(calls, 0);
  await writeFile(first.path, 'existing content');
  await rejectsCode(synthesizeSpeech('Robot.', config, { ...options, rootDir }), 'CONFLICT');
  assert.equal(await readFile(first.path, 'utf8'), 'existing content');
});

test('failed synthesis creates no output directory and rechecks changed links after network', async t => {
  const rootDir = join(sandbox, 'failed'); await mkdir(rootDir);
  await rejectsCode(synthesizeSpeech('Robot.', config, { apiKey: 'mock-secret', rootDir, fetchImpl: async () => Response.json({ error: 'hidden' }, { status: 402 }) }), 'HTTP');
  assert.deepEqual(await readdir(rootDir), []);
  const linkedRoot = join(sandbox, 'linked'), outside = join(sandbox, 'outside');
  await mkdir(linkedRoot); await mkdir(outside);
  try { await symlink(outside, join(linkedRoot, 'output'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.diagnostic('Platform does not permit the symlink fixture.'); return; } throw error; }
  await assert.rejects(synthesizeSpeech('Robot.', config, { ...options, rootDir: linkedRoot }));
  assert.deepEqual(await readdir(outside), []);
  const changedRoot = join(sandbox, 'changed'); await mkdir(changedRoot);
  await assert.rejects(synthesizeSpeech('Robot.', config, { rootDir: changedRoot, apiKey: 'mock-secret', fetchImpl: async () => {
    await symlink(outside, join(changedRoot, 'output'), process.platform === 'win32' ? 'junction' : 'dir');
    return new Response(audio, { headers: { 'content-type': 'audio/mpeg' } });
  } }));
  assert.deepEqual(await readdir(outside), []);
});

test('CLI default dry-run does not read environment, fetch, or write audio', async () => {
  const rootDir = join(sandbox, 'cli'); await mkdir(rootDir);
  const configFile = join(rootDir, 'speech.local.json'), inputFile = join(rootDir, 'narration.txt');
  await writeFile(configFile, JSON.stringify({ ...config, apiKeyEnv: 'SPEECH_API_KEY' })); await writeFile(inputFile, 'The shoulder rotates.');
  let calls = 0;
  const args = ['--config', configFile, '--input', inputFile, '--root', rootDir];
  const result = await mainSpeechCLI(args, { projectDir: sandbox, env: new Proxy({}, { get() { throw new Error('environment read'); } }), fetchImpl: async () => { calls++; }, logger: () => {} });
  assert.equal(result.mode, 'dry-run'); assert.equal(calls, 0);
  const generated = await mainSpeechCLI([...args, '--generate'], { projectDir: sandbox, env: { SPEECH_API_KEY: 'mock-secret' }, fetchImpl: options.fetchImpl, logger: () => {} });
  assert.equal(generated.mode, 'generated');
  await writeFile(configFile, JSON.stringify({ ...config, apiKey: 'mock-secret' }));
  await rejectsCode(mainSpeechCLI(args, { projectDir: sandbox, logger: () => {} }), 'AUTH');
});

test('CLI rejects out-of-project roots before reading credentials or sending requests', async () => {
  await rejectsCode(mainSpeechCLI(['--config', 'not-read.json', '--input', 'not-read.txt', '--root', resolve(project, '..')], { projectDir: project, logger: () => {} }), 'PATH');
});

test('CLI dry-run and generation reject placeholders before key lookup, request or output', async () => {
  const rootDir = join(sandbox, 'cli-placeholders'); await mkdir(rootDir);
  const configFile = join(rootDir, 'speech.local.json'), inputFile = join(rootDir, 'narration.txt');
  await writeFile(inputFile, 'A connected robot.');
  let keyLookups = 0, calls = 0, logCalls = 0;
  const env = new Proxy({}, { get() { keyLookups++; throw new Error('credentials must not be read'); } });
  const deps = { projectDir: sandbox, env, fetchImpl: async () => { calls++; throw new Error('must not request'); }, logger: () => { logCalls++; } };
  const args = ['--config', configFile, '--input', inputFile, '--root', rootDir];
  for (const invalid of [{ ...config, model: 'replace-with-current-speech-model-id' }, { ...config, voice: 'your_voice' }]) {
    await writeFile(configFile, JSON.stringify({ ...invalid, apiKeyEnv: 'SPEECH_API_KEY' }));
    await rejectsCode(mainSpeechCLI(args, deps), 'CONFIG');
    await rejectsCode(mainSpeechCLI([...args, '--generate'], deps), 'CONFIG');
  }
  assert.equal(keyLookups, 0); assert.equal(calls, 0); assert.equal(logCalls, 0);
  assert.deepEqual((await readdir(rootDir)).sort(), ['narration.txt', 'speech.local.json']);
});
