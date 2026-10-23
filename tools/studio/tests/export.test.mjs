import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { exportExample } from '../export.mjs';
import { checkedPath, projectRoot } from '../../video/export.mjs';

// These protocol fixtures exercise byte acceptance and state transitions only.
// The JPEG has a structural SOF header; actual decoding and media quality belong
// to the real encoder/integration checks, deliberately not this injected stub.
function jpeg(width = 16, height = 16) {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 8, 8, 0, 0, 0, 0, 1, 0xff, 0xd9]);
  bytes.writeUInt16BE(height, 7); bytes.writeUInt16BE(width, 9);
  return bytes;
}

function wav() {
  const bytes = Buffer.alloc(76);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(48000, 24); bytes.writeUInt32LE(96000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(bytes.length - 44, 40);
  for (let offset = 44; offset < bytes.length; offset += 2) bytes.writeInt16LE(400, offset);
  return bytes;
}

async function removeOwned(path) {
  const local = relative(projectRoot, path).split(sep).join('/');
  assert.ok(local.startsWith('output/studio/'), 'test cleanup remains in its project-local output tree');
  await rm(await checkedPath(local, { output: true }), { recursive: true, force: true });
}

async function fixture(t, { encode = async () => { throw new Error('Unexpected encoder call'); } } = {}) {
  const parent = await checkedPath('output/studio', { output: true });
  await mkdir(parent, { recursive: true });
  const source = await mkdtemp(join(parent, 'protocol-source-'));
  const audioBytes = wav(); await writeFile(join(source, 'fixture.wav'), audioBytes);
  const entry = {
    id: 'protocol-test', title: 'Protocol test only', audio: null,
    preview: { createServer: () => createServer((req, res) => res.writeHead(200, { 'Content-Type': 'text/plain' }).end('preview')) },
    export: {
      apiName: 'fixtureFilm', renderPath: '/render.html', duration: 2 / 30, fps: 30, width: 16, height: 16,
      audioPath: relative(projectRoot, join(source, 'fixture.wav')).split(sep).join('/'),
      reviewTime: 1 / 30, staticRegion: { x: 0, y: 0, width: 16, height: 8 },
    },
  };
  let running;
  try { running = await exportExample(entry, { checkDependencies: false, prepareAudio: false, encode }); }
  catch (error) { await removeOwned(source); throw error; }
  const origin = new URL(running.url).origin;
  const config = await (await fetch(origin + '/__studio/config')).json();
  t.after(async () => {
    await new Promise((accept, reject) => {
      running.server.close(error => error ? reject(error) : accept());
      running.server.closeAllConnections();
    });
    await removeOwned(resolve(projectRoot, running.outputDirectory));
    await removeOwned(source);
  });
  async function post(path, { data = {}, bytes, headers = {}, authorized = true } = {}) {
    const response = await fetch(`${origin}/__studio/${path}`, {
      method: 'POST',
      headers: {
        ...(authorized ? { Origin: origin, 'X-Studio-Session': config.nonce } : {}),
        'Content-Type': bytes ? 'image/jpeg' : 'application/json', ...headers,
      },
      body: bytes || JSON.stringify(data),
    });
    return { status: response.status, body: await response.json() };
  }
  const state = async () => (await fetch(`${origin}/__studio/status`)).json();
  const persisted = async () => JSON.parse(await readFile(resolve(projectRoot, running.outputDirectory, 'status.json'), 'utf8'));
  const start = () => post('start', { data: { reviewedCalibration: true, capture: { fixture: true, width: 16, height: 16 } } });
  return { ...running, origin, config, entry, audioBytes, post, state, persisted, start };
}

function requestWithHost(url, host) {
  return new Promise((accept, reject) => {
    const call = request(url, { headers: { Host: host } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => accept({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    call.on('error', reject); call.end();
  });
}

test('export workbench restricts Host and mutation origin/token while retaining read-only preview', async t => {
  const job = await fixture(t);
  assert.equal((await job.persisted()).stage, 'ready');
  const config = await fetch(job.origin + '/__studio/config');
  assert.equal(config.headers.get('access-control-allow-origin'), null);
  const page = await fetch(job.url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal((await fetch(job.origin + '/render.html')).status, 200);
  assert.equal((await fetch(job.origin + '/render.html', { method: 'POST' })).status, 405);
  assert.equal((await requestWithHost(job.origin + '/__studio/config', 'attacker.example')).status, 403);
  for (const options of [
    { authorized: false },
    { headers: { Origin: 'https://attacker.example' } },
    { headers: { 'X-Studio-Session': 'wrong-token' } },
    { headers: { Origin: '' } },
  ]) assert.equal((await job.post('start', { ...options, data: { reviewedCalibration: true, capture: {} } })).status, 403);
  assert.equal((await job.state()).stage, 'ready');
  assert.equal((await fetch(job.origin + '/__studio/unknown')).status, 404);
  assert.equal((await job.post('unknown')).status, 404);
});

test('calibration and capture are required and a started job cannot be replayed', async t => {
  const job = await fixture(t);
  assert.equal((await job.post('frame/0', { bytes: jpeg() })).status, 400);
  for (const data of [{ capture: {} }, { reviewedCalibration: false, capture: {} }, { reviewedCalibration: true }, { reviewedCalibration: true, capture: [] }]) {
    assert.equal((await job.post('start', { data })).status, 400);
    assert.equal((await job.state()).stage, 'ready');
  }
  assert.equal((await job.post('start', { data: { reviewedCalibration: true, capture: {} }, headers: { 'Content-Type': 'text/plain' } })).status, 400);
  assert.equal((await job.start()).status, 200);
  assert.equal((await job.start()).status, 400);
  const recorded = JSON.parse(await readFile(resolve(projectRoot, job.outputDirectory, 'job.json'), 'utf8'));
  assert.equal(recorded.calibrationConfirmed, true);
  assert.deepEqual(recorded.capture, { fixture: true, width: 16, height: 16 });
  assert.equal(recorded.audioSha256, createHash('sha256').update(job.audioBytes).digest('hex'));
});

test('frames must have the registered dimensions, type, sequence and unique index', async t => {
  const job = await fixture(t); await job.start();
  for (const [path, options] of [
    ['frame/1', { bytes: jpeg() }], ['frame/0', { bytes: jpeg(18, 16) }], ['frame/0', { bytes: jpeg(16, 18) }],
    ['frame/0', { bytes: Buffer.from('not JPEG') }], ['frame/0', { bytes: jpeg(), headers: { 'Content-Type': 'application/octet-stream' } }],
  ]) {
    assert.equal((await job.post(path, options)).status, 400);
    assert.equal((await job.state()).frames, 0);
  }
  assert.deepEqual(await readdir(resolve(projectRoot, job.outputDirectory, 'frames')), []);
  assert.equal((await job.post('frame/0', { bytes: jpeg() })).status, 200);
  assert.equal((await job.post('frame/0', { bytes: jpeg() })).status, 400);
  assert.equal((await job.post('frame/2', { bytes: jpeg() })).status, 400);
  assert.equal((await job.state()).frames, 1);
  assert.equal((await job.post('frame/1', { bytes: jpeg() })).status, 200);
  assert.equal((await job.post('frame/2', { bytes: jpeg() })).status, 400);
  assert.deepEqual((await readdir(resolve(projectRoot, job.outputDirectory, 'frames'))).sort(), ['00000.jpg', '00001.jpg']);
  assert.deepEqual(await readFile(resolve(projectRoot, job.outputDirectory, 'frames/00000.jpg')), jpeg());
});

test('incomplete finish never calls the encoder and keeps the job resumable', async t => {
  let calls = 0;
  const job = await fixture(t, { encode: async () => { calls++; return {}; } });
  assert.equal((await job.post('finish')).status, 400);
  await job.start(); await job.post('frame/0', { bytes: jpeg() });
  assert.equal((await job.post('finish')).status, 400);
  assert.equal(calls, 0);
  assert.equal((await job.state()).stage, 'rendering');
  assert.equal((await job.post('frame/1', { bytes: jpeg() })).status, 200);
});

test('finish reports encoder progress, blocks further writes and serves a completed delivery', async t => {
  let complete, callCount = 0, recordedPath;
  const hold = new Promise(accept => { complete = accept; });
  const job = await fixture(t, { encode: async (path, onStage) => {
    callCount++; recordedPath = path; onStage('encoding');
    await hold;
    await writeFile(resolve(projectRoot, path, '../film.mp4'), Buffer.from('protocol fixture, not a real video'));
    return { passed: true, frames: 2, duration: 2 / 30, checks: { protocolFixture: true } };
  } });
  try {
    assert.equal((await fetch(job.origin + '/__studio/film.mp4')).status, 404);
    await job.start(); await job.post('frame/0', { bytes: jpeg() }); await job.post('frame/1', { bytes: jpeg() });
    assert.equal((await job.post('finish')).status, 202);
    assert.equal(callCount, 1);
    assert.equal(recordedPath, `${job.outputDirectory}/job.json`);
    assert.equal((await job.state()).stage, 'encoding');
    assert.equal((await job.post('finish')).status, 400);
    assert.equal((await job.post('cancel')).status, 400);
    assert.equal((await job.post('frame/0', { bytes: jpeg() })).status, 400);
    complete(); await job.completion();
    const status = await job.state();
    assert.equal(status.stage, 'complete'); assert.equal(status.delivery.frames, 2);
    const saved = await job.persisted();
    assert.equal(saved.stage, 'complete'); assert.equal(saved.frames, 2);
    assert.deepEqual(saved.delivery, status.delivery);
    assert.ok(Number.isFinite(Date.parse(saved.updatedAt)));
    const delivered = await fetch(job.origin + '/__studio/film.mp4');
    assert.equal(delivered.status, 200);
    assert.equal(delivered.headers.get('content-type'), 'video/mp4');
    assert.match(delivered.headers.get('content-disposition'), /protocol-test\.mp4/);
    assert.equal(await delivered.text(), 'protocol fixture, not a real video');
    const range = await fetch(job.origin + '/__studio/film.mp4', { headers: { Range: 'bytes=0-7' } });
    assert.equal(range.status, 206); assert.equal(range.headers.get('accept-ranges'), 'bytes');
    assert.equal(range.headers.get('content-range'), 'bytes 0-7/34');
    assert.equal(range.headers.get('content-length'), '8'); assert.equal(await range.text(), 'protocol');
    const tail = await fetch(job.origin + '/__studio/film.mp4', { headers: { Range: 'bytes=29-' } });
    assert.equal(tail.status, 206); assert.equal(await tail.text(), 'video');
    for (const value of ['bytes=99-', 'bytes=8-7', 'bytes=invalid']) {
      const invalid = await fetch(job.origin + '/__studio/film.mp4', { headers: { Range: value } });
      assert.equal(invalid.status, 416); assert.equal(invalid.headers.get('content-range'), 'bytes */34');
    }
  } finally { complete(); if (job.completion()) await job.completion(); }
});

test('encoder rejection becomes failed status and leaves received frames for diagnosis', async t => {
  const job = await fixture(t, { encode: async () => { throw new Error('fixture encoder failure'); } });
  await job.start(); await job.post('frame/0', { bytes: jpeg() }); await job.post('frame/1', { bytes: jpeg() });
  assert.equal((await job.post('finish')).status, 202);
  await job.completion();
  const state = await job.state();
  assert.equal(state.stage, 'failed'); assert.equal(state.error, 'fixture encoder failure'); assert.equal(state.delivery, null);
  const saved = await job.persisted();
  assert.equal(saved.stage, 'failed'); assert.equal(saved.error, 'fixture encoder failure'); assert.equal(saved.frames, 2);
  assert.equal((await fetch(job.origin + '/__studio/film.mp4')).status, 404);
  assert.equal((await job.post('start', { data: { reviewedCalibration: true, capture: {} } })).status, 400);
  assert.equal((await readdir(resolve(projectRoot, job.outputDirectory, 'frames'))).length, 2);
});

test('partial cancellation keeps received files and prevents resume or encoding', async t => {
  let calls = 0;
  const job = await fixture(t, { encode: async () => { calls++; return {}; } });
  await job.start(); await job.post('frame/0', { bytes: jpeg() });
  const cancelled = await job.post('cancel');
  assert.equal(cancelled.status, 200); assert.equal(cancelled.body.stage, 'cancelled');
  assert.equal(cancelled.body.frames, 1);
  const saved = await job.persisted();
  assert.equal(saved.stage, 'cancelled'); assert.equal(saved.frames, 1); assert.equal(saved.delivery, null);
  assert.deepEqual(await readdir(resolve(projectRoot, job.outputDirectory, 'frames')), ['00000.jpg']);
  assert.equal((await job.post('frame/1', { bytes: jpeg() })).status, 400);
  assert.equal((await job.post('finish')).status, 400);
  assert.equal((await job.start()).status, 400);
  assert.equal(calls, 0);
});
