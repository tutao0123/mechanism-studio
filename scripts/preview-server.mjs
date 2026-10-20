import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.glb': 'model/gltf-binary', '.blend': 'application/octet-stream', '.mp3': 'audio/mpeg', '.step': 'model/step', '.stp': 'model/step', '.txt': 'text/plain; charset=utf-8' };

function documentPage(name, content) {
  const escape = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  return Buffer.from(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>文档 · ${escape(name)}</title><style>body{margin:0;background:#fafafa;color:#222;font-family:system-ui,"Microsoft YaHei",sans-serif}main{max-width:1050px;padding:36px 24px;margin:auto}header{font-size:13px;color:#777;border-bottom:1px solid #ddd;padding-bottom:18px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:15px/1.9 system-ui,"Microsoft YaHei",sans-serif;background:#fff;border:1px solid #ddd;border-radius:8px;padding:26px}</style></head><body><main><header>本地文档 · ${escape(name)}</header><pre>${escape(content)}</pre></main></body></html>`);
}

export function isPublicPath(path) {
  if (path.split('/').some(part => part.startsWith('.')) || /\\|\0|(?:^|\/)\.\.(?:\/|$)/.test(path)) return false;
  if (/(?:\.private|\.local)\.json$|\.env(?:\.|$)/i.test(path)) return false;
  if (/^shared\/voice\/speech(?:-cli)?\.mjs$/.test(path)) return false; // Node-only API; no synthesis/credentials in a page.
  if (['index.html', 'index-dark.html', 'README.md', 'THIRD_PARTY_NOTICES.md', 'model.mjs', 'live.mjs', 'styles.css'].includes(path)) return true;
  if (/^docs\/[\w/-]+\.md$/.test(path)) return true;
  if (/^docs\/media\/[\w-]+\.(?:png|jpe?g|webp)$/.test(path)) return true;
  if (['examples/README.md', 'examples/lock-comparison/README.md', 'examples/lock-comparison/index.html'].includes(path)) return true;
  if (/^shots\/[\w/-]+\.(?:png|jpe?g)$/.test(path)) return true;
  if (/^output\/overview\.(?:json|md)$/.test(path)) return true;
  if (/^output\/engine-comparison\/[\w-]+\.md$/.test(path)) return true;
  if (/^comparisons\/inline-four\/(?:index\.html|style\.css|app\.mjs)$/.test(path)) return true;
  if (/^showcase\/(?:index\.html|style\.css|app\.mjs|timeline\.mjs|stories\.mjs|presentation\.mjs|camera-director\.mjs|README\.md)$/.test(path)) return true;
  if (/^showcase\/adapters\/(?:inline-four|turbofan|camera-envelope|quadruped|quadruped-framing)\.mjs$/.test(path)) return true;
  if (/^showcase\/voice\/(?:inline-four|turbofan|quadruped|quadruped-short)\/(?:lesson|durations)\.json$/.test(path)) return true;
  if (/^showcase\/voice\/(?:inline-four|turbofan|quadruped|quadruped-short)\/voice\/audio-manifest\.json$/.test(path)) return true;
  if (/^showcase\/voice\/(?:inline-four|turbofan|quadruped|quadruped-short)\/assets\/audio\/[\w-]+\.mp3$/.test(path)) return true;
  if (/^shared\/(?:viewer|voice|assets|animation)\/[\w-]+\.(?:mjs|md|css)$/.test(path)) return true;
  if (/^shared\/cad\/(?:assembly\.mjs|README\.md)$/.test(path)) return true;
  if (/^examples\/(?:inline-four|turbofan|quadruped|step-assembly)\/(?:index\.html|style\.css|app\.mjs|model\.mjs|process\.mjs|effects\.mjs|spec\.json|README\.md|design\.md)$/.test(path)) return true;
  if (/^examples\/(?:inline-four|turbofan|quadruped|step-assembly)\/assets\/[\w-]+\.(?:glb|blend|json|png|jpe?g)$/.test(path)) return true;
  if (/^examples\/(?:inline-four|turbofan|quadruped|step-assembly)\/assets\/audio\/[\w-]+\.mp3$/.test(path)) return true;
  if (/^examples\/(?:inline-four|turbofan|quadruped|step-assembly)\/voice\/(?:lesson|audio-manifest)\.json$/.test(path)) return true;
  if (/^examples\/step-assembly\/source\/[\w-]+\.(?:step|stp|json|md|txt)$/.test(path)) return true;
  if (/^prototype-3d\/(?:index\.html|style\.css|app\.mjs|controller\.mjs|line-art\.mjs|palettes\.mjs|README\.md)$/.test(path)) return true;
  if (/^prototype-3d\/(?:voice|blender)\/README\.md$/.test(path)) return true;
  if (/^prototype-3d\/voice\/(?:lesson|audio-manifest)\.json$/.test(path)) return true;
  if (/^prototype-3d\/assets\/(?:lock\.(?:glb|blend)|lock-preview\.png|audio\/[\w-]+\.mp3)$/.test(path)) return true;
  if (/^prototype-3d\/node_modules\/three\/(?:build|examples\/jsm|src)\/[\w./-]+\.js$/.test(path)) return true;
  if (/^node_modules\/three\/(?:build|examples\/jsm|src)\/[\w./-]+\.js$/.test(path)) return true;
  if (/^prototype-3d\/validation\/[\w-]+\.md$/.test(path)) return true;
  return false;
}

export function createPreviewServer(rootDirectory, { mounts = {}, redirects = {} } = {}) {
  const root = resolve(rootDirectory);
  return createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
      const url = new URL(request.url, 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').includes('..')) { response.writeHead(403); response.end('Forbidden'); return; }
      for (const [from, to] of Object.entries(redirects)) {
        if (pathname === from || (from.endsWith('/') && pathname.startsWith(from))) {
          response.writeHead(307, { Location: to + pathname.slice(from.length) + url.search }); response.end(); return;
        }
      }
      let fileRoot = root, route = pathname;
      for (const [prefix, mount] of Object.entries(mounts)) {
        if (pathname === '/' + prefix || pathname.startsWith('/' + prefix + '/')) {
          if (pathname === '/' + prefix) { response.writeHead(307, { Location: '/' + prefix + '/' + url.search }); response.end(); return; }
          fileRoot = resolve(root, mount); route = pathname.slice(prefix.length + 1); break;
        }
      }
      let relative = (route.endsWith('/') ? route + 'index.html' : route).replace(/^\/+/, '');
      let documentPreview = false;
      if (relative === 'skill') {
        const skillName = fileRoot.endsWith('anatomy-reference') ? 'anatomy' : 'mechanism-studio';
        relative = `.agents/skills/${skillName}/SKILL.md`;
        documentPreview = true;
      } else if (relative === 'document') {
        relative = url.searchParams.get('path') || '';
        if (!relative.endsWith('.md') || !isPublicPath(relative)) { response.writeHead(403); response.end('Forbidden'); return; }
        documentPreview = true;
      } else if (!isPublicPath(relative)) { response.writeHead(403); response.end('Forbidden'); return; }
      const candidate = resolve(fileRoot, relative);
      if (!candidate.startsWith(fileRoot + sep)) { response.writeHead(403); response.end('Forbidden'); return; }
      const [actualRoot, actualPath] = await Promise.all([realpath(fileRoot), realpath(candidate)]);
      if (!actualPath.startsWith(actualRoot + sep)) { response.writeHead(403); response.end('Forbidden'); return; }
      const source = await readFile(actualPath);
      const data = documentPreview ? documentPage(relative, source.toString('utf8')) : source;
      const headers = { 'Content-Type': documentPreview ? TYPES['.html'] : (TYPES[extname(actualPath)] || 'application/octet-stream'), 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' };
      let body = data, status = 200;
      if (request.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        let start = 0, end = data.length - 1;
        if (match && (match[1] || match[2])) {
          if (match[1]) { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), end); }
          else start = Math.max(0, data.length - Number(match[2]));
        }
        if (!match || (!match[1] && !match[2]) || start > end || start >= data.length || (match[1] === '' && Number(match[2]) === 0)) {
          response.writeHead(416, { 'Content-Range': `bytes */${data.length}` }); response.end(); return;
        }
        body = data.subarray(start, end + 1); status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${data.length}`;
      }
      headers['Content-Length'] = body.length;
      response.writeHead(status, headers); response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
}
