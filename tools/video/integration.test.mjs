import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { exportVideo, parseArguments, projectRoot } from './export.mjs';

test('small local FFmpeg fixture encodes, verifies and refuses accidental replacement', { timeout: 120000 }, async t => {
  for (const binary of ['ffmpeg', 'ffprobe']) {
    const available = spawnSync(binary, ['-version'], { windowsHide: true, encoding: 'utf8' });
    if (available.error || available.status !== 0) { t.skip(`${binary} is not on PATH.`); return; }
  }
  const parent = join(projectRoot, 'output/video-tool-tests'); await mkdir(parent, { recursive: true });
  const fixture = await mkdtemp(join(parent, 'encoder-')), frames = join(fixture, 'frames'), cache = join(fixture, 'cache');
  await mkdir(frames); await mkdir(cache);
  const run = args => {
    const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args], { cwd: projectRoot, windowsHide: true,
      env: { ...process.env, TMP: cache, TEMP: cache, TMPDIR: cache }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
  };
  run(['-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30:duration=2', '-frames:v', '60', '-start_number', '0', '-q:v', '3', join(frames, '%05d.jpg')]);
  const sourceAudio = join(fixture, 'music.wav'), out = join(fixture, 'fixture.mp4');
  run(['-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=1.985714', '-c:a', 'pcm_s16le', sourceAudio]);
  const options = parseArguments(['--frames', relative(projectRoot, frames), '--audio', relative(projectRoot, sourceAudio), '--out', relative(projectRoot, out),
    '--fps', '30', '--frame-count', '60', '--width', '320', '--height', '180', '--title', 'Local verification fixture']);
  const report = await exportVideo(options);
  assert.equal(report.passed, true); assert.equal(report.timing.durationSeconds, 2); assert.equal(report.timing.audioRespeed, false);
  assert.ok(report.timing.audioEndAdjustmentSeconds > 0 && report.timing.audioEndAdjustmentSeconds < 1 / 30);
  assert.equal(report.checks.fullDecodePassed, true); assert.equal(report.audio.masterPacketPayloadPreserved, true);
  assert.equal(report.checks.subjectiveListeningReviewed, false); assert.equal(report.checks.contactSheetVisuallyReviewed, false);
  assert.ok(report.audio.truePeakDBTP <= -2); assert.ok(Math.abs(report.audio.integratedLoudnessLUFS + 20) <= 1);
  assert.equal(JSON.parse(await readFile(join(fixture, 'fixture-verification.json'), 'utf8')).output.sha256, report.output.sha256);
  await assert.rejects(exportVideo(options), /already exists/);
});
