/** One ideal common-clock model: motor -> 4:1 reducer -> robot-link flange.
 * Poses act on rest-relative model wrappers; presentation offsets stay separate.
 */
import { Box3, Matrix4, Vector3 } from 'three';
import { GEOMETRY_REVISION, ROOT_ID, GEAR_SPEC, PARTS, PLANET_ANGLES, LIMITATIONS, SUPPORT_BEARINGS } from './spec.mjs';
export const KINEMATICS_REVISION = 'robot-joint-ideal-epicyclic-and-rolling-1';
const TAU = Math.PI * 2, { sunTeeth: ZS, planetTeeth: ZP, ringTeeth: ZR, orbitRadius: A } = GEAR_SPEC;
const finite = (value, label = 'Motor angle') => {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`); return value;
};
const angleOf = value => finite(typeof value === 'number' ? value : value?.sunAngle);
const rotate = ([x, y, z], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const neutral = () => ({ position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] });
const corners = b => [b.min[0], b.max[0]].flatMap(x => [b.min[1], b.max[1]].flatMap(y => [b.min[2], b.max[2]].map(z => new Vector3(x, y, z))));
function bearingFor(side) {
  if (!Object.hasOwn(SUPPORT_BEARINGS, side)) throw new TypeError(`Unknown bearing: ${side}`);
  return SUPPORT_BEARINGS[side];
}
export function bearingMotionState(side, innerAngle = 0, outerAngle = 0) {
  const b = bearingFor(side), R = b.pitch, r = b.ballRadius;
  finite(innerAngle, 'Inner angle'); finite(outerAngle, 'Outer angle');
  const cagePerInner = (R - r) / (2 * R), cagePerOuter = (R + r) / (2 * R);
  const worldSpinPerInner = -(R - r) / (2 * r), worldSpinPerOuter = (R + r) / (2 * r);
  const cageAngle = cagePerInner * innerAngle + cagePerOuter * outerAngle;
  const ballSpinAngle = worldSpinPerInner * innerAngle + worldSpinPerOuter * outerAngle;
  return { side, contactAngle: 0, pitchRadius: R, ballRadius: r, balls: b.balls,
    innerAngle, outerAngle, cageAngle, ballSpinAngle, ballRelativeCageAngle: ballSpinAngle - cageAngle,
    cagePerInner, cagePerOuter, worldSpinPerInner, worldSpinPerOuter,
    innerContactRadius: R - r, outerContactRadius: R + r };
}
export function bearingVelocityResiduals(side, innerOmega = 1, outerOmega = 0) {
  const s = bearingMotionState(side, innerOmega, outerOmega), centreSpeed = s.pitchRadius * s.cageAngle;
  const ballInnerSpeed = centreSpeed - s.ballRadius * s.ballSpinAngle, ballOuterSpeed = centreSpeed + s.ballRadius * s.ballSpinAngle;
  return { inner: ballInnerSpeed - s.innerContactRadius * innerOmega, outer: ballOuterSpeed - s.outerContactRadius * outerOmega };
}
export function bearingBallPose(side, ballIndex, innerAngle = 0, outerAngle = 0) {
  const b = bearingFor(side), s = bearingMotionState(side, innerAngle, outerAngle);
  if (!Number.isInteger(ballIndex) || ballIndex < 0 || ballIndex >= b.balls) throw new TypeError('Ball index outside this bearing.');
  const orbitAngle = TAU * ballIndex / b.balls + s.cageAngle;
  return { orbitAngle, spinAngle: s.ballSpinAngle, centre: [b.pitch * Math.cos(orbitAngle), b.pitch * Math.sin(orbitAngle), b.z] };
}
export function motionState(sunAngle = 0) {
  finite(sunAngle);
  const carrierAngle = sunAngle * ZS / (ZS + ZR), planetRelativeCarrier = -(ZS / ZP) * (sunAngle - carrierAngle);
  const planetAngle = carrierAngle + planetRelativeCarrier;
  return { sunAngle, motorAngle: sunAngle, outputAngle: carrierAngle, ringAngle: 0, carrierAngle, planetAngle, planetRelativeCarrier,
    reduction: (ZS + ZR) / ZS,
    bearings: { front: bearingMotionState('front', sunAngle), rear: bearingMotionState('rear', carrierAngle) },
    planets: PLANET_ANGLES.map((a, i) => ({ id: `rj:planet-${i + 1}`, orbitAngle: a + carrierAngle,
      center: [A * Math.cos(a + carrierAngle), A * Math.sin(a + carrierAngle), 0],
      spinAngle: planetAngle, toothPhase: GEAR_SPEC.planetPhase + planetAngle })) };
}
export function meshPhaseErrors(sunAngle = 0) {
  const s = motionState(sunAngle), thetaS = GEAR_SPEC.sunPhase + s.sunAngle, thetaP = GEAR_SPEC.planetPhase + s.planetAngle;
  const thetaR = GEAR_SPEC.ringGapPhase - Math.PI / ZR;
  return s.planets.map(p => ({ id: p.id,
    external: wrap(ZS * (p.orbitAngle - thetaS) + ZP * (p.orbitAngle + Math.PI - thetaP) - Math.PI),
    internal: wrap(ZR * (p.orbitAngle - thetaR) - ZP * (p.orbitAngle - thetaP) - Math.PI) }));
}
export function pitchVelocityResiduals(sunOmega = 1) {
  const s = motionState(sunOmega), rs = GEAR_SPEC.module * ZS / 2, rp = GEAR_SPEC.module * ZP / 2;
  return { external: s.sunAngle * rs - (s.carrierAngle * A - s.planetAngle * rp), internal: s.carrierAngle * A + s.planetAngle * rp };
}
export function createJointRig(index) {
  if (index?.units !== 'm' || index.rootId !== ROOT_ID || !Array.isArray(index.parts) || index.parts.length !== PARTS.length)
    throw new Error('Expected the complete authored robot joint assembly in metres.');
  if (typeof index.geometryRevision !== 'string' || !index.geometryRevision.startsWith(`${GEOMETRY_REVISION}-`) || index.source?.specRevision !== GEOMETRY_REVISION)
    throw new Error('Robot-joint geometry revision does not match its specification.');
  if (Object.entries(GEAR_SPEC).some(([key, value]) => !Number.isFinite(index.gearSpec?.[key]) || Math.abs(index.gearSpec[key] - value) > 1e-12))
    throw new Error('Robot-joint gear parameters differ from the authored design.');
  for (const [side, bearing] of Object.entries(SUPPORT_BEARINGS)) if (Object.entries(bearing).some(([key, value]) => !Number.isFinite(index.supportBearingSpec?.[side]?.[key]) || Math.abs(index.supportBearingSpec[side][key] - value) > 1e-12))
    throw new Error(`Robot-joint ${side} bearing differs from the authored design.`);
  const byId = new Map(index.parts.map(p => [p.id, p]));
  if (byId.size !== PARTS.length) throw new Error('Repeated occurrence IDs in robot joint.');
  const rest = new Map(), bounds = new Map();
  for (const spec of PARTS) {
    const p = byId.get(spec.id), expected = new Matrix4().makeRotationZ(spec.restAngle || 0).setPosition(...spec.translation).toArray();
    if (!p || p.definitionId !== spec.definitionId || p.parentId !== spec.parentId || p.motionRole !== spec.motionRole || p.ballIndex !== spec.ballIndex || p.supportSide !== spec.supportSide || p.planetIndex !== spec.planetIndex)
      throw new Error(`Robot-joint occurrence metadata differs: ${spec.id}`);
    if (!Array.isArray(p.worldMatrix) || p.worldMatrix.length !== 16 || p.worldMatrix.some((v, i) => !Number.isFinite(v) || Math.abs(v - expected[i]) > 1e-12))
      throw new Error(`Robot-joint rest transform differs: ${spec.id}`);
    if (!p.worldBounds || ['min', 'max'].some(key => !Array.isArray(p.worldBounds[key]) || p.worldBounds[key].length !== 3 || !p.worldBounds[key].every(Number.isFinite)))
      throw new Error(`Robot-joint bounds missing: ${spec.id}`);
    rest.set(spec.id, new Matrix4().fromArray(p.worldMatrix)); bounds.set(spec.id, p.worldBounds);
  }
  function memberAngle(p, s) {
    return p.motionRole === 'bearing-cage' ? s.bearings[p.supportSide].cageAngle
      : p.motionRole === 'bearing-ball' ? s.bearings[p.supportSide].ballSpinAngle
        : p.motionRole === 'sun' ? s.sunAngle : p.motionRole === 'planet' ? s.planetAngle : p.motionRole === 'carrier' ? s.carrierAngle : 0;
  }
  function centreFor(p, s) {
    if (p.motionRole === 'bearing-ball') return bearingBallPose(p.supportSide, p.ballIndex, s.bearings[p.supportSide].innerAngle).centre;
    return ['planet', 'carrier'].includes(p.motionRole) ? rotate(p.translation, s.carrierAngle) : [...p.translation];
  }
  function posesForAngle(value = 0) {
    const s = motionState(angleOf(value)), result = {};
    for (const p of PARTS) {
      if (s.sunAngle === 0 || p.motionRole === 'fixed') { result[p.id] = neutral(); continue; }
      const a = memberAngle(p, s), c = centreFor(p, s), rotatedRest = rotate(p.translation, a);
      result[p.id] = { position: c.map((v, i) => v - rotatedRest[i]), quaternion: [0, 0, Math.sin(a / 2), Math.cos(a / 2)], scale: [1, 1, 1] };
    }
    return result;
  }
  function worldMatrices(value = 0) {
    const s = motionState(angleOf(value));
    return new Map(PARTS.map(p => [p.id, new Matrix4().makeRotationZ(memberAngle(p, s) + (p.restAngle || 0)).setPosition(...centreFor(p, s))]));
  }
  function boundsAtAngle(value = 0) {
    const world = worldMatrices(value);
    return new Map(PARTS.map(p => {
      const delta = world.get(p.id).clone().multiply(rest.get(p.id).clone().invert()), box = new Box3().setFromPoints(corners(bounds.get(p.id)).map(c => c.applyMatrix4(delta)));
      return [p.id, { min: box.min.toArray(), max: box.max.toArray() }];
    }));
  }
  return { motionState, coordinates: motionState, posesForAngle, workingPoses: posesForAngle, worldMatrices, boundsAtAngle,
    phaseErrors: meshPhaseErrors, pitchVelocityResiduals, bearingVelocityResiduals,
    ownedIds: PARTS.filter(p => p.motionRole !== 'fixed').map(p => p.id),
    evidence: { revision: KINEMATICS_REVISION, geometryRevision: index.geometryRevision,
      basis: 'Original 12-slot / 14-pole structural motor concept rigidly driving an ideal ring-fixed epicyclic reducer.',
      reduction: 4, motorPerSun: 1, carrierPerSun: .25, planetSpinPerSun: -.5, planetRelativeCarrierPerSun: -.75,
      gearTrainPoseRepeatSunRadians: 4 * TAU, fullPoseRepeatSunRadians: null,
      motorElectromagneticSimulation: false, bearingContactDynamics: false, toothPhasesBakedIntoGeometry: true,
      wrapperConvention: 'Rest-relative model poses before immutable rotated source transforms; display offsets are separate.', limitations: [...LIMITATIONS] } };
}
