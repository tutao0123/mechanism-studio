import { randomBytes, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { checkedPath, jpegDimensions, parseArguments, projectRoot } from '../video/export.mjs';
import { buildScore } from '../../scripts/build-audio.mjs';
import { snapshotRenderer } from './fingerprints.mjs';

const PREFIX = '/__studio/';
const MAX_FRAME_BYTES = 8 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ensure = (value, message) => { if (!value) throw new Error(message); };
const json = (response, status, value) => response.writeHead(status, {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
}).end(JSON.stringify(value));

export function validateFilm(entry) {
  const film = entry?.export;
  ensure(film, 'This example is preview-only; it has no registered direct-frame export adapter.');
  ensure(/^[a-z][a-z0-9-]*$/.test(entry.id), 'Invalid registered example ID.');
  const count = film.duration * film.fps;
  parseArguments(['--frames', 'output/studio/frames', '--audio', film.audioPath, '--out', 'output/studio/film.mp4',
    '--fps', String(film.fps), '--frame-count', String(count), '--width', String(film.width), '--height', String(film.height), '--title', entry.title]);
  ensure(typeof film.apiName === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(film.apiName), 'Invalid renderer API.');
  ensure(typeof film.renderPath === 'string' && /^\/[a-z0-9/-]+\.html$/.test(film.renderPath), 'Invalid registered renderer route.');
  ensure(Number.isFinite(film.reviewTime) && film.reviewTime > 0 && film.reviewTime < film.duration, 'A registered review frame is required.');
  const region = film.staticRegion;
  ensure(region && ['x','y','width','height'].every(key => Number.isSafeInteger(region[key]) && region[key] >= 0)
    && region.width > 0 && region.height > 0 && region.x + region.width <= film.width && region.y + region.height <= film.height, 'A valid static landmark region is required.');
  return { ...film, frameCount: count };
}

async function readBody(request, max) {
  const pieces = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > max) throw new Error('Request body exceeds the allowed size.');
    pieces.push(chunk);
  }
  return Buffer.concat(pieces);
}

function checkTools() {
  for (const tool of ['ffmpeg', 'ffprobe']) {
    const result = spawnSync(tool, ['-version'], { cwd: projectRoot, windowsHide: true, encoding: 'utf8', timeout: 10000 });
    ensure(!result.error && result.status === 0, `${tool} is required on PATH for export. Preview remains available without it.`);
  }
}

