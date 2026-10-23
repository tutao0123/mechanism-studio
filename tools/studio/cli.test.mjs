import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EXAMPLES, PROJECT_ROOT, getExample } from './registry.mjs';
import { parseArgs, runStudio } from './cli.mjs';
import { startPreview } from './preview.mjs';

const close = server => new Promise((resolve, reject) => {
  server.close(error => error ? reject(error) : resolve());
  server.closeAllConnections();
});

test('CLI supports registered editions and rejects ambiguous or arbitrary inputs before launch', () => {
  assert.deepEqual(parseArgs(['preview']), { command: 'preview', id: 'gallery' });
  assert.deepEqual(parseArgs(['preview', '--port', '4300', 'planetary-gears']), { command: 'preview', id: 'planetary-gears', port: 4300 });
  assert.equal(parseArgs(['export', 'gearbox-cinematic']).id, 'gearbox-cinematic');
  assert.deepEqual(parseArgs(['generate', 'planetary-gears']), { command: 'generate', id: 'planetary-gears' });
  assert.deepEqual(parseArgs(['generate', 'robot-joint']), { command: 'generate', id: 'robot-joint' });
  for (const args of [
    ['publish', 'planetary-gears'], ['list', 'planetary-gears'], ['list', '--port', '4193'],
    ['preview', '../planetary-gears'], ['preview', 'http://example.com'], ['preview', 'gallery', 'gearbox'],
    ['preview', '--port'], ['preview', '--port', '0'], ['preview', '--port', '65536'],
    ['preview', '--port', '1.5'], ['preview', '--port', '4e3'], ['preview', '--port', '4300', '--port', '4301'],
    ['export'], ['export', 'robotiq-gripper'], ['export', 'gearbox-blueprint'], ['export', 'planetary-gears', '--fps', '60'],
    ['generate'], ['generate', 'step-bearing-assembly'], ['generate', '../gearbox'], ['generate', 'gearbox-cinematic'],
    ['generate', 'gearbox', '--port', '4300'], ['generate', 'gearbox', '--out', '../another-project'],
  ]) assert.throws(() => parseArgs(args), undefined, args.join(' '));
});

test('machine-readable list reports supported adapters without starting servers', async () => {
  const messages = [];
  const rows = await runStudio(['list', '--json'], { log: message => messages.push(message), environment: {} });
  assert.deepEqual(JSON.parse(messages[0]), rows);
  assert.equal(new Set(rows.map(item => item.id)).size, rows.length);
  assert.deepEqual(rows.filter(item => item.export).map(item => item.id), ['robot-joint', 'planetary-gears', 'gearbox', 'gearbox-cinematic']);
  assert.deepEqual(rows.filter(item => item.generate).map(item => item.id), ['robot-joint', 'planetary-gears', 'gearbox']);
  assert.equal(rows.find(item => item.id === 'planetary-gears').duration, 36);
  assert.equal(rows.find(item => item.id === 'allegro-hand').export, false);
  assert.equal(rows.find(item => item.id === 'robot-joint').duration, 36);
});

test('generate dispatches only its registered recipe and prints usable next commands', async () => {
  const messages = []; let called;
  const result = await runStudio(['generate', 'gearbox'], {
    log: message => messages.push(message), environment: { PORT: 'not-a-port' },
    generate: async (entry, options) => {
      called = { entry, options };
      return { partCount: 124, definitionCount: 68, asset: 'examples/gearbox/assets/gearbox.glb', report: 'output/studio/test/generation.json' };
    },
    preview: async () => { throw new Error('Generation must not open a preview server.'); },
    exportFilm: async () => { throw new Error('Generation must not export a movie.'); },
  });
  assert.equal(called.entry, getExample('gearbox'));
  assert.equal(typeof called.options.log, 'function');
  assert.equal(result.partCount, 124);
  assert.match(messages.join('\n'), /npm run studio -- preview gearbox/);
  assert.match(messages.join('\n'), /npm run studio -- export gearbox/);
});

