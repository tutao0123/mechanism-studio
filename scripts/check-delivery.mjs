/** Read-only integrity check. Declared review outcomes are not independently verified. */
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROUTES = new Set(['Inspect', 'Explain', 'Showcase']);
const ROLES = new Set(['input', 'evidence', 'artifact']);
const STATUSES = new Set(['passed', 'limited', 'not-run']);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const inside = (root, path) => {
  const suffix = relative(root, path);
  return suffix === '' || (!isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith(`..\\`) && !suffix.startsWith('../'));
};

function pathError(path) {
  if (!nonempty(path)) return 'must be a nonempty project-relative path';
  if (path.startsWith('/') || /[\\:\x00-\x1f\x7f<>"|?*]/.test(path)) return 'must use forward slashes, without absolute paths, URLs, or reserved characters';
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part))) return 'must not contain empty, dot, parent, or trailing-dot/space components';
  if (parts.some(part => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) return 'must not use a reserved Windows device name';
  return null;
}

function validate(manifest) {
  const errors = [];
  if (!plain(manifest)) return ['Manifest must be a JSON object.'];
  if (manifest.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  if (!nonempty(manifest.id)) errors.push('id must be a nonempty string.');
  if (!ROUTES.has(manifest.route)) errors.push('route must be Inspect, Explain, or Showcase.');
  if (!Array.isArray(manifest.files) || !manifest.files.length) errors.push('files must be a nonempty array.');
  const paths = new Set(), declarations = new Map();
  for (const [index, file] of (Array.isArray(manifest.files) ? manifest.files : []).entries()) {
    const label = `files[${index}]`;
    if (!plain(file)) { errors.push(`${label} must be an object.`); continue; }
    const invalidPath = pathError(file.path);
    if (invalidPath) errors.push(`${label}.path ${invalidPath}.`);
    else {
      // A manifest should behave the same on Windows and a case-sensitive clone.
      const key = file.path.toLowerCase();
      if (paths.has(key)) errors.push(`${label}.path duplicates a path (case-insensitive).`);
      paths.add(key);
      declarations.set(file.path, file);
    }
    if (!['repository', 'local'].includes(file.storage)) errors.push(`${label}.storage must be repository or local.`);
    if (!ROLES.has(file.role)) errors.push(`${label}.role must be input, evidence, or artifact.`);
    if (typeof file.sha256 !== 'string' || !/^[a-f\d]{64}$/i.test(file.sha256)) errors.push(`${label}.sha256 must contain 64 hexadecimal characters.`);
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0) errors.push(`${label}.bytes must be a nonnegative safe integer.`);
  }
  if (!Array.isArray(manifest.checks)) errors.push('checks must be an array.');
  const ids = new Set();
  for (const [index, check] of (Array.isArray(manifest.checks) ? manifest.checks : []).entries()) {
    const label = `checks[${index}]`;
    if (!plain(check)) { errors.push(`${label} must be an object.`); continue; }
    if (!nonempty(check.id)) errors.push(`${label}.id must be a nonempty string.`);
    else if (ids.has(check.id)) errors.push(`${label}.id duplicates a check ID.`);
    ids.add(check.id);
    if (!STATUSES.has(check.status)) errors.push(`${label}.status must be passed, limited, or not-run.`);
    if (!nonempty(check.summary)) errors.push(`${label}.summary must be a nonempty string.`);
    if (!Array.isArray(check.evidence)) errors.push(`${label}.evidence must be an array.`);
    else {
      if (['passed', 'limited'].includes(check.status) && !check.evidence.length) errors.push(`${label} requires evidence for its declared status.`);
      const seen = new Set();
      for (const evidence of check.evidence) {
        if (pathError(evidence) || declarations.get(evidence)?.role !== 'evidence') errors.push(`${label}.evidence must reference a declared file with role evidence.`);
        if (seen.has(evidence)) errors.push(`${label}.evidence contains a duplicate path.`);
        seen.add(evidence);
      }
    }
  }
  if (!Array.isArray(manifest.limitations) || manifest.limitations.some(value => !nonempty(value))) errors.push('limitations must be an array of nonempty strings.');
  return errors;
}

/* A drift record documents reviewed changes to repository inputs made after a
 * delivery was recorded, without rewriting the historical record. It sits beside
 * the manifest and is bound to its exact bytes. A changed file counts as
 * documented only when its current bytes equal the declared ones. */
export const DRIFT_FILE = 'delivery-drift.json';
const DRIFT_KINDS = new Set(['documentation', 'test', 'tooling', 'runtime']);
const HEX64 = /^[a-f\d]{64}$/;
const digestPair = value => plain(value) && Number.isSafeInteger(value.bytes) && value.bytes >= 0 && typeof value.sha256 === 'string' && HEX64.test(value.sha256);

