import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDelivery } from '../scripts/check-delivery.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryBase = resolve(project, '.test-output');
const sha256 = text => createHash('sha256').update(text).digest('hex');
const contained = (root, path) => {
  const rel = relative(root, path);
  return rel !== '' && !isAbsolute(rel) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\');
};

async function fixture(t) {
  await mkdir(temporaryBase, { recursive: true });
  assert.ok(contained(await realpath(project), await realpath(temporaryBase)));
  assert.equal((await lstat(temporaryBase)).isSymbolicLink(), false);
  const container = await mkdtemp(resolve(temporaryBase, 'delivery-check-'));
  const root = resolve(container, 'root');
  await mkdir(root);
  t.after(async () => {
    const actual = await realpath(container);
    assert.ok(contained(await realpath(project), actual));
    assert.ok(contained(await realpath(temporaryBase), actual));
    assert.equal((await lstat(container)).isSymbolicLink(), false);
    await rm(container, { recursive: true, force: true });
  });
  const contents = { 'input.step': 'Original CAD bytes\n', 'review.json': '{"humanReview":"limited"}\n', 'movie.mp4': 'Fixture movie bytes\n' };
  for (const [path, value] of Object.entries(contents)) await writeFile(resolve(root, path), value);
  const manifest = {
    schemaVersion: 1, id: 'fixture-delivery', route: 'Showcase',
    files: Object.entries(contents).map(([path, value], index) => ({ path, storage: index === 0 ? 'repository' : 'local',
      role: ['input', 'evidence', 'artifact'][index], bytes: Buffer.byteLength(value), sha256: sha256(value) })),
    checks: [{ id: 'manual-review', status: 'limited', summary: 'A recorded review, not re-run by this checker.', evidence: ['review.json'] },
      { id: 'publication', status: 'not-run', summary: 'No publication claimed.', evidence: [] }],
    limitations: ['Integrity is not proof of contact mechanics.'],
    modules: ['mating-closeup'],
  };
  const save = async () => writeFile(resolve(root, 'delivery.json'), `${JSON.stringify(manifest)}\n`);
  await save();
  return { root, container, manifest, save };
}

test('healthy delivery preserves declared outcomes and separates integrity from review', async t => {
  const f = await fixture(t);
  const before = await readFile(resolve(f.root, 'delivery.json'), 'utf8');
  const report = await checkDelivery(f.root, 'delivery.json', { requireLocal: true });
  assert.equal(report.ok, true);
  assert.deepEqual(report.summary, { files: 3, verified: 3, documented: 0, unavailable: 0, failed: 0 });
  assert.equal(report.checks[0].declaredStatus, 'limited');
  assert.equal(report.checks[0].evidenceAvailability, 'verified');
  assert.equal(report.checks[1].declaredStatus, 'not-run');
  assert.equal(report.checks[1].evidenceAvailability, 'none');
  assert.deepEqual(report.limitations, f.manifest.limitations);
  assert.match(report.scope, /does not verify engineering correctness/);
  assert.equal(await readFile(resolve(f.root, 'delivery.json'), 'utf8'), before);
});

test('portable clone reports absent local evidence and artifact without failing by default', async t => {
  const f = await fixture(t);
  await rm(resolve(f.root, 'review.json'));
  await rm(resolve(f.root, 'movie.mp4'));
  const report = await checkDelivery(f.root, 'delivery.json');
  assert.equal(report.ok, true);
  assert.equal(report.summary.unavailable, 2);
  assert.equal(report.checks[0].evidenceAvailability, 'unavailable');
  assert.equal(report.checks[0].declaredStatus, 'limited');
  const strict = await checkDelivery(f.root, 'delivery.json', { requireLocal: true });
  assert.equal(strict.ok, false);
  assert.equal(strict.summary.failed, 2);
});

test('altered input, artifact, or evidence always fails, even for local files', async t => {
  for (const path of ['input.step', 'movie.mp4', 'review.json']) {
    await t.test(path, async st => {
      const f = await fixture(st);
      const original = await readFile(resolve(f.root, path));
      const altered = Buffer.from(original);
      altered[0] ^= 1; // Same size: the hash must detect this change.
      await writeFile(resolve(f.root, path), altered);
      const report = await checkDelivery(f.root, 'delivery.json');
      assert.equal(report.ok, false);
      const entry = report.files.find(file => file.path === path);
      assert.equal(entry.status, 'changed');
      assert.equal(entry.actual.bytes, entry.expected.bytes);
      assert.notEqual(entry.actual.sha256, entry.expected.sha256);
      if (path === 'review.json') assert.equal(report.checks[0].evidenceAvailability, 'invalid');
    });
  }
});

test('declared byte count mismatch fails independently of matching digest', async t => {
  const f = await fixture(t);
  f.manifest.files[0].bytes += 1;
  await f.save();
  const report = await checkDelivery(f.root, 'delivery.json');
  assert.equal(report.ok, false);
  assert.equal(report.files[0].status, 'changed');
  assert.equal(report.files[0].actual.sha256, report.files[0].expected.sha256);
});

