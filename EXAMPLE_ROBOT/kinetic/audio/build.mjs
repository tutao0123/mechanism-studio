import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKineticStory } from '../story.mjs';
import { createScore, renderScore, encodeWav, analyzeAudio, sha256 } from './synth.mjs';

export async function buildMusic() {
  const index = JSON.parse(await readFile(new URL('../../planning/scene-index.json', import.meta.url), 'utf8'));
  const story = createKineticStory(index);
  const score = createScore(story, index.geometryRevision), audio = renderScore(score), analysis = analyzeAudio(audio);
  if (analysis.clippedSamples || analysis.peakDbfs > -7.99 || analysis.rmsDbfs < -27 || analysis.rmsDbfs > -19 || analysis.loopBoundary.maximumStep > .015) throw new Error(`Kinetic audio quality bounds failed: ${JSON.stringify(analysis)}`);
  const wav = encodeWav(audio);
  const metadata = { ...score, file: 'kinetic-loop.wav', byteLength: wav.length, sha256: sha256(wav), analysis };
  await mkdir(new URL('./', import.meta.url), { recursive: true });
  await writeFile(new URL('kinetic-loop.wav', import.meta.url), wav);
  await writeFile(new URL('music-score.json', import.meta.url), `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildMusic();
  console.log(JSON.stringify({ file: result.file, edition: result.edition, durationSeconds: result.durationSeconds, sha256: result.sha256, geometryRevision: result.geometryRevision, analysis: result.analysis }, null, 2));
}
