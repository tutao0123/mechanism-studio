import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createRobotServer, publicFile } from '../serve.mjs';

const server = createRobotServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));

test('isolated robot preview serves its page, actual source attribution and complete import dependencies', async () => {
  const index = await fetch(base + '/');
  assert.equal(index.status, 200); assert.match(index.headers.get('content-type'), /text\/html/);
  assert.match(await index.text(), /lang="en"/);
  for (const path of [
    '/app.mjs', '/story.mjs', '/framing.mjs', '/annotations.mjs', '/style.css', '/assets/robot.glb', '/assets/scene-contract.json',
    '/assets/source-assembly.json', '/kinetic/', '/kinetic/app.mjs', '/kinetic/story.mjs', '/kinetic/joints.mjs', '/kinetic/framing.mjs', '/kinetic/annotations.mjs', '/kinetic/style.css', '/kinetic/audio/kinetic-loop.wav', '/kinetic/audio/music-score.json',
    '/planning/scene-index.json', '/source/provenance.json', '/source/NOTICE', '/source/LICENSING.md', '/source/DOCS-LICENSE.txt', '/source/HARDWARE-LICENSE.txt', '/source/REUSE.toml',
    '/shared/viewer/viewer.mjs', '/shared/viewer/scene.mjs', '/shared/viewer/line-art.mjs', '/showcase/camera-director.mjs',
    '/vendor/three/build/three.module.js', '/vendor/three/build/three.core.js',
    '/vendor/three/examples/jsm/loaders/GLTFLoader.js', '/vendor/three/examples/jsm/controls/OrbitControls.js',
    '/vendor/three/examples/jsm/utils/BufferGeometryUtils.js', '/vendor/three/examples/jsm/utils/SkeletonUtils.js',
  ]) {
    const result = await fetch(base + path);
    assert.equal(result.status, 200, path);
    assert.ok((await result.arrayBuffer()).byteLength > 0, path);
    assert.equal(result.headers.get('x-content-type-options'), 'nosniff', path);
    assert.equal(result.headers.get('cache-control'), 'no-store', path);
  }
});

test('WAV delivery supports HEAD, finite ranges, suffixes and exact retained PCM bytes', async () => {
  const original = await readFile(new URL('../audio/robot-loop.wav', import.meta.url));
  const head = await fetch(base + '/audio/robot-loop.wav', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(head.headers.get('content-type'), 'audio/wav');
  assert.equal(Number(head.headers.get('content-length')), original.length);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.equal(head.headers.get('accept-ranges'), 'bytes');
  for (const [range, start, end] of [['bytes=0-43', 0, 43], ['bytes=100-132', 100, 132], ['bytes=-20', original.length - 20, original.length - 1], [`bytes=${original.length - 7}-`, original.length - 7, original.length - 1]]) {
    const result = await fetch(base + '/audio/robot-loop.wav', { headers: { Range: range } });
    assert.equal(result.status, 206, range);
    assert.equal(result.headers.get('content-range'), `bytes ${start}-${end}/${original.length}`, range);
    assert.equal(Number(result.headers.get('content-length')), end - start + 1, range);
    assert.deepEqual(Buffer.from(await result.arrayBuffer()), original.subarray(start, end + 1), range);
  }
  const rangedHead = await fetch(base + '/audio/robot-loop.wav', { method: 'HEAD', headers: { Range: 'bytes=0-31' } });
  assert.equal(rangedHead.status, 206); assert.equal(rangedHead.headers.get('content-length'), '32');
  assert.equal((await rangedHead.arrayBuffer()).byteLength, 0);
});

test('invalid or unsatisfiable media ranges are rejected rather than silently losing sync', async () => {
  const original = await readFile(new URL('../audio/robot-loop.wav', import.meta.url));
  for (const range of ['bytes=', 'bytes=-', 'bytes=-0', 'bytes=20-10', `bytes=${original.length}-`, 'bytes=0-2,4-6', 'items=0-5']) {
    const result = await fetch(base + '/audio/robot-loop.wav', { headers: { Range: range } });
    assert.equal(result.status, 416, range);
    assert.equal(result.headers.get('content-range'), `bytes */${original.length}`, range);
  }
});

test('robot preview blocks tools, caches, parent paths and unlisted source or tests', async () => {
  for (const path of ['/tools/cad/import-xcaf.py', '/.cache/cad/imports/example.json', '/.tools/cad-python/Scripts/python.exe', '/.env', '/output/secret.json', '/tests/music.test.mjs', '/audio/build.mjs', '/kinetic/audio/build.mjs', '/kinetic/audio/synth.mjs', '/kinetic/tests/joints.test.mjs', '/source/simulation/urdf/so_arm_102.urdf', '/%2e%2e%5canatomy-reference/index.html', '/vendor/three/../package.json', '/source/%00provenance.json']) {
    assert.equal(publicFile(decodeURIComponent(path)), null, path);
    const result = await fetch(base + path);
    assert.equal(result.status, 403, path);
  }
  assert.equal((await fetch(base + '/planning/missing.json')).status, 404);
});

test('the local preview is read-only for every public URL', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const result = await fetch(base + '/audio/robot-loop.wav', { method });
    assert.equal(result.status, 405, method); assert.equal(result.headers.get('allow'), 'GET, HEAD', method);
  }
});
