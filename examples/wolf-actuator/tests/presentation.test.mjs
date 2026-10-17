import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { Matrix4, OrthographicCamera, Vector3 } from 'three';
import { sourceToGltfMatrix } from '../../../shared/cad/assembly.mjs';
import { sampleColorAccents } from '../../../shared/appearance/color-accents.mjs';
import { createWolfStory, SOURCE_SHA256, localDisplayOffsets } from '../story.mjs';
import { createWolfAnnotations, SCENE_FADE_SECONDS } from '../annotations.mjs';
import { CAMERA_UP, createWolfFraming } from '../framing.mjs';
import { createWolfServer, publicFile } from '../serve.mjs';

const readJson = async name => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
let actualIndex = null;
try { actualIndex = await readJson('../assets/scene-index.json'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
// This fallback tests algorithms and pinned identity only, never a display or
// engineering result. Nested leaf boxes are deliberately synthetic unit fixtures.
async function identityFixture() {
  const graph = await readJson('../source/xcaf-graph-probe.json'), top = await readJson('../source/xcaf-top-level-bounds.json');
  const actualBounds = new Map(top.rows.map(row => [row.id, row]));
  const rows = graph.occurrences.map((row, i) => {
    const diagnostic = actualBounds.get(row.occurrence_id);
    return { id: row.occurrence_id, name: row.name, parentId: row.parent_id,
      worldBounds: diagnostic?.worldBounds ?? { min: [-.06, .005, -.06], max: [.06, .025, .06] },
      worldCenter: diagnostic?.worldCenter ?? [0, .015, 0],
      worldMatrix: sourceToGltfMatrix(row.worldMatrixMm), localMatrix: sourceToGltfMatrix(row.localMatrixMm), source: row.source, sourceKind: row.kind };
  });
  return { sourceSHA256: SOURCE_SHA256, geometryRevision: 'synthetic-algorithm-fixture-only', units: 'm', parts: rows.filter(row => row.sourceKind === 'part'), assemblies: rows.filter(row => row.sourceKind === 'assembly'), asset: { assembledWorldBounds: { min: [-.081, -.025, -.081], max: [.081, .05, .081] } } };
}
const index = actualIndex ?? await identityFixture(), story = createWolfStory(index), annotations = createWolfAnnotations(story);
const seconds = beat => beat * 60 / story.BPM;
const localState = (chapter, time) => story.stateAt(seconds(chapter.firstBeat) + time);

test('source-bound WOLF story retains 245 distinct leaves, exact named gears and disjoint ancestry groups', t => {
  t.diagnostic(actualIndex ? 'Testing the delivered actual CAD mesh index.' : 'Testing actual pinned XCAF identity with explicitly synthetic nested bounds; no delivered geometry claimed.');
  assert.equal(index.parts.length, 245); assert.equal(index.assemblies.length, 8);
  const before = JSON.stringify(index), known = new Set(index.parts.map(part => part.id));
  assert.equal(story.bindings.planets.length, 12); assert.equal(new Set(story.bindings.planets).size, 12);
  assert.deepEqual(story.GROUPS.map(group => group.ids.length), [4, 140, 2, 13]);
  const moved = story.GROUPS.flatMap(group => group.ids);
  assert.equal(new Set(moved).size, moved.length); assert.ok(moved.every(id => known.has(id)));
  assert.deepEqual(Object.keys(story.MAXIMUM_OFFSETS).sort(), [...known].sort());
  assert.deepEqual(story.MAXIMUM_OFFSETS[story.bindings.shaft], [0, 0, 0]);
  assert.deepEqual(story.MAXIMUM_OFFSETS[story.bindings.mount], [0, 0, 0]);
  assert.equal(JSON.stringify(index), before);
  const invalid = structuredClone(index); invalid.parts = invalid.parts.filter(part => part.name !== 'planet-12');
  assert.throws(() => createWolfStory(invalid), /planet-12/);
  assert.throws(() => createWolfStory({ ...index, sourceSHA256: 'modified' }), /digest/);
});

test('four two-beat actions use one 64-beat loop, reverse reassembly and no accumulated source motion', () => {
  assert.equal(story.DURATION, 34.285714285714285);
  assert.deepEqual(story.GROUPS.map(group => [group.outBeat, group.inBeat]), [[8, 52], [12, 48], [16, 44], [20, 40]]);
  const rest = story.stateAt(0), full = story.stateAt(seconds(24));
  assert.ok(Object.values(full.progress).every(value => value === 1));
  assert.deepEqual(story.stateAt(story.DURATION), rest);
  assert.ok(Object.values(story.stateAt(seconds(56)).offsetsWorld).every(offset => offset.every(value => value === 0)));
  for (const time of [0, 5.1, 13.4, 19.9, 26.3, 33.4, 5.1, 0]) {
    const result = story.stateAt(time); story.stateAt(time + 9.3);
    assert.deepEqual(story.stateAt(time), result);
    assert.deepEqual(Object.keys(result.offsetsWorld).sort(), index.parts.map(part => part.id).sort());
  }
});

test('nonmesh rotated/scaled parent matrices preserve physical translation length without source writes', () => {
  const matrix = new Matrix4().makeRotationZ(.71).scale(new Vector3(1.7, .6, 2.2)).setPosition(8, 4, 2);
  const fixture = { parts: [{ id: 'leaf', parentId: 'subassembly' }], assemblies: [{ id: 'subassembly', parentId: null, worldMatrix: matrix.toArray() }] };
  const before = JSON.stringify(fixture), world = { leaf: [.012, -.035, .046] };
  const local = localDisplayOffsets(fixture, world, Matrix4, Vector3).get('leaf');
  const restored = new Vector3(...local).applyMatrix4(matrix).sub(new Vector3().applyMatrix4(matrix));
  assert.ok(restored.distanceTo(new Vector3(...world.leaf)) < 1e-12);
  assert.equal(JSON.stringify(fixture), before);
  assert.throws(() => localDisplayOffsets({ ...fixture, assemblies: [] }, world, Matrix4, Vector3), /parent/);
  const actualOffsets = localDisplayOffsets(index, story.stateAt(seconds(24)).offsetsWorld, Matrix4, Vector3);
  assert.equal(actualOffsets.size, index.parts.length);
});

test('named targets finish moving before reading, retain sequential names and fade with their colour cues', () => {
  for (const chapter of story.CHAPTERS) {
    const windows = annotations.CUE_WINDOWS[chapter.id];
    assert.equal(windows.length, 2);
    for (const [i, [start, end]] of windows.entries()) {
      const cues = annotations.annotationCues(localState(chapter, start + .2));
      assert.deepEqual(cues.map(cue => cue.index), Array.from({ length: i + 1 }, (_, j) => j));
      const ids = index.parts.map(part => part.id);
      const colors = sampleColorAccents(ids, cues.map(cue => ({ id: cue.id, weight: cue.opacity })));
      assert.deepEqual([...colors].filter(([, sample]) => sample.weight > 0).map(([id]) => id).sort(), cues.map(cue => cue.id).sort());
      const fading = annotations.annotationCues(localState(chapter, end - SCENE_FADE_SECONDS / 2));
      assert.equal(fading.length, 2); assert.ok(fading.every(cue => Math.abs(cue.opacity - .5) < 1e-9));
    }
    assert.deepEqual(annotations.annotationCues(story.stateAt(seconds(chapter.lastBeat))), []);
  }
  for (let time = 0; time < story.DURATION; time += .031) {
    const state = story.stateAt(time);
    for (const cue of annotations.annotationCues(state)) {
      const before = story.stateAt(time - .00001).offsetsWorld[cue.id], after = story.stateAt(time + .00001).offsetsWorld[cue.id];
      assert.ok(before.every((value, i) => Math.abs(value - after[i]) < 1e-10), `${state.chapter.id}: ${cue.id} remains stationary while named`);
    }
  }
});

test('actual-bound fixed envelopes cover moving part corners at narrow and wide aspects and restore the opening camera', () => {
  const framing = createWolfFraming(index, story), before = JSON.stringify(index);
  for (const aspect of [364 / 410, 16 / 9, 2.5]) {
    assert.deepEqual(framing.cameraFor('whole', aspect), framing.cameraFor('resolve', aspect));
    for (let beat = 0; beat < 64; beat += .37) {
      const state = story.stateAt(seconds(beat)), pose = framing.cameraFor(state.chapter.id, aspect, state.localTime);
      const camera = new OrthographicCamera(-pose.halfHeight * aspect, pose.halfHeight * aspect, pose.halfHeight, -pose.halfHeight, .0001, 1000);
      camera.up.fromArray(CAMERA_UP);
      camera.position.fromArray(pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld(true);
      const visible = story.detailIds(state);
      for (const part of index.parts) {
        if (visible && !visible.includes(part.id)) continue;
        for (const x of [part.worldBounds.min[0], part.worldBounds.max[0]]) for (const y of [part.worldBounds.min[1], part.worldBounds.max[1]]) for (const z of [part.worldBounds.min[2], part.worldBounds.max[2]]) {
          const p = new Vector3(x, y, z).add(new Vector3(...state.offsetsWorld[part.id])).project(camera);
          assert.ok(Math.abs(p.x) <= .740001 && Math.abs(p.y) <= .840001 && Math.abs(p.z) <= 1, `${state.chapter.id}: ${part.id} remains inside its fixed envelope`);
        }
      }
    }
  }
  assert.equal(JSON.stringify(index), before);
});

test('WOLF preview serves shared runtime and exact license while rejecting source CAD, tools, caches and writes', async () => {
  const server = createWolfServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/', '/app.mjs', '/story.mjs', '/framing.mjs', '/annotations.mjs', '/shared/study/study.mjs', '/shared/study/shell.mjs', '/shared/study/style.css', '/shared/viewer/annotation-layout.mjs', '/shared/appearance/color-accents.mjs', '/source/provenance.json', '/source/LICENSE', '/source/NOTICE.md']) assert.equal((await fetch(base + path)).status, 200, path);
    for (const path of ['/source/assembly.step', '/source/xcaf-graph-probe.json', '/audio/build.mjs', '/planning/build-plans.mjs', '/output/frames/00000.jpg', '/.cache/a', '/shared/study/README.md', '/tools/cad/import-assembly.mjs']) { assert.equal(publicFile(path), null); assert.equal((await fetch(base + path)).status, 403); }
    assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
  } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
});

test('bound audio and authoring handoffs match delivered source identity and editorial actions', { skip: !actualIndex && 'Actual imported CAD index is not yet available.' }, async () => {
  const plans = Object.fromEntries(await Promise.all(['explosion-plan', 'camera-plan', 'annotation-plan', 'appearance-plan', 'timeline'].map(async name => [name, await readJson(`../planning/${name}.json`)])));
  const score = await readJson('../audio/music-score.json');
  for (const plan of Object.values(plans)) { assert.equal(plan.geometryRevision, index.geometryRevision); assert.equal(plan.sourceSHA256, index.sourceSHA256); }
  assert.deepEqual(plans['explosion-plan'].groups, story.GROUPS);
  assert.deepEqual(plans['explosion-plan'].maximumOffsets, story.MAXIMUM_OFFSETS);
  assert.deepEqual(plans['camera-plan'].cameraUp, CAMERA_UP);
  assert.equal(plans.timeline.music.sha256, score.sha256); assert.equal(score.durationSeconds, story.DURATION);
  assert.equal(JSON.stringify(score).includes('urdf:'), false);
  for (const cue of score.effects.actionCues) {
    const group = story.GROUPS.find(group => group.id === cue.animation.groupId); assert.ok(group);
    assert.deepEqual(cue.animation.partIds, group.ids);
    assert.equal(cue.animation.firstBeat, cue.animation.phase === 'explode' ? group.outBeat : group.inBeat);
  }
});
