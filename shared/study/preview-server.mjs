import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, extname, basename } from 'node:path';

/** Node-only preview support for isolated study examples. It is never served
 * itself. Each example keeps its own page rules; the shared runtime that every
 * study page loads is declared once here, so a new shared module cannot be
 * forgotten in one example's server. tests/preview-pages.test.mjs walks every
 * served page and fails on a missing entry or an entry no page uses. */
export const STUDY_RUNTIME_FILES = Object.freeze([
  'shared/viewer/viewer.mjs',
  'shared/viewer/scene.mjs',
  'shared/viewer/line-art.mjs',
  'shared/viewer/annotation-layout.mjs',
  'shared/viewer/spec-label.mjs',
  'shared/viewer/drafting.mjs',
  'showcase/camera-director.mjs',
  'shared/appearance/color-accents.mjs',
  'shared/appearance/mesh-color-layer.mjs',
  'shared/appearance/styles.mjs',
  'shared/study/study.mjs',
  'shared/study/shell.mjs',
  'shared/study/direct-frame.mjs',
  'shared/study/style.css',
  'shared/study/drafting.css',
  'shared/study/blueprint.css',
]);
const runtimeFiles = new Set(STUDY_RUNTIME_FILES);
const VENDOR_THREE = /^\/vendor\/three\/(?:build|src|examples\/jsm)\/[\w./-]+\.js$/;

export const PREVIEW_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.glb': 'model/gltf-binary', '.wav': 'audio/wav', '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.toml': 'text/plain; charset=utf-8',
});
// Extensionless license texts are plain text, never a download.
const TEXT_NAMES = new Set(['LICENSE', 'NOTICE']);

/** Reject traversal, backslashes, NUL and hidden segments before any rule runs. */
export function isSafeUrlPath(path) {
  return typeof path === 'string' && !path.includes('\\') && !path.includes('\0')
    && !path.split('/').some(part => part === '..' || part.startsWith('.'));
}

/** Map a URL path to the shared study runtime or the vendored Three.js build. */
export function studyRuntimeFile(path, projectRoot) {
  if (!isSafeUrlPath(path)) return null;
  if (runtimeFiles.has(path.slice(1))) return resolve(projectRoot, path.slice(1));
  if (VENDOR_THREE.test(path)) return resolve(projectRoot, 'node_modules', path.slice('/vendor/'.length));
  return null;
}

export function contentType(file) {
  return PREVIEW_TYPES[extname(file)] || (TEXT_NAMES.has(basename(file)) ? 'text/plain; charset=utf-8' : 'application/octet-stream');
}

function within(root, target) {
  const path = relative(root, target);
  return path && path !== '..' && !path.startsWith('..\\') && !path.startsWith('../') && !isAbsolute(path);
}

/** Read-only GET/HEAD server with byte ranges for media seeking. `publicFile`
 * maps a decoded URL path to an absolute file or null (403). Symlinks that leave
 * the project resolve outside `projectRoot` and are refused. */
export function createPreviewFileServer({ projectRoot, publicFile }) {
  return createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
      const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const candidate = publicFile(path);
      if (!candidate) { response.writeHead(403).end('Forbidden'); return; }
      const actual = await realpath(candidate), root = await realpath(projectRoot);
      if (!within(root, actual) || !(await stat(actual)).isFile()) { response.writeHead(403).end('Forbidden'); return; }
      const data = await readFile(actual), headers = { 'Content-Type': contentType(actual), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
      let body = data, status = 200;
      if (request.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        let start = 0, end = data.length - 1;
        if (match && (match[1] || match[2])) {
          if (match[1]) { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), end); }
          else start = Math.max(0, data.length - Number(match[2]));
        }
        if (!match || (!match[1] && !match[2]) || start > end || start >= data.length || (match[1] === '' && Number(match[2]) === 0)) {
          response.writeHead(416, { 'Content-Range': `bytes */${data.length}` }).end(); return;
        }
        body = data.subarray(start, end + 1); status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${data.length}`;
      }
      headers['Content-Length'] = body.length;
      response.writeHead(status, headers).end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(404).end('Not found'); }
  });
}

/** Start a preview from a CLI entry with the PORT override and loopback bind. */
export function listenPreview(server, { defaultPort, label }) {
  const port = Number(process.env.PORT || defaultPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid preview port');
  server.listen(port, '127.0.0.1', () => console.log(`${label}: http://127.0.0.1:${port}/`));
  return server;
}
