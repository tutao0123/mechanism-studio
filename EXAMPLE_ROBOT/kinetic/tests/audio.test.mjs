import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createKineticStory } from '../story.mjs';
import { createScore, renderScore, encodeWav, analyzeAudio, sha256, SAMPLE_RATE, BPM, TOTAL_BEATS, FRAMES, DURATION, EDITION } from '../audio/synth.mjs';

const index = JSON.parse(await readFile(new URL('../../planning/scene-index.json', import.meta.url), 'utf8'));
const story = createKineticStory(index);
const score = createScore(story, index.geometryRevision);
let cached;
const audio = () => cached ??= renderScore(score);

test('kinetic score binds the actual geometry and exact 48-beat PCM transport', () => {
  assert.equal(score.geometryRevision, index.geometryRevision); assert.equal(score.storyRevision, story.PLAN_REVISION);
  assert.equal(score.edition, EDITION); assert.equal(score.bpm, BPM); assert.equal(score.totalBeats, TOTAL_BEATS);
  assert.equal(score.durationSeconds, DURATION); assert.equal(score.frames, FRAMES); assert.equal(DURATION, story.DURATION);
  assert.equal(FRAMES, SAMPLE_RATE * TOTAL_BEATS * 60 / BPM); assert.equal(score.beatGrid.at(-1).frame, FRAMES);
  assert.equal(score.narration, false); assert.equal(score.feltBpm, 56);
  for (const point of score.beatGrid) assert.ok(Math.abs(point.frame - point.seconds * SAMPLE_RATE) <= .5);
  assert.deepEqual(createScore(story, index.geometryRevision), score);
  assert.throws(() => createScore(story, ''), /geometry revision/);
  assert.throws(() => createScore({ ...story, TOTAL_BEATS: 64 }, index.geometryRevision), /48 beat/);
  assert.throws(() => createScore({ ...story, GROUPS: story.GROUPS.map((group, i) => i ? group : { ...group, ids: ['invented-part'] }) }, index.geometryRevision), /source part IDs/);
});

test('opening hook, expansion and reading have deliberately different note density', () => {
  const music = score.events.filter(event => event.role === 'music');
  const keys = music.filter(event => event.instrument === 'felt-key');
  assert.equal(keys[0].beat, 0);
  const build = keys.filter(event => event.beat >= 10 && event.beat < 18);
  const reading = keys.filter(event => event.beat >= 18 && event.beat < 32);
  assert.equal(build.length, 8); assert.equal(reading.length, 4);
  assert.ok(build.length / 8 > reading.length / 14 * 3);
  assert.ok(build.every(event => event.durationBeats < 2));
  assert.ok(reading.every(event => event.durationBeats > 3));
  assert.equal(score.mix.percussion, false);
  assert.deepEqual([...new Set(music.map(event => event.instrument))].sort(), ['breathing-pad', 'felt-key', 'warm-bass']);
  assert.deepEqual(score.cues.map(cue => cue.id), ['hook', 'reach', 'expand', 'read', 'return', 'resolve']);
});

test('sparse editorial effects match source group IDs, direction and precise return completion', () => {
  const effects = score.events.filter(event => event.role === 'editorial-sfx');
  assert.equal(effects.length, 12); assert.equal(score.effects.actionCues.length, 12);
  assert.equal(new Set(effects.map(event => event.id)).size, 12);
  for (const group of story.GROUPS) {
    for (const [phase, beat] of [['explode', group.outBeat], ['reassemble', group.inBeat]]) {
      const event = effects.find(event => event.animation.groupId === group.id && event.animation.phase === phase && event.cueRole === 'motion');
      assert.ok(event); assert.equal(event.beat, beat); assert.equal(event.durationBeats, story.MOVEMENT_BEATS);
      assert.deepEqual(event.animation.partIds, group.ids); assert.equal(event.animation.geometryRevision, index.geometryRevision);
      assert.equal(event.animation.firstBeat, beat); assert.equal(event.animation.lastBeat, beat + story.MOVEMENT_BEATS);
      assert.equal(story.stateAt(beat * 60 / BPM).progress[group.id], phase === 'explode' ? 0 : 1);
      assert.equal(story.stateAt((beat + story.MOVEMENT_BEATS) * 60 / BPM).progress[group.id], phase === 'explode' ? 1 : 0);
    }
    const seat = effects.filter(event => event.animation.groupId === group.id && event.cueRole === 'seating');
    assert.equal(seat.length, 1); assert.equal(seat[0].beat, group.inBeat + story.MOVEMENT_BEATS);
    assert.equal(seat[0].anchor, 'movement-complete');
  }
  assert.ok(!effects.some(event => event.beat >= 18 && event.beat < 32));
  for (const cue of score.effects.actionCues) { assert.equal(cue.seconds, cue.beat * 60 / BPM); assert.equal(cue.durationSeconds, cue.durationBeats * 60 / BPM); }
});

test('waveform has headroom, a gentle periodic seam and a measurably quieter reading section', () => {
  const analysis = analyzeAudio(audio());
  assert.equal(analysis.clippedSamples, 0);
  assert.ok(analysis.peakDbfs <= -7.99 && analysis.peakDbfs >= -8.01);
  assert.ok(analysis.rmsDbfs > -27 && analysis.rmsDbfs < -19);
  assert.ok(analysis.loopBoundary.maximumStep < .015);
  assert.ok(analysis.loopBoundary.ratioToMaximumInteriorStep < .5);
  const byId = Object.fromEntries(analysis.sections.map(section => [section.id, section]));
  assert.ok(byId.expand.rmsDbfs > byId.read.rmsDbfs + 2);
  assert.ok(byId.return.rmsDbfs > byId.read.rmsDbfs + 2);
});

test('retained PCM is deterministic and its score matches all delivered bytes and source cues', async () => {
  const wav = await readFile(new URL('../audio/kinetic-loop.wav', import.meta.url));
  const delivered = JSON.parse(await readFile(new URL('../audio/music-score.json', import.meta.url), 'utf8'));
  assert.equal(wav.length, 44 + FRAMES * 4); assert.equal(wav.readUInt32LE(40), FRAMES * 4);
  assert.equal(wav.readUInt16LE(22), 2); assert.equal(wav.readUInt16LE(34), 16); assert.equal(wav.readUInt32LE(24), SAMPLE_RATE);
  assert.equal(delivered.byteLength, wav.length); assert.equal(delivered.sha256, sha256(wav));
  assert.equal(sha256(encodeWav(audio())), delivered.sha256);
  assert.equal(sha256(encodeWav(renderScore(createScore(story, index.geometryRevision)))), delivered.sha256);
  assert.deepEqual(delivered.effects, score.effects); assert.equal(delivered.geometryRevision, index.geometryRevision);
  const oldScore = JSON.parse(await readFile(new URL('../../audio/music-score.json', import.meta.url), 'utf8'));
  const oldWav = await readFile(new URL('../../audio/robot-loop.wav', import.meta.url));
  assert.equal(oldScore.sha256, '7a463b9c86f7f7e4bcfacdbfdebb3522981182b23056cd980d377e6533f838e5');
  assert.equal(sha256(oldWav), oldScore.sha256); assert.notEqual(delivered.sha256, oldScore.sha256);
});
