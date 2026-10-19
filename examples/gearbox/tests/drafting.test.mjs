import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { draftingMarks, DRAFTING_WINDOWS, windowOpacity } from '../drafting-layer.mjs';
import { LABELS } from '../labels.mjs';
import { createGearboxStory, BPM, DURATION, TOTAL_BEATS } from '../story.mjs';
import { TEETH, GEARS, CENTRE_DISTANCE, SLEEVE_TRAVEL, SYNCHROS, MODULE } from '../spec.mjs';
import { readGlb, positionArrays } from '../../../shared/assets/glb.mjs';

const read = path => readFile(new URL(path, import.meta.url));
const index = JSON.parse(await read('../assets/scene-index.json'));
const story = createGearboxStory(index), marks = draftingMarks(index);
const beats = ([a, b], steps = 80) => Array.from({ length: steps + 1 }, (_, i) => a + (b - a) * i / steps);

test('every drawn number comes from the model’s own data', async () => {
  assert.equal(marks.centreDistance.text, `${CENTRE_DISTANCE * 1000} mm`);
  const bounds = index.asset.assembledWorldBounds;
  assert.equal(marks.overallLength.text, `${Math.round((bounds.max[0] - bounds.min[0]) * 1000)} mm`);
  assert.equal(LABELS.first.spec, `${TEETH.main1} T · ${GEARS[1].ratio.toFixed(2)} : 1`);
  assert.equal(LABELS.fifth.spec, `${TEETH.main5} T · ${GEARS[5].ratio.toFixed(2)} : 1`);
  assert.equal(LABELS.input.spec, `${TEETH.input} T · m ${MODULE * 1000}`);
  assert.equal(LABELS.sleeve.spec, `slides ${SLEEVE_TRAVEL * 1000} mm`);
  // The blocker ring's stated diameter matches the delivered GLB geometry.
  const { json, buffer } = readGlb(await read('../assets/gearbox.glb'));
  const ring = json.nodes.find(node => node.extras?.part_id === 'gb:main/synchro-s34/ring-front');
  const radius = Math.max(...positionArrays(json, buffer, ring).flatMap(({ values }) => values.map(([, y, z]) => Math.hypot(y, z))));
  assert.ok(Math.abs(radius - SYNCHROS.s34.spline) < 1e-6);
  assert.equal(LABELS.ring.spec, `24 teeth · Ø ${Math.round(2 * radius * 1000)} mm`);
  assert.deepEqual(Object.values(LABELS).map(label => Number(label.index)), Array.from({ length: 10 }, (_, i) => i + 1), 'indices follow order of appearance');
});

test('a dimension is shown only while the parts it measures are assembled', () => {
  for (const key of ['centreDistance', 'overallLength']) for (const b of beats(DRAFTING_WINDOWS[key])) {
    const state = story.stateAt(b * 60 / BPM);
    for (const [id, offset] of Object.entries(state.offsetsWorld)) if (!story.caseParts.has(id) || key === 'overallLength') {
      assert.ok(offset.every(v => Math.abs(v) < 1e-9), `${key}: ${id} displaced at beat ${b}`);
    }
    if (key === 'overallLength') for (const id of story.caseParts.keys()) assert.equal(story.presentationOpacity(state, id), 1, 'case closed');
  }
});

test('the stamp marks fourth gear engaged, and nothing is drawn at the loop seam', () => {
  for (const b of beats(DRAFTING_WINDOWS.stamp)) assert.equal(story.stateAt(b * 60 / BPM).drive.engaged, '4', `beat ${b}`);
  for (const window of Object.values(DRAFTING_WINDOWS)) {
    assert.equal(windowOpacity(0, window), 0); assert.equal(windowOpacity(TOTAL_BEATS, window), 0);
    assert.ok(windowOpacity((window[0] + window[1]) / 2, window) === 1);
  }
  assert.equal(DURATION, TOTAL_BEATS * 60 / BPM);
});

test('repeated parts lift in a wave inside their own set', () => {
  const rear = [...story.waveDelay].filter(([id]) => id.startsWith('gb:main/bearing-rear/ball-')).map(([, delay]) => delay).sort((a, b) => a - b);
  assert.equal(rear.length, 10); assert.equal(rear[0], 0); assert.ok(Math.abs(rear.at(-1) - story.WAVE.span) < 1e-12);
  assert.ok(rear.every((v, i) => !i || v > rear[i - 1]), 'distinct ranks');
  const keys = [...story.waveDelay].filter(([id]) => id.includes('/synchro-s12/key-')); assert.equal(keys.length, 3);
});
