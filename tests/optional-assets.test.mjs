import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { optionalAssetSet } from './optional-assets.mjs';

test('optional delivery sets allow absence or a complete set, and reject partially missing media', async () => {
  const base = new URL(`../.test-output/optional-assets-${randomUUID()}/`, import.meta.url);
  await mkdir(base, { recursive: true });
  const files = [new URL('first.mp3', base), new URL('second.mp3', base)];
  assert.equal(await optionalAssetSet(files), null);
  await writeFile(files[0], 'synthetic-first-fixture');
  await assert.rejects(optionalAssetSet(files), /incomplete/);
  await writeFile(files[1], 'synthetic-second-fixture');
  assert.deepEqual((await optionalAssetSet(files)).map(bytes => bytes.toString()), ['synthetic-first-fixture', 'synthetic-second-fixture']);
});
