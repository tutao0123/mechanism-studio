import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLock } from '../../model.mjs';
import { createState, getSnapshot, transition } from '../controller.mjs';

function act(state, type, fields = {}) {
  return transition(state, { type, ...fields });
}

function seat(keyId = 'correct', insertion = 1) {
  let state = act(createState(), 'key', { keyId });
  return act(state, 'insertion', { value: insertion });
}

function mechanicalSnapshot(snapshot) {
  const { allowedActions, uiBlockReason, ...lock } = snapshot;
  return lock;
}

function deepFreeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object' && !Object.isFrozen(child)) deepFreeze(child);
  }
  return value;
}

test('controller snapshots agree with the existing pure lock model over key and insertion boundaries', () => {
  for (const keyId of ['correct', 'wrong', 'blank']) {
    for (const insertion of [0, 0.3, 0.75, 0.99, 1 - Number.EPSILON, 1]) {
      for (const requestedAngle of [0, 45, 90]) {
        const state = act(seat(keyId, insertion), 'angle', { value: requestedAngle });
        const snapshot = getSnapshot(state);
        assert.deepEqual(mechanicalSnapshot(snapshot), evaluateLock(state.mechanical));
        assert.equal(snapshot.allowedActions.turn, snapshot.canTurn);
        if (keyId !== 'correct' || insertion !== 1) {
          assert.equal(snapshot.angle, 0);
          assert.equal(snapshot.canTurn, false);
        } else {
          assert.equal(snapshot.angle, requestedAngle);
          assert.equal(snapshot.alignedCount, 5);
        }
      }
    }
  }
});

test('a locally aligned joint during partial insertion never permits whole-lock rotation', () => {
  const state = act(seat('correct', 0.75), 'angle', { value: 90 });
  const snapshot = getSnapshot(state);
  assert.equal(snapshot.pins[4].aligned, true);
  assert.equal(snapshot.pins[4].error, 0);
  assert.equal(snapshot.canTurn, false);
  assert.equal(snapshot.allowedActions.turn, false);
  assert.equal(snapshot.angle, 0);
});

test('wrong and blank keys stay blocked with model-derived reasons', () => {
  for (const keyId of ['wrong', 'blank']) {
    const state = seat(keyId);
    const attempted = act(state, 'angle', { value: 90 });
    assert.strictEqual(attempted, state);
    const snapshot = getSnapshot(attempted);
    assert.equal(snapshot.status, 'blocked');
    assert.equal(snapshot.angle, 0);
    assert.ok(snapshot.blockingPins.length > 0);
  }
  assert.deepEqual(getSnapshot(seat('wrong')).blockingPins, [1, 3]);
});

test('camera, cutaway, selection and exploded display preserve mechanical state and allowed actions', () => {
  const bases = [seat('wrong'), seat('blank'), seat('correct', 0.75), act(seat(), 'angle', { value: 90 })];
  for (const base of bases) {
    const before = structuredClone(base);
    deepFreeze(base);
    for (const camera of ['overview', 'section', 'end']) {
      for (const explode of [0, 0.4, 1]) {
        const next = act(base, 'view', { camera, cutaway: false, explode, selected: 'driver-pin-2' });
        assert.deepEqual(next.mechanical, before.mechanical);
        assert.deepEqual(mechanicalSnapshot(getSnapshot(next)), mechanicalSnapshot(getSnapshot(base)));
        assert.deepEqual(getSnapshot(next).allowedActions, getSnapshot(base).allowedActions);
        assert.equal(next.view.camera, camera);
        assert.equal(next.view.cutaway, false);
        assert.equal(next.view.selected, 'driver-pin-2');
      }
    }
    assert.deepEqual(base, before);
  }
});

test('exploded view blocks key controls without changing the model turn permission', () => {
  const ready = seat();
  const exploded = act(ready, 'view', { explode: 1 });
  const snapshot = getSnapshot(exploded);
  assert.equal(snapshot.canTurn, true);
  assert.equal(snapshot.allowedActions.turn, true);
  assert.ok(snapshot.uiBlockReason);
  for (const [type, fields] of [
    ['key', { keyId: 'wrong' }],
    ['insertion', { value: 0 }],
    ['angle', { value: 90 }],
  ]) {
    assert.strictEqual(act(exploded, type, fields), exploded);
  }
  const assembled = act(exploded, 'view', { explode: 0 });
  assert.equal(getSnapshot(assembled).uiBlockReason, null);
  assert.equal(getSnapshot(act(assembled, 'angle', { value: 90 })).angle, 90);
});

