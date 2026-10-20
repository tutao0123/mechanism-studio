import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SOURCES, fetchSource, projectRoot } from '../scripts/fetch-sources.mjs';

const git = (...args) => execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' });
const readJson = async path => JSON.parse(await readFile(join(projectRoot, path), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

test('upstream payloads are pinned, ignored by Git and never tracked', () => {
  const paths = SOURCES.map(entry => entry.path);
  assert.equal(new Set(paths).size, paths.length, 'one entry per path');
  for (const entry of SOURCES) {
    assert.match(entry.path, /^(?:EXAMPLE_ROBOT|examples\/[\w-]+)\/source\/[^\0]+\.(?:step|stl|pdf)$/i, entry.path);
    assert.match(entry.url, /^https:\/\/raw\.githubusercontent\.com\/[\w.-]+\/[\w.-]+\/[0-9a-f]{40}\//, entry.path);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/); assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 0);
  }
  const ignored = execFileSync('git', ['check-ignore', '--no-index', '--stdin'], { cwd: projectRoot, encoding: 'utf8', input: paths.join('\n') });
  assert.equal(ignored.trim().split('\n').length, paths.length, 'every payload is ignored');
  const tracked = git('ls-files', '-z').split('\0').filter(path => /\/source\/.*\.(?:step|stp|stl|pdf)$/i.test(path));
  assert.deepEqual(tracked, [], 'no upstream CAD, mesh or manual is committed');
});

test('every pinned hash matches the example’s own provenance record', async () => {
  const recorded = new Map();
  for (const dir of ['EXAMPLE_ROBOT', 'examples/humanoid', 'examples/allegro-hand', 'examples/robotiq-gripper']) {
    for (const file of (await readJson(`${dir}/source/provenance.json`)).files) recorded.set(`${dir}/source/${file.localFile}`, file.sha256);
  }
  for (const entry of SOURCES) assert.equal(entry.sha256, recorded.get(entry.path), entry.path);
});

test('a download is kept only when it matches its pinned hash', async () => {
  const root = join(projectRoot, `.test-output/fetch-sources-${randomUUID()}`); await mkdir(root, { recursive: true });
  const good = Buffer.from('pinned upstream bytes'), entry = { path: 'examples/x/source/part.stl', url: `https://raw.githubusercontent.com/o/r/${'a'.repeat(40)}/part.stl`, bytes: good.length, sha256: sha256(good) };
  const serve = bytes => async () => new Response(bytes);
  await assert.rejects(fetchSource(entry, { root, download: serve(Buffer.from('tampered upstream bytes')) }), /does not match/);
  await assert.rejects(readFile(join(root, entry.path)), { code: 'ENOENT' });
  assert.equal(await fetchSource(entry, { root, download: serve(good) }), 'fetched');
  assert.equal(await fetchSource(entry, { root, download: () => { throw new Error('no network needed'); } }), 'present');
  assert.deepEqual(await readFile(join(root, entry.path)), good);
  await assert.rejects(fetchSource({ ...entry, path: '../escape.stl' }, { root, download: serve(good) }), /outside/);
  await assert.rejects(fetchSource({ ...entry, url: 'https://raw.githubusercontent.com/o/r/main/part.stl' }, { root, download: serve(good) }), /not pinned/);
});
