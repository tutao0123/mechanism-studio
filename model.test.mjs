import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLock, keyHeightAt, keyOutline, KEY_PROFILES, SPEC } from './model.mjs';

test('the matching key seats all five joints on the shear line', () => {
  const state = evaluateLock({ keyId: 'correct', insertion: 1 });
  assert.equal(state.canTurn, true);
  assert.equal(state.alignedCount, 5);
  assert.deepEqual(state.blockingPins, []);
  assert.equal(state.status, 'ready');
  state.pins.forEach((pin, index) => {
    assert.equal(pin.lift, SPEC.correctLifts[index]);
    assert.equal(pin.jointZ, SPEC.shearZ);
    assert.equal(pin.error, 0);
    assert.equal(pin.driverZ, SPEC.shearZ + SPEC.driverLength / 2);
    assert.equal(SPEC.springTopZ - (pin.jointZ + SPEC.driverLength), 18);
    assert.equal(pin.aligned, true);
  });
});

test('the wrong key leaves exactly stations 2 and 4 below the shear line', () => {
  const state = evaluateLock({ keyId: 'wrong', insertion: 1, angle: 90 });
  assert.deepEqual(state.blockingPins, [1, 3]);
  assert.equal(state.alignedCount, 3);
  assert.equal(state.pins[1].error, -7);
  assert.equal(state.pins[3].error, -5);
  assert.equal(state.canTurn, false);
  assert.equal(state.angle, 0);
  assert.equal(state.status, 'blocked');
});

test('no key, a blank key, and partially seated keys cannot rotate', () => {
  const empty = evaluateLock();
  assert.equal(empty.status, 'empty');
  assert.equal(empty.alignedCount, 0);
  assert.equal(empty.canTurn, false);
  empty.pins.forEach((pin) => {
    assert.equal(pin.lift, 0);
    assert.ok(pin.jointZ + SPEC.driverLength > SPEC.shearZ);
  });

  for (const profile of KEY_PROFILES) {
    for (const insertion of [0, 0.1, 0.5, 0.99, 1 - Number.EPSILON]) {
      const state = evaluateLock({ keyId: profile.id, insertion, angle: 60 });
      assert.equal(state.canTurn, false);
      assert.equal(state.angle, 0);
      assert.ok(state.alignedCount < 5);
    }
  }
  assert.equal(evaluateLock({ keyId: 'blank', insertion: 1 }).canTurn, false);
});

test('a joint may align during insertion without allowing the plug to turn', () => {
  const state = evaluateLock({ keyId: 'correct', insertion: 0.75, angle: 90 });
  assert.equal(state.pins[4].error, 0);
  assert.equal(state.pins[4].aligned, true);
  assert.ok(state.alignedCount >= 1);
  assert.equal(state.canTurn, false);
  assert.equal(state.angle, 0);
});

test('the key enters from the right and lifts stations continuously in reverse order', () => {
  const early = evaluateLock({ insertion: 0.3 });
  assert.equal(early.pins[0].lift, 0);
  assert.ok(Math.abs(early.pins[4].lift - 3) < 1e-10);

  for (let index = 0; index < SPEC.pinXs.length; index += 1) {
    const start = 1 - (SPEC.pinXs[index] - 4) / 160;
    const before = evaluateLock({ insertion: start - 1e-6 }).pins[index].lift;
    const after = evaluateLock({ insertion: start + 1e-6 }).pins[index].lift;
    assert.equal(before, 0);
    assert.ok(after > 0 && after < 1e-4);

    for (const [localX] of keyOutline().filter(([x]) => x <= SPEC.pinXs[index])) {
      const insertion = 1 - (SPEC.pinXs[index] - localX) / 160;
      const left = evaluateLock({ insertion: insertion - 1e-7 }).pins[index].lift;
      const right = evaluateLock({ insertion: insertion + 1e-7 }).pins[index].lift;
      assert.ok(Math.abs(left - right) < 1e-3);
    }
  }
});

test('key contours preserve cuts and interpolate the physical contact surface', () => {
  assert.equal(keyHeightAt(40), 24);
  assert.equal(keyHeightAt(64), 26);
  assert.equal(keyHeightAt(0), 0);
  assert.equal(keyHeightAt(156), 0);
  assert.equal(keyHeightAt(155), 12);
  assert.equal(keyHeightAt(NaN), 0);
  for (const profile of KEY_PROFILES) {
    SPEC.pinXs.forEach((x, index) => {
      assert.equal(keyHeightAt(x, profile.id), profile.lifts[index]);
    });
    for (const insertion of [0.2, 0.4, 0.6, 0.8, 1]) {
      evaluateLock({ keyId: profile.id, insertion }).pins.forEach((pin) => {
        const contactX = pin.x - (1 - insertion) * 160;
        assert.equal(pin.tipZ, SPEC.restTipZ + keyHeightAt(contactX, profile.id));
      });
    }
  }
});

test('rotation is clamped and withdrawal resets it to zero', () => {
  assert.equal(evaluateLock({ insertion: 1, angle: 45 }).angle, 45);
  assert.equal(evaluateLock({ insertion: 1, angle: 999 }).angle, 90);
  assert.equal(evaluateLock({ insertion: 1, angle: -5 }).angle, 0);
  assert.equal(evaluateLock({ insertion: 1, angle: 45 }).status, 'open');
  const removed = evaluateLock({ insertion: 0.9, angle: 45 });
  assert.equal(removed.angle, 0);
  assert.equal(removed.status, 'inserting');
});

test('out-of-range, missing, and invalid controls normalize predictably', () => {
  assert.equal(evaluateLock({ insertion: 20 }).insertion, 1);
  assert.equal(evaluateLock({ insertion: -20 }).insertion, 0);
  for (const value of [NaN, Infinity, -Infinity, '1', {}, true, null]) {
    const state = evaluateLock({ insertion: value });
    assert.equal(state.insertion, 0);
    assert.equal(state.canTurn, false);
    assert.equal(evaluateLock({ insertion: 1, angle: value }).angle, 0);
  }
  assert.equal(evaluateLock({ keyId: 'unknown' }).keyId, 'correct');
  assert.equal(evaluateLock(null).status, 'empty');
});

test('snapshots do not mutate controls or share writable pin state', () => {
  const controls = Object.freeze({ keyId: 'correct', insertion: 1, angle: 30 });
  const first = evaluateLock(controls);
  first.pins[0].lift = -999;
  assert.equal(evaluateLock(controls).pins[0].lift, 18);
  assert.equal(SPEC.correctLifts[0], 18);
  assert.deepEqual(controls, { keyId: 'correct', insertion: 1, angle: 30 });
});
