/** One scene and one clock; whole and component offsets compose before parenting. */
import { createWolfStory, localDisplayOffsets, SOURCE_SHA256 } from '../story.mjs';
import { createWolfMotorDetail } from '../detail/story.mjs';
import { createWolfBearingStory } from '../bearing/story.mjs';
export { localDisplayOffsets, SOURCE_SHA256 };
export const BPM = 112, TOTAL_BEATS = 128, DURATION = TOTAL_BEATS * 60 / BPM;
export const PLAN_REVISION = 'wolf-complete-tour-1';
const freeze = Object.freeze, add = (a, b) => a.map((value, i) => value + b[i]);
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p ** 3 * (10 - 15 * p + 6 * p * p); };
const ramp = (beat, first, last) => smooth((beat - first) / (last - first));
const scope = firstBeat => freeze({ firstBeat, lastBeat: firstBeat + 38, sourceFirstBeat: 6, sourceLastBeat: 60, knots: freeze([[6, firstBeat], [28, firstBeat + 14], [38, firstBeat + 22], [60, firstBeat + 38]].map(freeze)) });
export const SCOPES = freeze({ motor: scope(28), bearing: scope(72) });
export function normalizeTime(seconds) { if (!Number.isFinite(seconds)) throw new TypeError('Tour seconds must be finite'); let time = seconds % DURATION; if (time < 0) time += DURATION; return time < 1e-10 || DURATION - time < 1e-10 ? 0 : time; }
function remap(knots, value, input, output) {
  const last = knots.length - 1; let segment = knots.findIndex((point, i) => i < last && value >= point[input] && value <= knots[i + 1][input]);
  if (segment < 0) segment = value < knots[0][input] ? 0 : last - 1;
  const a = knots[segment], b = knots[segment + 1]; return a[output] + (value - a[input]) * (b[output] - a[output]) / (b[input] - a[input]);
}
export const mapStudyBeat = (scope, sourceBeat) => remap(scope.knots, sourceBeat, 0, 1);
export const unmapStudyBeat = (scope, beat) => remap(scope.knots, beat, 1, 0);

