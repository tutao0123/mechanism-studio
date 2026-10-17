import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extractStepMetadata } from '../../../tools/cad/step-metadata.mjs';
const source = new URL('../source/', import.meta.url);
const bytes = await readFile(new URL('assembly.step', source));
const provenance = JSON.parse(await readFile(new URL('provenance.json', source), 'utf8'));
const metadata = extractStepMetadata(bytes.toString('latin1'));

test('WOLF retained STEP matches pinned SHA-256, byte length and Git blob identity', () => {
  assert.equal(bytes.length, provenance.sourceByteLength);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), provenance.sourceSHA256);
  assert.equal(createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex'), provenance.gitBlobSHA1);
});

test('actual source is AP242 with metre contexts, never relabelled as source millimetres', () => {
  assert.match(metadata.schema, /^AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF/);
  assert.equal(provenance.sourceLengthUnit, 'm');
  assert.deepEqual([...new Set(metadata.lengthUnits.map(unit => unit.unit))], ['m']);
  assert.equal(provenance.modified, false);
});

test('retained source usages reference real definitions and keep each usage identity', () => {
  const definitions = new Set(metadata.definitions.map(row => row.entity));
  const usages = new Set(metadata.occurrences.map(row => row.entity));
  assert.equal(definitions.size, provenance.sourceContents.productDefinitions);
  assert.equal(usages.size, provenance.sourceContents.usageRelations);
  for (const usage of metadata.occurrences) {
    assert.ok(definitions.has(usage.parentDefinition));
    assert.ok(definitions.has(usage.childDefinition));
  }
  assert.equal(metadata.statistics.assemblyOccurrences, provenance.sourceContents.assemblyUsageRelations);
  assert.equal(metadata.statistics.leafOccurrences, provenance.sourceContents.leafUsageRelations);
});

test('all twelve named planet definitions come from the retained engineering source', () => {
  const names = metadata.products.map(row => row.name);
  const planets = names.filter(name => /^planet-\d+$/.test(name));
  assert.deepEqual(planets.sort(), Array.from({length:12}, (_, i) => 'planet-' + (i+1)).sort());
  for (const name of ['sun-gear','internal-ring-gear-A','internal-ring-gear-B','front-plate','back-plate']) assert.ok(names.includes(name));
});

test('upstream companion files preserve their recorded byte checksums', async () => {
  const records = JSON.parse(await readFile(new URL('download-records.json', source), 'utf8'));
  assert.equal(records.commit, provenance.commit);
  for (const record of records.files.filter(row => row.local !== 'assembly.step')) {
    const companion = await readFile(new URL(record.local, source));
    assert.equal(companion.length, record.bytes);
    assert.equal(createHash('sha256').update(companion).digest('hex'), record.sha256);
  }
  const license = await readFile(new URL('LICENSE', source), 'utf8');
  const notice = await readFile(new URL('NOTICE.md', source), 'utf8');
  assert.match(license, /Attribution-ShareAlike 4\.0 International/);
  assert.match(notice, /Anthrobotics/);
  assert.match(notice, /Robin Fröjd/);
});
