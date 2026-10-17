import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectReleaseFile, checkRelease } from '../scripts/release-check.mjs';

const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const inspect = (name, text, options) => inspectReleaseFile(name, Buffer.from(text), options);

test('release policy blocks private delivery artifacts even if force-added', () => {
  for (const name of ['shots/account.png', 'EXAMPLE_ROBOT/kinetic/output/movie.mp4', '.env', '.env.production', '.cache/browser.json', 'docs/capture-v1/first.jpg', '.tools/python.exe', 'credentials.json', 'session.har', 'private.pem', 'mesh.blend1', 'scene.blend', 'voice.mp3']) {
    assert.ok(inspect(name, '').some(failure => /local\/private/.test(failure)), name);
  }
  for (const mode of ['120000', '160000']) assert.ok(inspect('entry.md', '', { mode }).some(failure => /symbolic link or submodule/.test(failure)));
  assert.ok(inspect('unknown.bin', '').some(failure => /unreviewed file type/.test(failure)));
});

test('credential scanning covers examples, binary metadata, literal assignments and redacts results', () => {
  // Compose intentionally fake fixtures at runtime so no token-shaped literal
  // is itself committed to the public test source.
  const fakeKey = ['ghp', 'A'.repeat(36)].join('_');
  for (const [name, text] of [['notes.md', fakeKey], ['robot.glb', `glTF\0${fakeKey}`], ['.env.example', `DOUBAO_TTS_API_KEY=${fakeKey}`], ['config.json', JSON.stringify({ apiKey: 'not-a-real-credential' })], ['settings.mjs', 'const API_KEY = "not-a-real-credential";'], ['.npmrc', ['//registry.npmjs.org/:', '_auth', 'Token', '=', 'not-a-real-credential'].join('')]]) {
    const failures = inspect(name, text);
    assert.ok(failures.some(failure => /credential/.test(failure)), name);
    assert.ok(!JSON.stringify(failures).includes(fakeKey));
    assert.ok(!JSON.stringify(failures).includes('not-a-real-credential'));
  }
  const examples = 'DOUBAO_TTS_API_KEY=\nDOUBAO_APP_ID=\nDOUBAO_ACCESS_KEY=\nDOUBAO_TTS_SPEAKER=en_female_example\n';
  assert.deepEqual(inspect('.env.example', examples), []);
  assert.deepEqual(inspect('config.mjs', 'const credentials = {apiKey: process.env.API_KEY};'), []);
  assert.deepEqual(inspect('voice.test.mjs', "const config = {apiKey: 'mock-test-key'};"), []);
  assert.ok(inspect('config.mjs', "const config = {apiKey: 'mock-test-key'};").length);
});

test('personal paths and unauthorized user CAD provenance are blocked without echoing values', () => {
  const privatePath = ['F:', 'secrets', 'speech.env'].join('/');
  const personalPath = ['C:', 'Users', 'private-person', 'Downloads', 'capture.png'].join('/');
  for (const text of [privatePath, personalPath]) {
    const failures = inspect('asset.glb', text);
    assert.ok(failures.some(failure => /personal-machine/.test(failure)));
    assert.ok(!JSON.stringify(failures).includes(text));
  }
  assert.ok(inspect('examples/local/source/provenance.json', JSON.stringify({ sourceType: 'user-provided' })).some(failure => /without redistribution authorization/.test(failure)));
  assert.deepEqual(inspect('examples/public/source/provenance.json', JSON.stringify({ sourceType: 'public-upstream', license: 'CC-BY-4.0' })), []);
});

test('candidate audit respects Git ignores, while staged audit scans exact index bytes', async () => {
  const root = join(projectRoot, '.test-output', `release-security-${randomUUID()}`);
  await mkdir(root, { recursive: true });
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init', '--quiet', '--initial-branch=main']);
  await writeFile(join(root, '.gitignore'), 'output/\n.env\n');
  await writeFile(join(root, 'README.md'), 'Safe staged text.\n');
  await writeFile(join(root, '.env'), 'not included in candidates');
  git(['add', '.gitignore', 'README.md']);
  const candidate = await checkRelease(root);
  assert.equal(candidate.checksPassed, true);
  assert.deepEqual(candidate.files, ['.gitignore', 'README.md']);
  await writeFile(join(root, 'README.md'), JSON.stringify({ apiKey: 'not-a-real-credential' }));
  assert.equal((await checkRelease(root)).checksPassed, false);
  const staged = await checkRelease(root, { staged: true });
  assert.equal(staged.checksPassed, true, 'safe index must not be replaced with dirty worktree content');
  assert.equal(staged.mode, 'staged-index');
  assert.equal(staged.entries.find(entry => entry.path === 'README.md').bytes, Buffer.byteLength('Safe staged text.\n'));
  git(['add', 'README.md']);
  assert.equal((await checkRelease(root, { staged: true })).checksPassed, false, 'newly staged literal must fail');
  await writeFile(join(root, 'README.md'), 'Safe worktree again.');
  const stillUnsafe = await checkRelease(root, { staged: true });
  assert.equal(stillUnsafe.checksPassed, false, 'safe working copy must not hide unsafe index content');
  assert.ok(!(await readFile(join(root, 'output/release-check.json'), 'utf8')).includes('not-a-real-credential'));
  git(['add', '--force', '.env']);
  assert.ok((await checkRelease(root, { staged: true })).failures.some(failure => /^\.env:/.test(failure)));
});
