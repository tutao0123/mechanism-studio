export const ANNOTATION_REVISION = 'wolf-annotations-1';
export const NAME_FADE_SECONDS = .18;
export const SCENE_FADE_SECONDS = .32;
const clamp = value => Math.max(0, Math.min(1, value));
export function createWolfAnnotations(story) {
  const starts = { whole: [.35, 2.05], structure: [1.15, 3.35], rings: [.95, 2.1], gears: [.95, 2.1], return: [.95, 3.35], resolve: [.95, 2.1] };
  const CUE_WINDOWS = Object.freeze(Object.fromEntries(story.CHAPTERS.map(chapter => [chapter.id, Object.freeze(starts[chapter.id].map(start => Object.freeze([start, (chapter.lastBeat - chapter.firstBeat) * 60 / story.BPM])))])));
  function annotationCues(state, { paused = false, cameraSettled = true } = {}) {
    if (!cameraSettled) return [];
    return (CUE_WINDOWS[state.chapter.id] ?? []).flatMap(([start, end], index) => {
      if (state.localTime < start || state.localTime >= end) return [];
      const [id, text] = state.chapter.labels[index];
      return [{ id, text, index, start, end, opacity: paused ? 1 : Math.min(clamp((state.localTime - start) / NAME_FADE_SECONDS), clamp((end - state.localTime) / SCENE_FADE_SECONDS)) }];
    });
  }
  return { CUE_WINDOWS, annotationCues, ANNOTATION_REVISION, NAME_FADE_SECONDS, SCENE_FADE_SECONDS };
}
