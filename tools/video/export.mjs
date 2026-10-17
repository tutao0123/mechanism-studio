import { readFile, writeFile, mkdir, readdir, realpath, stat, lstat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, resolve, relative, isAbsolute, join, basename, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const localName = path => relative(projectRoot, path).split(sep).join('/');
const inside = (root, path) => { const part = relative(root, path); return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`)); };
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const missing = error => error.code === 'ENOENT';

/** Validate lexical scope and the nearest existing ancestor, including junctions. */
export async function checkedPath(value, { root = projectRoot, output = false } = {}) {
  ensure(typeof value === 'string' && value.length > 0 && !value.includes('\0'), 'A project-relative path is required.');
  ensure(!isAbsolute(value) && !/^[a-z]:/i.test(value), 'Use a project-relative path.');
  const target = resolve(root, value), actualRoot = await realpath(root);
  ensure(inside(root, target) && target !== root, `Path leaves the project: ${value}`);
  if (output) ensure(relative(root, target).split(sep).includes('output'), 'Exports must be inside an output directory in this project.');
  let ancestor = target;
  for (;;) {
    try {
      const actualAncestor = await realpath(ancestor);
      ensure(inside(actualRoot, actualAncestor), `Path resolves outside the project: ${value}`);
      const actualTarget = resolve(actualAncestor, relative(ancestor, target));
      if (output) ensure(relative(actualRoot, actualTarget).split(sep).includes('output'), 'Resolved exports must stay inside an output directory.');
      break;
    }
    catch (error) { if (!missing(error)) throw error; const parent = dirname(ancestor); ensure(parent !== ancestor, 'No existing project ancestor.'); ancestor = parent; }
  }
  return target;
}

export function parseArguments(argv) {
  const options = {}, allowed = new Set(['frames', 'audio', 'out', 'fps', 'frame-count', 'width', 'height', 'title']);
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === '--help') { options.help = true; continue; }
    if (flag === '--overwrite') { ensure(!options.overwrite, 'Duplicate --overwrite.'); options.overwrite = true; continue; }
    ensure(flag.startsWith('--') && allowed.has(flag.slice(2)), `Unknown option: ${flag}`);
    const key = flag.slice(2); ensure(!(key in options), `Duplicate option: ${flag}`);
    const value = argv[++index]; ensure(value !== undefined && !value.startsWith('--'), `Missing value for ${flag}.`); options[key] = value;
  }
  if (options.help) return options;
  for (const key of allowed) ensure(options[key] !== undefined && options[key] !== '', `Missing --${key}.`);
  for (const key of ['fps', 'frame-count', 'width', 'height']) options[key] = Number(options[key]);
  ensure([24, 25, 30, 50, 60].includes(options.fps), '--fps must be 24, 25, 30, 50 or 60.');
  ensure(Number.isSafeInteger(options['frame-count']) && options['frame-count'] > 0, '--frame-count must be a positive integer.');
  ensure(['width', 'height'].every(key => Number.isInteger(options[key]) && options[key] > 0 && options[key] % 2 === 0 && options[key] <= 4096)
    && options.width * options.height <= 1920 * 1080, 'Use even dimensions up to 1920×1080 pixels (portrait is supported).');
  ensure(options['frame-count'] / options.fps <= 140, 'This short-clip encoder supports up to 140 seconds.');
  ensure(extname(options.out).toLowerCase() === '.mp4', '--out must be an .mp4 file.');
  ensure(!/[\r\n\0]/.test(options.title), '--title must be a single line.');
  return options;
}

/** SOF dimensions plus structural marker scan; FFmpeg later fully decodes all frames. */
export function jpegDimensions(bytes) {
  ensure(bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9, 'Not a complete JPEG image.');
  let offset = 2, dimensions = null;
  while (offset < bytes.length - 2) {
    ensure(bytes[offset++] === 0xff, 'Invalid JPEG marker.');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda) break;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    ensure(offset + 2 <= bytes.length, 'Truncated JPEG segment.');
    const length = bytes.readUInt16BE(offset);
    ensure(length >= 2 && offset + length <= bytes.length, 'Invalid JPEG segment length.');
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      ensure(length >= 8, 'Invalid JPEG frame header.');
      dimensions = { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  ensure(dimensions?.width > 0 && dimensions?.height > 0, 'JPEG has no valid dimensions.');
  return dimensions;
}

async function inspectFrames(folder, options) {
  ensure((await stat(folder)).isDirectory(), '--frames must be a directory.');
  const names = await readdir(folder), starts = ['00000.jpg', '000000.jpg'].filter(name => names.includes(name));
  ensure(starts.length === 1, 'Frames must start at 00000.jpg or 000000.jpg, with one consistent padding width.');
  const digits = starts[0].length - 4, expression = new RegExp(`^\\d{${digits}}\\.jpg$`);
  ensure(names.filter(name => expression.test(name)).length === options['frame-count'], 'JPEG file count differs from --frame-count.');
  const fingerprint = createHash('sha256');
  for (let index = 0; index < options['frame-count']; index++) {
    const name = `${String(index).padStart(digits, '0')}.jpg`;
    const path = await checkedPath(localName(join(folder, name)));
    ensure((await stat(path)).isFile(), `Not a frame file: ${name}`);
    const bytes = await readFile(path), size = jpegDimensions(bytes);
    ensure(size.width === options.width && size.height === options.height, `${name} is ${size.width}×${size.height}, expected ${options.width}×${options.height}.`);
    fingerprint.update(`${name}\0${hash(bytes)}\n`);
  }
  return { count: options['frame-count'], digits, pattern: join(folder, `%0${digits}d.jpg`), sha256: fingerprint.digest('hex') };
}

function commands(cache) {
  const env = { ...process.env, TMP: cache, TEMP: cache, TMPDIR: cache };
  return (binary, args) => {
    const result = spawnSync(binary, args, { cwd: projectRoot, env, windowsHide: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (result.error) throw new Error(`Could not run ${binary}: ${result.error.message}`);
    ensure(result.status === 0, `${binary} failed (${result.status}): ${result.stderr || result.stdout}`);
    return result;
  };
}

const probe = (run, path) => JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]).stdout);
function loudness(run, path, filters = '') {
  const result = run('ffmpeg', ['-hide_banner', '-nostats', '-nostdin', '-i', path, '-vn', '-af', `${filters ? `${filters},` : ''}loudnorm=I=-20:TP=-2.5:LRA=8:print_format=json`, '-f', 'null', '-']);
  const match = result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  ensure(match, 'FFmpeg did not return loudness measurements.');
  return JSON.parse(match[0]);
}

export function mp4Atoms(bytes) {
  const atoms = []; let offset = 0;
  while (offset + 8 <= bytes.length) {
    let size = bytes.readUInt32BE(offset); const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (size === 1) { ensure(offset + 16 <= bytes.length, 'Truncated MP4 atom.'); size = Number(bytes.readBigUInt64BE(offset + 8)); }
    if (!size) size = bytes.length - offset;
    ensure(Number.isSafeInteger(size) && size >= 8 && offset + size <= bytes.length, 'Invalid MP4 atom size.');
    atoms.push({ type, offset, size }); offset += size;
  }
  ensure(offset === bytes.length, 'Trailing or truncated MP4 bytes.'); return atoms;
}

async function freeOutput(path, overwrite) {
  await checkedPath(localName(path), { output: true });
  try { ensure(!(await lstat(path)).isSymbolicLink(), `Refusing a linked output file: ${localName(path)}`); ensure((await stat(path)).isFile(), `Output is not a file: ${localName(path)}`); ensure(overwrite, `Output already exists; use --overwrite to replace: ${localName(path)}`); }
  catch (error) { if (!missing(error)) throw error; }
}

export async function exportVideo(options) {
  const framesPath = await checkedPath(options.frames), audioPath = await checkedPath(options.audio);
  const outPath = await checkedPath(options.out, { output: true });
  ensure((await stat(audioPath)).isFile(), '--audio must be a file.');
  const stem = basename(outPath, extname(outPath)), outFolder = dirname(outPath);
  const reportPath = join(outFolder, `${stem}-verification.json`), sheetPath = join(outFolder, `${stem}-contact-sheet.jpg`);
  for (const path of [outPath, reportPath, sheetPath]) { ensure(path !== audioPath && !inside(framesPath, path), 'Output cannot replace an input.'); await freeOutput(path, options.overwrite); }
  const frames = await inspectFrames(framesPath, options);
  await mkdir(outFolder, { recursive: true });
  await checkedPath(localName(outFolder), { output: true });
  const cache = await checkedPath(localName(join(outFolder, '.video-cache', `${stem}-${Date.now()}-${randomUUID().slice(0, 8)}`)), { output: true });
  await mkdir(cache, { recursive: true }); await checkedPath(localName(cache), { output: true });
  const run = commands(cache), ffmpegVersion = run('ffmpeg', ['-version']).stdout.split('\n')[0], ffprobeVersion = run('ffprobe', ['-version']).stdout.split('\n')[0];
  const audioProbe = probe(run, audioPath), sourceAudio = audioProbe.streams.filter(stream => stream.codec_type === 'audio');
  ensure(sourceAudio.length === 1 && !audioProbe.streams.some(stream => stream.codec_type === 'video'), 'Provide one audio-only track.');
  const sourceSeconds = Number(sourceAudio[0].duration ?? audioProbe.format.duration), duration = options['frame-count'] / options.fps;
  ensure(Number.isFinite(sourceSeconds) && sourceSeconds > 0 && Math.abs(sourceSeconds - duration) < 1 / options.fps + .000001, `Audio (${sourceSeconds}s) must match the frame duration (${duration}s) within one frame; no respeed is applied.`);
  const padding = `aresample=48000,apad=whole_dur=${duration},atrim=duration=${duration},asetpts=PTS-STARTPTS`;
  const measured = loudness(run, audioPath, padding);
  ensure(['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'].every(key => Number.isFinite(Number(measured[key]))), 'Source audio is silent or has invalid loudness measurements.');
  const normalization = `loudnorm=I=-20:TP=-2.5:LRA=8:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
  const masterPath = join(cache, 'music-master.m4a');
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', audioPath, '-vn', '-af', `${padding},${normalization}`, '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '256k', '-t', String(duration), '-movflags', '+faststart', masterPath]);
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', options.overwrite ? '-y' : '-n', '-xerror', '-err_detect', 'explode', '-framerate', String(options.fps), '-start_number', '0', '-i', frames.pattern, '-i', masterPath,
    '-map', '0:v:0', '-map', '1:a:0', '-vf', 'scale=iw:ih:flags=lanczos:in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p,setsar=1',
    '-r', String(options.fps), '-frames:v', String(options['frame-count']), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-level:v', '4.2', '-color_range', 'tv', '-colorspace', 'bt709', '-color_trc', 'bt709', '-color_primaries', 'bt709',
    '-c:a', 'copy', '-t', String(duration), '-movflags', '+faststart', '-map_metadata', '-1', '-metadata', `title=${options.title}`, '-metadata', 'comment=Mechanism Studio. Original procedural score and editorial effects; no narration.', outPath]);
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', options.overwrite ? '-y' : '-n', '-i', outPath, '-an', '-vf', `fps=12/${duration},scale=480:-2,tile=3x4:padding=8:margin=8:color=white`, '-frames:v', '1', '-q:v', '2', sheetPath]);

  const metadata = probe(run, outPath), video = metadata.streams.find(stream => stream.codec_type === 'video'), audio = metadata.streams.find(stream => stream.codec_type === 'audio');
  const decode = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-xerror', '-err_detect', 'explode', '-i', outPath, '-f', 'null', '-']);
  const black = run('ffmpeg', ['-hide_banner', '-nostats', '-nostdin', '-i', outPath, '-an', '-vf', 'blackdetect=d=0.1:pix_th=0.1', '-f', 'null', '-']).stderr.split('\n').filter(line => line.includes('black_start:'));
  const sampleLines = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', outPath, '-an', '-vf', `select=not(mod(n\\,${options.fps})),format=rgb24`, '-fps_mode', 'vfr', '-f', 'framemd5', 'pipe:1']).stdout.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  const distinct = new Set(sampleLines.map(line => line.split(',').at(-1).trim())).size;
  const packetHash = path => run('ffmpeg', ['-v', 'error', '-nostdin', '-i', path, '-map', '0:a:0', '-c:a', 'copy', '-f', 'hash', '-hash', 'sha256', 'pipe:1']).stdout.trim();
  const audioPreserved = packetHash(masterPath) === packetHash(outPath), finalLoudness = loudness(run, outPath);
  const bytes = await readFile(outPath), atoms = mp4Atoms(bytes), failures = [];
  if (!video || video.codec_name !== 'h264' || video.pix_fmt !== 'yuv420p' || video.width !== options.width || video.height !== options.height || video.avg_frame_rate !== `${options.fps}/1` || Number(video.nb_frames) !== options['frame-count']) failures.push('Video specification or frame count mismatch.');
  if (!audio || audio.codec_name !== 'aac' || audio.sample_rate !== '48000' || audio.channels !== 2) failures.push('Audio specification mismatch.');
  if (Math.abs(Number(metadata.format.duration) - duration) > .025 || Math.abs(Number(video?.duration) - Number(audio?.duration)) > .025) failures.push('Media duration mismatch.');
  if (decode.stderr.trim()) failures.push('Full decode reported warnings or errors.');
  if (black.length) failures.push('Black-frame intervals found.');
  if (sampleLines.length < 1 || distinct < Math.min(3, sampleLines.length)) failures.push('Too few visibly different one-second samples.');
  if (!audioPreserved) failures.push('Master AAC packet payload was not preserved.');
  if (![finalLoudness.input_tp, finalLoudness.input_i].every(value => Number.isFinite(Number(value))) || Number(finalLoudness.input_tp) > -2 || Math.abs(Number(finalLoudness.input_i) + 20) > 1) failures.push('Final audio exceeds -2 dBTP, is outside -20 ±1 LUFS, or has invalid loudness.');
  if (!(atoms.find(atom => atom.type === 'moov')?.offset < atoms.find(atom => atom.type === 'mdat')?.offset)) failures.push('Faststart missing.');
  const report = {
    schemaVersion: 1, createdAt: new Date().toISOString(), passed: !failures.length, failures,
    tool: { file: 'tools/video/export.mjs', ffmpegVersion, ffprobeVersion },
    inputs: { frames: localName(framesPath), frameCount: frames.count, frameDigits: frames.digits, frameSequenceSha256: frames.sha256, audio: localName(audioPath), audioSha256: hash(await readFile(audioPath)), audioDurationSeconds: sourceSeconds },
    output: { file: localName(outPath), sha256: hash(bytes), bytes: bytes.length, contactSheet: localName(sheetPath), metadata, atoms },
    timing: { fps: options.fps, frames: options['frame-count'], durationSeconds: duration, audioEndAdjustmentSeconds: duration - sourceSeconds, audioRespeed: false },
    audio: { normalization: { targetLUFS: -20, normalizationCeilingDBTP: -2.5, deliveryMaximumDBTP: -2, measured, filter: `${padding},${normalization}` }, integratedLoudnessLUFS: Number(finalLoudness.input_i), truePeakDBTP: Number(finalLoudness.input_tp), loudnessRangeLU: Number(finalLoudness.input_lra), masterPacketPayloadPreserved: audioPreserved, master: localName(masterPath) },
    checks: { fullDecodePassed: !decode.stderr.trim(), decodeMessages: decode.stderr.trim(), blackIntervals: black, oneSecondSamples: sampleLines.length, distinctSampleFrames: distinct, subjectiveListeningReviewed: false, contactSheetVisuallyReviewed: false },
    scope: 'Offline encoding and objective checks only. No browser capture, upload or publication; no mechanical validity claim.',
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: options.overwrite ? 'w' : 'wx' });
  console.log(JSON.stringify({ passed: report.passed, file: localName(outPath), report: localName(reportPath), contactSheet: localName(sheetPath), durationSeconds: duration, failures }, null, 2));
  ensure(report.passed, `Export failed verification; inspect ${localName(reportPath)}.`);
  return report;
}

export const help = `Usage: node tools/video/export.mjs --frames <project-relative-folder> --audio <project-relative-audio> --out <project-relative-output/clip.mp4> --fps 30 --frame-count 1029 --width 1920 --height 1080 --title "Mechanism Studio — WOLF actuator" [--overwrite]
Frames: 00000.jpg…01028.jpg, or six-digit names, starting at zero. Existing outputs are preserved unless --overwrite is supplied.
The audio must already match the frame duration within one frame. No playback-rate change is applied.
Requires local ffmpeg and ffprobe on PATH. All inputs/outputs and cache remain inside Mechanism Studio.`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const options = parseArguments(process.argv.slice(2)); if (options.help) console.log(help); else await exportVideo(options); }
  catch (error) { console.error(`Video export: ${error.message}`); process.exitCode = 1; }
}
