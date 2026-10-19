import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectPageGraph, servedPages, gitIgnored } from '../scripts/page-graph.mjs';
import { STUDY_RUNTIME_FILES } from '../shared/study/preview-server.mjs';
import * as robot from '../EXAMPLE_ROBOT/serve.mjs';
import * as humanoid from '../examples/humanoid/serve.mjs';
import * as wolf from '../examples/wolf-actuator/serve.mjs';
import * as gearbox from '../examples/gearbox/serve.mjs';
import * as allegro from '../examples/allegro-hand/serve.mjs';
import * as robotiq from '../examples/robotiq-gripper/serve.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const servers = [
  ['EXAMPLE_ROBOT', robot.publicFile],
  ['examples/humanoid', humanoid.publicFile],
  ['examples/wolf-actuator', wolf.publicFile],
  ['examples/gearbox', gearbox.publicFile],
  ['examples/allegro-hand', allegro.publicFile],
  ['examples/robotiq-gripper', robotiq.publicFile],
];
// Gitignored local renders and synthesized music may be absent in a clean
// checkout; every tracked dependency must be present and served.
const optional = gitIgnored(project);
const reached = new Set();

for (const [root, publicFile] of servers) {
  test(`${root}: every served page loads its complete static dependency graph`, async () => {
    const pages = await servedPages(resolve(project, root), publicFile);
    assert.ok(pages.includes('/'), 'the example root page is served');
    for (const entry of pages) {
      const graph = await collectPageGraph({ entry, publicFile, optional });
      assert.deepEqual(graph.problems, [], `${root}${entry}`);
      for (const { url } of graph.files) reached.add(url.slice(1));
    }
  });
}

test('every shared study runtime entry is used by at least one served page', () => {
  // Runs after the page walks above (node:test runs a file's tests in order).
  // An unused entry widens every study server for nothing; remove it or use it.
  assert.deepEqual(STUDY_RUNTIME_FILES.filter(path => !reached.has(path)), []);
});

test('all study servers map the shared runtime identically and refuse its neighbours', () => {
  for (const [root, publicFile] of servers) {
    for (const path of STUDY_RUNTIME_FILES) assert.equal(publicFile('/' + path), resolve(project, path), `${root} /${path}`);
    for (const path of ['/shared/study/README.md', '/shared/study/preview-server.mjs', '/shared/study/tests/runtime-delivery.test.mjs',
      '/shared/appearance/README.md', '/shared/viewer/README.md', '/scripts/page-graph.mjs', '/vendor/three/package.json']) {
      assert.equal(publicFile(path), null, `${root} ${path}`);
    }
  }
});
