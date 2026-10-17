import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, symlink, realpath, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { checkedPath, exportVideo, jpegDimensions, mp4Atoms, parseArguments, projectRoot } from './export.mjs';

const args = ['--frames', 'output/frames', '--audio', 'output/music.wav', '--out', 'output/clip.mp4', '--fps', '30', '--frame-count', '1029', '--width', '1920', '--height', '1080', '--title', 'Mechanism Studio'];
test('CLI preserves exact frame duration and requires explicit overwrite', () => {
  const options = parseArguments(args); assert.equal(options['frame-count'] / options.fps, 34.3); assert.equal(options.overwrite, undefined);
  assert.equal(parseArguments([...args, '--overwrite']).overwrite, true);
  assert.throws(() => parseArguments([...args, '--fps', '60']), /Duplicate/);
  assert.throws(() => parseArguments(args.map(value => value === '1920' ? '1921' : value)), /even dimensions/);
});
test('path scope rejects traversal, absolute paths and outputs outside output', async () => {
  await assert.rejects(checkedPath('../escape.mp4', { output: true }), /leaves the project/);
  await assert.rejects(checkedPath('F:/escape.mp4', { output: true }), /relative path/);
  await assert.rejects(checkedPath('tools/clip.mp4', { output: true }), /output directory/);
  assert.equal(await checkedPath('output/video-tool-tests/future/clip.mp4', { output: true }), join(projectRoot, 'output/video-tool-tests/future/clip.mp4'));
});
test('existing ancestor junction is resolved before accepting a future output', async t => {
  const directory = join(projectRoot, 'output/video-tool-tests'); await mkdir(directory, { recursive: true });
  const fixture = await mkdtemp(join(directory, 'paths-')), inner = join(fixture, 'inner'), outer = join(fixture, 'outer');
  await mkdir(join(inner, 'output'), { recursive: true }); await mkdir(outer);
  // Simulate leaving a smaller root; the junction and target both stay in this project's output.
  const link = join(inner, 'output/outside');
  try { await symlink(await realpath(outer), link, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('Junction creation unavailable.'); return; } throw error; }
  await assert.rejects(checkedPath('output/outside/future/clip.mp4', { root: inner, output: true }), /resolves outside/);
});
test('JPEG dimensions reject truncated or missing frame headers', () => {
  const bytes = Buffer.from([0xff,0xd8,0xff,0xc0,0,11,8,4,56,7,128,1,1,0x11,0,0xff,0xda,0,2,0xff,0xd9]);
  assert.deepEqual(jpegDimensions(bytes), { width: 1920, height: 1080 });
  assert.throws(() => jpegDimensions(bytes.subarray(0, -1)), /complete JPEG/);
  assert.throws(() => jpegDimensions(Buffer.from([0xff,0xd8,0xff,0xd9])), /dimensions/);
});
test('MP4 atom inspection detects faststart order and truncated files', () => {
  const atom = name => { const bytes = Buffer.alloc(8); bytes.writeUInt32BE(8); bytes.write(name, 4); return bytes; };
  assert.deepEqual(mp4Atoms(Buffer.concat([atom('ftyp'), atom('moov'), atom('mdat')])).map(entry => entry.type), ['ftyp', 'moov', 'mdat']);
  assert.throws(() => mp4Atoms(Buffer.concat([atom('moov'), Buffer.from([0])])), /truncated/);
});
test('missing numbered frames are refused before encoding', async () => {
  const parent = join(projectRoot, 'output/video-tool-tests'); await mkdir(parent, { recursive: true });
  const fixture = await mkdtemp(join(parent, 'missing-')), frames = join(fixture, 'frames'); await mkdir(frames);
  const jpeg = Buffer.from([0xff,0xd8,0xff,0xc0,0,11,8,4,56,7,128,1,1,0x11,0,0xff,0xda,0,2,0xff,0xd9]);
  await writeFile(join(frames, '00000.jpg'), jpeg); await writeFile(join(frames, '00002.jpg'), jpeg);
  await writeFile(join(fixture, 'music.wav'), 'validation stops before audio decoding');
  const options = parseArguments(['--frames', relative(projectRoot, frames), '--audio', relative(projectRoot, join(fixture, 'music.wav')), '--out', relative(projectRoot, join(fixture, 'clip.mp4')),
    '--fps', '30', '--frame-count', '2', '--width', '1920', '--height', '1080', '--title', 'Missing-frame check']);
  await assert.rejects(exportVideo(options), /ENOENT/);
});
test('changed capture dimensions are refused before encoding', async () => {
  const parent = join(projectRoot, 'output/video-tool-tests'); await mkdir(parent, { recursive: true });
  const fixture = await mkdtemp(join(parent, 'dimensions-')), frames = join(fixture, 'frames'); await mkdir(frames);
  const jpeg = Buffer.from([0xff,0xd8,0xff,0xc0,0,11,8,4,56,7,128,1,1,0x11,0,0xff,0xda,0,2,0xff,0xd9]);
  await writeFile(join(frames, '00000.jpg'), jpeg); await writeFile(join(fixture, 'music.wav'), 'validation stops before audio decoding');
  const options = parseArguments(['--frames', relative(projectRoot, frames), '--audio', relative(projectRoot, join(fixture, 'music.wav')), '--out', relative(projectRoot, join(fixture, 'clip.mp4')),
    '--fps', '30', '--frame-count', '1', '--width', '1280', '--height', '720', '--title', 'Dimension check']);
  await assert.rejects(exportVideo(options), /1920×1080, expected 1280×720/);
});
