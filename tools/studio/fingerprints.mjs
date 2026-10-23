import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { checkedPath, projectRoot } from '../video/export.mjs';

// These roots are reviewed registry constants. Neither CLI text nor browser
// metadata is treated as a path to scan. Audio bytes have their own fingerprint.
const EXAMPLE_ROOTS = Object.freeze({
  'planetary-gears': 'examples/planetary-gears',
  'robot-joint': 'examples/robot-joint',
  gearbox: 'examples/gearbox',
  'gearbox-cinematic': 'examples/gearbox',
});
const RUNTIME_ROOTS = Object.freeze([
  'shared/viewer', 'shared/animation', 'shared/study', 'shared/presentation',
  'shared/assets', 'shared/appearance',
  'node_modules/three/build', 'node_modules/three/examples/jsm', 'node_modules/three/src',
]);
const FIXED_FILES = Object.freeze(['showcase/camera-director.mjs', 'node_modules/three/package.json', 'package-lock.json']);
const EXTENSIONS = new Set(['.mjs', '.js', '.json', '.glb', '.css', '.html', '.svg', '.png', '.jpg', '.woff2']);
const SKIP_DIRECTORIES = new Set(['tests', 'test', 'output', 'validation', 'source', 'audio', 'shots', 'coverage']);
const PRIVATE_NAME = /(?:^|[._-])(?:secrets?|credentials?|passwords?|tokens?|api[-_]?keys?)(?:$|[._-])/i;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ordered = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/** Pin the renderer source/assets for one registered export adapter. This is a
 * conservative dependency superset, not automatic JS dependency discovery.
 * No linked file/directory is followed. A fixture or unregistered entry returns
 * null rather than allowing its ID to select arbitrary filesystem content.
 * The optional root supports isolated project-local regression fixtures. */
export async function snapshotRenderer(entry, { root = projectRoot } = {}) {
  if (!entry || !Object.hasOwn(EXAMPLE_ROOTS, entry.id)) return null;
  const exampleRoot = EXAMPLE_ROOTS[entry.id];
  const files = [];
  const checkedAncestors = new Set();
  async function checkAncestors(path) {
    const components = path.split('/');
    for (let length = 1; length < components.length; length++) {
      const ancestor = components.slice(0, length).join('/');
      if (checkedAncestors.has(ancestor)) continue;
      let info;
      try { info = await lstat(await checkedPath(ancestor, { root })); }
      catch (error) { if (error.code === 'ENOENT') return; throw error; }
      if (info.isSymbolicLink()) throw new Error(`Renderer fingerprint refuses linked input: ${ancestor}`);
      checkedAncestors.add(ancestor);
    }
  }
  async function readTarget(path, { optional = false } = {}) {
    await checkAncestors(path);
    const target = await checkedPath(path, { root });
    let info;
    try { info = await lstat(target); }
    catch (error) { if (optional && error.code === 'ENOENT') return; throw error; }
    if (info.isSymbolicLink()) throw new Error(`Renderer fingerprint refuses linked input: ${path}`);
    if (info.isDirectory()) {
      for (const item of (await readdir(target, { withFileTypes: true })).sort((a, b) => ordered(a.name, b.name))) {
        if (item.name.startsWith('.') || PRIVATE_NAME.test(item.name)) continue;
        if (item.isDirectory() && SKIP_DIRECTORIES.has(item.name)) continue;
        if (item.isFile() && (!EXTENSIONS.has(extname(item.name).toLowerCase()) || /\.test\.(?:mjs|js)$/.test(item.name))) continue;
        await readTarget(`${path}/${item.name}`);
      }
      return;
    }
    if (!info.isFile()) throw new Error(`Renderer fingerprint expects an ordinary file: ${path}`);
    if (!EXTENSIONS.has(extname(path).toLowerCase()) || PRIVATE_NAME.test(basename(path))) return;
    const bytes = await readFile(target);
    files.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  }
  await readTarget(exampleRoot);
  for (const path of RUNTIME_ROOTS) await readTarget(path, { optional: true });
  for (const path of FIXED_FILES) await readTarget(path);
  files.sort((a, b) => ordered(a.path, b.path));
  return {
    schemaVersion: 1, example: entry.id,
    scope: 'Registered renderer, display assets and conservative shared runtime dependencies. Audio is fingerprinted separately; source STEP and generated output are excluded.',
    files, fileCount: files.length, bytes: files.reduce((total, file) => total + file.bytes, 0),
    sha256: hash(files.map(file => `${file.path}\0${file.bytes}\0${file.sha256}\n`).join('')),
  };
}
