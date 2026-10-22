import test from 'node:test';
import assert from 'node:assert/strict';
import { compilePresentationPlan, PRESENTATION_PLAN_SCHEMA } from '../plan.mjs';

const index = () => ({ geometryRevision: 'fixture-geometry-1', parts: [{ id: 'a' }, { id: 'b' }, { id: 'still' }] });
const camera = () => ({ bounds: { min: [-2, -1, -.5], max: [2, 1, .5] }, direction: [0, 0, 1], fillX: .8, fillY: .75, minHalfHeight: .1,
  narrow: { belowAspect: 1, fillX: .5, fillY: .6 } });
function fixture() {
  return { schemaVersion: PRESENTATION_PLAN_SCHEMA, id: 'seekable-study', geometryRevision: 'fixture-geometry-1', bpm: 60, durationSeconds: 8,
    chapters: [
      { id: 'open', firstBeat: 0, lastBeat: 4, title: 'Open.', copy: 'Separate the parts.', labels: [['a', 'First part'], ['b', { index: '02', name: 'Second part', spec: 'Two faces' }]] },
      { id: 'close', firstBeat: 4, lastBeat: 8, title: 'Close.', copy: '', labels: [['a', 'First part']] },
    ],
    channels: {
      lift: { rise: [1, 2], fall: [6, 7] },
      slide: { rise: [2, 3], fall: [5, 6] },
      hiddenLift: { rise: [0, 1], fall: [6, 7], cutoff: 4.5 },
    },
    offsets: [
      { channel: 'lift', vectors: { a: [1, 0, 0], b: [0, 0, 1] } },
      { channel: 'slide', vectors: { a: [0, 2, 0], b: [0, 0, 1] } },
    ],
    annotations: { windows: { open: [[1.25, 3.5], [2, 3.5]], close: [[.5, 3]] }, fadeInSeconds: .2, fadeOutSeconds: .4 },
    cameras: { open: camera(), close: { ...camera(), distance: 20 } },
    appearance: { labelWeight: .5, accents: [{ channel: 'lift', ids: ['a'], weight: .6 }, { channel: 'slide', ids: ['a', 'b'], weight: .8 }],
      opacity: [{ channel: 'lift', ids: ['a'], minimum: .2 }, { channel: 'slide', ids: ['a'], minimum: .4 }] },
  };
}
const compile = (plan = fixture(), source = index()) => compilePresentationPlan(plan, source);
const close = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-10, `${message}: ${actual} ≠ ${expected}`);

test('channels use quintic motion, sum world offsets and leave all unplanned parts at zero', () => {
  const runtime = compile();
  const quarter = runtime.stateAt(1.25);
  close(quarter.progress.lift, .103515625);
  assert.deepEqual(quarter.offsetsWorld.a, [.103515625, 0, 0]);
  const halfway = runtime.stateAt(2.5);
  assert.deepEqual(halfway.offsetsWorld.a, [1, 1, 0]);
  assert.deepEqual(halfway.offsetsWorld.b, [0, 0, 1.5]);
  assert.deepEqual(halfway.offsetsWorld.still, [0, 0, 0]);
  assert.equal(runtime.stateAt(4.499).progress.hiddenLift, 1);
  assert.equal(runtime.stateAt(4.5).progress.hiddenLift, 0, 'an explicit cutoff resets only that channel');
  close(runtime.stateAt(6.5).progress.lift, .5);
  for (const seconds of [0, 7, 8]) assert.ok(Object.values(runtime.stateAt(seconds).offsetsWorld).flat().every(n => n === 0));
});

test('absolute-time seeks, restart and negative loops reproduce every output without history', () => {
  const runtime = compile(), times = [0, .5, 1.75, 2.8, 3.999, 4, 4.5, 5.5, 6.7, 7.999];
  const sample = seconds => {
    const state = runtime.stateAt(seconds), labels = runtime.annotations.annotationCues(state);
    return { state, labels, accents: runtime.appearanceCues(state, labels), opacity: ['a', 'b', 'still'].map(id => runtime.presentationOpacity(state, id)), camera: runtime.framing.cameraFor(state.chapter.id, .6) };
  };
  const reference = times.map(sample);
  for (const i of [9, 0, 5, 1, 8, 2, 7, 3, 6, 4, 0, 9]) assert.deepEqual(sample(times[i]), reference[i]);
  for (const seconds of [-16, -8, 0, 8, 24]) assert.deepEqual(sample(seconds), reference[0]);
  assert.deepEqual(runtime.stateAt(-2.5), runtime.stateAt(5.5));
  assert.equal(runtime.stateAt(4 - 1e-12).chapter.id, 'close', 'near-integer beats snap consistently');
  assert.equal(runtime.stateAt(4).localTime, 0);
  assert.equal(runtime.stateAt(4).chapterIndex, 1);
  for (const value of [NaN, Infinity, -Infinity, '2', undefined]) assert.throws(() => runtime.stateAt(value), /finite/);
});