test('missing repository file fails portable and strict checks', async t => {
  const f = await fixture(t);
  await rm(resolve(f.root, 'input.step'));
  const report = await checkDelivery(f.root, 'delivery.json');
  assert.equal(report.ok, false);
  assert.equal(report.files[0].status, 'missing');
});

test('invalid contracts stop before reading declared files', async t => {
  const cases = [
    ['schema version', m => { m.schemaVersion = '1'; }],
    ['route', m => { m.route = 'Preview'; }],
    ['empty files', m => { m.files = []; }],
    ['duplicate path', m => { m.files.push({ ...m.files[0], path: 'INPUT.step' }); }],
    ['bad hash', m => { m.files[0].sha256 = 'not-a-digest'; }],
    ['negative bytes', m => { m.files[0].bytes = -1; }],
    ['fractional bytes', m => { m.files[0].bytes = 1.5; }],
    ['bad storage', m => { m.files[0].storage = 'remote'; }],
    ['duplicate check ID', m => { m.checks.push({ ...m.checks[0] }); }],
    ['invalid status', m => { m.checks[0].status = 'approved'; }],
    ['unlisted evidence', m => { m.checks[0].evidence = ['other.json']; }],
    ['input as evidence', m => { m.checks[0].evidence = ['input.step']; }],
    ['passed without evidence', m => { m.checks[0].status = 'passed'; m.checks[0].evidence = []; }],
    ['limited without evidence', m => { m.checks[0].evidence = []; }],
    ['invalid limitations', m => { m.limitations = 'Everything is fine'; }],
  ];
  for (const [name, change] of cases) await t.test(name, async st => {
    const f = await fixture(st);
    change(f.manifest);
    await f.save();
    const report = await checkDelivery(f.root, 'delivery.json');
    assert.equal(report.ok, false);
    assert.ok(report.validationErrors.length);
    assert.deepEqual(report.files, []);
  });
});

test('rejects traversal, absolute, URL, UNC, backslash and Windows alias paths', async t => {
  for (const path of ['../secret', 'nested/../../secret', '/etc/passwd', 'C:/secret', '//host/share/file', '\\\\host\\share\\file',
    'https://example.com/a', 'nested\\file', './input.step', 'nested//file', 'nested/../file', 'input.step.', 'dir /file', 'NUL', 'nested/COM1.txt']) {
    await t.test(path, async st => {
      const f = await fixture(st);
      f.manifest.files[0].path = path;
      await f.save();
      const report = await checkDelivery(f.root, 'delivery.json');
      assert.equal(report.ok, false);
      assert.ok(report.validationErrors.some(message => message.startsWith('files[0].path')));
      assert.deepEqual(report.files, []);
    });
  }
});

test('rejects manifest traversal and malformed or missing JSON safely', async t => {
  const f = await fixture(t);
  for (const path of ['../delivery.json', resolve(f.root, 'delivery.json'), 'missing.json']) {
    const report = await checkDelivery(f.root, path);
    assert.equal(report.ok, false);
    assert.ok(report.validationErrors.length);
  }
  await writeFile(resolve(f.root, 'delivery.json'), '{broken');
  const report = await checkDelivery(f.root, 'delivery.json');
  assert.equal(report.ok, false);
  assert.ok(report.validationErrors.length);
});

