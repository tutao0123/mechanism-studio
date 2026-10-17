/** Original gentle composition and deterministic CC0 cue mix for the humanoid story. */
import { createHash } from 'node:crypto';

export const SAMPLE_RATE = 44_100;
export const BPM = 108;
export const TOTAL_BEATS = 64;
export const FRAMES = 1_568_000;
export const DURATION = FRAMES / SAMPLE_RATE;
export const EDITION = 'humanoid-gentle-v1';
export const SEED = 0x48554d31;
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const beatSeconds = beat => beat * 60 / BPM;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
const dbToGain = db => 10 ** (db / 20);
const SOURCE_FILES = ['maximize_003.wav', 'minimize_003.wav', 'click_003.wav', 'tick_002.wav', 'confirmation_001.wav'];
const SECTIONS = [['opening', 0, 8], ['separation', 8, 26], ['upper-detail', 26, 34], ['lower-detail', 34, 42], ['reassembly', 42, 58], ['resolve', 58, 64]];

function randomSequence(seed) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4_294_967_296; };
}

export function createScore(story, geometryRevision, provenance) {
  if (story?.BPM !== BPM || story?.TOTAL_BEATS !== TOTAL_BEATS || Math.abs(story.DURATION - DURATION) > 1e-10 || story.MOVEMENT_BEATS !== 1.4 || !Array.isArray(story.GROUPS) || story.GROUPS.length !== 8) throw new Error('Humanoid music requires the bound 108 BPM / 64 beat / 1.4 beat movement story with eight source groups.');
  if (typeof geometryRevision !== 'string' || !geometryRevision.trim()) throw new Error('A real geometry revision is required for the music bindings.');
  const knownIds = story.MAXIMUM_OFFSETS ? new Set(Object.keys(story.MAXIMUM_OFFSETS)) : null;
  if (story.GROUPS.some((group, index) => !group.id || !Array.isArray(group.ids) || !group.ids.length || new Set(group.ids).size !== group.ids.length || group.ids.some(id => typeof id !== 'string' || !id || (knownIds && !knownIds.has(id))) || group.outBeat !== 8 + index * 2 || group.inBeat !== 56 - index * 2)) throw new Error('Music cues require the source part IDs and the bound group separation/reverse reassembly timings.');
  if (provenance?.license !== 'CC0-1.0' || !/^[a-f0-9]{40}$/.test(provenance.githubSourceRevision ?? '') || !Array.isArray(provenance.files)) throw new Error('The CC0 source manifest and pinned revision are required.');
  const sources = SOURCE_FILES.map(file => {
    const source = provenance.files.find(item => item.file === file);
    if (!source || source.license !== 'CC0-1.0' || !/^[a-f0-9]{64}$/.test(source.sha256 ?? '') || source.sampleRate !== SAMPLE_RATE || source.channels !== 1 || !source.verification?.upstreamGitBlobMatch) throw new Error(`Unverified CC0 source: ${file}`);
    return { file, creator: source.creator, license: source.license, sha256: source.sha256, sourceUrl: source.sourceUrl, durationSeconds: source.durationSeconds, sampleRate: source.sampleRate, channels: source.channels };
  });
  const random = randomSequence(SEED), events = [], actionCues = [];
  const add = (instrument, beat, durationBeats, gain, midi, pan = 0) => events.push({ instrument, role: 'music', beat, durationBeats, gain, midi, pan, seed: Math.floor(random() * 0xffff_ffff) });
  const harmony = [
    { firstBeat: 0, lastBeat: 8, symbol: 'Dmaj9', notes: [50, 57, 61, 64], bass: 38 },
    { firstBeat: 8, lastBeat: 16, symbol: 'Bm11', notes: [47, 54, 57, 64], bass: 35 },
    { firstBeat: 16, lastBeat: 24, symbol: 'Gmaj9', notes: [43, 54, 57, 62], bass: 31 },
    { firstBeat: 24, lastBeat: 32, symbol: 'Aadd9', notes: [45, 52, 59, 64], bass: 33 },
    { firstBeat: 32, lastBeat: 40, symbol: 'Gmaj9', notes: [43, 54, 57, 62], bass: 31 },
    { firstBeat: 40, lastBeat: 48, symbol: 'Em9', notes: [40, 55, 59, 66], bass: 28 },
    { firstBeat: 48, lastBeat: 56, symbol: 'A13', notes: [45, 55, 59, 66], bass: 33 },
    { firstBeat: 56, lastBeat: 64, symbol: 'Dmaj9', notes: [50, 57, 61, 64], bass: 38 },
  ];
  // Long, overlapping voicings breathe over the 54 BPM half-time pulse.
  for (const section of harmony) {
    const reading = section.firstBeat === 24 || section.firstBeat === 32;
    section.notes.forEach((midi, index) => add('breathing-pad', section.firstBeat - .65, 10.2, reading ? .0125 : .015, midi, (index - 1.5) * .38));
    add('warm-bass', section.firstBeat, 3.5, reading ? .041 : .055, section.bass, 0);
    if (!reading) add('warm-bass', section.firstBeat + 4, 2.7, .029, section.bass + 12, .03);
  }
  // An understated identity with space between notes, never a repeated notification ostinato.
  for (const [beat, midi, gain] of [
    [0, 69, .064], [2.5, 73, .049], [5, 76, .047], [7, 73, .035],
    [8.5, 69, .049], [12, 66, .045], [16, 69, .048], [20.5, 74, .042], [23, 69, .030],
    [28, 71, .028], [31, 76, .024], [36, 69, .026], [39.5, 66, .022],
    [42, 67, .042], [45, 71, .037], [48, 73, .046], [51.5, 76, .041], [54, 71, .029],
    [56.5, 69, .046], [59, 73, .034], [61.5, 76, .027],
  ]) add('felt-key', beat, beat >= 26 && beat < 42 ? 4 : 3.1, gain, midi, beat % 4 < 2 ? -.18 : .18);

  const sourceByFile = Object.fromEntries(sources.map(source => [source.file, source]));
  const addSample = (file, beat, id, cueRole, extra = {}) => {
    const source = sourceByFile[file];
    const event = { instrument: 'cc0-sample', role: 'editorial-sfx', id, cueRole, sampleFile: file, sourceSha256: source.sha256, beat, seconds: beatSeconds(beat), durationSeconds: source.durationSeconds, gainDb: -26, pan: 0, attackSeconds: Math.min(.003, source.durationSeconds * .08), releaseSeconds: Math.min(.015, source.durationSeconds * .2), ...extra };
    events.push(event); return event;
  };
  for (const [index, group] of story.GROUPS.entries()) {
    const pan = -.25 + index / 7 * .5;
    for (const [phase, beat] of [['explode', group.outBeat], ['reassemble', group.inBeat]]) {
      const animation = { groupId: group.id, partIds: [...group.ids], phase, firstBeat: beat, lastBeat: beat + story.MOVEMENT_BEATS, geometryRevision };
      const cue = { id: `${group.id}-${phase}`, cueRole: 'motion', anchor: 'movement-start', beat, seconds: beatSeconds(beat), durationBeats: story.MOVEMENT_BEATS, animation, audible: index % 2 === 0 };
      actionCues.push(cue);
      if (cue.audible) addSample(phase === 'explode' ? 'maximize_003.wav' : 'minimize_003.wav', beat, cue.id, cue.cueRole, { anchor: cue.anchor, animation, pan });
      if (phase === 'reassemble') {
        const seatBeat = beat + story.MOVEMENT_BEATS;
        const seat = { id: `${group.id}-seated`, cueRole: 'seating', anchor: 'movement-complete', beat: seatBeat, seconds: beatSeconds(seatBeat), animation, audible: [0, 3, 7].includes(index) };
        actionCues.push(seat);
        if (seat.audible) addSample('click_003.wav', seatBeat, seat.id, seat.cueRole, { anchor: seat.anchor, animation, pan: pan * .6 });
      }
    }
  }
  // One low-level cue per reading scene; subsequent labels are deliberately silent.
  for (const firstBeat of [26, 34]) addSample('tick_002.wav', firstBeat + 1.05 * BPM / 60, `detail-${firstBeat}-first-label`, 'detail', { anchor: 'first-name-reveal', chapterFirstBeat: firstBeat, offsetSeconds: 1.05, gainDb: -30 });
  addSample('confirmation_001.wav', 58, 'assembled-confirmation', 'completion', { anchor: 'all-groups-restored', gainDb: -28 });
  events.sort((a, b) => a.beat - b.beat); actionCues.sort((a, b) => a.beat - b.beat);
  return {
    schemaVersion: '1.2.0', title: 'Anatomy of a Humanoid', edition: EDITION,
    authorship: 'Original Mechanism Studio composition and code synthesis, with separately licensed CC0 effects by Kenney. No narration or recorded robot acoustics.',
    originalScoreLicense: 'MIT', narration: false, geometryRevision, storyRevision: story.PLAN_REVISION,
    bpm: BPM, feltBpm: 54, totalBeats: TOTAL_BEATS, bars: 16, meter: [4, 4],
    sampleRate: SAMPLE_RATE, channels: 2, bitsPerSample: 16, frames: FRAMES, durationSeconds: DURATION, deterministicSeed: SEED,
    musicalFeel: 'Mellow sustained chords, warm half-time bass and sparse felt keys. Quiet reading views and a soft return. No drums or constant dings.',
    timing: 'One seekable PCM transport; seconds = beat * 60 / 108. Every group cue binds source IDs and the same authored movement window.',
    mix: { musicTargetSamplePeakDbfs: -10, finalCeilingDbfs: -8, percussion: false, sampleGainReference: 'The music peak before sample mixing. CC0 source amplitudes are attenuated by gainDb against that reference; no per-sample normalization.', effects: 'Sparse editorial cues, not simulated contact, actuator sounds or hardware recordings.' },
    sourceInputs: { license: provenance.license, revision: provenance.githubSourceRevision, files: sources },
    effects: { kind: 'editorial', clock: 'Baked into the same PCM buffer. No wall-clock timers or chapter restarts.', actionCues, readingCuePolicy: 'One quiet first-name cue per detail scene; later retained names remain silent.' },
    cues: SECTIONS.map(([id, firstBeat, lastBeat]) => ({ id, firstBeat, lastBeat, startSeconds: beatSeconds(firstBeat), endSeconds: beatSeconds(lastBeat) })),
    harmony, beatGrid: Array.from({ length: TOTAL_BEATS + 1 }, (_, beat) => ({ beat, seconds: beatSeconds(beat), frame: Math.round(beatSeconds(beat) * SAMPLE_RATE), downbeat: beat % 4 === 0 })), events,
  };
}

