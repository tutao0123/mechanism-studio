import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { SUPPORT_BEARINGS } from '../spec.mjs';
import { createPlanetaryRig, motionState } from '../kinematics.mjs';
import { bearingMotionState, bearingBallPose, bearingVelocityResiduals } from '../bearing-kinematics.mjs';

const index = JSON.parse(await readFile(new URL('../assets/scene-index.json', import.meta.url), 'utf8'));
const rig = createPlanetaryRig(index), TAU = 2 * Math.PI;
const near = (a, b, epsilon = 1e-11) => assert.ok(Math.abs(a - b) < epsilon, `${a} vs ${b}`);

test('two declared radial bearings use their actual authored pitch and ball dimensions', () => {
  const front = bearingMotionState('front', 1), rear = bearingMotionState('rear', 1);
  near(front.pitchRadius, .011); near(front.ballRadius, .0021);
  near(rear.pitchRadius, .014); near(rear.ballRadius, .0025);
  for (const s of [front, rear]) { assert.equal(s.contactAngle, 0); assert.equal(s.balls, 10); }
  near(front.cageAngle, 89 / 220); near(front.ballSpinAngle, -89 / 42);
  near(rear.cageAngle, 23 / 56); near(rear.ballSpinAngle, -23 / 10);
  near(motionState(1).bearings.rear.cageAngle, 23 / 224);
  near(motionState(1).bearings.rear.ballSpinAngle, -23 / 40);
});

test('both independent contact velocities vanish for forward, reverse and co-rotating races', () => {
  for (const side of ['front', 'rear']) for (const inner of [-13.7, -.2, 0, 1, 19]) for (const outer of [-8.1, 0, .7, inner]) {
    const v = bearingVelocityResiduals(side, inner, outer), s = bearingMotionState(side, inner, outer);
    near(v.inner, 0); near(v.outer, 0);
    // Rigid co-rotation is a strong frame test: the ball world spin must equal
    // the common race rate, while its cage-relative spin becomes zero.
    if (inner === outer) { near(s.cageAngle, inner); near(s.ballSpinAngle, inner); near(s.ballRelativeCageAngle, 0); }
  }
});

test('conventional ball-spin frequency is cage-relative and is not applied as world rotation', () => {
  for (const side of ['front', 'rear']) {
    const s = bearingMotionState(side, 1), ratio = s.ballRadius / s.pitchRadius;
    near(s.ballRelativeCageAngle, -.5 * (1 / ratio - ratio));
    near(s.ballSpinAngle, s.ballRelativeCageAngle + s.cageAngle);
    const incorrectOuterVelocity = s.pitchRadius * s.cageAngle + s.ballRadius * s.ballRelativeCageAngle;
    assert.ok(Math.abs(incorrectOuterVelocity) > .0008, 'Using BSF as the world spin must fail the outer contact check.');
  }
});

test('all twenty identified balls stay in the same cage pockets through drive, reversal and seeking', () => {
  for (const angle of [0, 4, -.7, 23.8, 4, 0, -17.1]) {
    const world = rig.worldMatrices(angle), state = motionState(angle);
    for (const [side, b] of Object.entries(SUPPORT_BEARINGS)) {
      const cageInverse = world.get(`pg:support-bearing-${side}-cage`).clone().invert();
      for (let k = 0; k < b.balls; k++) {
        const id = `pg:support-bearing-${side}-ball-${k + 1}`;
        const centre = new Vector3().setFromMatrixPosition(world.get(id));
        near(Math.hypot(centre.x, centre.y), b.pitch); near(centre.z, b.z);
        const pocket = centre.clone().applyMatrix4(cageInverse), phase = TAU * k / b.balls;
        near(pocket.x, b.pitch * Math.cos(phase)); near(pocket.y, b.pitch * Math.sin(phase)); near(pocket.z, 0);
        const pose = bearingBallPose(side, k, state.bearings[side].innerAngle);
        assert.ok(centre.distanceTo(new Vector3(...pose.centre)) < 1e-12);
      }
    }
  }
});

test('actual sphere and race material-point velocities agree at both ideal contacts', () => {
  const derivative = (id, materialPoint, angle) => {
    const h = 1e-5;
    return materialPoint.clone().applyMatrix4(rig.worldMatrices(angle + h).get(id))
      .sub(materialPoint.clone().applyMatrix4(rig.worldMatrices(angle - h).get(id))).multiplyScalar(1 / (2 * h));
  };
  for (const angle of [0, .31, -4.7, 19]) {
    const world = rig.worldMatrices(angle);
    for (const [side, b] of Object.entries(SUPPORT_BEARINGS)) for (let k = 0; k < b.balls; k++) {
      const ballId = `pg:support-bearing-${side}-ball-${k + 1}`;
      const centre = new Vector3().setFromMatrixPosition(world.get(ballId));
      const radial = new Vector3(centre.x, centre.y, 0).normalize();
      for (const [element, sign] of [['inner', -1], ['outer', 1]]) {
        const raceId = `pg:support-bearing-${side}-${element}`, contact = centre.clone().addScaledVector(radial, sign * b.ballRadius);
        const ballMaterial = contact.clone().applyMatrix4(world.get(ballId).clone().invert());
        const raceMaterial = contact.clone().applyMatrix4(world.get(raceId).clone().invert());
        assert.ok(derivative(ballId, ballMaterial, angle).distanceTo(derivative(raceId, raceMaterial, angle)) < 2e-10, `${ballId} ${element}`);
      }
    }
  }
});

test('absolute-angle evaluation is deterministic and retains distinct individual phases across a gear cycle', () => {
  const previous = rig.workingPoses({ sunAngle: .791 });
  rig.workingPoses({ sunAngle: -110 }); rig.workingPoses({ sunAngle: 89 });
  assert.deepEqual(rig.workingPoses({ sunAngle: .791 }), previous);
  near(bearingMotionState('front', 4 * TAU).cageAngle / TAU, 89 / 55);
  near(bearingMotionState('rear', TAU).cageAngle / TAU, 23 / 56);
  for (const side of ['front', 'rear']) {
    const a = motionState(4 * TAU).bearings[side];
    assert.ok(Math.abs(Math.sin(a.cageAngle / 2)) > .8, `${side} rolling internals do not close at the gear-loop boundary.`);
  }
});

test('unsupported bearing identities, indexes and non-finite angles are rejected', () => {
  for (const side of ['missing', '', null]) assert.throws(() => bearingMotionState(side, 0));
  for (const angle of [NaN, Infinity, -Infinity, '1']) {
    assert.throws(() => bearingMotionState('front', angle));
    assert.throws(() => bearingMotionState('front', 0, angle));
  }
  for (const k of [-1, 10, 1.1, NaN]) assert.throws(() => bearingBallPose('front', k));
});
