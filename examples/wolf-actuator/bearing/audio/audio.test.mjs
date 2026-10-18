import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWolfBearingStory } from '../story.mjs';
import { createScore, renderScore, encodeWav, analyzeAudio, sha256, FRAMES, SAMPLE_RATE, BPM, DURATION } from './synth.mjs';

const read = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const index = await read('../../assets/scene-index.json'), original = await read('../../detail/music-score.json');
const story = createWolfBearingStory(index), expected = createScore(story, index, original);

test('bearing cues bind actual source parts and movements, with one sound for each sixty-six-part wave', () => {
  const motions = new Map(story.MOTION_EVENTS.map(event => [event.id, event]));
  const bearingParts = new Set(story.bindings.bearingParts);
  assert.equal(expected.bpm, story.BPM); assert.equal(expected.durationSeconds, story.DURATION);
  assert.equal(expected.motionBindings.length, motions.size);
  assert.equal(expected.geometryRevision, index.geometryRevision); assert.equal(expected.sourceSHA256, index.sourceSHA256);
  assert.deepEqual(expected.cues.map(cue => [cue.id, cue.firstBeat, cue.lastBeat]), story.CHAPTERS.map(chapter => [chapter.id, chapter.firstBeat, chapter.lastBeat]));
  for (const cue of expected.effects.actionCues) {
    const bound = cue.animation.motionEventIds.map(id => motions.get(id));
    assert.ok(bound.every(Boolean));
    assert.deepEqual(cue.animation.partIds, [...new Set(bound.flatMap(event => event.ids))]);
    assert.ok(cue.animation.partIds.every(id => bearingParts.has(id)), 'No old motor or unrelated occurrence is an audio target.');
    assert.equal(cue.animation.firstBeat, Math.min(...bound.map(event => event.startBeat)));
    assert.equal(cue.animation.lastBeat, Math.max(...bound.map(event => event.endBeat)));
    assert.equal(cue.beat, cue.cueRole === 'seating' ? cue.animation.lastBeat : cue.animation.firstBeat);
    assert.equal(cue.seconds, cue.beat * 60 / BPM); assert.equal(cue.animation.geometryRevision, index.geometryRevision);
    if (cue.cueRole === 'seating') assert.equal(cue.animation.phase, 'reassemble');
  }
  const repeats = expected.effects.actionCues.filter(cue => cue.animation.kind === 'repeat');
  assert.equal(repeats.length, 2);
  assert.ok(repeats.every(cue => cue.animation.motionEventIds.length === 4 && cue.animation.partIds.length === 66));
  assert.equal(expected.effects.actionCues.filter(cue => cue.cueRole === 'seating').length, 2);
  assert.equal(expected.effects.actionCues.filter(cue => cue.animation.kind === 'inspection').length, 2);
  assert.equal(expected.narration, false);
  const music = expected.events.filter(event => event.role === 'music');
  assert.equal(expected.compositionReuse.sourceMusicEventsSha256, sha256(Buffer.from(JSON.stringify(music))));
  assert.ok(music.every(event => !event.animation && !event.id));
});

test('bearing PCM is newly rendered, reproducible, quiet during close-up and safe to loop', async () => {
  const score = await read('../music-score.json'), bytes = await readFile(new URL('bearing-loop.wav', import.meta.url));
  const audio = renderScore(expected), analysis = analyzeAudio(audio, expected), rendered = encodeWav(audio);
  assert.equal(score.edition, expected.edition); assert.equal(score.storyRevision, story.PLAN_REVISION);
  const sourceUrl = new URL(score.compositionReuse.sourceScore, new URL('../music-score.json', import.meta.url));
  assert.equal(JSON.parse(await readFile(sourceUrl, 'utf8')).edition, original.edition);
  assert.ok((await readFile(new URL(score.compositionReuse.synthesisEngine, new URL('../music-score.json', import.meta.url)), 'utf8')).includes('export function renderScore'));
  assert.deepEqual(score.events, expected.events); assert.deepEqual(score.effects, expected.effects);
  assert.equal(sha256(rendered), sha256(bytes)); assert.equal(score.sha256, sha256(bytes));
  assert.equal(score.file, 'audio/bearing-loop.wav'); assert.equal(score.byteLength, bytes.length);
  assert.equal(bytes.length, 44 + FRAMES * 4); assert.equal(bytes.readUInt32LE(24), SAMPLE_RATE);
  assert.equal(bytes.readUInt16LE(20), 1); assert.equal(bytes.readUInt16LE(22), 2); assert.equal(bytes.readUInt16LE(34), 16);
  assert.equal(analysis.durationSeconds, DURATION); assert.equal(analysis.clippedSamples, 0);
  assert.ok(analysis.peakDbfs <= -7.99); assert.ok(analysis.rmsDbfs > -32 && analysis.rmsDbfs < -19);
  assert.ok(analysis.loopBoundary.maximumStep < .012); assert.ok(analysis.loopBoundary.ratioToMaximumInteriorStep < .5);
  const sections = Object.fromEntries(analysis.sections.map(section => [section.id, section.rmsDbfs]));
  assert.ok(sections.component < sections.repeats - 2, 'The single-part reading view has a measured music dip.');
  assert.equal(analysis.listeningReviewed, false); assert.notEqual(score.sha256, original.sha256);
});

test('wrong source IDs, timing and composition fail before bearing PCM synthesis', () => {
  const changeEvent = change => ({ ...story, MOTION_EVENTS: story.MOTION_EVENTS.map((event, i) => i ? event : { ...event, ...change }) });
  for (const change of [{ ids: ['invented-bearing-ball'] }, { ids: [] }, { startBeat: -1 }, { endBeat: 65 }, { phase: 'rolling' }, { kind: 'unknown' }]) assert.throws(() => createScore(changeEvent(change), index, original), /motion event/);
  assert.throws(() => createScore({ ...story, PLAN_REVISION: 'old-story' }, index, original), /bearing story/);
  assert.throws(() => createScore(story, { ...index, sourceSHA256: 'unknown' }, original), /SHA256/);
  assert.throws(() => createScore(story, index, { ...original, edition: 'different-music' }), /motor-v2/);
  assert.throws(() => createScore({ ...story, CHAPTERS: story.CHAPTERS.map(chapter => chapter.id === 'component' ? { ...chapter, firstBeat: 25 } : chapter) }, index, original), /reading dip/);
});
