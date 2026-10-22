/** Execute a serializable source-body presentation without changing the rig. */
import { compilePresentationPlan } from '../../shared/study/plan.mjs';
import { createGripperMechanics } from './story.mjs';
import { createGripperRig } from './kinematics.mjs';
import { createGripperCameraPlan } from './framing.mjs';
import { BPM, TOTAL_BEATS, DURATION, PLAN_REVISION, CHAPTERS, GROUPS, MUSIC_EVENTS } from './presentation-data.mjs';
import { CUE_WINDOWS } from './annotations.mjs';

export function createGripperPresentation(index, { plan: suppliedPlan } = {}) {
  const mechanics = createGripperMechanics(index), rig = createGripperRig(index);
  const maximum = Object.fromEntries(index.parts.map(part => [part.id, [0, 0, 0]]));
  for (const group of GROUPS) for (const id of group.ids) {
    const sign = id.includes(':left_') ? -1 : 1;
    maximum[id] = group.id === 'drivers' ? [sign * .055, .015, 0] : group.id === 'springs' ? [sign * .085, .025, -.025] : [sign * .105, .065, .025];
  }
  const details = ['right_driver', 'right_coupler', 'right_spring_link', 'right_follower'].map(name => `mjcf:${name}`);
  const authoredFraming = createGripperCameraPlan(index, { MAXIMUM_OFFSETS: maximum, details }, rig);
  const seconds = beats => beats * 60 / BPM;
  const executable = compilePresentationPlan(suppliedPlan ?? {
    schemaVersion: 'mechanism-presentation-1', id: PLAN_REVISION, geometryRevision: index.geometryRevision,
    bpm: BPM, durationSeconds: DURATION, chapters: CHAPTERS,
    channels: Object.fromEntries(GROUPS.map(group => [group.id, {
      rise: [group.outBeat, group.outBeat + 2].map(seconds), fall: [group.inBeat, group.inBeat + 2].map(seconds),
    }])),
    offsets: GROUPS.map(group => ({ channel: group.id, vectors: Object.fromEntries(group.ids.map(id => [id, maximum[id]])) })),
    annotations: { windows: CUE_WINDOWS, fadeInSeconds: .2, fadeOutSeconds: .32 },
    cameras: authoredFraming.cameras, appearance: { labelWeight: .65 },
  }, index);
  const stateAt = seconds => { const state = executable.stateAt(seconds); return { ...state, ...mechanics.stateAt(state.time) }; };
  const framing = { ...authoredFraming, ...executable.framing };
  const detailIds = state => state.chapter.id === 'detail' ? details : null;
  const cameraCuts = ['detail', 'relation'];
  const timeline = { ...mechanics, ...executable, framing, stateAt, TOTAL_BEATS, PLAN_REVISION, MUSIC_EVENTS, GROUPS,
    MAXIMUM_OFFSETS: maximum, details, detailIds, CAMERA_CUTS: cameraCuts };
  return { plan: executable.plan, timeline, annotations: executable.annotations, framing, rig, detailIds, cameraCuts,
    workingPoses: rig.workingPoses, appearanceCues: executable.appearanceCues, presentationOpacity: executable.presentationOpacity };
}
