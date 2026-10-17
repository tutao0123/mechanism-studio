import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHumanoidStory } from '../story.mjs';
import { loadSamples } from '../audio/build.mjs';
import { createScore, renderScore, encodeWav, analyzeAudio, decodePcmWav, sha256, beatSeconds, BPM, TOTAL_BEATS, SAMPLE_RATE, FRAMES, DURATION, EDITION } from '../audio/synth.mjs';

const index = JSON.parse(await readFile(new URL('../assets/scene-index.json', import.meta.url), 'utf8'));
const story = createHumanoidStory(index);
const { provenance, sampleMap } = await loadSamples();
const score = createScore(story, index.geometryRevision, provenance);
let cached;
const audio = () => cached ??= renderScore(score, sampleMap);

test('humanoid music shares the exact 64-beat display clock and source identities', () => {
  assert.equal(score.edition, EDITION); assert.equal(score.bpm, BPM); assert.equal(BPM, story.BPM);
  assert.equal(score.feltBpm, 54); assert.equal(score.totalBeats, TOTAL_BEATS); assert.equal(TOTAL_BEATS, story.TOTAL_BEATS);
  assert.equal(score.durationSeconds, story.DURATION); assert.equal(DURATION, 64 * 60 / 108);
  assert.equal(FRAMES, 1_568_000); assert.equal(FRAMES / SAMPLE_RATE, DURATION);
  assert.equal(score.beatGrid.at(-1).frame, FRAMES); assert.equal(score.geometryRevision, index.geometryRevision);
  assert.equal(score.storyRevision, story.PLAN_REVISION); assert.equal(score.narration, false);
  assert.deepEqual(createScore(story, index.geometryRevision, provenance), score);
  assert.throws(() => createScore({ ...story, BPM: 100 }, index.geometryRevision, provenance), /108 BPM/);
  assert.throws(() => createScore(story, '', provenance), /geometry revision/);
  const invented = { ...story, GROUPS: story.GROUPS.map((group, i) => i ? group : { ...group, ids: ['invented-body'] }) };
  assert.throws(() => createScore(invented, index.geometryRevision, provenance), /source part IDs/);
});

test('every action binding matches an actual source group movement; audible cues stay sparse', () => {
  assert.equal(score.effects.actionCues.length, 24);
  const sourceIds = new Set(index.parts.map(part => part.id));
  const effects = score.events.filter(event => event.role === 'editorial-sfx');
  assert.equal(effects.length, 14); assert.equal(new Set(effects.map(event => event.id)).size, effects.length);
  for (const group of story.GROUPS) {
    for (const [phase, beat] of [['explode', group.outBeat], ['reassemble', group.inBeat]]) {
      const cue = score.effects.actionCues.find(cue => cue.animation.groupId === group.id && cue.animation.phase === phase && cue.cueRole === 'motion');
      assert.ok(cue); assert.equal(cue.beat, beat); assert.equal(cue.seconds, beatSeconds(beat));
      assert.equal(cue.animation.firstBeat, beat); assert.equal(cue.animation.lastBeat, beat + story.MOVEMENT_BEATS);
      assert.deepEqual(cue.animation.partIds, group.ids); assert.ok(cue.animation.partIds.every(id => sourceIds.has(id)));
      assert.equal(cue.animation.geometryRevision, index.geometryRevision);
      assert.ok(Math.abs(story.stateAt(beatSeconds(beat)).progress[group.id] - (phase === 'explode' ? 0 : 1)) < 1e-9);
      assert.ok(Math.abs(story.stateAt(beatSeconds(beat + story.MOVEMENT_BEATS)).progress[group.id] - (phase === 'explode' ? 1 : 0)) < 1e-9);
      assert.equal(effects.some(event => event.id === cue.id), cue.audible);
    }
    const seat = score.effects.actionCues.find(cue => cue.animation.groupId === group.id && cue.cueRole === 'seating');
    assert.equal(seat.beat, group.inBeat + story.MOVEMENT_BEATS); assert.equal(seat.anchor, 'movement-complete');
  }
  assert.equal(effects.filter(event => event.cueRole === 'motion').length, 8);
  assert.equal(effects.filter(event => event.cueRole === 'seating').length, 3);
  const detailCues = effects.filter(event => event.cueRole === 'detail');
  assert.equal(detailCues.length, 2);
  for (const cue of detailCues) assert.ok(Math.abs(cue.seconds - beatSeconds(cue.chapterFirstBeat) - 1.05) < 1e-10);
  const complete = effects.find(event => event.cueRole === 'completion');
  assert.equal(complete.beat, 58); assert.ok(Object.values(story.stateAt(complete.seconds).progress).every(value => value === 0));
  assert.ok(effects.every(event => event.gainDb <= -26));
});

