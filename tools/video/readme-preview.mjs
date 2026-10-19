import { readdir, stat, writeFile, readFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkedPath, projectRoot } from './export.mjs';

/** README-sized media from already captured frames: an animated GIF that
 * GitHub renders inline from the repository, and a small silent H.264 MP4 for
 * places that accept video uploads. Size gates fail loudly instead of quietly
 * shipping a heavy README. Capture and visual review remain separate steps. */
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const MB = 1024 * 1024;
const DEFAULTS = { 'gif-width': 800, 'gif-fps': 15, 'gif-colors': 128, 'mp4-width': 1280, 'mp4-crf': 28, 'max-gif-mb': 8, 'max-mp4-mb': 4 };

export function parsePreviewArguments(argv) {
  const options = { ...DEFAULTS }, allowed = new Set(['frames', 'fps', 'out', 'start', 'end', 'only', ...Object.keys(DEFAULTS)]), seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help') { options.help = true; continue; }
    if (flag === '--overwrite') { options.overwrite = true; continue; }
    ensure(flag.startsWith('--') && allowed.has(flag.slice(2)), `Unknown option: ${flag}`);
    const key = flag.slice(2); ensure(!seen.has(key), `Duplicate option: ${flag}`); seen.add(key);
    const value = argv[++i]; ensure(value !== undefined && !value.startsWith('--'), `Missing value for ${flag}.`); options[key] = value;
  }
  if (options.help) return options;
  for (const key of ['frames', 'fps', 'out']) ensure(options[key] !== undefined, `Missing --${key}.`);
  for (const key of ['fps', 'start', 'end', ...Object.keys(DEFAULTS)]) if (options[key] !== undefined) options[key] = Number(options[key]);
  ensure(options.only === undefined || ['gif', 'mp4'].includes(options.only), '--only must be gif or mp4.');
  options.formats = options.only ? [options.only] : ['gif', 'mp4'];
  ensure([24, 25, 30, 50, 60].includes(options.fps), '--fps must be 24, 25, 30, 50 or 60.');
  ensure(Number.isInteger(options['gif-fps']) && options['gif-fps'] >= 5 && options['gif-fps'] <= options.fps && options.fps % options['gif-fps'] === 0,
    '--gif-fps must divide the capture rate evenly so no frame is held twice (e.g. 10, 15 or 30 for 30 fps).');
  for (const key of ['gif-width', 'mp4-width']) ensure(Number.isInteger(options[key]) && options[key] % 2 === 0 && options[key] >= 240 && options[key] <= 1920, `--${key} must be an even width from 240 to 1920.`);
  ensure(Number.isInteger(options['gif-colors']) && options['gif-colors'] >= 16 && options['gif-colors'] <= 256, '--gif-colors must be 16–256.');
  ensure(Number.isInteger(options['mp4-crf']) && options['mp4-crf'] >= 18 && options['mp4-crf'] <= 36, '--mp4-crf must be 18–36.');
  for (const key of ['max-gif-mb', 'max-mp4-mb']) ensure(options[key] > 0 && options[key] <= 50, `--${key} must be in (0, 50].`);
  ensure(!/\.[a-z0-9]+$/i.test(options.out), '--out is a path stem; .gif, .mp4 and -preview.json are added.');
  options.start ??= 0;
  ensure(Number.isFinite(options.start) && options.start >= 0 && (options.end === undefined || (Number.isFinite(options.end) && options.end > options.start)), 'Use 0 ≤ --start < --end seconds.');
  return options;
}

async function frameSequence(folder) {
  const names = (await readdir(folder)).filter(name => /^\d{5,6}\.(jpg|png)$/.test(name)).sort();
  ensure(names.length > 0, 'No numbered frames (00000.jpg or 000000.png) were found.');
  const digits = names[0].length - 4, ext = names[0].slice(-3);
  ensure(names.every((name, i) => name === `${String(i).padStart(digits, '0')}.${ext}`), 'Frames must be one contiguous numbered sequence from zero with one extension.');
  return { pattern: join(folder, `%0${digits}d.${ext}`), count: names.length };
}

function run(binary, args) {
  const result = spawnSync(binary, args, { cwd: projectRoot, windowsHide: true, encoding: 'utf8', maxBuffer: 64 * MB });
  ensure(!result.error && result.status === 0, `${binary} failed: ${result.error?.message || result.stderr.trim().split('\n').slice(-3).join(' ')}`);
  return result;
}
const probe = path => JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=width,height,nb_read_frames,codec_name:format=duration', '-of', 'json', path]).stdout);

