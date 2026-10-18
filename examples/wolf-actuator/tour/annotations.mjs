import { createWolfMotorAnnotations } from '../detail/annotations.mjs';
import { createWolfBearingAnnotations } from '../bearing/annotations.mjs';
const clamp = value => Math.max(0, Math.min(1, value));
export function createWolfTourAnnotations(story) {
  const source = { motor: createWolfMotorAnnotations(story.substories.motor), bearing: createWolfBearingAnnotations(story.substories.bearing) };
  const CUE_WINDOWS = Object.freeze(Object.fromEntries(story.CHAPTERS.map(chapter => {
    if (chapter.scope !== 'motor' && chapter.scope !== 'bearing') {
      const end = (chapter.lastBeat - chapter.firstBeat) * 60 / story.BPM;
      return [chapter.id, Object.freeze(chapter.labels.map(() => Object.freeze([.45, chapter.id === 'overview' ? 3.95 : end])))];
    }
    const study = story.substories[chapter.scope], original = study.CHAPTERS.find(value => value.id === chapter.sourceChapter), scope = story.SCOPES[chapter.scope];
    // One name per component scene. Macro windows use the entire settled hold.
    const macro = chapter.sourceChapter === 'magnet' || chapter.sourceChapter === 'component';
    const windows = macro ? [[(31.02 - original.firstBeat) * 60 / story.BPM, (35.28 - original.firstBeat) * 60 / story.BPM]] : source[chapter.scope].CUE_WINDOWS[chapter.sourceChapter].slice(0, 1);
    return [chapter.id, Object.freeze(windows.map(([first, last]) => Object.freeze([
      (story.mapStudyBeat(scope, original.firstBeat + first * story.BPM / 60) - chapter.firstBeat) * 60 / story.BPM,
      (story.mapStudyBeat(scope, original.firstBeat + last * story.BPM / 60) - chapter.firstBeat) * 60 / story.BPM,
    ])))];
  })));
  function annotationCues(state, { paused = false, cameraSettled = true } = {}) {
    if (!cameraSettled) return [];
    return (CUE_WINDOWS[state.chapter.id] ?? []).flatMap(([start, end], index) => {
      if (state.localTime < start || state.localTime >= end) return []; const [id, text] = state.chapter.labels[index];
      return [{ id, text, index, start, end, opacity: paused ? 1 : Math.min(clamp((state.localTime - start) / .16), clamp((end - state.localTime) / .20)) }];
    });
  }
  return { CUE_WINDOWS, annotationCues, ANNOTATION_REVISION: 'wolf-complete-tour-annotations-1' };
}
