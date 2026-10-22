import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createScore, renderScore, encodeScore, sha256, BPM, TOTAL_BEATS, FRAMES, DURATION, SAMPLE_RATE } from '../audio/synth.mjs';

const geometryRevision = 'test-planetary-geometry';
const options = () => ({
  storyRevision: 'test-planetary-story',
  partIds: ['pg:carrier-front', 'pg:sun', 'pg:planet-1', 'pg:planet-2', 'pg:planet-3'],
  events: [
    { id: 'release', kind: 'release', beat: 8, partIds: ['pg:carrier-front'], durationBeats: 2 },
    { id: 'expand', kind: 'motion', beat: 12, partIds: ['pg:sun', 'pg:planet-1', 'pg:planet-2', 'pg:planet-3'], durationBeats: 2 },
    { id: 'seated', kind: 'seat', beat: 48, partIds: ['pg:carrier-front', 'pg:sun'], durationBeats: .5 },
  ],
});

test('planetary score keeps exact 36-second PCM transport and copied actual part bindings', () => {
  const input = options(), before = structuredClone(input), score = createScore(geometryRevision, input);
  assert.deepEqual(input, before);
  assert.equal(BPM, 100); assert.equal(TOTAL_BEATS, 60); assert.equal(DURATION, 36);
  assert.equal(FRAMES, 1_587_600); assert.equal(score.sampleRate, SAMPLE_RATE);
  assert.equal(score.frames, Math.round(score.durationSeconds * SAMPLE_RATE));
  assert.equal(score.actionCues.length, 3);
  for (const cue of score.actionCues) {
    assert.equal(cue.seconds, cue.beat * 60 / BPM);
    assert.equal(cue.geometryRevision, geometryRevision);
    assert.equal(score.events.filter(event => event.cueId === cue.id).length, 1);
  }
  input.events[0].partIds.push('unrelated');
  assert.deepEqual(score.actionCues[0].partIds, ['pg:carrier-front']);
  assert.equal(score.narration, false);
  assert.equal(score.listeningReviewed, false);
});

test('planetary cues reject missing identities, stale/unbound events and invalid times', () => {
  assert.throws(() => createScore('', options()), /revisions/);
  assert.throws(() => createScore(geometryRevision, { ...options(), storyRevision: '' }), /revisions/);
  assert.throws(() => createScore(geometryRevision, { ...options(), partIds: ['pg:sun', 'pg:sun'] }), /identities/);
  assert.throws(() => createScore(geometryRevision, { ...options(), events: undefined }), /events/);
  for (const change of [{ partIds: ['missing'] }, { partIds: [] }, { partIds: ['pg:sun', 'pg:sun'] }, { beat: -1 }, { beat: 60 }, { beat: NaN }, { kind: 'label-ding' }, { level: 2 }, { durationBeats: Infinity }, { durationBeats: 0 }]) {
    const input = options(); Object.assign(input.events[0], change);
    assert.throws(() => createScore(geometryRevision, input), /Editorial cue/);
  }
  const duplicate = options(); duplicate.events[1].id = duplicate.events[0].id;
  assert.throws(() => createScore(geometryRevision, duplicate), /Editorial cue/);
  assert.throws(() => renderScore({ ...createScore(geometryRevision, options()), bpm: 99 }), /100 BPM/);
});

