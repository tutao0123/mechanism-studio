/** Ideal rigid-gear kinematics and an authored drive schedule for the teaching
 * gearbox. Pure functions of absolute time: the two driving angles (input and
 * output) are integrated once on a fixed grid when the drive is created, never
 * frame by frame, so seek, pause and loop always return the same state.
 *
 * Model: every input-train angle is an exact tooth ratio of the input angle;
 * every output-train angle equals the output angle. When a gear is engaged the
 * output speed is the input speed divided by that gear's ratio. During a shift
 * the clutch is treated as open: the input speed blends to the new gear's
 * speed (the synchronizer's job) and a small authored speed adjustment inside
 * that window lines the sleeve teeth up with the dog teeth before engagement. */
import { TEETH, GEARS, SPLINE_TEETH, SLEEVE_TRAVEL, RING_GAP, AXES, BEARINGS, bearingGeometry, SYNCHROS } from './spec.mjs';

export const KINEMATICS_REVISION = 'gearbox-kinematics-2';
const TAU = 2 * Math.PI;
export const DOG_PITCH = TAU / SPLINE_TEETH;
export const GRID_HZ = 1200;

/** Angle multiplier of each input-train member relative to the input shaft. */
const counter = -TEETH.input / TEETH.counterDrive;
export const TRAIN = Object.freeze({
  input: 1,
  counter,
  main1: 1 / GEARS[1].ratio, main2: 1 / GEARS[2].ratio, main3: 1 / GEARS[3].ratio, main5: 1 / GEARS[5].ratio,
  idler: -counter * TEETH.counterR / TEETH.idler,
  mainR: 1 / GEARS.R.ratio,
});
/** Multiplier of the input angle that turns the gear the sleeve locks to. */
export const engagedMultiplier = gear => gear === '4' ? TRAIN.input : TRAIN[GEARS[gear].main];

/** Rest tooth phase of every gear so that each mesh interlocks at angle zero.
 * Angles are measured in the YZ plane from +Y toward +Z, i.e. positive about
 * +X. A gear with phase φ has a tooth centred at φ + k·2π/Z. */
export function gearPhases() {
  // AXES hold [y, z]; atan2(z, y) measures from +Y toward +Z.
  const toward = (from, to) => Math.atan2(AXES[to][1] - AXES[from][1], AXES[to][0] - AXES[from][0]);
  const phases = {};
  // B meshes A: rotating A by δ from "tooth facing B" turns B by −(ZA/ZB)δ from "gap facing A".
  const mesh = (a, za, aAxis, b, zb, bAxis) => {
    const ab = toward(aAxis, bAxis), ba = ab + Math.PI, delta = phases[a] - ab;
    phases[b] = ba + Math.PI / zb - za / zb * delta;
  };
  phases.input = toward('main', 'counter');
  mesh('input', TEETH.input, 'main', 'counterDrive', TEETH.counterDrive, 'counter');
  for (const gear of ['1', '2', '3', '5']) {
    const { counter: cs, main } = GEARS[gear];
    phases[cs] = toward('counter', 'main');
    mesh(cs, TEETH[cs], 'counter', main, TEETH[main], 'main');
  }
  phases.counterR = toward('counter', 'idler');
  mesh('counterR', TEETH.counterR, 'counter', 'idler', TEETH.idler, 'idler');
  mesh('idler', TEETH.idler, 'idler', 'mainR', TEETH.mainR, 'main');
  return Object.freeze(phases);
}

const clamp01 = value => Math.max(0, Math.min(1, value));
export const smooth = value => { const p = clamp01(value); return p ** 3 * (10 - 15 * p + 6 * p ** 2); };
const smoothRate = value => { const p = clamp01(value); return value <= 0 || value >= 1 ? 0 : 30 * p ** 2 * (1 - p) ** 2; };
const ratioOf = gear => gear === 'N' ? null : GEARS[gear].ratio;
const synchroOf = gear => gear === 'N' ? null : GEARS[gear].synchro;
const sideOf = gear => gear === 'N' ? 0 : GEARS[gear].side;

