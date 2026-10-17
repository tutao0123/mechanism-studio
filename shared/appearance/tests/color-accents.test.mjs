import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { DEFAULT_BASE_COLOR, DEFAULT_ACCENT_COLOR, sampleColorAccents } from '../color-accents.mjs';
import { createMeshColorLayer } from '../mesh-color-layer.mjs';

test('complete neutral baseline and a single restrained accent are absolute, clamped assignments', () => {
  const ids = ['occurrence:left', 'occurrence:right'];
  assert.deepEqual([...sampleColorAccents(ids).values()], ids.map(() => ({ weight: 0, color: DEFAULT_BASE_COLOR })));
  const sampled = sampleColorAccents(ids, [{ id: ids[0], weight: .5 }, { id: ids[0], weight: .2 }, { id: ids[1], weight: 3 }]);
  assert.deepEqual(sampled.get(ids[0]), { weight: .5, color: '#d4e3e6' });
  assert.deepEqual(sampled.get(ids[1]), { weight: 1, color: DEFAULT_ACCENT_COLOR });
  assert.equal(sampleColorAccents(ids, [{ id: ids[0], weight: -1 }]).get(ids[0]).color, DEFAULT_BASE_COLOR);
});

test('unknown IDs and invalid weights cannot tint another occurrence or mutate the source cues', () => {
  const ids = Object.freeze(['left', 'right']);
  const cues = Object.freeze([Object.freeze({ id: 'left', weight: .7 }), Object.freeze({ id: 'missing', weight: 1 }), Object.freeze({ id: 'right', weight: NaN }), Object.freeze({ id: 'left', weight: Infinity })]);
  const sampled = sampleColorAccents(ids, cues);
  assert.equal(sampled.size, 2); assert.equal(sampled.get('left').weight, .7); assert.equal(sampled.get('right').weight, 0);
  assert.equal(sampled.has('missing'), false);
  assert.deepEqual(ids, ['left', 'right']); assert.equal(cues[0].weight, .7);
  assert.throws(() => sampleColorAccents(['left', 'left']), /unique/);
  assert.throws(() => sampleColorAccents(ids, [], { baseColor: 'red' }), /six-digit/);
});

test('backward seeks, expired cues and monochrome requests cannot retain or accumulate colour', () => {
  const ids = ['left', 'right'], frames = [[], [{ id: 'left', weight: .2 }], [{ id: 'left', weight: 1 }, { id: 'right', weight: .5 }], [{ id: 'right', weight: .1 }], []];
  const expected = frames.map(cues => sampleColorAccents(ids, cues));
  for (const i of [2, 0, 4, 1, 3, 0, 2]) {
    assert.deepEqual(sampleColorAccents(ids, frames[i]), expected[i]);
    assert.deepEqual(sampleColorAccents(ids, frames[i], { enabled: false }), expected[0]);
  }
  expected[2].get('left').color = '#000000';
  assert.equal(sampleColorAccents(ids, frames[2]).get('left').color, DEFAULT_ACCENT_COLOR, 'each query owns its results');
});

test('renderer adapter isolates repeated-occurrence materials and preserves selection ownership and source pose', () => {
  const original = new MeshStandardMaterial({ color: DEFAULT_BASE_COLOR }), geometry = new BoxGeometry();
  const left = new Mesh(geometry, original), right = new Mesh(geometry, original);
  left.userData.selectionId = 'left'; right.userData.selectionId = 'right';
  left.visible = false; left.position.set(2, 3, 4);
  const before = left.position.toArray(), layer = createMeshColorLayer([left, right]);
  assert.notEqual(left.material, right.material); assert.notEqual(left.material, original);
  layer.apply(sampleColorAccents(['left', 'right'], [{ id: 'left', weight: 1 }]));
  assert.equal(left.material.color.getHexString(), DEFAULT_ACCENT_COLOR.slice(1));
  assert.equal(right.material.color.getHexString(), DEFAULT_BASE_COLOR.slice(1));
  assert.equal(original.color.getHexString(), DEFAULT_BASE_COLOR.slice(1));
  assert.equal(left.visible, false); assert.deepEqual(left.position.toArray(), before);
  const selection = new MeshStandardMaterial({ color: '#ff00ff' }); right.material = selection;
  layer.apply(sampleColorAccents(['left', 'right'], [{ id: 'right', weight: 1 }]));
  assert.equal(left.material.color.getHexString(), DEFAULT_BASE_COLOR.slice(1));
  assert.equal(right.material, selection); assert.equal(selection.color.getHexString(), 'ff00ff');
  left.userData.selected = true; left.material.color.set('#112233');
  layer.apply(sampleColorAccents(['left', 'right'], [{ id: 'left', weight: 1 }]));
  assert.equal(left.material.color.getHexString(), '112233');
  layer.dispose(); assert.equal(left.material, original); assert.equal(right.material, selection);
  layer.dispose(); geometry.dispose(); original.dispose(); selection.dispose();
});
