/** Continuous-length variant of the project's original gentle synthesis voices.
 * Notes and room tails wrap once around the complete tour, never per segment.
 */
export { encodeWav, analyzeAudio, sha256 } from '../../detail/audio/synth.mjs';
export const SAMPLE_RATE = 44_100;
const TAU = Math.PI * 2;
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const smooth = x => { const t = clamp(x); return t * t * (3 - 2 * t); };
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const gainOfDb = value => 10 ** (value / 20);
export function randomSequence(seed) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4_294_967_296; };
}

function renderMusicEvent(event, left, right, score) {
  const frames = left.length, seconds = beats => beats * 60 / score.bpm;
  const first = Math.round(seconds(event.beat) * SAMPLE_RATE), length = Math.round(seconds(event.durationBeats) * SAMPLE_RATE);
  const frequency = hz(event.midi), drift = randomSequence(event.seed)() * TAU;
  const gl = Math.cos((event.pan + 1) * Math.PI / 4) * event.gain, gr = Math.sin((event.pan + 1) * Math.PI / 4) * event.gain;
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE, p = i / length, phase = TAU * frequency * t, release = smooth((1 - p) * 10);
    let value;
    if (event.instrument === 'breathing-pad') value = (Math.sin(phase + .021 * Math.sin(TAU * .15 * t + drift)) + .025 * Math.sin(phase * 2)) * Math.sin(Math.PI * p) ** 2;
    else if (event.instrument === 'felt-key') value = (Math.sin(phase) + .062 * Math.sin(phase * 2) + .012 * Math.sin(phase * 3)) * (1 - Math.exp(-t / .03)) * Math.exp(-t * 1.7) * release;
    else if (event.instrument === 'warm-bass') value = (Math.sin(phase) + .045 * Math.sin(phase * 2)) * smooth(t / .07) * Math.exp(-t * 1.5) * release;
    else throw new Error(`Unknown original tour voice: ${event.instrument}`);
    const frame = ((first + i) % frames + frames) % frames;
    left[frame] += value * gl; right[frame] += value * gr;
  }
}

function renderEffect(event, left, right) {
  const start = Math.round(event.seconds * SAMPLE_RATE), length = Math.round(event.durationSeconds * SAMPLE_RATE), random = randomSequence(event.seed), wave = new Float64Array(length);
  let low = 0, mid = 0, peak = 0;
  for (let i = 0; i < length; i++) {
    const p = i / length, t = i / SAMPLE_RATE, noise = random() * 2 - 1;
    low += .029 * (noise - low); mid += .13 * (noise - mid);
    const envelope = Math.sin(Math.PI * p) ** 1.55;
    let value;
    if (event.instrument === 'soft-seat') value = (Math.sin(TAU * 139 * t) * .55 + Math.sin(TAU * 208.2 * t) * .16 + low * .35) * smooth(t / .006) * Math.exp(-t * 26) * smooth((1 - p) * 6);
    else if (event.instrument === 'mechanical-slide') value = envelope * (low * 1.7 + (mid - low) * .26 + Math.sin(TAU * (104 * t + 18 * t * t / Math.max(event.durationSeconds, .1))) * .075);
    else if (event.instrument === 'focus-air') value = envelope * (low * 1.3 + (mid - low) * .18);
    else if (event.instrument === 'batch-air') value = envelope * (low * 1.6 + (mid - low) * .20) * (.8 + .2 * Math.sin(Math.PI * p * 3) ** 2);
    else throw new Error(`Unknown editorial tour effect: ${event.instrument}`);
    wave[i] = value; peak = Math.max(peak, Math.abs(value));
  }
  const gl = Math.cos((event.pan + 1) * Math.PI / 4) * event.gain / Math.max(peak, Number.EPSILON), gr = Math.sin((event.pan + 1) * Math.PI / 4) * event.gain / Math.max(peak, Number.EPSILON);
  for (let i = 0; i < length; i++) {
    const frame = start + i;
    if (frame < 0 || frame >= left.length) throw new Error('Editorial effects must fit inside the complete tour.');
    left[frame] += wave[i] * gl; right[frame] += wave[i] * gr;
  }
}

export function renderScore(score) {
  if (score?.sampleRate !== SAMPLE_RATE || !Number.isFinite(score.bpm) || score.bpm <= 0 || !Number.isInteger(score.frames) || score.frames <= 0 || !Array.isArray(score.events) || !Array.isArray(score.automation?.readingDips) || Math.abs(score.frames / SAMPLE_RATE - score.totalBeats * 60 / score.bpm) > 1 / SAMPLE_RATE) throw new Error('Unsupported continuous tour score transport.');
  const frames = score.frames, dryLeft = new Float64Array(frames), dryRight = new Float64Array(frames);
  for (const event of score.events.filter(event => event.role === 'music')) renderMusicEvent(event, dryLeft, dryRight, score);
  const left = new Float64Array(frames), right = new Float64Array(frames), taps = [[.083, .060], [.167, .037], [.271, .022]];
  let peak = 0;
  for (let frame = 0; frame < frames; frame++) {
    let l = dryLeft[frame], r = dryRight[frame];
    for (const [delay, gain] of taps) { const prior = (frame - Math.round(delay * SAMPLE_RATE) + frames) % frames; l += dryRight[prior] * gain; r += dryLeft[prior] * gain; }
    const beat = frame / SAMPLE_RATE * score.bpm / 60;
    const opening = score.automation.loopGain + (1 - score.automation.loopGain) * smooth((beat - 1) / 5);
    const ending = 1 - (1 - score.automation.loopGain) * smooth((beat - (score.totalBeats - 6)) / 6);
    let envelope = opening * ending;
    for (const dip of score.automation.readingDips) {
      const focus = smooth((beat - dip.firstBeat) / (dip.fullBeat - dip.firstBeat)) * (1 - smooth((beat - dip.releaseBeat) / (dip.lastBeat - dip.releaseBeat)));
      envelope *= 1 - (1 - dip.gain) * focus;
    }
    left[frame] = l * envelope; right[frame] = r * envelope; peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]));
  }
  const musicScale = gainOfDb(score.mix.musicTargetSamplePeakDbfs) / Math.max(peak, Number.EPSILON);
  for (let frame = 0; frame < frames; frame++) { left[frame] *= musicScale; right[frame] *= musicScale; }
  for (const event of score.events.filter(event => event.role === 'editorial-sfx')) renderEffect(event, left, right);
  peak = 0; for (let frame = 0; frame < frames; frame++) peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]));
  const masterScale = Math.min(1, gainOfDb(score.mix.finalCeilingDbfs) / Math.max(peak, Number.EPSILON));
  if (masterScale < 1) for (let frame = 0; frame < frames; frame++) { left[frame] *= masterScale; right[frame] *= masterScale; }
  return { left, right, sampleRate: SAMPLE_RATE, frames, durationSeconds: frames / SAMPLE_RATE, masterScale };
}
