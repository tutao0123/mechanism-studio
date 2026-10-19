/** Showcase timeline for the teaching gearbox: 40 seconds, 64 beats at 96 BPM.
 * Structure → explosion → power path through the gears → synchronizer close-up
 * → overdrive → whole again. Every pose, offset, fade and accent is a pure
 * function of loop time; the drive angles come from kinematics.createDrive. */
import { LAYOUT, SYNCHROS, BEARINGS, AXES, GEARS, SLEEVE_TRAVEL, RING_GAP } from './spec.mjs';
import { createDrive, memberAngles, leverAngles, smooth } from './kinematics.mjs';

export const BPM = 96;
export const TOTAL_BEATS = 64;
export const DURATION = TOTAL_BEATS * 60 / BPM;
export const PLAN_REVISION = 'gearbox-story-1';
const beat = value => value * 60 / BPM;
const freeze = Object.freeze;

export const CHAPTERS = freeze([
  { id: 'whole', firstBeat: 0, lastBeat: 5, title: 'A five-speed gearbox.', copy: 'Three shafts, thirteen gears, three synchronizers. One lever chooses the path.', labels: [['gb:case/shift-lever', 'Shift lever']] },
  { id: 'open', firstBeat: 5, lastBeat: 12, title: 'Lift the case.', copy: 'The input shaft drives a countershaft below it; the mainshaft carries the output.', labels: [['gb:input/shaft', 'Input shaft'], ['gb:counter/shaft', 'Countershaft']] },
  { id: 'explode', firstBeat: 12, lastBeat: 22, title: 'Gears that spin free.', copy: 'Mainshaft gears turn on needle bearings until a synchronizer locks one of them to the shaft.', labels: [['gb:main/synchro-s12/sleeve', 'Synchronizer'], ['gb:idler/gear', 'Reverse idler']] },
  { id: 'low', firstBeat: 22, lastBeat: 32, title: 'First, then second.', copy: 'Power crosses to the countershaft and back up through one gear pair: 3.70 : 1, then 2.13 : 1.', labels: [['gb:main/gear-1', '1st gear'], ['gb:main/gear-2', '2nd gear']] },
  { id: 'sync', firstBeat: 32, lastBeat: 44, title: 'Matching speeds.', copy: 'A blocker ring brings the gear to shaft speed; then the sleeve slides over its dog teeth. Fourth is direct.', labels: [['gb:main/synchro-s34/sleeve', 'Sleeve'], ['gb:main/synchro-s34/ring-front', 'Blocker ring']] },
  { id: 'over', firstBeat: 44, lastBeat: 54, title: 'Fifth: overdrive.', copy: '0.78 : 1 — the mainshaft now turns faster than the input shaft.', labels: [['gb:main/gear-5', '5th gear']] },
  { id: 'close', firstBeat: 54, lastBeat: 64, title: 'Whole again.', copy: 'An original teaching model: ideal tooth ratios, no loads, friction or wear.', labels: [] },
].map(chapter => freeze({ ...chapter, labels: freeze(chapter.labels.map(freeze)) })));

/** Contiguous drive schedule in beats; createDrive works in seconds. Engine
 * (input) speeds are deliberately slow so teeth stay readable on screen. */
const PEAK = .36, CLOSE_PEAK = .30;
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
  { type: 'drive', gear: '5', engine: [CLOSE_PEAK * GEARS[5].ratio, CLOSE_PEAK], t0: 45.7, t1: 50 },
  { type: 'shift', from: '5', to: 'N', t0: 50, t1: 50.8 },
  { type: 'coast', t0: 50.8, t1: 53.5 },
  { type: 'hold', t0: 53.5, t1: 64 },
];
export const SCHEDULE = freeze(SCHEDULE_BEATS.map(segment => freeze({ ...segment, t0: beat(segment.t0), t1: beat(segment.t1) })));

/** Case opening/closing, close-up context fade and explosion cohorts, in beats. */
export const CASE_TIMING = freeze({ open: freeze([5.4, 8]), close: freeze([54.2, 57.6]) });
export const FOCUS = freeze({ fadeIn: freeze([32, 33.4]), fadeOut: freeze([43, 44.4]), context: .2,
  ids: freeze(['gb:input/shaft', 'gb:main/shaft', 'gb:main/gear-3', 'gb:main/needle-3', 'gb:counter/gear-drive', 'gb:counter/gear-3',
    'gb:shift/fork-s34', 'gb:shift/rail-s34', ...['hub', 'sleeve', 'ring-front', 'ring-rear', 'key-1', 'key-2', 'key-3'].map(name => `gb:main/synchro-s34/${name}`)]) });