export function decodePcmWav(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error('Invalid RIFF/WAVE source.');
  let format, pcm;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = bytes.toString('ascii', offset, offset + 4), length = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + length > bytes.length) throw new Error('Truncated WAV chunk.');
    if (type === 'fmt ') { if (length < 16) throw new Error('Invalid WAV format chunk.'); format = { codec: bytes.readUInt16LE(start), channels: bytes.readUInt16LE(start + 2), sampleRate: bytes.readUInt32LE(start + 4), bits: bytes.readUInt16LE(start + 14) }; }
    if (type === 'data') pcm = bytes.subarray(start, start + length);
    offset = start + length + length % 2;
  }
  if (!format || format.codec !== 1 || format.channels !== 1 || format.bits !== 16 || format.sampleRate !== SAMPLE_RATE || !pcm || pcm.length % 2) throw new Error('CC0 inputs must be 44.1 kHz mono PCM16 WAV.');
  const samples = new Float64Array(pcm.length / 2);
  for (let index = 0; index < samples.length; index++) samples[index] = pcm.readInt16LE(index * 2) / 32768;
  return { samples, sampleRate: format.sampleRate, channels: 1, sha256: sha256(bytes) };
}

function renderMusicEvent(event, left, right) {
  const firstFrame = Math.round(beatSeconds(event.beat) * SAMPLE_RATE), length = Math.round(beatSeconds(event.durationBeats) * SAMPLE_RATE);
  const pan = clamp(event.pan, -1, 1), gl = Math.cos((pan + 1) * Math.PI / 4) * event.gain, gr = Math.sin((pan + 1) * Math.PI / 4) * event.gain;
  const hz = frequency(event.midi), random = randomSequence(event.seed), drift = random() * TAU;
  for (let index = 0; index < length; index++) {
    const t = index / SAMPLE_RATE, position = index / length, release = Math.min(1, (1 - position) * 12), phase = TAU * hz * t;
    let value;
    if (event.instrument === 'felt-key') value = (Math.sin(phase) + .075 * Math.sin(phase * 2) + .012 * Math.sin(phase * 3)) * (1 - Math.exp(-t / .027)) * Math.exp(-t * 2.1) * release;
    else if (event.instrument === 'warm-bass') value = (Math.sin(phase) + .055 * Math.sin(phase * 2)) * Math.min(1, t / .07) * Math.exp(-t * 1.8) * release;
    else if (event.instrument === 'breathing-pad') value = (Math.sin(phase + .024 * Math.sin(TAU * .13 * t + drift)) + .035 * Math.sin(phase * 2)) * Math.sin(Math.PI * position) ** 2;
    else throw new Error(`Unknown humanoid music voice: ${event.instrument}`);
    const frame = ((firstFrame + index) % FRAMES + FRAMES) % FRAMES;
    left[frame] += value * gl; right[frame] += value * gr;
  }
}

