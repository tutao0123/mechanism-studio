import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScore, renderScore, decodePcmWav, encodeWav, analyzeAudio, sha256 } from './synth.mjs';

export async function loadSamples() {
  const provenance = JSON.parse(await readFile(new URL('sfx/provenance.json', import.meta.url), 'utf8'));
  const sampleMap = {};
  for (const source of provenance.files) {
    const bytes = await readFile(new URL(`sfx/${source.file}`, import.meta.url));
    if (sha256(bytes) !== source.sha256) throw new Error(`CC0 source hash mismatch: ${source.file}`);
    sampleMap[source.file] = decodePcmWav(bytes);
  }
  return { provenance, sampleMap };
}

export async function buildMusic({ story, geometryRevision } = {}) {
  let index;
  if (!story) {
    index = JSON.parse(await readFile(new URL('../assets/scene-index.json', import.meta.url), 'utf8'));
    const storyModule = await import('../story.mjs');
    story = typeof storyModule.createHumanoidStory === 'function' ? storyModule.createHumanoidStory(index) : storyModule;
  }
  geometryRevision ??= story.geometryRevision ?? story.GEOMETRY_REVISION;
  if (!geometryRevision) {
    index ??= JSON.parse(await readFile(new URL('../assets/scene-index.json', import.meta.url), 'utf8'));
    geometryRevision = index.geometryRevision;
  }
  const { provenance, sampleMap } = await loadSamples();
  const score = createScore(story, geometryRevision, provenance), audio = renderScore(score, sampleMap), analysis = analyzeAudio(audio);
  if (analysis.clippedSamples || analysis.peakDbfs > -7.99 || analysis.rmsDbfs < -31 || analysis.rmsDbfs > -19 || analysis.loopBoundary.maximumStep > .012 || analysis.loopBoundary.ratioToMaximumInteriorStep > .5) throw new Error(`Humanoid audio quality bounds failed: ${JSON.stringify(analysis)}`);
  const wav = encodeWav(audio);
  const metadata = { ...score, file: 'humanoid-loop.wav', byteLength: wav.length, sha256: sha256(wav), analysis };
  await mkdir(new URL('./', import.meta.url), { recursive: true });
  await writeFile(new URL('humanoid-loop.wav', import.meta.url), wav);
  await writeFile(new URL('music-score.json', import.meta.url), `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildMusic();
  console.log(JSON.stringify({ file: result.file, edition: result.edition, durationSeconds: result.durationSeconds, sha256: result.sha256, geometryRevision: result.geometryRevision, analysis: result.analysis }, null, 2));
}
