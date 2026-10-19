/** Original score and synthesized editorial cues for the gearbox study. No
 * samples or recordings: every voice is computed here (MIT). One circular PCM
 * buffer, so note tails and echoes wrap across the loop seam. */
import { createHash } from 'node:crypto';

export const SAMPLE_RATE = 44_100;
export const BPM = 96;
export const TOTAL_BEATS = 64;
export const FRAMES = 1_764_000;
export const DURATION = FRAMES / SAMPLE_RATE;
export const EDITION = 'gearbox-gentle-v1';
export const SEED = 0x47425831;
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const beatSeconds = beat => beat * 60 / BPM;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
const dbToGain = db => 10 ** (db / 20);
export const SECTIONS = Object.freeze([['whole', 0, 5], ['open', 5, 12], ['explode', 12, 22], ['low', 22, 32], ['sync', 32, 44], ['over', 44, 54], ['close', 54, 64]]);

function randomSequence(seed) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4_294_967_296; };
}

/** Bind cues to the story's real schedule: engagements, explosion and case. */
export function createScore(story, geometryRevision) {
  if (story?.BPM !== BPM || story?.TOTAL_BEATS !== TOTAL_BEATS || Math.abs(story.DURATION - DURATION) > 1e-10) throw new Error('Gearbox music requires the 96 BPM / 64 beat story.');
  if (typeof geometryRevision !== 'string' || !geometryRevision) throw new Error('A real geometry revision is required for cue bindings.');
  const random = randomSequence(SEED), events = [], actionCues = [];
  const add = (instrument, beat, durationBeats, gain, midi, pan = 0) => events.push({ instrument, role: 'music', beat, durationBeats, gain, midi, pan, seed: Math.floor(random() * 0xffff_ffff) });
  const harmony = [
    { firstBeat: 0, lastBeat: 8, symbol: 'Fmaj9', notes: [53, 60, 64, 67], bass: 41 },
    { firstBeat: 8, lastBeat: 16, symbol: 'Dm11', notes: [50, 57, 60, 67], bass: 38 },
    { firstBeat: 16, lastBeat: 24, symbol: 'Bbmaj9', notes: [46, 57, 60, 65], bass: 34 },
    { firstBeat: 24, lastBeat: 32, symbol: 'C6/9', notes: [48, 55, 57, 62], bass: 36 },
    { firstBeat: 32, lastBeat: 40, symbol: 'Am7', notes: [45, 55, 60, 64], bass: 33 },
    { firstBeat: 40, lastBeat: 48, symbol: 'Bbmaj9', notes: [46, 57, 60, 65], bass: 34 },
    { firstBeat: 48, lastBeat: 56, symbol: 'Gm9/C', notes: [48, 57, 58, 65], bass: 36 },
    { firstBeat: 56, lastBeat: 64, symbol: 'Fmaj9', notes: [53, 60, 64, 67], bass: 41 },
  ];
  for (const section of harmony) {
    const reading = section.firstBeat >= 32 && section.firstBeat < 44;
    section.notes.forEach((midi, index) => add('pad', section.firstBeat - .6, 10, reading ? .011 : .014, midi, (index - 1.5) * .36));
    add('bass', section.firstBeat, 3.6, reading ? .038 : .05, section.bass, 0);
    if (!reading) add('bass', section.firstBeat + 4, 2.6, .027, section.bass + 12, .04);
  }
  // A sparse motif that thins out while the synchronizer is being read.
  for (const [beat, midi, gain] of [
    [0, 72, .058], [2.5, 76, .045], [5, 77, .044], [7.5, 74, .032],
    [9, 72, .045], [12, 69, .042], [15.5, 72, .040], [18, 77, .038], [21, 74, .030],
    [24, 72, .034], [27, 76, .030], [30, 79, .026], [34, 76, .022], [40, 72, .022],
    [44.5, 74, .036], [47, 77, .034], [50, 81, .030], [53, 77, .028],
    [56, 72, .044], [58.5, 76, .034], [61, 77, .026],
  ]) add('key', beat, beat >= 32 && beat < 44 ? 4 : 3, gain, midi, beat % 4 < 2 ? -.2 : .2);

  const cue = (id, cueRole, beat, kind, gainDb, binding) => {
    const record = { id, cueRole, beat, seconds: beatSeconds(beat), binding, audible: true, geometryRevision };
    actionCues.push(record);
    events.push({ instrument: kind, role: 'editorial-cue', id, beat, gainDb, pan: 0, seed: Math.floor(random() * 0xffff_ffff) });
  };
  cue('case-open', 'motion', story.CASE_TIMING.open[0], 'swell', -27, { partGroup: 'case', phase: 'lift' });
  cue('explode-out', 'motion', story.COHORTS.axial.out, 'swell', -28, { cohort: 'axial', phase: 'separate' });
  cue('explode-seated', 'seating', story.COHORTS.shift.back + story.COHORTS.shift.beats, 'tick', -30, { cohort: 'shift', phase: 'return-complete' });
  // A soft tick as each synchronizer sleeve seats on its dog teeth.
  for (const segment of story.SCHEDULE) {
    if (segment.type !== 'shift' || segment.to === 'N') continue;
    const seconds = segment.t0 + .9 * (segment.t1 - segment.t0), beat = seconds * BPM / 60;
    cue(`engage-${segment.to}`, 'engagement', beat, 'tick', segment.to === '4' ? -27 : -31, { shift: `${segment.from}→${segment.to}`, synchro: story.synchros[{ 1: 's12', 2: 's12', 3: 's34', 4: 's34', 5: 's5r' }[segment.to]].id });
  }
  cue('case-closed', 'completion', story.CASE_TIMING.close[1], 'chime', -29, { partGroup: 'case', phase: 'restored' });
  events.sort((a, b) => a.beat - b.beat); actionCues.sort((a, b) => a.beat - b.beat);
  return {
    schemaVersion: '1.0.0', title: 'A Gearbox, Revealed', edition: EDITION,
    authorship: 'Original Mechanism Studio composition and code synthesis. No samples, recordings or narration.',
    originalScoreLicense: 'MIT', narration: false, geometryRevision, storyRevision: story.PLAN_REVISION,
    bpm: BPM, feltBpm: 48, totalBeats: TOTAL_BEATS, bars: 16, meter: [4, 4],
    sampleRate: SAMPLE_RATE, channels: 2, bitsPerSample: 16, frames: FRAMES, durationSeconds: DURATION, deterministicSeed: SEED,
    musicalFeel: 'Soft sustained chords in F, warm half-time bass and sparse felt keys; quieter while the synchronizer is read.',
    timing: 'One seekable PCM transport; seconds = beat * 60 / 96. Engagement ticks bind the story drive schedule.',
    mix: { musicTargetSamplePeakDbfs: -10, finalCeilingDbfs: -8, percussion: false, effects: 'Synthesized editorial cues, not recorded or simulated gear, clutch or synchronizer sounds.' },
    effects: { kind: 'editorial', clock: 'Baked into the same PCM buffer. No wall-clock timers.', actionCues },
    cues: SECTIONS.map(([id, firstBeat, lastBeat]) => ({ id, firstBeat, lastBeat, startSeconds: beatSeconds(firstBeat), endSeconds: beatSeconds(lastBeat) })),
    harmony, events,
  };
}

