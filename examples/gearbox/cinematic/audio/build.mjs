/** Original 24-second cinematic score. No samples, speech, or audio service. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeWav, sha256 } from '../../audio/synth.mjs';
import { DURATION as TIMELINE_DURATION, TIMELINE_REVISION, SOURCE_TIME_KNOTS, SHOTS, eventTimes } from '../timeline.mjs';

export const SAMPLE_RATE = 48000, BPM = 120, TOTAL_BEATS = 48, DURATION = 24;
const FRAMES = SAMPLE_RATE * DURATION, TAU = Math.PI * 2, SEED = 0x43494e31;
const FILE = 'gearbox-cinematic-loop.wav';
const gain = db => 10 ** (db / 20);
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
function random(seed) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
const fade = (t, duration, attack, release) => smooth(t / attack) * smooth((duration - t) / release);

export const ACTION_CUES = Object.freeze([
  { id: 'hero-rumble', timeSeconds: 0, durationSeconds: 1.9, kind: 'rumble', level: .22, pan: 0, event: 'assembled-hero', ids: ['gb:case/main-case', 'gb:input/shaft', 'gb:main/shaft'] },
  { id: 'case-open', timeSeconds: eventTimes.caseLiftStart, durationSeconds: 1.25, kind: 'whoosh', level: .16, pan: -.2, event: 'case-separation-begins', ids: ['gb:case/main-case', 'gb:case/top-cover'] },
  { id: 'exploded-impact', timeSeconds: eventTimes.explosionStart, durationSeconds: 1.2, kind: 'impact', level: .25, pan: 0, event: 'explosion-begins', ids: ['gb:counter/shaft', 'gb:main/gear-1', 'gb:main/synchro-s34/sleeve'] },
  { id: 'power-pulse', timeSeconds: eventTimes.internalsReseated, durationSeconds: .9, kind: 'power', level: .16, pan: 0, event: 'gear-pair-power-path-introduction', timingNote: 'Editorial introduction; the first engagement follows at 8.625 seconds.', ids: ['gb:input/shaft', 'gb:counter/gear-1', 'gb:main/gear-1'] },
  { id: 'sync-texture', timeSeconds: eventTimes.syncDetailStart, durationSeconds: 2.1, kind: 'shimmer', level: .09, pan: .25, event: 'synchronizer-macro', ids: ['gb:main/synchro-s34/sleeve', 'gb:main/synchro-s34/ring-front'] },
  { id: 'shift-engage', timeSeconds: eventTimes.fourthEngaged, durationSeconds: .24, kind: 'clack', level: .18, pan: .08, event: 'sleeve-engagement-complete', ids: ['gb:main/synchro-s34/sleeve', 'gb:main/synchro-s34/hub'] },
  { id: 'overdrive-intro', timeSeconds: SHOTS.find(shot => shot.id === 'overdrive').start, durationSeconds: .9, kind: 'power', level: .16, pan: 0, event: 'overdrive-introduction', ids: ['gb:counter/gear-5', 'gb:main/gear-5'] },
  { id: 'reassembly-sweep', timeSeconds: eventTimes.caseCloseStart, durationSeconds: 1.1, kind: 'sweep', level: .16, pan: .15, event: 'case-closing-begins', timingNote: `Shell closure completes at ${eventTimes.caseClosed.toFixed(6)} seconds.`, ids: ['gb:case/main-case', 'gb:case/top-cover'] },
  { id: 'logo-resolve', timeSeconds: 22.5, durationSeconds: 1.45, kind: 'resolve', level: .24, pan: 0, event: 'assembled-end-card', ids: ['gb:case/main-case'] },
]);

const SECTIONS = [
  ['hero', 0, 2], ['opening', 2, 5], ['exploded', 5, 8], ['power', 8, eventTimes.syncDetailStart],
  ['synchronizer', eventTimes.syncDetailStart, SHOTS.find(shot => shot.id === 'overdrive').start],
  ['overdrive', SHOTS.find(shot => shot.id === 'overdrive').start, eventTimes.caseCloseStart], ['reassemble', eventTimes.caseCloseStart, 22.5], ['resolve', 22.5, 24],
];

export function createScore(index) {
  if (TIMELINE_DURATION !== DURATION || BPM * DURATION / 60 !== TOTAL_BEATS) throw new Error('Cinematic score and timeline durations differ.');
  const ids = new Set(index.parts.map(p => p.id));
  for (const cue of ACTION_CUES) for (const id of cue.ids) if (!ids.has(id)) throw new Error(`Unknown cue part: ${cue.id} / ${id}`);
  const events = [];
  function note(instrument, time, duration, midi, level, pan = 0) {
    if (time < 0 || time >= DURATION || duration <= 0) throw new Error('Invalid musical event.');
    events.push({ instrument, timeSeconds: time, durationSeconds: Math.min(duration, DURATION - time), midi, level, pan, seed: (SEED + events.length * 2654435761) >>> 0 });
  }
  // D minor / suspended voicings. Slow upper harmony leaves room for the bass.
  const chords = [[0, [50, 57, 64, 65]], [4, [46, 53, 60, 62]], [8, [50, 57, 64, 65]], [12, [53, 60, 67, 69]], [16, [48, 55, 62, 65]], [20, [50, 57, 64, 69]]];
  for (const [time, pitches] of chords) pitches.forEach((pitch, i) => note('pad', time, time === 20 ? 4 : 5.1, pitch, .048, [-.7, .7, -.35, .35][i]));

  // Twelve bars at 120 BPM. The macro deliberately opens up to half time.
  const roots = [38, 38, 34, 34, 38, 38, 41, 41, 36, 36, 38, 38];
  for (let bar = 1; bar <= 10; bar++) {
    const start = bar * 2, macro = start >= 12 && start < 17.5, closing = start >= 20;
    const offsets = macro ? [0, 2.5] : closing ? [0, 1.5] : [0, 1.5, 2.5, 3.5];
    for (const beat of offsets) {
      const time = start + beat * .5;
      if (time >= 21.1) continue;
      note('bass', time, macro ? .58 : .48, roots[bar], macro ? .13 : .24);
      // A restrained low kick follows the pulse; no wall of mechanical ticks.
      if (!macro || beat === 0) note('kick', time, .34, 0, closing ? .19 : .24);
    }
    if (!macro && !closing) note('rim', start + 1, .20, 0, .068, -.18);
  }
  note('kick', 0, .65, 0, .22);
  note('kick', 5, .48, 0, .24);
  note('kick', 17.5, .42, 0, .25);

  const phrases = [
    [2, [74, 81, 76, 77]], [5, [74, 77, 81, 84]], [8, [74, 81, 76, 77]],
    [10, [81, 77, 76, 74]], [13, [77, 81, 84]], [15, [79, 76, 74]], [17.5, [74, 81, 86, 84]], [20, [81, 77, 76]],
  ];
  for (const [start, notes] of phrases) notes.forEach((pitch, i) => {
    const macro = start === 13 || start === 15;
    note('pluck', start + i * (macro ? .625 : .375), macro ? 1.45 : 1.1, pitch, macro ? .085 : .10, i % 2 ? .35 : -.35);
  });
  // Sparse air accents, softened and below the melodic attacks.
  for (const time of [3.75, 6.75, 9.75, 11.75, 18.75]) note('air', time, .25, 0, .018, time % 2 ? -.5 : .5);
  note('bell', 22.5, 1.45, 74, .09, -.2);
  note('bell', 22.62, 1.33, 81, .067, .2);

  return {
    schemaVersion: '1.0.0', edition: 'gearbox-cinematic-score-1', title: 'Transmission / kinetic score',
    authorship: 'Original Mechanism Studio code synthesis; no external samples or speech.', license: 'MIT',
    geometryRevision: index.geometryRevision, storyBinding: TIMELINE_REVISION,
    sourceTimeRemap: { interpolation: 'cubic Hermite with 1.5 endpoint slopes; exactly linear throughout the rotating interval', knots: SOURCE_TIME_KNOTS },
    sampleRate: SAMPLE_RATE, channels: 2, bitsPerSample: 16, bpm: BPM, totalBeats: TOTAL_BEATS, durationSeconds: DURATION, frames: FRAMES, seed: SEED,
    mix: { targetSamplePeakDbfs: -6.4, fadeInSeconds: .025, fadeOutStartSeconds: 23.15, fadeOutSeconds: .85, delayTapsSeconds: [.1875, .375, .5625], truePeakCheck: 'Measure the generated PCM with ffmpeg ebur128=peak=true; sample-peak normalization alone is not a true-peak measurement.' },
    effects: { purpose: 'Sparse authored editorial cues aligned to the named cinematic actions; not recorded machine sounds or contact simulation.', actionCues: ACTION_CUES.map((cue, i) => ({ ...cue, beat: cue.timeSeconds * 2, seed: (SEED ^ ((i + 1) * 104729)) >>> 0 })) },
    sections: SECTIONS.map(([id, firstSeconds, lastSeconds]) => ({ id, firstSeconds, lastSeconds })), events,
  };
}

function voice(event) {
  const rng = random(event.seed), phase = rng() * TAU, f = hz(event.midi ?? 0), duration = event.durationSeconds;
  let noiseLow = 0, noiseSlow = 0;
  return t => {
    const noise = rng() * 2 - 1;
    noiseLow += .18 * (noise - noiseLow); noiseSlow += .018 * (noise - noiseSlow);
    const air = noiseLow - noiseSlow;
    switch (event.instrument) {
      case 'pad': return fade(t, duration, .65, 1.2) * (.74 * Math.sin(TAU * f * t + phase) + .16 * Math.sin(TAU * f * 1.0023 * t + phase) + .07 * Math.sin(TAU * f * 2 * t + .3));
      case 'bass': return fade(t, duration, .012, .12) * (.72 * Math.sin(TAU * f * t) + .24 * Math.sin(TAU * f * 2 * t) + .07 * Math.sin(TAU * f * 3 * t)) * Math.exp(-t / .65);
      case 'kick': {
        const phaseKick = TAU * (46 * t + 46 * .035 * (1 - Math.exp(-t / .035)));
        return fade(t, duration, .0035, .04) * Math.sin(phaseKick) * Math.exp(-t / .105);
      }
      case 'rim': return fade(t, duration, .0015, .035) * (Math.sin(TAU * 382 * t) * .5 + Math.sin(TAU * 937 * t) * .14 + air * .4) * Math.exp(-t / .026);
      case 'pluck': return fade(t, duration, .006, .2) * (Math.sin(TAU * f * t + .18 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 9)) + .16 * Math.sin(TAU * f * 3 * t) * Math.exp(-t * 8)) * Math.exp(-t / .29);
      case 'bell': return fade(t, duration, .012, .35) * (Math.sin(TAU * f * t) + .16 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 4)) * Math.exp(-t / .6);
      case 'air': return fade(t, duration, .008, .1) * air * Math.exp(-t / .065);
      case 'rumble': return fade(t, duration, .17, .5) * (Math.sin(TAU * 36.708 * t) * .55 + Math.sin(TAU * 73.416 * t) * .22 + noiseSlow * .45);
      case 'whoosh': return fade(t, duration, .28, .42) * (air * (.3 + .55 * Math.sin(Math.PI * t / duration) ** 2) + .07 * Math.sin(TAU * (180 * t + 250 * t * t)));
      case 'impact': return fade(t, duration, .003, .25) * (Math.sin(TAU * (38 * t + 38 * .07 * (1 - Math.exp(-t / .07)))) * Math.exp(-t / .28) + .34 * air * Math.exp(-t / .08));
      case 'power': return fade(t, duration, .012, .22) * (Math.sin(TAU * 73.416 * t) + .3 * Math.sin(TAU * 146.832 * t)) * Math.exp(-t / .22);
      case 'shimmer': return fade(t, duration, .18, .65) * (air * .2 + Math.sin(TAU * 587.33 * t) * .18 + Math.sin(TAU * 880 * t) * .1) * (.65 + .35 * Math.sin(TAU * .9 * t) ** 2);
      case 'clack': return fade(t, duration, .002, .05) * (Math.sin(TAU * 680 * t) * .55 + Math.sin(TAU * 1470 * t) * .17 + air * .4) * (Math.exp(-t / .026) + (t > .045 ? .28 * Math.exp(-(t - .045) / .02) * smooth((t - .045) / .002) : 0));
      case 'sweep': return fade(t, duration, .33, .5) * (air * .75 + Math.sin(TAU * (380 * t - 65 * t * t)) * .10);
      case 'resolve': return fade(t, duration, .007, .5) * (Math.sin(TAU * (36.708 * t + 25 * .06 * (1 - Math.exp(-t / .06)))) * Math.exp(-t / .44) + .18 * Math.sin(TAU * 73.416 * t) * Math.exp(-t / .7) + air * .19 * Math.exp(-t / .07));
      default: throw new Error(`Unknown cinematic instrument: ${event.instrument}`);
    }
  };
}

export function renderScore(score) {
  const left = new Float64Array(FRAMES), right = new Float64Array(FRAMES);
  const tailL = new Float64Array(FRAMES), tailR = new Float64Array(FRAMES);
  function mix(event, toTail = false) {
    const start = Math.round(event.timeSeconds * SAMPLE_RATE), length = Math.min(Math.round(event.durationSeconds * SAMPLE_RATE), FRAMES - start);
    const sample = voice(event), pan = clamp(event.pan ?? 0, -1, 1), l = Math.cos((pan + 1) * Math.PI / 4) * event.level, r = Math.sin((pan + 1) * Math.PI / 4) * event.level;
    for (let i = 0; i < length; i++) {
      const value = sample(i / SAMPLE_RATE), frame = start + i;
      left[frame] += value * l; right[frame] += value * r;
      if (toTail) { tailL[frame] += value * l; tailR[frame] += value * r; }
    }
  }
  for (const event of score.events) mix(event, ['pluck', 'bell', 'rim'].includes(event.instrument));
  for (const cue of score.effects.actionCues) mix({ ...cue, instrument: cue.kind }, ['clack', 'shimmer'].includes(cue.kind));
  // Short stereo echoes keep attacks in place. Tails never wrap ahead of their event.
  for (const [seconds, level] of [[.1875, .19], [.375, .10], [.5625, .055]]) {
    const delay = Math.round(seconds * SAMPLE_RATE);
    for (let i = delay; i < FRAMES; i++) { left[i] += tailR[i - delay] * level; right[i] += tailL[i - delay] * level; }
  }
  let peak = 0, dcL = 0, dcR = 0, previousL = 0, previousR = 0;
  for (let i = 0; i < FRAMES; i++) {
    // 8 Hz DC blocker; no compressor, clipper or distortion on the master.
    const l = left[i] - previousL + .998953 * dcL, r = right[i] - previousR + .998953 * dcR;
    previousL = left[i]; previousR = right[i]; dcL = l; dcR = r;
    const t = i / SAMPLE_RATE, envelope = smooth(t / score.mix.fadeInSeconds) * smooth((DURATION - 1 / SAMPLE_RATE - t) / score.mix.fadeOutSeconds);
    left[i] = l * envelope; right[i] = r * envelope; peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const masterScale = gain(score.mix.targetSamplePeakDbfs) / peak;
  for (let i = 0; i < FRAMES; i++) { left[i] *= masterScale; right[i] *= masterScale; }
  return { left, right, sampleRate: SAMPLE_RATE, masterScale };
}

export function analyzePcm(wav) {
  const n = (wav.length - 44) / 4, channels = [new Float64Array(n), new Float64Array(n)];
  let peak = 0, energy = 0, clippedSamples = 0, maximumInteriorStep = 0;
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) {
    const sample = wav.readInt16LE(44 + i * 4 + c * 2) / 32768;
    channels[c][i] = sample; peak = Math.max(peak, Math.abs(sample)); energy += sample ** 2;
    if (Math.abs(sample) >= 32767 / 32768) clippedSamples++;
    if (i) maximumInteriorStep = Math.max(maximumInteriorStep, Math.abs(sample - channels[c][i - 1]));
  }
  const sections = SECTIONS.map(([id, from, to]) => {
    let sum = 0, p = 0; const first = Math.round(from * SAMPLE_RATE), last = Math.round(to * SAMPLE_RATE);
    for (let i = first; i < last; i++) for (const channel of channels) { sum += channel[i] ** 2; p = Math.max(p, Math.abs(channel[i])); }
    return { id, firstSeconds: from, lastSeconds: to, peakDbfs: 20 * Math.log10(p), rmsDbfs: 10 * Math.log10(sum / ((last - first) * 2)) };
  });
  const seamStep = Math.max(...channels.map(channel => Math.abs(channel[0] - channel.at(-1))));
  return { frames: n, sampleRate: SAMPLE_RATE, durationSeconds: n / SAMPLE_RATE, peakDbfs: 20 * Math.log10(peak), rmsDbfs: 10 * Math.log10(energy / (n * 2)), clippedSamples, loopBoundary: { firstSamples: channels.map(c => c[0]), lastSamples: channels.map(c => c.at(-1)), maximumStep: seamStep, maximumInteriorStep }, sections, listeningReviewed: false, reviewScope: 'Objective final PCM sample checks. Listening and audiovisual synchronization require separate review.' };
}

export async function buildMusic() {
  const index = JSON.parse(await readFile(new URL('../../assets/scene-index.json', import.meta.url), 'utf8'));
  const score = createScore(index), audio = renderScore(score), wav = encodeWav(audio), analysis = analyzePcm(wav);
  if (analysis.frames !== FRAMES || analysis.clippedSamples || analysis.peakDbfs > -6.35 || analysis.loopBoundary.maximumStep !== 0 || analysis.rmsDbfs < -30 || analysis.rmsDbfs > -14) throw new Error(`Cinematic audio quality gate failed: ${JSON.stringify(analysis)}`);
  const metadata = { ...score, file: FILE, byteLength: wav.length, sha256: sha256(wav), analysis };
  await writeFile(new URL(FILE, import.meta.url), wav);
  await writeFile(new URL('music-score.json', import.meta.url), `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildMusic();
  console.log(JSON.stringify({ file: result.file, durationSeconds: result.durationSeconds, sampleRate: result.sampleRate, byteLength: result.byteLength, sha256: result.sha256, cues: result.effects.actionCues.map(c => `${c.id}@${c.timeSeconds}s`), analysis: result.analysis }, null, 2));
}
