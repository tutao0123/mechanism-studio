/** Ideal radial rolling bearings: alpha = 0, rigid circular races, no slip.
 * Angles are absolute in the housing frame, positive about +Z. This is an
 * explicitly authored relationship, not a recovered CAD mate or load solver.
 * Source and frame derivation: planning/mechanics-evidence.md.
 */
import { SUPPORT_BEARINGS } from './spec.mjs';

export const BEARING_KINEMATICS_REVISION = 'planetary-radial-no-slip-1';
const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
};
const bearingFor = side => {
  if (!Object.hasOwn(SUPPORT_BEARINGS, side)) throw new TypeError(`Unknown support bearing: ${side}`);
  return SUPPORT_BEARINGS[side];
};

/** The same linear equations accept angular positions or rates. Do not use
 * the conventional relative-to-cage ball-spin frequency as a world spin. */
export function bearingMotionState(side, innerAngle = 0, outerAngle = 0) {
  const bearing = bearingFor(side), R = bearing.pitch, r = bearing.ballRadius;
  finite(innerAngle, 'Inner-race angle'); finite(outerAngle, 'Outer-race angle');
  const cagePerInner = (R - r) / (2 * R), cagePerOuter = (R + r) / (2 * R);
  const worldSpinPerInner = -(R - r) / (2 * r), worldSpinPerOuter = (R + r) / (2 * r);
  const cageAngle = cagePerInner * innerAngle + cagePerOuter * outerAngle;
  const ballSpinAngle = worldSpinPerInner * innerAngle + worldSpinPerOuter * outerAngle;
  return { side, contactAngle: 0, pitchRadius: R, ballRadius: r, balls: bearing.balls,
    innerAngle, outerAngle, cageAngle, ballSpinAngle,
    ballRelativeCageAngle: ballSpinAngle - cageAngle,
    cagePerInner, cagePerOuter, worldSpinPerInner, worldSpinPerOuter,
    innerContactRadius: R - r, outerContactRadius: R + r };
}

/** Ideal tangent contact velocities in m/s. Both race interfaces must agree
 * independently; a correct cage rate alone is insufficient. */
export function bearingVelocityResiduals(side, innerOmega = 1, outerOmega = 0) {
  const state = bearingMotionState(side, innerOmega, outerOmega);
  const centreSpeed = state.pitchRadius * state.cageAngle;
  const ballInnerSpeed = centreSpeed - state.ballRadius * state.ballSpinAngle;
  const ballOuterSpeed = centreSpeed + state.ballRadius * state.ballSpinAngle;
  const innerRaceSpeed = state.innerContactRadius * innerOmega;
  const outerRaceSpeed = state.outerContactRadius * outerOmega;
  return { inner: ballInnerSpeed - innerRaceSpeed, outer: ballOuterSpeed - outerRaceSpeed,
    centreSpeed, ballInnerSpeed, ballOuterSpeed, innerRaceSpeed, outerRaceSpeed };
}

/** Absolute phase of one actual ball occurrence, retaining its original ID. */
export function bearingBallPose(side, ballIndex, innerAngle = 0, outerAngle = 0) {
  const bearing = bearingFor(side), state = bearingMotionState(side, innerAngle, outerAngle);
  if (!Number.isInteger(ballIndex) || ballIndex < 0 || ballIndex >= bearing.balls) throw new TypeError('Ball index is outside the authored bearing.');
  const orbitAngle = 2 * Math.PI * ballIndex / bearing.balls + state.cageAngle;
  return { orbitAngle, spinAngle: state.ballSpinAngle,
    centre: [bearing.pitch * Math.cos(orbitAngle), bearing.pitch * Math.sin(orbitAngle), bearing.z] };
}
