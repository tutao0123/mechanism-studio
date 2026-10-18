/** Original periodic score and editorial movement cues for the WOLF motor v2. */
import { createHash } from 'node:crypto';

export const BPM = 112;
export const SAMPLE_RATE = 44_100;
export const TOTAL_BEATS = 64;
export const FRAMES = 1_512_000;
export const DURATION = FRAMES / SAMPLE_RATE;
export const EDITION = 'wolf-motor-continuous-v2';
export const SEED = 0x574d5632;
const TAU = Math.PI * 2;
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const smooth = x => { const t = clamp(x); return t * t * (3 - 2 * t); };
export const beatSeconds = beat => beat * 60 / BPM;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const gainOfDb = value => 10 ** (value / 20);
function randomSequence(seed) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4_294_967_296; };
}

export function createScore(story, index) {
  if (story?.BPM !== BPM || story?.TOTAL_BEATS !== TOTAL_BEATS || Math.abs(story.DURATION - DURATION) > 1e-10 || story.PLAN_REVISION !== 'wolf-motor-detail-2' || !Array.isArray(story.MOTION_EVENTS) || !story.MOTION_EVENTS.length) throw new Error('Music requires the real motor v2 story and its motion events.');
  if (!index?.geometryRevision || !/^[0-9a-f]{64}$/.test(index.sourceSHA256 ?? '')) throw new Error('Music requires the source geometry revision and SHA256.');
  const known = new Set(index.parts.map(part => part.id)), seenEvents = new Set();
  const motions = story.MOTION_EVENTS.map(event => {
    if (!event.id || seenEvents.has(event.id) || !Array.isArray(event.ids) || !event.ids.length || new Set(event.ids).size !== event.ids.length || event.ids.some(id => !known.has(id)) || !Number.isFinite(event.startBeat) || !Number.isFinite(event.endBeat) || event.startBeat < 0 || event.endBeat <= event.startBeat || event.endBeat > TOTAL_BEATS || !['explode', 'reassemble', 'inspect-out', 'inspect-in'].includes(event.phase) || !['hardware', 'repeat', 'inspection'].includes(event.kind)) throw new Error('Invalid source-bound motion event.');
    seenEvents.add(event.id);
    return { id: event.id, partIds: [...event.ids], phase: event.phase, kind: event.kind, firstBeat: event.startBeat, lastBeat: event.endBeat };
  });
  const random = randomSequence(SEED), events = [], actionCues = [];
  const addMusic = (instrument, beat, durationBeats, gain, midi, pan = 0) => events.push({ instrument, role: 'music', beat, durationBeats, gain, midi, pan, seed: Math.floor(random() * 0xffff_ffff) });
  const harmony = [
    { firstBeat: 0, notes: [50, 57, 61, 64], bass: 38, symbol: 'Dmaj9' },
    { firstBeat: 8, notes: [43, 54, 57, 62], bass: 31, symbol: 'Gmaj9' },
    { firstBeat: 16, notes: [47, 54, 57, 64], bass: 35, symbol: 'Bm11' },
    { firstBeat: 24, notes: [45, 52, 59, 64], bass: 33, symbol: 'Aadd9' },
    { firstBeat: 32, notes: [43, 54, 57, 62], bass: 31, symbol: 'Gmaj9' },
    { firstBeat: 40, notes: [40, 55, 59, 66], bass: 28, symbol: 'Em9' },
    { firstBeat: 48, notes: [45, 55, 59, 66], bass: 33, symbol: 'A13' },
    { firstBeat: 56, notes: [50, 57, 61, 64], bass: 38, symbol: 'Dmaj9' },
  ];
  for (const section of harmony) {
    section.notes.forEach((midi, i) => addMusic('breathing-pad', section.firstBeat - 1.1, 10.7, .016, midi, (i - 1.5) * .35));
    addMusic('warm-bass', section.firstBeat, 3.8, .057, section.bass, -.02);
    if (section.firstBeat !== 24 && section.firstBeat !== 32 && section.firstBeat !== 56) addMusic('warm-bass', section.firstBeat + 4, 2.9, .039, section.bass + 12, .03);
  }
  // The first phrase breathes; shorter replies accompany separation and return.
  // The close-up has two quiet sustained notes, without a repeating tick bed.
  for (const [beat, midi, gain, duration] of [
    [0, 69, .058, 3.8], [3.5, 73, .038, 3.6],
    [6, 76, .058, 2.8], [8.5, 74, .041, 2.7], [11, 69, .037, 2.5], [13.5, 66, .039, 2.5],
    [16, 69, .054, 2.5], [18.5, 66, .037, 2.4], [21, 74, .041, 2.6], [23.5, 69, .032, 2.7], [26, 64, .026, 3.4],
    [30.5, 71, .025, 4.2], [34, 74, .022, 4.2],
    [38, 67, .048, 2.6], [40.5, 71, .037, 2.6], [43, 74, .036, 2.7], [46, 71, .039, 2.8],
    [49, 73, .051, 2.7], [51.5, 76, .037, 2.7], [54, 71, .033, 2.8],
    [57.5, 69, .043, 3.7], [61, 73, .025, 4.0],
  ]) addMusic('felt-key', beat, duration, gain, midi, beat % 4 < 2 ? -.15 : .15);

  const cueFor = (bound, id, instrument, cueRole = 'motion') => {
    const firstBeat = Math.min(...bound.map(event => event.firstBeat)), lastBeat = Math.max(...bound.map(event => event.lastBeat));
    const beat = cueRole === 'seating' ? lastBeat : firstBeat;
    const durationBeats = cueRole === 'seating' ? .48 : lastBeat - firstBeat;
    const partIds = [...new Set(bound.flatMap(event => event.partIds))];
    const inspection = bound[0].kind === 'inspection';
    const animation = { motionEventIds: bound.map(event => event.id), partIds, phase: bound[0].phase, kind: bound[0].kind, firstBeat, lastBeat, geometryRevision: index.geometryRevision };
    const cue = { id, role: 'editorial-sfx', cueRole, anchor: cueRole === 'seating' ? 'movement-complete' : 'movement-start', beat, seconds: beatSeconds(beat), durationBeats, durationSeconds: beatSeconds(durationBeats), animation };
    actionCues.push(cue);
    events.push({ ...cue, instrument, gain: cueRole === 'seating' ? .026 : inspection ? .022 : bound[0].kind === 'repeat' ? .027 : .035, gainReference: 'Synthesized event mono sample peak before equal-power center panning.', pan: 0, seed: Math.floor(random() * 0xffff_ffff) });
  };
  for (const event of motions.filter(event => event.kind !== 'repeat')) {
    cueFor([event], `${event.id}-motion`, event.kind === 'inspection' ? 'focus-air' : 'mechanical-slide');
    // Three major restored hardware groups receive a seat; tiny items remain quiet.
    if (event.phase === 'reassemble' && event.partIds.some(id => [story.bindings.body, story.bindings.mount, story.bindings.nut].includes(id))) cueFor([event], `${event.id}-seat`, 'soft-seat', 'seating');
  }
  const magnetIds = new Set(story.bindings.magnets), ccIds = new Set(story.bindings.cc);
  for (const phase of ['explode', 'reassemble']) for (const [name, ids] of [['magnets', magnetIds], ['cc', ccIds]]) {
    const bound = motions.filter(event => event.kind === 'repeat' && event.phase === phase && event.partIds.every(id => ids.has(id)));
    if (!bound.length || new Set(bound.flatMap(event => event.partIds)).size !== 40) throw new Error('Repeat sound needs the four actual batches and all forty matching occurrences.');
    // One continuous low-level sweep for each forty-part wave, not forty hits.
    cueFor(bound, `${name}-${phase}-wave`, 'batch-air');
  }
  events.sort((a, b) => a.beat - b.beat); actionCues.sort((a, b) => a.beat - b.beat);
  return {
    schemaVersion: '1.3.0', title: 'WOLF / Continuous Motor Study', edition: EDITION,
    authorship: 'Original Mechanism Studio composition, deterministic synthesis and editorial motion effects. No third-party samples, voice services or recordings.', originalScoreLicense: 'MIT', narration: false,
    geometryRevision: index.geometryRevision, sourceSHA256: index.sourceSHA256, storyRevision: story.PLAN_REVISION,
    bpm: BPM, feltBpm: 56, totalBeats: TOTAL_BEATS, bars: 16, meter: [4, 4], sampleRate: SAMPLE_RATE, channels: 2, bitsPerSample: 16, frames: FRAMES, durationSeconds: DURATION, deterministicSeed: SEED,
    musicalFeel: 'Quiet opening, continuous reveal phrases, a lighter single-magnet close-up, then a soft rising reassembly and resolved loop. No drums, narration or label dings.',
    timing: 'One seekable PCM clock: seconds = beat * 60 / 112. Cues derive from the actual v2 motion-event windows and retained source occurrence IDs.',
    mix: { musicTargetSamplePeakDbfs: -10, finalCeilingDbfs: -8, percussion: false, effects: 'Smooth filtered-air motion textures and three soft hardware seating cues. Editorial accents, not simulated friction, contact or physical motor sound.' },
    automation: { readingDip: { firstBeat: 27, fullBeat: 29.5, releaseBeat: 36.5, lastBeat: 39, gain: .53 }, openingGain: .76, resolveGain: .76, method: 'Continuous smoothstep gain, with matching beginning and ending gain.' },
    effects: { kind: 'editorial', clock: 'Baked into the same PCM buffer. No wall-clock timers or scene restarts.', repetitionPolicy: 'One continuous wave per repeated source family and movement phase; never one impact per magnet or cc occurrence.', actionCues },
    motionBindings: motions,
    cues: story.CHAPTERS.map(({ id, firstBeat, lastBeat }) => ({ id, firstBeat, lastBeat, startSeconds: beatSeconds(firstBeat), endSeconds: beatSeconds(lastBeat) })),
    harmony, beatGrid: Array.from({ length: TOTAL_BEATS + 1 }, (_, beat) => ({ beat, seconds: beatSeconds(beat), frame: Math.round(beatSeconds(beat) * SAMPLE_RATE), downbeat: beat % 4 === 0 })), events,
  };
}