export const COHORTS = freeze({
  shift: freeze({ out: 12.0, back: 20.6, beats: 1.4 }),
  counter: freeze({ out: 12.4, back: 20.2, beats: 1.4 }),
  idler: freeze({ out: 12.8, back: 19.8, beats: 1.4 }),
  axial: freeze({ out: 13.0, back: 19.4, beats: 1.5 }),
  inner: freeze({ out: 14.2, back: 18.8, beats: 1.0 }),
});
const AXIAL_SPREAD = .55, PIVOT_X = LAYOUT.s12.centre;

const normalize = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, k) => a.map(v => v * k);

export function normalizeTime(seconds) {
  if (!Number.isFinite(seconds)) throw new TypeError('Finite timeline seconds required.');
  let time = seconds % DURATION; if (time < 0) time += DURATION;
  return time < 1e-10 || DURATION - time < 1e-10 ? 0 : time;
}

/** World display offsets at full explosion, split by cohort, for one part. */
function explodeVectors(part, assemblies) {
  const id = part.id, group = part.group ?? '', none = [0, 0, 0], result = { shift: none, counter: none, idler: none, axial: none, inner: none };
  const parent = assemblies.get(part.parentId), origin = parent ? [parent.worldMatrix[12], parent.worldMatrix[13], parent.worldMatrix[14]] : [0, 0, 0];
  const axial = x => [AXIAL_SPREAD * (x - PIVOT_X), 0, 0];
  if (group === 'shift') result.shift = [0, .11, 0];
  if (group.startsWith('counter')) result.counter = [0, -.075, 0];
  if (group === 'counter-bearing' || group === 'counter-bearing:balls') result.inner = [origin[0] < 0 ? -.045 : .045, 0, 0];
  if (group === 'idler') result.idler = [0, -.015, .07];
  if (group === 'input') result.axial = add(axial(part.worldMatrix[12]), [-.02, 0, 0]);
  if (group.startsWith('input-bearing')) result.axial = add(axial(origin[0]), [-.05, 0, 0]);
  if (group.startsWith('gear:') && !id.includes('/needle-')) result.axial = axial(part.worldMatrix[12]);
  if (group.startsWith('washer:') || group === 'output') result.axial = axial(part.worldMatrix[12]);
  if (group.startsWith('rear-bearing')) result.axial = add(axial(origin[0]), [.03, 0, 0]);
  if (group.startsWith('synchro:')) {
    result.axial = axial(origin[0]);
    if (group.endsWith(':sleeve')) result.inner = [0, .055, 0];
    if (group.endsWith(':ring-1')) result.inner = [-.012, 0, 0];
    if (group.endsWith(':ring1')) result.inner = [.012, 0, 0];
    if (group.endsWith(':keys')) {
      const [, y0, z0] = part.worldCenter, radial = normalize([0, y0 - origin[1], z0 - origin[2]]);
      result.inner = scale(radial, .014);
    }
  }
  if (group.endsWith(':balls')) {
    const radial = normalize([0, part.worldMatrix[13] - origin[1], part.worldMatrix[14] - origin[2]]);
    result.inner = add(result.inner, scale(radial, .007));
  }
  return result;
}
function caseVector(part) {
  const group = part.group ?? '';
  if (!group.startsWith('case:')) return null;
  if (group === 'case:shell') return [0, .055, 0];
  if (group === 'case:cover') return [0, .075, 0];
  if (group === 'case:front-plate' || group === 'case:bell') return [-.035, 0, 0];
  if (group === 'case:rear-plate' || group === 'case:extension') return [.035, 0, 0];
  if (group === 'case:bolts') return [part.worldCenter[0] < 0 ? -.035 : .035, 0, 0];
  throw new Error(`Unplanned case group: ${group}`);
}

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

