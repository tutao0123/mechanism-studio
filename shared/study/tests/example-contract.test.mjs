import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateStudyDefinition, prepareStudyExample } from '../example-contract.mjs';
import { createGearboxExample } from '../../../examples/gearbox/example.mjs';
import { createGripperExample } from '../../../examples/robotiq-gripper/example.mjs';
import { createGripperPresentation } from '../../../examples/robotiq-gripper/presentation.mjs';

const read = async path => JSON.parse(await readFile(new URL(`../../../${path}`, import.meta.url), 'utf8'));
const fixtures = await Promise.all([
  { id: 'gearbox', definition: createGearboxExample, sourceFile: 'assets/provenance.json' },
  { id: 'robotiq-gripper', definition: createGripperExample, sourceFile: 'source/provenance.json' },
].map(async fixture => ({ ...fixture, index: await read(`examples/${fixture.id}/assets/scene-index.json`), source: await read(`examples/${fixture.id}/${fixture.sourceFile}`) })));

test('actual example definitions compile once against the already-loaded index and source', () => {
  for (const fixture of fixtures) {
    const definition = fixture.definition(), originalFactory = definition.createPresentation;
    let calls = 0;
    definition.createPresentation = actual => { calls++; assert.equal(actual, fixture.index); return originalFactory(actual); };
    const recordsBefore = JSON.stringify({ index: fixture.index, source: fixture.source });
    const { config, presentation } = prepareStudyExample(definition, fixture.index, fixture.source);
    assert.equal(calls, 1, fixture.id);
    assert.equal(config.indexData, fixture.index);
    assert.equal(config.sourceData, fixture.source);
    assert.equal(config.timeline, presentation.timeline);
    assert.equal(config.annotations, presentation.annotations);
    assert.equal(config.createFraming(fixture.index), presentation.framing);
    assert.equal(config.createFraming(fixture.index), presentation.framing);
    assert.equal(calls, 1, 'repeated framing requests reuse the compiled binding');
    assert.throws(() => config.createFraming(structuredClone(fixture.index)), /same scene index/);
    assert.equal(JSON.stringify({ index: fixture.index, source: fixture.source }), recordsBefore);
    assert.equal(presentation.plan.geometryRevision, fixture.index.geometryRevision);
    assert.equal(config.workingPoses, presentation.workingPoses);
    assert.equal(config.assetUrl, definition.assetUrl);
    for (const field of ['id', 'globalName', 'eyebrow', 'figure', 'note', 'footer', 'createPresentation', 'rig', 'plan', 'framing']) {
      assert.equal(Object.hasOwn(config, field), false, `${field} belongs to bootstrap/presentation rather than player config`);
    }
  }
});

test('source identity and geometry revision failures stop preparation', () => {
  const fixture = fixtures[1], presentation = fixture.definition().createPresentation(fixture.index);
  const fixed = { ...fixture.definition(), createPresentation: () => presentation };
  assert.throws(() => prepareStudyExample(fixed, { ...fixture.index, geometryRevision: 'stale-geometry' }, fixture.source), /geometry revisions disagree/);
  assert.throws(() => prepareStudyExample(fixed, { ...fixture.index, parts: [...fixture.index.parts, fixture.index.parts[0]] }, fixture.source), /unique/);
  assert.throws(() => prepareStudyExample(fixed, { ...fixture.index, parts: [{ id: '' }] }, fixture.source), /nonempty/);
  assert.throws(() => prepareStudyExample(fixed, { ...fixture.index, parts: [] }, fixture.source), /versioned scene index/);
  assert.throws(() => prepareStudyExample(fixed, { ...fixture.index, geometryRevision: undefined }, fixture.source), /versioned scene index/);
  for (const source of [null, undefined, [], 'unbound']) assert.throws(() => prepareStudyExample(fixed, fixture.index, source), /provenance/);
});

test('definition resources are validated before loading or constructing a presentation', () => {
  for (const field of ['indexUrl', 'sourceUrl', 'assetUrl', 'contractUrl', 'scoreUrl', 'audioUrl']) {
    for (const url of ['https://example.com/asset.json', '//example.com/asset.json', 'assets/model.glb', '/assets/../secret', '/assets/%2e%2e/secret', '/assets/.hidden', '/assets/a\\b', '/assets/a%5Cb', '/assets/a?query=1', '/assets/a#fragment', '/assets/a%00b', '/assets/%ZZ']) {
      let called = false;
      const definition = { ...createGripperExample(), [field]: url, createPresentation() { called = true; } };
      assert.throws(() => prepareStudyExample(definition, fixtures[1].index, fixtures[1].source), /resource URL|preview routes/, `${field}=${url}`);
      assert.equal(called, false);
    }
  }
  const good = createGripperExample();
  assert.equal(validateStudyDefinition(good), good);
  for (const [field, value, error] of [['id', 'Upper_Case', /lowercase/], ['title', '', /nonempty/], ['sourceName', '', /nonempty/], ['globalName', 'window.x', /identifier/], ['cameraTransitionSeconds', -1, /nonnegative/], ['createPresentation', true, /createPresentation/]]) {
    assert.throws(() => validateStudyDefinition({ ...good, [field]: value }), error);
  }
});

test('incomplete timeline, annotation and camera adapters fail at the shared boundary', () => {
  const fixture = fixtures[1], presentation = fixture.definition().createPresentation(fixture.index);
  const prepare = alter => prepareStudyExample({ ...fixture.definition(), createPresentation: () => alter(presentation) }, fixture.index, fixture.source);
  for (const name of ['stateAt', 'normalizeTime', 'localDisplayOffsets']) {
    assert.throws(() => prepare(p => ({ ...p, timeline: { ...p.timeline, [name]: undefined } })), new RegExp(name));
  }
  assert.throws(() => prepare(p => ({ ...p, timeline: { ...p.timeline, BPM: p.timeline.BPM + 1 } })), /timing disagree/);
  assert.throws(() => prepare(p => ({ ...p, timeline: { ...p.timeline, DURATION: p.timeline.DURATION + 1 } })), /timing disagree/);
  assert.throws(() => prepare(p => ({ ...p, annotations: { ...p.annotations, annotationCues: true } })), /annotations/);
  assert.throws(() => prepare(p => ({ ...p, annotations: { annotationCues: p.annotations.annotationCues } })), /windows/);
  assert.throws(() => prepare(p => ({ ...p, annotations: { ...p.annotations, CUE_WINDOWS: { ...p.annotations.CUE_WINDOWS, detail: [] } } })), /windows/);
  assert.throws(() => prepare(p => ({ ...p, framing: { ...p.framing, cameraFor: null } })), /framing/);
});

test('uniform camera up from a compiled plan reaches the study constructor configuration', () => {
  const fixture = fixtures[1], plan = structuredClone(fixture.definition().createPresentation(fixture.index).plan);
  for (const camera of Object.values(plan.cameras)) camera.up = [1, 0, 0];
  const definition = { ...fixture.definition(), createPresentation: index => createGripperPresentation(index, { plan }) };
  const { presentation, config } = prepareStudyExample(definition, fixture.index, fixture.source);
  assert.deepEqual(config.cameraUp, [1, 0, 0]);
  assert.equal(config.cameraUp, presentation.timeline.cameraUp);
  assert.equal(Object.isFrozen(config.cameraUp), true);
});
