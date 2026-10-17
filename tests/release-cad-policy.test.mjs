import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { projectRoot, resolveScopedPath } from '../tools/cad/import-assembly.mjs';

test('release-list audit blocks explicitly local-only CAD without modifying or publishing it', async () => {
  const root = await resolveScopedPath(projectRoot, `.test-output/release-cad-${randomUUID()}`), scripts = join(root, 'scripts'), source = join(root, 'examples/private-fixture/source');
  await mkdir(scripts, { recursive: true }); await mkdir(source, { recursive: true });
  await writeFile(join(scripts, 'release-check.mjs'), await readFile(join(projectRoot, 'scripts/release-check.mjs')));
  await writeFile(join(root, '.gitignore'), 'output/\n');
  await writeFile(join(source, 'assembly.step'), 'PRIVATE-FIXTURE-NOT-A-CAD-MODEL');
  const git = spawnSync('git', ['init', '--quiet', '--initial-branch=main'], { cwd: root }); assert.equal(git.status, 0, git.stderr.toString());
  const provenancePath = join(source, 'provenance.json');
  for (const sourcePolicy of [{ sourceType: 'user-provided', redistribution: 'not-authorized' }, { sourceType: 'user-provided' }]) {
    await writeFile(provenancePath, JSON.stringify(sourcePolicy));
    const result = spawnSync(process.execPath, ['scripts/release-check.mjs'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const report = JSON.parse(await readFile(join(root, 'output/release-check.json'), 'utf8'));
    assert.ok(report.failures.some(message => /without redistribution authorization/.test(message)));
    assert.equal(report.publication, 'not-performed'); assert.equal(await readFile(join(source, 'assembly.step'), 'utf8'), 'PRIVATE-FIXTURE-NOT-A-CAD-MODEL');
  }
  // Declared public upstream provenance does not acquire a new blanket block.
  await writeFile(provenancePath, JSON.stringify({ sourceType: 'public-upstream', license: 'CC0-1.0' }));
  const publicResult = spawnSync(process.execPath, ['scripts/release-check.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(publicResult.status, 0, publicResult.stdout + publicResult.stderr);
});