function renderMusicEvent(event, left, right) {
  const first = Math.round(beatSeconds(event.beat) * SAMPLE_RATE), length = Math.round(beatSeconds(event.durationBeats) * SAMPLE_RATE);
  const frequency = hz(event.midi), drift = randomSequence(event.seed)() * TAU;
  const gl = Math.cos((event.pan + 1) * Math.PI / 4) * event.gain, gr = Math.sin((event.pan + 1) * Math.PI / 4) * event.gain;
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE, p = i / length, phase = TAU * frequency * t, release = smooth((1 - p) * 10);
    let value;
    if (event.instrument === 'breathing-pad') value = (Math.sin(phase + .021 * Math.sin(TAU * .15 * t + drift)) + .025 * Math.sin(phase * 2)) * Math.sin(Math.PI * p) ** 2;
    else if (event.instrument === 'felt-key') value = (Math.sin(phase) + .062 * Math.sin(phase * 2) + .012 * Math.sin(phase * 3)) * (1 - Math.exp(-t / .03)) * Math.exp(-t * 1.7) * release;
    else if (event.instrument === 'warm-bass') value = (Math.sin(phase) + .045 * Math.sin(phase * 2)) * smooth(t / .07) * Math.exp(-t * 1.5) * release;
    else throw new Error(`Unknown original voice: ${event.instrument}`);
    const frame = ((first + i) % FRAMES + FRAMES) % FRAMES;
    left[frame] += value * gl; right[frame] += value * gr;
  }
}