function voice(event, t, position, hz, drift) {
  const phase = TAU * hz * t, release = Math.min(1, (1 - position) * 12);
  if (event.instrument === 'key') return (Math.sin(phase) + .07 * Math.sin(phase * 2) + .012 * Math.sin(phase * 3)) * (1 - Math.exp(-t / .025)) * Math.exp(-t * 2.2) * release;
  if (event.instrument === 'bass') return (Math.sin(phase) + .05 * Math.sin(phase * 2)) * Math.min(1, t / .07) * Math.exp(-t * 1.7) * release;
  if (event.instrument === 'pad') return (Math.sin(phase + .022 * Math.sin(TAU * .11 * t + drift)) + .03 * Math.sin(phase * 2)) * Math.sin(Math.PI * position) ** 2;
  throw new Error(`Unknown gearbox voice: ${event.instrument}`);
}
/** Editorial cue shapes: a low swell, a short two-partial tick and a chime. */
function cueSample(kind, t) {
  if (kind === 'swell') return Math.sin(TAU * 110 * t + .4 * Math.sin(TAU * 3 * t)) * Math.sin(Math.PI * clamp(t / .9, 0, 1)) ** 2 * .9;
  if (kind === 'tick') return (Math.sin(TAU * 1860 * t) + .5 * Math.sin(TAU * 1860 * 2.76 * t)) * Math.exp(-t / .012) * (1 - Math.exp(-t / .0008));
  if (kind === 'chime') return (Math.sin(TAU * 698.46 * t) + .6 * Math.sin(TAU * 1046.5 * t)) * Math.exp(-t * 3.2) * (1 - Math.exp(-t / .004));
  throw new Error(`Unknown cue: ${kind}`);
}
const cueLength = { swell: .9, tick: .09, chime: 1.4 };

