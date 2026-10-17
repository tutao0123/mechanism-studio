import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createScore, renderScore, encodeWav, analyzeAudio, sha256, DURATION, FRAMES, SAMPLE_RATE, FELT_BPM } from '../audio/synth.mjs';
import { GROUPS, BPM, stateAt } from '../story.mjs';

let cached;
const rendered = () => cached ??= renderScore();

test('robot music has a full 64-beat loop with sub-sample beat rounding', () => {
  const score = createScore();
  assert.equal(score.bpm, 112); assert.equal(score.bars, 16);
  assert.equal(score.feltBpm, 56); assert.equal(score.feltBpm, FELT_BPM);
  assert.equal(score.frames, FRAMES); assert.equal(score.durationSeconds, DURATION);
  assert.ok(DURATION > 30 && DURATION < 40);
  assert.equal(score.beatGrid.at(-1).frame, FRAMES);
  assert.equal(score.cues[0].firstBeat, 0); assert.equal(score.cues.at(-1).lastBeat, 64);
  for (const point of score.beatGrid) assert.ok(Math.abs(point.frame - point.seconds * SAMPLE_RATE) <= 0.5);
  for (const event of score.events) assert.ok(event.beat >= 0 && event.beat < 64 && event.gain >= 0);
  assert.deepEqual(createScore(), score);
});

test('relaxed arrangement uses sustained harmony and sparse keys without a percussion or label tick bed', () => {
  const score = createScore();
  const music = score.events.filter(event => event.role === 'music');
  assert.deepEqual([...new Set(music.map(event => event.instrument))].sort(), ['rounded-key', 'soft-pad', 'warm-bass']);
  assert.ok(music.filter(event => event.instrument === 'rounded-key').length < 32);
  assert.ok(music.filter(event => event.instrument === 'soft-pad').every(event => event.durationBeats >= 8));
  assert.ok(music.filter(event => event.instrument === 'rounded-key').every(event => event.durationBeats >= 3));
  assert.equal(score.mix.percussion, false);
});

test('editorial motion and soft seating cues follow actual story groups and their two-beat actions', () => {
  const score = createScore();
  const effects = score.events.filter(event => event.role === 'editorial-sfx');
  assert.equal(effects.length, 12);
  assert.equal(score.effects.actionCues.length, effects.length);
  for (const group of GROUPS) {
    for (const [phase, firstBeat] of [['explode', group.outBeat], ['reassemble', group.inBeat]]) {
      const motion = effects.find(event => event.animation.groupId === group.id && event.animation.phase === phase && event.cueRole === 'motion');
      assert.ok(motion);
      assert.equal(motion.instrument, 'air-servo'); assert.equal(motion.beat, firstBeat); assert.equal(motion.durationBeats, 2);
      assert.deepEqual(motion.animation.partIds, group.ids);
      assert.equal(motion.animation.firstBeat, firstBeat); assert.equal(motion.animation.lastBeat, firstBeat + 2);
      const first = stateAt(firstBeat * 60 / BPM).progress[group.id];
      const last = stateAt((firstBeat + 2) * 60 / BPM).progress[group.id];
      assert.equal(first, phase === 'explode' ? 0 : 1);
      assert.equal(last, phase === 'explode' ? 1 : 0);
    }
    const seats = effects.filter(event => event.animation.groupId === group.id && event.cueRole === 'seating');
    assert.equal(seats.length, 1);
    assert.equal(seats[0].beat, group.inBeat + 2);
    assert.equal(seats[0].instrument, 'soft-seat'); assert.equal(seats[0].anchor, 'movement-complete');
  }
  for (const cue of score.effects.actionCues) {
    assert.equal(cue.seconds, cue.beat * 60 / BPM);
    assert.equal(cue.durationSeconds, cue.durationBeats * 60 / BPM);
  }
  assert.ok(!effects.some(event => event.beat >= 24 && event.beat < 40));
});

test('synth output has useful level, headroom and no exceptional loop-boundary jump', () => {
  const analysis = analyzeAudio(rendered());
  assert.equal(analysis.clippedSamples, 0);
  assert.ok(analysis.peakDbfs <= -7.99 && analysis.peakDbfs >= -8.01);
  assert.ok(analysis.rmsDbfs >= -24 && analysis.rmsDbfs <= -19);
  assert.ok(analysis.loopBoundary.maximumStep < 0.02);
  assert.ok(analysis.loopBoundary.ratioToMaximumInteriorStep < 0.5);
});

test('delivered PCM and score are reproducible from retained synthesis code', async () => {
  const expected = encodeWav(rendered());
  const delivered = await readFile(new URL('../audio/robot-loop.wav', import.meta.url));
  const score = JSON.parse(await readFile(new URL('../audio/music-score.json', import.meta.url), 'utf8'));
  assert.equal(delivered.readUInt32LE(24), SAMPLE_RATE);
  assert.equal(delivered.readUInt16LE(22), 2); assert.equal(delivered.readUInt16LE(34), 16);
  assert.equal(delivered.readUInt32LE(40), FRAMES * 4);
  assert.equal(delivered.length, 44 + FRAMES * 4);
  assert.equal(sha256(expected), sha256(delivered)); assert.equal(score.sha256, sha256(delivered));
  assert.equal(score.frames, FRAMES); assert.equal(score.durationSeconds, DURATION);
});

test('previous edition remains available with its original PCM, score and runnable synthesis', async () => {
  const directory = new URL('../audio/editions/assembly-return-v1/', import.meta.url);
  const previous = JSON.parse(await readFile(new URL('music-score.json', directory), 'utf8'));
  const delivered = await readFile(new URL('robot-loop.wav', directory));
  const oldSynth = await import(new URL('synth.mjs', directory));
  assert.equal(previous.sha256, '4d4836ed56eee876bbbd366afc8fc2e5001d0831151a41a8346ff7edb0ca5680');
  assert.equal(sha256(delivered), previous.sha256);
  assert.equal(sha256(oldSynth.encodeWav(oldSynth.renderScore())), previous.sha256);
});