export async function runEncodeProcess(jobPath, onStage) {
  const job = JSON.parse(await readFile(await checkedPath(jobPath, { output: true }), 'utf8'));
  const temp = await checkedPath(`${job.outputDirectory}/tmp`, { output: true });
  await mkdir(temp, { recursive: true });
  const child = spawn(process.execPath, [fileURLToPath(new URL('./encode-job.mjs', import.meta.url)), jobPath], {
    cwd: projectRoot, windowsHide: true, env: { ...process.env, TMP: temp, TEMP: temp, TMPDIR: temp }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', errors = '', line = '';
  child.stdout.on('data', bytes => {
    output += bytes; line += bytes;
    for (;;) { const end = line.indexOf('\n'); if (end < 0) break;
      const message = line.slice(0, end); line = line.slice(end + 1);
      try { const item = JSON.parse(message); if (item.studioStage) onStage(item.studioStage); } catch { /* Encoder's formatted report is also retained. */ }
    }
  });
  child.stderr.on('data', bytes => { errors += bytes; });
  const code = await new Promise((accept, reject) => { child.once('error', reject); child.once('close', accept); });
  await writeFile(await checkedPath(`${job.outputDirectory}/encoding.log`, { output: true }), output + errors);
  ensure(code === 0, 'Export checks failed. Review the retained encoding.log and reports; no successful delivery is claimed.');
  return JSON.parse(await readFile(await checkedPath(`${job.outputDirectory}/delivery.json`, { output: true }), 'utf8'));
}

/** A local, browser-assisted direct-frame job. No browser automation dependency,
 * desktop recording, arbitrary file endpoint, upload service or global install. */
export async function exportExample(entry, { port = 0, checkDependencies = true, prepareAudio = true, encode = runEncodeProcess } = {}) {
  const film = validateFilm(entry);
  ensure(Number.isInteger(port) && port >= 0 && port <= 65535, 'Invalid export port.');
  if (checkDependencies) checkTools();
  if (prepareAudio && entry.audio) await buildScore(entry.audio);
  const audio = await checkedPath(film.audioPath);
  ensure((await stat(audio)).isFile(), 'The declared original score is missing.');
  const nonce = randomBytes(32).toString('hex');
  const id = `${entry.id}-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomBytes(4).toString('hex')}`;
  const outputDirectory = `output/studio/${id}`;
  const folder = await checkedPath(outputDirectory, { output: true });
  await mkdir(folder, { recursive: true });
  await checkedPath(outputDirectory, { output: true });
  await mkdir(resolve(folder, 'frames'));
  const job = { schemaVersion: 1, id, example: entry.id, title: entry.title, createdAt: new Date().toISOString(),
    outputDirectory, film, audioSha256: hash(await readFile(audio)), rendererSnapshot: await snapshotRenderer(entry), capture: null,
    method: 'Browser-assisted direct frame composition, followed by local FFmpeg encoding. No screen recording.' };
  const jobPath = `${outputDirectory}/job.json`;
  const status = { stage: 'ready', frames: 0, frameCount: film.frameCount, error: null, outputDirectory, delivery: null };
  let busy = false, origin, childPromise;
  const server = await entry.preview.createServer();
  const readers = server.listeners('request'); server.removeAllListeners('request');
  const save = async () => writeFile(await checkedPath(jobPath, { output:true }), JSON.stringify(job, null, 2)+'\n');
  let statusWrites = Promise.resolve();
  const saveStatus = () => {
    const bytes = JSON.stringify({ ...status, updatedAt:new Date().toISOString() }, null, 2)+'\n';
    statusWrites = statusWrites.then(async () => writeFile(await checkedPath(`${outputDirectory}/status.json`, { output:true }), bytes));
    return statusWrites;
  };
  await save();
  await saveStatus();
  const authorize = request => request.headers.origin === origin && request.headers['x-studio-session'] === nonce;
  server.on('request', async (request, response) => {
    try {
      if (request.headers.host !== new URL(origin).host) return json(response, 403, { error: 'Unexpected local host.' });
      const path = new URL(request.url, origin).pathname;
      if (!path.startsWith(PREFIX)) {
        if (!['GET','HEAD'].includes(request.method)) return json(response, 405, { error: 'Read-only preview.' });
        for (const reader of readers) reader.call(server, request, response);
        return;
      }
      if (request.method === 'GET') {
        if (path === `${PREFIX}config`) return json(response, 200, { title: entry.title, nonce, film, outputDirectory });
        if (path === `${PREFIX}status`) return json(response, 200, status);
        const owned = new Map([
          [PREFIX, new URL('./workbench.html', import.meta.url)],
          [`${PREFIX}workbench.mjs`, new URL('./workbench.mjs', import.meta.url)],
        ]);
        if (owned.has(path)) {
          response.writeHead(200, { 'Content-Type': path.endsWith('.mjs') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff',
            'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'self'; connect-src 'self'; frame-ancestors 'none'" });
          return response.end(await readFile(owned.get(path)));
        }
        if (path === `${PREFIX}film.mp4` && status.stage === 'complete') {
          const bytes = await readFile(await checkedPath(`${outputDirectory}/film.mp4`, { output: true }));
          const headers = { 'Content-Type':'video/mp4', 'Accept-Ranges':'bytes', 'Content-Disposition':`inline; filename="${entry.id}.mp4"` };
          if (request.headers.range) {
            const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
            const start = range ? Number(range[1]) : -1, end = range?.[2] ? Math.min(Number(range[2]),bytes.length-1) : bytes.length-1;
            if (!Number.isSafeInteger(start) || start < 0 || start > end || start >= bytes.length) {
              response.writeHead(416, { 'Content-Range':`bytes */${bytes.length}` }); return response.end();
            }
            response.writeHead(206, { ...headers, 'Content-Length':end-start+1, 'Content-Range':`bytes ${start}-${end}/${bytes.length}` }); return response.end(bytes.subarray(start,end+1));
          }
          response.writeHead(200, { ...headers, 'Content-Length':bytes.length }); return response.end(bytes);
        }
        return json(response,404,{error:'Unknown export route.'});
      }
      if (request.method !== 'POST') return json(response,405,{error:'Method not supported.'});
      if (!authorize(request)) return json(response,403,{error:'Local export session required.'});
      if (busy) return json(response,409,{error:'A frame or command is already being processed.'});
      busy = true;
      try {
        if (path === `${PREFIX}start`) {
          ensure(status.stage === 'ready', 'This export job has already started. Start a new CLI job to retry.');
          ensure(request.headers['content-type'] === 'application/json', 'Expected JSON metadata.');
          const data = JSON.parse((await readBody(request, 256 * 1024)).toString('utf8'));
          ensure(data.reviewedCalibration === true, 'Review the two calibration frames before rendering.');
          ensure(data.capture && typeof data.capture === 'object' && !Array.isArray(data.capture), 'Renderer capture metadata is required.');
          job.capture = data.capture; job.calibrationConfirmed = true;
          status.stage = 'rendering'; await save(); await saveStatus(); return json(response,200,status);
        }
        const match = new RegExp(`^${PREFIX}frame/(\\d+)$`).exec(path);
        if (match) {
          ensure(status.stage === 'rendering', 'The job is not accepting frames.');
          const index = Number(match[1]);
          ensure(index === status.frames && index < film.frameCount, 'Frames must arrive once, in sequential order.');
          ensure(request.headers['content-type'] === 'image/jpeg', 'Expected JPEG frame bytes.');
          const bytes = await readBody(request, MAX_FRAME_BYTES), dimensions = jpegDimensions(bytes);
          ensure(dimensions.width === film.width && dimensions.height === film.height, 'Frame dimensions do not match the registered adapter.');
          const target = await checkedPath(`${outputDirectory}/frames/${String(index).padStart(5,'0')}.jpg`, { output:true });
          await writeFile(target, bytes, { flag:'wx' }); status.frames++;
          if (status.frames % 30 === 0 || status.frames === film.frameCount) await saveStatus();
          return json(response,200,{frames:status.frames});
        }
        if (path === `${PREFIX}finish`) {
          ensure(status.stage === 'rendering' && status.frames === film.frameCount, 'All registered frames must be received before encoding.');
          status.stage = 'checking-source';
          await saveStatus();
          childPromise = Promise.resolve().then(() => encode(jobPath, stage => { status.stage = stage; saveStatus().catch(()=>{}); })).then(async delivery => {
            status.delivery = delivery; status.stage = 'complete'; await saveStatus();
          }).catch(async error => { status.stage = 'failed'; status.error = error.message; await saveStatus(); });
          return json(response,202,status);
        }
        if (path === `${PREFIX}cancel`) {
          ensure(['ready','rendering'].includes(status.stage), 'Encoding has already started; wait for its report.');
          status.stage = 'cancelled'; await saveStatus(); return json(response,200,status);
        }
        return json(response,404,{error:'Unknown export command.'});
      } finally { busy = false; }
    } catch (error) { if (!response.headersSent) json(response,400,{error:error.message}); else response.end(); }
  });
  await new Promise((accept,reject) => {
    server.once('error',reject); server.listen(port,'127.0.0.1',()=>{server.off('error',reject); accept();});
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { server, url:origin+PREFIX, outputDirectory, status, completion:()=>childPromise };
}
