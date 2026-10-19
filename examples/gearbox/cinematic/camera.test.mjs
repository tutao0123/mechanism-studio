import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraAt } from './camera.mjs';
import { DURATION, FPS, SHOTS } from './timeline.mjs';

const subtract = (a, b) => a.map((value, i) => value - b[i]);
const length = vector => Math.hypot(...vector);
const components = camera => [...camera.position, ...camera.target, camera.fov];
const direction = camera => {
  const vector = subtract(camera.target, camera.position), distance = length(vector);
  return vector.map(value => value / distance);
};
const near = (a, b, tolerance) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);

test('all 720 render poses have a finite, nondegenerate perspective view', () => {
  for (let frame = 0; frame < DURATION * FPS; frame++) {
    const camera = cameraAt(frame / FPS);
    assert.equal(camera.position.length, 3);
    assert.equal(camera.target.length, 3);
    assert.ok(components(camera).every(Number.isFinite), `finite camera at frame ${frame}`);
    const distance = length(subtract(camera.target, camera.position));
    assert.ok(distance > .25 && distance < 1.5, `working distance ${distance} at frame ${frame}`);
    assert.ok(camera.fov > 25 && camera.fov < 45, `controlled lens at frame ${frame}`);
    assert.ok(Math.abs(direction(camera)[1]) < .9, `view direction stays away from the +Y up-vector singularity at frame ${frame}`);
  }
});

test('native 30 fps samples avoid one-frame camera, target, and lens jumps', () => {
  let previous = cameraAt(0), previousVelocity = null;
  for (let frame = 1; frame <= DURATION * FPS; frame++) {
    const camera = cameraAt(frame / FPS), step = subtract(camera.position, previous.position);
    const previousDirection = direction(previous), currentDirection = direction(camera);
    const dot = currentDirection.reduce((sum, value, i) => sum + value * previousDirection[i], 0);
    const turnDegrees = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
    // Limits apply to the authored metre-scale asset and the delivery frame
    // rate. They catch a snap/cut without requiring a particular camera pose.
    assert.ok(length(step) < .02, `camera step at frame ${frame}`);
    assert.ok(length(subtract(camera.target, previous.target)) < .005, `target step at frame ${frame}`);
    assert.ok(turnDegrees < .75, `orientation step ${turnDegrees} degrees at frame ${frame}`);
    assert.ok(Math.abs(camera.fov - previous.fov) < .25, `lens step at frame ${frame}`);
    const velocity = step.map(value => value * FPS);
    if (previousVelocity) assert.ok(length(subtract(velocity, previousVelocity)) < .04, `velocity jump at frame ${frame}`);
    previousVelocity = velocity;
    previous = camera;
  }
});

test('story transitions preserve position and velocity through the camera path', () => {
  const epsilon = 1e-5;
  // Include story boundaries plus a dense grid across the whole shot. The
  // camera is allowed to move through editorial cuts, but never to snap.
  const probes = new Set([
    ...SHOTS.slice(1).map(shot => shot.start),
    ...Array.from({ length: DURATION * 100 - 1 }, (_, i) => (i + 1) / 100),
  ]);
  for (const time of probes) {
    const before = components(cameraAt(time - epsilon)), at = components(cameraAt(time)), after = components(cameraAt(time + epsilon));
    for (let i = 0; i < at.length; i++) {
      const arriving = (at[i] - before[i]) / epsilon;
      const leaving = (after[i] - at[i]) / epsilon;
      near(arriving, leaving, i === 6 ? .001 : .0001);
    }
  }
});

test('the loop returns to the same pose and zero endpoint velocity', () => {
  const epsilon = 1e-5;
  const first = components(cameraAt(0)), last = components(cameraAt(DURATION));
  const justAfter = components(cameraAt(epsilon)), justBefore = components(cameraAt(DURATION - epsilon));
  for (let i = 0; i < first.length; i++) {
    near(last[i], first[i], 1e-12);
    const outgoing = (justAfter[i] - first[i]) / epsilon;
    const incoming = (last[i] - justBefore[i]) / epsilon;
    near(outgoing, 0, 1e-4);
    near(incoming, 0, 1e-4);
    near(incoming, outgoing, 1e-4);
  }
});

test('invalid camera timestamps fail explicitly instead of producing bad render matrices', () => {
  for (const time of [-1, DURATION + .001, NaN, Infinity, -Infinity, undefined, '1']) {
    assert.throws(() => cameraAt(time), RangeError);
  }
});