test('compilation snapshots and deeply freezes JSON without freezing or retaining the caller data', () => {
  const plan = fixture(), source = index(), runtime = compile(plan, source), before = runtime.stateAt(2.5);
  assert.notEqual(runtime.plan, plan);
  assert.equal(Object.isFrozen(plan), false);
  assert.equal(Object.isFrozen(source), false);
  plan.channels.lift.rise[0] = 0;
  plan.offsets[0].vectors.a[0] = 99;
  plan.chapters[0].labels[1][1].name = 'Changed';
  source.parts[0].id = 'changed';
  source.geometryRevision = 'changed';
  assert.deepEqual(runtime.stateAt(2.5), before);
  assert.equal(runtime.plan.chapters[0].labels[1][1].name, 'Second part');
  assert.throws(() => { runtime.plan.offsets[0].vectors.a[0] = 10; }, TypeError);
  assert.throws(() => { runtime.CHAPTERS[0].labels[1][1].name = 'Changed'; }, TypeError);
  assert.throws(() => { runtime.annotations.CUE_WINDOWS.open[0][0] = 10; }, TypeError);
  const returned = runtime.stateAt(2.5); returned.progress.lift = 0; returned.offsetsWorld.a[0] = 77;
  assert.deepEqual(runtime.stateAt(2.5), before, 'each sampled mutable state is independent');
  const pose = runtime.framing.cameraFor('open', 2); pose.target[0] = 100;
  assert.equal(runtime.framing.cameraFor('open', 2).target[0], 0);
  assert.deepEqual(compile(JSON.parse(JSON.stringify(runtime.plan))).stateAt(2.5), before, 'JSON round trips preserve execution');
});

test('fixed camera envelopes fit all eight corners at wide and narrow aspects', () => {
  const runtime = compile();
  for (const aspect of [2, 1, .6, .3]) {
    const pose = runtime.framing.cameraFor('open', aspect), fill = aspect < 1 ? runtime.plan.cameras.open.narrow : runtime.plan.cameras.open;
    for (const x of [-2, 2]) for (const y of [-1, 1]) for (const z of [-.5, .5]) {
      assert.ok(Math.abs(x) <= pose.halfHeight * aspect * fill.fillX + 1e-12);
      assert.ok(Math.abs(y) <= pose.halfHeight * fill.fillY + 1e-12);
      assert.ok(pose.position[2] > z);
    }
    close(pose.halfHeight, Math.max(1 / fill.fillY, 2 / (aspect * fill.fillX), .1));
    assert.deepEqual(runtime.framing.cameraFor('open', aspect, 3), pose, 'time never auto-fits moving geometry');
    assert.deepEqual(runtime.framing.annotationCameraFor('open', aspect), pose);
  }
  assert.equal(runtime.framing.cameraFor('close', 2).position[2], 20);
  assert.throws(() => runtime.framing.cameraFor('missing', 1), /unknown camera chapter/);
  for (const aspect of [0, -1, NaN, Infinity]) assert.throws(() => runtime.framing.cameraFor('open', aspect), /positive|finite/);
  assert.throws(() => runtime.framing.cameraFor('open', 1, -1), /negative/);
});

test('oblique cameras project the full envelope and preserve an explicit up hint', () => {
  const plan = fixture(); plan.cameras.open.direction = [1, 2, 3]; plan.cameras.open.up = [0, 0, 2];
  plan.cameras.close.direction = [1, 2, 3]; plan.cameras.close.up = [0, 0, 1];
  const runtime = compile(plan), aspect = .7, pose = runtime.framing.cameraFor('open', aspect);
  assert.deepEqual(pose.up, [0, 0, 1]);
  assert.deepEqual(runtime.cameraUp, [0, 0, 1]);
  assert.equal(Object.isFrozen(runtime.cameraUp), true);
  const normalize = values => values.map(n => n / Math.hypot(...values));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);
  const direction = normalize(pose.position.map((n, i) => n - pose.target[i])), right = normalize(cross(pose.up, direction)), up = normalize(cross(direction, right));
  for (const x of [-2, 2]) for (const y of [-1, 1]) for (const z of [-.5, .5]) {
    const point = [x, y, z];
    assert.ok(Math.abs(dot(point, right)) <= pose.halfHeight * aspect * .5 + 1e-12);
    assert.ok(Math.abs(dot(point, up)) <= pose.halfHeight * .6 + 1e-12);
  }
});

