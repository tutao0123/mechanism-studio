/** Original 36-second score; shared code supplies the instrument renderer and WAV encoder. */
import { renderStudyScore, encodeStudyWav, sha256 } from '../../../tools/audio/study-score.mjs';

export const BPM = 100;
export const TOTAL_BEATS = 60;
export const DURATION = TOTAL_BEATS * 60 / BPM;
export const SAMPLE_RATE = 44_100;
export const FRAMES = SAMPLE_RATE * DURATION;
export const SEED = 0x50474c31;
export const EDITION = 'planetary-quiet-motion-v2';
export const READING_WINDOWS_BEATS = Object.freeze({ gear: Object.freeze([25, 32]), bearing: Object.freeze([35, 43]) });
export { sha256 };

const seconds = beat => beat * 60 / BPM;
function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    return (value >>> 0) / 4_294_967_296;
  };
}

/** The caller supplies final mechanical/display action bindings, never camera or label timestamps. */
export function createScore(geometryRevision, { events: motionEvents, partIds, storyRevision } = {}) {
  if (typeof geometryRevision !== 'string' || !geometryRevision || typeof storyRevision !== 'string' || !storyRevision) throw new Error('Actual geometry and story revisions are required.');
  if (!Array.isArray(partIds) || !partIds.length || partIds.some(id => typeof id !== 'string' || !id) || new Set(partIds).size !== partIds.length) throw new Error('Unique real part identities are required.');
  if (!Array.isArray(motionEvents)) throw new Error('Final authored motion events are required.');
  const known = new Set(partIds), seen = new Set();
  const actionCues = motionEvents.map(cue => {
    const level = cue.level ?? .5, durationBeats = cue.durationBeats ?? (cue.kind === 'seat' ? .5 : 1.75);
    if (typeof cue.id !== 'string' || !cue.id || seen.has(cue.id)
      || !['release', 'motion', 'detail', 'seat', 'resolve'].includes(cue.kind)
      || !Number.isFinite(cue.beat) || cue.beat < 0 || cue.beat >= TOTAL_BEATS
      || !Array.isArray(cue.partIds) || !cue.partIds.length || cue.partIds.some(id => !known.has(id)) || new Set(cue.partIds).size !== cue.partIds.length
      || !Number.isFinite(level) || level < 0 || level > 1
      || !Number.isFinite(durationBeats) || durationBeats <= 0 || durationBeats > 4) throw new Error('Editorial cue must bind a unique in-range action and actual part identities.');
    seen.add(cue.id);
    return { ...structuredClone(cue), level, durationBeats, seconds: seconds(cue.beat), durationSeconds: seconds(durationBeats), geometryRevision };
  }).sort((a, b) => a.beat - b.beat || a.id.localeCompare(b.id));
  const rng = seededRandom(SEED), events = [];
  const add = (voice, beat, beats, gain, midi, pan = 0, extra = {}) => events.push({ voice, beat, beats, gain, midi, pan, seed: Math.floor(rng() * 4_294_967_296), ...extra });
  const harmony = [
    { firstBeat: 0, lastBeat: 12, symbol: 'Dmaj9', bass: 38, notes: [50, 57, 61, 64], motif: [69, 73, 76] },
    { firstBeat: 12, lastBeat: 24, symbol: 'Bm11', bass: 35, notes: [47, 54, 57, 64], motif: [73, 69, 66] },
    { firstBeat: 24, lastBeat: 36, symbol: 'Gmaj9', bass: 31, notes: [43, 54, 57, 62], motif: [69, 71, 66] },
    { firstBeat: 36, lastBeat: 48, symbol: 'Aadd9', bass: 33, notes: [45, 52, 57, 59], motif: [71, 69, 64] },
    { firstBeat: 48, lastBeat: 60, symbol: 'Dmaj9', bass: 38, notes: [50, 57, 61, 64], motif: [69, 73, 76] },
  ];
  for (const [index, chord] of harmony.entries()) {
    const reading = index === 2 || index === 3;
    chord.notes.forEach((midi, note) => add('pad', chord.firstBeat - 1, 14, reading ? .0115 : .017, midi, (note - 1.5) * .32));
    add('bass', chord.firstBeat + .1, 4.5, reading ? .030 : .049, chord.bass);
    if (!reading) add('bass', chord.firstBeat + 6, 3.8, .024, chord.bass + 12, .03);
    add('felt', chord.firstBeat + 1, 4.6, reading ? .023 : .046, chord.motif[0], -.18);
    add('felt', chord.firstBeat + 5.5, 4.2, reading ? .017 : .032, chord.motif[1], .18);
    if (!reading) add('felt', chord.firstBeat + 9, 3.8, .024, chord.motif[2], -.08);
  }
  // Bring the same motif gently forward as the detailed bearing returns; no impact or drum hit.
  add('bass', 43.25, 3.8, .043, 33);
  add('felt', 44, 3.6, .037, 71, -.12);
  add('felt', 46.5, 3.5, .028, 69, .12);
  for (const cue of actionCues) {
    const contact = cue.kind === 'seat' || cue.kind === 'resolve';
    add(contact ? 'wood' : 'air', cue.beat, cue.durationBeats, (contact ? .018 : .034) * cue.level, contact ? 55 : 60, 0,
      { role: 'editorial-sfx', cueId: cue.id });
  }
  events.sort((a, b) => a.beat - b.beat);
  return {
    schemaVersion: '1.0.0', title: 'Epicyclic / Common Motion', edition: EDITION,
    authorship: 'Original Mechanism Studio composition and editorial cues. Shared MIT code synthesizes every sample; no external samples, recordings or narration.',
    originalScoreLicense: 'MIT', narration: false, geometryRevision, storyRevision,
    bpm: BPM, feltBpm: 50, totalBeats: TOTAL_BEATS, bars: 15, meter: [4, 4],
    sampleRate: SAMPLE_RATE, channels: 2, bitsPerSample: 16, frames: FRAMES, durationSeconds: DURATION, deterministicSeed: SEED,
    synthesis: { module: 'tools/audio/study-score.mjs', algorithm: 'analytic oscillator voices, seeded filtered noise and circular stereo reflections' },
    musicalFeel: 'Gentle sustained chords, sparse rounded keys and a restrained half-time bass pulse. Gear and bearing reading windows have fewer notes; the motif returns with reassembly. No percussion bed.',
    timing: 'One seekable PCM loop; seconds = beat * 60 / 100. Editorial cues bind final authored actions and actual part IDs.',
    mix: { samplePeakTargetDbfs: -10, percussion: false, readingWindowsBeats: structuredClone(READING_WINDOWS_BEATS), effects: 'Sparse quiet synthesized swishes and soft seating accents; these are editorial signals, not measured contact, bearing or gear sounds.' },
    harmony: harmony.map(({ motif, ...chord }) => chord),
    actionCues, events, listeningReviewed: false,
  };
}