export function createWolfTourStory(index) {
  const whole = createWolfStory(index), motor = createWolfMotorDetail(index), bearing = createWolfBearingStory(index), byId = new Map(index.parts.map(part => [part.id, part]));
  const wholeGroups = whole.GROUPS.map((group, i) => ({ id: `whole-${group.id}`, scope: 'whole', family: `whole-${group.id}`, kind: 'hardware', ids: group.ids, outBeat: [8, 11, 14, 17][i], outEndBeat: [10.2, 13.2, 16.2, 19.2][i], inBeat: [119, 116, 113, 110][i], inEndBeat: [122, 118.2, 115.2, 112.2][i] }));
  const mapEvent = (scopeName, event) => {
    const scope = SCOPES[scopeName], firstBeat = mapStudyBeat(scope, event.firstBeat), lastBeat = mapStudyBeat(scope, event.lastBeat);
    const family = scopeName === 'motor' && event.kind === 'repeat' ? event.id.startsWith('magnet') ? 'motor-magnets' : 'motor-cc' : `${scopeName}-${event.family ?? event.kind}`;
    return freeze({ ...event, id: `${scopeName}-${event.id}`, scope: scopeName, family, ids: event.ids, partIds: event.partIds, startBeat: firstBeat, endBeat: lastBeat, firstBeat, lastBeat });
  };
  const wholeEvents = wholeGroups.flatMap(group => [
    { id: `${group.id}-explode`, scope: 'whole', family: group.family, kind: 'hardware', phase: 'explode', ids: group.ids, partIds: group.ids, firstBeat: group.outBeat, lastBeat: group.outEndBeat, startBeat: group.outBeat, endBeat: group.outEndBeat },
    { id: `${group.id}-reassemble`, scope: 'whole', family: group.family, kind: 'hardware', phase: 'reassemble', ids: group.ids, partIds: group.ids, firstBeat: group.inBeat, lastBeat: group.inEndBeat, startBeat: group.inBeat, endBeat: group.inEndBeat },
  ]);
  const MOTION_EVENTS = freeze([...wholeEvents.map(freeze), ...motor.MOTION_EVENTS.map(event => mapEvent('motor', event)), ...bearing.MOTION_EVENTS.map(event => mapEvent('bearing', event))].sort((a, b) => a.firstBeat - b.firstBeat));
  const mapGroups = (scopeName, study) => study.GROUPS.map(group => freeze({ ...group, id: `${scopeName}-${group.id}`, scope: scopeName, outBeat: mapStudyBeat(SCOPES[scopeName], group.outBeat), outEndBeat: mapStudyBeat(SCOPES[scopeName], group.outEndBeat), inBeat: mapStudyBeat(SCOPES[scopeName], group.inBeat), inEndBeat: mapStudyBeat(SCOPES[scopeName], group.inEndBeat) }));
  const GROUPS = freeze([...wholeGroups.map(freeze), ...mapGroups('motor', motor), ...mapGroups('bearing', bearing)]);
  const chapter = (id, firstBeat, lastBeat, title, copy, labels = [], scope = 'whole', sourceChapter = null) => ({ id, firstBeat, lastBeat, title, copy, labels, scope, sourceChapter });
  const studyChapters = (scopeName, study) => study.CHAPTERS.filter(value => value.lastBeat > 6 && value.firstBeat < 60).map(value => {
    let labels = value.labels.slice(0, 1), title = value.title, copy = value.copy;
    if (scopeName === 'motor' && value.id === 'repeats') { labels = [[motor.bindings.labelCc, 'cc']]; title = 'Two rings of small details.'; copy = 'Forty magnets beside forty source-named “cc” pieces.'; }
    return chapter(`${scopeName}-${value.id}`, mapStudyBeat(SCOPES[scopeName], Math.max(6, value.firstBeat)), mapStudyBeat(SCOPES[scopeName], Math.min(60, value.lastBeat)), title, copy, labels, scopeName, value.id);
  });
  const CHAPTERS = freeze([
    chapter('overview', 0, 8, 'One joint. A world of detail.', 'A complete WOLF actuator, explored from assembly to individual parts.', [[whole.bindings.front, 'Front plate']]),
    chapter('unfold', 8, 20, 'Open the structure.', 'Covers, bearings, rings and gears separate in four layers.'),
    chapter('motion', 20, 28, 'Input rotation — illustrative', 'The rotor, shaft and sun gear share one input turn.'),
    ...studyChapters('motor', motor),
    chapter('transfer', 66, 72, 'From the motor to the bearing.', 'The motor is restored before the next component opens.'),
    ...studyChapters('bearing', bearing),
    chapter('reassemble', 110, 124, 'Everything comes together.', 'Gears, rings, bearings and covers return in sequence.'),
    chapter('resolve', 124, 128, 'Whole again.', '245 original components. One continuous journey.', [[whole.bindings.front, 'Front plate']]),
  ].map(value => freeze({ ...value, labels: freeze(value.labels.map(freeze)) })));
  const motorIds = new Set(motor.bindings.motorParts), bearingIds = new Set(bearing.bindings.bearingParts);
  const motionPrimaryIds = new Set([...motorIds, whole.bindings.sun, whole.bindings.holder]);
  const MAXIMUM_OFFSETS = freeze(Object.fromEntries(index.parts.map(part => [part.id, freeze(add(whole.MAXIMUM_OFFSETS[part.id], motorIds.has(part.id) ? motor.MAXIMUM_OFFSETS[part.id] : bearingIds.has(part.id) ? bearing.MAXIMUM_OFFSETS[part.id] : [0, 0, 0]))])));
  const PATH_MAXIMUM_OFFSETS = freeze({ ...MAXIMUM_OFFSETS, [motor.bindings.labelMagnet]: freeze(add(whole.MAXIMUM_OFFSETS[motor.bindings.labelMagnet], motor.PATH_MAXIMUM_OFFSETS[motor.bindings.labelMagnet])), [bearing.bindings.focus]: freeze(add(whole.MAXIMUM_OFFSETS[bearing.bindings.focus], bearing.PATH_MAXIMUM_OFFSETS[bearing.bindings.focus])) });
  function stateAt(seconds) {
    let time = normalizeTime(seconds), beat = time * BPM / 60; const nearest = Math.round(beat); if (Math.abs(beat - nearest) < 1e-10) { beat = nearest; time = beat * 60 / BPM; }
    const chapterIndex = CHAPTERS.findIndex(value => beat >= value.firstBeat && beat < value.lastBeat), activeChapter = CHAPTERS[chapterIndex];
    const macroOffsetsWorld = Object.fromEntries(index.parts.map(part => [part.id, [0, 0, 0]])), progress = {};
    for (const group of wholeGroups) { const amount = ramp(beat, group.outBeat, group.outEndBeat) * (1 - ramp(beat, group.inBeat, group.inEndBeat)); progress[group.id] = amount; for (const id of group.ids) macroOffsetsWorld[id] = whole.MAXIMUM_OFFSETS[id].map(value => value * amount || 0); }
    let scope = null, sourceBeat = null, studyState = null;
    if (beat >= 28 && beat <= 66) { scope = 'motor'; sourceBeat = unmapStudyBeat(SCOPES.motor, beat); studyState = motor.stateAt(sourceBeat * 60 / BPM); }
    else if (beat >= 72 && beat <= 110) { scope = 'bearing'; sourceBeat = unmapStudyBeat(SCOPES.bearing, beat); studyState = bearing.stateAt(sourceBeat * 60 / BPM); }
    const localOffsetsWorld = studyState?.offsetsWorld ?? Object.fromEntries(index.parts.map(part => [part.id, [0, 0, 0]]));
    const offsetsWorld = Object.fromEntries(index.parts.map(part => [part.id, add(macroOffsetsWorld[part.id], localOffsetsWorld[part.id])]));
    if (studyState) for (const [id, value] of Object.entries(studyState.progress)) progress[`${scope}-${id}`] = value;
    // Complete the one illustrative turn before the close motor hand-off.
    // The rig returns exact identity at progress=1; no moving input part is lost.
    const motionDemoProgress = beat >= 20 && beat < 28 ? ramp(beat, 20, 26) : 0;
    return { time, beat, chapter: activeChapter, chapterIndex, localTime: time - activeChapter.firstBeat * 60 / BPM, scope, sourceBeat, studyState, motionDemoProgress, progress, macroOffsetsWorld, localOffsetsWorld, offsetsWorld };
  }
  function opacityFor(state, id) {
    if (!byId.has(id)) return 0;
    const beat = state.beat;
    if (beat >= 20 && beat < 26) return motionPrimaryIds.has(id) ? 1 : 1 - ramp(beat, 20, 22);
    if (beat >= 26 && beat < 28) return motorIds.has(id) ? 1 : motionPrimaryIds.has(id) ? 1 - ramp(beat, 26, 28) : 0;
    if (beat >= 28 && beat <= 66) {
      if (motorIds.has(id)) return motor.opacityFor(state.studyState, id);
      return ramp(beat, mapStudyBeat(SCOPES.motor, 57.4), 66);
    }
    if (beat > 66 && beat < 72) return bearingIds.has(id) ? 1 : 1 - ramp(beat, 68.5, 71.5);
    if (beat >= 72 && beat <= 110) {
      if (bearingIds.has(id)) return bearing.opacityFor(state.studyState, id);
      return ramp(beat, mapStudyBeat(SCOPES.bearing, 57.4), 110);
    }
    return 1;
  }
  const labelObstacleIds = state => index.parts.filter(part => opacityFor(state, part.id) >= .5).map(part => part.id);
  return { BPM, TOTAL_BEATS, DURATION, PLAN_REVISION, CHAPTERS, GROUPS, MOTION_EVENTS, SCOPES, MAXIMUM_OFFSETS, PATH_MAXIMUM_OFFSETS, MACRO_MAXIMUM_OFFSETS: whole.MAXIMUM_OFFSETS,
    stateAt, normalizeTime, localDisplayOffsets, opacityFor, labelObstacleIds, detailIds: () => null, editorialAxis: whole.editorialAxis, mapStudyBeat, unmapStudyBeat,
    substories: { whole, motor, bearing }, bindings: freeze({ whole: whole.bindings, motor: motor.bindings, bearing: bearing.bindings, motorRoot: motor.bindings.motor, bearingRoot: bearing.bindings.bearing, motorMagnet: motor.bindings.labelMagnet, bearingPart: bearing.bindings.focus }),
    offsetOwnership: 'whole-source groups + one active component study -> complete world intentions -> actual immediate-parent residual translations; local restoration retains whole expansion; final whole restoration zeros every leaf' };
}
