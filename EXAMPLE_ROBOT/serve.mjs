import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createPreviewFileServer, isSafeUrlPath, listenPreview, studyRuntimeFile } from '../shared/study/preview-server.mjs';

const exampleRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(exampleRoot, '..');
// Page-specific files only. The shared study runtime and vendored Three.js come
// from one declared list in shared/study/preview-server.mjs.
export function publicFile(path) {
  if (!isSafeUrlPath(path)) return null;
  if (path === '/' || path === '/index.html') return resolve(exampleRoot, 'index.html');
  if (path === '/kinetic/' || path === '/kinetic/index.html') return resolve(exampleRoot, 'kinetic/index.html');
  if (path === '/kinetic/review.html') return resolve(exampleRoot, 'kinetic/review.html');
  if (path === '/kinetic/output/so-arm102-kinetic-25s-v1.mp4') return resolve(exampleRoot, 'kinetic/output/so-arm102-kinetic-25s-v1.mp4');
  if (/^\/kinetic\/(?:app\.mjs|story\.mjs|framing\.mjs|annotations\.mjs|joints\.mjs|style\.css|README\.md)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/kinetic\/audio\/(?:kinetic-loop\.wav|music-score\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/(?:style\.css|app\.mjs|story\.mjs|framing\.mjs|annotations\.mjs|README\.md)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/assets\/(?:robot\.glb|scene-contract\.json|source-assembly\.json|build-report\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/audio\/(?:robot-loop\.wav|music-score\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/planning\/[a-z-]+\.json$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/source\/(?:provenance\.json|SOURCES\.md|NOTICE|DOCS-LICENSE\.txt|HARDWARE-LICENSE\.txt|LICENSING\.md|REUSE\.toml|LICENSES\/CC-BY-4\.0\.txt)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  return studyRuntimeFile(path, projectRoot);
}
export function createRobotServer() {
  return createPreviewFileServer({ projectRoot, publicFile });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  listenPreview(createRobotServer(), { defaultPort: 4180, label: 'Robot showcase' });
}
