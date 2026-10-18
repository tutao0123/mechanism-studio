/** Re-render the original gentle music language with actual bearing action cues. */
import {
  BPM, SAMPLE_RATE, TOTAL_BEATS, FRAMES, DURATION,
  beatSeconds, sha256, renderScore, encodeWav, analyzeAudio,
} from '../../detail/audio/synth.mjs';

// Reuse the pure sound engine, without editing the motor edition or importing
// its story bindings. Only music-role events are retained from its score.
export { BPM, SAMPLE_RATE, TOTAL_BEATS, FRAMES, DURATION, beatSeconds, sha256, renderScore, encodeWav, analyzeAudio };
export const EDITION = 'wolf-bearing-continuous-v1';
export const SEED = 0x57425631;

function randomSequence(seed) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4_294_967_296; };
}

export function createScore(story, index, sourceScore) {
  if (story?.BPM !== BPM || story?.TOTAL_BEATS !== TOTAL_BEATS || Math.abs(story.DURATION - DURATION) > 1e-10 || story.PLAN_REVISION !== 'wolf-bearing-study-1' || !Array.isArray(story.MOTION_EVENTS) || !story.MOTION_EVENTS.length) throw new Error('Bearing music requires the bound 112 BPM / 64 beat bearing story and motion events.');
  const focus = story.CHAPTERS.find(chapter => chapter.id === 'component');
  if (focus?.firstBeat !== 28 || focus?.lastBeat !== 38) throw new Error('The retained music-engine reading dip requires the 28–38 beat component close-up.');
  if (!index?.geometryRevision || !/^[0-9a-f]{64}$/.test(index.sourceSHA256 ?? '')) throw new Error('Music requires the source geometry revision and SHA256.');
  if (sourceScore?.edition !== 'wolf-motor-continuous-v2' || sourceScore.bpm !== BPM || sourceScore.frames !== FRAMES || sourceScore.originalScoreLicense !== 'MIT' || !Array.isArray(sourceScore.events)) throw new Error('Expected the retained original motor-v2 music composition.');
  const known = new Set(index.parts.map(part => part.id)), seen = new Set();
  const motions = story.MOTION_EVENTS.map(event => {
    if (!event.id || seen.has(event.id) || !Array.isArray(event.ids) || !event.ids.length || new Set(event.ids).size !== event.ids.length || event.ids.some(id => !known.has(id)) || !Number.isFinite(event.startBeat) || !Number.isFinite(event.endBeat) || event.startBeat < 0 || event.endBeat <= event.startBeat || event.endBeat > TOTAL_BEATS || !['explode', 'reassemble', 'inspect-out', 'inspect-in'].includes(event.phase) || !['hardware', 'repeat', 'inspection'].includes(event.kind)) throw new Error('Invalid source-bound bearing motion event.');
    seen.add(event.id);
    return { id: event.id, partIds: [...event.ids], phase: event.phase, kind: event.kind, firstBeat: event.startBeat, lastBeat: event.endBeat };
  });
  // Copy an explicit music-only shape. Old motor animations and cue identities
  // cannot leak into this edition through object spreads or unchanged PCM.
  const musicEvents = sourceScore.events.filter(event => event.role === 'music').map(event => {
    const { instrument, role, beat, durationBeats, gain, midi, pan, seed } = event;
    if (!['breathing-pad', 'warm-bass', 'felt-key'].includes(instrument) || ![beat, durationBeats, gain, midi, pan, seed].every(Number.isFinite) || durationBeats <= 0 || gain <= 0) throw new Error('Invalid retained music event.');
    return { instrument, role, beat, durationBeats, gain, midi, pan, seed };
  });
  if (!musicEvents.length) throw new Error('The retained original music composition is empty.');
  const random = randomSequence(SEED), events = [...musicEvents], actionCues = [];
  const cueFor = (bound, id, instrument, cueRole = 'motion') => {
    const firstBeat = Math.min(...bound.map(event => event.firstBeat)), lastBeat = Math.max(...bound.map(event => event.lastBeat));
    const beat = cueRole === 'seating' ? lastBeat : firstBeat;
    const durationBeats = cueRole === 'seating' ? .48 : lastBeat - firstBeat;
    const animation = { motionEventIds: bound.map(event => event.id), partIds: [...new Set(bound.flatMap(event => event.partIds))], phase: bound[0].phase, kind: bound[0].kind, firstBeat, lastBeat, geometryRevision: index.geometryRevision };
    const cue = { id, role: 'editorial-sfx', cueRole, anchor: cueRole === 'seating' ? 'movement-complete' : 'movement-start', beat, seconds: beatSeconds(beat), durationBeats, durationSeconds: beatSeconds(durationBeats), animation };
    actionCues.push(cue);
    events.push({ ...cue, instrument, gain: cueRole === 'seating' ? .026 : bound[0].kind === 'inspection' ? .022 : bound[0].kind === 'repeat' ? .027 : .035, gainReference: 'Synthesized event mono sample peak before equal-power center panning.', pan: 0, seed: Math.floor(random() * 0xffff_ffff) });
  };
  for (const event of motions.filter(event => event.kind !== 'repeat')) {
    cueFor([event], `${event.id}-motion`, event.kind === 'inspection' ? 'focus-air' : 'mechanical-slide');
    // Two editorial seats, at actual large-component completions. The generic
    // part label remains generic and no physical bearing noise is inferred.
    if (event.phase === 'reassemble' && event.partIds.some(id => [story.bindings.part62, story.bindings.outerRing].includes(id))) cueFor([event], `${event.id}-seat`, 'soft-seat', 'seating');
  }
  const smallIds = new Set(story.bindings.smallParts);
  if (smallIds.size !== 66) throw new Error('Expected sixty-six actual small source occurrences.');
  for (const phase of ['explode', 'reassemble']) {
    const bound = motions.filter(event => event.kind === 'repeat' && event.phase === phase);
    const ids = new Set(bound.flatMap(event => event.partIds));
    if (bound.length !== 4 || ids.size !== smallIds.size || [...ids].some(id => !smallIds.has(id))) throw new Error('Bearing wave cues require all four actual batches of sixty-six source components.');
    cueFor(bound, `bearing-small-parts-${phase}-wave`, 'batch-air');
  }
  events.sort((a, b) => a.beat - b.beat); actionCues.sort((a, b) => a.beat - b.beat);
  return {
    schemaVersion: '1.3.0', title: 'WOLF / Bearing Component Study', edition: EDITION,
    authorship: 'Original Mechanism Studio music composition and pure code synthesis, reused as a music bed and freshly rendered with source-bound bearing editorial effects. No third-party samples, voice services or recordings.',
    originalScoreLicense: 'MIT', narration: false, geometryRevision: index.geometryRevision, sourceSHA256: index.sourceSHA256, storyRevision: story.PLAN_REVISION,
    bpm: BPM, feltBpm: 56, totalBeats: TOTAL_BEATS, bars: 16, meter: [4, 4], sampleRate: SAMPLE_RATE, channels: 2, bitsPerSample: 16, frames: FRAMES, durationSeconds: DURATION, deterministicSeed: SEED,
    musicalFeel: 'The established gentle pads, warm bass and felt keys, with a quieter component close-up and continuous reassembly. No drum bed, narration or label dings.',
    timing: 'One seekable PCM clock: seconds = beat * 60 / 112. Bearing cues derive from the actual motion-event windows and retained source occurrence IDs.',
    compositionReuse: { pathsRelativeTo: 'this score file', sourceScore: '../detail/music-score.json', sourceEdition: sourceScore.edition, sourceMusicEventsSha256: sha256(Buffer.from(JSON.stringify(musicEvents))), synthesisEngine: '../detail/audio/synth.mjs', method: 'Only explicitly shaped music-role events are reused. Original motor effects and PCM are excluded; this complete bearing WAV is rendered anew.', pcmChanged: true },
    mix: { musicTargetSamplePeakDbfs: -10, finalCeilingDbfs: -8, percussion: false, effects: 'Smooth filtered-air movement textures and two gentle editorial return seats. No recorded or simulated bearing acoustics.' },
    automation: structuredClone(sourceScore.automation),
    effects: { kind: 'editorial', clock: 'Baked into the same PCM buffer. No wall-clock timers or scene restarts.', repetitionPolicy: 'One continuous sweep per separation/return of the four small-part batches. No sixty-six separate clicks or inferred small-part functions.', actionCues },
    motionBindings: motions,
    cues: story.CHAPTERS.map(({ id, firstBeat, lastBeat }) => ({ id, firstBeat, lastBeat, startSeconds: beatSeconds(firstBeat), endSeconds: beatSeconds(lastBeat) })),
    harmony: structuredClone(sourceScore.harmony), beatGrid: Array.from({ length: TOTAL_BEATS + 1 }, (_, beat) => ({ beat, seconds: beatSeconds(beat), frame: Math.round(beatSeconds(beat) * SAMPLE_RATE), downbeat: beat % 4 === 0 })), events,
  };
}
