/** Bind the reviewed gearbox choreography to real part IDs, then execute it.
 * The returned plan is serializable: changing an offset, window or camera in
 * that data changes the study through the same shared executor. */
import { compilePresentationPlan } from '../../shared/study/plan.mjs';
import { createGearboxMechanics } from './story.mjs';
import { createGearboxCameraPlan } from './framing.mjs';
import { BPM, TOTAL_BEATS, DURATION, CHAPTERS, PLAN_REVISION, COHORTS, CASE_TIMING, FOCUS, WAVE, createGearboxDisplayMetadata } from './presentation-data.mjs';
import { CUE_WINDOWS, NAME_FADE_SECONDS, SCENE_FADE_SECONDS } from './annotations.mjs';

export function createGearboxPresentation(index, { plan: suppliedPlan } = {}) {
  const mechanics = createGearboxMechanics(index), display = createGearboxDisplayMetadata(index);
  const authoredFraming = createGearboxCameraPlan(index, { ...mechanics, ...display });
  const seconds = beats => beats * 60 / BPM;
  const window = (rise, fall) => ({ rise: rise.map(seconds), fall: fall.map(seconds) });
  const channels = Object.fromEntries(Object.entries(COHORTS).map(([name, cohort]) => [name,
    window([cohort.out, cohort.out + cohort.beats], [cohort.back, cohort.back + cohort.beats])
  ]));
  channels.case = window(CASE_TIMING.open, CASE_TIMING.close);
  channels.caseLift = { ...channels.case, cutoff: seconds(30) };
  channels.focus = window(FOCUS.fadeIn, FOCUS.fadeOut);
  const offsets = Object.keys(COHORTS).map(channel => ({ channel, vectors: Object.fromEntries(index.parts
    .filter(part => !(channel === 'inner' && display.waveDelay.has(part.id)))
    .map(part => [part.id, display.explode.get(part.id)[channel]])) }));
  // A channel per repeated occurrence preserves the original outward wave and
  // the faster, reversed return. There is no per-frame stagger calculation.
  for (const [id, delay] of display.waveDelay) {
    const channel = `inner:${id}`, cohort = COHORTS.inner, back = cohort.back + WAVE.span - delay;
    channels[channel] = window([cohort.out + delay, cohort.out + delay + cohort.beats], [back, back + WAVE.returnBeats]);
    offsets.push({ channel, vectors: { [id]: display.explode.get(id).inner } });
  }
  offsets.push({ channel: 'caseLift', vectors: Object.fromEntries(display.caseParts) });
  const focus = new Set(FOCUS.ids);
  for (const id of focus) if (!index.parts.some(part => part.id === id)) throw new Error(`Focus part missing: ${id}`);
  const executable = compilePresentationPlan(suppliedPlan ?? {
    schemaVersion: 'mechanism-presentation-1', id: PLAN_REVISION, geometryRevision: index.geometryRevision,
    bpm: BPM, durationSeconds: DURATION, chapters: CHAPTERS, channels, offsets,
    annotations: { windows: CUE_WINDOWS, fadeInSeconds: NAME_FADE_SECONDS, fadeOutSeconds: SCENE_FADE_SECONDS },
    cameras: authoredFraming.cameras,
    appearance: { labelWeight: 1, opacity: [
      { channel: 'case', ids: [...display.caseParts.keys()], minimum: 0 },
      { channel: 'focus', ids: index.parts.filter(part => !focus.has(part.id) && !display.caseParts.has(part.id)).map(part => part.id), minimum: FOCUS.context },
    ] },
  }, index);
  const stateAt = seconds => { const state = executable.stateAt(seconds); return { ...state, ...mechanics.stateAt(state.time) }; };
  const appearanceCues = (state, labels) => [...executable.appearanceCues(state, labels), ...mechanics.powerCues(state)];
  const framing = { ...authoredFraming, ...executable.framing };
  const dense = new Set(['low', 'sync', 'over']);
  const labelObstacleIds = state => dense.has(state.chapter.id) ? state.chapter.labels.map(([id]) => id)
    : index.parts.filter(part => executable.presentationOpacity(state, part.id) >= .5).map(part => part.id);
  const timeline = { ...mechanics, ...display, ...executable, framing, stateAt, appearanceCues, labelObstacleIds,
    TOTAL_BEATS, PLAN_REVISION, COHORTS, CASE_TIMING, FOCUS, WAVE };
  return { plan: executable.plan, timeline, annotations: executable.annotations, framing, workingPoses: mechanics.workingPoses,
    appearanceCues, presentationOpacity: executable.presentationOpacity, labelObstacleIds };
}
