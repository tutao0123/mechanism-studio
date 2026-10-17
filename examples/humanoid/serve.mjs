import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, isAbsolute, extname } from 'node:path';

const exampleRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(exampleRoot, '../..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.toml': 'text/plain; charset=utf-8' };
function within(root, target) {
  const path = relative(root, target);
  return path && path !== '..' && !path.startsWith('..\\') && !path.startsWith('../') && !isAbsolute(path);
}
export function publicFile(path) {
  if (path.includes('\\') || path.includes('\0') || path.split('/').some(part => part === '..' || part.startsWith('.'))) return null;
  if (path === '/' || path === '/index.html') return resolve(exampleRoot, 'index.html');
  if (path === '/review.html') return resolve(exampleRoot, 'review.html');
  if (/^\/(?:app\.mjs|story\.mjs|framing\.mjs|annotations\.mjs|README\.md)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/assets\/(?:humanoid\.glb|scene-contract\.json|source-assembly\.json|scene-index\.json|build-report\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/audio\/(?:humanoid-loop\.wav|music-score\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/planning\/[a-z-]+\.json$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (path === '/output/humanoid-g1-36s-v1.mp4' || path === '/output/humanoid-g1-36s-v1-contact-sheet.jpg') return resolve(exampleRoot, path.slice(1));
  if (/^\/source\/(?:provenance\.json|README\.md|NOTICE\.md)$/.test(path) || path === '/source/unitree_g1/LICENSE') return resolve(exampleRoot, path.slice(1));
  if (/^\/shared\/viewer\/(?:viewer|scene|line-art|annotation-layout)\.mjs$/.test(path) || path === '/showcase/camera-director.mjs') return resolve(projectRoot, path.slice(1));
  if (path === '/shared/appearance/color-accents.mjs' || path === '/shared/appearance/mesh-color-layer.mjs') return resolve(projectRoot, path.slice(1));
  if (path === '/shared/study/study.mjs' || path === '/shared/study/shell.mjs' || path === '/shared/study/style.css') return resolve(projectRoot, path.slice(1));
  if (/^\/vendor\/three\/(?:build|src|examples\/jsm)\/[\w./-]+\.js$/.test(path)) return resolve(projectRoot, 'node_modules', path.slice('/vendor/'.length));
  return null;
}
export function createHumanoidServer() {
  return createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
      const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const candidate = publicFile(path);
      if (!candidate) { response.writeHead(403).end('Forbidden'); return; }
      const actual = await realpath(candidate), root = await realpath(projectRoot);
      if (!within(root, actual) || !(await stat(actual)).isFile()) { response.writeHead(403).end('Forbidden'); return; }
      const data = await readFile(actual), headers = { 'Content-Type': types[extname(actual)] || (actual.endsWith('LICENSE') ? 'text/plain; charset=utf-8' : 'application/octet-stream'), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
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
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4182);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid preview port');
  createHumanoidServer().listen(port, '127.0.0.1', () => console.log(`Humanoid showcase: http://127.0.0.1:${port}/`));
}

