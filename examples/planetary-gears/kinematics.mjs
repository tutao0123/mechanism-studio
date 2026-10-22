/** Ideal ring-fixed epicyclic kinematics; radians, metres, positive about +Z.
 * Mesh phase is baked into the authored geometry. This adapter writes only
 * rest-relative model wrappers and never changes source or display transforms.
 */
import { Box3, Matrix4, Vector3 } from 'three';
import { GEOMETRY_REVISION, ROOT_ID, GEAR_SPEC, PARTS, PLANET_ANGLES, LIMITATIONS, SUPPORT_BEARINGS } from './spec.mjs';
import { bearingMotionState, bearingVelocityResiduals, bearingBallPose, BEARING_KINEMATICS_REVISION } from './bearing-kinematics.mjs';

export const KINEMATICS_REVISION = 'planetary-ring-fixed-rolling-bearings-3';
const { sunTeeth: ZS, planetTeeth: ZP, ringTeeth: ZR, orbitRadius: A } = GEAR_SPEC;
const TAU = Math.PI * 2;
const finiteAngle = value => {
  if (!Number.isFinite(value)) throw new TypeError('Sun angle must be a finite number of radians.');
  return value;
};
const angleOf = state => finiteAngle(typeof state === 'number' ? state : state?.sunAngle);
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const rotate = ([x, y, z], angle) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle), z];
const neutral = () => ({ position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] });
const xyz = (value, label) => {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) throw new TypeError(`${label}: expected three finite coordinates.`);
  return [...value];
};
const corners = bounds => [bounds.min[0], bounds.max[0]].flatMap(x =>
  [bounds.min[1], bounds.max[1]].flatMap(y => [bounds.min[2], bounds.max[2]].map(z => new Vector3(x, y, z))));

/** Absolute member angles relative to the declared source pose. Planet spin is
 * about its own centre; carrier/orbit is a separate angle in the same frame. */
export function motionState(sunAngle = 0) {
  finiteAngle(sunAngle);
  const carrierAngle = sunAngle * ZS / (ZS + ZR);
  const planetRelativeCarrier = -(ZS / ZP) * (sunAngle - carrierAngle);
  const planetAngle = carrierAngle + planetRelativeCarrier;
  return { sunAngle, ringAngle: 0, carrierAngle, planetAngle, planetRelativeCarrier,
    reduction: (ZS + ZR) / ZS,
    bearings: { front: bearingMotionState('front', sunAngle), rear: bearingMotionState('rear', carrierAngle) },
    planets: PLANET_ANGLES.map((alpha, i) => ({ id: `pg:planet-${i + 1}`, orbitAngle: alpha + carrierAngle,
      center: [A * Math.cos(alpha + carrierAngle), A * Math.sin(alpha + carrierAngle), 0],
      spinAngle: planetAngle, toothPhase: GEAR_SPEC.planetPhase + planetAngle })) };
}

/** Two independent pitch-phase residuals per occurrence. Zero means that the
 * alternating tooth/gap phases agree, not that contact stress was simulated. */
export function meshPhaseErrors(sunAngle = 0) {
  const state = motionState(sunAngle);
  const thetaS = GEAR_SPEC.sunPhase + state.sunAngle;
  const thetaP = GEAR_SPEC.planetPhase + state.planetAngle;
  const thetaR = GEAR_SPEC.ringGapPhase - Math.PI / ZR + state.ringAngle;
  return state.planets.map(planet => ({ id: planet.id,
    external: wrap(ZS * (planet.orbitAngle - thetaS) + ZP * (planet.orbitAngle + Math.PI - thetaP) - Math.PI),
    internal: wrap(ZR * (planet.orbitAngle - thetaR) - ZP * (planet.orbitAngle - thetaP) - Math.PI) }));
}

/** Tangential velocity agreement at the ideal pitch points (m/s). This checks
 * the relative-velocity equations; it does not claim slip/friction modelling. */
export function pitchVelocityResiduals(sunAngularVelocity = 1) {
  const rates = motionState(sunAngularVelocity), rs = GEAR_SPEC.module * ZS / 2, rp = GEAR_SPEC.module * ZP / 2;
  return { external: rates.sunAngle * rs - (rates.carrierAngle * A - rates.planetAngle * rp),
    internal: rates.carrierAngle * A + rates.planetAngle * rp };
}

