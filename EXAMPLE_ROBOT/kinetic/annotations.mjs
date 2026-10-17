export const ANNOTATION_REVISION = 'robot-kinetic-annotations-1';
export const NAME_FADE_SECONDS = .16;
export const SCENE_FADE_SECONDS = .25;
const clamp = value => Math.max(0, Math.min(1, value));

/** Read only the two still detail scenes; movement gets the full attention. */
export function createKineticAnnotations(story) {
  const CUE_WINDOWS = Object.freeze(Object.fromEntries(story.CHAPTERS.map(chapter => {
    const end = (chapter.lastBeat - chapter.firstBeat) * 60 / story.BPM;
    return [chapter.id, Object.freeze(chapter.labels.map((_, i) => Object.freeze([[1.15, 2.5][i], end])))];
  })));
  function annotationCues(state, { paused = false, cameraSettled = true } = {}) {
    if (!cameraSettled) return [];
    return (CUE_WINDOWS[state.chapter.id] ?? []).flatMap(([start, end], index) => {
      if (state.localTime < start || state.localTime >= end) return [];
      const [id, text] = state.chapter.labels[index];
      const opacity = paused ? 1 : Math.min(clamp((state.localTime - start) / NAME_FADE_SECONDS), clamp((end - state.localTime) / SCENE_FADE_SECONDS));
      return [{ id, text, index, start, end, opacity }];
    });
  }
  return { CUE_WINDOWS, annotationCues };
}