function validateDrift(drift, manifest, manifestPath, manifestSha256) {
  if (!plain(drift)) return ['Drift record must be a JSON object.'];
  const errors = [];
  if (drift.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  if (drift.manifest !== manifestPath) errors.push('manifest must name the delivery record it documents.');
  if (drift.manifestSha256 !== manifestSha256) errors.push('manifestSha256 must equal the SHA-256 of the delivery record bytes.');
  if (!Array.isArray(drift.changes) || !drift.changes.length) errors.push('changes must be a nonempty array.');
  const declared = new Map(manifest.files.map(file => [file.path, file])), seen = new Set();
  for (const [index, change] of (Array.isArray(drift.changes) ? drift.changes : []).entries()) {
    const label = `changes[${index}]`;
    if (!plain(change)) { errors.push(`${label} must be an object.`); continue; }
    const file = declared.get(change.path);
    if (!file) errors.push(`${label}.path must be a file declared by the delivery record.`);
    else {
      if (file.storage !== 'repository' || file.role !== 'input') errors.push(`${label}.path must be a repository input; changed evidence or artifacts need a new delivery record.`);
      if (!digestPair(change.recorded) || change.recorded.bytes !== file.bytes || change.recorded.sha256 !== file.sha256.toLowerCase()) errors.push(`${label}.recorded must equal the declared bytes and SHA-256.`);
    }
    if (seen.has(change.path)) errors.push(`${label}.path duplicates another change.`);
    seen.add(change.path);
    if (!digestPair(change.current)) errors.push(`${label}.current must declare bytes and a lowercase SHA-256.`);
    if (!DRIFT_KINDS.has(change.kind)) errors.push(`${label}.kind must be documentation, test, tooling or runtime.`);
    if (!nonempty(change.reason)) errors.push(`${label}.reason must be a nonempty string.`);
    if (!Array.isArray(change.evidence) || change.evidence.some(item => !plain(item) || pathError(item.path) || typeof item.sha256 !== 'string' || !HEX64.test(item.sha256))) errors.push(`${label}.evidence must list { path, sha256 } entries.`);
    else if (change.kind === 'runtime' && !change.evidence.length) errors.push(`${label}: a runtime change needs evidence that the delivery is unaffected.`);
  }
  return errors;
}

class UnsafePath extends Error {}

async function checkedPath(root, path) {
  const invalid = pathError(path);
  if (invalid) throw new UnsafePath(`${path}: ${invalid}`);
  const target = resolve(root, ...path.split('/'));
  if (!inside(root, target)) throw new UnsafePath(`${path}: path escapes project root`);
  let current = root;
  const parts = path.split('/');
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part);
    let info;
    try { info = await lstat(current); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    // lstat detects a dangling link too; realpath alone would mistake it for a missing file.
    if (info.isSymbolicLink()) throw new UnsafePath(`${path}: symlink or junction component is not allowed`);
    const actual = await realpath(current);
    if (!inside(root, actual)) throw new UnsafePath(`${path}: resolved path escapes project root`);
    if (index < parts.length - 1 && !info.isDirectory()) throw new UnsafePath(`${path}: ancestor is not a directory`);
    if (index === parts.length - 1) {
      if (!info.isFile()) throw new UnsafePath(`${path}: target is not a regular file`);
      return { path: current, info };
    }
  }
  throw new UnsafePath(`${path}: invalid target`);
}

async function digest(root, filePath, checked) {
  const handle = await open(checked.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    // Re-check ancestors after opening and before reading. Never knowingly follow a link.
    const rechecked = await checkedPath(root, filePath);
    const before = await handle.stat();
    if (!rechecked || !before.isFile() || before.dev !== rechecked.info.dev || before.ino !== rechecked.info.ino) throw new UnsafePath(`${filePath}: file identity changed before reading`);
    const hash = createHash('sha256');
    let bytes = 0;
    for await (const chunk of handle.createReadStream({ autoClose: false })) { hash.update(chunk); bytes += chunk.length; }
    const after = await handle.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || bytes !== after.size) throw new Error(`${filePath}: file changed while being read; retry against a stable delivery`);
    return { bytes, sha256: hash.digest('hex') };
  } finally { await handle.close(); }
}

