import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SCORES, withoutDiagnostics, scoreWavPath } from '../scripts/build-audio.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

test('every committed score is registered once and its WAV is rebuilt, never tracked', async () => {
  const tracked = git('ls-files', '-z', '*music-score.json').split('\0').filter(Boolean).sort();
  assert.deepEqual(SCORES.map(score => score.metadata).sort(), tracked, 'registry matches the committed score metadata');
  const wavs = [];
  for (const score of SCORES) {
    await access(new URL(score.build[0], new URL('../', import.meta.url)));
    const wav = scoreWavPath(score.metadata, JSON.parse(await readFile(new URL(score.metadata, new URL('../', import.meta.url)), 'utf8')));
    assert.equal(git('ls-files', '--', wav), '', `${wav} must not be tracked`);
    assert.match(git('check-ignore', '--no-index', '--', wav), /\.wav\n$/, `${wav} must be ignored`);
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
