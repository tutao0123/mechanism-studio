import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreviewFileServer, isSafeUrlPath, listenPreview, studyRuntimeFile } from '../../shared/study/preview-server.mjs';

const exampleRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(exampleRoot, '../..');

// Keep source and example routes explicit; the shared runtime is declared once.
export function publicFile(path) {
  if (!isSafeUrlPath(path)) return null;
  if (path === '/' || path === '/index.html') return resolve(exampleRoot, 'index.html');
  if (/^\/(?:app|story|motion|framing|annotations)\.mjs$/.test(path) || path === '/README.md' || path === '/plan.json') return resolve(exampleRoot, path.slice(1));
  if (/^\/assets\/(?:assembly\.glb|scene-index\.json|scene-contract\.json|source-assembly\.json|build-report\.json|LICENSE)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/source\/(?:provenance\.json|NOTICE\.md|LICENSE|README\.md)$/.test(path) || /^\/audio\/(?:music-score\.json|showcase-loop\.wav)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  return studyRuntimeFile(path, projectRoot);
}

export function createHandServer() {
  return createPreviewFileServer({ projectRoot, publicFile });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  listenPreview(createHandServer(), { defaultPort: 4185, label: 'Allegro Hand study' });
}
