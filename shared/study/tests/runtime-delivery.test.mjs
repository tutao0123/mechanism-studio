import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { STUDY_RUNTIME_FILES } from '../preview-server.mjs';
import { createRobotServer, publicFile } from '../../../EXAMPLE_ROBOT/serve.mjs';
import { createHumanoidServer } from '../../../examples/humanoid/serve.mjs';
import { createWolfServer } from '../../../examples/wolf-actuator/serve.mjs';
import { createGearboxServer } from '../../../examples/gearbox/serve.mjs';
import { createHandServer } from '../../../examples/allegro-hand/serve.mjs';
import { createGripperServer } from '../../../examples/robotiq-gripper/serve.mjs';

async function withServer(create, run) {
  const server = create(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}

test('every isolated study preview serves the declared shared runtime with its content type', async () => {
  for (const create of [createRobotServer, createHumanoidServer, createWolfServer, createGearboxServer, createHandServer, createGripperServer]) {
    await withServer(create, async base => {
      for (const path of STUDY_RUNTIME_FILES) {
        const response = await fetch(`${base}/${path}`);
        assert.equal(response.status, 200, `${create.name} ${path}`);
        assert.ok(response.headers.get('content-type').startsWith(path.endsWith('.css') ? 'text/css' : 'text/javascript'), path);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.ok((await response.text()).length > 0);
      }
    });
  }
});

test('sharing the study runtime does not expose its documentation, tests, server or arbitrary future modules', async () => {
  await withServer(createRobotServer, async base => {
    for (const path of ['/shared/study/README.md', '/shared/study/tests/runtime-delivery.test.mjs', '/shared/study/preview-server.mjs', '/shared/study/private.mjs']) {
      assert.equal(publicFile(path), null);
      assert.equal((await fetch(base + path)).status, 403);
    }
  });
});