export function renderScore(score) {
  if (score?.bpm !== BPM || score?.frames !== FRAMES || score?.sampleRate !== SAMPLE_RATE || !Array.isArray(score.events)) throw new Error('Unsupported gearbox score transport.');
  const dryLeft = new Float64Array(FRAMES), dryRight = new Float64Array(FRAMES);
  for (const event of score.events.filter(e => e.role === 'music')) {
    const first = Math.round(beatSeconds(event.beat) * SAMPLE_RATE), length = Math.round(beatSeconds(event.durationBeats) * SAMPLE_RATE);
    const pan = clamp(event.pan, -1, 1), gl = Math.cos((pan + 1) * Math.PI / 4) * event.gain, gr = Math.sin((pan + 1) * Math.PI / 4) * event.gain;
    const hz = frequency(event.midi), drift = randomSequence(event.seed)() * TAU;
    for (let i = 0; i < length; i++) {
      const value = voice(event, i / SAMPLE_RATE, i / length, hz, drift), frame = ((first + i) % FRAMES + FRAMES) % FRAMES;
      dryLeft[frame] += value * gl; dryRight[frame] += value * gr;
    }
  }
  const left = new Float64Array(FRAMES), right = new Float64Array(FRAMES), taps = [[.083, .068], [.157, .042], [.241, .024]];
  let musicPeak = 0;
  for (let frame = 0; frame < FRAMES; frame++) {
    let l = dryLeft[frame], r = dryRight[frame];
    for (const [delay, gain] of taps) { const previous = (frame - Math.round(delay * SAMPLE_RATE) + FRAMES) % FRAMES; l += dryRight[previous] * gain; r += dryLeft[previous] * gain; }
    left[frame] = l; right[frame] = r; musicPeak = Math.max(musicPeak, Math.abs(l), Math.abs(r));
  }
  const reference = dbToGain(score.mix.musicTargetSamplePeakDbfs), musicScale = reference / Math.max(musicPeak, Number.EPSILON);
  for (let frame = 0; frame < FRAMES; frame++) { left[frame] *= musicScale; right[frame] *= musicScale; }
  for (const event of score.events.filter(e => e.role === 'editorial-cue')) {
    const start = Math.round(beatSeconds(event.beat) * SAMPLE_RATE), length = Math.round(cueLength[event.instrument] * SAMPLE_RATE), gain = reference * dbToGain(event.gainDb);
    for (let i = 0; i < length; i++) {
      const value = cueSample(event.instrument, i / SAMPLE_RATE) * gain * Math.min(1, (length - i) / (SAMPLE_RATE * .01)), frame = (start + i) % FRAMES;
      left[frame] += value * Math.SQRT1_2; right[frame] += value * Math.SQRT1_2;
    }
  }
  let peak = 0; for (let frame = 0; frame < FRAMES; frame++) peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]));
  const masterScale = Math.min(1, dbToGain(score.mix.finalCeilingDbfs) / Math.max(peak, Number.EPSILON));
  if (masterScale < 1) for (let frame = 0; frame < FRAMES; frame++) { left[frame] *= masterScale; right[frame] *= masterScale; }
  return { left, right, sampleRate: SAMPLE_RATE, frames: FRAMES, durationSeconds: DURATION, masterScale };
}

export function encodeWav({ left, right, sampleRate = SAMPLE_RATE }) {
  if (left.length !== right.length) throw new Error('Stereo channels must have equal lengths.');
  const result = Buffer.alloc(44 + left.length * 4);
  result.write('RIFF', 0); result.writeUInt32LE(result.length - 8, 4); result.write('WAVE', 8); result.write('fmt ', 12); result.writeUInt32LE(16, 16);
  result.writeUInt16LE(1, 20); result.writeUInt16LE(2, 22); result.writeUInt32LE(sampleRate, 24); result.writeUInt32LE(sampleRate * 4, 28); result.writeUInt16LE(4, 32); result.writeUInt16LE(16, 34); result.write('data', 36); result.writeUInt32LE(left.length * 4, 40);
  for (let i = 0; i < left.length; i++) {
    if (!Number.isFinite(left[i]) || !Number.isFinite(right[i])) throw new Error('Non-finite output sample.');
    result.writeInt16LE(Math.round(clamp(left[i], -1, 1) * 32767), 44 + i * 4); result.writeInt16LE(Math.round(clamp(right[i], -1, 1) * 32767), 46 + i * 4);
  }
  return result;
}

export function analyzeAudio({ left, right, sampleRate = SAMPLE_RATE, masterScale = 1 }) {
  let peak = 0, energy = 0, clippedSamples = 0, maximumInteriorStep = 0;
  for (const channel of [left, right]) for (let i = 0; i < channel.length; i++) {
    const sample = channel[i]; if (!Number.isFinite(sample)) throw new Error('Audio contains a non-finite sample.');
    peak = Math.max(peak, Math.abs(sample)); energy += sample * sample;
    if (Math.abs(sample) >= 1) clippedSamples++;
    if (i) maximumInteriorStep = Math.max(maximumInteriorStep, Math.abs(sample - channel[i - 1]));
  }
  const maximumStep = Math.max(Math.abs(left[0] - left.at(-1)), Math.abs(right[0] - right.at(-1)));
  const sections = SECTIONS.map(([id, firstBeat, lastBeat]) => {
    const start = Math.round(beatSeconds(firstBeat) * sampleRate), end = Math.round(beatSeconds(lastBeat) * sampleRate);
    let sum = 0; for (let frame = start; frame < end; frame++) sum += left[frame] ** 2 + right[frame] ** 2;
    return { id, firstBeat, lastBeat, rmsDbfs: 20 * Math.log10(Math.sqrt(sum / ((end - start) * 2))) };
  });
  return { sampleRate, frames: left.length, durationSeconds: left.length / sampleRate, peak, peakDbfs: 20 * Math.log10(peak), rmsDbfs: 20 * Math.log10(Math.sqrt(energy / (left.length * 2))), clippedSamples, masterScale,
    loopBoundary: { maximumStep, maximumInteriorStep, ratioToMaximumInteriorStep: maximumStep / maximumInteriorStep }, sections,
    listeningReviewed: false, listeningReview: 'Objective waveform checks only; subjective listening requires a separate review.' };
}
