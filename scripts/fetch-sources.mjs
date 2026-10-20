/** Download the upstream CAD, mesh and manual files that Git does not keep.
 *
 * scripts/upstream-sources.json pins every file to an upstream commit URL, byte
 * length and SHA-256; a download is accepted only if it matches. Licenses,
 * notices, model descriptions and provenance records stay in the repository.
 * Verified downloads are cached by hash in .cache/sources, so a re-run needs no
 * network. Viewing the examples does not need these files; tests, the CAD
 * audit and model rebuilds do.
 *
 *   node scripts/fetch-sources.mjs
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const SOURCES = Object.freeze(JSON.parse(await readFile(new URL('upstream-sources.json', import.meta.url), 'utf8')).files.map(Object.freeze));
const PINNED_URL = /^https:\/\/raw\.githubusercontent\.com\/[\w.-]+\/[\w.-]+\/[0-9a-f]{40}\/\S+$/;

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const readOptional = path => readFile(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
async function writeAtomic(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.partial`, bytes); await rename(`${path}.partial`, path);
}

export async function fetchSource(entry, { root = projectRoot, download = fetch } = {}) {
  const target = resolve(root, entry.path), inside = relative(root, target);
  if (!inside || isAbsolute(inside) || inside.startsWith('..')) throw new Error(`${entry.path}: outside the project.`);
  if (!PINNED_URL.test(entry.url)) throw new Error(`${entry.path}: URL is not pinned to an upstream commit.`);
  const matches = bytes => bytes?.length === entry.bytes && sha256(bytes) === entry.sha256;
  if (matches(await readOptional(target))) return 'present';
  const cached = resolve(root, '.cache/sources', entry.sha256);
  let bytes = await readOptional(cached);
  if (!matches(bytes)) {
    let response;
    for (let attempt = 1; ; attempt++) {
      try { response = await download(entry.url); if (response.ok || attempt === 2) break; }
      catch (error) { if (attempt === 2) throw new Error(`${entry.url}: ${error.cause?.message ?? error.message}`); }
    }
    if (!response.ok) throw new Error(`${entry.url}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (!matches(bytes)) throw new Error(`${entry.path}: the download does not match its pinned SHA-256 (${entry.url}).`);
    await writeAtomic(cached, bytes);
  }
  await writeAtomic(target, bytes);
  return 'fetched';
}

export async function fetchSources(entries = SOURCES, options = {}) {
  const queue = [...entries], counts = { present: 0, fetched: 0 }, failures = [];
  const worker = async () => {
    for (let entry; (entry = queue.shift());) {
      try { counts[await fetchSource(entry, options)]++; }
      catch (error) { failures.push(error.message); }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { counts, failures };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) throw new Error('Usage: node scripts/fetch-sources.mjs');
  // Behind an HTTPS proxy, Node's fetch uses it only with NODE_USE_ENV_PROXY
  // (Node 22.21+ and 24+). Re-run once with it rather than ask every caller.
  if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
    const rerun = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
    process.exit(rerun.status ?? 1);
  }
  const { counts, failures } = await fetchSources();
  for (const failure of failures) console.error(`FAILED  ${failure}`);
  console.log(`upstream sources: ${counts.present} present, ${counts.fetched} fetched, ${failures.length} failed (${SOURCES.length} pinned files)`);
  if (failures.length) process.exitCode = 1;
}
