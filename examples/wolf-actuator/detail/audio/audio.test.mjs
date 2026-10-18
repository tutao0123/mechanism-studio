import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWolfMotorDetail } from '../story.mjs';
import { createScore, renderScore, encodeWav, analyzeAudio, sha256, FRAMES, SAMPLE_RATE, BPM, DURATION } from './synth.mjs';

const read = async name => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const index = await read('../../assets/scene-index.json'), story = createWolfMotorDetail(index), expected = createScore(story, index);

test('motor music binds actual v2 movement windows, with one sound per forty-part wave', () => {
  const motions = new Map(story.MOTION_EVENTS.map(event => [event.id, event]));
  assert.equal(expected.bpm, story.BPM); assert.equal(expected.durationSeconds, story.DURATION);
  assert.equal(expected.motionBindings.length, motions.size);
  assert.equal(expected.geometryRevision, index.geometryRevision);
  assert.equal(expected.sourceSHA256, index.sourceSHA256);
  assert.deepEqual(expected.cues.map(cue => [cue.id, cue.firstBeat, cue.lastBeat]), story.CHAPTERS.map(chapter => [chapter.id, chapter.firstBeat, chapter.lastBeat]));
  for (const cue of expected.effects.actionCues) {
    const bound = cue.animation.motionEventIds.map(id => motions.get(id));
    assert.ok(bound.every(Boolean));
    assert.deepEqual(cue.animation.partIds, [...new Set(bound.flatMap(event => event.ids))]);
    assert.equal(cue.animation.firstBeat, Math.min(...bound.map(event => event.startBeat)));
    assert.equal(cue.animation.lastBeat, Math.max(...bound.map(event => event.endBeat)));
    assert.equal(cue.beat, cue.cueRole === 'seating' ? cue.animation.lastBeat : cue.animation.firstBeat);
    assert.equal(cue.seconds, cue.beat * 60 / BPM);
    assert.equal(cue.animation.geometryRevision, index.geometryRevision);
    if (cue.cueRole === 'seating') assert.equal(cue.animation.phase, 'reassemble');
  }
  const repeatCues = expected.effects.actionCues.filter(cue => cue.animation.kind === 'repeat');
  assert.equal(repeatCues.length, 4);
  assert.ok(repeatCues.every(cue => cue.animation.motionEventIds.length === 4 && cue.animation.partIds.length === 40));
  assert.equal(expected.effects.actionCues.filter(cue => cue.cueRole === 'seating').length, 3);
  assert.equal(expected.effects.actionCues.filter(cue => cue.animation.kind === 'inspection').length, 2);
  assert.equal(expected.narration, false);
  assert.ok(expected.events.every(event => event.instrument !== 'cc0-sample'));
});

test('retained motor PCM is exactly reproducible, quiet during close-up, and loopable without clipping', async () => {
  const score = await read('../music-score.json'), bytes = await readFile(new URL('motor-loop.wav', import.meta.url));
  const audio = renderScore(expected), analysis = analyzeAudio(audio, expected), rendered = encodeWav(audio);
  assert.equal(score.edition, expected.edition); assert.equal(score.storyRevision, story.PLAN_REVISION);
  assert.deepEqual(score.events, expected.events); assert.deepEqual(score.effects, expected.effects);
  assert.equal(sha256(rendered), sha256(bytes)); assert.equal(score.sha256, sha256(bytes));
  assert.equal(score.file, 'audio/motor-loop.wav'); assert.equal(score.byteLength, bytes.length);
  assert.equal(bytes.length, 44 + FRAMES * 4); assert.equal(bytes.readUInt32LE(24), SAMPLE_RATE);
  assert.equal(bytes.readUInt16LE(20), 1); assert.equal(bytes.readUInt16LE(22), 2); assert.equal(bytes.readUInt16LE(34), 16);
  assert.equal(analysis.durationSeconds, DURATION); assert.equal(analysis.clippedSamples, 0);
  assert.ok(analysis.peakDbfs <= -7.99); assert.ok(analysis.rmsDbfs > -32 && analysis.rmsDbfs < -19);
  assert.ok(analysis.loopBoundary.maximumStep < .012); assert.ok(analysis.loopBoundary.ratioToMaximumInteriorStep < .5);
  const sections = Object.fromEntries(analysis.sections.map(section => [section.id, section.rmsDbfs]));
  assert.ok(sections.magnet < sections.repeats - 2, 'One-magnet reading view has a measured music dip.');
  assert.equal(analysis.listeningReviewed, false);
  const old = await read('../../audio/music-score.json'); assert.notEqual(score.sha256, old.sha256, 'V2 has newly composed PCM rather than timing claims over old effects.');
});

test('source mismatch and out-of-range motion bindings fail before rendering or writing audio', () => {
  const changeEvent = change => ({ ...story, MOTION_EVENTS: story.MOTION_EVENTS.map((event, i) => i ? event : { ...event, ...change }) });
  for (const change of [{ ids: ['invented-screw'] }, { ids: [] }, { startBeat: -1 }, { endBeat: 65 }, { phase: 'spinning' }, { kind: 'unknown' }]) assert.throws(() => createScore(changeEvent(change), index), /motion event/);
  assert.throws(() => createScore({ ...story, PLAN_REVISION: 'old-story' }, index), /v2 story/);
  assert.throws(() => createScore(story, { ...index, sourceSHA256: 'unknown' }), /SHA256/);
});
