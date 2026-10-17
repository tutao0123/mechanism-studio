/** Original sample-free score for the separate 48-beat kinetic cut.
 * Notes, editorial motion effects and circular room tails share one PCM buffer.
 */
import { createHash } from 'node:crypto';

export const SAMPLE_RATE = 44_100;
export const BPM = 112;
export const TOTAL_BEATS = 48;
export const FRAMES = 1_134_000;
export const DURATION = FRAMES / SAMPLE_RATE;
export const EDITION = 'kinetic-gesture-v1';
export const SEED = 0x4b494e45;
const TAU = 2 * Math.PI;
const beatSeconds = beat => beat * 60 / BPM;
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function randomSequence(seed) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4_294_967_296; };
}

export function createScore(story, geometryRevision) {
  if (story?.BPM !== BPM || story?.TOTAL_BEATS !== TOTAL_BEATS || Math.abs(story.DURATION - DURATION) > 1e-10 || story.MOVEMENT_BEATS !== 1.25 || !Array.isArray(story.GROUPS) || story.GROUPS.length !== 4) throw new Error('Kinetic music requires the bound 112 BPM / 48 beat / 1.25 beat motion story.');
  if (typeof geometryRevision !== 'string' || !geometryRevision.trim()) throw new Error('A real geometry revision is required for the music cue bindings.');
  const knownIds = new Set(Object.keys(story.MAXIMUM_OFFSETS));
  if (story.GROUPS.some(group => !group.id || !Array.isArray(group.ids) || !group.ids.length || group.ids.some(id => !knownIds.has(id)) || !Number.isFinite(group.outBeat) || !Number.isFinite(group.inBeat))) throw new Error('Music cues must reference the bound story groups and source part IDs.');
  const random = randomSequence(SEED), events = [];
  const add = (instrument, beat, durationBeats, gain, midi, pan = 0, extra = {}) => {
    events.push({ instrument, role: 'music', beat, durationBeats, gain, ...(midi === undefined ? {} : { midi }), pan, seed: Math.floor(random() * 0xffff_ffff), ...extra });
  };
  // A compact four-note identity starts immediately; later phrases answer it.
  for (const [beat, midi, gain] of [[0, 69, .095], [.75, 73, .075], [1.5, 76, .079], [2.75, 71, .063], [4, 69, .070], [5.5, 73, .068], [7, 76, .074], [8.5, 78, .080]]) add('felt-key', beat, 2.6, gain, midi, beat % 2 ? .18 : -.18);
  // Harmonic notes overlap boundaries, including the loop: no chopped tail.
  const harmony = [
    { firstBeat: 0, lastBeat: 10, symbol: 'Dmaj9', notes: [50, 57, 61, 64], bass: 38 },
    { firstBeat: 10, lastBeat: 18, symbol: 'Aadd9 / C#', notes: [49, 57, 59, 64], bass: 37 },
    { firstBeat: 18, lastBeat: 25, symbol: 'Bm11', notes: [47, 54, 57, 64], bass: 35 },
    { firstBeat: 25, lastBeat: 32, symbol: 'Gmaj9', notes: [43, 54, 57, 62], bass: 31 },
    { firstBeat: 32, lastBeat: 40, symbol: 'Aadd9', notes: [45, 52, 59, 64], bass: 33 },
    { firstBeat: 40, lastBeat: 48, symbol: 'Dmaj9', notes: [50, 57, 61, 64], bass: 38 },
  ];
  for (const section of harmony) {
    const reading = section.firstBeat === 18 || section.firstBeat === 25;
    section.notes.forEach((midi, i) => add('breathing-pad', section.firstBeat - (section.firstBeat ? .35 : 0), section.lastBeat - section.firstBeat + 3, reading ? .009 : .012, midi, (i - 1.5) * .35));
    add('warm-bass', section.firstBeat, reading ? 4 : 3.4, reading ? .038 : .075, section.bass, -.04);
  }
  for (const beat of [2, 4, 6, 8]) add('warm-bass', beat, 1.8, .040 + beat * .002, beat === 8 ? 45 : 50, .04);
  // The build gets shorter notes and a firmer pulse, not a louder master or EDM drums.
  for (let i = 0; i < 8; i++) {
    add('felt-key', 10 + i, 1.7, [ .071, .046, .065, .045 ][i % 4], [64, 69, 73, 76, 71, 73, 76, 81][i], i % 2 ? .25 : -.25);
    if (i % 2 === 0) add('warm-bass', 10 + i, 1.65, .067, i % 4 ? 49 : 37, .02);
  }
  // Reading views deliberately leave room around both retained labels.
  for (const [beat, midi] of [[20, 74], [23, 69], [27.5, 71], [30, 66]]) add('felt-key', beat, 3.2, .042, midi, beat < 25 ? -.16 : .16);
  for (let i = 0; i < 4; i++) {
    add('felt-key', 32 + i * 2, 2.4, .074 - i * .004, [76, 73, 71, 69][i], .22 - i * .14);
    add('warm-bass', 32 + i * 2, 1.8, .060, i % 2 ? 45 : 33, -.02);
  }
  for (const [beat, midi, gain] of [[40, 69, .076], [40.75, 73, .067], [41.5, 76, .069], [42.75, 81, .053], [45, 76, .032]]) add('felt-key', beat, 3.1, gain, midi, beat < 42 ? -.13 : .13);
  add('warm-bass', 44, 3.5, .042, 50, .04);
  const actionCues = [];
  for (const [groupIndex, group] of story.GROUPS.entries()) {
    const pan = [-.24, -.08, .09, .23][groupIndex];
    for (const [phase, beat] of [['explode', group.outBeat], ['reassemble', group.inBeat]]) {
      const animation = { groupId: group.id, partIds: [...group.ids], phase, firstBeat: beat, lastBeat: beat + story.MOVEMENT_BEATS, geometryRevision };
      const extra = { id: `${group.id}-${phase}-motion`, role: 'editorial-sfx', cueRole: 'motion', anchor: 'movement-start', animation };
      add('air-motion', beat, story.MOVEMENT_BEATS, phase === 'explode' ? .052 : .044, undefined, pan, extra);
      actionCues.push({ ...extra, beat, durationBeats: story.MOVEMENT_BEATS, seconds: beatSeconds(beat), durationSeconds: beatSeconds(story.MOVEMENT_BEATS) });
      if (phase === 'reassemble') {
        const seat = { id: `${group.id}-seated`, role: 'editorial-sfx', cueRole: 'seating', anchor: 'movement-complete', animation };
        add('soft-seat', beat + story.MOVEMENT_BEATS, .42, .053, 50 + groupIndex * 2, pan * .6, seat);
        actionCues.push({ ...seat, beat: beat + story.MOVEMENT_BEATS, durationBeats: .42, seconds: beatSeconds(beat + story.MOVEMENT_BEATS), durationSeconds: beatSeconds(.42) });
      }
    }
  }
  events.sort((a, b) => a.beat - b.beat); actionCues.sort((a, b) => a.beat - b.beat);
  return {
    schemaVersion: '1.1.0', title: 'A Connected Gesture', edition: EDITION,
    authorship: 'Original Mechanism Studio composition, code synthesis and editorial effects. No external samples or recorded robot audio.',
    narration: false, geometryRevision, storyRevision: story.PLAN_REVISION,
    bpm: BPM, feltBpm: BPM / 2, totalBeats: TOTAL_BEATS, bars: 12, meter: [4, 4],
    sampleRate: SAMPLE_RATE, channels: 2, bitsPerSample: 16, frames: FRAMES, durationSeconds: DURATION, deterministicSeed: SEED,
    musicalFeel: 'Soft keys and warm pulse; an immediate motif, a short build, space for reading and a descending return. Phrase contrast rather than a louder master.',
    timing: 'One PCM transport: seconds = beat * 60 / bpm. All movement cues bind the actual kinetic story and geometry revision.',
    mix: { targetSamplePeakDbfs: -8, percussion: false, effects: 'Sparse editorial motion textures and soft return seats; no physical contact or servo simulation claim.' },
    effects: { kind: 'editorial', clock: 'Baked into the same PCM buffer; no scene timers, label dings or audio restarts.', actionCues },
    cues: [['hook', 0, 4], ['reach', 4, 10], ['expand', 10, 18], ['read', 18, 32], ['return', 32, 40], ['resolve', 40, 48]].map(([id, firstBeat, lastBeat]) => ({ id, firstBeat, lastBeat, startSeconds: beatSeconds(firstBeat), endSeconds: beatSeconds(lastBeat) })),
    harmony, beatGrid: Array.from({ length: TOTAL_BEATS + 1 }, (_, beat) => ({ beat, seconds: beatSeconds(beat), frame: Math.round(beatSeconds(beat) * SAMPLE_RATE), downbeat: beat % 4 === 0 })), events,
  };
}

