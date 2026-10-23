import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { snapshotRenderer } from './fingerprints.mjs';
import { projectRoot } from '../video/export.mjs';

async function fixture(t) {
  const base = resolve(projectRoot, 'output/studio-fingerprint-tests');
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, 'case-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path, bytes) => {
    const file = resolve(root, path);
    await mkdir(resolve(file, '..'), { recursive: true });
    await writeFile(file, bytes);
  };
  await put('examples/planetary-gears/app.mjs', 'export const phase=0;');
  await put('examples/planetary-gears/assets/assembly.glb', Buffer.from([1, 2, 3]));
  await put('shared/study/study.mjs', 'export const renderer=1;');
  await put('shared/appearance/styles.mjs', 'export const color="white";');
  await put('showcase/camera-director.mjs', 'export const camera=1;');
  await put('node_modules/three/package.json', '{"version":"fixture"}');
  await put('node_modules/three/build/three.module.js', 'export const fixture=1;');
  await put('package-lock.json', '{"lockfileVersion":3}');
  return { root, put };
}

test('registered renderer snapshot catches source, asset and shared dependency drift', async t => {
  const { root, put } = await fixture(t), entry = { id: 'planetary-gears' };
  const first = await snapshotRenderer(entry, { root });
  assert.equal(first.fileCount, 8);
  assert.equal(first.sha256, (await snapshotRenderer(entry, { root })).sha256);
  for (const path of ['examples/planetary-gears/app.mjs', 'examples/planetary-gears/assets/assembly.glb', 'shared/appearance/styles.mjs', 'showcase/camera-director.mjs', 'node_modules/three/build/three.module.js', 'package-lock.json']) {
    const before = await snapshotRenderer(entry, { root });
    await put(path, `changed ${path}`);
    assert.notEqual((await snapshotRenderer(entry, { root })).sha256, before.sha256, path);
  }
});

test('audio, output, tests, private names and dot paths do not enter public dependency evidence', async t => {
  const { root, put } = await fixture(t), entry = { id: 'planetary-gears' };
  const before = await snapshotRenderer(entry, { root });
  for (const path of ['examples/planetary-gears/audio/music-score.json', 'examples/planetary-gears/output/report.json', 'examples/planetary-gears/source/provenance.json', 'examples/planetary-gears/tests/fixture.json', 'examples/planetary-gears/.private/cache.json', 'examples/planetary-gears/credentials.json', 'examples/planetary-gears/app.test.mjs']) await put(path, 'must be excluded');
  assert.equal((await snapshotRenderer(entry, { root })).sha256, before.sha256);
  assert.equal(await snapshotRenderer({ id: '../escape' }, { root }), null);
  assert.equal(await snapshotRenderer({ id: 'fixture' }, { root }), null);
  assert.equal(await snapshotRenderer({ id: 'toString' }, { root }), null);
});

test('linked renderer subtree is refused instead of reading linked files', async t => {
  const { root, put } = await fixture(t);
  await put('linked-content/value.json', '{"private":true}');
  // Directory junctions work without administrator privileges on Windows.
  await symlink(resolve(root, 'linked-content'), resolve(root, 'examples/planetary-gears/linked-content'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(snapshotRenderer({ id: 'planetary-gears' }, { root }), /refuses linked input/);
});
