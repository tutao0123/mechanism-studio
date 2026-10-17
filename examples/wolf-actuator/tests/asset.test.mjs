import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sha256, readGlb } from '../../../shared/assets/glb.mjs';
import { checkCadExample } from '../../../tools/cad/check-assembly.mjs';
const base = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('assets/assembly-manifest.json', base), 'utf8'));
const contract = JSON.parse(await readFile(new URL('assets/scene-contract.json', base), 'utf8'));
const index = JSON.parse(await readFile(new URL('assets/scene-index.json', base), 'utf8'));
const report = JSON.parse(await readFile(new URL('assets/import-report.json', base), 'utf8'));
const bytes = await readFile(new URL('assets/assembly.glb', base));
const glb = readGlb(bytes).json;

test('actual WOLF asset and index retain all source geometry occurrences and real assembly nodes', () => {
  assert.equal(sha256(bytes), report.glbSHA256);
  assert.equal(index.asset.sha256, report.glbSHA256);
  const geometryDefinitions = new Set(manifest.definitions.filter(d => d.geometry).map(d => d.definition_id));
  const expectedParts = manifest.occurrences.filter(o => geometryDefinitions.has(o.definition_id)).map(o => o.occurrence_id).sort();
  assert.deepEqual(index.parts.map(p => p.id).sort(), expectedParts);
  assert.deepEqual(contract.parts.map(p => p.part_id).sort(), expectedParts);
  assert.deepEqual(glb.nodes.filter(n => n.extras?.part_id).map(n => n.extras.part_id).sort(), expectedParts);
  assert.deepEqual(index.assemblies.map(p => p.id).sort(), manifest.occurrences.filter(o => o.kind === 'assembly').map(o => o.occurrence_id).sort());
  assert.equal(index.parts.length, 245);
  assert.equal(index.assemblies.length, 8);
});

test('native metres convert once into a plausible 202 mm by 67 mm display, with all part bounds in its envelope', () => {
  assert.equal(manifest.source.originalLengthUnit, 'm');
  assert.equal(manifest.source.units.length, 'mm');
  assert.equal(manifest.source.coordinateNormalization.originalToImportedScale, 1000);
  assert.deepEqual(contract.units, {source:'m',imported:'mm',asset:'m',angle:'rad'});
  const bounds = index.asset.assembledWorldBounds, spans = bounds.max.map((v,i) => v-bounds.min[i]);
  assert.ok(spans[0] > .19 && spans[0] < .21);
  assert.ok(spans[1] > .06 && spans[1] < .08);
  assert.ok(spans[2] > .19 && spans[2] < .21);
  for (const part of index.parts) for (let axis=0;axis<3;axis++) {
    assert.ok(part.worldBounds.min[axis] >= bounds.min[axis]-1e-9);
    assert.ok(part.worldBounds.max[axis] <= bounds.max[axis]+1e-9);
    assert.ok(part.worldCenter[axis] >= part.worldBounds.min[axis] && part.worldCenter[axis] <= part.worldBounds.max[axis]);
  }
});

test('actual retained WOLF evidence passes source identity while source-only faces stay limited', async () => {
  const result = await checkCadExample({example:'examples/wolf-actuator'});
  assert.equal(result.status, 'limited', JSON.stringify(result.findings));
  assert.equal(result.capabilities.sourceIdentity.status, 'supported');
  assert.equal(result.capabilities.placementConsistency.status, 'supported');
  assert.equal(result.capabilities.displayFaceCoverage.status, 'supported');
  assert.equal(result.capabilities.analyticGeometryCoverage.status, 'limited');
  assert.equal(result.summary.sourceTriangulatedDefinitions, 69);
  assert.equal(result.summary.sourceTriangulatedOccurrences, 138);
  assert.equal(result.summary.unmeshedFaces, 0);
  const triangles = manifest.definitions.filter(d => d.geometry?.representation === 'source-triangulated');
  assert.equal(triangles.length, 69);
  for (const definition of triangles) {
    assert.equal(definition.geometry.brepBoundsSourceMm, null);
    assert.ok(definition.geometry.faceTriangleRanges.every(face => face.sourceTriangleCount === face.triangleCount && /^[a-f0-9]{64}$/.test(face.sourceTriangulationSHA256)));
  }
});
