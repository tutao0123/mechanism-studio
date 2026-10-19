import { readFile, readdir, stat } from 'node:fs/promises';
import { relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

/** Static dependency walk of a served preview page, using the same publicFile
 * rule as its server. It follows what a browser loads before or while the page
 * runs: HTML script/style/media tags, the import map, ES imports and re-exports,
 * literal dynamic imports, CSS @import/url(), and two runtime conventions in
 * page modules: `fetch('literal')` and `somethingUrl: 'literal'` config fields,
 * which resolve against the document URL like fetch() does.
 *
 * It is a static check, not a browser: computed URLs are not followed, and a
 * clean result does not prove the page renders. Every problem names the
 * referring file so a missing server rule is found before a blank page. */

const ABSOLUTE = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
const MODULE = /\.(?:mjs|js)$/, STYLE = /\.css$/, PAGE = /\.html$/;
// Import/export-from clauses never contain quotes, semicolons, parentheses or
// `=`, which keeps prose in comments and strings from matching.
const STATIC_IMPORT = /(?:^|[;\n}])\s*(?:import|export)\b[^'";()=]*?\bfrom\s*(['"])([^'"\n]+)\1/g;
const SIDE_EFFECT_IMPORT = /(?:^|[;\n])\s*import\s*(['"])([^'"\n]+)\1/g;
const DYNAMIC_IMPORT = /\bimport\(\s*(['"])([^'"\n]+)\1\s*\)/g;
const FETCH_LITERAL = /\bfetch\(\s*(['"])([^'"\n]+)\1/g;
const URL_FIELD = /\b[a-z][A-Za-z\d]*Url\s*:\s*(['"])([^'"\n]+)\1/g;
const CSS_IMPORT = /@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]+)\1/g;
const CSS_URL = /\burl\(\s*(['"]?)([^'")\s]+)\1\s*\)/g;
const TAG = /<(script|link|img|video|audio|source)\b([^>]*)>/gi;
const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

const matches = (pattern, text) => [...text.matchAll(pattern)].map(match => match[2]);
const attribute = (attributes, name) => new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(attributes)?.[2];

function importMapOf(html) {
  for (const [, attributes, body] of html.matchAll(INLINE_SCRIPT)) {
    if (attribute(attributes, 'type') === 'importmap') return JSON.parse(body).imports || {};
  }
  return {};
}

/** Resolve one specifier as the browser would; null for external/data URLs. */
function resolveSpecifier(specifier, base, importMap, bare) {
  if (ABSOLUTE.test(specifier)) return { external: true };
  if (/^(?:\/|\.\.?\/)/.test(specifier)) return { url: new URL(specifier, `http://page${base}`).pathname };
  if (!bare) return { url: new URL(specifier, `http://page${base}`).pathname };
  if (Object.hasOwn(importMap, specifier)) return { url: new URL(importMap[specifier], 'http://page/').pathname };
  const prefix = Object.keys(importMap).filter(key => key.endsWith('/') && specifier.startsWith(key)).sort((a, b) => b.length - a.length)[0];
  if (prefix) return { url: new URL(importMap[prefix] + specifier.slice(prefix.length), 'http://page/').pathname };
  return { unmapped: true };
}

/**
 * @param {object} options
 * @param {string} options.entry       Page URL path, e.g. '/detail/'.
 * @param {(path: string) => string | null} options.publicFile  The server rule.
 * @param {(file: string) => boolean} [options.optional]  Absolute files that
 *   may be served yet absent, such as gitignored local renders. Default: none.
 */
export async function collectPageGraph({ entry, publicFile, optional = () => false }) {
  const documentBase = entry;
  const seen = new Map(), problems = [], absent = [], external = new Set();
  let importMap = {};
  const queue = [{ url: entry, from: null, specifier: entry }];
  const enqueue = (from, specifier, base, { bare = false } = {}) => {
    const target = resolveSpecifier(specifier, base, importMap, bare);
    if (target.external) { external.add(specifier); return; }
    if (target.unmapped) { problems.push({ from, specifier, problem: 'unmapped-bare-specifier' }); return; }
    queue.push({ url: target.url, from, specifier });
  };
  while (queue.length) {
    const { url, from, specifier } = queue.shift();
    if (seen.has(url)) continue;
    const file = publicFile(url);
    seen.set(url, file);
    if (!file) { problems.push({ from, specifier, url, problem: 'not-served' }); continue; }
    let text;
    try {
      if (!MODULE.test(file) && !STYLE.test(file) && !PAGE.test(file)) { await stat(file); continue; }
      text = await readFile(file, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (optional(file)) absent.push({ from, url }); else problems.push({ from, specifier, url, problem: 'missing-file' });
      continue;
    }
    if (PAGE.test(file)) {
      importMap = { ...importMap, ...importMapOf(text) };
      for (const [, tag, attributes] of text.matchAll(TAG)) {
        const name = tag.toLowerCase();
        if (name === 'link' && !/\b(?:stylesheet|modulepreload|preload|icon)\b/i.test(attribute(attributes, 'rel') || '')) continue;
        for (const key of name === 'link' ? ['href'] : ['src', 'poster']) {
          const value = attribute(attributes, key); if (value) enqueue(url, value, url);
        }
      }
      for (const [, attributes, body] of text.matchAll(INLINE_SCRIPT)) {
        if (attribute(attributes, 'src') || attribute(attributes, 'type') === 'importmap') continue;
        scanModule(body, url, url);
      }
    } else if (MODULE.test(file)) scanModule(text, url, documentBase);
    else for (const specifier of [...matches(CSS_IMPORT, text), ...matches(CSS_URL, text)]) enqueue(url, specifier, url);
  }
  function scanModule(text, moduleUrl, fetchBase) {
    for (const pattern of [STATIC_IMPORT, SIDE_EFFECT_IMPORT, DYNAMIC_IMPORT]) {
      for (const specifier of matches(pattern, text)) enqueue(moduleUrl, specifier, moduleUrl, { bare: true });
    }
    // Vendored libraries compute their own URLs; only page and shared modules
    // declare runtime resources by literal convention.
    if (moduleUrl.startsWith('/vendor/')) return;
    for (const specifier of [...matches(FETCH_LITERAL, text), ...matches(URL_FIELD, text)]) enqueue(moduleUrl, specifier, fetchBase);
  }
  const files = [...seen].filter(([, file]) => file).map(([url, file]) => ({ url, file }));
  return { entry, files, problems, absent, external: [...external].sort() };
}

/** Served HTML pages under an example root, as URL paths ('/', '/detail/'). */
export async function servedPages(exampleRoot, publicFile) {
  const pages = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'output') continue;
      const path = `${directory}${sep}${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.html')) {
        const url = '/' + relative(exampleRoot, path).split(sep).join('/');
        const page = url.endsWith('/index.html') ? url.slice(0, -'index.html'.length) : url;
        if (publicFile(page)) pages.push(page);
      }
    }
  }
  await walk(exampleRoot);
  return pages.sort();
}

/** Predicate for files git ignores, i.e. local build products such as rendered
 * video or synthesized music. Outside a git checkout nothing is optional, so
 * the check stays strict rather than silently passing. */
export function gitIgnored(projectRoot) {
  return file => spawnSync('git', ['check-ignore', '-q', '--', file], { cwd: projectRoot }).status === 0;
}