function renderEffect(event, left, right) {
  const start = Math.round(event.seconds * SAMPLE_RATE), length = Math.round(event.durationSeconds * SAMPLE_RATE), random = randomSequence(event.seed);
  const wave = new Float64Array(length);
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
    else throw new Error(`Unknown editorial effect: ${event.instrument}`);
    wave[i] = value; peak = Math.max(peak, Math.abs(value));
  }
  // Calibrate the original synthesis itself, so a filtered noise texture is
  // audible at the documented quiet level instead of disappearing in the bed.
  const scale = event.gain * Math.SQRT1_2 / Math.max(peak, Number.EPSILON);
  for (let i = 0; i < length; i++) {
    const frame = start + i;
    if (frame >= FRAMES) throw new Error('Action effects cannot cross the end of the motion timeline.');
    left[frame] += wave[i] * scale; right[frame] += wave[i] * scale;
  }
}

export function renderScore(score) {
  if (score?.bpm !== BPM || score?.frames !== FRAMES || score?.sampleRate !== SAMPLE_RATE || !Array.isArray(score.events)) throw new Error('Unsupported motor score transport.');
  const dryLeft = new Float64Array(FRAMES), dryRight = new Float64Array(FRAMES);
  for (const event of score.events.filter(event => event.role === 'music')) renderMusicEvent(event, dryLeft, dryRight);
  const left = new Float64Array(FRAMES), right = new Float64Array(FRAMES), taps = [[.083, .060], [.167, .037], [.271, .022]];
  let peak = 0;
  for (let frame = 0; frame < FRAMES; frame++) {
    let l = dryLeft[frame], r = dryRight[frame];
    for (const [delay, gain] of taps) { const prior = (frame - Math.round(delay * SAMPLE_RATE) + FRAMES) % FRAMES; l += dryRight[prior] * gain; r += dryLeft[prior] * gain; }
    const beat = frame / SAMPLE_RATE * BPM / 60;
    const focus = smooth((beat - 27) / 2.5) * (1 - smooth((beat - 36.5) / 2.5));
    const opening = .76 + .24 * smooth((beat - 1) / 5), ending = 1 - .24 * smooth((beat - 58) / 6);
    const envelope = opening * ending * (1 - .47 * focus);
    left[frame] = l * envelope; right[frame] = r * envelope; peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]));
  }
  const musicScale = gainOfDb(score.mix.musicTargetSamplePeakDbfs) / Math.max(peak, Number.EPSILON);
  for (let frame = 0; frame < FRAMES; frame++) { left[frame] *= musicScale; right[frame] *= musicScale; }
  for (const event of score.events.filter(event => event.role === 'editorial-sfx')) renderEffect(event, left, right);
  peak = 0; for (let frame = 0; frame < FRAMES; frame++) peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]));
  const masterScale = Math.min(1, gainOfDb(score.mix.finalCeilingDbfs) / Math.max(peak, Number.EPSILON));
  if (masterScale < 1) for (let frame = 0; frame < FRAMES; frame++) { left[frame] *= masterScale; right[frame] *= masterScale; }
  return { left, right, sampleRate: SAMPLE_RATE, frames: FRAMES, durationSeconds: DURATION, masterScale };
}

