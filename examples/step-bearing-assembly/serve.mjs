import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createPreviewFileServer, isSafeUrlPath, listenPreview, studyRuntimeFile } from '../../shared/study/preview-server.mjs';
const exampleRoot = dirname(fileURLToPath(import.meta.url)), projectRoot = resolve(exampleRoot, '../..');
const sharedFiles = new Set(['/shared/cad/assembly.mjs', '/shared/cad/inspector.mjs', '/shared/cad/inspector.css']);
export function publicFile(path) {
  if (!isSafeUrlPath(path)) return null;
  if (path === '/' || path === '/index.html') return resolve(exampleRoot, 'index.html');
  if (path === '/app.mjs' || path === '/README.md') return resolve(exampleRoot, path.slice(1));
  if (/^\/assets\/(?:assembly\.glb|assembly-manifest\.json|scene-contract\.json|import-report\.json)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (/^\/source\/(?:provenance\.json|LICENSE\.txt|NOTICE\.md)$/.test(path)) return resolve(exampleRoot, path.slice(1));
  if (sharedFiles.has(path)) return resolve(projectRoot, path.slice(1));
  return studyRuntimeFile(path, projectRoot);
}
export const createStepBearingServer = () => createPreviewFileServer({ projectRoot, publicFile });
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) listenPreview(createStepBearingServer(), { defaultPort: 4194, label: 'STEP assembly inspector' });
