/** Original deterministic chamber-like music and sparse editorial motion cues. */
import { createHash } from 'node:crypto';
export const SAMPLE_RATE = 44100;
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const sha256 = data => createHash('sha256').update(data).digest('hex');
const random = seed => () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
const midiHz = n => 440 * 2 ** ((n - 69) / 12);

export function createStudyScore(story, index, { title = 'A mechanism in motion', variant = 'hand' } = {}) {
  const { BPM: bpm, TOTAL_BEATS: totalBeats, DURATION: durationSeconds } = story;
  if (!(bpm >= 40 && bpm <= 240) || !Number.isInteger(totalBeats) || totalBeats < 16 || totalBeats % 8
    || !Number.isFinite(durationSeconds) || durationSeconds > 120 || Math.abs(durationSeconds - totalBeats * 60 / bpm) > 1e-8) throw new Error('Bound finite beat transport required.');
  if (!story.PLAN_REVISION || !index.geometryRevision || !Array.isArray(index.parts)) throw new Error('Actual story and geometry revisions required.');
  if (!['hand', 'gripper'].includes(variant)) throw new Error('Unknown composition variant.');
  const known = new Set(index.parts.map(p => p.id)), seen = new Set();
  const actionCues = (story.MUSIC_EVENTS ?? []).map(cue => {
    if (!cue.id || seen.has(cue.id) || !Number.isFinite(cue.beat) || cue.beat < 0 || cue.beat >= totalBeats
      || !['release', 'detail', 'seat', 'motion', 'resolve'].includes(cue.kind)
      || !Array.isArray(cue.partIds) || !cue.partIds.length || cue.partIds.some(id => !known.has(id))
      || !Number.isFinite(cue.level ?? .5) || (cue.level ?? .5) < 0 || (cue.level ?? .5) > 1) throw new Error('Cue must bind an actual part and in-range story moment.');
    seen.add(cue.id);
    return { ...cue, partIds: [...cue.partIds], level: cue.level ?? .5, seconds: cue.beat * 60 / bpm, geometryRevision: index.geometryRevision };
  });
  const seed = parseInt(sha256(Buffer.from(`${variant}:${story.PLAN_REVISION}`)).slice(0, 8), 16), rng = random(seed);
  const events = [], transpose = variant === 'hand' ? 3 : 0;
  const progression = [[50,57,61,64], [47,54,57,64], [43,54,57,62], [45,52,59,64], [43,54,57,62], [40,55,59,66], [45,55,59,66], [50,57,61,64]];
  const melody = [69,73,76,73,69,66,74,69,71,76,69,66,73,76,71,69];
  const add = (voice, beat, beats, gain, midi, pan = 0, extra = {}) => events.push({ voice, beat, beats, gain, midi, pan, seed: Math.floor(rng() * 4294967296), ...extra });
  for (let b = 0; b < totalBeats; b += 8) {
    const chord = progression[(b / 8) % progression.length].map(n => n + transpose);
    chord.forEach((note, i) => add('pad', b - .75, 9.5, .018, note, (i - 1.5) * .35));
    add('bass', b, 3.4, .06, chord[0] - 12);
    if (b % 16 === 0) add('bass', b + 4, 2.7, .025, chord[0]);
    add('felt', b + .35, 3.8, .055, melody[(b / 4) % melody.length] + transpose, -.13);
    add('felt', b + 4.75, 3.2, .032, melody[(b / 4 + 1) % melody.length] + transpose, .16);
  }
  for (const cue of actionCues) {
    const quiet = cue.kind === 'detail' || cue.kind === 'resolve';
    add(cue.kind === 'seat' || quiet ? 'wood' : 'air', cue.beat, quiet ? .9 : cue.kind === 'seat' ? .5 : 1.25,
      (quiet ? .012 : .025) * cue.level, quiet ? 76 : 55, 0, { cueId: cue.id, role: 'editorial-sfx' });
  }
  return { schemaVersion: '1.0.0', title, edition: `robot-chamber-${variant}-1`, originalScoreLicense: 'MIT',
    authorship: 'Original Mechanism Studio code synthesis. No external samples, voice or hardware recordings.',
    narration: false, variant, bpm, totalBeats, sampleRate: SAMPLE_RATE, frames: Math.round(durationSeconds * SAMPLE_RATE),
    channels: 2, bitsPerSample: 16, durationSeconds, geometryRevision: index.geometryRevision, storyRevision: story.PLAN_REVISION,
    sourceSHA256: index.sourceSHA256 ?? index.source?.sha256, deterministicSeed: seed,
    musicalFeel: 'Gentle half-time felt keys, sustained chords, warm bass and sparse quiet action accents. No drum beat or label dings.',
    effectMeaning: 'Editorial accents bound to actual story moments; no claim of measured robot acoustics or physical contact.',
    actionCues, events: events.sort((a,b) => a.beat - b.beat), listeningReviewed: false };
}

