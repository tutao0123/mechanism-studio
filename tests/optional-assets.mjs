import { readFile } from 'node:fs/promises';

/** Public releases omit provider media. Local complete sets still get byte QA. */
export async function optionalAssetSet(urls) {
  const files = await Promise.all(urls.map(async url => {
    try { return await readFile(url); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }));
  const present = files.filter(Boolean).length;
  if (present === 0) return null;
  if (present !== files.length) throw new Error('Optional asset set is incomplete; restore all expected files or remove the entire optional set.');
  return files;
}
