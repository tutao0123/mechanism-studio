import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Matrix4, OrthographicCamera, Quaternion, Vector3 } from 'three';
import { annotationCues, CUE_WINDOWS, SCENE_FADE_SECONDS, moveAnnotation, placeAnnotation } from '../annotations.mjs';
import { BPM, CHAPTERS, DURATION, MAXIMUM_OFFSETS, stateAt } from '../story.mjs';
import { createRobotFraming } from '../framing.mjs';
import { accessorValues, readGlb } from '../../shared/assets/glb.mjs';

const localState = (chapter, localTime) => stateAt(chapter.firstBeat * 60 / BPM + localTime);
const pointCloud = [
  { x: 180, y: 100, z: 0 }, { x: 200, y: 120, z: 0 },
  { x: 220, y: 100, z: 0 }, { x: 200, y: 80, z: 0 },
];
const fixture = { points: pointCloud, width: 400, height: 240, textWidth: 90, textHeight: 20 };
const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

function assertPlacement(result, input) {
  assert.ok(result, 'a readable near-part placement exists');
  const { rect, anchor, end } = result;
  assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= input.width && rect.y + rect.height <= input.height, 'text remains inside the viewport');
  assert.ok(input.points.some(point => point.x === anchor.x && point.y === anchor.y), 'the leader starts on an actual supplied projected point');
  assert.ok(result.leaderLength > 0 && result.leaderLength <= 30, `leader stays local, received ${result.leaderLength} px`);
  assert.ok(Math.abs(Math.hypot(end.x - anchor.x, end.y - anchor.y) - result.leaderLength) < 1e-9);
  assert.ok(!input.obstacles?.some(obstacle => overlap(rect, obstacle)), 'text avoids visible-link exclusion rectangles');
}

test('names enter sequentially, remain together until the scene exit, and only name stationary targets', () => {
  for (const chapter of CHAPTERS) {
    const windows = CUE_WINDOWS[chapter.id];
    assert.equal(windows.length, chapter.labels.length);
    const duration = (chapter.lastBeat - chapter.firstBeat) * 60 / BPM;
    let previousStart = -Infinity;
    for (const [index, [start, end]] of windows.entries()) {
      assert.ok(start > previousStart && end > start + SCENE_FADE_SECONDS, 'new names have separate entrances and reading time');
      assert.equal(end, duration, 'all names share the scene boundary');
      assert.deepEqual(annotationCues(localState(chapter, start + .001)).map(cue => cue.index), Array.from({ length: index + 1 }, (_, i) => i));
      previousStart = start;
    }
    const retained = annotationCues(localState(chapter, duration - SCENE_FADE_SECONDS - .01));
    assert.deepEqual(retained.map(cue => cue.id), chapter.labels.map(([id]) => id), 'both names remain during the reading hold');
    assert.ok(retained.every(cue => cue.opacity === 1));
    const nextScene = annotationCues(stateAt(chapter.lastBeat * 60 / BPM));
    assert.deepEqual(nextScene, [], 'the next scene does not inherit the previous names');
  }
  for (let time = 0; time < DURATION; time += .013) {
    const state = stateAt(time), cues = annotationCues(state);
    assert.ok(cues.length <= 2);
    for (const cue of cues) {
      assert.equal(cue.id, state.chapter.labels[cue.index][0]);
      const before = stateAt(time - .0001).offsetsWorld[cue.id];
      const after = stateAt(time + .0001).offsetsWorld[cue.id];
      assert.ok(before.every((value, axis) => Math.abs(value - after[axis]) < 1e-9), `${state.chapter.id}: ${cue.id} must be stationary while named`);
    }
  }
});

