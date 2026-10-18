import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWolfTourStory } from '../story.mjs';
import { createScore, renderScore, encodeWav, analyzeAudio, sha256 } from './synth.mjs';

export async function buildMusic() {
  const index = JSON.parse(await readFile(new URL('../../assets/scene-index.json', import.meta.url), 'utf8'));
  const story = createWolfTourStory(index), score = createScore(story, index), audio = renderScore(score), analysis = analyzeAudio(audio, score);
  if (analysis.clippedSamples || analysis.peakDbfs > -7.99 || analysis.rmsDbfs < -32 || analysis.rmsDbfs > -19 || analysis.loopBoundary.maximumStep > .012 || analysis.loopBoundary.ratioToMaximumInteriorStep > .5) throw new Error(`Tour audio quality bounds failed: ${JSON.stringify(analysis)}`);
  analysis.inspectionWindows = score.automation.readingDips.map(dip => {
    const start = Math.round(dip.fullBeat * 60 / score.bpm * score.sampleRate), end = Math.round(dip.releaseBeat * 60 / score.bpm * score.sampleRate);
    let energy = 0; for (let i = start; i < end; i++) energy += audio.left[i] ** 2 + audio.right[i] ** 2;
    return { id: dip.id, partId: dip.partId, firstBeat: dip.fullBeat, lastBeat: dip.releaseBeat, rmsDbfs: 20 * Math.log10(Math.sqrt(energy / ((end - start) * 2))) };
  });
  const wav = encodeWav(audio), metadata = { ...score, file: 'audio/tour-loop.wav', byteLength: wav.length, sha256: sha256(wav), analysis };
  await mkdir(new URL('./', import.meta.url), { recursive: true });
  await writeFile(new URL('tour-loop.wav', import.meta.url), wav);
  await writeFile(new URL('../music-score.json', import.meta.url), `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildMusic();
  console.log(JSON.stringify({ file: result.file, edition: result.edition, durationSeconds: result.durationSeconds, sha256: result.sha256, geometryRevision: result.geometryRevision, actionCues: result.effects.actionCues.length, analysis: result.analysis }, null, 2));
}
