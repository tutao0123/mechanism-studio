import { MAXIMUM_OFFSETS, localDisplayOffsets } from '../story.mjs';

/** A separate product cut. Native joint poses and editorial explosion never overlap. */
export const BPM = 112;
export const TOTAL_BEATS = 48;
export const DURATION = TOTAL_BEATS * 60 / BPM;
export const PLAN_REVISION = 'robot-kinetic-story-1';
export const MOVEMENT_BEATS = 1.25;
// Source-solid membership changes are editorial cuts; whole-assembly views
// retain their smooth camera transitions.
export const CAMERA_CUTS = Object.freeze(['reach', 'wrist', 'jaws', 'return', 'loop']);
export { MAXIMUM_OFFSETS, localDisplayOffsets };
export const NATIVE_JOINTS = Object.freeze(['base_to_link1', 'link1_to_link2', 'link2_to_link3', 'link3_to_link4', 'link4_to_link5', 'clamp1', 'clamp2']);
export const GROUPS = Object.freeze([
  { id: 'shoulder', ids: ['urdf:link1_1', 'urdf:link2_1'], outBeat: 10, inBeat: 38 },
  { id: 'forearm', ids: ['urdf:link3_1', 'urdf:link4_1'], outBeat: 12, inBeat: 36 },
  { id: 'wrist', ids: ['urdf:link5_1'], outBeat: 14, inBeat: 34 },
  { id: 'jaws', ids: ['urdf:clamp1_1', 'urdf:clamp2_1'], outBeat: 16, inBeat: 32 },
].map(group => Object.freeze({ ...group, ids: Object.freeze(group.ids) })));
export const CHAPTERS = Object.freeze([
  { id: 'grasp', firstBeat: 0, lastBeat: 4, title: 'Made to move.', copy: 'Two jaws. One precise gesture.', labels: [] },
  { id: 'reach', firstBeat: 4, lastBeat: 10, title: 'A connected chain.', copy: 'Motion travels from the base to the gripper.', labels: [] },
  { id: 'open', firstBeat: 10, lastBeat: 18, title: 'See how it connects.', copy: 'Shoulder. Forearm. Wrist. Gripper.', labels: [] },
  { id: 'wrist', firstBeat: 18, lastBeat: 25, title: 'Reach meets orientation.', copy: 'The wrist carries the gripper.', labels: [['urdf:link4_1', 'Wrist link'], ['urdf:link5_1', 'Gripper carriage']] },
  { id: 'jaws', firstBeat: 25, lastBeat: 32, title: 'A balanced grasp.', copy: 'Opposed jaws meet around the centre.', labels: [['urdf:clamp1_1', 'Sliding jaw'], ['urdf:clamp2_1', 'Opposed jaw']] },
  { id: 'return', firstBeat: 32, lastBeat: 40, title: 'Every link finds its place.', copy: 'The chain comes together again.', labels: [] },
  { id: 'resolve', firstBeat: 40, lastBeat: 44, title: 'Whole. And ready.', copy: 'One assembly. Many connected movements.', labels: [] },
  { id: 'loop', firstBeat: 44, lastBeat: 48, title: 'Mechanism Studio', copy: 'Mechanical ideas, made visible.', labels: [] },
].map(chapter => Object.freeze({ ...chapter, labels: Object.freeze(chapter.labels.map(Object.freeze)) })));

const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p ** 3 * (10 - 15 * p + 6 * p ** 2); };
const pulse = (time, start, peak, release, end) => smooth((time - start) / (peak - start)) * (1 - smooth((time - release) / (end - release)));
export function normalizeTime(seconds) {
  if (!Number.isFinite(seconds)) throw new TypeError('Timeline seconds must be finite.');
  let time = seconds % DURATION; if (time < 0) time += DURATION;
  return time < 1e-10 || DURATION - time < 1e-10 ? 0 : time;
}

export function stateAt(seconds) {
  let time = normalizeTime(seconds), beat = time * BPM / 60;
  const nearest = Math.round(beat);
  if (Math.abs(beat - nearest) < 1e-10) { beat = nearest; time = beat * 60 / BPM; }
  const chapterIndex = Math.max(0, CHAPTERS.findIndex(chapter => beat >= chapter.firstBeat && beat < chapter.lastBeat));
  const chapter = CHAPTERS[chapterIndex], localTime = time - chapter.firstBeat * 60 / BPM;
  const progress = Object.fromEntries(GROUPS.map(group => [group.id, smooth((beat - group.outBeat) / MOVEMENT_BEATS) * (1 - smooth((beat - group.inBeat) / MOVEMENT_BEATS))]));
  const offsetsWorld = Object.fromEntries(Object.keys(MAXIMUM_OFFSETS).map(id => [id, [0, 0, 0]]));
  for (const group of GROUPS) for (const id of group.ids) offsetsWorld[id] = MAXIMUM_OFFSETS[id].map(value => value * progress[group.id]);
  const jointValues = Object.fromEntries(NATIVE_JOINTS.map(name => [name, 0]));
  if (chapter.id === 'grasp' || chapter.id === 'resolve') {
    const amount = pulse(localTime, .08, .55, .95, 1.65) * (chapter.id === 'grasp' ? .012 : .008);
    jointValues.clamp1 = amount; jointValues.clamp2 = amount === 0 ? 0 : -amount;
  } else if (chapter.id === 'reach') {
    const amount = pulse(localTime, .08, .85, 1.55, 2.72);
    for (const [name, maximum] of Object.entries({ base_to_link1: .12, link1_to_link2: .12, link2_to_link3: -.15, link4_to_link5: .14 })) jointValues[name] = amount === 0 ? 0 : amount * maximum;
  }
  return { time, beat, chapter, chapterIndex, localTime, progress, offsetsWorld, jointValues };
}

export function createKineticStory(index) {
  if (index?.units !== 'm' || !Array.isArray(index.parts)) throw new Error('Kinetic study requires the actual robot index in metres.');
  const ids = new Set(index.parts.map(part => part.id));
  if (ids.size !== index.parts.length || ids.size !== Object.keys(MAXIMUM_OFFSETS).length || Object.keys(MAXIMUM_OFFSETS).some(id => !ids.has(id))) throw new Error('Kinetic study must bind the eight retained source links.');
  const details = Object.freeze({
    grasp: Object.freeze(['urdf:link5_1', 'urdf:clamp1_1', 'urdf:clamp2_1']),
    wrist: Object.freeze(['urdf:link4_1', 'urdf:link5_1', 'urdf:clamp1_1', 'urdf:clamp2_1']),
    jaws: Object.freeze(['urdf:link5_1', 'urdf:clamp1_1', 'urdf:clamp2_1']),
    loop: Object.freeze(['urdf:link5_1', 'urdf:clamp1_1', 'urdf:clamp2_1']),
  });
  return { BPM, TOTAL_BEATS, DURATION, PLAN_REVISION, MOVEMENT_BEATS, CAMERA_CUTS, MAXIMUM_OFFSETS, GROUPS, CHAPTERS, normalizeTime, stateAt, localDisplayOffsets, details, detailIds: state => details[state.chapter.id] ?? null };
}