test('entrances are staggered, the scene fade is shared, and pauses never reveal unsettled cameras', () => {
  for (const chapter of CHAPTERS) for (const [index, [start, end]] of CUE_WINDOWS[chapter.id].entries()) {
    const entranceState = localState(chapter, start + .03);
    const entrance = annotationCues(entranceState).find(cue => cue.index === index);
    const middleState = localState(chapter, start + .3);
    const middle = annotationCues(middleState).find(cue => cue.index === index);
    const exit = annotationCues(localState(chapter, end - .03));
    assert.ok(entrance.opacity > 0 && entrance.opacity < 1);
    assert.equal(middle.opacity, 1);
    assert.equal(exit.length, chapter.labels.length);
    assert.ok(exit.every(cue => cue.opacity > 0 && cue.opacity < 1));
    assert.ok(exit.every(cue => Math.abs(cue.opacity - exit[0].opacity) < 1e-12), 'all visible names fade as one scene');
    assert.deepEqual(annotationCues(middleState, { cameraSettled: false }), []);
    assert.deepEqual(annotationCues(middleState, { paused: true, cameraSettled: false }), []);
    assert.deepEqual(annotationCues(localState(chapter, end + .000001), { paused: true }), []);
    assert.ok(annotationCues(entranceState, { paused: true }).every(cue => cue.opacity === 1));
    assert.ok(annotationCues(localState(chapter, end - .03), { paused: true }).every(cue => cue.opacity === 1), 'a paused scene remains readable even during its exit interval');
  }
});

test('cue evaluation is independent of playback order, loop count, and paused requests', () => {
  const times = [.6, 2.9, 5.6, 8.8, 14.8, 18.8, 23.2, 27.2, 31.2, DURATION - .01];
  const expected = times.map(time => annotationCues(stateAt(time)));
  for (let index = times.length - 1; index >= 0; index--) {
    annotationCues(stateAt(times[index] + 7), { paused: true });
    const state = stateAt(times[index]), before = JSON.stringify(state);
    assert.deepEqual(annotationCues(state), expected[index]);
    assert.equal(JSON.stringify(state), before, 'presentation cues do not mutate the assembly timeline');
    const periodic = annotationCues(stateAt(times[index] + DURATION * 3));
    assert.deepEqual(periodic.map(cue => cue.id), expected[index].map(cue => cue.id));
    periodic.forEach((cue, i) => assert.ok(Math.abs(cue.opacity - expected[index][i].opacity) < 1e-10));
  }
});

test('a retained layout follows its anchor without changing type size, side, or short clearance', () => {
  const original = placeAnnotation(fixture), before = JSON.stringify(original);
  for (const anchor of [{ x: original.anchor.x + 12, y: original.anchor.y - 7 }, original.anchor, { x: original.anchor.x - 4, y: original.anchor.y + 3 }]) {
    const moved = moveAnnotation(original, anchor);
    const dx = anchor.x - original.anchor.x, dy = anchor.y - original.anchor.y;
    assert.equal(moved.side, original.side);
    assert.equal(moved.rect.width, original.rect.width);
    assert.equal(moved.rect.height, original.rect.height);
    assert.equal(moved.text.anchor, original.text.anchor);
    assert.ok(Math.abs(moved.rect.x - original.rect.x - dx) < 1e-12);
    assert.ok(Math.abs(moved.rect.y - original.rect.y - dy) < 1e-12);
    assert.ok(Math.abs(moved.text.x - original.text.x - dx) < 1e-12);
    assert.ok(Math.abs(moved.text.y - original.text.y - dy) < 1e-12);
    assert.ok(Math.abs(Math.hypot(moved.end.x - moved.anchor.x, moved.end.y - moved.anchor.y) - original.leaderLength) < 1e-12);
    assert.deepEqual(moveAnnotation(original, anchor), moved, 'forward and backward queries do not accumulate screen drift');
  }
  assert.equal(JSON.stringify(original), before, 'the cached entry layout stays immutable');
});

test('near-part placements use actual projected points and stay short at both viewport sizes', () => {
  for (const input of [fixture, { ...fixture, width: 900, height: 600, textWidth: 140, textHeight: 24 }]) {
    const before = JSON.stringify(input);
    const result = placeAnnotation(input);
    assertPlacement(result, input);
    assert.deepEqual(placeAnnotation(input), result, 'placement has no history-dependent screen cache');
    assert.equal(JSON.stringify(input), before);
  }
  const changed = { ...fixture, preferredSide: 'left' };
  assertPlacement(placeAnnotation(changed), changed);
});

