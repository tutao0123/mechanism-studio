import { evaluateLock } from '../model.mjs';

export const LESSON_STATES = Object.freeze({
  part: { keyId: 'correct', insertion: 0, angle: 0, camera: 'overview' },
  wrong: { keyId: 'wrong', insertion: 1, angle: 0, camera: 'section' },
  align: { keyId: 'correct', insertion: 1, angle: 0, camera: 'section' },
  turn: { keyId: 'correct', insertion: 1, angle: 90, camera: 'end' },
  reset: { keyId: 'correct', insertion: 0, angle: 0, camera: 'overview' },
});

export function createState() {
  return { mechanical: { keyId: 'correct', insertion: 0, angle: 0 },
    view: { camera: 'overview', cutaway: true, explode: 0, selected: null }, lesson: 'part' };
}

export function getSnapshot(state) {
  const lock = evaluateLock(state.mechanical);
  return { ...lock, allowedActions: { turn: lock.canTurn, insert: true, changeKey: true },
    uiBlockReason: state.view.explode > 0 ? '先合拢零件，再操作钥匙。' : null };
}

/** Atomic state transitions; view changes never alter the mechanical result. */
export function transition(state, action) {
  const next = { ...state, mechanical: { ...state.mechanical }, view: { ...state.view } };
  const snap = getSnapshot(state);
  switch (action.type) {
    case 'view':
      for (const field of ['camera', 'cutaway', 'selected']) {
        if (field in action) next.view[field] = action[field];
      }
      if ('explode' in action) next.view.explode = Number.isFinite(action.explode)
        ? Math.min(1, Math.max(0, action.explode)) : 0;
      break;
    case 'key':
      if (snap.uiBlockReason) return state;
      next.mechanical = { keyId: ['correct', 'wrong', 'blank'].includes(action.keyId) ? action.keyId : 'correct', insertion: 0, angle: 0 };
      next.lesson = null;
      break;
    case 'insertion':
      if (snap.uiBlockReason) return state;
      // Reset the requested angle before withdrawing. No force/collision simulation.
      next.mechanical.angle = 0;
      next.mechanical.insertion = action.value;
      next.lesson = null;
      break;
    case 'angle':
      if (snap.uiBlockReason || !snap.canTurn) return state;
      next.mechanical.angle = action.value;
      next.lesson = null;
      break;
    case 'lesson': {
      const target = LESSON_STATES[action.id];
      if (!target) return state;
      next.mechanical = { keyId: target.keyId, insertion: target.insertion, angle: target.angle };
      next.view = { ...next.view, camera: target.camera, cutaway: true, explode: 0, selected: null };
      next.lesson = action.id;
      break;
    }
    case 'reset': return createState();
    default: return state;
  }
  const normalized = evaluateLock(next.mechanical);
  next.mechanical = { keyId: normalized.keyId, insertion: normalized.insertion, angle: normalized.angle };
  return next;
}
