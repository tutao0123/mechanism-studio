import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWolfTourStory } from '../story.mjs';
import { createScore, renderScore, encodeWav, analyzeAudio, sha256, FRAMES, SAMPLE_RATE, BPM, TOTAL_BEATS, DURATION } from './synth.mjs';

const read = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const index = await read('../../assets/scene-index.json'), story = createWolfTourStory(index), expected = createScore(story, index);

test('complete-tour effects use final global source actions and aggregate repeated source families', () => {
  const motions = new Map(story.MOTION_EVENTS.map(event => [event.id, event]));
  assert.equal(expected.bpm, story.BPM); assert.equal(expected.durationSeconds, story.DURATION); assert.equal(expected.totalBeats, TOTAL_BEATS);
  assert.equal(expected.motionBindings.length, motions.size); assert.equal(expected.geometryRevision, index.geometryRevision);
  assert.deepEqual(expected.cues.map(cue => [cue.id, cue.firstBeat, cue.lastBeat]), story.CHAPTERS.map(chapter => [chapter.id, chapter.firstBeat, chapter.lastBeat]));
  for (const cue of expected.effects.actionCues) {
    const bound = cue.animation.motionEventIds.map(id => motions.get(id));
    assert.ok(bound.every(Boolean)); assert.deepEqual(cue.animation.partIds, [...new Set(bound.flatMap(event => event.ids))]);
    assert.equal(cue.animation.firstBeat, Math.min(...bound.map(event => event.startBeat))); assert.equal(cue.animation.lastBeat, Math.max(...bound.map(event => event.endBeat)));
    assert.equal(cue.beat, cue.cueRole === 'seating' ? cue.animation.lastBeat : cue.animation.firstBeat);
    assert.equal(cue.seconds, cue.beat * 60 / BPM); assert.equal(cue.animation.geometryRevision, index.geometryRevision);
    assert.ok(cue.beat + cue.durationBeats <= TOTAL_BEATS);
    if (cue.cueRole === 'seating') assert.equal(cue.animation.phase, 'reassemble');
  }
  const repeated = expected.effects.actionCues.filter(cue => cue.animation.kind === 'repeat');
  assert.equal(repeated.length, 6);
  assert.ok(repeated.every(cue => cue.animation.motionEventIds.length === 4 && cue.animation.partIds.length === (cue.animation.scope === 'motor' ? 40 : 66)));
  assert.equal(expected.effects.actionCues.filter(cue => cue.animation.kind === 'inspection').length, 4);
  assert.equal(expected.effects.actionCues.filter(cue => cue.cueRole === 'seating').length, 6);
  assert.equal(expected.narration, false); assert.equal(expected.synthesis.reusablePcm, false);
  assert.equal(expected.synthesis.musicEventDigest, sha256(Buffer.from(JSON.stringify(expected.events.filter(event => event.role === 'music')))));
  assert.equal(expected.automation.readingDips.length, 2);
  for (const dip of expected.automation.readingDips) {
    const outward = motions.get(dip.motionEventIds[0]), inward = motions.get(dip.motionEventIds[1]);
    assert.deepEqual(outward.ids, [dip.partId]); assert.deepEqual(inward.ids, [dip.partId]);
    assert.equal(dip.sourceWindow.firstBeat, outward.startBeat); assert.equal(dip.sourceWindow.lastBeat, inward.endBeat);
    assert.ok(dip.firstBeat < dip.fullBeat && dip.fullBeat < dip.releaseBeat && dip.releaseBeat < dip.lastBeat);
  }
});

test('new complete-tour PCM is deterministic and continuous across both halves, with two quiet macro windows', async () => {
  const score = await read('../music-score.json'), bytes = await readFile(new URL('tour-loop.wav', import.meta.url));
  const audio = renderScore(expected), analysis = analyzeAudio(audio, expected), rendered = encodeWav(audio);
  assert.equal(score.storyRevision, story.PLAN_REVISION); assert.deepEqual(score.events, expected.events); assert.deepEqual(score.effects, expected.effects);
  assert.equal(sha256(rendered), sha256(bytes)); assert.equal(score.sha256, sha256(bytes));
  assert.equal(score.file, 'audio/tour-loop.wav'); assert.equal(score.byteLength, bytes.length); assert.equal(bytes.length, 44 + FRAMES * 4);
  assert.equal(bytes.readUInt32LE(24), SAMPLE_RATE); assert.equal(bytes.readUInt16LE(20), 1); assert.equal(bytes.readUInt16LE(22), 2); assert.equal(bytes.readUInt16LE(34), 16);
  assert.equal(analysis.frames, 3_024_000); assert.equal(analysis.durationSeconds, DURATION); assert.equal(analysis.clippedSamples, 0);
  assert.ok(analysis.peakDbfs <= -7.99 && analysis.rmsDbfs > -32 && analysis.rmsDbfs < -19);
  assert.ok(analysis.loopBoundary.maximumStep < .012 && analysis.loopBoundary.ratioToMaximumInteriorStep < .5);
  const mid = FRAMES / 2;
  assert.notEqual(sha256(bytes.subarray(44, 44 + mid * 4)), sha256(bytes.subarray(44 + mid * 4)), 'The two halves are not a repeated shorter WAV.');
  assert.ok(Math.max(Math.abs(audio.left[mid] - audio.left[mid - 1]), Math.abs(audio.right[mid] - audio.right[mid - 1])) < .012, 'The halfway point has no clip-join discontinuity.');
  for (const dip of expected.automation.readingDips) {
    const start = Math.round(dip.fullBeat * 60 / BPM * SAMPLE_RATE), end = Math.round(dip.releaseBeat * 60 / BPM * SAMPLE_RATE);
    let energy = 0; for (let i = start; i < end; i++) energy += audio.left[i] ** 2 + audio.right[i] ** 2;
    const rms = 20 * Math.log10(Math.sqrt(energy / ((end - start) * 2)));
    assert.ok(rms < analysis.rmsDbfs - 2, `${dip.id} provides measured quieter reading space.`);
  }
  assert.equal(analysis.listeningReviewed, false);
});

test('invalid global motion identities or shortened transports fail before complete-tour synthesis', () => {
  const changed = change => ({ ...story, MOTION_EVENTS: story.MOTION_EVENTS.map((event, i) => i ? event : { ...event, ...change }) });
  for (const change of [{ ids: ['invented-screw'] }, { ids: [] }, { startBeat: -1 }, { endBeat: 129 }, { phase: 'rolling' }, { kind: 'unknown' }]) assert.throws(() => createScore(changed(change), index), /motion event/);
  assert.throws(() => createScore({ ...story, TOTAL_BEATS: 64 }, index), /128 beat/);
  assert.throws(() => createScore({ ...story, PLAN_REVISION: 'old-story' }, index), /128 beat/);
  assert.throws(() => createScore(story, { ...index, sourceSHA256: 'unknown' }), /SHA256/);
});