test('a blocked preferred side selects nearby free space instead of lengthening the leader', () => {
  const first = placeAnnotation(fixture);
  const obstacle = { x: first.rect.x - 2, y: 0, width: first.rect.width + 4, height: fixture.height };
  const input = { ...fixture, obstacles: [obstacle] };
  const alternative = placeAnnotation(input);
  assertPlacement(alternative, input);
  assert.notEqual(alternative.side, first.side);
});

test('unreadable, clipped, or completely obstructed targets hide rather than pinning to a screen edge', () => {
  for (const input of [
    { ...fixture, points: [] },
    { ...fixture, points: [{ x: -40, y: 100, z: 0 }, { x: -20, y: 110, z: 0 }] },
    { ...fixture, points: pointCloud.map(point => ({ ...point, z: 2 })) },
    { ...fixture, points: [{ x: NaN, y: 100, z: 0 }] },
    { ...fixture, textWidth: fixture.width * 2 },
    { ...fixture, width: 0 },
    { ...fixture, obstacles: [{ x: 0, y: 0, width: fixture.width, height: fixture.height }] },
  ]) assert.equal(placeAnnotation(input), null);
});

function nodeMatrix(node) {
  if (node.matrix) return new Matrix4().fromArray(node.matrix);
  return new Matrix4().compose(new Vector3(...(node.translation ?? [0, 0, 0])), new Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new Vector3(...(node.scale ?? [1, 1, 1])));
}

