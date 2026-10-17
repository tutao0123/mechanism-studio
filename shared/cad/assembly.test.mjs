import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssemblyIndex, createAssemblyInspection, multiplyMatrices, sourceToGltfMatrix } from './assembly.mjs';

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const translate = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const quarterTurn = (x = 0, y = 0, z = 0) => [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const point = (m, [x, y, z]) => [0, 1, 2].map(row => m[row] * x + m[4 + row] * y + m[8 + row] * z + m[12 + row]);
const close = (actual, expected) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-10, `${i}: ${value} ≠ ${expected[i]}`));

function specimen() {
  const definitions = [
    { definition_id: 'main', name: 'Main assembly', kind: 'assembly' },
    { definition_id: 'support', name: 'Bearing support assembly', kind: 'assembly' },
    { definition_id: 'housing', name: 'Bearing housing', kind: 'part' },
    { definition_id: 'bolt', name: 'Socket screw', kind: 'part' },
    { definition_id: 'shaft', name: 'Shaft', kind: 'part' },
  ];
  const occurrences = [];
  function add(id, parent, definition, local = identity()) {
    const def = definitions.find(d => d.definition_id === definition);
    const world = parent === null ? [...local] : multiplyMatrices(occurrences.find(o => o.occurrence_id === parent).worldMatrixSource, local);
    occurrences.push({ occurrence_id: id, parent_id: parent, definition_id: definition,
      kind: def.kind, label: id, source: { entity: `#${occurrences.length + 1}` },
      localMatrixSource: local, worldMatrixSource: world });
  }
  add('root', null, 'main', translate(10, 20, 30));
  add('support-a', 'root', 'support', quarterTurn(50));
  add('housing-a', 'support-a', 'housing');
  add('bolt-a1', 'support-a', 'bolt', translate(5, 8, 2));
  add('bolt-a2', 'support-a', 'bolt', translate(-5, 8, 2));
  add('support-b', 'root', 'support', translate(-50, 0, 0));
  add('housing-b', 'support-b', 'housing');
  add('bolt-b1', 'support-b', 'bolt', translate(5, 8, 2));
  add('bolt-b2', 'support-b', 'bolt', translate(-5, 8, 2));
  add('shaft-1', 'root', 'shaft');
  return { root_id: 'root', source: { units: 'mm', format: 'STEP' }, definitions, occurrences };
}

test('source definitions and repeated nested occurrences retain distinct identity', () => {
  const index = createAssemblyIndex(specimen());
  assert.equal(index.occurrenceIds.length, 10);
  assert.equal(index.leafIds.length, 7);
  assert.deepEqual(index.children('root'), ['support-a', 'support-b', 'shaft-1']);
  assert.deepEqual(index.children('support-b'), ['housing-b', 'bolt-b1', 'bolt-b2']);
  assert.equal(index.get('bolt-a1').definition_id, index.get('bolt-b1').definition_id);
  assert.notEqual(index.get('bolt-a1').occurrence_id, index.get('bolt-b1').occurrence_id);
  assert.notDeepEqual(index.get('bolt-a1').worldMatrixSource, index.get('bolt-b1').worldMatrixSource);
  assert.equal(index.definition('bolt').name, 'Socket screw');
  assert.deepEqual(index.ancestors('bolt-b2'), ['support-b', 'root']);
  assert.deepEqual(index.descendants('support-a'), ['housing-a', 'bolt-a1', 'bolt-a2']);
  assert.deepEqual(index.descendants('support-a', { includeSelf: true }), ['support-a', 'housing-a', 'bolt-a1', 'bolt-a2']);
  assert.deepEqual(index.leafDescendants('bolt-a1'), ['bolt-a1']);
});

test('column-major composition rotates child translations instead of adding positions', () => {
  const index = createAssemblyIndex(specimen());
  close(index.get('bolt-a1').worldMatrixSource.slice(12, 15), [52, 25, 32]);
  close(point(index.get('bolt-a1').worldMatrixSource, [1, 0, 0]), [52, 26, 32]);
  close(index.get('bolt-b1').worldMatrixSource.slice(12, 15), [-35, 28, 32]);
  close(multiplyMatrices(quarterTurn(10, 20, 30), translate(3, 4, 5)).slice(12, 15), [6, 23, 35]);
});

