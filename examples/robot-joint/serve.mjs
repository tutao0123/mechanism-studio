import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createPreviewFileServer, isSafeUrlPath, listenPreview, studyRuntimeFile } from '../../shared/study/preview-server.mjs';
const exampleRoot = dirname(fileURLToPath(import.meta.url)), projectRoot = resolve(exampleRoot, '../..');
export function publicFile(path) {
  if (!isSafeUrlPath(path)) return null;
  if (path === '/' || path === '/index.html') return resolve(exampleRoot, 'index.html');
  if (/^\/(?:app|example|presentation|choreography|kinematics|bearing-kinematics|spec|render|inspect|bearing-cues)\.mjs$/.test(path) || ['/README.md','/render.html'].includes(path)) return resolve(exampleRoot,path.slice(1));
  if (/^\/assets\/(?:assembly\.glb|scene-index\.json|scene-contract\.json|provenance\.json|build-report\.json)$/.test(path)) return resolve(exampleRoot,path.slice(1));
  if (/^\/audio\/(?:joint-loop\.wav|music-score\.json)$/.test(path)) return resolve(exampleRoot,path.slice(1));
  return studyRuntimeFile(path, projectRoot);
}
export const createJointPreviewServer = () => createPreviewFileServer({ projectRoot, publicFile });
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) listenPreview(createJointPreviewServer(), { defaultPort: 4198, label: 'Original robot joint' });