export function renderStudyScore(score) {
  if (score.sampleRate !== SAMPLE_RATE || score.frames !== Math.round(score.durationSeconds * SAMPLE_RATE)
    || score.frames < 1 || score.frames > SAMPLE_RATE * 120) throw new Error('Invalid score transport.');
  const frames = score.frames, left = new Float64Array(frames), right = new Float64Array(frames);
  for (const e of score.events) {
    const start = Math.round(e.beat * 60 / score.bpm * SAMPLE_RATE), count = Math.round(e.beats * 60 / score.bpm * SAMPLE_RATE);
    const rng = random(e.seed), hz = midiHz(e.midi), pan = clamp(e.pan, -1, 1), gl = Math.cos((pan+1)*Math.PI/4)*e.gain, gr = Math.sin((pan+1)*Math.PI/4)*e.gain;
    let noise = 0;
    for (let i = 0; i < count; i++) {
      const t = i / SAMPLE_RATE, p = i / count, phase = TAU * hz * t;
      const tail = Math.min(1, (count - 1 - i) / (SAMPLE_RATE * .05));
      let v;
      if (e.voice === 'pad') v = (Math.sin(phase) + .025 * Math.sin(phase * 2.002)) * Math.sin(Math.PI * p) ** 2;
      else if (e.voice === 'felt') v = (Math.sin(phase) + .07 * Math.sin(phase * 2) + .015 * Math.sin(phase * 3)) * (1-Math.exp(-t/.025)) * Math.exp(-2.1*t) * tail;
      else if (e.voice === 'bass') v = (Math.sin(phase) + .04*Math.sin(phase*2)) * Math.min(1,t/.08) * Math.exp(-1.4*t) * tail;
      else if (e.voice === 'wood') v = (Math.sin(phase) + .16*Math.sin(phase*2.76)) * (1-Math.exp(-t/.008)) * Math.exp(-17*t) * tail;
      else if (e.voice === 'air') { noise += ((rng()*2-1)-noise)*.075; v = noise * Math.sin(Math.PI*p) ** 2 * .7; }
      else throw new Error(`Unknown instrument ${e.voice}`);
      const at = ((start+i)%frames+frames)%frames; left[at]+=v*gl;right[at]+=v*gr;
    }
  }
  const dryL = left.slice(), dryR = right.slice();
  for (let i=0;i<frames;i++) for (const [seconds,gain] of [[.073,.085],[.151,.05],[.243,.025]]) {
    const at=(i-Math.round(seconds*SAMPLE_RATE)+frames)%frames; left[i]+=dryR[at]*gain;right[i]+=dryL[at]*gain;
  }
  let peak=0;for(let i=0;i<frames;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
  const scale=10**(-10/20)/Math.max(peak,1e-10);
  for(let i=0;i<frames;i++){left[i]*=scale;right[i]*=scale;}
  return {left,right,sampleRate:SAMPLE_RATE};
}

export function encodeStudyWav({left,right,sampleRate}) {
  if(left.length!==right.length||sampleRate!==SAMPLE_RATE)throw new Error('Invalid stereo PCM.');
  const bytes=Buffer.alloc(44+left.length*4);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVE',8);bytes.write('fmt ',12);
  bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(2,22);bytes.writeUInt32LE(sampleRate,24);bytes.writeUInt32LE(sampleRate*4,28);
  bytes.writeUInt16LE(4,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(left.length*4,40);
  let peak=0,energy=0;
  for(let i=0;i<left.length;i++)for(let ch=0;ch<2;ch++){
    const v=(ch?right:left)[i];if(!Number.isFinite(v)||Math.abs(v)>=1)throw new Error('Invalid or clipped PCM sample.');
    bytes.writeInt16LE(Math.round(v*32767),44+i*4+ch*2);peak=Math.max(peak,Math.abs(v));energy+=v*v;
  }
  return {bytes,analysis:{peakDbfs:20*Math.log10(peak),rmsDbfs:20*Math.log10(Math.sqrt(energy/(left.length*2))),clippedSamples:0,
    loopBoundaryStep:Math.max(Math.abs(left[0]-left.at(-1)),Math.abs(right[0]-right.at(-1))),listeningReviewed:false}};
}