export function createPlanetaryRig(index) {
  if (index?.units !== 'm' || index.rootId !== ROOT_ID || !Array.isArray(index.parts)) throw new Error('Expected the authored planetary assembly in metres.');
  if (typeof index.geometryRevision !== 'string' || !(index.geometryRevision === GEOMETRY_REVISION || index.geometryRevision.startsWith(`${GEOMETRY_REVISION}-`))) throw new Error('Planetary geometry revision does not match the authored specification.');
  if (index.source?.specRevision !== GEOMETRY_REVISION || Object.entries(GEAR_SPEC).some(([key, value]) => !Number.isFinite(index.gearSpec?.[key]) || Math.abs(index.gearSpec[key] - value) > 1e-12)) throw new Error('Planetary source specification or gear parameters do not match the authored design.');
  for (const [side, bearing] of Object.entries(SUPPORT_BEARINGS)) {
    if (Object.entries(bearing).some(([key, value]) => !Number.isFinite(index.supportBearingSpec?.[side]?.[key]) || Math.abs(index.supportBearingSpec[side][key] - value) > 1e-12)) throw new Error(`Support-bearing parameters do not match the authored design: ${side}`);
  }
  const byId = new Map(index.parts.map(part => [part.id, part]));
  if (byId.size !== PARTS.length || index.parts.length !== PARTS.length) throw new Error('Expected the complete unique authored planetary part identities.');
  const rest = new Map(), bounds = new Map();
  for (const spec of PARTS) {
    const part = byId.get(spec.id);
    if (!part || part.parentId !== ROOT_ID || part.motionRole !== spec.motionRole || part.supportSide !== spec.supportSide || part.bearingElement !== spec.bearingElement || part.ballIndex !== spec.ballIndex) throw new Error(`Unexpected planetary identity, parent or motion role: ${spec.id}`);
    const expected = new Matrix4().makeTranslation(...spec.translation).elements;
    for (const field of ['localMatrix', 'worldMatrix']) {
      const actual = part[field];
      if (!Array.isArray(actual) || actual.length !== 16 || actual.some((value, i) => !Number.isFinite(value) || Math.abs(value - expected[i]) > 1e-9)) throw new Error(`Unexpected source rest transform: ${spec.id}.${field}`);
    }
    rest.set(spec.id, new Matrix4().fromArray(part.worldMatrix));
    const box = { min: xyz(part.worldBounds?.min, `${spec.id}.worldBounds.min`), max: xyz(part.worldBounds?.max, `${spec.id}.worldBounds.max`) };
    if (box.min.some((v, axis) => v > box.max[axis])) throw new Error(`Invalid source bounds: ${spec.id}`);
    bounds.set(spec.id, box);
  }

  function memberAngle(spec, state) {
    if (spec.motionRole === 'bearing-cage') return state.bearings[spec.supportSide].cageAngle;
    if (spec.motionRole === 'bearing-ball') return state.bearings[spec.supportSide].ballSpinAngle;
    return spec.motionRole === 'sun' ? state.sunAngle : spec.motionRole === 'planet' ? state.planetAngle : spec.motionRole === 'carrier' ? state.carrierAngle : 0;
  }
  function centreFor(spec, state) {
    if (spec.motionRole === 'bearing-ball') return bearingBallPose(spec.supportSide, spec.ballIndex, state.bearings[spec.supportSide].innerAngle).centre;
    return spec.motionRole === 'planet' || spec.motionRole === 'carrier' ? rotate(spec.translation, state.carrierAngle) : [...spec.translation];
  }

  function posesForAngle(value = 0) {
    const state = motionState(angleOf(value)), result = {};
    for (const spec of PARTS) {
      if (state.sunAngle === 0 || spec.motionRole === 'fixed') { result[spec.id] = neutral(); continue; }
      const angle = memberAngle(spec, state), centre = centreFor(spec, state), rotatedRest = rotate(spec.translation, angle);
      // M * T(C0) = T(Ct) * R(spin): translate by Ct - R(spin) C0.
      result[spec.id] = { position: centre.map((v, i) => v - rotatedRest[i]),
        quaternion: [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)], scale: [1, 1, 1] };
    }
    return result;
  }

  function worldMatrices(value = 0) {
    const state = motionState(angleOf(value));
    return new Map(PARTS.map(spec => [spec.id, new Matrix4().makeRotationZ(memberAngle(spec, state)).setPosition(...centreFor(spec, state))]));
  }

  function boundsAtAngle(value = 0) {
    const world = worldMatrices(value);
    return new Map(PARTS.map(spec => {
      const delta = world.get(spec.id).clone().multiply(rest.get(spec.id).clone().invert());
      const box = new Box3().setFromPoints(corners(bounds.get(spec.id)).map(corner => corner.applyMatrix4(delta)));
      return [spec.id, { min: box.min.toArray(), max: box.max.toArray() }];
    }));
  }

  return { motionState, coordinates: motionState, posesForAngle, workingPoses: state => posesForAngle(angleOf(state)),
    worldMatrices, boundsAtAngle, phaseErrors: meshPhaseErrors, pitchVelocityResiduals, bearingVelocityResiduals,
    ownedIds: PARTS.filter(part => part.motionRole !== 'fixed').map(part => part.id),
    evidence: { revision: KINEMATICS_REVISION, geometryRevision: index.geometryRevision,
      basis: 'Original authored assembly; analytic ideal ring-fixed epicyclic kinematics.',
      axis: [0, 0, 1], ringFixed: true, sunTeeth: ZS, planetTeeth: ZP, ringTeeth: ZR,
      reduction: 4, carrierPerSun: .25, planetSpinPerSun: -.5, planetRelativeCarrierPerSun: -.75,
      gearTrainPoseRepeatSunRadians: 4 * TAU, fullPoseRepeatSunRadians: null, toothPhasesBakedIntoGeometry: true,
      bearingRevision: BEARING_KINEMATICS_REVISION,
      supportBearingMotion: 'Ideal radial no-slip kinematics: the front inner race follows the sun, the rear inner race follows the carrier, and both outer races are fixed. Cages and ball centres orbit together; each ball also spins about its own centre with the absolute housing-frame spin rate. No load, friction, slip or deformation is solved.',
      bearingLoopPolicy: 'Four sun turns restore the gear train, not the bearing cages or identified balls. The showcase hides rolling internals at its editorial reset; mechanical state is not forcibly wrapped to a false bearing closure.',
      wrapperConvention: 'Rest-relative model transforms before immutable source translation; display explosion is independent.',
      limitations: [...LIMITATIONS] } };
}