export function renderScore(score) {
  if (score?.edition !== EDITION || score.bpm !== BPM || score.totalBeats !== TOTAL_BEATS || score.durationSeconds !== DURATION || score.sampleRate !== SAMPLE_RATE || score.frames !== FRAMES) throw new Error('Expected the planetary 100 BPM / 60-beat score.');
  return renderStudyScore(score);
}

/** Measure the encoded PCM as well as pre-quantization diagnostics. This is not a listening review. */
export function encodeScore(audio) {
  const { bytes, analysis } = encodeStudyWav(audio);
  const frames = bytes.readUInt32LE(40) / 4;
  let peak = 0, energy = 0, maximumInteriorStep = 0, clippedSamples = 0;
  const previous = [0, 0], first = [0, 0], last = [0, 0];
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < 2; channel++) {
    const value = bytes.readInt16LE(44 + frame * 4 + channel * 2) / 32768;
    peak = Math.max(peak, Math.abs(value)); energy += value * value;
    if (Math.abs(value) >= 1) clippedSamples++;
    if (frame) maximumInteriorStep = Math.max(maximumInteriorStep, Math.abs(value - previous[channel]));
    else first[channel] = value;
    last[channel] = value; previous[channel] = value;
  }
  const maximumStep = Math.max(...first.map((value, channel) => Math.abs(value - last[channel])));
  const windows = [['expand', 14, 22], ['gear-reading', ...READING_WINDOWS_BEATS.gear], ['bearing-reading', ...READING_WINDOWS_BEATS.bearing], ['reassemble', 43, 54]].map(([id, firstBeat, lastBeat]) => {
    const start = Math.round(seconds(firstBeat) * SAMPLE_RATE), end = Math.round(seconds(lastBeat) * SAMPLE_RATE);
    let sum = 0;
    for (let frame = start; frame < end; frame++) for (let channel = 0; channel < 2; channel++) {
      const value = bytes.readInt16LE(44 + frame * 4 + channel * 2) / 32768;
      sum += value * value;
    }
    return { id, firstBeat, lastBeat, rmsDbfs: 20 * Math.log10(Math.sqrt(sum / ((end - start) * 2))) };
  });
  return { bytes, analysis: {
    ...analysis, sampleRate: SAMPLE_RATE, frames, durationSeconds: frames / SAMPLE_RATE,
    encodedPcm: { peakDbfs: 20 * Math.log10(peak), rmsDbfs: 20 * Math.log10(Math.sqrt(energy / (frames * 2))), clippedSamples,
      loopBoundary: { maximumStep, maximumInteriorStep, ratioToMaximumInteriorStep: maximumStep / maximumInteriorStep }, windows },
    listeningReview: 'Objective waveform checks only; subjective balance and full-loop listening require separate review.',
  } };
}