export function renderScore(score, sampleMap) {
  if (score?.bpm !== BPM || score?.totalBeats !== TOTAL_BEATS || score?.frames !== FRAMES || score?.sampleRate !== SAMPLE_RATE || !Array.isArray(score.events)) throw new Error('Unsupported humanoid score transport.');
  const dryLeft = new Float64Array(FRAMES), dryRight = new Float64Array(FRAMES);
  for (const event of score.events.filter(event => event.role === 'music')) renderMusicEvent(event, dryLeft, dryRight);
  const left = new Float64Array(FRAMES), right = new Float64Array(FRAMES), taps = [[.071, .07], [.143, .044], [.233, .025]];
  let musicPeak = 0;
  for (let frame = 0; frame < FRAMES; frame++) {
    let l = dryLeft[frame], r = dryRight[frame];
    for (const [delay, gain] of taps) { const previous = (frame - Math.round(delay * SAMPLE_RATE) + FRAMES) % FRAMES; l += dryRight[previous] * gain; r += dryLeft[previous] * gain; }
    left[frame] = l; right[frame] = r; musicPeak = Math.max(musicPeak, Math.abs(l), Math.abs(r));
  }
  const musicReference = dbToGain(score.mix.musicTargetSamplePeakDbfs), musicScale = musicReference / Math.max(musicPeak, Number.EPSILON);
  for (let frame = 0; frame < FRAMES; frame++) { left[frame] *= musicScale; right[frame] *= musicScale; }
  for (const event of score.events.filter(event => event.instrument === 'cc0-sample')) {
    const source = sampleMap?.[event.sampleFile];
    if (!source || source.sampleRate !== SAMPLE_RATE || source.channels !== 1 || source.sha256 !== event.sourceSha256 || !source.samples?.length || source.samples.some(sample => !Number.isFinite(sample) || Math.abs(sample) > 1)) throw new Error(`Missing or mismatched CC0 sample bytes: ${event.sampleFile}`);
    const start = Math.round(event.seconds * SAMPLE_RATE), pan = clamp(event.pan, -1, 1), gain = musicReference * dbToGain(event.gainDb);
    const gl = Math.cos((pan + 1) * Math.PI / 4) * gain, gr = Math.sin((pan + 1) * Math.PI / 4) * gain;
    for (let index = 0; index < source.samples.length; index++) {
      const t = index / SAMPLE_RATE, remaining = (source.samples.length - 1 - index) / SAMPLE_RATE;
      const envelope = Math.sin(Math.PI / 2 * clamp(t / event.attackSeconds, 0, 1)) ** 2 * Math.sin(Math.PI / 2 * clamp(remaining / event.releaseSeconds, 0, 1)) ** 2;
      const frame = (start + index) % FRAMES, value = source.samples[index] * envelope;
      left[frame] += value * gl; right[frame] += value * gr;
    }
  }
  // A ceiling is only a guard; the quiet effects normally leave it inactive.
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
  for (let index = 0; index < left.length; index++) { if (!Number.isFinite(left[index]) || !Number.isFinite(right[index])) throw new Error('Non-finite output sample.'); result.writeInt16LE(Math.round(clamp(left[index], -1, 1) * 32767), 44 + index * 4); result.writeInt16LE(Math.round(clamp(right[index], -1, 1) * 32767), 46 + index * 4); }
  return result;
}

