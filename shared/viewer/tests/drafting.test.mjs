import test from 'node:test';
import assert from 'node:assert/strict';
import { centreLinePositions, dimensionPositions, formatMillimetres } from '../drafting.mjs';

const segments = positions => Array.from({ length: positions.length / 6 }, (_, i) => [Array.from(positions.slice(i * 6, i * 6 + 3)), Array.from(positions.slice(i * 6 + 3, i * 6 + 6))]);
const near = (a, b, e = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < e);

test('centre lines follow the axis in a long–short pattern and stay within it', () => {
  const pieces = segments(centreLinePositions([0, 0, 0], [.1, 0, 0], { long: .02, gap: .004, short: .004 }));
  assert.ok(pieces.length >= 6);
  assert.ok(pieces.every(([a, b]) => a[1] === 0 && b[1] === 0 && a[0] < b[0] && a[0] >= 0 && b[0] <= .1 + 1e-6));
  const lengths = pieces.map(([a, b]) => +(b[0] - a[0]).toFixed(6));
  assert.deepEqual(lengths.slice(0, 4), [.02, .004, .02, .004], 'alternating long and short dashes');
  assert.ok(near(pieces[0][0], [0, 0, 0]), 'starts on the first point');
});

test('a dimension measures the true distance and stands off the part on its side', () => {
  const a = [0, 0, 0], b = [0, -.081, 0];
  const { positions, anchor, measured } = dimensionPositions(a, b, [-1, 0, 0], .05);
  assert.ok(Math.abs(measured - .081) < 1e-12);
  const [extA, extB, line, tickA, tickB] = segments(positions);
  assert.ok(near(line[0], [-.05, 0, 0]) && near(line[1], [-.05, -.081, 0]), 'dimension line offset along the side');
  assert.ok(extA[0][0] < 0 && extA[1][0] < -.05, 'extension line runs past the dimension line');
  assert.ok(near([extB[0][1]], [-.081]));
  for (const [p, q] of [tickA, tickB]) assert.ok(Math.abs(Math.hypot(...p.map((v, i) => v - q[i])) - .006) < 1e-7, 'tick length (Float32)');
  assert.ok(anchor[0] < -.05 && Math.abs(anchor[1] + .0405) < 1e-9, 'number sits beyond the line at its middle');
  // A side vector with a component along the measurement is made perpendicular.
  const skew = dimensionPositions(a, b, [-1, -1, 0], .05);
  assert.ok(near(segments(skew.positions)[2][0], [-.05, 0, 0]));
  assert.throws(() => dimensionPositions(a, a, [1, 0, 0], .05), RangeError);
});

test('millimetres print as a drawing would', () => {
  assert.equal(formatMillimetres(.081), '81 mm');
  assert.equal(formatMillimetres(.5843), '584 mm');
  assert.equal(formatMillimetres(.0095), '9.5 mm');
  assert.throws(() => formatMillimetres(0), RangeError);
});
