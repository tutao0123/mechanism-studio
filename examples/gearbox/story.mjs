/** Mechanical schedule and absolute model poses. Presentation offsets, labels,
 * opacity and cameras are executed by the shared compiled presentation plan. */
import { SYNCHROS, BEARINGS, AXES, GEARS, SLEEVE_TRAVEL, RING_GAP } from './spec.mjs';
import { createDrive, memberAngles, leverAngles } from './kinematics.mjs';
import { BPM, DURATION, normalizeTime } from './presentation-data.mjs';
import { createGearboxPresentation } from './presentation.mjs';
export { BPM, TOTAL_BEATS, DURATION, CHAPTERS, PLAN_REVISION, CASE_TIMING, FOCUS, COHORTS, WAVE, normalizeTime } from './presentation-data.mjs';
const beat = value => value * 60 / BPM, freeze = Object.freeze;
const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, k) => a.map(v => v * k);
/** Contiguous drive schedule in beats; createDrive works in seconds. Speeds
 * are deliberately slow so teeth read in a 15 fps README GIF: steady motion
 * passes at most VISIBLE_TOOTH_RATE teeth per second (≈0.37 pitch per frame).
 * The brief dog-alignment nudge inside a shift may reach ALIGNMENT_TOOTH_RATE,
 * still under the 0.5-pitch Nyquist limit where teeth would appear to reverse.
 * Fifth cruises slower, because the mainshaft splines outrun the input there. */
export const VISIBLE_TOOTH_RATE = 5.5, ALIGNMENT_TOOTH_RATE = 7;
const PEAK = .25, CLOSE_PEAK = .20, FIFTH_PEAK = .16;
const SCHEDULE_BEATS = [
  { type: 'hold', t0: 0, t1: 22.5 },
  { type: 'shift', from: 'N', to: '1', t0: 22.5, t1: 23.5 },
  { type: 'drive', gear: '1', engine: [0, PEAK], t0: 23.5, t1: 27 },
  { type: 'shift', from: '1', to: '2', t0: 27, t1: 28.2 },
  { type: 'drive', gear: '2', engine: [PEAK * GEARS[2].ratio / GEARS[1].ratio, PEAK], t0: 28.2, t1: 32 },
  { type: 'shift', from: '2', to: '3', t0: 32, t1: 33.2 },
  { type: 'drive', gear: '3', engine: [PEAK * GEARS[3].ratio / GEARS[2].ratio, CLOSE_PEAK], t0: 33.2, t1: 38 },
  { type: 'shift', from: '3', to: '4', t0: 38, t1: 40 },
  { type: 'drive', gear: '4', engine: [CLOSE_PEAK / GEARS[3].ratio, CLOSE_PEAK], t0: 40, t1: 44.5 },
  { type: 'shift', from: '4', to: '5', t0: 44.5, t1: 45.7 },
  { type: 'drive', gear: '5', engine: [CLOSE_PEAK * GEARS[5].ratio, FIFTH_PEAK], t0: 45.7, t1: 50 },
  { type: 'shift', from: '5', to: 'N', t0: 50, t1: 50.8 },
  { type: 'coast', t0: 50.8, t1: 53.5 },
  { type: 'hold', t0: 53.5, t1: 64 },
];
export const SCHEDULE = freeze(SCHEDULE_BEATS.map(segment => freeze({ ...segment, t0: beat(segment.t0), t1: beat(segment.t1) })));

const rotationX = angle => [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)];
/** Quaternion [x,y,z,w] for a lever tilt: lateral about X, fore/aft about Z. */
function leverQuaternion({ lateral, foreAft }) {
  const qx = rotationX(lateral), qz = [0, 0, Math.sin(foreAft / 2), Math.cos(foreAft / 2)];
  const [ax, ay, az, aw] = qx, [bx, by, bz, bw] = qz;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}
const rotate = ([x, y, z], [qx, qy, qz, qw]) => {
  const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
  return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx];
};

/** Which parts carry torque in each gear: the authored power path. */
export function powerPathIds(gear) {
  const g = GEARS[gear], ids = ['gb:input/shaft', `gb:main/synchro-${g.synchro}/hub`, `gb:main/synchro-${g.synchro}/sleeve`, 'gb:main/shaft', 'gb:main/output-flange'];
  if (gear === '4') return ids;
  const suffix = gear === 'R' ? 'r' : gear;
  ids.push('gb:counter/gear-drive', 'gb:counter/shaft', `gb:counter/gear-${suffix}`, `gb:main/gear-${suffix}`);
  if (gear === 'R') ids.push('gb:idler/gear');
  return ids;
}