test('only verified CC0 bytes are mixed and tampered source inputs fail closed', async () => {
  assert.equal(score.sourceInputs.license, 'CC0-1.0'); assert.equal(score.sourceInputs.files.length, 5);
  for (const source of score.sourceInputs.files) {
    const bytes = await readFile(new URL(`../audio/sfx/${source.file}`, import.meta.url));
    assert.equal(sha256(bytes), source.sha256); assert.equal(source.license, 'CC0-1.0');
    const decoded = decodePcmWav(bytes); assert.equal(decoded.sampleRate, SAMPLE_RATE); assert.equal(decoded.channels, 1);
    assert.ok(Math.abs(decoded.samples.length / SAMPLE_RATE - source.durationSeconds) < 1e-6);
    assert.ok(source.sourceUrl.includes(provenance.githubSourceRevision));
  }
  const corrupt = { ...sampleMap, 'maximize_003.wav': { ...sampleMap['maximize_003.wav'], sha256: '0'.repeat(64) } };
  assert.throws(() => renderScore(score, corrupt), /mismatched CC0 sample/);
  assert.throws(() => createScore(story, index.geometryRevision, { ...provenance, license: 'unknown' }), /CC0 source manifest/);
  assert.throws(() => decodePcmWav(Buffer.from('not a WAV')), /Invalid RIFF/);
});

test('music leaves headroom, quieter reading space and a continuous periodic seam', () => {
  const analysis = analyzeAudio(audio());
  assert.equal(analysis.frames, FRAMES); assert.equal(analysis.durationSeconds, DURATION);
  assert.equal(analysis.clippedSamples, 0); assert.equal(analysis.masterScale, 1);
  assert.ok(analysis.peakDbfs <= -9.9 && analysis.peakDbfs >= -10.1);
  assert.ok(analysis.rmsDbfs > -28 && analysis.rmsDbfs < -22);
  assert.ok(analysis.loopBoundary.maximumStep < .003);
  assert.ok(analysis.loopBoundary.ratioToMaximumInteriorStep < .2);
  const byId = Object.fromEntries(analysis.sections.map(section => [section.id, section]));
  assert.ok(byId.separation.rmsDbfs > byId['upper-detail'].rmsDbfs + 2);
  assert.ok(byId.reassembly.rmsDbfs > byId['lower-detail'].rmsDbfs + 2);
  assert.equal(score.mix.percussion, false);
  assert.deepEqual([...new Set(score.events.filter(event => event.role === 'music').map(event => event.instrument))].sort(), ['breathing-pad', 'felt-key', 'warm-bass']);
  assert.equal(analysis.listeningReviewed, false);
});

test('delivered WAV and manifest reproduce exactly from source-bound score and sample hashes', async () => {
  const wav = await readFile(new URL('../audio/humanoid-loop.wav', import.meta.url));
  const delivered = JSON.parse(await readFile(new URL('../audio/music-score.json', import.meta.url), 'utf8'));
  assert.equal(wav.length, 44 + FRAMES * 4); assert.equal(wav.readUInt32LE(40), FRAMES * 4);
  assert.equal(wav.readUInt16LE(22), 2); assert.equal(wav.readUInt16LE(34), 16); assert.equal(wav.readUInt32LE(24), SAMPLE_RATE);
  assert.equal(delivered.byteLength, wav.length); assert.equal(delivered.sha256, sha256(wav));
  assert.equal(sha256(encodeWav(audio())), delivered.sha256);
  assert.equal(sha256(encodeWav(renderScore(createScore(story, index.geometryRevision, provenance), sampleMap))), delivered.sha256);
  assert.deepEqual(delivered.effects, score.effects); assert.deepEqual(delivered.sourceInputs, score.sourceInputs);
  assert.equal(delivered.geometryRevision, index.geometryRevision); assert.equal(delivered.durationSeconds, story.DURATION);
});