function renderEvent(event, left, right) {
  const firstFrame = Math.round(beatSeconds(event.beat) * SAMPLE_RATE);
  const length = Math.ceil(beatSeconds(event.durationBeats) * SAMPLE_RATE), pan = clamp(event.pan, -1, 1);
  const gl = Math.cos((pan + 1) * Math.PI / 4) * event.gain, gr = Math.sin((pan + 1) * Math.PI / 4) * event.gain;
  const hz = frequency(event.midi ?? 60), random = randomSequence(event.seed);
  let lowNoise = 0;
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE, p = i / length, release = Math.min(1, (1 - p) * 18);
    const phase = TAU * hz * t;
    let value;
    if (event.instrument === 'felt-key') value = (Math.sin(phase) + .11 * Math.sin(2 * phase) + .022 * Math.sin(3 * phase)) * (1 - Math.exp(-t / .018)) * Math.exp(-t * 3.05) * release;
    else if (event.instrument === 'warm-bass') value = (Math.sin(phase) + .10 * Math.sin(2 * phase)) * Math.min(1, t / .035) * Math.exp(-t * 2.5) * release;
    else if (event.instrument === 'breathing-pad') value = (Math.sin(phase + .018 * Math.sin(TAU * .19 * t)) + .055 * Math.sin(2 * phase)) * Math.sin(Math.PI * p) ** 2;
    else if (event.instrument === 'air-motion') {
      lowNoise += .075 * ((random() * 2 - 1) - lowNoise);
      const reverse = event.animation.phase === 'reassemble';
      const f0 = reverse ? 285 : 165, slope = reverse ? -85 : 95;
      value = (lowNoise * .65 + .10 * Math.sin(TAU * (f0 * t + slope * t * t / 2))) * Math.sin(Math.PI * p) ** 2;
    } else if (event.instrument === 'soft-seat') {
      lowNoise += .065 * ((random() * 2 - 1) - lowNoise);
      value = (Math.sin(phase) * .46 + lowNoise * .28) * (1 - Math.exp(-t / .009)) * Math.exp(-t * 28) * release;
    } else throw new Error(`Unknown kinetic synthesis voice: ${event.instrument}`);
    const frame = ((firstFrame + i) % FRAMES + FRAMES) % FRAMES;
    left[frame] += value * gl; right[frame] += value * gr;
  }
}