/** Shift phases as fractions of the shift interval. */
export const SHIFT_PHASES = Object.freeze({ release: [0, .3], approach: [.3, .45], sync: [.45, .75], engage: [.75, 1] });
/** The sleeve is free of both dog rings from u = 0.25 to 0.75; only then may the
 * input be nudged into alignment without breaking an engaged gear's ratio. */
export const ALIGN_WINDOW = Object.freeze([.25, .75]);
const window = ([a, b], u) => (u - a) / (b - a);

function validateSchedule(schedule, duration) {
  if (!Array.isArray(schedule) || !schedule.length) throw new TypeError('A drive schedule is required.');
  let t = 0, gear = 'N', outputSpeed = 0;
  for (const segment of schedule) {
    if (Math.abs(segment.t0 - t) > 1e-9 || !(segment.t1 > segment.t0)) throw new RangeError(`Drive schedule must be contiguous: ${JSON.stringify(segment)}`);
    if (segment.type === 'shift') {
      if (segment.from !== gear || !(segment.to in GEARS || segment.to === 'N') || segment.to === gear) throw new RangeError(`Invalid shift ${segment.from}→${segment.to} while in ${gear}.`);
      gear = segment.to;
    } else if (segment.type === 'drive') {
      if (segment.gear !== gear || gear === 'N') throw new RangeError(`Drive in ${segment.gear} requires that gear engaged (currently ${gear}).`);
      const startOutput = segment.engine[0] / ratioOf(gear);
      if (Math.abs(startOutput - outputSpeed) > 1e-9) throw new RangeError(`Output speed must be continuous into ${gear} (${startOutput} vs ${outputSpeed}).`);
      outputSpeed = segment.engine[1] / ratioOf(gear);
    } else if (segment.type === 'coast') {
      if (gear !== 'N') throw new RangeError('Coasting to rest requires neutral.');
      outputSpeed = 0;
    } else if (segment.type !== 'hold') throw new TypeError(`Unknown drive segment: ${segment.type}`);
    if (segment.type === 'hold' && outputSpeed !== 0) throw new RangeError('Hold requires the output at rest.');
    t = segment.t1;
  }
  if (Math.abs(t - duration) > 1e-9 || gear !== 'N' || outputSpeed !== 0) throw new RangeError('The loop must end at rest in neutral at its duration.');
}

/**
 * @param {Array} schedule contiguous segments from 0 to `duration`:
 *   {type:'hold'}, {type:'shift', from, to}, {type:'drive', gear, engine:[revPerSecondStart, end]},
 *   {type:'coast'} (neutral, input and output slow to rest). All carry t0/t1 in seconds.
 */
