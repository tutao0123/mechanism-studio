import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScore, renderScore, encodeWav, analyzeAudio, sha256 } from './synth.mjs';

export async function buildMusic() {
  const score = createScore();
  const audio = renderScore(score);
  const wav = encodeWav(audio);
  const analysis = analyzeAudio(audio);
  if (analysis.clippedSamples || analysis.peakDbfs > -7.99 || analysis.rmsDbfs < -24 || analysis.rmsDbfs > -19 || analysis.loopBoundary.maximumStep > 0.02) throw new Error(`Audio quality bounds failed: ${JSON.stringify(analysis)}`);
  const metadata = { ...score, file: 'robot-loop.wav', sha256: sha256(wav), byteLength: wav.length, analysis };
  const directory = new URL('./', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('robot-loop.wav', directory), wav);
  await writeFile(new URL('music-score.json', directory), `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildMusic();
  console.log(JSON.stringify({ file: result.file, durationSeconds: result.durationSeconds, bpm: result.bpm, bars: result.bars, sha256: result.sha256, analysis: result.analysis }, null, 2));
}
