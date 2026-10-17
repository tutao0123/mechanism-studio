/**
 * Original, deterministic robot-showcase score. No samples, external instruments,
 * runtime randomness, network requests or voice services are used.
 *
 * The whole render is periodic: notes and short room reflections wrap around the
 * same 64-beat buffer, so a sustaining tail is not chopped at the loop boundary.
 */
import { createHash } from 'node:crypto';
import { GROUPS, BPM as STORY_BPM, TOTAL_BEATS } from '../story.mjs';

export const SAMPLE_RATE = 44_100;
export const BPM = STORY_BPM;
export const FELT_BPM = BPM / 2;
export const BARS = 16;
export const BEATS_PER_BAR = 4;
export const FRAMES = 1_512_000;
export const DURATION = FRAMES / SAMPLE_RATE;
export const SEED = 0x524f424f;
const TAU = 2 * Math.PI;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const seconds = (beats) => beats * 60 / BPM;

function randomSequence(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

export function createScore() {
  const events = [];
  const random = randomSequence(SEED);
  const add = (instrument, beat, durationBeats, gain, midi, pan = 0, extra = {}) => {
    events.push({ instrument, role: 'music', beat, durationBeats, gain, ...(midi === undefined ? {} : { midi }), pan, seed: Math.floor(random() * 0xffff_ffff), ...extra });
  };
  // Long major/ninth voicings and a half-time feel soften the unchanged motion grid.
  const harmonies = [
    { symbol: 'Dmaj9', bass: 38, notes: [50, 54, 57, 61, 64], melody: [66, 69, 64, 61] },
    { symbol: 'Aadd9', bass: 33, notes: [45, 52, 57, 59, 64], melody: [64, 61, 59, 64] },
    { symbol: 'Bm11', bass: 35, notes: [47, 54, 57, 62, 64], melody: [62, 66, 64, 57] },
    { symbol: 'Gmaj9', bass: 31, notes: [43, 50, 54, 57, 59], melody: [59, 62, 57, 64] },
  ];
  for (let bar = 0; bar < BARS; bar++) {
    const start = bar * BEATS_PER_BAR;
    const harmony = harmonies[Math.floor(bar / 4)];
    const phrase = bar % 4;
    // A warm note every two transport beats suggests 56 BPM without drum transients.
    // Four opening/closing bars breathe more, with no arpeggio or percussion bed.
    add('warm-bass', start, 3.6, phrase === 0 ? 0.080 : 0.062, harmony.bass, -0.04);
    if (bar > 1 && bar < 14) add('warm-bass', start + 2, 1.8, 0.039, harmony.bass + (phrase === 3 ? 7 : 12), 0.04);
    add('rounded-key', start + 0.45, 3.5, 0.067, harmony.melody[phrase], phrase % 2 ? 0.20 : -0.20);
    if (bar % 2 === 1 && bar < 14) add('rounded-key', start + 2.65, 3.4, 0.036, harmony.notes[3] + 12, 0.15);
    if (bar % 2 === 0) {
      for (const [index, note] of harmony.notes.entries()) add('soft-pad', start, 10.5, 0.013, note, (index - 2) * 0.24);
    }
  }
  const actionCues = [];
  for (const [groupIndex, group] of GROUPS.entries()) {
    const pan = [-0.18, -0.06, 0.12, 0.22][groupIndex];
    for (const [phase, beat] of [['explode', group.outBeat], ['reassemble', group.inBeat]]) {
      const animation = { groupId: group.id, partIds: [...group.ids], phase, firstBeat: beat, lastBeat: beat + 2 };
      const motion = { id: `${group.id}-${phase}-motion`, role: 'editorial-sfx', cueRole: 'motion', anchor: 'movement-start', animation };
      add('air-servo', beat, 2, [0.050, 0.045, 0.040, 0.035][groupIndex] * (phase === 'reassemble' ? 0.86 : 1), undefined, pan, motion);
      actionCues.push({ ...motion, beat, durationBeats: 2, seconds: seconds(beat), durationSeconds: seconds(2) });
      // Seating cues only mark successful returns, never label/camera changes.
      if (phase === 'reassemble') {
        const seating = { id: `${group.id}-seated`, role: 'editorial-sfx', cueRole: 'seating', anchor: 'movement-complete', animation };
        add('soft-seat', beat + 2, 0.50, 0.045 + groupIndex * 0.002, 47 + groupIndex * 2, pan * 0.6, seating);
        actionCues.push({ ...seating, beat: beat + 2, durationBeats: 0.50, seconds: seconds(beat + 2), durationSeconds: seconds(0.50) });
      }
    }
  }
  events.sort((a, b) => a.beat - b.beat);
  actionCues.sort((a, b) => a.beat - b.beat);
  const cue = (id, firstBar, lastBar, purpose) => ({ id, firstBeat: firstBar * 4, lastBeat: lastBar * 4, startSeconds: seconds(firstBar * 4), endSeconds: seconds(lastBar * 4), purpose });
  return {
    schemaVersion: '1.1.0',
    title: 'Quiet Assembly / Return',
    edition: 'quiet-assembly-v2',
    authorship: 'Original Mechanism Studio composition, synthesis and editorial effects; no third-party samples.',
    narration: false,
    bpm: BPM, feltBpm: FELT_BPM, musicalFeel: 'Relaxed half-time; sustained pads, warm bass and sparse rounded keys; no drum or tick bed.',
    meter: [4, 4], bars: BARS, totalBeats: TOTAL_BEATS,
    sampleRate: SAMPLE_RATE, channels: 2, bitsPerSample: 16, frames: FRAMES,
    durationSeconds: DURATION, deterministicSeed: SEED,
    timing: 'One audio transport. timeSeconds = beat * 60 / bpm. Frame rounding is below one sample.',
    effects: { kind: 'editorial', description: 'Air/servo textures follow group motion; soft seats mark the four return completions. These sounds are designed accents, not physical motor or collision simulation.', clock: 'Rendered into the same PCM buffer as the score. No independent timers, label dings or per-scene audio restarts.', actionCues },
    mix: { targetSamplePeakDbfs: -8, music: 'foreground bed', effects: 'quiet, sparse accents', percussion: false },
    harmony: harmonies.map(({ symbol }, index) => ({ firstBar: index * 4, bars: 4, symbol })),
    cues: [
      cue('assembled', 0, 2, 'Establish the assembled robot; title and first camera hold.'),
      cue('explode', 2, 6, 'Beat-aligned display groups expand with quiet movement textures, then hold.'),
      cue('inspect', 6, 10, 'Stable detail views of the expanded assembly.'),
      cue('reassemble', 10, 14, 'Display groups return to unchanged rest placements; soft accents mark seating.'),
      cue('resolve', 14, 16, 'Assembled hero view returns to the opening pose and framing.'),
    ],
    beatGrid: Array.from({ length: BARS * 4 + 1 }, (_, beat) => ({ beat, seconds: seconds(beat), frame: Math.round(seconds(beat) * SAMPLE_RATE), downbeat: beat % 4 === 0 })),
    events,
  };
}

function renderEvent(event, left, right) {
  const start = Math.round(seconds(event.beat) * SAMPLE_RATE);
  const length = Math.ceil(seconds(event.durationBeats) * SAMPLE_RATE);
  const pan = clamp(event.pan, -1, 1);
  const gainLeft = Math.cos((pan + 1) * Math.PI / 4) * event.gain;
  const gainRight = Math.sin((pan + 1) * Math.PI / 4) * event.gain;
  const frequency = hz(event.midi ?? 60);
  const random = randomSequence(event.seed);
  let filteredNoise = 0;
  for (let i = 0; i < length; i++) {
    const time = i / SAMPLE_RATE;
    const normalized = i / length;
    const release = Math.min(1, (1 - normalized) * 16);
    let value;
    switch (event.instrument) {
      case 'warm-bass': {
        const phase = TAU * frequency * time;
        value = (Math.sin(phase) + 0.12 * Math.sin(2 * phase)) * Math.min(1, time / 0.080) * Math.exp(-time * 1.9) * release;
        break;
      }
      case 'rounded-key': {
        const phase = TAU * frequency * time;
        value = (Math.sin(phase) + 0.13 * Math.sin(2 * phase) + 0.025 * Math.sin(3 * phase)) * (1 - Math.exp(-time / 0.045)) * Math.exp(-time * 1.9) * release;
        break;
      }
      case 'soft-pad': {
        const phase = TAU * frequency * time;
        const envelope = Math.sin(Math.PI * normalized) ** 2;
        value = (Math.sin(phase + 0.035 * Math.sin(TAU * 0.16 * time)) + 0.09 * Math.sin(2 * phase)) * envelope;
        break;
      }
      case 'air-servo': {
        filteredNoise += 0.065 * ((random() * 2 - 1) - filteredNoise);
        const returnMotion = event.animation.phase === 'reassemble';
        const firstFrequency = returnMotion ? 265 : 185;
        const sweep = returnMotion ? -35 : 40;
        const phase = TAU * (firstFrequency * time + sweep * time * time / 2);
        const envelope = Math.sin(Math.PI * normalized) ** 2;
        value = (filteredNoise * 0.60 + Math.sin(phase) * 0.085) * envelope;
        break;
      }
      case 'soft-seat': {
        filteredNoise += 0.055 * ((random() * 2 - 1) - filteredNoise);
        const envelope = (1 - Math.exp(-time / 0.012)) * Math.exp(-time * 24) * release;
        value = (Math.sin(TAU * frequency * time) * 0.48 + filteredNoise * 0.25) * envelope;
        break;
      }
      default: throw new Error(`Unknown synthesis instrument: ${event.instrument}`);
    }
    const frame = (start + i) % FRAMES;
    left[frame] += value * gainLeft;
    right[frame] += value * gainRight;
  }
}

export function renderScore(score = createScore()) {
  if (score.frames !== FRAMES || score.sampleRate !== SAMPLE_RATE || score.bpm !== BPM || score.totalBeats !== 64) throw new Error('Unsupported score transport; this score has a fixed 112 BPM / 64 beat loop.');
  const dryLeft = new Float64Array(FRAMES);
  const dryRight = new Float64Array(FRAMES);
  for (const event of score.events) renderEvent(event, dryLeft, dryRight);
  const left = new Float64Array(FRAMES);
  const right = new Float64Array(FRAMES);
  // Circular, sparse room reflections: no external impulse response or cut tail.
  const taps = [[0.061, 0.045], [0.109, 0.033], [0.173, 0.022]];
  for (let frame = 0; frame < FRAMES; frame++) {
    let l = dryLeft[frame]; let r = dryRight[frame];
    for (const [delay, gain] of taps) {
      const previous = (frame - Math.round(delay * SAMPLE_RATE) + FRAMES) % FRAMES;
      l += dryRight[previous] * gain; r += dryLeft[previous] * gain;
    }
    left[frame] = l; right[frame] = r;
  }
  let maximum = 0;
  for (let frame = 0; frame < FRAMES; frame++) maximum = Math.max(maximum, Math.abs(left[frame]), Math.abs(right[frame]));
  // Leave 8 dB sample headroom. This is not an inter-sample true-peak claim.
  // The score uses no hard clipping or limiter.
  const scale = 10 ** (-8 / 20) / Math.max(maximum, Number.EPSILON);
  for (let frame = 0; frame < FRAMES; frame++) { left[frame] *= scale; right[frame] *= scale; }
  return { left, right, sampleRate: SAMPLE_RATE, frames: FRAMES, durationSeconds: DURATION };
}

export function encodeWav({ left, right, sampleRate = SAMPLE_RATE }) {
  if (left.length !== right.length) throw new Error('Stereo channels must have equal lengths.');
  const bytes = Buffer.alloc(44 + left.length * 4);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVE', 8);
  bytes.write('fmt ', 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(2, 22); bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 4, 28);
  bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(left.length * 4, 40);
  for (let frame = 0; frame < left.length; frame++) {
    bytes.writeInt16LE(Math.round(clamp(left[frame], -1, 1) * 32767), 44 + frame * 4);
    bytes.writeInt16LE(Math.round(clamp(right[frame], -1, 1) * 32767), 46 + frame * 4);
  }
  return bytes;
}

export function analyzeAudio({ left, right, sampleRate = SAMPLE_RATE }) {
  let peak = 0; let energy = 0; let clippedSamples = 0; let maximumInteriorStep = 0;
  for (const channel of [left, right]) {
    for (let frame = 0; frame < channel.length; frame++) {
      const sample = channel[frame];
      if (!Number.isFinite(sample)) throw new Error('Non-finite audio sample.');
      peak = Math.max(peak, Math.abs(sample)); energy += sample * sample;
      if (Math.abs(sample) >= 1) clippedSamples++;
      if (frame) maximumInteriorStep = Math.max(maximumInteriorStep, Math.abs(sample - channel[frame - 1]));
    }
  }
  const rms = Math.sqrt(energy / (left.length * 2));
  const boundaryStep = Math.max(Math.abs(left[0] - left.at(-1)), Math.abs(right[0] - right.at(-1)));
  return {
    sampleRate, frames: left.length, durationSeconds: left.length / sampleRate,
    peak, peakDbfs: 20 * Math.log10(peak), rms, rmsDbfs: 20 * Math.log10(rms), clippedSamples,
    loopBoundary: { maximumStep: boundaryStep, maximumInteriorStep, ratioToMaximumInteriorStep: boundaryStep / maximumInteriorStep },
    listeningReview: 'Not claimed by automated analysis; audition the delivered file and its loop separately.',
  };
}

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
