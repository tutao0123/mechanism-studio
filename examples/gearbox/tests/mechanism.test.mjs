import test from 'node:test';
import assert from 'node:assert/strict';
import { TEETH, GEARS, AXES, LAYOUT, CENTRE_DISTANCE, PAIR_TEETH_SUM, SYNCHROS, SLEEVE_TRAVEL, pitchRadius, tipRadius } from '../spec.mjs';
import { TRAIN, DOG_PITCH, gearPhases, createDrive, engagedMultiplier, leverAngles, memberAngles } from '../kinematics.mjs';
import { SCHEDULE, DURATION } from '../story.mjs';

const TAU = 2 * Math.PI;
const wrap = (value, period) => value - period * Math.round(value / period);
const MESHES = [
  ['input', 'counterDrive', 'main', 'counter'],
  ['counter1', 'main1', 'counter', 'main'], ['counter2', 'main2', 'counter', 'main'], ['counter3', 'main3', 'counter', 'main'],
  ['counter5', 'main5', 'counter', 'main'], ['counterR', 'idler', 'counter', 'idler'], ['idler', 'mainR', 'idler', 'main'],
];
const multiplier = key => key === 'counterDrive' || key.startsWith('counter') ? TRAIN.counter : TRAIN[key];

test('every countershaft pair shares one centre distance and the ratios follow from the teeth', () => {
  for (const [a, b, axisA, axisB] of MESHES) {
    const distance = Math.hypot(AXES[axisA][0] - AXES[axisB][0], AXES[axisA][1] - AXES[axisB][1]);
    assert.ok(Math.abs(distance - pitchRadius(TEETH[a]) - pitchRadius(TEETH[b])) < 1e-12, `${a}/${b} pitch circles touch`);
    if (axisA !== 'idler' && axisB !== 'idler') assert.equal(TEETH[a] + TEETH[b], PAIR_TEETH_SUM);
  }
  assert.equal(CENTRE_DISTANCE, .081);
  const expected = { 1: 34 / 20 * 37 / 17, 2: 34 / 20 * 30 / 24, 3: 34 / 20 * 24 / 30, 4: 1, 5: 34 / 20 * 17 / 37, R: -34 / 20 * 32 / 16 };
  for (const [id, ratio] of Object.entries(expected)) assert.ok(Math.abs(GEARS[id].ratio - ratio) < 1e-12, id);
  assert.deepEqual(Object.keys(GEARS).filter(id => GEARS[id].ratio > 1).sort(), ['1', '2', '3']);
  assert.ok(GEARS[5].ratio < 1 && GEARS.R.ratio < 0, 'fifth is overdrive and reverse turns the output backwards');
  // The reverse gears face each other without meshing; only the idler joins them.
  assert.ok(CENTRE_DISTANCE - tipRadius(TEETH.counterR) - tipRadius(TEETH.mainR) > .002);
});

test('meshing pitch circles roll without slip and teeth stay interlocked at any input angle', () => {
  const phases = gearPhases();
  for (const [a, b, axisA, axisB] of MESHES) {
    // Equal and opposite pitch-line speed for unit input speed.
    assert.ok(Math.abs(pitchRadius(TEETH[a]) * multiplier(a) + pitchRadius(TEETH[b]) * multiplier(b)) < 1e-12, `${a}→${b} rolls`);
    const ab = Math.atan2(AXES[axisB][1] - AXES[axisA][1], AXES[axisB][0] - AXES[axisA][0]);
    for (const theta of [0, .37, 2.1, -5.8, 41.3]) {
      const phaseA = phases[a] + multiplier(a) * theta, phaseB = phases[b] + multiplier(b) * theta;
      // A tooth of A offset δ from the centre line meets a gap of B offset −(ZA/ZB)δ.
      const expected = ab + Math.PI + Math.PI / TEETH[b] - TEETH[a] / TEETH[b] * (phaseA - ab);
      assert.ok(Math.abs(wrap(phaseB - expected, TAU / TEETH[b])) < 1e-9, `${a}/${b} at θ=${theta}`);
    }
  }
});

test('each gear sits on the synchronizer side its sleeve travels toward', () => {
  for (const gear of Object.values(GEARS)) {
    const x = gear.main === 'input' ? LAYOUT.input.teethCentre : LAYOUT[gear.main].teethCentre;
    assert.equal(Math.sign(x - LAYOUT[gear.synchro].centre), gear.side, gear.label);
  }
  assert.deepEqual(Object.keys(SYNCHROS), ['s34', 's12', 's5r']);
  assert.ok(SLEEVE_TRAVEL > 0 && SLEEVE_TRAVEL < .012);
});

const drive = createDrive(SCHEDULE, DURATION);
const sample = (from, to, steps = 400) => Array.from({ length: steps + 1 }, (_, i) => from + (to - from) * i / steps);

