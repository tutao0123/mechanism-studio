import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { checkCadExample, writeCadAuditReport } from '../check-assembly.mjs';
import { projectRoot } from '../import-assembly.mjs';

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
  for (const output of ['examples/gearbox/assets/build-report.json', '../outside.json', 'output/../../outside.json', join(projectRoot, 'output/absolute.json')]) await assert.rejects(writeCadAuditReport(report, { output }), /under output/);
  const directory = join(projectRoot, '.test-output/cad-report-output'); await mkdir(directory, { recursive: true });
  const invalid = await checkCadExample({ example: relative(projectRoot, directory) });
  assert.equal(invalid.status, 'failed'); assert.match(invalid.findings[0].message, /examples/);
});
