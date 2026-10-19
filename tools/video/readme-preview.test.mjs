import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { projectRoot } from './export.mjs';
import { parsePreviewArguments, encodeReadmePreview } from './readme-preview.mjs';

test('README preview options refuse uneven frame selection and unsafe sizes', () => {
  const base = ['--frames', 'output/f', '--fps', '30', '--out', 'output/clip'];
  assert.equal(parsePreviewArguments(base)['gif-fps'], 15);
  assert.throws(() => parsePreviewArguments([...base, '--gif-fps', '12']), /divide the capture rate/);
  assert.throws(() => parsePreviewArguments([...base, '--gif-width', '801']), /even width/);
  assert.throws(() => parsePreviewArguments(['--frames', 'output/f', '--fps', '30', '--out', 'output/clip.gif']), /path stem/);
  assert.throws(() => parsePreviewArguments([...base, '--start', '5', '--end', '2']), /--start < --end/);
  assert.throws(() => parsePreviewArguments([...base, '--bogus', '1']), /Unknown option/);
});

test('a small fixture becomes a looping GIF and a silent MP4 within their size gates', { timeout: 120000 }, async t => {
  for (const binary of ['ffmpeg', 'ffprobe']) {
    const available = spawnSync(binary, ['-version'], { windowsHide: true, encoding: 'utf8' });
    if (available.error || available.status !== 0) { t.skip(`${binary} is not on PATH.`); return; }
  }
  const parent = join(projectRoot, 'output/video-tool-tests'); await mkdir(parent, { recursive: true });
  const fixture = await mkdtemp(join(parent, 'readme-')), frames = join(fixture, 'frames'); await mkdir(frames);
  const made = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30:duration=2', '-frames:v', '60', '-start_number', '0', '-q:v', '3', join(frames, '%05d.jpg')], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(made.status, 0, made.stderr);
  const args = ['--frames', relative(projectRoot, frames), '--fps', '30', '--out', relative(projectRoot, join(fixture, 'clip')), '--gif-width', '240', '--mp4-width', '320', '--start', '.5', '--end', '1.5'];
  const report = await encodeReadmePreview(parsePreviewArguments(args));
  assert.equal(report.passed, true); assert.equal(report.visuallyReviewed, false);
  assert.equal(report.source.firstFrame, 15); assert.equal(report.source.frameCount, 30);
  assert.equal(report.gif.width, 240); assert.equal(report.gif.frames, 15, 'every second frame of a one-second excerpt');
  assert.equal(report.mp4.codec, 'h264'); assert.equal(report.mp4.frames, 30); assert.equal(report.mp4.width, 320);
  assert.equal(JSON.parse(await readFile(join(fixture, 'clip-preview.json'), 'utf8')).gif.sha256, report.gif.sha256);
  await assert.rejects(encodeReadmePreview(parsePreviewArguments(args)), /already exists/);
  await assert.rejects(encodeReadmePreview(parsePreviewArguments([...args, '--overwrite', '--max-gif-mb', '0.00001'])), /GIF is .* MB \(limit/);
  await assert.rejects(encodeReadmePreview(parsePreviewArguments(['--frames', relative(projectRoot, frames), '--fps', '30', '--out', 'docs/clip'])), /output directory/);
  // One format per range: a short GIF excerpt and a full-length video.
  const video = await encodeReadmePreview(parsePreviewArguments(['--frames', relative(projectRoot, frames), '--fps', '30', '--out', relative(projectRoot, join(fixture, 'full')), '--only', 'mp4', '--mp4-width', '320']));
  assert.equal(video.gif, undefined); assert.equal(video.mp4.frames, 60); assert.equal(video.passed, true);
  assert.throws(() => parsePreviewArguments([...args, '--only', 'webm']), /gif or mp4/);
});
