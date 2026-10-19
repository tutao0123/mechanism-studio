import { BPM, CHAPTERS } from './story.mjs';
export const NAME_FADE_SECONDS = .18;
export const SCENE_FADE_SECONDS = .32;
export const ANNOTATION_REVISION = 'gearbox-annotations-1';
/** Label windows in beats: [reveal, end]. Every named part is settled for the
 * whole window; the synchronizer names fade before the 3→4 shift moves them. */
const WINDOW_BEATS = {
  whole: [[1.5, 5]],
  open: [[8.6, 12], [10, 12]],
  explode: [[16, 18.6], [17.2, 18.6]],
  low: [[24.3, 32], [28.8, 32]],
  sync: [[34.4, 37.7], [35.6, 37.7]],
  over: [[46.4, 49.8]],
  close: [],
};
export const CUE_WINDOWS = Object.freeze(Object.fromEntries(CHAPTERS.map(chapter => {
  const windows = WINDOW_BEATS[chapter.id];
  if (windows.length !== chapter.labels.length) throw new Error(`Label windows must match labels: ${chapter.id}`);
  return [chapter.id, Object.freeze(windows.map(([a, b]) => Object.freeze([(a - chapter.firstBeat) * 60 / BPM, (b - chapter.firstBeat) * 60 / BPM])))];
})));
export function annotationCues(state, { paused = false, cameraSettled = true } = {}) {
  if (!cameraSettled) return [];
  return (CUE_WINDOWS[state.chapter.id] ?? []).flatMap(([start, end], index) => {
    if (state.localTime < start || state.localTime >= end) return [];
    const [id, text] = state.chapter.labels[index];
    const opacity = paused ? 1 : Math.max(0, Math.min(1, (state.localTime - start) / NAME_FADE_SECONDS, (end - state.localTime) / SCENE_FADE_SECONDS));
    return [{ id, text, index, start, end, opacity }];
  });
}
