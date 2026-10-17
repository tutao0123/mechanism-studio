import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, OrthographicCamera, Vector3 } from 'three';
import { createRobotFraming, PULLBACK, pullbackScale } from '../framing.mjs';
import { BPM, MAXIMUM_OFFSETS, stateAt } from '../story.mjs';
import { CUE_WINDOWS, NAME_FADE_SECONDS } from '../annotations.mjs';

const ASPECTS = [.55, 1, 1.78, 2.4];
const CHAPTERS = ['whole', 'structure', 'wrist', 'grip', 'return', 'resolve'];
const names = ['base_link', 'link1_1', 'link2_1', 'link3_1', 'link4_1', 'link5_1', 'clamp1_1', 'clamp2_1'];

function fixture() {
  const parts = names.map((name, index) => {
    // Asymmetric world AABBs stand in for geometry whose URDF parent rotations
    // and translations do not commute. The helper must consume these world
    // bounds directly, rather than add parent centers or reapply transforms.
    const center = [.028 * Math.sin(index * 1.1), index * .021, .017 * Math.cos(index * .9)];
    const size = [.012 + index * .002, .016 + (index % 3) * .009, .009 + (7 - index) * .003];
    return {
      id: `urdf:${name}`,
      worldCenter: center,
      worldBounds: { min: center.map((value, axis) => value - size[axis]), max: center.map((value, axis) => value + size[axis]) },
    };
  });
  const maximumOffsets = Object.fromEntries(parts.map((part, index) => [part.id, [(index - 3) * .018, index * .011, index % 2 ? .065 : -.045]]));
  return { sceneIndex: { geometryRevision: 'test-asymmetric-world-bounds', parts }, maximumOffsets };
}

function points(bounds) {
  return [bounds.min.x ?? bounds.min[0], bounds.max.x ?? bounds.max[0]].flatMap(x =>
    [bounds.min.y ?? bounds.min[1], bounds.max.y ?? bounds.max[1]].flatMap(y =>
      [bounds.min.z ?? bounds.min[2], bounds.max.z ?? bounds.max[2]].map(z => new Vector3(x, y, z))));
}

function camera(plan, aspect) {
  const result = new OrthographicCamera(-plan.halfHeight * aspect, plan.halfHeight * aspect, plan.halfHeight, -plan.halfHeight, .00001, 1000);
  result.position.fromArray(plan.position);
  result.up.set(0, 1, 0);
  result.lookAt(new Vector3(...plan.target));
  result.updateMatrixWorld(true);
  return result;
}

function assertFits(point, plan, aspect, message) {
  const projected = point.clone().project(camera(plan, aspect));
  assert.ok(Math.abs(projected.x) <= .760000001, `${message}: horizontal annotation margin lost (${projected.x})`);
  assert.ok(Math.abs(projected.y) <= .860000001, `${message}: vertical headroom lost (${projected.y})`);
  assert.ok(projected.z >= -1 && projected.z <= 1, `${message}: point outside camera depth`);
}

function verifyEnvelopes(framing) {
  for (const aspect of ASPECTS) for (const chapter of CHAPTERS) for (const localTime of [0, 2.95, 3.25, 3.65, 3.95, 4.1]) {
    const plan = framing.cameraFor(chapter, aspect, localTime);
    assert.ok(plan.halfHeight > 0 && Number.isFinite(plan.halfHeight));
    for (const point of points(framing.envelopes[chapter])) assertFits(point, plan, aspect, `${chapter}, aspect ${aspect}`);
  }
}

test('detail pullback is a bounded monotonic C2 move with a readable hold at each end', () => {
  for (const chapter of CHAPTERS) {
    const scales = Array.from({ length: 81 }, (_, i) => pullbackScale(chapter, i * .06));
    for (let i = 1; i < scales.length; i++) {
      assert.ok(scales[i] >= scales[i - 1] - 1e-12);
      assert.ok(scales[i] >= 1 && scales[i] <= 1.06 + 1e-12);
    }
    if (!PULLBACK.chapters.includes(chapter)) {
      assert.ok(scales.every(scale => scale === 1), `${chapter}: non-detail chapters stay fixed`);
      continue;
    }
    const secondNameFullyVisible = CUE_WINDOWS[chapter][1][0] + NAME_FADE_SECONDS;
    assert.ok(PULLBACK.startSeconds - secondNameFullyVisible >= .9, 'the final name gets independent reading time before the camera moves');
    assert.equal(pullbackScale(chapter, PULLBACK.startSeconds), 1);
    assert.equal(pullbackScale(chapter, PULLBACK.endSeconds), 1.06);
    assert.equal(pullbackScale(chapter, PULLBACK.startSeconds - .1), 1);
    assert.equal(pullbackScale(chapter, PULLBACK.endSeconds + .1), 1.06);
    assert.ok(Math.abs(pullbackScale(chapter, (PULLBACK.startSeconds + PULLBACK.endSeconds) / 2) - 1.03) < 1e-12);
    const h = 1e-4;
    for (const edge of [PULLBACK.startSeconds, PULLBACK.endSeconds]) {
      const left = pullbackScale(chapter, edge - h), at = pullbackScale(chapter, edge), right = pullbackScale(chapter, edge + h);
      assert.ok(Math.abs((right - left) / (2 * h)) < 1e-6, 'velocity reaches zero at the hold');
      assert.ok(Math.abs((right - 2 * at + left) / h ** 2) < .001, 'acceleration reaches zero at the hold');
    }
  }
  for (const invalid of [-.01, NaN, Infinity]) assert.throws(() => pullbackScale('wrist', invalid), /finite and non-negative/);
});