export async function encodeReadmePreview(options) {
  const framesPath = await checkedPath(options.frames), stemPath = await checkedPath(options.out, { output: true });
  const gifPath = `${stemPath}.gif`, mp4Path = `${stemPath}.mp4`, reportPath = `${stemPath}-preview.json`, formats = options.formats ?? ['gif', 'mp4'];
  for (const path of [...formats.map(format => `${stemPath}.${format}`), reportPath]) {
    ensure(relative(framesPath, path).startsWith('..'), 'Outputs cannot be written into the frame folder.');
    if (!options.overwrite) { let exists = true; try { await stat(path); } catch { exists = false; } ensure(!exists, `${relative(projectRoot, path)} already exists; pass --overwrite to replace it.`); }
  }
  const { pattern, count } = await frameSequence(framesPath);
  const first = Math.round(options.start * options.fps), last = options.end === undefined ? count : Math.round(options.end * options.fps);
  ensure(last <= count && last - first >= options.fps / options['gif-fps'], `The excerpt needs frames ${first}–${last - 1}; ${count} exist.`);
  const frames = last - first, input = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-framerate', String(options.fps), '-start_number', String(first), '-i', pattern, '-frames:v', String(frames)];
  await mkdir(dirname(stemPath), { recursive: true });
  // Bound the excerpt first (-frames:v only limits output), then keep every
  // n-th frame (an exact divisor) so motion stays evenly spaced. The palette is
  // built from frame differences.
  const step = options.fps / options['gif-fps'];
  if (formats.includes('gif')) run('ffmpeg', [...input, '-vf', `trim=end_frame=${frames},select='not(mod(n\\,${step}))',setpts=N/${options['gif-fps']}/TB,scale=${options['gif-width']}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=${options['gif-colors']}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    '-r', String(options['gif-fps']), '-loop', '0', gifPath]);
  if (formats.includes('mp4')) run('ffmpeg', [...input, '-vf', `scale=${options['mp4-width']}:-2:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(options['mp4-crf']),
    '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', '-r', String(options.fps), mp4Path]);
  const describe = async (path, limitMb) => {
    const bytes = await readFile(path), info = probe(path), stream = info.streams[0];
    return { file: relative(projectRoot, path).split(sep).join('/'), bytes: bytes.length, megabytes: Number((bytes.length / MB).toFixed(3)), limitMegabytes: limitMb, withinLimit: bytes.length <= limitMb * MB,
      sha256: hash(bytes), codec: stream.codec_name, width: stream.width, height: stream.height, frames: Number(stream.nb_read_frames), durationSeconds: Number(Number(info.format.duration).toFixed(3)) };
  };
  const gif = formats.includes('gif') ? { ...await describe(gifPath, options['max-gif-mb']), fps: options['gif-fps'], colors: options['gif-colors'], loop: 'forever' } : null;
  const mp4 = formats.includes('mp4') ? { ...await describe(mp4Path, options['max-mp4-mb']), crf: options['mp4-crf'], audio: false } : null;
  const report = { schemaVersion: 1, tool: 'tools/video/readme-preview.mjs', source: { frames: relative(projectRoot, framesPath).split(sep).join('/'), fps: options.fps, firstFrame: first, frameCount: frames, seconds: frames / options.fps },
    ...(gif && { gif }), ...(mp4 && { mp4 }), passed: [gif, mp4].every(item => !item || item.withinLimit), visuallyReviewed: false,
    note: 'Size and decode checks only. Review the GIF at its README display width for strobing teeth, label legibility and credit before publishing.' };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  ensure(!gif || gif.withinLimit, `GIF is ${gif?.megabytes} MB (limit ${options['max-gif-mb']} MB): shorten with --start/--end, lower --gif-fps or --gif-width.`);
  ensure(!mp4 || mp4.withinLimit, `MP4 is ${mp4?.megabytes} MB (limit ${options['max-mp4-mb']} MB): raise --mp4-crf or lower --mp4-width.`);
  return report;
}

export const help = `Usage: node tools/video/readme-preview.mjs --frames <project-relative-folder> --fps 30 --out <output/stem> [--start s] [--end s] [--only gif|mp4]
  [--gif-width 800] [--gif-fps 15] [--gif-colors 128] [--mp4-width 1280] [--mp4-crf 28] [--max-gif-mb 8] [--max-mp4-mb 4] [--overwrite]
Writes <stem>.gif, <stem>.mp4 (silent) and <stem>-preview.json inside an output directory.`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parsePreviewArguments(process.argv.slice(2));
    if (options.help) console.log(help);
    else { const report = await encodeReadmePreview(options); console.log(JSON.stringify({ gif: report.gif ?? null, mp4: report.mp4 ?? null, passed: report.passed }, null, 2)); }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
