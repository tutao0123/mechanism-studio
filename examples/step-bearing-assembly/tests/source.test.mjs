import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sha256, readGlb } from '../../../shared/assets/glb.mjs';
import { checkCadExample } from '../../../tools/cad/check-assembly.mjs';

const root = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const [manifest, contract, provenance, report] = await Promise.all([
  json('assets/assembly-manifest.json'), json('assets/scene-contract.json'),
  json('source/provenance.json'), json('assets/import-report.json'),
]);

test('the real leader-arm source remains pinned, licensed and fully mapped', async () => {
  const source = await readFile(new URL('source/assembly.step', root));
  assert.equal(sha256(source), '0332d1eb757d3abc3b345d5eed51ba9c53a472ea5c05a08fcfc4bf8cc9f63648');
  assert.equal(source.length, 1577215);
  assert.equal(provenance.sourceSHA256, sha256(source));
  assert.equal(provenance.license, 'Apache-2.0');
  const audit = await checkCadExample({ example: 'examples/step-bearing-assembly' });
  assert.equal(audit.status, 'verified', JSON.stringify(audit.findings));
  assert.equal(audit.summary.definitions, 22);
  assert.equal(audit.summary.occurrences, 100);
  assert.equal(audit.summary.sourceUsageRelations, 99);
  assert.equal(audit.summary.unmeshedFaces, 0);
  assert.equal(audit.summary.recoveredFaces, 0);
  assert.equal(audit.capabilities.mates.status, 'unsupported');
});

test('the source flat hierarchy and repeated-part occurrence placements survive import', () => {
  const rootOccurrence = manifest.occurrences.find(item => item.parent_id === null);
  assert.equal(manifest.occurrences.filter(item => item.parent_id === null).length, 1);
  assert.equal(rootOccurrence.children.length, 99);
  assert.equal(manifest.occurrences.filter(item => item.kind === 'assembly').length, 1);
  for (const [name, count] of [['M3x10 PH Screw', 43], ['608 bearing', 6], ['bearing_housing', 6], ['rotor', 6]]) {
    const definition = manifest.definitions.find(item => item.name === name);
    assert.ok(definition, name);
    const occurrences = manifest.occurrences.filter(item => item.definition_id === definition.definition_id);
    assert.equal(occurrences.length, count, name);
    assert.equal(new Set(occurrences.map(item => item.occurrence_id)).size, count, name);
    assert.equal(new Set(occurrences.map(item => item.source.nauoEntity)).size, count, name);
    assert.equal(new Set(occurrences.map(item => JSON.stringify(item.worldMatrixSource))).size, count, name);
    assert.ok(occurrences.every(item => item.parent_id === rootOccurrence.occurrence_id));
  }
});

test('metre-source units and shared display geometry are kept distinct', async () => {
  assert.equal(provenance.sourceLengthUnit, 'm');
  assert.deepEqual(contract.units, { source: 'm', imported: 'mm', asset: 'm', angle: 'rad' });
  assert.equal(manifest.source.coordinateNormalization.originalToImportedScale, 1000);
  const { json: glb } = readGlb(await readFile(new URL('assets/assembly.glb', root)));
  assert.equal(glb.meshes.length, 21);
  assert.equal(report.display.semanticPartNodes, 99);
  assert.equal(report.sourceStatistics.unmappedSourceOccurrences, 0);
  assert.equal(report.tessellationComparison.definitionAndOccurrenceIdentityUnchanged, true);
  assert.equal(report.tessellationComparison.localAndWorldMatricesUnchanged, true);
  assert.notEqual(report.tessellationComparison.fine.triangles, report.tessellationComparison.coarse.triangles);
});
