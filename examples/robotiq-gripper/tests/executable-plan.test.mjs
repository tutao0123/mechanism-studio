import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createGripperPresentation as createPresentation } from '../presentation.mjs';

const index = JSON.parse(await readFile(new URL('../assets/scene-index.json', import.meta.url)));
const reference = JSON.parse(await readFile(new URL('./fixtures/presentation-reference.json', import.meta.url)));
const presentation = createPresentation(index), { timeline, plan } = presentation;
const canonical = value => typeof value === 'number' ? Math.round(value * 1e8) / 1e8
  : Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const weights = cues => Object.fromEntries([...new Set(cues.map(cue => cue.id))].sort()
  .map(id => [id, Math.max(...cues.filter(cue => cue.id === id).map(cue => cue.weight))]).filter(([, weight]) => weight > 1e-7));

test('compiled presentation preserves the dense pre-migration reference and reviewed cameras', () => {
  const boundaries = plan.chapters.flatMap(chapter => [chapter.firstBeat * 60 / timeline.BPM, chapter.lastBeat * 60 / timeline.BPM,
    ...plan.annotations.windows[chapter.id].flatMap(window => window.map(time => chapter.firstBeat * 60 / timeline.BPM + time))]);
  const times = Array.from({ length: 1801 }, (_, i) => (i - 100) * timeline.DURATION / 1600)
    .filter(time => boundaries.every(boundary => Math.abs(timeline.normalizeTime(time) - boundary) > 1e-6));
  assert.equal(times.length, reference.sampleCount);
  const rows = times.map(t => {
    const state = timeline.stateAt(t), labels = presentation.annotations.annotationCues(state);
    return { t, state, labels, paused: presentation.annotations.annotationCues(state, { paused: true }),
      poses: presentation.workingPoses(state), cues: presentation.appearanceCues(state, labels),
      opacity: null };
  });
  const actual = {
    presentation: rows.map(row => ({ t: row.t, chapter: row.state.chapter.id,
      progress: Object.fromEntries(reference.progress.map(key => [key, row.state.progress[key]])), offsets: row.state.offsetsWorld })),
    mechanics: rows.map(row => ({ poses: row.poses, drive: row.state.drive, driverAngle: row.state.driverAngle })),
    annotations: rows.map(row => ({ labels: row.labels, paused: row.paused })),
    appearance: rows.map(row => ({ cues: weights(row.cues), opacity: row.opacity })),
    cameras: timeline.CHAPTERS.flatMap(chapter => [16 / 9, 2.38, 1, 9 / 16, 1.049, 1.05].map(aspect => ({
      chapter: chapter.id, aspect, ...presentation.framing.cameraFor(chapter.id, aspect),
    }))),
  };
  for (const [domain, values] of Object.entries(actual)) assert.equal(digest(values), reference.hashes[domain], domain);
});

test('editing serialized plan data changes the actual adapter, with source and mechanical poses preserved', () => {
  const sourceBefore = JSON.stringify(index), edited = JSON.parse(JSON.stringify(plan));
  edited.offsets.find(entry => entry.channel === 'drivers').vectors['mjcf:right_driver'][0] += .012;
  edited.cameras.detail.fillX *= .8;
  edited.cameras.detail.narrow.fillX *= .8;
  edited.appearance.labelWeight = .25;
  edited.annotations.windows.detail.forEach((window, i) => { window[0] = timeline.stateAt(16).localTime + .1 + i * .1; });
  edited.appearance.opacity = [{ channel: 'drivers', ids: ['mjcf:right_driver'], minimum: .4 }];
  const changed = createPresentation(index, { plan: edited }), before = timeline.stateAt(16), after = changed.timeline.stateAt(16);
  assert.ok(Math.abs(after.offsetsWorld['mjcf:right_driver'][0] - before.offsetsWorld['mjcf:right_driver'][0] - .012) < 1e-12);
  assert.deepEqual(changed.workingPoses(after), presentation.workingPoses(before));
  assert.ok(changed.framing.cameraFor('detail', .2).halfHeight > presentation.framing.cameraFor('detail', .2).halfHeight);
  assert.ok(!changed.annotations.annotationCues(after, { paused: true }).some(cue => cue.id === 'mjcf:right_driver'));
  assert.deepEqual(changed.appearanceCues(after, [{ id: 'mjcf:right_driver', opacity: .8 }]), [{ id: 'mjcf:right_driver', weight: .2 }]);
  assert.ok(Math.abs(changed.presentationOpacity(changed.timeline.stateAt(16), 'mjcf:right_driver') - .4) < 1e-12);
  assert.equal(JSON.stringify(index), sourceBefore);
  assert.ok(Object.isFrozen(changed.plan.offsets[0].vectors));
});

test('reverse seeks, inspect labels, exact chapter boundaries and the loop share one immutable plan', () => {
  const roundtrip = createPresentation(index, { plan: JSON.parse(JSON.stringify(plan)) });
  const times = [0, timeline.DURATION - 1e-6, 16, 4.25, -3, timeline.DURATION * 2 + 16];
  const expected = times.map(time => timeline.stateAt(time));
  for (let i = times.length - 1; i >= 0; i--) assert.deepEqual(roundtrip.timeline.stateAt(times[i]), expected[i]);
  for (const chapter of timeline.CHAPTERS) assert.equal(timeline.stateAt(chapter.firstBeat * 60 / timeline.BPM).chapter.id, chapter.id);
  assert.deepEqual(timeline.stateAt(0), timeline.stateAt(timeline.DURATION));
  assert.deepEqual(timeline.stateAt(-1), timeline.stateAt(timeline.DURATION - 1));
  const reading = timeline.stateAt(16);
  assert.ok(presentation.annotations.annotationCues(reading, { paused: true }).every(cue => cue.opacity === 1));
  assert.deepEqual(presentation.annotations.annotationCues(reading, { paused: true, cameraSettled: false }), []);
});
