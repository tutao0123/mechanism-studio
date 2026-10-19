import test from 'node:test';
import assert from 'node:assert/strict';
import { DURATION, FPS, SOURCE_DURATION, SOURCE_TIME_KNOTS, SOURCE_EVENTS, SHOTS, sourceTimeAt, remapVelocityAt, cinematicTimeAt, shotAt, eventTimes } from './timeline.mjs';
import { createDrive, TRAIN } from '../kinematics.mjs';
import { SCHEDULE } from '../story.mjs';
import { TEETH, SPLINE_TEETH } from '../spec.mjs';

const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);

test('the 24-second remap preserves complete source order with positive bounded velocity', () => {
  let previous = -1;
  for (let i = 0; i < 24000; i++) {
    const time = i / 1000, source = sourceTimeAt(time), velocity = remapVelocityAt(time);
    assert.ok(source > previous && source >= 0 && source < SOURCE_DURATION);
    assert.ok(velocity > 0 && velocity < 2.7);
    previous = source;
  }
  for (const point of SOURCE_TIME_KNOTS.slice(0, -1)) near(sourceTimeAt(point.time), point.source);
  near(cinematicTimeAt(SOURCE_DURATION), DURATION);
});

test('all moving gears use exactly 1.5x, with continuous entry and exit tangents', () => {
  for (let time = 8; time <= 21.125; time += .001) {
    near(sourceTimeAt(time), 13.75 + (time - 8) * 1.5);
    near(remapVelocityAt(time), 1.5);
  }
  for (const time of [8, 21.125]) {
    near(remapVelocityAt(time - 1e-7), 1.5, 1e-6);
    near(remapVelocityAt(time + 1e-7), 1.5, 1e-6);
  }
});

test('every mechanical audio event uses the inverse source map', () => {
  for (const [id, source] of Object.entries(SOURCE_EVENTS)) {
    near(eventTimes[id], cinematicTimeAt(source));
    if (source !== SOURCE_DURATION) near(sourceTimeAt(eventTimes[id]), source);
  }
  assert.ok(eventTimes.caseLiftStart < eventTimes.caseOpen);
  assert.ok(eventTimes.fullyExploded < eventTimes.returnStart);
  assert.ok(eventTimes.dogEngagementStart < eventTimes.fourthEngaged);
  assert.ok(eventTimes.stopped < eventTimes.caseCloseStart && eventTimes.caseClosed < DURATION);
});

test('shots are contiguous and playback resets exactly at the loop seam', () => {
  assert.equal(SHOTS[0].start, 0);
  assert.equal(SHOTS.at(-1).end, DURATION);
  for (let i = 0; i < SHOTS.length; i++) {
    const shot = SHOTS[i];
    if (i) assert.equal(SHOTS[i - 1].end, shot.start);
    assert.equal(shotAt(shot.start).shot, shot);
    assert.equal(shotAt(shot.start).progress, 0);
    assert.equal(shotAt((shot.start + shot.end) / 2).index, i);
  }
  assert.equal(sourceTimeAt(24), 0);
  assert.equal(sourceTimeAt(48), 0);
  near(sourceTimeAt(-.01), sourceTimeAt(23.99));
  near(sourceTimeAt(24 - 1e-7), 40, 2e-7);
  assert.equal(shotAt(24).shot.id, 'hero');
  near(remapVelocityAt(24 - 1e-7), remapVelocityAt(0), 1e-6);
  assert.throws(() => sourceTimeAt(NaN), TypeError);
  assert.throws(() => cinematicTimeAt(41), RangeError);
});

test('actual remapped gear and spline angles remain below reversal aliasing at 30 fps', () => {
  const drive = createDrive(SCHEDULE, SOURCE_DURATION);
  const toothed = [['input', TEETH.input], ['counter', Math.max(TEETH.counterDrive, TEETH.counter1, TEETH.counter2, TEETH.counter3, TEETH.counter5, TEETH.counterR)],
    ['main1', TEETH.main1], ['main2', TEETH.main2], ['main3', TEETH.main3], ['main5', TEETH.main5], ['mainR', TEETH.mainR], ['idler', TEETH.idler]];
  let maximumPitch = 0;
  for (let frame = 1; frame < DURATION * FPS; frame++) {
    const previous = drive.stateAt(sourceTimeAt((frame - 1) / FPS));
    const next = drive.stateAt(sourceTimeAt(frame / FPS));
    const inputRevs = Math.abs(next.thetaIn - previous.thetaIn) / (2 * Math.PI);
    const outputRevs = Math.abs(next.thetaOut - previous.thetaOut) / (2 * Math.PI);
    maximumPitch = Math.max(maximumPitch, outputRevs * SPLINE_TEETH, ...toothed.map(([member, teeth]) => inputRevs * Math.abs(TRAIN[member]) * teeth));
  }
  assert.ok(maximumPitch < .35, `maximum tooth advance ${maximumPitch} pitches per frame`);
  assert.ok(maximumPitch > .25, 'motion remains visible');
});