export function localDisplayOffsets(index, offsetsWorld, Matrix4, Vector3) {
  const parents = new Map((index.assemblies ?? []).map(a => [a.id, a])), result = new Map();
  for (const part of index.parts) {
    const own = offsetsWorld[part.id];
    if (!Array.isArray(own) || own.length !== 3 || !own.every(Number.isFinite)) throw new Error(`Missing finite display offset: ${part.id}`);
    const parent = parents.get(part.parentId);
    if (!parent) throw new Error(`Missing assembly parent: ${part.parentId}`);
    // Parts sit directly under assemblies, which carry no display offset of
    // their own; convert the world delta through the actual parent matrix.
    const inverse = new Matrix4().fromArray(parent.worldMatrix).invert(), origin = new Vector3().applyMatrix4(inverse);
    result.set(part.id, new Vector3(...own).applyMatrix4(inverse).sub(origin).toArray());
  }
  return result;
}

export function createGearboxMechanics(index) {
  if (index?.units !== 'm' || !Array.isArray(index.parts) || !Array.isArray(index.assemblies)) throw new Error('A gearbox scene index in metres is required.');
  const parts = new Map(index.parts.map(part => [part.id, part]));
  for (const gear of Object.keys(GEARS)) for (const id of powerPathIds(gear)) if (!parts.has(id)) throw new Error(`Power path part missing: ${id}`);
  const drive = createDrive(SCHEDULE, DURATION);
  const moving = index.parts.filter(part => part.role !== 'static').map(part => {
    const [kind, ...rest] = part.role.split(':');
    return { id: part.id, kind, key: rest.join(':'), pivot: [part.localMatrix[12], part.localMatrix[13], part.localMatrix[14]] };
  });

  /** Absolute model-wrapper poses for every moving part (parent frame). */
  function workingPoses(state) {
    const d = state.drive, angles = memberAngles(d.thetaIn, d.thetaOut), poses = {};
    for (const part of moving) {
      let position = [0, 0, 0], quaternion = [0, 0, 0, 1];
      if (part.kind === 'spin') quaternion = rotationX(angles[part.key]);
      else if (part.kind === 'needle') quaternion = rotationX((angles[part.key] + (part.key === 'idler' ? 0 : d.thetaOut)) / 2);
      else if (part.kind === 'sleeve') { position = [d.sleeves[part.key], 0, 0]; quaternion = rotationX(d.thetaOut); }
      else if (part.kind === 'ring') {
        const [s, side] = part.key.split(':'), press = d.rings[s];
        position = [Math.sign(press) === Number(side) ? press : 0, 0, 0]; quaternion = rotationX(d.thetaOut);
      } else if (part.kind === 'key') {
        const travel = d.sleeves[part.key];
        position = [Math.sign(travel) * Math.min(Math.abs(travel), RING_GAP), 0, 0]; quaternion = rotationX(d.thetaOut);
      } else if (part.kind === 'rail' || part.kind === 'fork') position = [d.sleeves[part.key], 0, 0];
      else if (part.kind === 'lever') {
        quaternion = leverQuaternion(leverAngles(d.sleeves));
        // Rotate about the lever's own pivot (its rest origin in the case frame).
        position = add(part.pivot, scale(rotate(part.pivot, quaternion), -1));
      } else throw new Error(`Unknown motion role: ${part.kind}`);
      poses[part.id] = { position, quaternion };
    }
    return poses;
  }

  const powerCues = state => state.drive.path.flatMap(({ gear, weight }) => powerPathIds(gear).map(id => ({ id, weight: .6 * weight })));
  return { SCHEDULE, drive, workingPoses, powerCues, powerPathIds, localDisplayOffsets,
    stateAt: seconds => ({ drive: drive.stateAt(normalizeTime(seconds)) }),
    geometryRevision: index.geometryRevision, sleeveTravel: SLEEVE_TRAVEL, bearings: BEARINGS, synchros: SYNCHROS, axes: AXES };
}

/** Compatibility entry point used by the score and the separate cinematic clock. */
export function createGearboxStory(index) { return createGearboxPresentation(index).timeline; }
