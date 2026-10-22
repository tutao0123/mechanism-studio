import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createPreviewFileServer, isSafeUrlPath, listenPreview, studyRuntimeFile } from '../../shared/study/preview-server.mjs';
const exampleRoot = dirname(fileURLToPath(import.meta.url)), projectRoot = resolve(exampleRoot, '../..');
export function publicFile(path) {
  if (!isSafeUrlPath(path)) return null;
  if (path === '/' || path === '/index.html') return resolve(exampleRoot, 'index.html');
  if (path === '/render.html' || path === '/render.mjs' || path === '/review.html') return resolve(exampleRoot, path.slice(1));
  if (path === '/output/planetary-80parts-bearing-36s.mp4') return resolve(exampleRoot, path.slice(1));
  if (/^\/(?:app|example|presentation|choreography|kinematics|bearing-kinematics|bearing-cues|spec)\.mjs$/.test(path) || path === '/README.md') return resolve(exampleRoot, path.slice(1));
  if (/^\/assets\/(?:assembly\.glb|scene-index\.json|scene-contract\.json|provenance\.json|build-report\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/audio\/(?:planetary-loop\.wav|music-score\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  return studyRuntimeFile(path, projectRoot);
}
export const createPlanetaryServer = () => createPreviewFileServer({ projectRoot, publicFile });
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) listenPreview(createPlanetaryServer(), { defaultPort: 4193, label: 'Planetary gear study' });