test('explicit port overrides PORT and invalid PORT cannot start a server', async () => {
  const calls = [];
  const preview = async (entry, options) => { calls.push({ id: entry.id, port: options.port }); return { url: 'http://127.0.0.1:4400/' }; };
  await runStudio(['preview', 'gearbox', '--port', '4400'], { environment: { PORT: 'bad' }, log: () => {}, preview });
  await runStudio(['preview', 'lock'], { environment: { PORT: '4401' }, log: () => {}, preview });
  assert.deepEqual(calls, [{ id: 'gearbox', port: 4400 }, { id: 'lock', port: 4401 }]);
  await assert.rejects(runStudio(['preview'], { environment: { PORT: 'bad' }, log: () => {}, preview }), /Port must/);
  assert.equal(calls.length, 2);
});

test('all registered preview pages serve through their existing allowlisted server', async () => {
  for (const entry of EXAMPLES) {
    const running = await startPreview(entry, { port: 0, prepareAudio: false });
    try {
      const response = await fetch(running.url);
      assert.equal(response.status, 200, entry.id);
      assert.match(response.headers.get('content-type'), /text\/html/, entry.id);
      if (entry.export) assert.equal((await fetch(running.baseUrl + entry.export.renderPath)).status, 200, `${entry.id} render entry`);
      for (const forbidden of ['/.env', '/tools/studio/cli.mjs', '/.git/config', '/%2e%2e%5csecrets/.env']) {
        assert.equal((await fetch(running.baseUrl + forbidden)).status, 403, `${entry.id}: ${forbidden}`);
      }
    } finally { await close(running.server); }
  }
});

test('unified preview still serves actual geometry and shared runtime modules', async () => {
  const running = await startPreview(getExample('planetary-gears'), { port: 0, prepareAudio: false });
  try {
    const glb = await fetch(running.baseUrl + '/assets/assembly.glb', { headers: { Range: 'bytes=0-11' } });
    assert.equal(glb.status, 206);
    assert.equal(Buffer.from(await glb.arrayBuffer()).readUInt32LE(0), 0x46546c67);
    for (const path of ['/shared/study/study.mjs', '/shared/viewer/scene.mjs', '/vendor/three/build/three.module.js']) {
      assert.equal((await fetch(running.baseUrl + path)).status, 200, path);
    }
  } finally { await close(running.server); }
});

test('occupied ports fail clearly without interrupting the existing listener', async () => {
  const entry = getExample('planetary-gears');
  const first = await startPreview(entry, { port: 0, prepareAudio: false });
  try {
    await assert.rejects(startPreview(entry, { port: first.server.address().port, prepareAudio: false }), /already in use.*left running/);
    assert.equal((await fetch(first.url)).status, 200);
  } finally { await close(first.server); }
});

test('CLI export dispatches exact adapter and port to the shared export workbench', async () => {
  let called;
  const result = await runStudio(['export', 'planetary-gears', '--port', '4402'], {
    log: () => {}, environment: {},
    exportFilm: async (entry, options) => { called = { entry, options }; return { url: 'http://127.0.0.1:4402/', outputDirectory: 'output/studio/test' }; },
  });
  assert.equal(called.entry, getExample('planetary-gears'));
  assert.deepEqual(called.options, { port: 4402 });
  assert.equal(result.url, 'http://127.0.0.1:4402/');
});

test('standalone CLI exits nonzero on errors and list remains usable without a browser', () => {
  const failure = spawnSync(process.execPath, ['tools/studio/cli.mjs', 'preview', 'missing-example'], { cwd: PROJECT_ROOT, encoding: 'utf8' });
  assert.equal(failure.status, 1);
  assert.match(failure.stderr, /Unknown example/);
  const list = spawnSync(process.execPath, ['tools/studio/cli.mjs', 'list', '--json'], { cwd: PROJECT_ROOT, encoding: 'utf8' });
  assert.equal(list.status, 0, list.stderr);
  assert.ok(JSON.parse(list.stdout).some(item => item.id === 'planetary-gears' && item.export));
});
