import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createCameraDirector } from '../camera-director.mjs';

const whole = { position: [3, 2, 4], target: [0, 0, 0], halfHeight: 1 };
const detail = { position: [.4, .8, 2], target: [.1, .2, .3], halfHeight: .2 };
const sample = (director, key, time, pose, extra = {}) => director.sample({ chapterKey: key, localTime: time, pose, ...extra });
const near = (a, b, tolerance = 1e-12) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const distance = pose => new Vector3(...pose.position).distanceTo(new Vector3(...pose.target));

test('opening and reset(null) return exactly the planned pose without a fabricated previous chapter', () => {
  const director = createCameraDirector();
  assert.deepEqual(sample(director, 'overview', 0, whole), whole);
  const moving = { ...whole, position: [3.1, 2, 4] };
  assert.deepEqual(sample(director, 'overview', .2, moving), moving);
  director.reset();
  assert.deepEqual(sample(director, 'intake', 7, detail), detail);
  assert.equal(director.snapshot().transitioning, false);
});

test('a chapter transition captures the last returned pose once and reaches its destination exactly', () => {
  const director = createCameraDirector({ duration: 2.4 });
  sample(director, 'overview', 12, whole);
  assert.deepEqual(sample(director, 'intake', .3, detail), whole);
  const middle = sample(director, 'intake', 1.5, detail);
  near(middle.halfHeight, Math.sqrt(whole.halfHeight * detail.halfHeight));
  assert.deepEqual(sample(director, 'intake', 2.7, detail), detail);
  assert.deepEqual(sample(director, 'intake', 5, detail), detail);
  assert.equal(director.snapshot().startLocalTime, .3);
  assert.equal(director.snapshot().transitioning, false);
});

test('adjacent transitions start from the actual camera returned during the previous blend', () => {
  const director = createCameraDirector({ duration: 2 });
  sample(director, 'overview', 0, whole); sample(director, 'intake', 0, detail);
  const previous = sample(director, 'intake', 1, detail);
  const third = { position: [-2, 3, 1], target: [1, 0, 0], halfHeight: .5 };
  assert.deepEqual(sample(director, 'compression', .1, third), previous);
  assert.deepEqual(sample(director, 'compression', 2.1, third), third);
});

test('paused samples and same-chapter replay use local time rather than sampling frequency', () => {
  const director = createCameraDirector({ duration: 2 });
  sample(director, 'overview', 0, whole); sample(director, 'intake', .2, detail);
  const paused = sample(director, 'intake', 1.1, detail), state = director.snapshot();
  for (let i = 0; i < 8; i += 1) assert.deepEqual(sample(director, 'intake', 1.1, detail), paused);
  assert.deepEqual(director.snapshot(), state);
  sample(director, 'intake', 4, detail);
  assert.deepEqual(sample(director, 'intake', 1.1, detail), paused);
});

test('explicit cuts snap on the same frame and cancel pending transitions', () => {
  const director = createCameraDirector();
  sample(director, 'overview', 0, whole); sample(director, 'intake', 0, detail);
  assert.deepEqual(sample(director, 'intake', .5, detail, { cut: true }), detail);
  assert.equal(director.snapshot().transitioning, false);
  assert.deepEqual(sample(director, 'overview', 0, whole, { cut: true }), whole);
  assert.deepEqual(sample(director, 'overview', .1, whole), whole);
});

test('manual orbit resume starts at the actual user camera and smoothly returns to the current chapter', () => {
  const director = createCameraDirector({ duration: 2 });
  sample(director, 'intake', 5, detail);
  const orbit = { position: [-4, 3, 2], target: [.2, 0, 0], halfHeight: 1.4 };
  director.reset(orbit); assert.equal(director.snapshot().pendingResume, true);
  assert.deepEqual(sample(director, 'intake', 5.2, detail), orbit);
  const middle = sample(director, 'intake', 6.2, detail);
  assert.notDeepEqual(middle, orbit); assert.notDeepEqual(middle, detail);
  assert.deepEqual(sample(director, 'intake', 7.2, detail), detail);
  assert.equal(director.snapshot().pendingResume, false);
});

test('opposite views follow a deterministic shortest arc without passing through their target', () => {
  const director = createCameraDirector({ duration: 2 });
  const front = { position: [0, 0, 2], target: [0, 0, 0], halfHeight: 1 };
  const back = { position: [0, 0, -8], target: [0, 0, 0], halfHeight: 4 };
  sample(director, 'front', 0, front); sample(director, 'back', 0, back);
  const middle = sample(director, 'back', 1, back);
  near(distance(middle), 4); near(middle.halfHeight, 2); near(middle.position[2], 0);
  assert.deepEqual(sample(director, 'back', 1, back), middle);
  assert.deepEqual(sample(director, 'back', 2, back), back);
});

test('quintic easing slows both ends while moving target and zoom retain meaningful scales', () => {
  const director = createCameraDirector({ duration: 10 });
  sample(director, 'wide', 0, whole); sample(director, 'detail', 0, detail);
  const beginning = sample(director, 'detail', 1, detail), middle = sample(director, 'detail', 5, detail), ending = sample(director, 'detail', 9, detail);
  near(middle.target[0], .05); near(middle.target[1], .1); near(middle.target[2], .15);
  assert.ok(beginning.halfHeight > .9); assert.ok(ending.halfHeight < .21);
  assert.ok(distance(beginning) > distance(middle) && distance(middle) > distance(ending));
});

test('poses, sampled results and snapshots do not share mutable arrays with the caller', () => {
  const director = createCameraDirector(), input = structuredClone(whole), original = structuredClone(input);
  const output = sample(director, 'overview', 0, input); assert.deepEqual(input, original);
  output.position[0] = 999; input.target[0] = 888;
  assert.deepEqual(director.snapshot().lastPose, original);
  const snapshot = director.snapshot(); snapshot.lastPose.position[0] = 777;
  assert.deepEqual(director.snapshot().lastPose, original);
  const orbit = structuredClone(detail); director.reset(orbit); orbit.position[0] = 999;
  assert.deepEqual(sample(director, 'intake', 4, detail), detail);
});

test('invalid time, camera geometry and duration reject before changing the camera state', () => {
  for (const duration of [-1, NaN, Infinity]) assert.throws(() => createCameraDirector({ duration }), /duration/);
  const director = createCameraDirector(); sample(director, 'overview', 0, whole); const state = director.snapshot();
  for (const pose of [{ ...whole, halfHeight: 0 }, { ...whole, halfHeight: Infinity }, { ...whole, position: [1, 2] }, { ...whole, position: new Array(3) }, { ...whole, target: [0, NaN, 0] }, { ...whole, position: whole.target }]) {
    assert.throws(() => sample(director, 'next', 0, pose)); assert.deepEqual(director.snapshot(), state);
    assert.throws(() => director.reset(pose)); assert.deepEqual(director.snapshot(), state);
  }
  for (const time of [-1, NaN, Infinity]) assert.throws(() => sample(director, 'next', time, detail), /localTime/);
  assert.throws(() => sample(director, '', 0, detail), /chapterKey/);
  assert.throws(() => sample(director, 'next', 0, detail, { cut: 1 }), /boolean/);
  const immediate = createCameraDirector({ duration: 0 }); sample(immediate, 'a', 0, whole);
  assert.deepEqual(sample(immediate, 'b', 0, detail), detail);
});
