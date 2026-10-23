/** Rebuild every code-synthesized study score that Git does not keep.
 *
 * Each score's committed music-score.json records the exact WAV byte length and
 * SHA-256. This script runs the example's own build and accepts the result only
 * when it reproduces those bytes. It never changes a tracked file: the committed
 * metadata is restored after every build, because its loudness and loop-seam
 * diagnostics are recomputed in floating point and may differ in the last
 * digits between Node builds even when the PCM bytes are identical. To change a
 * score deliberately, run the example's build directly and commit the metadata.
 *
 *   node scripts/build-audio.mjs            build missing or mismatched WAVs
 *   node scripts/build-audio.mjs --force    rebuild and verify every score
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const studyScore = example => ['tools/audio/build-study-score.mjs', '--example', example];
export const SCORES = Object.freeze([
  { metadata: 'EXAMPLE_ROBOT/audio/music-score.json', build: ['EXAMPLE_ROBOT/audio/build.mjs'] },
  { metadata: 'EXAMPLE_ROBOT/audio/editions/assembly-return-v1/music-score.json', build: ['EXAMPLE_ROBOT/audio/editions/assembly-return-v1/build.mjs'] },
  { metadata: 'EXAMPLE_ROBOT/kinetic/audio/music-score.json', build: ['EXAMPLE_ROBOT/kinetic/audio/build.mjs'] },
  { metadata: 'examples/allegro-hand/audio/music-score.json', build: studyScore('examples/allegro-hand') },
  { metadata: 'examples/gearbox/audio/music-score.json', build: ['examples/gearbox/audio/build.mjs'] },
  { metadata: 'examples/gearbox/cinematic/audio/music-score.json', build: ['examples/gearbox/cinematic/audio/build.mjs'] },
  { metadata: 'examples/humanoid/audio/music-score.json', build: ['examples/humanoid/audio/build.mjs'] },
  { metadata: 'examples/planetary-gears/audio/music-score.json', build: ['examples/planetary-gears/audio/build.mjs'] },
  { metadata: 'examples/robot-joint/audio/music-score.json', build: ['examples/robot-joint/audio/build.mjs'] },
  { metadata: 'examples/robotiq-gripper/audio/music-score.json', build: studyScore('examples/robotiq-gripper') },
].map(Object.freeze));

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const readOptional = path => readFile(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });

/** Score metadata without its measured `analysis` diagnostics, at any depth. */
export function withoutDiagnostics(value) {
  if (Array.isArray(value)) return value.map(withoutDiagnostics);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'analysis').map(([key, item]) => [key, withoutDiagnostics(item)]));
}

/** Project-relative WAV path recorded by a score's metadata. */
export function scoreWavPath(metadataPath, metadata) {
  if (typeof metadata.file !== 'string' || !/^(?:audio\/)?[\w-]+\.wav$/.test(metadata.file)) throw new Error(`${metadataPath}: unexpected score file ${metadata.file}`);
  return `${dirname(metadataPath)}/${metadata.file}`;
}

export async function buildScore(score, { force = false } = {}) {
  const metadataPath = resolve(root, score.metadata), recordedBytes = await readFile(metadataPath), recorded = JSON.parse(recordedBytes);
  const wav = scoreWavPath(score.metadata, recorded), wavPath = resolve(root, wav);
  const matches = bytes => bytes?.length === recorded.byteLength && sha256(bytes) === recorded.sha256;
  const previous = await readOptional(wavPath);
  if (!force && matches(previous)) return { wav, status: 'present' };
  // Remove the old file first, so a build that silently writes nothing fails.
  await rm(wavPath, { force: true });
  let built = false;
  try {
    const run = spawnSync(process.execPath, score.build, { cwd: root, encoding: 'utf8' });
    if (run.error) throw run.error;
    if (run.status !== 0) throw new Error(`${score.build.join(' ')} exited with ${run.status}: ${run.stderr.trim().split('\n').at(-1)}`);
    const rebuilt = JSON.parse(await readFile(metadataPath, 'utf8'));
    if (JSON.stringify(withoutDiagnostics(rebuilt)) !== JSON.stringify(withoutDiagnostics(recorded))) throw new Error(`${score.metadata}: the build changed the score itself, not only its diagnostics.`);
    const rebuiltWav = await readOptional(wavPath);
    if (!rebuiltWav) throw new Error(`${score.build.join(' ')} wrote no ${wav}.`);
    if (!matches(rebuiltWav)) throw new Error(`${wav}: rebuilt bytes do not match the recorded SHA-256.`);
    built = true;
  } finally {
    await writeFile(metadataPath, recordedBytes);
    // Keep a previously verified file rather than leave a failed or missing one.
    if (!built && matches(previous)) await writeFile(wavPath, previous);
  }
  return { wav, status: 'built' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--force')) throw new Error('Usage: node scripts/build-audio.mjs [--force]');
  const failures = [];
  for (const score of SCORES) {
    try { const { wav, status } = await buildScore(score, { force: args.includes('--force') }); console.log(`${status.padEnd(7)} ${wav}`); }
    catch (error) { failures.push(error.message); console.error(`FAILED  ${score.metadata}: ${error.message}`); }
  }
  if (failures.length) {
    console.error(`${failures.length} of ${SCORES.length} scores did not reproduce their recorded bytes. Committed metadata was left unchanged.`);
    process.exitCode = 1;
  }
}
