/** Offline audit of existing example and English showcase narration. Never reads credentials or calls TTS. */
import { readFile, writeFile, realpath, mkdir, lstat } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLesson } from '../shared/voice/lesson.mjs';
import { validateManifest } from '../shared/voice/player.mjs';
import { sha256 } from '../shared/assets/glb.mjs';
import { executeAudioTool, probeMP3 } from '../showcase/voice/measure-durations.mjs';
import { STORIES } from '../showcase/stories.mjs';
import { narrationEditions } from '../showcase/presentation.mjs';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const examples = [
  { path: 'prototype-3d', expectedSteps: 5 },
  { path: 'examples/inline-four', expectedSteps: 5 },
  { path: 'examples/turbofan', expectedSteps: 5 },
  { path: 'examples/quadruped', expectedSteps: 6 },
  ...narrationEditions(STORIES).map(({ id }) => ({ path: `showcase/voice/${id}`, lessonPath: 'lesson.json', expectedSteps: 6 })),
];
const report = {
  schemaVersion: '1.0.0', generatedAt: new Date().toISOString(), mode: 'offline-existing-assets',
  passed: false, expectedExamples: examples.length, expectedAudioFiles: examples.reduce((sum, example) => sum + example.expectedSteps, 0),
  tools: {}, examples: [], summary: { files: 0, bytes: 0, durationSeconds: 0, decodedFiles: 0 }, errors: [],
};
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const inside = (base, path) => {
  const rel = relative(base, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..\\') && !rel.startsWith('../'));
};
async function existing(path, boundary = root) {
  ensure(inside(boundary, resolve(path)), 'Requested file is outside its example boundary');
  const actual = await realpath(path);
  ensure(inside(root, actual) && inside(boundary, actual), 'Resolved file is outside its example boundary');
  return actual;
}
async function verifyExample(example) {
  const directory = await existing(resolve(root, example.path));
  const lesson = JSON.parse(await readFile(await existing(resolve(directory, example.lessonPath ?? 'voice/lesson.json'), directory), 'utf8'));
  const manifest = JSON.parse(await readFile(await existing(resolve(directory, 'voice/audio-manifest.json'), directory), 'utf8'));
  const normalized = validateLesson(lesson);
  ensure(normalized.steps.length === example.expectedSteps, `${example.path}: expected ${example.expectedSteps} narration steps`);
  await validateManifest(manifest, lesson, { baseURL: `http://mechanism-studio.local/${example.path}/` });
  const result = { example: example.path, passed: false, provider: manifest.provider, resourceId: manifest.resourceId,
    lessonSha256: manifest.lessonSha256, lessonHashPolicy: manifest.lessonHashPolicy ?? 'legacy-narration-v1', steps: [] };
  report.examples.push(result);
  for (const step of normalized.steps) {
    const record = manifest.steps[step.id];
    const file = await existing(resolve(directory, record.src), directory);
    const bytes = await readFile(file), actualHash = sha256(bytes);
    ensure(bytes.length === record.bytes, `${example.path}/${step.id}: MP3 byte count does not match manifest`);
    ensure(actualHash === record.sha256, `${example.path}/${step.id}: MP3 SHA-256 does not match manifest`);
    const measured = await probeMP3(file, { sampleRate: manifest.sampleRate });
    result.steps.push({ id: step.id, file: `${example.path}/${record.src}`, bytes: bytes.length, sha256: actualHash,
      ...measured });
    report.summary.files += 1; report.summary.decodedFiles += 1;
    report.summary.bytes += bytes.length; report.summary.durationSeconds += measured.durationSeconds;
  }
  result.durationSeconds = result.steps.reduce((sum, step) => sum + step.durationSeconds, 0);
  result.passed = true;
}
try {
  for (const command of ['ffprobe', 'ffmpeg']) {
    const { stdout } = await executeAudioTool(command, ['-version']);
    report.tools[command] = { available: true, version: stdout.split(/\r?\n/, 1)[0] };
  }
  for (const example of examples) await verifyExample(example);
  ensure(report.summary.files === report.expectedAudioFiles && report.summary.decodedFiles === report.expectedAudioFiles,
    `Expected all ${report.expectedAudioFiles} audio files to pass full decoding`);
  report.passed = true;
} catch (error) {
  report.errors.push(error.message);
  process.exitCode = 1;
}
report.summary.durationSeconds = Number(report.summary.durationSeconds.toFixed(3));

// The report is the only mutation; do not follow an output junction outside the project.
const output = resolve(root, 'output');
try { await lstat(output); } catch (error) { if (error.code !== 'ENOENT') throw error; await mkdir(output); }
const outputRoot = await existing(output);
const target = resolve(outputRoot, 'audio-verification.json');
try { await existing(target, outputRoot); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await writeFile(target, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, ...report.summary, report: 'output/audio-verification.json', errors: report.errors }, null, 2));
