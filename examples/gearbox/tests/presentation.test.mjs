import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createGearboxStory, CHAPTERS, DURATION, BPM, SCHEDULE } from '../story.mjs';
import { createGearboxFraming } from '../framing.mjs';
import { CUE_WINDOWS, annotationCues } from '../annotations.mjs';

const read = path => readFile(new URL(path, import.meta.url));
const index = JSON.parse(await read('../assets/scene-index.json'));
const story = createGearboxStory(index), framing = createGearboxFraming(index, story);
const casePart = id => story.caseParts.has(id);
const sample = (from, to, steps) => Array.from({ length: steps + 1 }, (_, i) => from + (to - from) * i / steps);

test('a 40-second Showcase loop with contiguous chapters and at most two names each', () => {
  assert.equal(DURATION, 40);
  assert.ok(DURATION >= 30 && DURATION <= 40);
  CHAPTERS.forEach((chapter, i) => {
    assert.equal(chapter.firstBeat, i ? CHAPTERS[i - 1].lastBeat : 0);
    assert.ok(chapter.labels.length <= 2, chapter.id);
    for (const [start, end] of CUE_WINDOWS[chapter.id]) assert.ok(start >= 0 && end > start && end <= (chapter.lastBeat - chapter.firstBeat) * 60 / BPM + 1e-9, chapter.id);
  });
  assert.equal(CHAPTERS.at(-1).lastBeat * 60 / BPM, DURATION);
});

test('every named part stays put while its name is shown (rotation about its own axis allowed)', () => {
  for (const chapter of CHAPTERS) chapter.labels.forEach(([id], i) => {
    const [start, end] = CUE_WINDOWS[chapter.id][i], t0 = chapter.firstBeat * 60 / BPM;
    const reference = story.stateAt(t0 + start), poseAt = state => story.workingPoses(state)[id]?.position ?? [0, 0, 0];
    for (const t of sample(t0 + start, t0 + end - 1e-6, 60)) {
      const state = story.stateAt(t);
      assert.deepEqual(state.offsetsWorld[id].map(v => v.toFixed(9)), reference.offsetsWorld[id].map(v => v.toFixed(9)), `${id} display offset at ${t}`);
      assert.deepEqual(poseAt(state).map(v => v.toFixed(9)), poseAt(reference).map(v => v.toFixed(9)), `${id} working translation at ${t}`);
      assert.ok(story.presentationOpacity(state, id) >= .5, `${id} visible enough to name`);
    }
  });
});

test('the loop seam matches: rest offsets, closed case, neutral and one camera', () => {
  const first = story.stateAt(0), last = story.stateAt(DURATION - 1e-6);
  for (const state of [first, last]) {
    for (const [id, offset] of Object.entries(state.offsetsWorld)) assert.ok(offset.every(v => Math.abs(v) < 1e-9), `${id} at rest`);
    for (const part of index.parts) assert.equal(story.presentationOpacity(state, part.id), 1);
    assert.equal(state.drive.engaged, null);
  }
  for (const aspect of [16 / 9, 2.38, 1]) assert.deepEqual(framing.cameraFor('whole', aspect), framing.cameraFor('close', aspect));
  assert.deepEqual(annotationCues(story.stateAt(DURATION - .01)), []);
});

test('the case is fully hidden inside, and the close-up fades only context', () => {
  for (const chapter of ['explode', 'low', 'sync', 'over']) {
    const c = CHAPTERS.find(x => x.id === chapter), state = story.stateAt((c.firstBeat + 1) * 60 / BPM);
    for (const part of index.parts.filter(p => casePart(p.id))) assert.equal(story.presentationOpacity(state, part.id), 0, `${part.id} in ${chapter}`);
  }
  const reading = story.stateAt(35 * 60 / BPM);
  for (const id of story.FOCUS.ids) assert.equal(story.presentationOpacity(reading, id), 1);
  assert.ok(Math.abs(story.presentationOpacity(reading, 'gb:main/gear-1') - story.FOCUS.context) < 1e-9);
  assert.equal(story.presentationOpacity(story.stateAt(47 * 60 / BPM), 'gb:main/gear-1'), 1, 'context restored after the close-up');
});

test('the accent follows the real power path: fourth bypasses the countershaft', () => {
  const at = gear => { const segment = SCHEDULE.find(s => s.type === 'drive' && s.gear === gear); return story.stateAt((segment.t0 + segment.t1) / 2); };
  const accented = state => new Set(story.appearanceCues(state, []).filter(c => c.weight > .5).map(c => c.id));
  const first = accented(at('1')), fourth = accented(at('4')), fifth = accented(at('5'));
  for (const id of ['gb:input/shaft', 'gb:counter/gear-drive', 'gb:counter/gear-1', 'gb:main/gear-1', 'gb:main/synchro-s12/sleeve', 'gb:main/shaft']) assert.ok(first.has(id), id);
  assert.ok(!first.has('gb:main/gear-2'));
  assert.ok(fourth.has('gb:main/synchro-s34/sleeve') && !fourth.has('gb:counter/shaft') && !fourth.has('gb:main/gear-3'));
  assert.ok(fifth.has('gb:main/gear-5') && fifth.has('gb:counter/gear-5'));
  // While the sleeve crosses neutral nothing carries torque.
  const shift = SCHEDULE.find(s => s.type === 'shift' && s.from === '3');
  assert.equal(accented(story.stateAt(shift.t0 + .5 * (shift.t1 - shift.t0))).size, 0);
});

test('planned cameras are finite and tighten from explosion to close-up', () => {
  for (const chapter of CHAPTERS) for (const aspect of [16 / 9, 2.38, 1, 9 / 16]) {
    const plan = framing.cameraFor(chapter.id, aspect);
    assert.ok([...plan.position, ...plan.target, plan.halfHeight].every(Number.isFinite) && plan.halfHeight > 0, `${chapter.id} @ ${aspect}`);
  }
  const h = id => framing.cameraFor(id, 2.38).halfHeight;
  assert.ok(h('sync') < h('low') && h('low') < h('explode'));
  assert.throws(() => framing.cameraFor('unknown', 1));
});

test('the score is the delivered file and its cues sit on real engagements', async () => {
  const score = JSON.parse(await read('../audio/music-score.json')), wav = await read('../audio/gearbox-loop.wav');
  assert.equal(score.bpm, BPM); assert.equal(score.durationSeconds, DURATION); assert.equal(score.geometryRevision, index.geometryRevision);
  assert.equal(score.byteLength, wav.length); assert.equal(score.sha256, createHash('sha256').update(wav).digest('hex'));
  assert.equal(wav.readUInt32LE(40), score.frames * 4); assert.equal(score.frames, 44100 * 40);
  for (const cue of score.effects.actionCues.filter(c => c.cueRole === 'engagement')) {
    const shift = SCHEDULE.find(s => s.type === 'shift' && s.to === cue.id.replace('engage-', ''));
    assert.ok(cue.seconds > shift.t0 && cue.seconds < shift.t1, cue.id);
  }
  assert.equal(score.analysis.clippedSamples, 0); assert.ok(score.analysis.peakDbfs <= -8);
  assert.ok(score.analysis.loopBoundary.ratioToMaximumInteriorStep < .5);
  assert.equal(score.analysis.listeningReviewed, false);
});
