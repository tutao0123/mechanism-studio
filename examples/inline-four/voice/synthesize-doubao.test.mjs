import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STEP_IDS, synthesizeLesson } from './synthesize-doubao.mjs';
import { normalizeConfig } from '../../../prototype-3d/voice/synthesize-doubao.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const lesson = { schemaVersion: 1, language: 'zh-CN', steps: STEP_IDS.map(id => ({ id, title: id, narration: '四缸发动机教学示意。' })) };
const config = normalizeConfig({ apiKey: 'mock-engine-key' });
const quiet = () => {};
async function paths() { const base = join(root, 'output'); await mkdir(base, { recursive: true }); const dir = await mkdtemp(join(base, 'voice-test-')); return { audioDir: join(dir, 'audio'), manifestPath: join(dir, 'manifest.json') }; }
const success = () => new Response(JSON.stringify({code:0,data:Buffer.from('mock-audio').toString('base64')}) + '\n' + JSON.stringify({code:20000000}));
test('engine generation publishes all five complete responses with paths relative to the engine', async () => {
  const output = await paths(); let count = 0;
  const manifest = await synthesizeLesson(lesson, config, { ...output, logger: quiet, fetchImpl: async () => { count++; return success(); } });
  assert.equal(count, 5); assert.equal(manifest.complete, true); assert.equal(manifest.provider, 'doubao');
  for (const id of STEP_IDS) { assert.equal((await readFile(join(root, manifest.steps[id].src))).toString(), 'mock-audio'); assert.ok(!manifest.steps[id].src.startsWith('../')); }
});
test('a provider failure preserves an existing engine manifest and publishes no mixed audio', async () => {
  const output = await paths(); await writeFile(output.manifestPath, 'previous'); let count = 0;
  await assert.rejects(synthesizeLesson(lesson, config, { ...output, logger: quiet, fetchImpl: async () => ++count === 3 ? new Response('denied', {status:403}) : success() }), /403/);
  assert.equal(count, 3); assert.equal(await readFile(output.manifestPath, 'utf8'), 'previous');
  await assert.rejects(readFile(join(output.audioDir, 'overview.mp3')), {code:'ENOENT'});
});
test('out-of-engine output paths and missing authentication fail before making a request', async () => {
  let count = 0; const fetchImpl = async () => { count++; return success(); };
  await assert.rejects(synthesizeLesson(lesson, config, {audioDir:join(root,'..','outside'),fetchImpl,logger:quiet}), /实例内/);
  await assert.rejects(synthesizeLesson(lesson, normalizeConfig(), {fetchImpl,logger:quiet}), /凭据/); assert.equal(count,0);
});
test('incomplete or malformed success streams never produce an engine completion manifest', async () => {
  const output = await paths();
  await assert.rejects(synthesizeLesson(lesson, config, {...output,logger:quiet,fetchImpl:async()=>new Response(JSON.stringify({code:0,data:'broken'}))}), /音频|base64|完成/);
  await assert.rejects(readFile(output.manifestPath), {code:'ENOENT'});
});