export function analyzeAudio({ left, right, sampleRate = SAMPLE_RATE, masterScale = 1 }) {
  let peak = 0, energy = 0, clippedSamples = 0, maximumInteriorStep = 0;
  for (const channel of [left, right]) for (let index = 0; index < channel.length; index++) {
    const sample = channel[index]; if (!Number.isFinite(sample)) throw new Error('Audio contains a non-finite sample.');
    peak = Math.max(peak, Math.abs(sample)); energy += sample * sample;
    if (Math.abs(sample) >= 1) clippedSamples++;
    if (index) maximumInteriorStep = Math.max(maximumInteriorStep, Math.abs(sample - channel[index - 1]));
  }
  const maximumStep = Math.max(Math.abs(left[0] - left.at(-1)), Math.abs(right[0] - right.at(-1)));
  const sections = SECTIONS.map(([id, firstBeat, lastBeat]) => {
    const start = Math.round(beatSeconds(firstBeat) * sampleRate), end = Math.round(beatSeconds(lastBeat) * sampleRate);
    let sum = 0; for (let frame = start; frame < end; frame++) sum += left[frame] ** 2 + right[frame] ** 2;
    return { id, firstBeat, lastBeat, rmsDbfs: 20 * Math.log10(Math.sqrt(sum / ((end - start) * 2))) };
  });
  return { sampleRate, frames: left.length, durationSeconds: left.length / sampleRate, peak, peakDbfs: 20 * Math.log10(peak), rmsDbfs: 20 * Math.log10(Math.sqrt(energy / (left.length * 2))), clippedSamples, masterScale, loopBoundary: { maximumStep, maximumInteriorStep, ratioToMaximumInteriorStep: maximumStep / maximumInteriorStep }, sections, listeningReviewed: false, listeningReview: 'Objective waveform checks only; subjective listening and the encoded video mix require a separate review.' };
}