export function createDrive(schedule, duration) {
  validateSchedule(schedule, duration);
  const segments = schedule.map(segment => ({ ...segment }));
  // Output and input speed (rev/s) entering each segment, for continuity.
  let enteringOutput = 0, enteringInput = 0;
  for (const segment of segments) {
    segment.outputIn = enteringOutput; segment.inputIn = enteringInput; segment.bump = 0;
    if (segment.type === 'drive') { enteringOutput = segment.engine[1] / ratioOf(segment.gear); enteringInput = segment.engine[1]; }
    if (segment.type === 'shift') enteringInput = segment.to === 'N' ? enteringInput : enteringOutput * ratioOf(segment.to);
    if (segment.type === 'coast') { enteringOutput = 0; enteringInput = 0; }
  }
  const segmentAt = t => {
    let low = 0, high = segments.length - 1;
    while (low < high) { const mid = (low + high + 1) >> 1; if (segments[mid].t0 <= t) low = mid; else high = mid - 1; }
    return segments[low];
  };
  /** Speeds in rev/s at time t (seconds, within [0, duration]). */
  function speeds(t) {
    const s = segmentAt(t), u = (t - s.t0) / (s.t1 - s.t0);
    if (s.type === 'hold') return { input: 0, output: 0 };
    if (s.type === 'drive') {
      const input = s.engine[0] + (s.engine[1] - s.engine[0]) * smooth(u);
      return { input, output: input / ratioOf(s.gear) };
    }
    if (s.type === 'coast') { const k = 1 - smooth(u); return { input: s.inputIn * k, output: s.outputIn * k }; }
    const output = s.outputIn, from = s.from === 'N' ? s.inputIn : output * ratioOf(s.from);
    const to = s.to === 'N' ? from : output * ratioOf(s.to), w = window(SHIFT_PHASES.sync, u);
    const bump = s.bump * smoothRate(window(ALIGN_WINDOW, u)) / ((ALIGN_WINDOW[1] - ALIGN_WINDOW[0]) * (s.t1 - s.t0)) / TAU;
    return { input: from + (to - from) * smooth(w) + bump, output };
  }
  const count = Math.round(duration * GRID_HZ) + 1, dt = duration / (count - 1);
  const thetaIn = new Float64Array(count), thetaOut = new Float64Array(count);
  const integrate = () => {
    let previous = speeds(0);
    for (let i = 1; i < count; i++) {
      const next = speeds(Math.min(duration, i * dt));
      thetaIn[i] = thetaIn[i - 1] + TAU * dt * (previous.input + next.input) / 2;
      thetaOut[i] = thetaOut[i - 1] + TAU * dt * (previous.output + next.output) / 2;
      previous = next;
    }
  };
  const sample = (table, t) => {
    const x = Math.max(0, Math.min(count - 1, t / dt)), i = Math.min(count - 2, Math.floor(x)), f = x - i;
    return table[i] + (table[i + 1] - table[i]) * f;
  };
  // Solve each engagement's alignment in order; later angles depend on earlier ones.
  integrate();
  const alignments = [];
  for (const s of segments) {
    if (s.type !== 'shift' || s.to === 'N') continue;
    const tAlign = s.t0 + SHIFT_PHASES.sync[1] * (s.t1 - s.t0), multiplier = engagedMultiplier(s.to);
    const error = sample(thetaOut, tAlign) - multiplier * sample(thetaIn, tAlign);
    const wrapped = error - DOG_PITCH * Math.round(error / DOG_PITCH);
    // At rest a speed bump would spin a stationary input; rest engagements
    // must already be aligned and are checked below like every other.
    if (s.outputIn !== 0 || s.inputIn !== 0) {
      // Any whole number of dog pitches aligns equally well. Pick the
      // adjustment with the lowest peak input speed that never reverses it.
      const candidates = [-2, -1, 0, 1, 2].map(k => (wrapped + k * DOG_PITCH) / multiplier).map(bump => {
        s.bump = bump; let peak = 0, low = Infinity;
        for (let i = 0; i <= 200; i++) { const t = s.t0 + (ALIGN_WINDOW[0] + (ALIGN_WINDOW[1] - ALIGN_WINDOW[0]) * i / 200) * (s.t1 - s.t0), v = speeds(t).input; peak = Math.max(peak, Math.abs(v)); low = Math.min(low, v); }
        return { bump, peak, reverses: low < -1e-12 };
      }).filter(candidate => !candidate.reverses).sort((a, b) => a.peak - b.peak);
      if (!candidates.length) throw new Error(`No non-reversing alignment for ${s.to}; lengthen the shift.`);
      s.bump = candidates[0].bump; integrate();
    }
    alignments.push({ to: s.to, time: tAlign, multiplier, inputAdjustment: s.bump });
  }
  for (const record of alignments) {
    const error = sample(thetaOut, record.time) - record.multiplier * sample(thetaIn, record.time);
    record.residual = Math.abs(error - DOG_PITCH * Math.round(error / DOG_PITCH));
    if (record.residual > 1e-6) throw new Error(`Dog alignment failed for ${record.to}: ${record.residual}`);
  }

  /** Complete mechanical state at absolute time t (seconds within one loop). */
  function stateAt(t) {
    if (!Number.isFinite(t) || t < 0 || t > duration + 1e-9) throw new RangeError('Drive time must lie within one loop.');
    const s = segmentAt(t), u = clamp01((t - s.t0) / (s.t1 - s.t0));
    const sleeves = { s12: 0, s34: 0, s5r: 0 }, rings = { s12: 0, s34: 0, s5r: 0 };
    let engaged = null, path = [];
    const gearBefore = s.type === 'shift' ? s.from : (s.gear ?? 'N');
    if (s.type === 'shift') {
      const from = synchroOf(s.from), to = synchroOf(s.to);
      const release = 1 - smooth(window(SHIFT_PHASES.release, u));
      if (from) { sleeves[from] += sideOf(s.from) * SLEEVE_TRAVEL * release; rings[from] += sideOf(s.from) * RING_GAP * .7 * release; }
      if (to) {
        const approach = smooth(window(SHIFT_PHASES.approach, u)), engage = smooth(window(SHIFT_PHASES.engage, u));
        sleeves[to] += sideOf(s.to) * SLEEVE_TRAVEL * (.42 * approach + .58 * engage);
        rings[to] += sideOf(s.to) * RING_GAP * .7 * approach;
      }
      const leaving = 1 - smooth(window([0, .25], u)), arriving = smooth(window([.75, 1], u));
      if (s.from !== 'N') path.push({ gear: s.from, weight: leaving });
      if (s.to !== 'N') path.push({ gear: s.to, weight: arriving });
      engaged = u < .25 ? (s.from === 'N' ? null : s.from) : u >= .75 ? (s.to === 'N' ? null : s.to) : null;
    } else if (gearBefore !== 'N') {
      const synchro = synchroOf(gearBefore);
      sleeves[synchro] = sideOf(gearBefore) * SLEEVE_TRAVEL; rings[synchro] = sideOf(gearBefore) * RING_GAP * .7;
      engaged = gearBefore; path = [{ gear: gearBefore, weight: 1 }];
    }
    const { input, output } = speeds(Math.min(t, duration));
    return {
      time: t, segment: s.type, gearFrom: s.type === 'shift' ? s.from : gearBefore, gearTo: s.type === 'shift' ? s.to : gearBefore, shiftProgress: s.type === 'shift' ? u : null,
      engaged, path, thetaIn: sample(thetaIn, t), thetaOut: sample(thetaOut, t), inputSpeed: input, outputSpeed: output, sleeves, rings,
    };
  }
  return { duration, segments: Object.freeze(segments.map(Object.freeze)), alignments: Object.freeze(alignments.map(Object.freeze)), stateAt, speeds };
}