test('retained robot vertices support local reading labels in actual desktop and mobile camera plans', async t => {
  const sceneIndex = JSON.parse(await readFile(new URL('../planning/scene-index.json', import.meta.url), 'utf8'));
  const { json: gltf, buffer } = readGlb(await readFile(new URL('../assets/robot.glb', import.meta.url)));
  const matrices = new Map();
  function visit(nodeIndex, parent = new Matrix4()) {
    const matrix = parent.clone().multiply(nodeMatrix(gltf.nodes[nodeIndex]));
    matrices.set(nodeIndex, matrix);
    for (const child of gltf.nodes[nodeIndex].children ?? []) visit(child, matrix);
  }
  for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visit(root);
  const geometry = new Map(sceneIndex.parts.map(part => {
    const bodyIndex = part.displayBinding.ownedBodyNodeIndex, body = gltf.nodes[bodyIndex];
    const vertices = gltf.meshes[body.mesh].primitives.flatMap(primitive => accessorValues(gltf, buffer, primitive.attributes.POSITION));
    return [part.id, vertices.map(position => new Vector3(...position).applyMatrix4(matrices.get(bodyIndex)))];
  }));
  const framing = createRobotFraming(sceneIndex, MAXIMUM_OFFSETS);
  for (const [width, height] of [[1280, 640], [364, 410]]) {
    let placed = 0;
    const chapterCounts = new Map();
    for (const chapter of CHAPTERS) {
      const visibleIds = chapter.id === 'wrist' ? ['urdf:link4_1', 'urdf:link5_1', 'urdf:clamp1_1', 'urdf:clamp2_1']
        : chapter.id === 'grip' ? ['urdf:link5_1', 'urdf:clamp1_1', 'urdf:clamp2_1'] : [...geometry.keys()];
      const cached = [];
      function projection(localTime) {
        const state = localState(chapter, localTime), plan = framing.cameraFor(chapter.id, width / height, localTime);
        const camera = new OrthographicCamera(-plan.halfHeight * width / height, plan.halfHeight * width / height, plan.halfHeight, -plan.halfHeight, .00001, 1000);
        camera.position.fromArray(plan.position); camera.lookAt(new Vector3(...plan.target)); camera.updateMatrixWorld(true);
        const toScreen = vertex => {
          const point = vertex.clone().project(camera);
          return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2, z: point.z };
        };
        const projected = new Map(visibleIds.map(id => [id, geometry.get(id).map(vertex => toScreen(vertex.clone().add(new Vector3(...state.offsetsWorld[id]))))]));
        const endpointStates = [localState(chapter, 0), localState(chapter, (chapter.lastBeat - chapter.firstBeat) * 60 / BPM - .000001)];
        const exclusions = new Map(visibleIds.map(id => {
          const part = sceneIndex.parts.find(candidate => candidate.id === id), points = [];
          for (const endpoint of endpointStates) for (const x of [part.worldBounds.min[0], part.worldBounds.max[0]]) for (const y of [part.worldBounds.min[1], part.worldBounds.max[1]]) for (const z of [part.worldBounds.min[2], part.worldBounds.max[2]]) {
            points.push(toScreen(new Vector3(x, y, z).add(new Vector3(...endpoint.offsetsWorld[id]))));
          }
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const point of points) { minX = Math.min(minX, point.x); minY = Math.min(minY, point.y); maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y); }
          return [id, { x: minX, y: minY, width: maxX - minX, height: maxY - minY }];
        }));
        const retained = cached.map(record => moveAnnotation(record.layout, toScreen(record.worldAnchor)));
        return { state, projected, exclusions, retained };
      }
      for (const [index, [start]] of CUE_WINDOWS[chapter.id].entries()) {
        const { state, projected, exclusions, retained } = projection(start + .00001);
        const cue = annotationCues(state).find(candidate => candidate.index === index);
        assert.ok(cue);
        const obstacles = [...exclusions].filter(([id]) => id !== cue.id).map(([, rect]) => rect);
        obstacles.push(...retained.map(layout => layout.rect));
        const input = { points: projected.get(cue.id), width, height, textWidth: cue.text.length * (width < 540 ? 6 : 7), textHeight: width < 540 ? 20 : 24, obstacles, preferredSide: index ? 'right' : 'left' };
        const result = placeAnnotation(input);
        if (!result) continue; // A crowded mobile cue may be omitted instead of using a long leader.
        assertPlacement(result, input);
        const vertexIndex = input.points.findIndex(point => point.x === result.anchor.x && point.y === result.anchor.y);
        const worldAnchor = geometry.get(cue.id)[vertexIndex].clone().add(new Vector3(...state.offsetsWorld[cue.id]));
        cached.push({ layout: result, worldAnchor });
        placed++;
        chapterCounts.set(chapter.id, (chapterCounts.get(chapter.id) ?? 0) + 1);
      }
      // The retained names stay close and never resize while the 6% detail
      // pullback changes the projected geometry. Previous text is an exclusion
      // rectangle when the next cue is placed, so two names remain legible.
      for (const localTime of [2.95, 3.2, 3.5, 3.95, 4]) {
        const { retained } = projection(localTime);
        for (let i = 0; i < retained.length; i++) {
          const moved = retained[i], original = cached[i].layout;
          assert.equal(moved.side, original.side);
          assert.equal(moved.rect.width, original.rect.width);
          assert.equal(moved.rect.height, original.rect.height);
          assert.ok(moved.rect.x >= 0 && moved.rect.y >= 0 && moved.rect.x + moved.rect.width <= width && moved.rect.y + moved.rect.height <= height, `${width} px, ${chapter.id}: retained label stays onscreen`);
          assert.ok(Math.abs(Math.hypot(moved.end.x - moved.anchor.x, moved.end.y - moved.anchor.y) - original.leaderLength) < 1e-9);
          for (let j = i + 1; j < retained.length; j++) assert.ok(!overlap(moved.rect, retained[j].rect), `${width} px, ${chapter.id}: retained labels do not overlap during the pullback`);
        }
      }
    }
    t.diagnostic(`${width} px retained label counts: ${JSON.stringify(Object.fromEntries(chapterCounts))}`);
    assert.ok(placed >= 6, `${width} px: actual geometry allows at least half of the sequential labels (${placed}/12)`);
    for (const chapter of ['wrist', 'grip']) assert.equal(chapterCounts.get(chapter), 2, `${width} px: both retained names in ${chapter} are readable`);
  }
});
