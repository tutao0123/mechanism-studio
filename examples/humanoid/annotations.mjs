import { BPM, CHAPTERS } from './story.mjs';
export const NAME_FADE_SECONDS = .18;
export const SCENE_FADE_SECONDS = .32;
export const CUE_WINDOWS = Object.freeze(Object.fromEntries(CHAPTERS.map(chapter => [chapter.id, Object.freeze(chapter.labels.map((_, index) => Object.freeze([index === 0 ? 1.05 : 2.15, (chapter.lastBeat - chapter.firstBeat) * 60 / BPM])))])));
export function annotationCues(state, { paused = false, cameraSettled = true } = {}) {
  if (!cameraSettled) return [];
  return (CUE_WINDOWS[state.chapter.id] ?? []).flatMap(([start, end], index) => {
    if (state.localTime < start || state.localTime >= end) return [];
    const [id, text] = state.chapter.labels[index];
    const opacity = paused ? 1 : Math.max(0, Math.min(1, (state.localTime - start) / NAME_FADE_SECONDS, (end - state.localTime) / SCENE_FADE_SECONDS));
    return [{ id, text, index, start, end, opacity }];
  });
}