test('planetary rendered PCM is deterministic with measured headroom and continuous seam', () => {
  const score = createScore(geometryRevision, options());
  const first = encodeScore(renderScore(score)), second = encodeScore(renderScore(score));
  assert.equal(first.bytes.length, 44 + FRAMES * 4);
  assert.equal(first.bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(first.bytes.readUInt16LE(22), 2);
  assert.equal(first.bytes.readUInt32LE(24), 44_100);
  assert.equal(first.bytes.readUInt16LE(34), 16);
  assert.equal(sha256(first.bytes), sha256(second.bytes));
  assert.equal(first.analysis.frames, FRAMES);
  assert.equal(first.analysis.durationSeconds, 36);
  assert.equal(first.analysis.encodedPcm.clippedSamples, 0);
  assert.ok(first.analysis.encodedPcm.peakDbfs < -9.99);
  assert.ok(first.analysis.encodedPcm.rmsDbfs > -34 && first.analysis.encodedPcm.rmsDbfs < -17);
  assert.ok(first.analysis.encodedPcm.loopBoundary.maximumStep < .012);
  assert.ok(first.analysis.encodedPcm.loopBoundary.ratioToMaximumInteriorStep < 1);
  const windows = Object.fromEntries(first.analysis.encodedPcm.windows.map(window => [window.id, window]));
  assert.ok(windows.expand.rmsDbfs > windows['gear-reading'].rmsDbfs + 2);
  assert.ok(windows.reassemble.rmsDbfs > windows['gear-reading'].rmsDbfs + 2);
  assert.ok(windows.expand.rmsDbfs > windows['bearing-reading'].rmsDbfs + 2);
  assert.ok(windows.reassemble.rmsDbfs > windows['bearing-reading'].rmsDbfs + 2);
  assert.equal(first.analysis.listeningReviewed, false);
});

test('delivered loop reproduces current geometry and action bindings at the actual movement moments', async () => {
  const index = JSON.parse(await readFile(new URL('../assets/scene-index.json', import.meta.url), 'utf8'));
  const choreography = await import('../choreography.mjs');
  const { createPlanetaryPresentation } = await import('../presentation.mjs');
  const presentation = createPlanetaryPresentation(index);
  const score = createScore(index.geometryRevision, { events: choreography.MUSIC_EVENTS, partIds: index.parts.map(part => part.id), storyRevision: choreography.PLAN_REVISION });
  const delivered = JSON.parse(await readFile(new URL('../audio/music-score.json', import.meta.url), 'utf8'));
  const wav = await readFile(new URL('../audio/planetary-loop.wav', import.meta.url));
  assert.equal(score.bpm, choreography.BPM);
  assert.equal(score.totalBeats, choreography.TOTAL_BEATS);
  assert.equal(score.durationSeconds, choreography.DURATION);
  assert.equal(delivered.geometryRevision, index.geometryRevision);
  assert.equal(delivered.storyRevision, choreography.PLAN_REVISION);
  for (const [windowId, chapterId] of [['gear', 'mesh'], ['bearing', 'bearing']]) {
    const chapter = choreography.CHAPTERS.find(chapter => chapter.id === chapterId);
    assert.ok(chapter, `${chapterId} exists in the current visual schedule`);
    const [quietStart, quietEnd] = score.mix.readingWindowsBeats[windowId];
    assert.ok(quietStart >= chapter.firstBeat && quietEnd <= chapter.lastBeat, 'quiet passage stays in the chapter');
    for (const [start, end] of presentation.plan.annotations.windows[chapterId]) {
      assert.ok(chapter.firstBeat + start * choreography.BPM / 60 >= quietStart);
      assert.ok(chapter.firstBeat + end * choreography.BPM / 60 <= quietEnd, 'actual label reading remains inside the unchanged quiet passage');
    }
  }
  assert.deepEqual(delivered.actionCues, score.actionCues);
  assert.deepEqual(delivered.events, score.events);
  assert.equal(delivered.byteLength, wav.length);
  assert.equal(delivered.sha256, sha256(wav));
  assert.equal(delivered.sha256, '04f5806626904907590d648b1f91bafe8cd136ef7214aba9927792a1120a824e', 'bearing motion preserves the approved v2 music bytes');
  assert.equal(delivered.sha256, sha256(encodeScore(renderScore(score)).bytes));
  for (const cue of score.actionCues) {
    const now = presentation.timeline.stateAt(cue.seconds);
    if (cue.kind === 'seat') {
      for (const id of cue.partIds) assert.ok(Math.hypot(...now.offsetsWorld[id]) < 1e-10, `${id} is seated at its sound cue`);
    } else {
      const after = presentation.timeline.stateAt(cue.seconds + cue.durationSeconds);
      for (const id of cue.partIds) assert.ok(Math.hypot(...after.offsetsWorld[id].map((value, axis) => value - now.offsetsWorld[id][axis])) > 1e-7, `${id} actually moves during its sound cue`);
    }
  }
});
