import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPreviewServer } from '../scripts/preview-server.mjs';
import { STORIES } from '../showcase/stories.mjs';
import { narrationEditions } from '../showcase/presentation.mjs';
import { optionalAssetSet } from './optional-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = createPreviewServer(root, { redirects: { '/legacy/': '/prototype-3d/' } });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => new Promise(resolve => server.close(resolve)));

test('standalone preview serves the model and GLB without a parent workspace', async () => {
  for (const path of ['/model.mjs', '/THIRD_PARTY_NOTICES.md', '/docs/cad-roadmap.md', '/prototype-3d/index.html', '/prototype-3d/assets/lock.glb', '/node_modules/three/build/three.module.js', '/shared/viewer/viewer.mjs', '/shared/viewer/example.css', '/shared/voice/player.mjs', '/shared/assets/contract.mjs', '/examples/inline-four/index.html', '/examples/inline-four/app.mjs', '/examples/inline-four/assets/inline-four.glb', '/examples/inline-four/voice/audio-manifest.json', '/examples/turbofan/index.html', '/examples/turbofan/assets/turbofan.glb', '/examples/quadruped/index.html', '/examples/quadruped/assets/quadruped.glb', '/examples/step-assembly/index.html', '/examples/step-assembly/assets/assembly.glb', '/examples/step-assembly/source/kfl08.step']) {
    assert.equal((await fetch(base + path)).status, 200, path);
  }
  const document = await fetch(base + '/document?path=docs/cad-roadmap.md');
  assert.equal(document.status, 200);
  assert.match(document.headers.get('content-type'), /text\/html/);
  const sourceDocument = await readFile(new URL('../docs/cad-roadmap.md', import.meta.url), 'utf8');
  const escapedDocument = sourceDocument.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  assert.ok((await document.text()).includes(escapedDocument), 'document response includes the current source with HTML escaping');
  const example = await fetch(base + '/document?path=examples/inline-four/README.md');
  assert.equal(example.status, 200);
  assert.match(example.headers.get('content-type'), /text\/html/);
});
test('preview rejects tools, sibling projects, configuration and arbitrary voice JSON', async () => {
  for (const path of ['/.codex/config.toml', '/.tools/blender-mcp/server.py', '/anatomy-reference/index.html', '/prototype-3d/voice/config.json', '/prototype-3d/voice/example.private.json', '/shared/voice/speech.mjs', '/shared/voice/speech-cli.mjs', '/shared/voice/speech-config.example.json', '/%2e%2e%5canatomy-reference/index.html']) {
    assert.equal((await fetch(base + path)).status, 403, path);
  }
  for (const path of ['.agents/skills/mechanism-studio/SKILL.md', '../anatomy-reference/README.md', 'prototype-3d/app.mjs']) {
    assert.equal((await fetch(base + '/document?path=' + encodeURIComponent(path))).status, 403, path);
  }
});
test('gallery exposes implemented studies, credit-safe previews and the honest historical lock entry', async () => {
  const gallery = await (await fetch(base + '/')).text();
  for (const route of ['http://127.0.0.1:4180/?clean=1', 'http://127.0.0.1:4180/kinetic/?clean=1', 'http://127.0.0.1:4181/?clean=1', 'docs/examples-status.md']) assert.ok(gallery.includes(route), route);
  assert.equal((await fetch(base + '/docs/media/so-arm102-kinetic.jpg')).status, 200);
  assert.equal((await fetch(base + '/document?path=examples/README.md')).status, 200);
  const legacy = await fetch(base + '/examples/lock-comparison/');
  assert.equal(legacy.status, 200); assert.match(await legacy.text(), /prototype-3d\/\?palette=line-light/);
  assert.equal((await fetch(base + '/examples/lock-comparison/anatomy.html')).status, 403);
});
test('process-layer source is served without exposing tests or provider configuration', async () => {
  for (const path of ['/shared/animation/effects.mjs','/examples/inline-four/process.mjs','/examples/inline-four/effects.mjs','/examples/turbofan/process.mjs','/examples/turbofan/effects.mjs']) assert.equal((await fetch(base + path)).status,200,path);
  assert.equal((await fetch(base + '/shared/animation/tests/animation.test.mjs')).status,403);
});
test('shared CAD inspection module stays public while local CAD tools stay private', async () => {
  for (const path of ['/shared/cad/assembly.mjs', '/shared/cad/README.md']) assert.equal((await fetch(base + path)).status, 200, path);
  for (const path of ['/shared/cad/assembly.test.mjs', '/tools/cad/import-xcaf.py', '/.tools/cad-python/Scripts/python.exe', '/output/cad-research/wolf-fine.json', '/examples/shaft-bearing/', '/examples/wolf-actuator/source/assembly.step']) assert.equal((await fetch(base + path)).status, 403, path);
});
test('English showcases serve optional local narration and required adapters while keeping tools private', async t => {
  assert.equal((await fetch(base + '/showcase/presentation.mjs')).status, 200);
  for (const story of Object.keys(STORIES)) {
    for (const path of ['/showcase/', '/showcase/app.mjs', '/showcase/timeline.mjs', '/showcase/stories.mjs', '/showcase/camera-director.mjs', '/showcase/adapters/camera-envelope.mjs', `/showcase/adapters/${story}.mjs`]) assert.equal((await fetch(base + path)).status, 200, path);
  }
  for (const edition of narrationEditions(STORIES)) {
    for (const path of [edition.lesson, edition.durations]) assert.equal((await fetch(`${base}/showcase/${path}`)).status, 200, path);
    const manifestResponse = await fetch(`${base}/showcase/${edition.manifest}`);
    assert.equal(manifestResponse.status, 200); const manifest = await manifestResponse.json();
    assert.equal(manifest.speaker, 'en_female_jane_uranus_bigtts');
    const records = Object.values(manifest.steps);
    const localFiles = await optionalAssetSet(records.map(record => new URL(record.src, new URL(`../showcase/${edition.lesson}`, import.meta.url))));
    if (!localFiles) t.diagnostic(`${edition.id}: optional provider audio is absent from public release.`);
    for (const record of records) {
      const audio = await fetch(new URL(record.src, `${base}/showcase/${edition.lesson}`), { headers: { Range: 'bytes=0-31' } });
      if (localFiles) { assert.equal(audio.status, 206); assert.equal((await audio.arrayBuffer()).byteLength, 32); }
      else assert.equal(audio.status, 404);
    }
    assert.equal((await fetch(new URL('synthesize-doubao.mjs', `${base}/showcase/${edition.lesson}`))).status, 403);
    assert.equal((await fetch(new URL('config.json', `${base}/showcase/${edition.lesson}`))).status, 403);
  }
  assert.equal((await fetch(base + '/showcase/adapters/quadruped-framing.mjs')).status, 200);
  for (const path of ['/showcase/tests/timeline.test.mjs', '/showcase/voice/measure-durations.mjs', '/showcase/voice/inline-four/config.json']) assert.equal((await fetch(base + path)).status, 403, path);
});
test('explicit skill route serves only the installed entrypoint', async () => {
  const result = await fetch(base + '/skill');
  assert.equal(result.status, 200);
  assert.match(result.headers.get('content-type'), /text\/html/);
  assert.match(await result.text(), /name: mechanism-studio/);
  assert.equal((await fetch(base + '/.agents/skills/mechanism-studio/SKILL.md')).status, 403);
});
test('legacy redirects preserve the palette query', async () => {
  const result = await fetch(base + '/legacy/?palette=creo', { redirect: 'manual' });
  assert.equal(result.status, 307);
  assert.equal(result.headers.get('location'), '/prototype-3d/?palette=creo');
});
test('included binary assets support a finite range and HEAD without regenerating', async () => {
  const path = base + '/prototype-3d/assets/lock.glb';
  const result = await fetch(path, { headers: { Range: 'bytes=0-31' } });
  assert.equal(result.status, 206);
  assert.equal((await result.arrayBuffer()).byteLength, 32);
  assert.match(result.headers.get('content-range'), /^bytes 0-31\/\d+$/);
  const head = await fetch(path, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.ok(Number(head.headers.get('content-length')) > 32);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});
