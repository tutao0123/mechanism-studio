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
  if (path === '/tour-v4/' || path === '/tour-v4/index.html') return resolve(exampleRoot, 'tour-v4/index.html');
  if (/^\/tour-v4\/(?:app\.mjs|story\.mjs|pair-layer\.mjs|direction-cues\.mjs|tooth-phase\.mjs|tooth-data\.json|README\.md|review\.html|plan\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/tour-v4\/output\/wolf-pair-cues-86s-v4(?:\.mp4|-contact-sheet\.jpg)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (path === '/tour-v3/' || path === '/tour-v3/index.html') return resolve(exampleRoot, 'tour-v3/index.html');
  if (/^\/tour-v3\/(?:app\.mjs|story\.mjs|framing\.mjs|README\.md|review\.html|plan\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/tour-v3\/output\/wolf-mesh-closeup-86s-v3(?:\.mp4|-contact-sheet\.jpg)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (path === '/tour-v2/' || path === '/tour-v2/index.html') return resolve(exampleRoot, 'tour-v2/index.html');
  if (/^\/tour-v2\/(?:app\.mjs|story\.mjs|framing\.mjs|annotations\.mjs|kinematics\.mjs|gearing\.mjs|bearings\.mjs|bearing-data\.mjs|README\.md|review\.html|music-score\.json|plan\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (path === '/tour-v2/audio/tour-loop.wav') return resolve(exampleRoot, path.slice(1));
  if (/^\/tour-v2\/output\/wolf-motion-86s-v2(?:\.mp4|-contact-sheet\.jpg)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/tour\/research-v2\/(?:gear-evidence|bearing-evidence|audit-transmission)\.md$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (path === '/detail/' || path === '/detail/index.html') return resolve(exampleRoot, 'detail/index.html');
  if (/^\/detail\/(?:app\.mjs|story\.mjs|framing\.mjs|annotations\.mjs|README\.md)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/detail\/(?:music-score|plan)\.json$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (path === '/detail/audio/motor-loop.wav') return resolve(exampleRoot, path.slice(1));
  if (path === '/bearing/' || path === '/bearing/index.html') return resolve(exampleRoot, 'bearing/index.html');
  if (/^\/bearing\/(?:app\.mjs|story\.mjs|framing\.mjs|annotations\.mjs|README\.md|review\.html)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/bearing\/(?:music-score|plan)\.json$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (path === '/bearing/audio/bearing-loop.wav') return resolve(exampleRoot, path.slice(1));
  if (/^\/bearing\/output\/wolf-bearing-34s-v1(?:\.mp4|-contact-sheet\.jpg)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (path === '/tour/' || path === '/tour/index.html') return resolve(exampleRoot, 'tour/index.html');
  if (/^\/tour\/(?:app\.mjs|story\.mjs|framing\.mjs|annotations\.mjs|kinematics\.mjs|README\.md|motion-evidence\.md|review\.html)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/tour\/(?:music-score|plan|motion-evidence)\.json$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (path === '/tour/audio/tour-loop.wav') return resolve(exampleRoot, path.slice(1));
  if (/^\/tour\/output\/wolf-complete-69s-v1(?:\.mp4|-contact-sheet\.jpg)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/(?:app\.mjs|story\.mjs|framing\.mjs|annotations\.mjs|README\.md)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/assets\/(?:assembly\.glb|scene-contract\.json|assembly-manifest\.json|scene-index\.json|import-report\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/audio\/(?:wolf-loop\.wav|music-score\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/planning\/[a-z-]+\.json$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (path === '/output/wolf-34s-v2.mp4' || path === '/output/wolf-34s-v2-contact-sheet.jpg') return resolve(exampleRoot, path.slice(1));
  if (path === '/detail/review.html' || path === '/detail/output/wolf-motor-34s-v1.mp4' || path === '/detail/output/wolf-motor-34s-v1-contact-sheet.jpg') return resolve(exampleRoot, path.slice(1));
  if (path === '/detail/output/wolf-motor-34s-v2.mp4' || path === '/detail/output/wolf-motor-34s-v2-contact-sheet.jpg') return resolve(exampleRoot, path.slice(1));
  if (path === '/detail/output/wolf-motor-34s-v3.mp4' || path === '/detail/output/wolf-motor-34s-v3-contact-sheet.jpg') return resolve(exampleRoot, path.slice(1));
  if (/^\/source\/(?:provenance\.json|LICENSE|NOTICE\.md|UPSTREAM-README\.md)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  return studyRuntimeFile(path, projectRoot);
}
export function createWolfServer() {
  return createPreviewFileServer({ projectRoot, publicFile });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  listenPreview(createWolfServer(), { defaultPort: 4181, label: 'WOLF showcase' });
}
