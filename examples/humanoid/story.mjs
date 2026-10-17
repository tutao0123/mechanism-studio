/** Source-body identity is retained; these are editorial display translations. */
export const BPM = 108;
export const TOTAL_BEATS = 64;
export const DURATION = TOTAL_BEATS * 60 / BPM;
export const MOVEMENT_BEATS = 1.4;
export const PLAN_REVISION = 'g1-assembly-story-1';
export const CAMERA_CUTS = Object.freeze(['upper', 'lower', 'return']);
const id = name => `mjcf:${name}`;
const sides = ['left', 'right'];
const paired = suffixes => sides.flatMap(side => suffixes.map(suffix => id(`${side}_${suffix}_link`)));
const groups = [
  { id: 'torso', ids: ['waist_yaw_link', 'waist_roll_link', 'torso_link'].map(id) },
  { id: 'shoulders', ids: paired(['shoulder_pitch', 'shoulder_roll', 'shoulder_yaw']) },
  { id: 'elbows', ids: paired(['elbow']) },
  { id: 'wrists', ids: paired(['wrist_roll', 'wrist_pitch', 'wrist_yaw']) },
  { id: 'hips', ids: paired(['hip_pitch', 'hip_roll', 'hip_yaw']) },
  { id: 'shanks', ids: paired(['knee']) },
  { id: 'ankles', ids: paired(['ankle_pitch']) },
  { id: 'feet', ids: paired(['ankle_roll']) },
];
export const GROUPS = Object.freeze(groups.map((group, index) => Object.freeze({ ...group, ids: Object.freeze(group.ids), outBeat: 8 + index * 2, inBeat: 56 - index * 2 })));
const lateral = body => body.includes(':left_') ? -1 : 1;
const vectors = {
  torso: () => [.015, .24, 0],
  shoulders: body => [0, .12, lateral(body) * .26],
  elbows: body => [.035, .045, lateral(body) * .52],
  wrists: body => [.07, -.025, lateral(body) * .79],
  hips: body => [0, -.075, lateral(body) * .18],
  shanks: body => [.025, -.20, lateral(body) * .35],
  ankles: body => [.045, -.31, lateral(body) * .49],
  feet: body => [.085, -.43, lateral(body) * .65],
};
export const MAXIMUM_OFFSETS = Object.freeze(Object.fromEntries([
  [id('pelvis'), Object.freeze([0, 0, 0])],
  ...GROUPS.flatMap(group => group.ids.map(body => [body, Object.freeze(vectors[group.id](body))])),
]));
export const CHAPTERS = Object.freeze([
  { id: 'whole', firstBeat: 0, lastBeat: 6, title: 'A humanoid, connected.', copy: 'Thirty source bodies. One continuous structure.', labels: [] },
  { id: 'separate', firstBeat: 6, lastBeat: 26, title: 'See the structure unfold.', copy: 'Torso. Arms. Hip chains. Ankles. Every source link keeps its identity.', labels: [] },
  { id: 'upper', firstBeat: 26, lastBeat: 34, title: 'From shoulder to hand.', copy: 'Three shoulder axes lead through the elbow to a three-axis wrist.', labels: [[id('right_shoulder_yaw_link'), 'Shoulder yaw link'], [id('right_wrist_yaw_link'), 'Wrist yaw / hand']] },
  { id: 'lower', firstBeat: 34, lastBeat: 42, title: 'A chain to the ground.', copy: 'Hip links, knee and ankle connect the pelvis to the foot.', labels: [[id('left_knee_link'), 'Knee / shank'], [id('left_ankle_roll_link'), 'Ankle roll / foot']] },
  { id: 'return', firstBeat: 42, lastBeat: 58, title: 'Every link returns.', copy: 'Reverse the display offsets. Restore the original source assembly.', labels: [] },
  { id: 'resolve', firstBeat: 58, lastBeat: 64, title: 'Whole. And connected.', copy: 'Unitree G1, made inspectable with Mechanism Studio.', labels: [] },
].map(chapter => Object.freeze({ ...chapter, labels: Object.freeze(chapter.labels.map(Object.freeze)) })));
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p ** 3 * (10 - 15 * p + 6 * p ** 2); };
export function normalizeTime(seconds) {
  if (!Number.isFinite(seconds)) throw new TypeError('Finite timeline seconds required.');
  let time = seconds % DURATION;
  if (time < 0) time += DURATION;
  return time < 1e-10 || DURATION - time < 1e-10 ? 0 : time;
}
export function stateAt(seconds) {
  let time = normalizeTime(seconds), beat = time * BPM / 60;
  if (Math.abs(beat - Math.round(beat)) < 1e-10) { beat = Math.round(beat); time = beat * 60 / BPM; }
  const chapterIndex = Math.max(0, CHAPTERS.findIndex(chapter => beat >= chapter.firstBeat && beat < chapter.lastBeat));
  const chapter = CHAPTERS[chapterIndex];
  const progress = Object.fromEntries(GROUPS.map(group => [group.id, smooth((beat - group.outBeat) / MOVEMENT_BEATS) * (1 - smooth((beat - group.inBeat) / MOVEMENT_BEATS))]));
  const offsetsWorld = Object.fromEntries(Object.keys(MAXIMUM_OFFSETS).map(body => [body, [0, 0, 0]]));
  for (const group of GROUPS) for (const body of group.ids) offsetsWorld[body] = MAXIMUM_OFFSETS[body].map(value => value * progress[group.id]);
  return { time, beat, chapter, chapterIndex, localTime: time - chapter.firstBeat * 60 / BPM, progress, offsetsWorld };
}
export function localDisplayOffsets(index, offsetsWorld, Matrix4, Vector3) {
  const byId = new Map(index.parts.map(part => [part.id, part]));
  return new Map(index.parts.map(part => {
    const own = offsetsWorld[part.id];
    if (!Array.isArray(own) || own.length !== 3 || !own.every(Number.isFinite)) throw new Error(`Missing finite source display offset: ${part.id}`);
    const parent = byId.get(part.parentId), inherited = parent ? offsetsWorld[parent.id] : [0, 0, 0];
    const delta = new Vector3(...own).sub(new Vector3(...inherited));
    if (parent) {
      const inverse = new Matrix4().fromArray(parent.worldMatrix).invert();
      delta.applyMatrix4(inverse).sub(new Vector3().applyMatrix4(inverse));
    }
    return [part.id, delta.toArray()];
  }));
}
export function createHumanoidStory(index) {
  if (index?.units !== 'm' || !Array.isArray(index.parts)) throw new Error('A source-body index in metres is required.');
  const ids = new Set(index.parts.map(part => part.id));
  if (ids.size !== 30 || ids.size !== index.parts.length || Object.keys(MAXIMUM_OFFSETS).some(body => !ids.has(body))) throw new Error('G1 story must bind the thirty retained source bodies.');
  const details = Object.freeze({
    upper: Object.freeze(sides.slice(1).flatMap(side => ['shoulder_pitch', 'shoulder_roll', 'shoulder_yaw', 'elbow', 'wrist_roll', 'wrist_pitch', 'wrist_yaw'].map(suffix => id(`${side}_${suffix}_link`)))),
    lower: Object.freeze([id('pelvis'), ...['hip_pitch', 'hip_roll', 'hip_yaw', 'knee', 'ankle_pitch', 'ankle_roll'].map(suffix => id(`left_${suffix}_link`))]),
  });
  return { BPM, TOTAL_BEATS, DURATION, MOVEMENT_BEATS, PLAN_REVISION, CAMERA_CUTS, GROUPS, MAXIMUM_OFFSETS, CHAPTERS, normalizeTime, stateAt, localDisplayOffsets, details, detailIds: state => details[state.chapter.id] ?? null };
}