test('rejects linked ancestors even when target file is missing or link stays inside root', async t => {
  for (const targetKind of ['outside', 'inside', 'dangling']) await t.test(targetKind, async st => {
    const f = await fixture(st);
    const destination = targetKind === 'inside' ? resolve(f.root, 'safe') : resolve(f.container, targetKind);
    if (targetKind !== 'dangling') await mkdir(destination);
    await symlink(destination, resolve(f.root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    f.manifest.files[2].path = 'linked/missing.mp4';
    await f.save();
    const report = await checkDelivery(f.root, 'delivery.json');
    assert.equal(report.ok, false);
    assert.equal(report.files[2].status, 'unsafe');
    assert.match(report.files[2].message, /symlink or junction/);
  });
});

test('rejects manifest under a linked ancestor before reading it', async t => {
  const f = await fixture(t);
  const outside = resolve(f.container, 'outside');
  await mkdir(outside);
  await writeFile(resolve(outside, 'delivery.json'), JSON.stringify(f.manifest));
  await symlink(outside, resolve(f.root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const report = await checkDelivery(f.root, 'linked/delivery.json');
  assert.equal(report.ok, false);
  assert.ok(report.validationErrors.some(message => /symlink or junction/.test(message)));
  assert.deepEqual(report.files, []);
});

test('non-file targets and non-directory ancestors fail safely', async t => {
  const f = await fixture(t);
  await mkdir(resolve(f.root, 'directory'));
  f.manifest.files[2].path = 'directory';
  await f.save();
  assert.equal((await checkDelivery(f.root, 'delivery.json')).files[2].status, 'unsafe');
  f.manifest.files[2].path = 'input.step/child.mp4';
  await f.save();
  assert.equal((await checkDelivery(f.root, 'delivery.json')).files[2].status, 'unsafe');
});

async function driftFixture(t, { kind = 'runtime', withEvidence = true } = {}) {
  const f = await fixture(t);
  const manifestBytes = await readFile(resolve(f.root, 'delivery.json'));
  const changed = 'Original CAD bytes, later documented\n', evidence = '{"pixels":"identical"}\n';
  await writeFile(resolve(f.root, 'input.step'), changed);
  await writeFile(resolve(f.root, 'pixels.json'), evidence);
  const declared = f.manifest.files[0];
  const drift = {
    schemaVersion: 1, manifest: 'delivery.json', manifestSha256: sha256(manifestBytes),
    changes: [{ path: 'input.step', recorded: { bytes: declared.bytes, sha256: declared.sha256 }, current: { bytes: Buffer.byteLength(changed), sha256: sha256(changed) },
      kind, reason: 'Reviewed change after the recorded delivery.', evidence: withEvidence ? [{ path: 'pixels.json', sha256: sha256(evidence) }] : [] }],
  };
  const saveDrift = () => writeFile(resolve(f.root, 'delivery-drift.json'), `${JSON.stringify(drift)}\n`);
  await saveDrift();
  return { ...f, drift, saveDrift };
}

test('a drift record documents an exact later change without rewriting the delivery record', async t => {
  const f = await driftFixture(t);
  const before = await readFile(resolve(f.root, 'delivery.json'), 'utf8');
  const report = await checkDelivery(f.root, 'delivery.json');
  assert.equal(report.ok, true, JSON.stringify(report.validationErrors));
  assert.deepEqual(report.summary, { files: 3, verified: 2, documented: 1, unavailable: 0, failed: 0 });
  assert.equal(report.files[0].status, 'documented'); assert.equal(report.files[0].drift.kind, 'runtime');
  assert.deepEqual(report.drift, { path: 'delivery-drift.json', changes: 1 });
  assert.equal(await readFile(resolve(f.root, 'delivery.json'), 'utf8'), before);
  const raw = await checkDelivery(f.root, 'delivery.json', { ignoreDrift: true });
  assert.equal(raw.ok, false); assert.equal(raw.files[0].status, 'changed');
});

test('documented drift fails on any further change, stale entry, rebound record or changed evidence', async t => {
  const f = await driftFixture(t);
  await writeFile(resolve(f.root, 'input.step'), 'changed again\n');
  let report = await checkDelivery(f.root, 'delivery.json');
  assert.equal(report.ok, false); assert.equal(report.files[0].status, 'changed'); assert.match(report.files[0].message, /again/);
  await writeFile(resolve(f.root, 'input.step'), 'Original CAD bytes\n');
  report = await checkDelivery(f.root, 'delivery.json');
  assert.equal(report.ok, false); assert.match(report.validationErrors.join('\n'), /stale/);
  await writeFile(resolve(f.root, 'input.step'), 'Original CAD bytes, later documented\n');
  await writeFile(resolve(f.root, 'pixels.json'), '{"pixels":"edited"}\n');
  report = await checkDelivery(f.root, 'delivery.json');
  assert.equal(report.ok, false); assert.match(report.validationErrors.join('\n'), /evidence pixels\.json is missing or changed/);
  await writeFile(resolve(f.root, 'pixels.json'), '{"pixels":"identical"}\n');
  f.manifest.limitations.push('A later edit to the record itself.'); await f.save();
  report = await checkDelivery(f.root, 'delivery.json');
  assert.equal(report.ok, false); assert.match(report.validationErrors.join('\n'), /manifestSha256/);
});

test('drift cannot excuse changed evidence or artifacts, or a runtime change without evidence', async t => {
  const f = await driftFixture(t, { withEvidence: false });
  let report = await checkDelivery(f.root, 'delivery.json');
  assert.equal(report.ok, false); assert.match(report.validationErrors.join('\n'), /runtime change needs evidence/);
  f.drift.changes[0].kind = 'documentation'; await f.saveDrift();
  assert.equal((await checkDelivery(f.root, 'delivery.json')).ok, true);
  const review = f.manifest.files[1];
  f.drift.changes.push({ path: 'review.json', recorded: { bytes: review.bytes, sha256: review.sha256 }, current: { bytes: 1, sha256: '0'.repeat(64) }, kind: 'documentation', reason: 'No.', evidence: [] });
  await f.saveDrift();
  report = await checkDelivery(f.root, 'delivery.json');
  assert.equal(report.ok, false); assert.match(report.validationErrors.join('\n'), /must be a repository input/);
  f.drift.changes.pop(); f.drift.changes[0].recorded.sha256 = 'f'.repeat(64); await f.saveDrift();
  report = await checkDelivery(f.root, 'delivery.json');
  assert.match(report.validationErrors.join('\n'), /recorded must equal the declared/);
});