test('pullback changes only orthographic scale and cannot change the looping opening pose', () => {
  const { sceneIndex, maximumOffsets } = fixture();
  const framing = createRobotFraming(sceneIndex, maximumOffsets);
  for (const chapter of CHAPTERS) for (const aspect of ASPECTS) {
    const entry = framing.cameraFor(chapter, aspect, 0), exit = framing.cameraFor(chapter, aspect, 4.1);
    assert.deepEqual(exit.position, entry.position, 'camera direction and position remain fixed');
    assert.deepEqual(exit.target, entry.target, 'the source-derived target remains fixed');
    const expected = PULLBACK.chapters.includes(chapter) ? 1.06 : 1;
    assert.ok(Math.abs(exit.halfHeight / entry.halfHeight - expected) < 1e-12);
  }
  assert.deepEqual(framing.cameraFor('whole', 1.78, 0), framing.cameraFor('resolve', 1.78, 4.2), 'last and first framing still join exactly');
});

test('fixed robot plans fit every envelope corner with annotation margins at narrow and wide aspects', () => {
  const { sceneIndex, maximumOffsets } = fixture();
  const framing = createRobotFraming(sceneIndex, maximumOffsets);
  verifyEnvelopes(framing);
  assert.deepEqual(framing.cameraFor('whole', 1.78), framing.cameraFor('resolve', 1.78));
  assert.deepEqual(framing.cameraFor('structure', 1.78), framing.cameraFor('return', 1.78));
  assert.ok(framing.envelopes.wrist.getSize(new Vector3()).length() < framing.envelopes.structure.getSize(new Vector3()).length());
});

test('full expanded plan bounds every independently staggered intermediate part corner', () => {
  const { sceneIndex, maximumOffsets } = fixture();
  const framing = createRobotFraming(sceneIndex, new Map(Object.entries(maximumOffsets)));
  let state = 0x274de49;
  const random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 0x100000000; };
  for (let sample = 0; sample < 60; sample++) for (const part of sceneIndex.parts) {
    const progress = sample === 0 ? 0 : sample === 1 ? 1 : random();
    const offset = new Vector3(...maximumOffsets[part.id]).multiplyScalar(progress);
    for (const point of points(part.worldBounds)) {
      point.add(offset);
      assert.ok(framing.envelopes.structure.containsPoint(point));
      for (const aspect of ASPECTS) assertFits(point, framing.cameraFor('structure', aspect), aspect, `${part.id}, progress ${progress}`);
    }
  }
});

test('framing reads immutable source values and does not depend on exposed bounds or caller pose mutation', () => {
  const { sceneIndex, maximumOffsets } = fixture();
  const before = JSON.stringify({ sceneIndex, maximumOffsets });
  const framing = createRobotFraming(sceneIndex, maximumOffsets);
  const first = framing.cameraFor('whole', .55);
  assert.equal(JSON.stringify({ sceneIndex, maximumOffsets }), before);
  framing.envelopes.whole.expandByScalar(100);
  const returned = framing.cameraFor('whole', .55);
  returned.position[0] += 100;
  returned.target[1] -= 100;
  sceneIndex.parts[0].worldBounds.min[0] = -999;
  maximumOffsets['urdf:link4_1'][0] = 999;
  assert.deepEqual(framing.cameraFor('whole', .55), first);
  assert.deepEqual(framing.cameraFor('resolve', .55), first);
});