export function renderScore(score) {
  if (score?.frames !== FRAMES || score?.bpm !== BPM || score?.sampleRate !== SAMPLE_RATE || score?.totalBeats !== TOTAL_BEATS || !Array.isArray(score.events)) throw new Error('Unsupported kinetic score transport.');
  const dryL = new Float64Array(FRAMES), dryR = new Float64Array(FRAMES);
  for (const event of score.events) renderEvent(event, dryL, dryR);
  const left = new Float64Array(FRAMES), right = new Float64Array(FRAMES);
  const taps = [[.053, .042], [.097, .030], [.157, .019]];
  let peak = 0;
  for (let i = 0; i < FRAMES; i++) {
    let l = dryL[i], r = dryR[i];
    for (const [delay, gain] of taps) { const previous = (i - Math.round(delay * SAMPLE_RATE) + FRAMES) % FRAMES; l += dryR[previous] * gain; r += dryL[previous] * gain; }
    left[i] = l; right[i] = r; peak = Math.max(peak, Math.abs(l), Math.abs(r));
  }
  const scale = 10 ** (-8 / 20) / Math.max(peak, Number.EPSILON);
  for (let i = 0; i < FRAMES; i++) { left[i] *= scale; right[i] *= scale; }
  return { left, right, sampleRate: SAMPLE_RATE, frames: FRAMES, durationSeconds: DURATION };
}

