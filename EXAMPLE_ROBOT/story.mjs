/** One deterministic score time drives display offsets, captions and camera plans. */
export const BPM = 112;
export const TOTAL_BEATS = 64;
export const DURATION = TOTAL_BEATS * 60 / BPM;
export const PLAN_REVISION = 'robot-explosion-1';
export const MAXIMUM_OFFSETS = Object.freeze(Object.fromEntries(Object.entries({
  base_link: [0, 0, 0], link1_1: [-.10, .01, 0], link2_1: [-.075, .09, .055],
  link3_1: [.02, .16, -.06], link4_1: [.14, .10, .065], link5_1: [.22, .035, 0],
  clamp1_1: [.26, .055, -.09], clamp2_1: [.26, .055, .09],
}).map(([name, vector]) => [`urdf:${name}`, Object.freeze(vector)])));
export const GROUPS = Object.freeze([
  Object.freeze({ id: 'shoulder', ids: ['urdf:link1_1', 'urdf:link2_1'], outBeat: 8, inBeat: 52 }),
  Object.freeze({ id: 'forearm', ids: ['urdf:link3_1', 'urdf:link4_1'], outBeat: 12, inBeat: 48 }),
  Object.freeze({ id: 'wrist', ids: ['urdf:link5_1'], outBeat: 16, inBeat: 44 }),
  Object.freeze({ id: 'jaws', ids: ['urdf:clamp1_1', 'urdf:clamp2_1'], outBeat: 20, inBeat: 40 }),
]);
export const CHAPTERS = Object.freeze([
  { id: 'whole', firstBeat: 0, lastBeat: 8, title: 'Eight links. One arm.', copy: 'A real open-source robot, held in its original assembled pose.', labels: [['urdf:base_link', 'Fixed base'], ['urdf:link5_1', 'Parallel gripper']] },
  { id: 'structure', firstBeat: 8, lastBeat: 24, title: 'The chain opens.', copy: 'Four link groups separate on the beat. Their source hierarchy stays intact.', labels: [['urdf:link2_1', 'Shoulder link'], ['urdf:link3_1', 'Elbow / forearm']] },
  { id: 'wrist', firstBeat: 24, lastBeat: 32, title: 'From reach to orientation.', copy: 'The wrist connects the arm to the gripper carriage.', labels: [['urdf:link4_1', 'Wrist link'], ['urdf:link5_1', 'Gripper carriage']] },
  { id: 'grip', firstBeat: 32, lastBeat: 40, title: 'Two jaws, one grasp.', copy: 'The source describes opposed sliding jaws. Here, they separate for inspection.', labels: [['urdf:clamp1_1', 'Sliding jaw'], ['urdf:clamp2_1', 'Opposed jaw']] },
  { id: 'return', firstBeat: 40, lastBeat: 56, title: 'Every link returns.', copy: 'The sequence reverses: jaws, wrist, forearm, shoulder. No source pose is rewritten.', labels: [['urdf:base_link', 'Fixed reference'], ['urdf:link5_1', 'Gripper carriage']] },
  { id: 'resolve', firstBeat: 56, lastBeat: 64, title: 'Whole again.', copy: 'The original assembly is restored. The score and the view return to the beginning.', labels: [['urdf:base_link', 'Original assembly'], ['urdf:link5_1', 'Ready to repeat']] },
].map(chapter => Object.freeze({ ...chapter, labels: Object.freeze(chapter.labels.map(Object.freeze)) })));
export function normalizeTime(seconds) {
  if (!Number.isFinite(seconds)) throw new TypeError('Timeline seconds must be finite.');
  let value = seconds % DURATION;
  if (value < 0) value += DURATION;
  return value < 1e-10 || DURATION - value < 1e-10 ? 0 : value;
}
const smooth = value => { const x = Math.max(0, Math.min(1, value)); return x * x * x * (10 + x * (-15 + 6 * x)); };
export function stateAt(seconds) {
  let time = normalizeTime(seconds), beat = time * BPM / 60;
  const nearestBeat = Math.round(beat);
  if (Math.abs(beat - nearestBeat) < 1e-10) { beat = nearestBeat; time = beat * 60 / BPM; }
  const index = CHAPTERS.findIndex(chapter => beat >= chapter.firstBeat && beat < chapter.lastBeat);
  const chapter = CHAPTERS[Math.max(0, index)], progress = {};
  for (const group of GROUPS) progress[group.id] = smooth((beat - group.outBeat) / 2) * (1 - smooth((beat - group.inBeat) / 2));
  const offsetsWorld = Object.fromEntries(Object.keys(MAXIMUM_OFFSETS).map(id => [id, [0, 0, 0]]));
  for (const group of GROUPS) for (const id of group.ids) offsetsWorld[id] = MAXIMUM_OFFSETS[id].map(value => value * progress[group.id]);
  return { time, beat, chapter, chapterIndex: Math.max(0, index), localTime: time - chapter.firstBeat * 60 / BPM, progress, offsetsWorld };
}
/** Subtract inherited parent displacement before converting the remaining delta.
 * transformDirection alone would normalize and destroy its physical magnitude.
 */
export function localDisplayOffsets(sceneIndex, offsetsWorld, Matrix4, Vector3) {
  const byId = new Map(sceneIndex.parts.map(part => [part.id, part]));
  const result = new Map();
  for (const part of sceneIndex.parts) {
    const own = offsetsWorld[part.id];
    if (!Array.isArray(own) || own.length !== 3 || !own.every(Number.isFinite)) throw new Error(`Missing finite display offset: ${part.id}`);
    const parent = byId.get(part.parentId), inherited = parent ? offsetsWorld[parent.id] : [0, 0, 0];
    const delta = new Vector3(...own).sub(new Vector3(...inherited));
    if (parent) {
      const inverse = new Matrix4().fromArray(parent.worldMatrix).invert();
      const origin = new Vector3().applyMatrix4(inverse);
      delta.applyMatrix4(inverse).sub(origin);
    }
    result.set(part.id, delta.toArray());
  }
  return result;
}
