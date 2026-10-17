/**
 * Original, deterministic robot-showcase score. No samples, external instruments,
 * runtime randomness, network requests or voice services are used.
 *
 * The whole render is periodic: notes and short room reflections wrap around the
 * same 64-beat buffer, so a sustaining tail is not chopped at the loop boundary.
 */
import { createHash } from 'node:crypto';

export const SAMPLE_RATE = 44_100;
export const BPM = 112;
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
  const add = (instrument, beat, durationBeats, gain, midi, pan = 0) => {
    events.push({ instrument, beat, durationBeats, gain, ...(midi === undefined ? {} : { midi }), pan, seed: Math.floor(random() * 0xffff_ffff) });
  };
  // A minor nine, C major nine, F major nine, G six. Four bars per harmony.
  const harmonies = [
    { symbol: 'Am9', bass: 33, notes: [57, 60, 64, 67, 71] },
    { symbol: 'Cmaj9', bass: 36, notes: [55, 59, 60, 64, 74] },
    { symbol: 'Fmaj9', bass: 29, notes: [57, 60, 64, 67, 72] },
    { symbol: 'G6', bass: 31, notes: [55, 59, 62, 64, 69] },
  ];
  const arpeggio = [0, 2, 4, 2, 1, 3, 2, 4];
  for (let bar = 0; bar < BARS; bar++) {
    const start = bar * BEATS_PER_BAR;
    const harmony = harmonies[Math.floor(bar / 4)];
    const thin = bar < 2 || bar >= 14;
    // Soft, dry kick; bass and backbeat are deliberately quieter than a promo track.
    for (const offset of thin ? [0, 2] : [0, 1.75, 2, 3.5]) add('kick', start + offset, 0.5, offset === 0 || offset === 2 ? 0.62 : 0.28);
    for (const offset of [1, 3]) add('rim', start + offset, 0.24, thin ? 0.18 : 0.27, undefined, 0.06);
    for (let eighth = 0; eighth < 8; eighth++) {
      if (thin && eighth % 2 === 0) continue;
      add('hat', start + eighth / 2, 0.13, eighth % 2 ? 0.13 : 0.075, undefined, eighth % 2 ? -0.32 : 0.28);
    }
    for (const [offset, interval, gain] of [[0, 0, 0.30], [1.5, 0, 0.18], [2.5, 12, 0.17], [3.5, 7, 0.14]]) {
      add('bass', start + offset, offset === 0 ? 1.1 : 0.44, gain * (thin ? 0.76 : 1), harmony.bass + interval);
    }
    for (let step = 0; step < 8; step++) {
      if (thin && step % 2) continue;
      const note = harmony.notes[arpeggio[(step + (bar % 2 ? 2 : 0)) % 8]];
      add('pluck', start + step * 0.5 + (step % 2 ? 0.025 : 0), 1.1, (step === 0 ? 0.15 : 0.10) * (thin ? 0.72 : 1), note + 12, (step % 3 - 1) * 0.4);
    }
    if (bar % 2 === 0) {
      for (const [index, note] of harmony.notes.slice(0, 4).entries()) add('pad', start, 8.8, 0.021, note, (index - 1.5) / 3);
    }
    if ([2, 6, 10, 14].includes(bar)) add('chime', start, 2.6, 0.105, harmony.notes[4] + 12, bar % 4 ? 0.2 : -0.2);
    // Gentle mechanical double click announces a new motion phrase, not every cut.
    if ([2, 6, 10].includes(bar)) {
      add('click', start, 0.18, 0.15, undefined, -0.18);
      add('click', start + 0.25, 0.18, 0.09, undefined, 0.18);
    }
  }
  const cue = (id, firstBar, lastBar, purpose) => ({ id, firstBeat: firstBar * 4, lastBeat: lastBar * 4, startSeconds: seconds(firstBar * 4), endSeconds: seconds(lastBar * 4), purpose });
  return {
    schemaVersion: '1.0.0',
    title: 'Assembly / Return',
    authorship: 'Original Mechanism Studio composition and synthesis; no third-party samples.',
    narration: false,
    bpm: BPM, meter: [4, 4], bars: BARS, totalBeats: BARS * BEATS_PER_BAR,
    sampleRate: SAMPLE_RATE, channels: 2, bitsPerSample: 16, frames: FRAMES,
    durationSeconds: DURATION, deterministicSeed: SEED,
    timing: 'One audio transport. timeSeconds = beat * 60 / bpm. Frame rounding is below one sample.',
    harmony: harmonies.map(({ symbol }, index) => ({ firstBar: index * 4, bars: 4, symbol })),
    cues: [
      cue('assembled', 0, 2, 'Establish the assembled robot; title and first camera hold.'),
      cue('explode', 2, 6, 'Beat-aligned display groups expand, then hold.'),
      cue('inspect', 6, 10, 'Stable detail views of the expanded assembly.'),
      cue('reassemble', 10, 14, 'Display groups return to their unchanged rest placements.'),
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
  let previousNoise = 0;
  for (let i = 0; i < length; i++) {
    const time = i / SAMPLE_RATE;
    const normalized = i / length;
    const release = Math.min(1, (1 - normalized) * 16);
    let value;
    switch (event.instrument) {
      case 'kick': {
        const phase = TAU * (47 * time + 85 * 0.021 * (1 - Math.exp(-time / 0.021)));
        value = Math.sin(phase) * Math.min(1, time / 0.002) * Math.exp(-time * 19) * release;
        break;
      }
      case 'bass': {
        const phase = TAU * frequency * time;
        value = (Math.sin(phase) + 0.16 * Math.sin(2 * phase) + 0.05 * Math.sin(3 * phase)) * Math.min(1, time / 0.012) * Math.exp(-time * 4.8) * release;
        break;
      }
      case 'pluck': {
        const phase = TAU * frequency * time;
        value = (Math.sin(phase) + 0.25 * Math.sin(2 * phase) + 0.07 * Math.sin(3 * phase)) * Math.min(1, time / 0.008) * Math.exp(-time * 8.5) * release;
        break;
      }
      case 'pad': {
        const phase = TAU * frequency * time;
        const envelope = Math.sin(Math.PI * normalized) ** 2;
        value = (Math.sin(phase) + 0.18 * Math.sin(2 * phase + 0.12 * Math.sin(TAU * 0.25 * time))) * envelope;
        break;
      }
      case 'chime': {
        const phase = TAU * frequency * time;
        value = (Math.sin(phase) + 0.18 * Math.sin(2.003 * phase)) * Math.min(1, time / 0.012) * Math.exp(-time * 3.8) * release;
        break;
      }
      case 'rim': {
        const noise = random() * 2 - 1;
        value = (0.7 * Math.sin(TAU * 780 * time) + 0.30 * noise) * Math.min(1, time / 0.001) * Math.exp(-time * 100) * release;
        break;
      }
      case 'hat': {
        const noise = random() * 2 - 1;
        value = (noise - previousNoise) * 0.45 * Math.min(1, time / 0.0012) * Math.exp(-time * 95) * release;
        previousNoise = noise;
        break;
      }
      case 'click': {
        value = (Math.sin(TAU * 1450 * time) + 0.35 * Math.sin(TAU * 2130 * time)) * Math.min(1, time / 0.001) * Math.exp(-time * 170) * release;
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
  // Leave 3 dB true sample headroom. The score uses no hard clipping or limiter.
  const scale = 10 ** (-3 / 20) / Math.max(maximum, Number.EPSILON);
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
