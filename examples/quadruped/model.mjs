export const SPEC = Object.freeze({
  mechanismId: 'studio-quadruped-8dof', units: 'mm', thigh: 100, shin: 115,
  hipHeight: 200, footRadius: 10, hipX: 110, hipY: 92,
  hipLimits: [-90, 65], kneeLimits: [15, 135], stride: 70,
});
export const LEGS = Object.freeze([
  { id: 'fl', label: '左前', x: SPEC.hipX, y: SPEC.hipY, offset: 0 },
  { id: 'fr', label: '右前', x: SPEC.hipX, y: -SPEC.hipY, offset: .5 },
  { id: 'rl', label: '左后', x: -SPEC.hipX, y: SPEC.hipY, offset: .5 },
  { id: 'rr', label: '右后', x: -SPEC.hipX, y: -SPEC.hipY, offset: 0 },
]);
const rad = degrees => degrees * Math.PI / 180;
const deg = radians => radians * 180 / Math.PI;
const finite = value => { if (!Number.isFinite(value)) throw new TypeError('机械参数必须为有限数字'); return value; };
const inRange = (x, limits) => x >= limits[0] - 1e-8 && x <= limits[1] + 1e-8;
export const cycle = value => ((finite(value) % 1) + 1) % 1;
export const bodyToGLTF = ([x, y, z]) => [x * .001, z * .001, -y * .001];

/** Angles are from downward vertical. Positive knee bends toward +x. */
export function forwardKinematics(hipDegrees, kneeDegrees) {
  const q1 = rad(finite(hipDegrees)), q2 = rad(finite(kneeDegrees));
  const knee = [SPEC.thigh * Math.sin(q1), -SPEC.thigh * Math.cos(q1)];
  return { knee, foot: [knee[0] + SPEC.shin * Math.sin(q1 + q2), knee[1] - SPEC.shin * Math.cos(q1 + q2)] };
}

/** Analytic 2R inverse, one explicit knee branch; unreachable/limited targets fail. */
export function inverseKinematics(x, z) {
  finite(x); finite(z);
  const cosine = (x * x + z * z - SPEC.thigh ** 2 - SPEC.shin ** 2) / (2 * SPEC.thigh * SPEC.shin);
  if (cosine < -1 - 1e-10 || cosine > 1 + 1e-10) throw new RangeError('足端目标超出两段杆长的可达范围');
  const q2 = Math.acos(Math.max(-1, Math.min(1, cosine)));
  const q1 = Math.atan2(x, -z) - Math.atan2(SPEC.shin * Math.sin(q2), SPEC.thigh + SPEC.shin * Math.cos(q2));
  const hip = deg(q1), knee = deg(q2);
  if (!inRange(hip, SPEC.hipLimits) || !inRange(knee, SPEC.kneeLimits)) throw new RangeError('足端目标需要超过示意关节限位');
  return { hip, knee };
}

export function footTrajectory(phase, stepHeight = 40) {
  phase = cycle(phase); finite(stepHeight);
  if (stepHeight < 10 || stepHeight > 60) throw new RangeError('步高必须在 10 至 60 mm');
  const swing = phase < .5, t = swing ? phase * 2 : (phase - .5) * 2;
  const eased = .5 - .5 * Math.cos(Math.PI * t);
  return { x: swing ? -SPEC.stride / 2 + SPEC.stride * eased : SPEC.stride / 2 - SPEC.stride * eased,
    z: SPEC.footRadius + (swing ? stepHeight * Math.sin(Math.PI * t) ** 2 : 0),
    phase, swing, contact: !swing || phase === 0 };
}

export function robotState({ mode = 'stand', phase = 0, stepHeight = 40, singleLift = 40 } = {}) {
  if (!['stand', 'single', 'trot'].includes(mode)) throw new TypeError('未知机械模式');
  phase = cycle(phase); finite(singleLift); finite(stepHeight);
  if (stepHeight < 10 || stepHeight > 60) throw new RangeError('步高必须在 10 至 60 mm');
  if (singleLift < 0 || singleLift > 60) throw new RangeError('单腿抬高必须在 0 至 60 mm');
  const legs = LEGS.map(leg => {
    const path = mode === 'trot' ? footTrajectory(phase + leg.offset, stepHeight)
      : { x: mode === 'single' && leg.id === 'fl' ? 15 : 0,
        z: SPEC.footRadius + (mode === 'single' && leg.id === 'fl' ? singleLift : 0),
        swing: mode === 'single' && leg.id === 'fl' && singleLift > 0,
        contact: !(mode === 'single' && leg.id === 'fl' && singleLift > 0), phase: 0 };
    const joints = inverseKinematics(path.x, path.z - SPEC.hipHeight);
    const fk = forwardKinematics(joints.hip, joints.knee);
    const hip = [leg.x, leg.y, SPEC.hipHeight];
    const knee = [leg.x + fk.knee[0], leg.y, SPEC.hipHeight + fk.knee[1]];
    const foot = [leg.x + fk.foot[0], leg.y, SPEC.hipHeight + fk.foot[1]];
    return { ...leg, ...joints, hipPosition: hip, kneePosition: knee, footPosition: foot, target: [leg.x + path.x, leg.y, path.z],
      residual: Math.hypot(fk.foot[0] - path.x, SPEC.hipHeight + fk.foot[1] - path.z),
      swing: path.swing, contact: path.contact, localPhase: path.phase,
      withinLimits: inRange(joints.hip, SPEC.hipLimits) && inRange(joints.knee, SPEC.kneeLimits) };
  });
  return { mode, phase, stepHeight, singleLift, legs, jointCount: 8,
    contactLegs: legs.filter(leg => leg.contact).map(leg => leg.id),
    maxResidual: Math.max(...legs.map(leg => leg.residual)) };
}

export function motionPoses(state) {
  const poses = {};
  for (const leg of state.legs) {
    poses['thigh-' + leg.id] = { position: bodyToGLTF(leg.hipPosition), rotation: [0, 0, rad(leg.hip)] };
    poses['shin-' + leg.id] = { position: bodyToGLTF(leg.kneePosition), rotation: [0, 0, rad(leg.hip + leg.knee)] };
    poses['foot-' + leg.id] = { position: bodyToGLTF(leg.footPosition), rotation: [0, 0, 0] };
  }
  return poses;
}

export function createSession(patch = {}) { return { mode: 'stand', phase: 0, stepHeight: 40, singleLift: 40, speed: .8, playing: false, view: { camera: 'overview', explode: 0, cutaway: true }, ...patch }; }
export function setMechanical(session, patch) {
  const next = { ...session, ...patch, view: { ...session.view } };
  finite(next.speed); if (next.speed < .2 || next.speed > 2) throw new RangeError('步频必须在 0.2 至 2 Hz');
  robotState(next); return next;
}
export function setObservation(session, patch) {
  const view = { ...session.view, ...patch };
  finite(view.explode); if (view.explode < 0 || view.explode > 1) throw new RangeError('展开范围必须在 0 到 1');
  if (!['overview', 'side', 'feet', 'front', 'free'].includes(view.camera)) throw new TypeError('未知观察视角');
  return { ...session, view };
}
