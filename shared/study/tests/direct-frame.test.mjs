import test from 'node:test';
import assert from 'node:assert/strict';
import { baselineFromMetrics, groupTextFragments, transformText, validateFrameViewport, createStudyFrameRenderer } from '../direct-frame.mjs';

test('fixed-frame geometry rejects a changed layout without depending on host device pixel ratio', () => {
  const fixed = { width: 1080, height: 1080, viewportWidth: 1080, viewportHeight: 1080 };
  assert.deepEqual(validateFrameViewport({ ...fixed, devicePixelRatio: 1.5 }), { width: 1080, height: 1080 });
  assert.deepEqual(validateFrameViewport({ ...fixed, devicePixelRatio: 3 }), { width: 1080, height: 1080 });
  assert.throws(() => validateFrameViewport({ ...fixed, viewportWidth: 720 }), /must stay/);
  assert.throws(() => validateFrameViewport({ ...fixed, scrollY: 2 }), /not be scrolled/);
  assert.throws(() => validateFrameViewport({ ...fixed, width: NaN }), /positive integers/);
});

test('measured browser lines retain wrapping and spaces instead of reflowing in canvas', () => {
  const fragment = (text, left, top, width = 8) => ({ text, left, top, width, height: 18 });
  const lines = groupTextFragments([fragment('Gear', 20, 40, 32), fragment(' ', 52, 40, 4), fragment('ratio', 56, 40.2, 32), fragment(' ', 88, 40, 4), fragment('\n', 92, 40, 0), fragment('3.70', 20, 66, 32), fragment(' ', 52, 66, 0), fragment(' : 1', 52, 66, 20)]);
  assert.deepEqual(lines.map(line => line.text), ['Gear ratio', '3.70 : 1']);
  assert.equal(lines[0].left, 20); assert.equal(lines[0].top, 40); assert.equal(lines[1].top, 66);
  assert.throws(() => groupTextFragments([fragment('x', NaN, 0)]), /finite geometry/);
});

test('canvas baselines derive from actual font bounds; unsupported metrics fail explicitly', () => {
  assert.equal(baselineFromMetrics(100.25, { fontBoundingBoxAscent: 41 }), 141.25);
  assert.throws(() => baselineFromMetrics(100, { actualBoundingBoxAscent: 35 }), /fontBoundingBoxAscent/);
});

test('supported text transforms preserve symbols and unsupported layout is not silently approximated', () => {
  assert.equal(transformText('5th · Ø 60 mm', 'uppercase'), '5TH · Ø 60 MM');
  assert.equal(transformText('5th · Ø 60 mm', 'none'), '5th · Ø 60 mm');
  assert.throws(() => transformText('title', 'capitalize'), /Unsupported/);
  assert.throws(() => createStudyFrameRenderer({}, { width: 1080, height: 1080 }), /ready study API/);
});