test('labels reveal in authored order, remain together, fade out and wait for the camera', () => {
  const runtime = compile(), cues = seconds => runtime.annotations.annotationCues(runtime.stateAt(seconds));
  assert.deepEqual(cues(1.24), []);
  assert.equal(cues(1.25)[0].opacity, 0);
  close(cues(1.35)[0].opacity, .5);
  assert.deepEqual(cues(2.4).map(cue => cue.id), ['a', 'b']);
  assert.equal(cues(2.4)[1].text.name, 'Second part');
  close(cues(3.4)[0].opacity, .25);
  assert.deepEqual(cues(3.5), []);
  assert.deepEqual(cues(4), []);
  assert.deepEqual(runtime.annotations.annotationCues(runtime.stateAt(2.4), { cameraSettled: false }), []);
  assert.equal(runtime.annotations.annotationCues(runtime.stateAt(1.25), { paused: true })[0].opacity, 1);
  assert.deepEqual(runtime.annotations.annotationCues(runtime.stateAt(1.24), { paused: true }), [], 'pause does not bypass cue windows');
  assert.deepEqual(runtime.annotations.annotationCues(runtime.stateAt(2.4), { paused: true, cameraSettled: false }), []);
});

test('appearance combines declared weights and restores complete baseline after reverse seeks', () => {
  const runtime = compile(), labels = [{ id: 'a', opacity: 1 }];
  assert.deepEqual(runtime.appearanceCues(runtime.stateAt(0), labels), [{ id: 'a', weight: .5 }]);
  assert.deepEqual(runtime.appearanceCues(runtime.stateAt(2.5), labels), [{ id: 'a', weight: .6 }, { id: 'b', weight: .4 }]);
  assert.deepEqual(runtime.appearanceCues(runtime.stateAt(3), labels), [{ id: 'a', weight: .8 }, { id: 'b', weight: .8 }]);
  close(runtime.presentationOpacity(runtime.stateAt(2.5), 'a'), .2, 'strongest independent fade wins');
  assert.equal(runtime.presentationOpacity(runtime.stateAt(3), 'still'), 1);
  for (const seconds of [7, 0, 8, 0]) {
    assert.deepEqual(runtime.appearanceCues(runtime.stateAt(seconds)), []);
    for (const id of ['a', 'b', 'still']) assert.equal(runtime.presentationOpacity(runtime.stateAt(seconds), id), 1);
  }
  assert.throws(() => runtime.appearanceCues(runtime.stateAt(0), [{ id: 'missing', opacity: 1 }]), /unknown part ID/);
  assert.throws(() => runtime.presentationOpacity(runtime.stateAt(0), 'missing'), /unknown part ID/);
});