export function encodeWav({ left, right, sampleRate = SAMPLE_RATE }) {
  if (left.length !== right.length) throw new Error('Stereo channels must have equal lengths.');
  const result = Buffer.alloc(44 + left.length * 4);
  result.write('RIFF', 0); result.writeUInt32LE(result.length - 8, 4); result.write('WAVE', 8); result.write('fmt ', 12); result.writeUInt32LE(16, 16);
  result.writeUInt16LE(1, 20); result.writeUInt16LE(2, 22); result.writeUInt32LE(sampleRate, 24); result.writeUInt32LE(sampleRate * 4, 28); result.writeUInt16LE(4, 32); result.writeUInt16LE(16, 34); result.write('data', 36); result.writeUInt32LE(left.length * 4, 40);
  for (let i = 0; i < left.length; i++) { result.writeInt16LE(Math.round(clamp(left[i], -1, 1) * 32767), 44 + i * 4); result.writeInt16LE(Math.round(clamp(right[i], -1, 1) * 32767), 46 + i * 4); }
  return result;
}

export function analyzeAudio({ left, right, sampleRate = SAMPLE_RATE }) {
  let peak = 0, energy = 0, clippedSamples = 0, maximumInteriorStep = 0;
  for (const channel of [left, right]) for (let i = 0; i < channel.length; i++) {
    const sample = channel[i]; if (!Number.isFinite(sample)) throw new Error('Audio contains a non-finite sample.');
    peak = Math.max(peak, Math.abs(sample)); energy += sample * sample;
    if (Math.abs(sample) >= 1) clippedSamples++;
    if (i) maximumInteriorStep = Math.max(maximumInteriorStep, Math.abs(sample - channel[i - 1]));
  }
  const maximumStep = Math.max(Math.abs(left[0] - left.at(-1)), Math.abs(right[0] - right.at(-1)));
  const sections = [['hook', 0, 10], ['expand', 10, 18], ['read', 18, 32], ['return', 32, 40], ['resolve', 40, 48]].map(([id, firstBeat, lastBeat]) => {
    const start = Math.round(beatSeconds(firstBeat) * sampleRate), end = Math.round(beatSeconds(lastBeat) * sampleRate);
    let sum = 0; for (let i = start; i < end; i++) sum += left[i] ** 2 + right[i] ** 2;
    return { id, firstBeat, lastBeat, rmsDbfs: 20 * Math.log10(Math.sqrt(sum / ((end - start) * 2))) };
  });
  return { sampleRate, frames: left.length, durationSeconds: left.length / sampleRate, peak, peakDbfs: 20 * Math.log10(peak), rmsDbfs: 20 * Math.log10(Math.sqrt(energy / (left.length * 2))), clippedSamples, loopBoundary: { maximumStep, maximumInteriorStep, ratioToMaximumInteriorStep: maximumStep / maximumInteriorStep }, sections, listeningReview: 'Automated analysis only. Subjective listening and the loop must be reviewed separately.' };
}
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
