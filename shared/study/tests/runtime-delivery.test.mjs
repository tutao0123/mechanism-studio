import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRobotServer, publicFile } from '../../../EXAMPLE_ROBOT/serve.mjs';

const server = createRobotServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));

test('shared study runtime, shell, style and projected layout are available through the isolated example preview', async () => {
  for (const [path, type] of [
    ['/shared/study/study.mjs', 'text/javascript'],
    ['/shared/study/shell.mjs', 'text/javascript'],
    ['/shared/study/style.css', 'text/css'],
    ['/shared/viewer/annotation-layout.mjs', 'text/javascript'],
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.ok(response.headers.get('content-type').startsWith(type), path);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok((await response.text()).length > 0);
  }
});

test('sharing the study runtime does not expose its documentation, tests or arbitrary future modules', async () => {
  for (const path of ['/shared/study/README.md', '/shared/study/tests/runtime-delivery.test.mjs', '/shared/study/private.mjs']) {
    assert.equal(publicFile(path), null);
    assert.equal((await fetch(base + path)).status, 403);
  }
});
