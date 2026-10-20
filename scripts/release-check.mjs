import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, realpath, lstat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, sep, isAbsolute, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Generated study scores are rebuilt with `npm run build:audio`, not shipped,
// which keeps the retained robot sources and GLBs inside the original budget.
export const releaseLimits = Object.freeze({ fileBytes: 95 * 1024 * 1024, totalBytes: 300 * 1024 * 1024 });
const slash = name => name.split(sep).join('/');
const inside = (root, name) => { const part = relative(root, name); return part !== '' && !isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`); };
const placeholder = value => !value || /^(?:your[_-]|replace[_-]|example(?:[_-]|$)|<[^>]*>|\$\{|process\.env\.|config\.|undefined$|null$)/i.test(value);
const testDummy = (name, value) => /(?:\.test\.mjs|\/self_test\.py)$/.test(name) && /^(?:mock(?:-|$)|bad$|id$|key$|not-a-real-credential$|do-not-keep$|\$\(echo not-executed\)$)/.test(value);
const credentialKey = '(?:(?:[A-Z][A-Z0-9_]*_)?(?:API_KEY|ACCESS_KEY|APP_ID|ACCESS_TOKEN|AUTH_TOKEN|SECRET|PASSWORD|TOKEN)|apiKey|appId|accessKey|accessToken|authToken|clientSecret|password)';
const textExtensions = new Set(['.md', '.mjs', '.js', '.py', '.ps1', '.json', '.toml', '.html', '.txt', '.yaml', '.yml', '.css', '.xml', '.urdf', '.xacro', '.step', '.stp', '.in', '.lock', '.svg']);
const binaryExtensions = new Set(['.glb', '.blend', '.f3d', '.stl', '.wav', '.mp3', '.png', '.jpg', '.jpeg', '.webp', '.pdf', '.ico']);

/** Findings contain paths and rule names only. Credential values are never returned. */
export function inspectReleaseFile(name, bytes, { mode = '100644' } = {}) {
  const failures = [];
  const fail = rule => failures.push(`${name}: ${rule}`);
  const privateDirectory = /(?:^|\/)(?:node_modules|\.tools|\.cache|\.codex|\.git|\.test-output|output|shots|\.vscode|\.idea|\.venv|venv|__pycache__|playwright-report|test-results|capture-v[^/]*)(?:\/|$)/;
  const privateFilename = /(?:^|\/)(?:\.env(?:\.[^/]*)?|credentials\.json|service-account[^/]*\.json|(?:Cookies|Login Data|History|Local State))$|\.(?:private|local)\.json$|\.(?:pem|key|p12|pfx|har|db|sqlite3?|log|tmp|mp4|webm|mov|mp3|blend|exe|dll|msi|zip|7z|tar|gz)$|\.blend\d+$|(?:^|\/)\.DS_Store$|(?:^|\/)Thumbs\.db$/i;
  if (privateDirectory.test(name) || (privateFilename.test(name) && !/(?:^|\/)\.env\.example$/.test(name)) || /^prototype-3d\/validation\/(?:reference-creo|references)\//.test(name)) fail('local/private or generated delivery material is in the release list');
  if (mode === '120000' || mode === '160000') fail('symbolic link or submodule is not allowed in the release list');
  if (bytes.length > releaseLimits.fileBytes) fail('file exceeds the 95 MiB release budget');
  const extension = extname(name).toLowerCase();
  const isText = textExtensions.has(extension) || /(?:^|\/)(?:LICENSE(?:\.[^/]*)?|NOTICE|\.gitignore|\.gitattributes|\.npmrc|\.env\.example)$/.test(name);
  // Animated GIFs are reviewed only as README previews in docs/media, where
  // GitHub renders them inline; MP4 deliveries stay local (blocked above).
  const readmeAnimation = extension === '.gif' && name.startsWith('docs/media/');
  if (!isText && !binaryExtensions.has(extension) && !readmeAnimation) fail('unreviewed file type; review its purpose before adding it to the release policy');
  // Scan all bytes, including GLB metadata and uncompressed binary strings, for
  // high-confidence key formats and paths. This is not a binary-format parser.
  const content = bytes.toString('utf8');
  if (/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/.test(content)
    || /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16})\b/.test(content)
    || /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{25,}\b/.test(content)
    || /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}\b/.test(content)
    || /https?:\/\/[^\s/@:]+:[^\s/@]+@/.test(content)) fail('possible embedded credential or authenticated URL; inspect locally');
  if (/[A-Za-z]:[/\\](?:Users[/\\](?!Public(?:[/\\]|$)|Default(?:[/\\]|$))[^/\\\s"']+|secrets(?:[/\\]|\b)|vault(?:[/\\]|\b)|projects[/\\]anatomy-lab(?:[/\\]|\b))/i.test(content)
    || /\/(?:Users|home)\/(?!example(?:\/|$)|user(?:\/|$)|<)[^/\s"']+\//.test(content)) fail('personal-machine or credential-store path remains');
  if (isText) {
    const literals = new RegExp(`(?:["']?${credentialKey}["']?)\\s*[:=]\\s*(["'])([^"'\\r\\n]*)\\1`, 'g');
    const environment = new RegExp(`^[ \\t]*(?:export[ \\t]+)?(${credentialKey})[ \\t]*=[ \\t]*([^\\r\\n#]*)`, 'gm');
    const values = [...content.matchAll(literals)].map(match => match[2]);
    values.push(...[...content.matchAll(environment)].map(match => match[2].trim().replace(/^(["'])(.*)\1$/, '$2')));
    if (/(?:^|\/)\.npmrc$/.test(name)) values.push(...[...content.matchAll(/(?:^|[:\s])(?:_authToken|_auth|_password)[ \t]*=[ \t]*([^\r\n#]+)/gm)].map(match => match[1].trim()));
    if (values.some(value => !placeholder(value) && !testDummy(name, value))) fail('possible literal credential assignment; inspect locally');
    if (/(?:authorization|x-api-key|x-api-access-key)["']?\s*:\s*["'](?:Bearer\s+)?[A-Za-z0-9_+/=-]{16,}["']/i.test(content)) fail('possible literal authentication header; inspect locally');
    if (/^examples\/[^/]+\/source\/provenance\.json$/.test(name)) {
      try {
        const policy = JSON.parse(content);
        if (policy.redistribution === 'not-authorized' || (policy.sourceType === 'user-provided' && policy.redistribution !== 'authorized')) fail('source is marked for local inspection without redistribution authorization; exclude its source and derivatives from release');
      } catch { fail('invalid source provenance JSON'); }
    }
  }
  return [...new Set(failures)];
}

/** Candidate mode includes untracked nonignored files; staged mode scans index bytes. */
export async function checkRelease(root, { staged = false } = {}) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  const gitRoot = resolve(git(['rev-parse', '--show-toplevel']).trim());
  if (gitRoot.toLowerCase() !== root.toLowerCase()) throw new Error('Run in the independent Mechanism Studio Git repository.');
  const files = [...new Set(git(['ls-files', '--cached', ...(staged ? [] : ['--others', '--exclude-standard']), '-z']).split('\0').filter(Boolean))].sort();
  const modes = new Map(git(['ls-files', '--stage', '-z']).split('\0').filter(Boolean).map(row => { const [metadata, name] = row.split('\t'); return [name, metadata.split(' ')[0]]; }));
  const failures = [], entries = [];
  const actualRoot = await realpath(root);
  for (const name of files) {
    const absolute = resolve(root, name);
    if (!inside(root, absolute)) { failures.push(`${name}: path leaves the project`); continue; }
    let bytes, size, mode = modes.get(name) ?? '100644';
    if (staged) {
      if (mode === '120000' || mode === '160000') { failures.push(`${name}: symbolic link or submodule is not allowed in the release list`); continue; }
      size = Number(git(['cat-file', '-s', `:${name}`]).trim());
      if (size > releaseLimits.fileBytes) { failures.push(`${name}: file exceeds the 95 MiB release budget`); entries.push({ path: name, bytes: size, sha256: null }); continue; }
      bytes = execFileSync('git', ['cat-file', 'blob', `:${name}`], { cwd: root, maxBuffer: 128 * 1024 * 1024 });
    } else {
      let stat;
      try { stat = await lstat(absolute); } catch { failures.push(`${name}: tracked file is missing; stage its removal or restore it`); continue; }
      if (stat.isSymbolicLink() || !inside(actualRoot, await realpath(absolute))) { failures.push(`${name}: linked or out-of-root file`); continue; }
      if (!stat.isFile()) { failures.push(`${name}: release entry is not a regular file`); continue; }
      size = stat.size;
      if (size > releaseLimits.fileBytes) { failures.push(`${name}: file exceeds the 95 MiB release budget`); entries.push({ path: name, bytes: size, sha256: null }); continue; }
      bytes = await readFile(absolute);
    }
    failures.push(...inspectReleaseFile(slash(name), bytes, { mode }));
    entries.push({ path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const totalBytes = entries.reduce((total, entry) => total + entry.bytes, 0);
  if (!files.length) failures.push('release list is empty');
  if (totalBytes > releaseLimits.totalBytes) failures.push(`release list exceeds the ${releaseLimits.totalBytes / (1024 * 1024)} MiB total budget`);
  const report = { generatedAt: new Date().toISOString(), project: 'mechanism-studio', mode: staged ? 'staged-index' : 'worktree-candidates', fileCount: files.length, totalBytes, limits: releaseLimits, files, entries, checksPassed: failures.length === 0, failures, publication: 'not-performed', ownLicense: 'MIT (third-party exceptions retain their own licenses)', note: 'Local deterministic preflight, not a proof that every possible secret or license issue has been found. Staged mode scans exact index bytes. Reports never include matched credential values.' };
  await mkdir(resolve(root, 'output'), { recursive: true });
  await writeFile(resolve(root, 'output/release-check.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

const invoked = process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (invoked) {
  if (process.argv.slice(2).some(value => value !== '--staged') || process.argv.filter(value => value === '--staged').length > 1) throw new Error('Usage: node scripts/release-check.mjs [--staged]');
  const report = await checkRelease(resolve(fileURLToPath(new URL('../', import.meta.url))), { staged: process.argv.includes('--staged') });
  console.log(JSON.stringify({ mode: report.mode, fileCount: report.fileCount, totalBytes: report.totalBytes, checksPassed: report.checksPassed, failures: report.failures, publication: report.publication, ownLicense: report.ownLicense }, null, 2));
  if (!report.checksPassed) process.exitCode = 1;
}
