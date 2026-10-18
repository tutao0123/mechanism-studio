const clamp = value => Math.max(0, Math.min(1, value));
export function createWolfMotorAnnotations(story) {
  // Windows exclude every authored camera move and every labelled part motion.
  const windows = { whole: [[.45, 2.05]], motor: [[2.05, 5.35], [3.3, 5.35]], repeats: [[4, 6.428571428571429], [5.25, 6.428571428571429]], magnet: [[1.85, 3.9]], return: [[1.05, 10.3]], resolve: [[.85, 2.142857142857143]] };
  const CUE_WINDOWS = Object.freeze(Object.fromEntries(story.CHAPTERS.map(chapter => [chapter.id, Object.freeze(windows[chapter.id].map(Object.freeze))])));
  function annotationCues(state, { paused = false, cameraSettled = true } = {}) {
    if (!cameraSettled) return [];
    return CUE_WINDOWS[state.chapter.id].flatMap(([start, end], index) => {
      if (state.localTime < start || state.localTime >= end) return [];
      const [id, text] = state.chapter.labels[index];
      return [{ id, text, index, start, end, opacity: paused ? 1 : Math.min(clamp((state.localTime - start) / .18), clamp((end - state.localTime) / .25)) }];
    });
  }
  return { CUE_WINDOWS, annotationCues, ANNOTATION_REVISION: 'wolf-motor-annotations-2' };
}
