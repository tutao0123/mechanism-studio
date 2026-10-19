import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createPreviewFileServer, isSafeUrlPath, listenPreview, studyRuntimeFile } from '../../shared/study/preview-server.mjs';

const exampleRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(exampleRoot, '../..');
// Page-specific files only. The shared study runtime and vendored Three.js come
// from one declared list in shared/study/preview-server.mjs.
export function publicFile(path) {
  if (!isSafeUrlPath(path)) return null;
  if (path === '/' || path === '/index.html') return resolve(exampleRoot, 'index.html');
  if (path === '/review.html') return resolve(exampleRoot, 'review.html');
  if (path === '/render.html' || path === '/render.mjs') return resolve(exampleRoot, path.slice(1));
  if (path === '/cinematic/' || path === '/cinematic/index.html') return resolve(exampleRoot, 'cinematic/index.html');
  if (/^\/cinematic\/(?:app\.mjs|camera\.mjs|timeline\.mjs|renderer\.mjs|render\.html|render\.mjs|review\.html)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/cinematic\/audio\/(?:gearbox-cinematic-loop\.wav|music-score\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (path === '/blueprint/' || path === '/blueprint/index.html') return resolve(exampleRoot, 'blueprint/index.html');
  if (path === '/blueprint/app.mjs') return resolve(exampleRoot, 'blueprint/app.mjs');
  if (/^\/(?:app\.mjs|story\.mjs|framing\.mjs|annotations\.mjs|kinematics\.mjs|spec\.mjs|labels\.mjs|drafting-layer\.mjs|study-config\.mjs|README\.md)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/assets\/(?:gearbox\.glb|scene-contract\.json|scene-index\.json|build-report\.json|provenance\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/audio\/(?:gearbox-loop\.wav|music-score\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/planning\/[a-z-]+\.json$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/output\/gearbox-40s-v1(?:\.mp4|-contact-sheet\.jpg|-readme\.gif|-readme\.mp4)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/output\/gearbox-(?:40s-direct-v2|direct-preview)(?:\.mp4|-contact-sheet\.jpg)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/output\/gearbox-cinematic-24s-v1(?:\.mp4|-contact-sheet\.jpg)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  return studyRuntimeFile(path, projectRoot);
}
export function createGearboxServer() {
  return createPreviewFileServer({ projectRoot, publicFile });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  listenPreview(createGearboxServer(), { defaultPort: 4183, label: 'Gearbox showcase' });
}