test('source-to-glTF conversion conjugates rotations and translations exactly once', () => {
  const converted = sourceToGltfMatrix(quarterTurn(10, 20, 30));
  close(converted, [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, .01, .03, -.02, 1]);
  const p = [7, 13, -5], sourceWorld = point(quarterTurn(10, 20, 30), p);
  close(point(converted, [.007, -.005, -.013]), [.001 * sourceWorld[0], .001 * sourceWorld[2], -.001 * sourceWorld[1]]);
  close(sourceToGltfMatrix(translate(1, 2, 3), { metersPerUnit: 1 }).slice(12, 15), [1, 3, -2]);
  for (const metersPerUnit of [0, -1, Infinity, NaN]) assert.throws(() => sourceToGltfMatrix(identity(), { metersPerUnit }), /metersPerUnit/);
});

test('index clones caller data and freezes all public source and lookup values', () => {
  const input = specimen(), index = createAssemblyIndex(input);
  input.occurrences[2].label = 'Changed outside';
  input.occurrences[2].localMatrixSource[12] = 123;
  assert.equal(index.get('housing-a').label, 'housing-a');
  assert.equal(index.get('housing-a').localMatrixSource[12], 0);
  assert.ok(Object.isFrozen(index.manifest));
  assert.ok(Object.isFrozen(index.get('housing-a').source));
  assert.throws(() => { index.get('bolt-a1').worldMatrixSource[12] = 123; }, TypeError);
  assert.throws(() => index.children('root').push('bad'), TypeError);
  assert.throws(() => index.leafDescendants('root').push('bad'), TypeError);
});

test('selection highlights a subtree while preserving each repeated occurrence ID', () => {
  const inspection = createAssemblyInspection(specimen());
  assert.equal(inspection.snapshot().selected_id, null);
  assert.deepEqual(inspection.select('support-a').highlighted_ids, ['housing-a', 'bolt-a1', 'bolt-a2']);
  assert.deepEqual(inspection.select('bolt-b2').highlighted_ids, ['bolt-b2']);
  assert.deepEqual(inspection.select(null).highlighted_ids, []);
  assert.throws(() => inspection.select('Socket screw'), /unknown occurrence_id/);
  assert.throws(() => inspection.isolate(), /select an occurrence/);
});

test('hiding an assembly and revealing one child does not reveal its sibling copies', () => {
  const inspection = createAssemblyInspection(specimen());
  let state = inspection.toggleHidden('support-a');
  assert.deepEqual(state.hidden_part_ids, ['housing-a', 'bolt-a1', 'bolt-a2']);
  assert.equal(state.visibility.root, 'partial');
  assert.equal(state.visibility['support-a'], 'hidden');
  state = inspection.setHidden('bolt-a1', false);
  assert.deepEqual(state.hidden_part_ids, ['housing-a', 'bolt-a2']);
  assert.equal(state.visibility['support-a'], 'partial');
  assert.ok(state.visible_ids.includes('support-a'));
  assert.ok(state.visible_part_ids.includes('bolt-b1'));
  state = inspection.toggleHidden('support-a');
  assert.equal(state.visibility['support-a'], 'hidden');
  state = inspection.toggleHidden('support-a');
  assert.equal(state.visibility['support-a'], 'visible');
  assert.deepEqual(state.hidden_part_ids, []);
});

test('isolation keeps selected subtree and its ancestors, without changing manual hides', () => {
  const inspection = createAssemblyInspection(specimen());
  inspection.setHidden('bolt-a2');
  inspection.select('support-a');
  let state = inspection.isolate();
  assert.equal(state.isolated_id, 'support-a');
  assert.deepEqual(state.visible_part_ids, ['housing-a', 'bolt-a1']);
  assert.deepEqual(state.visible_ids, ['root', 'support-a', 'housing-a', 'bolt-a1']);
  assert.deepEqual(state.hidden_part_ids, ['bolt-a2']);
  state = inspection.select('shaft-1');
  assert.equal(state.isolated_id, 'support-a', 'selection does not silently change isolation');
  state = inspection.clearIsolation();
  assert.ok(state.visible_part_ids.includes('shaft-1'));
  assert.ok(!state.visible_part_ids.includes('bolt-a2'));
  assert.deepEqual(inspection.isolate('bolt-b2').visible_ids, ['root', 'support-b', 'bolt-b2']);
});