export function encodeWav({ left, right, sampleRate = SAMPLE_RATE }) {
  if (left.length !== right.length) throw new Error('Stereo channels must have equal lengths.');
  const bytes = Buffer.alloc(44 + left.length * 4);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVE', 8); bytes.write('fmt ', 12); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22); bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 4, 28); bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(left.length * 4, 40);
  for (let i = 0; i < left.length; i++) {
    if (!Number.isFinite(left[i]) || !Number.isFinite(right[i])) throw new Error('Non-finite output sample.');
    bytes.writeInt16LE(Math.round(clamp(left[i], -1, 1) * 32767), 44 + i * 4); bytes.writeInt16LE(Math.round(clamp(right[i], -1, 1) * 32767), 46 + i * 4);
  }
  return bytes;
}

export function analyzeAudio({ left, right, sampleRate = SAMPLE_RATE, masterScale = 1 }, score) {
  let peak = 0, energy = 0, clippedSamples = 0, maximumInteriorStep = 0;
  for (const channel of [left, right]) for (let i = 0; i < channel.length; i++) {
    const sample = channel[i]; if (!Number.isFinite(sample)) throw new Error('Non-finite output audio.');
    peak = Math.max(peak, Math.abs(sample)); energy += sample * sample;
    if (Math.abs(sample) >= 1) clippedSamples++;
    if (i) maximumInteriorStep = Math.max(maximumInteriorStep, Math.abs(sample - channel[i - 1]));
  }
  const maximumStep = Math.max(Math.abs(left[0] - left.at(-1)), Math.abs(right[0] - right.at(-1)));
  const sections = score.cues.map(cue => {
    const start = Math.round(cue.startSeconds * sampleRate), end = Math.round(cue.endSeconds * sampleRate);
    let sum = 0; for (let frame = start; frame < end; frame++) sum += left[frame] ** 2 + right[frame] ** 2;
    return { id: cue.id, firstBeat: cue.firstBeat, lastBeat: cue.lastBeat, rmsDbfs: 20 * Math.log10(Math.sqrt(sum / ((end - start) * 2))) };
  });
  return { sampleRate, frames: left.length, durationSeconds: left.length / sampleRate, peak, peakDbfs: 20 * Math.log10(peak), rmsDbfs: 20 * Math.log10(Math.sqrt(energy / (left.length * 2))), clippedSamples, masterScale, loopBoundary: { maximumStep, maximumInteriorStep, ratioToMaximumInteriorStep: maximumStep / maximumInteriorStep }, sections, listeningReviewed: false, listeningReview: 'Objective waveform checks only. Subjective listening is not claimed.' };
}
