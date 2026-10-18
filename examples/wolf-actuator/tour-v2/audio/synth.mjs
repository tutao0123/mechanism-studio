/** One complete original arrangement for the source-bound WOLF assembly tour. */
import { SAMPLE_RATE, randomSequence, sha256 } from './engine.mjs';
export { SAMPLE_RATE, renderScore, encodeWav, analyzeAudio, sha256 } from './engine.mjs';
export const BPM = 112;
export const TOTAL_BEATS = 160;
export const FRAMES = 3_780_000;
export const DURATION = FRAMES / SAMPLE_RATE;
export const EDITION = 'wolf-complete-tour-gentle-v2';
export const SEED = 0x57545631;
export const beatSeconds = beat => beat * 60 / BPM;

export function createScore(story, index) {
  if (story?.BPM !== BPM || story?.TOTAL_BEATS !== TOTAL_BEATS || Math.abs(story.DURATION - DURATION) > 1e-10 || story.PLAN_REVISION !== 'wolf-complete-tour-2' || !Array.isArray(story.MOTION_EVENTS) || !story.MOTION_EVENTS.length) throw new Error('Tour music requires the bound 112 BPM / 160 beat complete assembly story.');
  if (!index?.geometryRevision || !/^[0-9a-f]{64}$/.test(index.sourceSHA256 ?? '')) throw new Error('Music requires the source geometry revision and SHA256.');
  const known = new Map(index.parts.map(part => [part.id, part])), seen = new Set();
  const motions = story.MOTION_EVENTS.map(event => {
    const scope = event.scope ?? ['whole', 'motor', 'bearing'].find(prefix => event.id?.startsWith(`${prefix}-`));
    if (!event.id || seen.has(event.id) || !scope || !Array.isArray(event.ids) || !event.ids.length || new Set(event.ids).size !== event.ids.length || event.ids.some(id => !known.has(id)) || !Number.isFinite(event.startBeat) || !Number.isFinite(event.endBeat) || event.startBeat < 0 || event.endBeat <= event.startBeat || event.endBeat > TOTAL_BEATS || !['explode', 'reassemble', 'inspect-out', 'inspect-in'].includes(event.phase) || !['hardware', 'repeat', 'inspection'].includes(event.kind)) throw new Error('Invalid source-bound complete-tour motion event.');
    seen.add(event.id);
    return { id: event.id, scope, family: event.family ?? scope, partIds: [...event.ids], phase: event.phase, kind: event.kind, firstBeat: event.startBeat, lastBeat: event.endBeat };
  });
  const inspectionTargets = new Map();
  for (const event of motions.filter(event => event.kind === 'inspection')) {
    if (event.partIds.length !== 1) throw new Error('A macro cue must follow one actual occurrence.');
    const id = event.partIds[0], pair = inspectionTargets.get(id) ?? {};
    if (pair[event.phase]) throw new Error('Duplicate inspection phase for one source target.');
    pair[event.phase] = event; inspectionTargets.set(id, pair);
  }
  if (inspectionTargets.size !== 2) throw new Error('The complete tour requires its two real component inspection windows.');
  const readingDips = [...inspectionTargets].map(([partId, pair]) => {
    const outward = pair['inspect-out'], inward = pair['inspect-in'];
    if (!outward || !inward || outward.lastBeat >= inward.firstBeat) throw new Error('Component inspection needs outward motion, reading time and a later return.');
    return { id: `${outward.scope}-reading`, partId, motionEventIds: [outward.id, inward.id], firstBeat: outward.firstBeat - .6, fullBeat: outward.firstBeat + .9, releaseBeat: inward.lastBeat - .8, lastBeat: inward.lastBeat + .65, gain: .53, sourceWindow: { firstBeat: outward.firstBeat, lastBeat: inward.lastBeat } };
  }).sort((a, b) => a.firstBeat - b.firstBeat);
  const random = randomSequence(SEED), events = [], actionCues = [];
  const addMusic = (instrument, beat, durationBeats, gain, midi, pan = 0) => events.push({ instrument, role: 'music', beat, durationBeats, gain, midi, pan, seed: Math.floor(random() * 0xffff_ffff) });
  const chords = {
    Dmaj9: { notes: [50, 57, 61, 64], bass: 38, melody: [69, 73, 76] },
    Gmaj9: { notes: [43, 54, 57, 62], bass: 31, melody: [74, 69, 66] },
    Bm11: { notes: [47, 54, 57, 64], bass: 35, melody: [69, 66, 74] },
    Aadd9: { notes: [45, 52, 59, 64], bass: 33, melody: [71, 76, 69] },
    Em9: { notes: [40, 55, 59, 66], bass: 28, melody: [67, 71, 74] },
    A13: { notes: [45, 55, 59, 66], bass: 33, melody: [73, 76, 71] },
    D6: { notes: [50, 54, 59, 64], bass: 38, melody: [69, 73, 76] },
  };
  // Keep the established harmonic arc, inserting two eight-beat phrases for
  // each added mechanism view. Voices, original note motifs and mix stay put.
  const originalProgression = ['Dmaj9', 'Gmaj9', 'Bm11', 'Aadd9', 'Dmaj9', 'Bm11', 'Gmaj9', 'A13', 'Dmaj9', 'Gmaj9', 'Em9', 'Bm11', 'Gmaj9', 'A13', 'Dmaj9', 'D6'];
  const progression = [...originalProgression.slice(0, 3), 'Gmaj9', 'A13', ...originalProgression.slice(3, 9), 'Em9', 'A13', ...originalProgression.slice(9)];
  let lastReadingNote = -Infinity;
  const inReading = beat => readingDips.some(dip => beat >= dip.firstBeat && beat < dip.lastBeat);
  const harmony = progression.map((symbol, i) => ({ symbol, firstBeat: i * 8, lastBeat: i * 8 + 8, ...chords[symbol] }));
  for (const [sectionIndex, section] of harmony.entries()) {
    section.notes.forEach((midi, i) => addMusic('breathing-pad', section.firstBeat - 1.1, 10.7, .016, midi, (i - 1.5) * .35));
    addMusic('warm-bass', section.firstBeat, 3.8, .057, section.bass, -.02);
    if (!inReading(section.firstBeat + 4) && sectionIndex > 0 && sectionIndex < progression.length - 1) addMusic('warm-bass', section.firstBeat + 4, 2.9, .039, section.bass + 12, .03);
    const notes = sectionIndex % 3 === 1 ? [section.melody[1], section.melody[0], section.melody[2]] : section.melody;
    for (let n = 0; n < 3; n++) {
      const beat = section.firstBeat + [0, 3.25, 6.15][n];
      if (sectionIndex === 0 && n === 2 || sectionIndex === progression.length - 1 && n === 2) continue;
      const reading = inReading(beat);
      if (reading && beat - lastReadingNote < 4.7) continue;
      if (reading) lastReadingNote = beat;
      addMusic('felt-key', beat, reading ? 4.3 : [3.2, 3.0, 2.8][n], reading ? .028 : [.052, .035, .027][n], notes[n], (n + sectionIndex) % 2 ? .15 : -.15);
    }
  }
  // Musical connection through the motor-to-bearing handoff; no extra event
  // sound claims contact or motion when only the authored camera changes.
  addMusic('felt-key', 82.5, 4.2, .027, 76, -.1);
  addMusic('felt-key', 85, 4.0, .021, 73, .1);
  const cueFor = (bound, id, instrument, cueRole = 'motion') => {
    const firstBeat = Math.min(...bound.map(event => event.firstBeat)), lastBeat = Math.max(...bound.map(event => event.lastBeat));
    const beat = cueRole === 'seating' ? lastBeat : firstBeat, durationBeats = cueRole === 'seating' ? .48 : lastBeat - firstBeat;
    const animation = { motionEventIds: bound.map(event => event.id), partIds: [...new Set(bound.flatMap(event => event.partIds))], scope: bound[0].scope, family: bound[0].family, phase: bound[0].phase, kind: bound[0].kind, firstBeat, lastBeat, geometryRevision: index.geometryRevision };
    const cue = { id, role: 'editorial-sfx', cueRole, anchor: cueRole === 'seating' ? 'movement-complete' : 'movement-start', beat, seconds: beatSeconds(beat), durationBeats, durationSeconds: beatSeconds(durationBeats), animation };
    actionCues.push(cue);
    events.push({ ...cue, instrument, gain: cueRole === 'seating' ? .025 : bound[0].kind === 'inspection' ? .021 : bound[0].kind === 'repeat' ? .026 : .033, gainReference: 'Synthesized event mono sample peak before equal-power center panning.', pan: bound[0].scope === 'motor' ? -.06 : bound[0].scope === 'bearing' ? .06 : 0, seed: Math.floor(random() * 0xffff_ffff) });
  };
  const wholeReturn = motions.filter(event => event.scope === 'whole' && event.phase === 'reassemble').sort((a, b) => a.lastBeat - b.lastBeat).at(-1);
  for (const event of motions.filter(event => event.kind !== 'repeat')) {
    cueFor([event], `${event.id}-motion`, event.kind === 'inspection' ? 'focus-air' : 'mechanical-slide');
    const names = event.partIds.map(id => known.get(id).name);
    const seat = event.phase === 'reassemble' && (event.scope === 'motor' && names.some(name => ['rotor-body', 'motor-mount-plate-8318', 'motor-hex-nut'].includes(name)) || event.scope === 'bearing' && names.some(name => ['outer-ring-A', 'Part 62'].includes(name)) || event.id === wholeReturn?.id);
    if (seat) cueFor([event], `${event.id}-seat`, 'soft-seat', 'seating');
  }
  const repeats = new Map();
  for (const event of motions.filter(event => event.kind === 'repeat')) {
    // Distinguish real motor source names instead of assuming generic motor
    // family metadata already separates magnet from cc angular sectors.
    const names = new Set(event.partIds.map(id => known.get(id).name));
    const family = event.scope === 'motor' && names.size === 1 ? `${event.scope}-${[...names][0]}` : `${event.scope}-small-parts`;
    const key = `${family}:${event.phase}`; if (!repeats.has(key)) repeats.set(key, []); repeats.get(key).push(event);
  }
  if (repeats.size !== 6) throw new Error('Expected two motor repeat families and one bearing repeat family, outward and returning.');
  for (const [key, bound] of repeats) {
    const count = new Set(bound.flatMap(event => event.partIds)).size, expected = bound[0].scope === 'motor' ? 40 : 66;
    if (bound.length !== 4 || count !== expected) throw new Error('A repeat-wave cue must include four actual batches and the complete source family.');
    cueFor(bound, `${key.replace(':', '-')}-wave`, 'batch-air');
  }
  events.sort((a, b) => a.beat - b.beat); actionCues.sort((a, b) => a.beat - b.beat);
  return {
    schemaVersion: '1.4.0', title: 'WOLF / Complete Assembly Tour', edition: EDITION,
    authorship: 'Original Mechanism Studio extended composition, deterministic synthesis and editorial effects. Established warm synthesis voices, one new complete arrangement. No third-party samples, service calls or recordings.', originalScoreLicense: 'MIT', narration: false,
    geometryRevision: index.geometryRevision, sourceSHA256: index.sourceSHA256, storyRevision: story.PLAN_REVISION,
    bpm: BPM, feltBpm: 56, totalBeats: TOTAL_BEATS, bars: 40, meter: [4, 4], sampleRate: SAMPLE_RATE, channels: 2, bitsPerSample: 16, frames: FRAMES, durationSeconds: DURATION, deterministicSeed: SEED,
    musicalFeel: 'Gentle keys, warm pads and restrained bass, continuous through whole assembly, motor, bearing and return. Two source-part close-ups receive quieter reading space. No drum bed, narration or label dings.',
    timing: 'One seekable 160-beat PCM buffer. Music voices and room tails span scene changes. All movement effects derive from the final global motion-event windows; no old segment PCM joins or chapter restarts. Gear and bearing rotations receive music only, without claimed contact recordings.',
    synthesis: { engine: 'audio/engine.mjs', origin: 'Exact reuse of the tour-v1 synthesis engine and voice palette, extending the same harmonic arc for two added mechanical views.', reusablePcm: false, musicEventDigest: sha256(Buffer.from(JSON.stringify(events.filter(event => event.role === 'music')))) },
    mix: { musicTargetSamplePeakDbfs: -10, finalCeilingDbfs: -8, percussion: false, effects: 'Quiet filtered-air movement textures and sparse completed-return accents. Editorial cues, not motor/bearing recordings or solved contact acoustics.' },
    automation: { loopGain: .76, readingDips, method: 'Smooth continuous gain derived from the two actual out/return inspection pairs.' },
    effects: { kind: 'editorial', clock: 'Baked into the same PCM buffer; no wall-clock timers.', repetitionPolicy: 'One wave per source family and direction, grouping four actual angular batches; no per-piece click sequence.', actionCues },
    motionBindings: motions, cues: story.CHAPTERS.map(({ id, firstBeat, lastBeat }) => ({ id, firstBeat, lastBeat, startSeconds: beatSeconds(firstBeat), endSeconds: beatSeconds(lastBeat) })),
    harmony, beatGrid: Array.from({ length: TOTAL_BEATS + 1 }, (_, beat) => ({ beat, seconds: beatSeconds(beat), frame: Math.round(beatSeconds(beat) * SAMPLE_RATE), downbeat: beat % 4 === 0 })), events,
  };
}