test('restore and observation edits preserve source identity and engineering matrices', () => {
  const input = specimen(), before = structuredClone(input), inspection = createAssemblyInspection(input);
  const initial = inspection.snapshot();
  inspection.select('bolt-a1');
  inspection.setExplode(.75);
  inspection.setHidden('support-a');
  inspection.isolate('support-b');
  const restored = inspection.resetObservation();
  assert.equal(restored.selected_id, 'bolt-a1');
  assert.equal(restored.explode, 0);
  assert.equal(restored.isolated_id, null);
  assert.deepEqual(restored.hidden_part_ids, []);
  assert.deepEqual(restored.visible_part_ids, initial.visible_part_ids);
  assert.deepEqual(input, before);
  assert.deepEqual(inspection.index.manifest, before);
});

test('snapshots are immutable values, independent of later state changes', () => {
  const inspection = createAssemblyInspection(specimen()), before = inspection.select('bolt-a1');
  inspection.select('bolt-b1'); inspection.toggleHidden('bolt-a1');
  assert.equal(before.selected_id, 'bolt-a1');
  assert.deepEqual(before.hidden_part_ids, []);
  assert.throws(() => before.visible_part_ids.pop(), TypeError);
  assert.throws(() => { before.visibility.root = 'hidden'; }, TypeError);
  for (const progress of [-.1, 1.1, Infinity, NaN, '0.5']) assert.throws(() => inspection.setExplode(progress), /explode/);
  assert.throws(() => inspection.setHidden('bolt-a1', 1), /boolean/);
  assert.throws(() => inspection.toggleHidden('missing'), /unknown occurrence_id/);
});

const invalidCases = [
  ['duplicate definition', m => m.definitions.push({ ...m.definitions[0] }), /duplicate definition_id/],
  ['duplicate occurrence', m => m.occurrences.push(structuredClone(m.occurrences[2])), /duplicate occurrence_id/],
  ['missing definition', m => { m.occurrences[2].definition_id = 'missing'; }, /missing definition/],
  ['mismatching kind', m => { m.occurrences[2].kind = 'assembly'; }, /kind does not match/],
  ['missing parent', m => { m.occurrences[2].parent_id = 'missing'; }, /missing parent/],
  ['another root', m => { m.occurrences[2].parent_id = null; }, /missing parent/],
  ['part as parent', m => { m.occurrences[3].parent_id = 'housing-a'; }, /cannot parent/],
  ['missing root', m => { m.root_id = 'missing'; }, /root_id.*missing/],
  ['root parent', m => { m.occurrences[0].parent_id = 'support-a'; }, /root must have parent_id null/],
  ['disconnected cycle', m => { m.occurrences[1].parent_id = 'support-b'; m.occurrences[5].parent_id = 'support-a'; }, /cycle/],
  ['nonfinite matrix', m => { m.occurrences[2].worldMatrixSource[12] = NaN; }, /JSON-compatible|finite/],
  ['wrong matrix size', m => { m.occurrences[2].localMatrixSource.pop(); }, /16 finite/],
  ['projective matrix', m => { m.occurrences[2].localMatrixSource[3] = .5; }, /affine/],
  ['inconsistent world', m => { m.occurrences[3].worldMatrixSource[12] += .01; }, /parent world \* local/],
  ['undeclared units', m => { delete m.source.units; }, /source.units/],
  ['empty unit', m => { m.source.units = ''; }, /source.units/],
];
for (const [label, mutate, pattern] of invalidCases) {
  test(`invalid manifest rejects ${label}`, () => {
    const manifest = specimen(); mutate(manifest);
    assert.throws(() => createAssemblyIndex(manifest), pattern);
  });
}

test('source unit objects and importer metadata survive without inferring CAD semantics', () => {
  const manifest = specimen(); manifest.source.units = { length: 'mm', angle: 'rad' };
  manifest.source.importer = { name: 'Sample CAD backend', version: '1.0', limitations: ['no joint constraints'] };
  const index = createAssemblyIndex(manifest);
  assert.deepEqual(index.manifest.source, manifest.source);
  assert.equal(index.get('unknown'), undefined);
  assert.equal(index.definition('unknown'), undefined);
  assert.throws(() => index.children('unknown'), /unknown occurrence_id/);
  assert.throws(() => index.ancestors('unknown'), /unknown occurrence_id/);
});

function mixedSpecimen() {
  const manifest = specimen();
  manifest.definitions.find(definition => definition.definition_id === 'support').geometry = {
    triangleCount: 120,
    sourceMeaning: 'Body owned by the source assembly definition; not a fabricated child occurrence',
  };
  return manifest;
}