test('engaged gears turn the output at exactly input speed over the ratio', () => {
  for (const segment of SCHEDULE.filter(s => s.type === 'drive')) for (const t of sample(segment.t0, segment.t1, 50)) {
    const { input, output } = drive.speeds(t);
    assert.ok(Math.abs(output * GEARS[segment.gear].ratio - input) < 1e-12, `${segment.gear} at ${t}`);
  }
});

test('output speed is continuous and each engagement aligns sleeve and dog teeth', () => {
  let previous = drive.speeds(0).output;
  for (const t of sample(0, DURATION, 40000)) { const { output } = drive.speeds(t); assert.ok(Math.abs(output - previous) < 1e-3, `jump at ${t}`); previous = output; }
  assert.deepEqual(drive.alignments.map(a => a.to), ['1', '2', '3', '4', '5']);
  for (const record of drive.alignments) assert.ok(record.residual < 1e-6, record.to);
  // From alignment until the next shift releases the sleeve, the locked gear and
  // the mainshaft stay at the same dog phase.
  for (const [i, segment] of SCHEDULE.entries()) {
    if (segment.type !== 'shift' || segment.to === 'N') continue;
    const next = SCHEDULE.slice(i + 1).find(s => s.type === 'shift'), start = segment.t0 + .75 * (segment.t1 - segment.t0), end = next.t0 + .25 * (next.t1 - next.t0);
    for (const t of sample(start, end, 200)) {
      const s = drive.stateAt(t), offset = s.thetaOut - engagedMultiplier(segment.to) * s.thetaIn;
      assert.ok(Math.abs(wrap(offset, DOG_PITCH)) < 1e-6, `${segment.to} dogs at ${t}`);
    }
  }
});

test('the loop starts and ends at rest in neutral, and sampling is deterministic', () => {
  for (const t of [0, DURATION]) {
    const s = drive.stateAt(t);
    assert.equal(s.engaged, null); assert.equal(s.inputSpeed, 0); assert.equal(s.outputSpeed, 0);
    assert.deepEqual(Object.values(s.sleeves), [0, 0, 0]);
    assert.deepEqual(leverAngles(s.sleeves), { lateral: 0, foreAft: -0 });
  }
  const forward = sample(0, DURATION, 97).map(t => JSON.stringify(drive.stateAt(t)));
  const backward = sample(0, DURATION, 97).reverse().map(t => JSON.stringify(drive.stateAt(t))).reverse();
  assert.deepEqual(backward, forward);
  assert.throws(() => drive.stateAt(DURATION + 1), RangeError);
});

test('engaging sleeves reach full travel on the correct side; only one synchronizer is ever engaged', () => {
  for (const segment of SCHEDULE.filter(s => s.type === 'drive')) {
    const s = drive.stateAt((segment.t0 + segment.t1) / 2), gear = GEARS[segment.gear];
    assert.equal(s.sleeves[gear.synchro], gear.side * SLEEVE_TRAVEL);
    assert.equal(Object.values(s.sleeves).filter(value => Math.abs(value) > 1e-12).length, 1);
  }
  for (const t of sample(0, DURATION, 2000)) {
    const s = drive.stateAt(t);
    assert.ok(Object.values(s.sleeves).filter(value => Math.abs(value) > .5 * SLEEVE_TRAVEL).length <= 1, `interlock at ${t}`);
  }
});

test('the schedule validator refuses impossible sequences', () => {
  const ok = [{ type: 'hold', t0: 0, t1: 1 }];
  assert.throws(() => createDrive([...ok, { type: 'drive', gear: '1', engine: [0, .3], t0: 1, t1: 2 }, { type: 'hold', t0: 2, t1: 3 }], 3), /requires that gear engaged/);
  assert.throws(() => createDrive([...ok, { type: 'shift', from: '2', to: '3', t0: 1, t1: 2 }], 2), /Invalid shift/);
  assert.throws(() => createDrive([{ type: 'hold', t0: 0, t1: 1 }, { type: 'hold', t0: 1.5, t1: 2 }], 2), /contiguous/);
  assert.throws(() => createDrive([...ok, { type: 'shift', from: 'N', to: '1', t0: 1, t1: 2 }], 2), /end at rest in neutral/);
});

test('bearing balls orbit at the pure-rolling cage speed and races follow their shafts', () => {
  const a = memberAngles(10, 4);
  assert.equal(a['inner:input'], 10); assert.equal(a['inner:rear'], 4); assert.equal(a['inner:counterFront'], a.counter);
  for (const key of ['input', 'rear', 'counterFront', 'counterRear']) {
    const ratio = a[`cage:${key}`] / a[`inner:${key}`];
    assert.ok(ratio > .35 && ratio < .45, `${key} cage ratio ${ratio}`);
  }
});