test('withdrawing or changing an open key returns the plug to zero atomically', () => {
  const open = act(seat(), 'angle', { value: 90 });
  const before = structuredClone(open);
  deepFreeze(open);
  const withdrawn = act(open, 'insertion', { value: 0.8 });
  assert.equal(withdrawn.mechanical.angle, 0);
  assert.equal(withdrawn.mechanical.insertion, 0.8);
  assert.equal(getSnapshot(withdrawn).canTurn, false);
  assert.equal(withdrawn.lesson, null);
  const changed = act(open, 'key', { keyId: 'wrong' });
  assert.deepEqual(changed.mechanical, { keyId: 'wrong', insertion: 0, angle: 0 });
  assert.equal(changed.lesson, null);
  assert.deepEqual(open, before);
});

const lessonTargets = {
  part: { keyId: 'correct', insertion: 0, angle: 0, camera: 'overview', status: 'empty' },
  wrong: { keyId: 'wrong', insertion: 1, angle: 0, camera: 'section', status: 'blocked' },
  align: { keyId: 'correct', insertion: 1, angle: 0, camera: 'section', status: 'ready' },
  turn: { keyId: 'correct', insertion: 1, angle: 90, camera: 'end', status: 'open' },
  reset: { keyId: 'correct', insertion: 0, angle: 0, camera: 'overview', status: 'empty' },
};

test('each tutorial step is a complete atomic target and assembles an exploded display', () => {
  const openExploded = act(act(seat(), 'angle', { value: 90 }), 'view', {
    camera: 'overview', cutaway: false, explode: 0.7, selected: 'key-correct',
  });
  for (const [id, target] of Object.entries(lessonTargets)) {
    const state = act(openExploded, 'lesson', { id });
    assert.deepEqual(state.mechanical, { keyId: target.keyId, insertion: target.insertion, angle: target.angle });
    assert.deepEqual(state.view, { camera: target.camera, cutaway: true, explode: 0, selected: null });
    assert.equal(state.lesson, id);
    assert.equal(getSnapshot(state).status, target.status);
    assert.equal(getSnapshot(state).uiBlockReason, null);
  }
});

test('rapid lesson replacements retain only the latest target; invalid steps preserve the current target', () => {
  let state = createState();
  for (const id of ['turn', 'wrong', 'align', 'part', 'turn', 'reset']) {
    state = act(state, 'lesson', { id });
    assert.equal(state.lesson, id);
    assert.equal(getSnapshot(state).status, lessonTargets[id].status);
  }
  assert.deepEqual(state.mechanical, { keyId: 'correct', insertion: 0, angle: 0 });
  assert.strictEqual(act(state, 'lesson', { id: 'missing-step' }), state);
});

test('reset is available from all tutorial targets and an exploded display', () => {
  for (const id of Object.keys(lessonTargets)) {
    const state = act(act(createState(), 'lesson', { id }), 'view', { explode: 1, selected: 'shell' });
    const reset = act(state, 'reset');
    assert.deepEqual(reset, createState());
    assert.equal(getSnapshot(reset).angle, 0);
    assert.equal(getSnapshot(reset).insertion, 0);
    assert.equal(getSnapshot(reset).uiBlockReason, null);
    assert.deepEqual(act(reset, 'reset'), reset);
  }
});

test('control normalization preserves the model gates at non-finite and out-of-range values', () => {
  for (const value of [NaN, Infinity, -Infinity, '1', {}, true, null, -5, 5]) {
    const state = act(createState(), 'insertion', { value });
    const expected = evaluateLock({ keyId: 'correct', insertion: value, angle: 0 });
    assert.equal(state.mechanical.insertion, expected.insertion);
    assert.equal(getSnapshot(state).canTurn, expected.canTurn);
    const turned = act(seat(), 'angle', { value });
    assert.equal(turned.mechanical.angle, evaluateLock({ insertion: 1, angle: value }).angle);
  }
  for (const [value, expected] of [[-1, 0], [2, 1], [NaN, 0], [Infinity, 0]]) {
    assert.equal(act(seat(), 'view', { explode: value }).view.explode, expected);
  }
});

test('state and derived snapshots do not share mutable values across independent instances', () => {
  const first = createState();
  const second = createState();
  first.mechanical.insertion = 1;
  first.view.explode = 1;
  assert.equal(second.mechanical.insertion, 0);
  assert.equal(second.view.explode, 0);
  const snapshot = getSnapshot(seat());
  snapshot.pins[0].error = 999;
  snapshot.allowedActions.turn = false;
  assert.equal(getSnapshot(seat()).pins[0].error, 0);
  assert.equal(getSnapshot(seat()).allowedActions.turn, true);
});
