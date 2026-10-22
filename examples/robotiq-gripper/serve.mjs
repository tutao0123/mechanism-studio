import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createPreviewFileServer, isSafeUrlPath, listenPreview, studyRuntimeFile } from '../../shared/study/preview-server.mjs';

const exampleRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(exampleRoot, '../..');

// Keep source and example routes explicit; the shared runtime is declared once.
export function publicFile(path) {
  if (!isSafeUrlPath(path)) return null;
  if (path === '/' || path === '/index.html') return resolve(exampleRoot, 'index.html');
  if (path === '/review.html') return resolve(exampleRoot, 'review.html');
  if (/^\/(?:app\.mjs|example\.mjs|presentation\.mjs|presentation-data\.mjs|story\.mjs|framing\.mjs|annotations\.mjs|kinematics\.mjs|README\.md)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/assets\/(?:assembly\.glb|scene-contract\.json|source-assembly\.json|scene-index\.json|build-report\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/audio\/(?:showcase-loop\.wav|music-score\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/planning\/[a-z-]+\.json$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (path === '/output/robotiq-gripper-36s-v1.mp4' || path === '/output/robotiq-gripper-36s-v1-contact-sheet.jpg') return resolve(exampleRoot, path.slice(1));
  if (/^\/source\/(?:provenance\.json|README\.md|NOTICE\.md)$/.test(path) || path === '/source/LICENSE') return resolve(exampleRoot, path.slice(1));
  return studyRuntimeFile(path, projectRoot);
}

export function createGripperServer() {
  return createPreviewFileServer({ projectRoot, publicFile });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  listenPreview(createGripperServer(), { defaultPort: 4186, label: 'Robotiq showcase' });
}
