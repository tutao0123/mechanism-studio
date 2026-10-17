import { BPM, CHAPTERS } from './story.mjs';

/** One new name at a time; existing names remain until a shared scene exit.
 * Every named target is stationary for the rest of its chapter. */
export const ANNOTATION_REVISION = 'robot-annotations-2';
export const NAME_FADE_SECONDS = .18;
export const SCENE_FADE_SECONDS = .32;
export const CUE_WINDOWS = Object.freeze(Object.fromEntries(CHAPTERS.map(chapter => {
  const starts = { whole: [.35, 2.05], structure: [1.15, 3.35], wrist: [.95, 2.1], grip: [.95, 2.1], return: [.95, 3.35], resolve: [.95, 2.1] }[chapter.id];
  const end = (chapter.lastBeat - chapter.firstBeat) * 60 / BPM;
  return [chapter.id, Object.freeze(starts.map(start => Object.freeze([start, end])))];
})));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function annotationCues(state, { paused = false, cameraSettled = true } = {}) {
  if (!cameraSettled) return [];
  const windows = CUE_WINDOWS[state.chapter.id] ?? [];
  return windows.flatMap(([start, end], i) => {
    if (state.localTime < start || state.localTime >= end) return [];
    const [id, text] = state.chapter.labels[i];
    const opacity = paused ? 1 : Math.min(clamp((state.localTime - start) / NAME_FADE_SECONDS, 0, 1), clamp((end - state.localTime) / SCENE_FADE_SECONDS, 0, 1));
    return [{ id, text, index: i, start, end, opacity }];
  });
}

export { placeAnnotation, moveAnnotation } from '../shared/viewer/annotation-layout.mjs';
