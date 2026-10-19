import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { checkStaticRegion, meanAbsoluteError, parseStaticRegionArguments } from './check-static-region.mjs';
import { projectRoot } from './export.mjs';

const argumentsFor = (folder, out, reference = '00000.jpg') => ['--frames', relative(projectRoot, folder), '--reference', reference, '--x', '0', '--y', '0', '--width', '96', '--height', '24', '--out', relative(projectRoot, out)];

test('static-region arguments require explicit geometry and reject ambiguous inputs', () => {
  const args = argumentsFor(join(projectRoot, 'output/frames'), join(projectRoot, 'output/report.json'));
  assert.equal(parseStaticRegionArguments(args)['max-mae'], 1);
  assert.throws(() => parseStaticRegionArguments([...args, '--x', '1']), /Duplicate/);
  assert.throws(() => parseStaticRegionArguments(args.map(value => value === '96' ? '-1' : value)), /positive region/);
  assert.throws(() => parseStaticRegionArguments([...args, '--max-mae', 'NaN']), /grayscale levels/);
  assert.throws(() => parseStaticRegionArguments(args.map(value => value === '00000.jpg' ? '../00000.jpg' : value)), /numbered JPEG/);
});

test('fingerprints compare spatial pixels, not just average brightness', () => {
  assert.equal(meanAbsoluteError(Buffer.from([0, 255, 0, 255]), Buffer.from([0, 255, 0, 255])), 0);
  assert.equal(meanAbsoluteError(Buffer.from([0, 255, 0, 255]), Buffer.from([255, 0, 255, 0])), 255);
  assert.throws(() => meanAbsoluteError(Buffer.alloc(0), Buffer.alloc(0)), /nonzero/);
});

async function fixture(t) {
  const available = spawnSync('ffmpeg', ['-version'], { windowsHide: true });
  if (available.error || available.status !== 0) { t.skip('FFmpeg is not on PATH.'); return null; }
  const parent = join(projectRoot, 'output/video-tool-tests'); await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, 'static-region-')), frames = join(root, 'frames'); await mkdir(frames);
  const make = async (name, { width = 96, height = 64, enlarge = false, lower = 20, extension = 'jpg' } = {}) => {
    // Distinctive static header, with independent motion below. An intermittent
    // 1.5x screenshot crop changes the header despite identical file dimensions.
    const pixels = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const u = enlarge ? Math.floor(x / 1.5) : x, v = enlarge ? Math.floor(y / 1.5) : y;
      const value = v < 24 ? ((u >= 8 && u < 24 && v >= 6 && v < 18) || (u >= 38 && u < 72 && v >= 4 && v < 20) ? 15 : 245) : lower;
      pixels.fill(value, (y * width + x) * 3, (y * width + x + 1) * 3);
    }
    const ppm = Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), pixels]);
    const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-f', 'image2pipe', '-vcodec', 'ppm', '-i', 'pipe:0', '-frames:v', '1', ...(extension === 'jpg' ? ['-q:v', '2'] : []), join(frames, name)], { input: ppm, windowsHide: true });
    assert.equal(result.status, 0, result.error?.message || result.stderr?.toString());
  };
  return { root, frames, make };
}

test('all-frame JPEG gate catches a one-frame same-size scale crop while ignoring motion outside the region', { timeout: 30000 }, async t => {
  const f = await fixture(t); if (!f) return;
  await f.make('00000.jpg'); await f.make('00001.jpg', { lower: 120 });
  await f.make('00002.jpg', { enlarge: true }); await f.make('00003.jpg', { lower: 200 });
  const out = join(f.root, 'bad.json'), args = argumentsFor(f.frames, out);
  const result = spawnSync(process.execPath, ['tools/video/check-static-region.mjs', ...args], { cwd: projectRoot, windowsHide: true, encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr); // Failed capture must stop a shell pipeline.
  const report = JSON.parse(await readFile(out, 'utf8'));
  assert.equal(report.allDimensionsMatch, true); assert.equal(report.fullDecodePassed, true);
  assert.deepEqual(report.badFrameIndexes, [2]); assert.equal(report.measures.length, 4);
  assert.ok(report.badFrames[0].meanAbsoluteError > 10);
  await copyFile(join(f.frames, '00000.jpg'), join(f.frames, '00002.jpg'));
  const fixed = await checkStaticRegion(parseStaticRegionArguments(argumentsFor(f.frames, join(f.root, 'fixed.json'))));
  assert.equal(fixed.passed, true); assert.deepEqual(fixed.badFrameIndexes, []);
  await assert.rejects(checkStaticRegion(parseStaticRegionArguments(args)), /already exists/);
});

test('dimension changes are reported with frame indexes before comparing regions', { timeout: 30000 }, async t => {
  const f = await fixture(t); if (!f) return;
  await f.make('00000.jpg'); await f.make('00001.jpg', { width: 112 });
  const report = await checkStaticRegion(parseStaticRegionArguments(argumentsFor(f.frames, join(f.root, 'dimensions.json'))));
  assert.equal(report.passed, false); assert.equal(report.allDimensionsMatch, false);
  assert.deepEqual(report.badFrameIndexes, [1]); assert.equal(report.badFrames[0].reason, 'dimension-mismatch');
});

test('PNG sequences support a nonzero approved reference; gaps and out-of-bounds regions are rejected', { timeout: 30000 }, async t => {
  const f = await fixture(t); if (!f) return;
  await f.make('00000.png', { extension: 'png' }); await f.make('00001.png', { lower: 150, extension: 'png' });
  const args = argumentsFor(f.frames, join(f.root, 'png.json'), '00001.png');
  const report = await checkStaticRegion(parseStaticRegionArguments(args));
  assert.equal(report.passed, true); assert.equal(report.reference.index, 1);
  const oversized = parseStaticRegionArguments(argumentsFor(f.frames, join(f.root, 'bounds.json'), '00001.png')); oversized.x = 1;
  await assert.rejects(checkStaticRegion(oversized), /outside the reference/);
  await copyFile(join(f.frames, '00001.png'), join(f.frames, '00003.png'));
  await assert.rejects(checkStaticRegion(parseStaticRegionArguments(argumentsFor(f.frames, join(f.root, 'gap.json'), '00001.png'))), /contiguous/);
});

test('malformed image payload fails decoding instead of producing a passing fingerprint', { timeout: 30000 }, async t => {
  const f = await fixture(t); if (!f) return;
  await f.make('00000.png', { extension: 'png' });
  const bytes = await readFile(join(f.frames, '00000.png'));
  await writeFile(join(f.frames, '00001.png'), bytes.subarray(0, 33));
  const report = await checkStaticRegion(parseStaticRegionArguments(argumentsFor(f.frames, join(f.root, 'corrupt.json'), '00000.png')));
  assert.equal(report.passed, false); assert.equal(report.fullDecodePassed, false); assert.ok(report.failures.length > 0);
});
