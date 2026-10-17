import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sampleColorAccents, DEFAULT_BASE_COLOR, DEFAULT_ACCENT_COLOR } from '../../shared/appearance/color-accents.mjs';
import { annotationCues, CUE_WINDOWS, SCENE_FADE_SECONDS } from '../annotations.mjs';
import { BPM, CHAPTERS, DURATION, stateAt } from '../story.mjs';
import { publicFile } from '../serve.mjs';

const index = JSON.parse(await readFile(new URL('../planning/scene-index.json', import.meta.url), 'utf8'));
const ids = index.parts.map(part => part.id);
const at = (time, options) => sampleColorAccents(ids, annotationCues(stateAt(time), options).map(cue => ({ id: cue.id, weight: cue.opacity })));

test('preview exposes only the two runtime colour modules, keeping appearance tests and authoring files private', () => {
  assert.ok(publicFile('/shared/appearance/color-accents.mjs').endsWith('color-accents.mjs'));
  assert.ok(publicFile('/shared/appearance/mesh-color-layer.mjs').endsWith('mesh-color-layer.mjs'));
  for (const path of ['/shared/appearance/README.md', '/shared/appearance/tests/color-accents.test.mjs', '/shared/appearance/future.mjs']) assert.equal(publicFile(path), null);
});

test('robot colour cues name only actual stable source identities and retain exactly the revealed scene set', () => {
  for (const chapter of CHAPTERS) {
    const start = chapter.firstBeat * 60 / BPM, windows = CUE_WINDOWS[chapter.id];
    assert.ok(at(start).values().every(sample => sample.weight === 0));
    for (const [i, [entry]] of windows.entries()) {
      const samples = at(start + entry + .2), active = [...samples].filter(([, sample]) => sample.weight > 0).map(([id]) => id);
      assert.deepEqual(active.sort(), chapter.labels.slice(0, i + 1).map(([id]) => id).sort());
      for (const id of active) { assert.ok(ids.includes(id)); assert.equal(samples.get(id).color, DEFAULT_ACCENT_COLOR); }
    }
    const samples = at(chapter.lastBeat * 60 / BPM - SCENE_FADE_SECONDS / 2);
    const weights = [...samples.values()].filter(sample => sample.weight > 0).map(sample => sample.weight);
    assert.equal(weights.length, chapter.labels.length);
    assert.ok(weights.every(weight => Math.abs(weight - .5) < 1e-9), 'all revealed accents share the scene-exit fade');
    assert.ok(at(chapter.lastBeat * 60 / BPM).values().every(sample => sample.color === DEFAULT_BASE_COLOR), 'no previous chapter tint leaks across its boundary');
  }
});

test('robot colours follow the same pause and settled-camera cue policy and repeat after nonmonotonic seeks', () => {
  const times = [.6, 2.9, 5.6, 8.8, 14.8, 18.8, 23.2, 27.2, 31.2, DURATION - .01];
  const expected = times.map(time => at(time));
  for (const i of [8, 0, 5, 2, 9, 1, 4, 3, 7, 6]) {
    assert.deepEqual(at(times[i]), expected[i]);
    assert.ok(at(times[i], { cameraSettled: false }).values().every(sample => sample.weight === 0));
    for (const [id, sample] of at(times[i] + DURATION * 2)) assert.ok(Math.abs(sample.weight - expected[i].get(id).weight) < 1e-10);
  }
  const chapter = CHAPTERS.find(chapter => chapter.id === 'grip'), fadeTime = chapter.lastBeat * 60 / BPM - .03;
  assert.ok(at(fadeTime, { paused: true }).values().filter(sample => sample.weight > 0).every(sample => sample.weight === 1), 'paused labels and accents both stay readable');
  assert.equal(at(0).size, index.parts.length);
});
