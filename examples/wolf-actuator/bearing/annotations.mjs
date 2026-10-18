const clamp = value => Math.max(0, Math.min(1, value));
export function createWolfBearingAnnotations(story) {
  // Each target has reached a fixed endpoint before its own name appears.
  const windows = { whole: [[.45, 2.05]], bearing: [[1.65, 5.35], [3.95, 5.35]], repeats: [[3.75, 6.428571428571429]], component: [[1.85, 3.9]], return: [[1.05, 8.85]], resolve: [[.85, 2.142857142857143]] };
  const CUE_WINDOWS = Object.freeze(Object.fromEntries(story.CHAPTERS.map(chapter => [chapter.id, Object.freeze(windows[chapter.id].map(Object.freeze))])));
  function annotationCues(state, { paused = false, cameraSettled = true } = {}) {
    if (!cameraSettled) return [];
    return CUE_WINDOWS[state.chapter.id].flatMap(([start, end], index) => {
      if (state.localTime < start || state.localTime >= end) return []; const [id, text] = state.chapter.labels[index];
      return [{ id, text, index, start, end, opacity: paused ? 1 : Math.min(clamp((state.localTime - start) / .18), clamp((end - state.localTime) / .25)) }];
    });
  }
  return { CUE_WINDOWS, annotationCues, ANNOTATION_REVISION: 'wolf-bearing-annotations-1' };
}
