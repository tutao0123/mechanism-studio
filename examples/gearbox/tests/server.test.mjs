import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createGearboxServer, publicFile } from '../serve.mjs';

test('the gearbox preview serves the page and its assets, never build inputs, tests or writes', async () => {
  const server = createGearboxServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [path, type] of [['/', 'text/html'], ['/app.mjs', 'text/javascript'], ['/example.mjs', 'text/javascript'], ['/presentation.mjs', 'text/javascript'], ['/presentation-data.mjs', 'text/javascript'], ['/kinematics.mjs', 'text/javascript'], ['/assets/gearbox.glb', 'model/gltf-binary'], ['/audio/music-score.json', 'application/json'], ['/planning/mechanism-plan.json', 'application/json'], ['/blueprint/', 'text/html'], ['/blueprint/app.mjs', 'text/javascript'], ['/labels.mjs', 'text/javascript'], ['/drafting-layer.mjs', 'text/javascript'], ['/study-config.mjs', 'text/javascript'], ['/shared/viewer/spec-label.mjs', 'text/javascript'], ['/shared/viewer/drafting.mjs', 'text/javascript'], ['/shared/appearance/styles.mjs', 'text/javascript'], ['/shared/study/drafting.css', 'text/css'], ['/shared/study/blueprint.css', 'text/css']]) {
      const response = await fetch(base + path); assert.equal(response.status, 200, path); assert.ok(response.headers.get('content-type').startsWith(type), path);
    }
    for (const path of ['/build-gearbox.mjs', '/geometry.mjs', '/audio/build.mjs', '/audio/synth.mjs', '/planning/build-plans.mjs', '/tests/server.test.mjs', '/serve.mjs', '/.env', '/assets/../serve.mjs', '/output/frames/00000.jpg', '/blueprint/../serve.mjs', '/blueprint/index.mjs', '/tests/drafting.test.mjs']) {
      assert.equal(publicFile(path), null, path); assert.equal((await fetch(base + path)).status, 403, path);
    }
    assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
    const range = await fetch(base + '/assets/gearbox.glb', { headers: { Range: 'bytes=0-11' } });
    assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 12);
  } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
});
