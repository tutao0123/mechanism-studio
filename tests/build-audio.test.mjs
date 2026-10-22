import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCORES, withoutDiagnostics, scoreWavPath } from '../scripts/build-audio.mjs';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const gitAt = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

async function ownsGitWorktree() {
  try {
    const top = gitAt(root, 'rev-parse', '--show-toplevel').trim();
    return await realpath(top) === await realpath(root);
  } catch { return false; }
}

// A GitHub source archive has no index. It may also be extracted below a
// different repository, whose ignore rules must not decide this test's inputs.
async function archiveScoreMetadata(ignoreRoot) {
  const excluded = new Set(['node_modules', 'output', 'dist', 'shots', 'source', 'assets', 'validation']);
  const found = [];
  async function visit(directory) {
    let entries;
    try { entries = await readdir(join(root, directory), { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || excluded.has(entry.name) || entry.isSymbolicLink()) continue;
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name === 'music-score.json') found.push(path);
    }
  }
  for (const directory of ['EXAMPLE_ROBOT', 'examples', 'prototype-3d', 'showcase']) await visit(directory);
  return found.filter(path => {
    try { gitAt(ignoreRoot, 'check-ignore', '--no-index', '--quiet', '--', path); return false; }
    catch (error) { if (error.status === 1) return true; throw error; }
  }).sort();
}

test('every public source score is registered once and its generated WAV stays excluded', async t => {
  const worktree = await ownsGitWorktree();
  let ignoreRoot = root;
  if (!worktree) {
    ignoreRoot = join(root, 'output', `audio-ignore-${randomUUID()}`);
    await mkdir(ignoreRoot, { recursive: true });
    gitAt(ignoreRoot, 'init', '--quiet', '--initial-branch=main');
    await writeFile(join(ignoreRoot, '.gitignore'), await readFile(join(root, '.gitignore')));
    t.diagnostic('Source archive: registry and ignore checks use public source folders and an isolated copy of this project\'s .gitignore, not an ancestor Git index.');
  }
  const metadata = worktree
    ? gitAt(root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z', '*music-score.json').split('\0').filter(Boolean).sort()
    : await archiveScoreMetadata(ignoreRoot);
  assert.deepEqual(SCORES.map(score => score.metadata).sort(), metadata, 'registry matches all public score metadata');
  const wavs = [];
  for (const score of SCORES) {
    await access(new URL(score.build[0], new URL('../', import.meta.url)));
    const wav = scoreWavPath(score.metadata, JSON.parse(await readFile(new URL(score.metadata, new URL('../', import.meta.url)), 'utf8')));
    if (worktree) assert.equal(gitAt(root, 'ls-files', '--', wav), '', `${wav} must not be tracked`);
    assert.match(gitAt(ignoreRoot, 'check-ignore', '--no-index', '--', wav), /\.wav\r?\n$/, `${wav} must be ignored by this project's rules`);
    wavs.push(wav);
  }
  assert.equal(new Set(wavs).size, wavs.length, 'one WAV per score');
});

test('only measured diagnostics are excused when a rebuild is compared with its record', () => {
  const record = { sha256: 'a', byteLength: 4, cues: [{ beat: 1, analysis: { rms: -20.000000000000004 } }], analysis: { peakDbfs: -10 } };
  assert.deepEqual(withoutDiagnostics(record), { sha256: 'a', byteLength: 4, cues: [{ beat: 1 }] });
  assert.notDeepEqual(withoutDiagnostics({ ...record, sha256: 'b' }), withoutDiagnostics(record));
  assert.equal(scoreWavPath('examples/x/music-score.json', { file: 'audio/x-loop.wav' }), 'examples/x/audio/x-loop.wav');
  for (const file of ['../escape.wav', 'audio/../../x.wav', '/abs.wav', 'loop.mp3', undefined]) assert.throws(() => scoreWavPath('examples/x/music-score.json', { file }), /unexpected score file/);
});