/** Rotation angle about +X of every rotating role, from the two driving angles. */
export function memberAngles(thetaIn, thetaOut) {
  const angles = { input: thetaIn, counter: TRAIN.counter * thetaIn, idler: TRAIN.idler * thetaIn, output: thetaOut };
  for (const key of ['main1', 'main2', 'main3', 'main5', 'mainR']) angles[key] = TRAIN[key] * thetaIn;
  for (const bearing of Object.values(BEARINGS)) {
    const shaft = bearing.shaft === 'main' ? thetaOut : bearing.shaft === 'counter' ? angles.counter : thetaIn;
    angles[`inner:${bearing.id}`] = shaft;
    angles[`cage:${bearing.id}`] = bearingGeometry(bearing).cageRatio * shaft;
  }
  return angles;
}

/** Shift lever: lateral gate by the selected rail, fore/aft by its travel. */
export function leverAngles(sleeves) {
  const rails = Object.values(SYNCHROS), weights = rails.map(rail => Math.abs(sleeves[rail.id]) / SLEEVE_TRAVEL);
  const total = weights.reduce((sum, value) => sum + value, 0);
  const lateral = total > 1e-9 ? rails.reduce((sum, rail, i) => sum + rail.rail[1] * weights[i], 0) / total : 0;
  const foreAft = rails.reduce((sum, rail) => sum + sleeves[rail.id], 0) / SLEEVE_TRAVEL;
  return { lateral: lateral / 0.026 * 0.16, foreAft: -foreAft * 0.22 };
}
