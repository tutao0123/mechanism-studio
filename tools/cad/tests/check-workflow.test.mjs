import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { checkCadExample, writeCadAuditReport } from '../check-assembly.mjs';
import { projectRoot } from '../import-assembly.mjs';
import { sha256 } from '../../../shared/assets/glb.mjs';

test('read-only CAD check reports actual capabilities and preserves the included source/assets', async () => {
  const paths = ['source/assembly.step', 'assets/assembly.glb', 'assets/assembly-manifest.json', 'assets/import-report.json'];
  const hashes = await Promise.all(paths.map(async path => sha256(await readFile(join(projectRoot, 'examples/shaft-bearing', path)))));
  const report = await checkCadExample({ example: 'examples/shaft-bearing' });
  assert.equal(report.status, 'limited'); assert.equal(report.capabilities.sourceIdentity.status, 'supported');
  assert.equal(report.capabilities.placementConsistency.status, 'supported'); assert.equal(report.capabilities.mates.status, 'unsupported');
  const result = await writeCadAuditReport(report, { output: 'output/cad-check/test-readonly.json' });
  assert.deepEqual(JSON.parse(await readFile(result, 'utf8')), report);
  assert.deepEqual(await Promise.all(paths.map(async path => sha256(await readFile(join(projectRoot, 'examples/shaft-bearing', path))))), hashes);
});

test('failed source preflight is a structured failure and cannot replace existing display assets', async () => {
  const root = join(projectRoot, '.test-output/cad-check-workflow'), example = join(root, 'examples/tampered');
  await mkdir(join(example, 'source'), { recursive: true }); await mkdir(join(example, 'assets'), { recursive: true });
  await writeFile(join(example, 'source/assembly.step'), 'changed source bytes');
  await writeFile(join(example, 'source/provenance.json'), JSON.stringify({ sourceSHA256: '0'.repeat(64) }));
  await writeFile(join(example, 'assets/assembly.glb'), 'last successful asset');
  const report = await checkCadExample({ root, example: 'examples/tampered' });
  assert.equal(report.status, 'failed'); assert.match(report.findings[0].message, /differs.*provenance/);
  assert.equal(await readFile(join(example, 'assets/assembly.glb'), 'utf8'), 'last successful asset');
});

test('CAD report output cannot target source/assets or escape the project', async () => {
  const report = { status: 'limited', checks: [] };
  for (const output of ['examples/shaft-bearing/assets/import-report.json', '../outside.json', 'output/../../outside.json', join(projectRoot, 'output/absolute.json')]) await assert.rejects(writeCadAuditReport(report, { output }), /under output/);
  const directory = join(projectRoot, '.test-output/cad-report-output'); await mkdir(directory, { recursive: true });
  const invalid = await checkCadExample({ example: relative(projectRoot, directory) });
  assert.equal(invalid.status, 'failed'); assert.match(invalid.findings[0].message, /examples/);
});