test('geometry-bearing assemblies keep source kinds while displaying their own bodies and real children', () => {
  const index = createAssemblyIndex(mixedSpecimen());
  assert.equal(index.leafIds.length, 7, 'literal source parts remain unchanged');
  assert.equal(index.displayIds.length, 9, 'two placed assembly bodies share one geometry definition');
  assert.equal(index.occurrenceIds.length, 10, 'geometry does not fabricate source child occurrences');
  assert.equal(index.get('support-a').kind, 'assembly');
  assert.equal(index.get('support-b').kind, 'assembly');
  assert.deepEqual(index.children('support-a'), ['housing-a', 'bolt-a1', 'bolt-a2']);
  assert.deepEqual(index.displayDescendants('support-a'), ['support-a', 'housing-a', 'bolt-a1', 'bolt-a2']);
  assert.deepEqual(index.leafDescendants('support-a'), ['housing-a', 'bolt-a1', 'bolt-a2']);
  assert.ok(Object.isFrozen(index.displayIds));
  assert.ok(Object.isFrozen(index.displayDescendants('support-a')));
  assert.throws(() => index.displayDescendants('missing'), /unknown occurrence_id/);
});

test('assembly selection and isolation include its own geometry and descendant display occurrences', () => {
  const inspection = createAssemblyInspection(mixedSpecimen());
  let state = inspection.select('support-a');
  assert.deepEqual(state.highlighted_ids, ['support-a', 'housing-a', 'bolt-a1', 'bolt-a2']);
  state = inspection.isolate();
  assert.deepEqual(state.visible_part_ids, ['support-a', 'housing-a', 'bolt-a1', 'bolt-a2']);
  assert.deepEqual(state.visible_ids, ['root', 'support-a', 'housing-a', 'bolt-a1', 'bolt-a2']);
  assert.equal(state.visibility['support-a'], 'visible');
  assert.equal(state.visibility.root, 'partial');
  assert.equal(state.visibility['support-b'], 'hidden');
});

test('revealing a child retains a hidden assembly body even though its tree node is visible', () => {
  const input = mixedSpecimen(), before = structuredClone(input), inspection = createAssemblyInspection(input);
  let state = inspection.toggleHidden('support-a');
  assert.deepEqual(state.hidden_part_ids, ['support-a', 'housing-a', 'bolt-a1', 'bolt-a2']);
  assert.equal(state.visibility['support-a'], 'hidden');
  state = inspection.setHidden('bolt-a1', false);
  assert.ok(state.visible_ids.includes('support-a'), 'ancestor tree path remains visible');
  assert.ok(!state.visible_part_ids.includes('support-a'), 'the own body remains hidden');
  assert.ok(state.hidden_part_ids.includes('support-a'));
  assert.equal(state.visibility['support-a'], 'partial');
  assert.equal(state.visibility['support-b'], 'visible');
  state = inspection.isolate('bolt-a1');
  assert.deepEqual(state.visible_part_ids, ['bolt-a1']);
  assert.deepEqual(state.visible_ids, ['root', 'support-a', 'bolt-a1']);
  assert.equal(state.visibility['support-a'], 'partial', 'an ancestor own body is not implicitly revealed');
  state = inspection.resetObservation();
  assert.deepEqual(state.visible_part_ids, inspection.index.displayIds);
  assert.equal(state.visibility.root, 'visible');
  assert.deepEqual(input, before);
  assert.deepEqual(inspection.index.manifest, before);
});

test('a source root assembly may own geometry without changing its identity or root placement', () => {
  const manifest = mixedSpecimen();
  manifest.definitions[0].geometry = { triangleCount: 8 };
  const inspection = createAssemblyInspection(manifest);
  assert.ok(inspection.index.displayIds.includes('root'));
  assert.ok(inspection.select('root').highlighted_ids.includes('root'));
  assert.equal(inspection.index.get('root').parent_id, null);
  assert.deepEqual(inspection.index.get('root').worldMatrixSource, manifest.occurrences[0].worldMatrixSource);
  assert.deepEqual(inspection.isolate('bolt-a1').visible_part_ids, ['bolt-a1']);
  assert.equal(inspection.snapshot().visibility.root, 'partial');
  for (const geometry of [null, [], false]) {
    const invalid = specimen(); invalid.definitions[0].geometry = geometry;
    assert.throws(() => createAssemblyIndex(invalid), /geometry must be an object/);
  }
});
