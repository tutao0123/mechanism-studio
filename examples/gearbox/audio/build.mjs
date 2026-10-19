import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScore, renderScore, encodeWav, analyzeAudio, sha256 } from './synth.mjs';
import { createGearboxStory } from '../story.mjs';

export async function buildMusic() {
  const index = JSON.parse(await readFile(new URL('../assets/scene-index.json', import.meta.url), 'utf8'));
  const story = createGearboxStory(index), score = createScore(story, index.geometryRevision);
  const audio = renderScore(score), analysis = analyzeAudio(audio);
  if (analysis.clippedSamples || analysis.peakDbfs > -7.99 || analysis.rmsDbfs < -32 || analysis.rmsDbfs > -19 || analysis.loopBoundary.ratioToMaximumInteriorStep > .5) throw new Error(`Gearbox audio quality bounds failed: ${JSON.stringify(analysis)}`);
  const wav = encodeWav(audio), metadata = { ...score, file: 'gearbox-loop.wav', byteLength: wav.length, sha256: sha256(wav), analysis };
  await writeFile(new URL('gearbox-loop.wav', import.meta.url), wav);
  await writeFile(new URL('music-score.json', import.meta.url), `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildMusic();
  console.log(JSON.stringify({ file: result.file, durationSeconds: result.durationSeconds, byteLength: result.byteLength, sha256: result.sha256, cues: result.effects.actionCues.map(c => `${c.id}@${c.beat.toFixed(2)}`), analysis: { peakDbfs: result.analysis.peakDbfs, rmsDbfs: result.analysis.rmsDbfs, loop: result.analysis.loopBoundary, sections: result.analysis.sections.map(s => `${s.id}:${s.rmsDbfs.toFixed(1)}`) } }, null, 2));
}