export function createGearboxStory(index) {
  if (index?.units !== 'm' || !Array.isArray(index.parts) || !Array.isArray(index.assemblies)) throw new Error('A gearbox scene index in metres is required.');
  const parts = new Map(index.parts.map(part => [part.id, part])), assemblies = new Map(index.assemblies.map(a => [a.id, a]));
  for (const chapter of CHAPTERS) for (const [id] of chapter.labels) if (!parts.has(id)) throw new Error(`Label target missing: ${id}`);
  for (const gear of Object.keys(GEARS)) for (const id of powerPathIds(gear)) if (!parts.has(id)) throw new Error(`Power path part missing: ${id}`);
  const drive = createDrive(SCHEDULE, DURATION);
  const explode = new Map(index.parts.map(part => [part.id, explodeVectors(part, assemblies)]));
  const caseParts = new Map(index.parts.map(part => [part.id, caseVector(part)]).filter(([, v]) => v));
  const moving = index.parts.filter(part => part.role !== 'static').map(part => {
    const [kind, ...rest] = part.role.split(':');
    return { id: part.id, kind, key: rest.join(':'), pivot: [part.localMatrix[12], part.localMatrix[13], part.localMatrix[14]] };
  });
  const cohortProgress = (b, cohort) => smooth((b - cohort.out) / cohort.beats) * (1 - smooth((b - cohort.back) / cohort.beats));
  const caseOpen = b => smooth((b - CASE_TIMING.open[0]) / (CASE_TIMING.open[1] - CASE_TIMING.open[0])) * (1 - smooth((b - CASE_TIMING.close[0]) / (CASE_TIMING.close[1] - CASE_TIMING.close[0])));

  function stateAt(seconds) {
    let time = normalizeTime(seconds), b = time * BPM / 60;
    if (Math.abs(b - Math.round(b)) < 1e-10) { b = Math.round(b); time = beat(b); }
    const chapterIndex = Math.max(0, CHAPTERS.findIndex(chapter => b >= chapter.firstBeat && b < chapter.lastBeat)), chapter = CHAPTERS[chapterIndex];
    const progress = Object.fromEntries(Object.entries(COHORTS).map(([name, cohort]) => [name, cohortProgress(b, cohort)]));
    progress.case = caseOpen(b);
    // The case lifts only while opening; it returns by fading in at rest, so the
    // closing and opening views share one envelope across the loop seam.
    progress.caseLift = b < 30 ? progress.case : 0;
    progress.focus = smooth((b - FOCUS.fadeIn[0]) / (FOCUS.fadeIn[1] - FOCUS.fadeIn[0])) * (1 - smooth((b - FOCUS.fadeOut[0]) / (FOCUS.fadeOut[1] - FOCUS.fadeOut[0])));
    const offsetsWorld = {};
    for (const part of index.parts) {
      const vectors = explode.get(part.id), lift = caseParts.get(part.id);
      let offset = [0, 0, 0];
      for (const name of Object.keys(COHORTS)) offset = add(offset, scale(vectors[name], progress[name]));
      if (lift) offset = add(offset, scale(lift, progress.caseLift));
      offsetsWorld[part.id] = offset;
    }
    return { time, beat: b, chapter, chapterIndex, localTime: time - beat(chapter.firstBeat), progress, offsetsWorld, drive: drive.stateAt(time) };
  }

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

  /** Accent the parts carrying torque, plus any named part being read. */
  function appearanceCues(state, labels) {
    const cues = labels.map(label => ({ id: label.id, weight: label.opacity }));
    for (const { gear, weight } of state.drive.path) for (const id of powerPathIds(gear)) cues.push({ id, weight: .6 * weight });
    return cues;
  }
  const focus = new Set(FOCUS.ids);
  for (const id of focus) if (!parts.has(id)) throw new Error(`Focus part missing: ${id}`);
  const presentationOpacity = (state, id) => {
    if (caseParts.has(id)) return Math.max(0, Math.min(1, 1 - state.progress.case));
    return focus.has(id) ? 1 : 1 - (1 - FOCUS.context) * state.progress.focus;
  };

  // Inside the packed gear cluster every nearby spot overlaps a neighbour, so
  // dense chapters only keep names off each other's targets; the white text
  // halo keeps them legible over line art. Open chapters use every solid.
  const DENSE = new Set(['low', 'sync', 'over']);
  const labelObstacleIds = state => DENSE.has(state.chapter.id) ? state.chapter.labels.map(([id]) => id)
    : index.parts.filter(part => presentationOpacity(state, part.id) >= .5).map(part => part.id);
  return { BPM, TOTAL_BEATS, DURATION, PLAN_REVISION, CHAPTERS, SCHEDULE, COHORTS, CASE_TIMING, FOCUS, normalizeTime, stateAt, localDisplayOffsets,
    workingPoses, appearanceCues, presentationOpacity, labelObstacleIds, drive, explode, caseParts, powerPathIds,
    geometryRevision: index.geometryRevision, sleeveTravel: SLEEVE_TRAVEL, bearings: BEARINGS, synchros: SYNCHROS, axes: AXES };
}
