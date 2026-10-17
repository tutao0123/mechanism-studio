import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set(['node_modules','output','shots','assets','source','validation']);
async function collect(directory) {
  let entries; try { entries = await readdir(join(root, directory), { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const found = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || ignored.has(entry.name) || entry.isSymbolicLink()) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await collect(path));
    else if (entry.name.endsWith('.test.mjs')) found.push(path);
  }
  return found;
}
const tests = ['model.test.mjs', ...await collect('shared'), ...await collect('tests'), ...await collect('examples'), ...await collect('EXAMPLE_ROBOT/tests'), ...await collect('EXAMPLE_ROBOT/kinetic/tests'), ...await collect('prototype-3d/tests'), ...await collect('prototype-3d/voice'), ...await collect('showcase'), ...await collect('tools/cad/tests'), ...await collect('tools/video')].sort();
const result = spawnSync(process.execPath, ['--test', ...tests], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status || 0;
