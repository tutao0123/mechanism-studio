import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScore, renderScore, encodeScore, sha256, BPM, TOTAL_BEATS, DURATION, READING_WINDOWS_BEATS } from './synth.mjs';

export async function buildMusic() {
  const index = JSON.parse(await readFile(new URL('../assets/scene-index.json', import.meta.url), 'utf8'));
  const story = await import('../choreography.mjs');
  if (story.BPM !== BPM || story.TOTAL_BEATS !== TOTAL_BEATS || story.DURATION !== DURATION) throw new Error('The music and robot-joint story must share the same transport.');
  for (const [windowId, chapterId] of [['motor', 'motor'], ['gear', 'mesh'], ['bearing', 'bearing']]) {
    const chapter = story.CHAPTERS.find(chapter => chapter.id === chapterId);
    const window = READING_WINDOWS_BEATS[windowId];
    // The quiet reading passage is a subinterval. A chapter may continue into
    // working motion afterwards without changing the established soundtrack.
    if (!chapter || chapter.firstBeat > window[0] || chapter.lastBeat < window[1]) throw new Error(`Retimed ${chapterId} chapter must contain its music reading window.`);
  }
  const score = createScore(index.geometryRevision, { events: story.MUSIC_EVENTS, storyRevision: story.PLAN_REVISION, partIds: index.parts.map(part => part.id) });
  const { bytes, analysis } = encodeScore(renderScore(score));
  if (analysis.clippedSamples || analysis.encodedPcm.clippedSamples || analysis.peakDbfs > -9.99 || analysis.rmsDbfs < -34 || analysis.rmsDbfs > -17 || analysis.encodedPcm.loopBoundary.maximumStep > .012) throw new Error(`Robot-joint audio quality bounds failed: ${JSON.stringify(analysis)}`);
  const metadata = { ...score, file: 'joint-loop.wav', byteLength: bytes.length, sha256: sha256(bytes), analysis };
  await mkdir(new URL('./', import.meta.url), { recursive: true });
  await writeFile(new URL('joint-loop.wav', import.meta.url), bytes);
  await writeFile(new URL('music-score.json', import.meta.url), `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildMusic();
  console.log(JSON.stringify({ file: result.file, durationSeconds: result.durationSeconds, bpm: result.bpm, sha256: result.sha256, analysis: result.analysis }, null, 2));
}