test('invalid bindings, unknown fields and inconsistent timing fail during compilation', () => {
  const cases = [
    ['schema', p => { p.schemaVersion = 'future'; }, /unsupported schema/],
    ['revision', p => { p.geometryRevision = 'another'; }, /geometryRevision/],
    ['unknown field', p => { p.duration = 8; }, /unknown field/],
    ['nested typo', p => { p.cameras.open.fill = .9; }, /unknown field/],
    ['empty chapter', p => { p.chapters = []; }, /empty/],
    ['chapter duplicate', p => { p.chapters[1].id = 'open'; }, /duplicate chapter/],
    ['chapter gap', p => { p.chapters[1].firstBeat = 4.2; }, /contiguous/],
    ['tiny chapter gap', p => { p.chapters[1].firstBeat = 4 + 1e-12; }, /contiguous/],
    ['chapter overlap', p => { p.chapters[1].firstBeat = 3.9; }, /contiguous/],
    ['duration gap', p => { p.durationSeconds = 9; }, /full duration/],
    ['unknown label', p => { p.chapters[0].labels[0][0] = 'missing'; }, /unknown part ID/],
    ['duplicate label', p => { p.chapters[0].labels[1][0] = 'a'; }, /duplicate label/],
    ['too many labels', p => { p.chapters[0].labels.push(['still', 'Third part']); }, /at most two/],
    ['label typo', p => { p.chapters[0].labels[1][1].specification = 'ignored'; }, /unknown field/],
    ['unknown offset', p => { p.offsets[0].vectors.missing = [0, 0, 0]; }, /unknown part ID/],
    ['unknown channel', p => { p.offsets[0].channel = 'missing'; }, /unknown channel/],
    ['vector length', p => { p.offsets[0].vectors.a = [1, 2]; }, /three components/],
    ['vector infinity', p => { p.offsets[0].vectors.a[0] = Infinity; }, /finite/],
    ['reverse rise', p => { p.channels.lift.rise = [2, 1]; }, /ordered/],
    ['fall before rise', p => { p.channels.lift.fall = [0, 1]; }, /follow its rise/],
    ['cutoff outside', p => { p.channels.lift.cutoff = 9; }, /within the timeline/],
    ['missing windows', p => { delete p.annotations.windows.close; }, /missing chapter/],
    ['unknown windows', p => { p.annotations.windows.missing = []; }, /unknown chapter/],
    ['window label mismatch', p => { p.annotations.windows.open.pop(); }, /match labels/],
    ['window order', p => { p.annotations.windows.open = [[2, 3.5], [1.5, 3.5]]; }, /label order/],
    ['window outside chapter', p => { p.annotations.windows.close = [[1, 5]]; }, /ordered/],
    ['zero fade', p => { p.annotations.fadeInSeconds = 0; }, /positive/],
    ['unknown camera', p => { p.cameras.missing = camera(); }, /unknown chapter/],
    ['missing camera', p => { delete p.cameras.open; }, /missing chapter/],
    ['inverted bounds', p => { p.cameras.open.bounds.min[0] = 3; }, /min must not exceed max/],
    ['zero direction', p => { p.cameras.open.direction = [0, 0, 0]; }, /nonzero/],
    ['parallel up', p => { p.cameras.open.direction = [0, 1, 0]; }, /parallel/],
    ['changing up', p => { p.cameras.open.up = [1, 0, 0]; }, /uniform/],
    ['zero fill', p => { p.cameras.open.fillX = 0; }, /positive/],
    ['narrow fill outside', p => { p.cameras.open.narrow.fillY = 2; }, /at most 1/],
    ['unknown accent channel', p => { p.appearance.accents[0].channel = 'missing'; }, /unknown channel/],
    ['unknown opacity part', p => { p.appearance.opacity[0].ids = ['missing']; }, /unknown part ID/],
    ['duplicate accent part', p => { p.appearance.accents[0].ids = ['a', 'a']; }, /unique/],
    ['weight outside', p => { p.appearance.labelWeight = 1.1; }, /0\.\.1/],
  ];
  for (const [name, mutate, pattern] of cases) { const plan = fixture(); mutate(plan); assert.throws(() => compile(plan), pattern, name); }
  const duplicated = index(); duplicated.parts.push({ id: 'a' }); assert.throws(() => compile(fixture(), duplicated), /unique/);
});

test('plans reject non-JSON inputs instead of silently dropping executable or malformed data', () => {
  const cases = [undefined, () => {}, new Map(), new Date(), Infinity, NaN];
  for (const value of cases) { const plan = fixture(); plan.extra = value; assert.throws(() => compile(plan), /JSON|finite/); }
  const cyclic = fixture(); cyclic.extra = cyclic; assert.throws(() => compile(cyclic), /cycle/);
  const sparse = fixture(); sparse.offsets = new Array(1); assert.throws(() => compile(sparse), /dense/);
  const accessor = fixture(); Object.defineProperty(accessor, 'extra', { get() { throw new Error('must never execute'); }, enumerable: true });
  assert.throws(() => compile(accessor), /enumerable JSON value/);
});

test('authored IDs and channel names cannot write through object prototypes', () => {
  const rename = value => JSON.parse(JSON.stringify(value).replaceAll('"a"', '"__proto__"').replaceAll('"lift"', '"constructor"').replaceAll('"open"', '"toString"'));
  const runtime = compile(rename(fixture()), rename(index())), state = runtime.stateAt(2.5);
  assert.equal(Object.getPrototypeOf(state.offsetsWorld), Object.prototype);
  assert.equal(Object.hasOwn(state.offsetsWorld, '__proto__'), true);
  assert.deepEqual(state.offsetsWorld.__proto__, [1, 1, 0]);
  assert.equal(state.progress.constructor, 1);
  assert.equal(state.chapter.id, 'toString');
  assert.ok(runtime.framing.cameraFor('toString', 1).halfHeight > 0);
  assert.ok(runtime.annotations.annotationCues(state).some(cue => cue.id === '__proto__'));
  close(runtime.presentationOpacity(state, '__proto__'), .2);
  assert.deepEqual(Object.keys(Object.prototype), []);
});