test('retained asset bounds are included without altering the original source index', () => {
  const { sceneIndex, maximumOffsets } = fixture();
  sceneIndex.assetBounds = { min: [-.2, -.08, -.09], max: [.17, .22, .11] };
  const before = JSON.stringify(sceneIndex);
  const framing = createRobotFraming(sceneIndex, maximumOffsets);
  for (const point of points(sceneIndex.assetBounds)) assert.ok(framing.envelopes.whole.containsPoint(point));
  assert.equal(JSON.stringify(sceneIndex), before);
  verifyEnvelopes(framing);
});

test('invalid bounds, unresolved offsets, missing detail identities and invalid camera requests fail explicitly', () => {
  const { sceneIndex, maximumOffsets } = fixture();
  assert.throws(() => createRobotFraming({ parts: [] }), /actual part bounds/);
  assert.throws(() => createRobotFraming({ ...sceneIndex, units: 'mm' }), /display-metre bounds/);
  assert.throws(() => createRobotFraming(sceneIndex, { 'unknown-part': [0, 0, 1] }), /unknown robot part/);
  const invalid = structuredClone(sceneIndex);
  invalid.parts[0].worldBounds.min[0] = Infinity;
  assert.throws(() => createRobotFraming(invalid), /finite three-component/);
  const reversed = structuredClone(sceneIndex);
  reversed.parts[0].worldBounds.min[0] = 999;
  assert.throws(() => createRobotFraming(reversed), /reversed bounds/);
  assert.throws(() => createRobotFraming({ parts: sceneIndex.parts.slice(0, 6) }), /missing a bound detail part/);
  const framing = createRobotFraming(sceneIndex, maximumOffsets);
  assert.throws(() => framing.cameraFor('whole', 0), /finite positive/);
  assert.throws(() => framing.cameraFor('whole', NaN), /finite positive/);
  assert.throws(() => framing.cameraFor('wrist', 1.78, -1), /finite and non-negative/);
  assert.throws(() => framing.cameraFor('wrist', 1.78, Infinity), /finite and non-negative/);
  assert.throws(() => framing.cameraFor('invented', 1.78), /Unknown robot camera chapter/);
});

test('actual robot detail frames cover the full-expansion states shown by the story without unused rest-space', async () => {
  const sceneIndex = JSON.parse(await readFile(new URL('../planning/scene-index.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(sceneIndex);
  const framing = createRobotFraming(sceneIndex, MAXIMUM_OFFSETS);
  verifyEnvelopes(framing);
  assert.equal(framing.geometryRevision, sceneIndex.geometryRevision);
  assert.deepEqual(framing.cameraFor('whole', 1.78), framing.cameraFor('resolve', 1.78));
  // The detail chapters isolate these own bodies, already fully expanded. Do
  // not pull their targets back towards an assembled state that is not shown.
  for (const chapter of ['wrist', 'grip']) {
    const targetNames = chapter === 'wrist' ? ['link4_1', 'link5_1', 'clamp1_1', 'clamp2_1'] : ['link5_1', 'clamp1_1', 'clamp2_1'];
    const expected = new Box3(), swept = new Box3();
    const parts = sceneIndex.parts.filter(part => targetNames.includes(part.name));
    assert.equal(parts.length, targetNames.length);
    for (const part of parts) for (const point of points(part.worldBounds)) {
      swept.expandByPoint(point);
      point.add(new Vector3(...MAXIMUM_OFFSETS[part.id]));
      expected.expandByPoint(point);
      swept.expandByPoint(point);
    }
    assert.deepEqual(framing.envelopes[chapter], expected);
    assert.ok(expected.getSize(new Vector3()).length() < swept.getSize(new Vector3()).length());
    const beats = chapter === 'wrist' ? [24.001, 26, 29, 31.999] : [32.001, 34, 37, 39.999];
    for (const beat of beats) {
      const state = stateAt(beat * 60 / BPM);
      assert.equal(state.chapter.id, chapter);
      for (const part of parts) {
        assert.deepEqual(state.offsetsWorld[part.id], MAXIMUM_OFFSETS[part.id]);
        for (const point of points(part.worldBounds)) {
          point.add(new Vector3(...state.offsetsWorld[part.id]));
          assert.ok(framing.envelopes[chapter].containsPoint(point));
          for (const aspect of ASPECTS) assertFits(point, framing.cameraFor(chapter, aspect, state.localTime), aspect, `${chapter}: ${part.id}, beat ${beat}`);
        }
      }
    }
  }
  for (const point of points(sceneIndex.asset.assembledWorldBounds)) assert.ok(framing.envelopes.whole.containsPoint(point));
  assert.equal(JSON.stringify(sceneIndex), before);
});
