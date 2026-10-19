import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectPageGraph, servedPages } from '../scripts/page-graph.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryBase = resolve(project, '.test-output');

async function fixture(files) {
  await mkdir(temporaryBase, { recursive: true });
  const root = await mkdtemp(resolve(temporaryBase, 'page-graph-'));
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await writeFile(resolve(root, path), text);
  }
  // Serve exactly the listed URL paths; everything else is refused, like a
  // preview server whose rule was not updated.
  const served = allowed => path => {
    const key = path.endsWith('/') ? path + 'index.html' : path;
    return allowed.includes(key) ? resolve(root, key.slice(1)) : null;
  };
  return { root, served, cleanup: () => rm(root, { recursive: true, force: true }) };
}

const PAGE = `<!doctype html><link rel="stylesheet" href="/lib/style.css"><link rel="canonical" href="/elsewhere">
<script type="importmap">{"imports":{"three":"/vendor/three.js","three/addons/":"/vendor/addons/"}}</script>
<script type="module" src="./app.mjs"></script>`;
const APP = `// import nothing from 'comment-only.mjs'
import { a } from '/lib/a.mjs';
import {
  b,
} from './b.mjs';
import 'three';
export { c } from "/lib/c.mjs";
const config = { assetUrl: './assets/model.glb', sourceUrl: 'https://example.org/source', note: 'read from the assets' };
fetch('./data.json'); import('./lazy.mjs');`;

test('walks HTML, import maps, imports, CSS and runtime literals from one served page', async t => {
  const f = await fixture({
    'page/index.html': PAGE, 'page/app.mjs': APP, 'page/b.mjs': '', 'page/lazy.mjs': '', 'page/data.json': '{}',
    'page/assets/model.glb': 'glb', 'lib/a.mjs': "import { x } from 'three/addons/x.js';", 'lib/c.mjs': '',
    'lib/style.css': '@import "./base.css"; .a { background: url(../img/dot.jpg) }', 'lib/base.css': '', 'img/dot.jpg': 'jpg',
    'vendor/three.js': "export * from './core.js'; fetch('/not-followed-in-vendor.json');", 'vendor/core.js': '', 'vendor/addons/x.js': "import 'three';",
  });
  t.after(f.cleanup);
  const urls = ['/page/index.html', '/page/app.mjs', '/page/b.mjs', '/page/lazy.mjs', '/page/data.json', '/page/assets/model.glb',
    '/lib/a.mjs', '/lib/c.mjs', '/lib/style.css', '/lib/base.css', '/img/dot.jpg', '/vendor/three.js', '/vendor/core.js', '/vendor/addons/x.js'];
  const graph = await collectPageGraph({ entry: '/page/', publicFile: f.served(urls) });
  assert.deepEqual(graph.problems, []);
  assert.deepEqual(graph.files.map(file => file.url).sort(), ['/page/', ...urls.slice(1)].sort());
  assert.deepEqual(graph.external, ['https://example.org/source']);
});

test('reports refused, missing and unmapped references with the referring file', async t => {
  const f = await fixture({
    'page/index.html': '<script type="module" src="./app.mjs"></script>',
    'page/app.mjs': "import '/lib/new-shared.mjs'; import './gone.mjs'; import 'unmapped-package'; const s = { audioUrl: './local.wav' };",
  });
  t.after(f.cleanup);
  const publicFile = f.served(['/page/index.html', '/page/app.mjs', '/page/gone.mjs', '/page/local.wav']);
  const graph = await collectPageGraph({ entry: '/page/', publicFile });
  assert.deepEqual(graph.problems.map(({ from, problem, specifier }) => [from, problem, specifier]).sort(), [
    ['/page/app.mjs', 'missing-file', './gone.mjs'],
    ['/page/app.mjs', 'missing-file', './local.wav'],
    ['/page/app.mjs', 'not-served', '/lib/new-shared.mjs'],
    ['/page/app.mjs', 'unmapped-bare-specifier', 'unmapped-package'],
  ]);
  // A declared local build product may be absent; it is listed, not failed.
  const tolerant = await collectPageGraph({ entry: '/page/', publicFile, optional: file => file.endsWith('.wav') });
  assert.deepEqual(tolerant.absent, [{ from: '/page/app.mjs', url: '/page/local.wav' }]);
  assert.equal(tolerant.problems.some(problem => problem.specifier === './local.wav'), false);
});

test('servedPages lists only HTML the server rule exposes, skipping output folders', async t => {
  const f = await fixture({ 'index.html': '', 'detail/index.html': '', 'detail/review.html': '', 'private/index.html': '', 'output/index.html': '' });
  t.after(f.cleanup);
  const pages = await servedPages(f.root, f.served(['/index.html', '/detail/index.html', '/detail/review.html', '/output/index.html']));
  assert.deepEqual(pages, ['/', '/detail/', '/detail/review.html']);
});
