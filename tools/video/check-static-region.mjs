/** Check every captured frame against an approved, static piece of page chrome.
 * Image dimensions alone do not detect intermittent full-page DPI/scale crops.
 * This gate is deliberately separate from encoding and from visual review. */
import { readFile, readdir, stat, lstat, mkdir, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkedPath, jpegDimensions, projectRoot } from './export.mjs';

const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const local = path => relative(projectRoot, path).split(sep).join('/');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (folder, path) => { const part = relative(folder, path); return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`)); };

export function parseStaticRegionArguments(argv) {
  const options = { 'max-mae': 1 }, seen = new Set();
  const allowed = new Set(['frames', 'reference', 'x', 'y', 'width', 'height', 'max-mae', 'out']);
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help') { options.help = true; continue; }
    if (flag === '--overwrite') { ensure(!options.overwrite, 'Duplicate --overwrite.'); options.overwrite = true; continue; }
    ensure(flag.startsWith('--') && allowed.has(flag.slice(2)), `Unknown option: ${flag}`);
    const key = flag.slice(2); ensure(!seen.has(key), `Duplicate option: ${flag}`); seen.add(key);
    const value = argv[++i]; ensure(value !== undefined && !value.startsWith('--'), `Missing value for ${flag}.`);
    options[key] = value;
  }
  if (options.help) return options;
  for (const key of allowed) ensure(options[key] !== undefined && options[key] !== '', `Missing --${key}.`);
  for (const key of ['x', 'y', 'width', 'height', 'max-mae']) options[key] = Number(options[key]);
  ensure(['x', 'y'].every(key => Number.isSafeInteger(options[key]) && options[key] >= 0), '--x and --y must be nonnegative pixel integers.');
  ensure(['width', 'height'].every(key => Number.isSafeInteger(options[key]) && options[key] > 0) && options.width * options.height <= 4096 * 4096, 'Use positive region dimensions up to 16,777,216 pixels.');
  ensure(Number.isFinite(options['max-mae']) && options['max-mae'] >= 0 && options['max-mae'] <= 255, '--max-mae must be between 0 and 255 grayscale levels.');
  ensure(/^\d{5,6}\.(jpg|png)$/.test(options.reference), '--reference must be a numbered JPEG/PNG filename inside --frames (e.g. 00000.jpg).');
  ensure(options.out.toLowerCase().endsWith('.json'), '--out must be a JSON report in an output directory.');
  return options;
}

export function imageDimensions(bytes, extension) {
  if (extension === 'jpg') return jpegDimensions(bytes);
  ensure(extension === 'png' && bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR' && bytes.readUInt32BE(8) === 13, 'Not a PNG image with an IHDR header.');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  ensure(width > 0 && height > 0, 'PNG dimensions must be positive.');
  return { width, height };
}

export function meanAbsoluteError(reference, current) {
  ensure(reference.length > 0 && reference.length === current.length, 'Region buffers must have equal nonzero lengths.');
  let sum = 0;
  for (let i = 0; i < reference.length; i++) sum += Math.abs(reference[i] - current[i]);
  return sum / reference.length;
}

async function readSequence(folder, reference) {
  ensure((await stat(folder)).isDirectory(), '--frames must be a directory.');
  const names = (await readdir(folder)).filter(name => /^\d+\.(jpg|png)$/i.test(name)).sort();
  ensure(names.length > 0 && /^\d{5,6}\.(jpg|png)$/.test(names[0]), 'Use one contiguous sequence from 00000.jpg or 000000.png.');
  const digits = names[0].length - 4, extension = names[0].slice(-3);
  ensure(names.every((name, i) => name === `${String(i).padStart(digits, '0')}.${extension}`), 'Frames must be contiguous from zero, with one padding width and one extension.');
  ensure(names.includes(reference), 'Reference frame does not exist in the sequence.');
  const fingerprint = createHash('sha256'), frames = [];
  for (const [index, name] of names.entries()) {
    const path = await checkedPath(local(join(folder, name)));
    ensure((await stat(path)).isFile(), `Not a frame file: ${name}`);
    const bytes = await readFile(path), digest = hash(bytes);
    fingerprint.update(`${name}\0${digest}\n`);
    let dimensions, error;
    try { dimensions = imageDimensions(bytes, extension); } catch (failure) { error = failure.message; }
    frames.push({ index, name, sha256: digest, ...(dimensions && { dimensions }), ...(error && { error }) });
  }
  return { frames, pattern: join(folder, `%0${digits}d.${extension}`), sha256: fingerprint.digest('hex') };
}

const baseArgs = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-xerror', '-err_detect', 'explode'];
const decodeArgs = region => ['-vf', `format=gray,crop=${region.width}:${region.height}:${region.x}:${region.y}:exact=1`, '-an', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'];

function decodeReference(path, region) {
  const size = region.width * region.height;
  const result = spawnSync('ffmpeg', [...baseArgs, '-i', path, '-frames:v', '1', ...decodeArgs(region)], { cwd: projectRoot, windowsHide: true, maxBuffer: size + 1024 * 1024 });
  ensure(!result.error && result.status === 0, `FFmpeg reference decode failed: ${result.error?.message || result.stderr?.toString().trim()}`);
  ensure(result.stdout.length === size, 'Reference decode returned an unexpected region size.');
  return result.stdout;
}

async function compareSequence(pattern, count, region, reference, threshold) {
  const child = spawn('ffmpeg', [...baseArgs, '-framerate', '30', '-start_number', '0', '-i', pattern, '-frames:v', String(count), ...decodeArgs(region)], { cwd: projectRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = '', spawnError, remaining = Buffer.alloc(0), index = 0;
  const measures = [], badFrames = [], regionBytes = reference.length;
  child.stderr.on('data', chunk => { errors = (errors + chunk.toString()).slice(-8192); });
  const completion = new Promise(resolve => { child.on('error', error => { spawnError = error; }); child.on('close', code => resolve(code)); });
  try {
    for await (const chunk of child.stdout) {
      remaining = remaining.length ? Buffer.concat([remaining, chunk]) : chunk;
      while (remaining.length >= regionBytes) {
        const mae = meanAbsoluteError(reference, remaining.subarray(0, regionBytes));
        measures.push({ index, meanAbsoluteError: mae });
        if (mae > threshold) badFrames.push({ index, reason: 'static-region-changed', meanAbsoluteError: mae });
        index++; remaining = remaining.subarray(regionBytes);
      }
    }
    const code = await completion;
    ensure(!spawnError && code === 0, `FFmpeg sequence decode failed: ${spawnError?.message || errors.trim()}`);
    ensure(remaining.length === 0 && index === count, `Decoded ${index} complete regions; expected ${count}.`);
    return { measures, badFrames };
  } catch (error) { child.kill(); await completion; throw error; }
}

export async function checkStaticRegion(options) {
  const framesPath = await checkedPath(options.frames), reportPath = await checkedPath(options.out, { output: true });
  ensure(!inside(framesPath, reportPath), 'Report cannot be written into the input frame directory.');
  try {
    const existing = await lstat(reportPath);
    ensure(existing.isFile() && !existing.isSymbolicLink(), 'Report target must be an ordinary file.');
    ensure(options.overwrite, 'Report already exists; use --overwrite to replace it.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const sequence = await readSequence(framesPath, options.reference);
  const referenceFrame = sequence.frames.find(frame => frame.name === options.reference);
  ensure(referenceFrame.dimensions, `Reference is invalid: ${referenceFrame.error}`);
  const { x, y, width, height } = options, region = { x, y, width, height }, dimensions = referenceFrame.dimensions;
  ensure(x + width <= dimensions.width && y + height <= dimensions.height, 'Static region extends outside the reference frame.');
  const badFrames = sequence.frames.flatMap(frame => frame.error ? [{ index: frame.index, reason: 'invalid-image', detail: frame.error }] :
    frame.dimensions.width !== dimensions.width || frame.dimensions.height !== dimensions.height ? [{ index: frame.index, reason: 'dimension-mismatch', dimensions: frame.dimensions }] : []);
  const report = { schemaVersion: 1, tool: 'tools/video/check-static-region.mjs', createdAt: new Date().toISOString(),
    frames: local(framesPath), frameCount: sequence.frames.length, frameSequenceSha256: sequence.sha256, dimensions,
    reference: { name: referenceFrame.name, index: referenceFrame.index, sha256: referenceFrame.sha256 }, region, maximumMeanAbsoluteError: options['max-mae'],
    allDimensionsMatch: badFrames.length === 0, fullDecodePassed: false, badFrames, measures: [], failures: [],
    note: 'Static-region capture consistency only. A visually approved reference and a truly static, distinctive region are required; this does not validate camera motion, geometry, audio or perceptual flicker elsewhere.' };
  if (report.allDimensionsMatch) {
    try {
      const reference = decodeReference(join(framesPath, referenceFrame.name), region);
      report.reference.decodedRegionSha256 = hash(reference);
      const comparison = await compareSequence(sequence.pattern, sequence.frames.length, region, reference, options['max-mae']);
      report.measures = comparison.measures; report.badFrames.push(...comparison.badFrames); report.fullDecodePassed = true;
    } catch (error) { report.failures.push(error.message); }
  } else report.failures.push('Frame dimensions or image headers differ; pixel comparison was not attempted.');
  report.badFrameIndexes = report.badFrames.map(frame => frame.index);
  report.passed = report.allDimensionsMatch && report.fullDecodePassed && report.badFrames.length === 0 && report.failures.length === 0;
  await mkdir(dirname(reportPath), { recursive: true });
  await checkedPath(local(reportPath), { output: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: options.overwrite ? 'w' : 'wx' });
  return report;
}

export const staticRegionHelp = `Usage: node tools/video/check-static-region.mjs --frames <project-relative-folder> --reference 00000.jpg
  --x 0 --y 0 --width 1080 --height 125 --out <output/report.json> [--max-mae 1] [--overwrite]
Checks all numbered JPEG or PNG frames against an approved static region. Pixel coordinates are in the captured image.
JSON records source hashes, every region's mean absolute grayscale error and bad frame indexes. Exit 1 means failure.
Run this explicit gate before export.mjs; it does not replace viewing the entire encoded clip.`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseStaticRegionArguments(process.argv.slice(2));
    if (options.help) console.log(staticRegionHelp);
    else {
      const report = await checkStaticRegion(options);
      console.log(JSON.stringify({ passed: report.passed, frameCount: report.frameCount, badFrameIndexes: report.badFrameIndexes, failures: report.failures, report: options.out }, null, 2));
      if (!report.passed) process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
