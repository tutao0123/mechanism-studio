/** Offline audio measurement. Never reads credentials or generates narration.
 * Usage: node showcase/voice/measure-durations.mjs [--story inline-four|turbofan|quadruped|quadruped-short]
 * Each duration is measured from the manifest's exact MP3, after hash checking
 * and full decoding. A failed story leaves its previous duration file intact.
 */
import { readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validateLesson } from '../../shared/voice/lesson.mjs';
import { validateManifest } from '../../shared/voice/player.mjs';
import { sha256 } from '../../shared/assets/glb.mjs';
import { STORIES } from '../stories.mjs';
import { narrationEditions } from '../presentation.mjs';

const run = promisify(execFile);
const root = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
const stories = Object.freeze(narrationEditions(STORIES).map(edition => edition.id));
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const inside = (base, path) => {
  const rel = relative(base, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..\\') && !rel.startsWith('../'));
};

async function existing(path, boundary = root) {
  ensure(inside(boundary, resolve(path)), 'Audio file is outside its story boundary');
  const actual = await realpath(path);
  ensure(inside(root, actual) && inside(boundary, actual), 'Resolved audio file is outside its story boundary');
  return actual;
}

export async function executeAudioTool(command, args) {
  try {
    return await run(command, args, { cwd: root, windowsHide: true, timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`${command} is missing from PATH; audio was not verified`);
    throw new Error(`${command} failed: ${String(error.stderr || error.message).trim().slice(0, 2000)}`);
  }
}

/** Parse the exact stream properties needed by the player and story clock. */
export function parseProbeResult(input, { sampleRate } = {}) {
  const probe = typeof input === 'string' ? JSON.parse(input) : input;
  const streams = probe?.streams?.filter(stream => stream.codec_type === 'audio') ?? [];
  ensure(streams.length === 1 && streams[0].codec_name === 'mp3', 'Expected one MP3 audio stream');
  const stream = streams[0], duration = Number(probe.format?.duration);
  ensure(Number.isFinite(duration) && duration > 0, 'ffprobe reported no valid positive duration');
  ensure(Number.isSafeInteger(Number(stream.sample_rate)) && Number(stream.sample_rate) > 0, 'Invalid sample rate');
  if (sampleRate !== undefined) ensure(Number(stream.sample_rate) === sampleRate, 'Sample rate differs from manifest');
  ensure(Number.isInteger(stream.channels) && stream.channels > 0, 'Invalid audio channel count');
  return { codec: stream.codec_name, sampleRate: Number(stream.sample_rate), channels: stream.channels, durationSeconds: duration };
}

/** Probe and decode a supplied, already boundary-checked file without shell expansion. */
export async function probeMP3(file, options = {}) {
  const { stdout } = await executeAudioTool('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration:stream=codec_name,codec_type,sample_rate,channels',
    '-of', 'json', '-i', file,
  ]);
  const measured = parseProbeResult(stdout, options);
  const decoded = await executeAudioTool('ffmpeg', [
    '-v', 'error', '-xerror', '-nostdin', '-err_detect', 'explode', '-i', file,
    '-map', '0:a:0', '-f', 'null', '-',
  ]);
  ensure(!decoded.stderr.trim(), 'ffmpeg emitted decoding errors');
  return { ...measured, fullDecodePassed: true };
}

/** Reusable for the showcase's explicit local lesson/manifest/asset layout. */
export async function measureStory(story) {
  ensure(stories.includes(story), `Unknown story: ${story}`);
  const directory = await existing(resolve(root, 'showcase/voice', story));
  const lesson = JSON.parse(await readFile(await existing(resolve(directory, 'lesson.json'), directory), 'utf8'));
  const manifest = JSON.parse(await readFile(await existing(resolve(directory, 'voice/audio-manifest.json'), directory), 'utf8'));
  const normalized = validateLesson(lesson);
  await validateManifest(manifest, lesson, { baseURL: `http://mechanism-studio.local/showcase/voice/${story}/` });
  const steps = {}, records = [];
  for (const { id } of normalized.steps) {
    const record = manifest.steps[id];
    const file = await existing(resolve(directory, record.src), directory);
    const bytes = await readFile(file);
    ensure(bytes.length === record.bytes, `${story}/${id}: MP3 byte count does not match manifest`);
    ensure(sha256(bytes) === record.sha256, `${story}/${id}: MP3 SHA-256 does not match manifest`);
    const measured = await probeMP3(file, { sampleRate: manifest.sampleRate });
    steps[id] = measured.durationSeconds;
    records.push({ id, bytes: bytes.length, sha256: record.sha256, ...measured });
  }
  const durations = { schemaVersion: 1, lessonSha256: manifest.lessonSha256, steps };
  const output = resolve(directory, 'durations.json');
  // An existing output must be a regular, in-bound file, never a junction/link.
  try {
    const stat = await lstat(output);
    ensure(!stat.isSymbolicLink() && stat.isFile(), 'Duration output must be a regular file');
    await existing(output, directory);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(output, JSON.stringify(durations, null, 2) + '\n');
  return { story, output: relative(root, output).replaceAll('\\', '/'), lessonSha256: manifest.lessonSha256,
    files: records.length, durationSeconds: records.reduce((sum, record) => sum + record.durationSeconds, 0), records };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    ensure(args.length === 0 || (args.length === 2 && args[0] === '--story' && stories.includes(args[1])),
      `Usage: node showcase/voice/measure-durations.mjs [--story ${stories.join('|')}]`);
    const results = [];
    for (const story of args.length ? [args[1]] : stories) results.push(await measureStory(story));
    console.log(JSON.stringify({ passed: true, mode: 'offline-measure-and-full-decode', stories: results.map(({ records, ...result }) => result),
      files: results.reduce((sum, result) => sum + result.files, 0),
      durationSeconds: Number(results.reduce((sum, result) => sum + result.durationSeconds, 0).toFixed(6)) }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