/** No writes, downloads, external commands, or automatic digest updates. */
export async function checkDelivery(root, manifestPath, { requireLocal = false, ignoreDrift = false } = {}) {
  const report = {
    schemaVersion: 1, manifest: manifestPath, id: null, route: null, requireLocal: Boolean(requireLocal), ok: false,
    validationErrors: [], drift: null, files: [], checks: [], limitations: [],
    scope: 'File integrity and declared evidence availability only. This does not verify engineering correctness, UI/media quality, licensing completeness, or publication.',
  };
  let manifest, manifestSha256;
  try {
    const lexicalRoot = resolve(root);
    const rootInfo = await lstat(lexicalRoot);
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new UnsafePath('Project root must be a directory, not a symlink or junction.');
    root = await realpath(lexicalRoot);
    if (relative(root, lexicalRoot) !== '') throw new UnsafePath('Project root must not have symlink or junction ancestors.');
    const target = await checkedPath(root, manifestPath);
    if (!target) throw new Error('Manifest is missing.');
    const manifestBytes = await readFile(target.path);
    manifestSha256 = createHash('sha256').update(manifestBytes).digest('hex');
    manifest = JSON.parse(manifestBytes.toString('utf8'));
    report.validationErrors = validate(manifest);
  } catch (error) {
    report.validationErrors.push(error.message);
    return report;
  }
  if (report.validationErrors.length) return report;
  let drift = new Map();
  if (!ignoreDrift) {
    const driftPath = manifestPath.includes('/') ? manifestPath.replace(/[^/]*$/, DRIFT_FILE) : DRIFT_FILE;
    try {
      const checked = await checkedPath(root, driftPath);
      if (checked) {
        const record = JSON.parse(await readFile(checked.path, 'utf8'));
        const errors = validateDrift(record, manifest, manifestPath, manifestSha256);
        for (const change of errors.length ? [] : record.changes) for (const item of change.evidence) {
          const evidence = await checkedPath(root, item.path);
          if (!evidence || (await digest(root, item.path, evidence)).sha256 !== item.sha256) errors.push(`evidence ${item.path} is missing or changed.`);
        }
        if (errors.length) { report.validationErrors.push(...errors.map(error => `${driftPath}: ${error}`)); return report; }
        drift = new Map(record.changes.map(change => [change.path, change]));
        report.drift = { path: driftPath, changes: record.changes.length };
      }
    } catch (error) { report.validationErrors.push(`${driftPath}: ${error.message}`); return report; }
  }
  report.id = manifest.id;
  report.route = manifest.route;
  report.limitations = [...manifest.limitations];
  for (const file of manifest.files) {
    const entry = { path: file.path, storage: file.storage, role: file.role,
      status: 'error', expected: { bytes: file.bytes, sha256: file.sha256.toLowerCase() } };
    try {
      const checked = await checkedPath(root, file.path);
      if (!checked) {
        entry.status = file.storage === 'local' ? 'unavailable' : 'missing';
        entry.message = file.storage === 'local' ? 'Local-only file is not available in this checkout.' : 'Repository file is missing.';
      } else {
        entry.actual = await digest(root, file.path, checked);
        entry.status = entry.actual.bytes === entry.expected.bytes && entry.actual.sha256 === entry.expected.sha256 ? 'verified' : 'changed';
        if (entry.status === 'changed') entry.message = 'Bytes or SHA-256 differ from the declared delivery; digests were not updated.';
        const change = drift.get(file.path);
        if (change && entry.status === 'changed') {
          if (entry.actual.bytes === change.current.bytes && entry.actual.sha256 === change.current.sha256) {
            entry.status = 'documented'; entry.message = 'Changed after the delivery was recorded; the drift record documents this exact change.';
            entry.drift = { kind: change.kind, reason: change.reason, evidence: change.evidence.map(item => item.path) };
          } else entry.message = 'Changed again after the documented drift; digests were not updated.';
        } else if (change && entry.status === 'verified') report.validationErrors.push(`${file.path}: drift entry is stale; the file matches the delivery record again.`);
      }
    } catch (error) { entry.status = error instanceof UnsafePath ? 'unsafe' : 'error'; entry.message = error.message; }
    report.files.push(entry);
  }
  const byPath = new Map(report.files.map(file => [file.path, file]));
  report.checks = manifest.checks.map(check => {
    const evidence = check.evidence.map(path => ({ path, status: byPath.get(path).status }));
    const evidenceAvailability = !evidence.length ? 'none'
      : evidence.some(file => !['verified', 'unavailable'].includes(file.status)) ? 'invalid'
        : evidence.some(file => file.status === 'unavailable') ? 'unavailable' : 'verified';
    return { id: check.id, declaredStatus: check.status, summary: check.summary, evidence, evidenceAvailability };
  });
  const accepted = file => ['verified', 'documented'].includes(file.status) || (file.status === 'unavailable' && !requireLocal);
  report.ok = !report.validationErrors.length && report.files.every(accepted);
  report.summary = {
    files: report.files.length,
    verified: report.files.filter(file => file.status === 'verified').length,
    documented: report.files.filter(file => file.status === 'documented').length,
    unavailable: report.files.filter(file => file.status === 'unavailable').length,
    failed: report.files.filter(file => !accepted(file)).length,
  };
  return report;
}

async function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Usage: node scripts/check-delivery.mjs --manifest <project-relative.json> [--require-local] [--ignore-drift]\nRead-only integrity check; local-only files may be unavailable unless --require-local is set.\nA delivery-drift.json beside the manifest documents reviewed later changes; --ignore-drift reports them as changed.');
    return;
  }
  let manifestPath, requireLocal = false, ignoreDrift = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--manifest' && manifestPath === undefined && args[index + 1] && !args[index + 1].startsWith('--')) manifestPath = args[++index];
    else if (arg === '--require-local' && !requireLocal) requireLocal = true;
    else if (arg === '--ignore-drift' && !ignoreDrift) ignoreDrift = true;
    else throw new Error(`Unexpected or incomplete argument: ${arg}`);
  }
  if (!manifestPath) throw new Error('Missing --manifest <project-relative.json>.');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const report = await checkDelivery(root, manifestPath, { requireLocal, ignoreDrift });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    console.error(`${error.message}\nUsage: node scripts/check-delivery.mjs --manifest <project-relative.json> [--require-local] [--ignore-drift]`);
    process.exitCode = 1;
  });
}
