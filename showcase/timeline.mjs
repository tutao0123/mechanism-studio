export function createTimeline(steps, durations = {}) {
  if (!Array.isArray(steps) || !steps.length) throw new TypeError('A tour needs chapters.');
  let total = 0; const ids = new Set();
  const chapters = steps.map(step => {
    const duration = durations[step.id] ?? step.durationHint ?? 12;
    if (!step.id || ids.has(step.id) || !Number.isFinite(duration) || duration <= 0) throw new TypeError('Invalid chapter timing.');
    ids.add(step.id); const record = { ...step, start: total, duration }; total += duration; return record;
  });
  return { chapters, total };
}
export function locateTime(timeline, seconds) {
  if (!Number.isFinite(seconds)) throw new TypeError('Tour time must be finite.');
  const time = ((seconds % timeline.total) + timeline.total) % timeline.total;
  let index = timeline.chapters.findIndex(ch => time < ch.start + ch.duration);
  if (index < 0) index = timeline.chapters.length - 1;
  const chapter = timeline.chapters[index], localTime = time - chapter.start;
  return { chapter, index, time, localTime, progress: localTime / chapter.duration };
}
export const formatTime = value => `${Math.floor(Math.max(0,value)/60)}:${String(Math.floor(Math.max(0,value)%60)).padStart(2,'0')}`;
