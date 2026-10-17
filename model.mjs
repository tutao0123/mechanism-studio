/**
 * A teaching model for a five-station pin tumbler lock.
 *
 * All dimensions are illustrative units. This is not an engineering drawing
 * or a measurement of a particular lock. The lower pins follow the same
 * piecewise-linear key contour used by the drawing as it moves 160 units from
 * right to left. Friction, spring forces, and collisions are not simulated.
 * A key must be fully seated before rotation is allowed. Removing it
 * resets the requested rotation to zero, instead of simulating a mechanical
 * collision during withdrawal.
 */

export const SPEC = Object.freeze({
  pinXs: Object.freeze([28, 52, 76, 100, 124]),
  pinLengths: Object.freeze([32, 20, 28, 16, 24]),
  correctLifts: Object.freeze([18, 30, 22, 34, 26]),
  driverLength: 36,
  pinRadius: 4.2,
  shearZ: 64,
  restTipZ: 14,
  springTopZ: 118,
  plugAxisZ: 36,
  plugRadius: 28,
  plugStartX: 6,
  plugLength: 146,
});

export const KEY_PROFILES = Object.freeze([
  Object.freeze({
    id: 'correct',
    name: '匹配钥匙',
    lifts: SPEC.correctLifts,
  }),
  Object.freeze({
    id: 'wrong',
    name: '错误钥匙',
    lifts: Object.freeze([18, 23, 22, 29, 26]),
  }),
  Object.freeze({
    id: 'blank',
    name: '空白钥匙',
    lifts: Object.freeze([10, 10, 10, 10, 10]),
  }),
]);

function clampFinite(value, minimum, maximum, fallback = minimum) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function selectKey(keyId) {
  return KEY_PROFILES.find((profile) => profile.id === keyId) ?? KEY_PROFILES[0];
}

/** Return fresh [x, height] key contour nodes in the key's local coordinates. */
export function keyOutline(keyId = 'correct') {
  const key = selectKey(keyId);
  return [
    [4, 0],
    [12, 3],
    ...SPEC.pinXs.map((x, index) => [x, key.lifts[index]]),
    [142, 12],
    [155, 12],
  ];
}

/**
 * Height above restTipZ at a local key coordinate. The far-right vertical
 * shoulder ends at x=155; outside the outlined key the height is zero.
 */
export function keyHeightAt(x, keyId = 'correct') {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < 4 || x > 155) return 0;
  const outline = keyOutline(keyId);
  for (let index = 1; index < outline.length; index += 1) {
    const [rightX, rightHeight] = outline[index];
    if (x <= rightX) {
      const [leftX, leftHeight] = outline[index - 1];
      const progress = (x - leftX) / (rightX - leftX);
      return leftHeight + (rightHeight - leftHeight) * progress;
    }
  }
  return 0;
}

/**
 * Return a fresh, deterministic snapshot without changing the input or DOM.
 *
 * pins.index and blockingPins use zero-based indexes. tipZ is the lower pin's
 * bottom; jointZ is the lower/upper pin joint; driverZ is the upper pin's center.
 * error is jointZ - shearZ. angle is in degrees, clamped to 0..90, and is gated
 * to zero unless every joint aligns with a fully inserted key.
 *
 * status: empty | inserting | blocked | ready | open.
 * Unknown key IDs select the matching key; non-finite/non-numeric controls
 * normalize to zero. Values outside their valid ranges are clamped.
 */
export function evaluateLock(input = {}) {
  const controls = input && typeof input === 'object' ? input : {};
  const insertion = clampFinite(controls.insertion ?? 0, 0, 1);
  const key = selectKey(controls.keyId);
  const seated = insertion === 1;

  const pins = SPEC.pinXs.map((x, index) => {
    const localX = x - (1 - insertion) * 160;
    const lift = keyHeightAt(localX, key.id);
    const length = SPEC.pinLengths[index];
    const tipZ = SPEC.restTipZ + lift;
    const jointZ = tipZ + length;
    const error = jointZ - SPEC.shearZ;
    // Report actual contact alignment independently of the seating gate.
    // Exact equality keeps near-1 insertion from treating all small errors as 0.
    const aligned = error === 0;

    return {
      index,
      x,
      length,
      lift,
      tipZ,
      jointZ,
      driverZ: jointZ + SPEC.driverLength / 2,
      error,
      aligned,
      blocked: !aligned,
    };
  });

  const blockingPins = pins.filter((pin) => pin.blocked).map((pin) => pin.index);
  const alignedCount = pins.length - blockingPins.length;
  const canTurn = seated && alignedCount === pins.length;
  const angle = canTurn ? clampFinite(controls.angle ?? 0, 0, 90) : 0;
  const status = angle > 0 ? 'open'
    : canTurn ? 'ready'
      : insertion === 0 ? 'empty'
        : seated ? 'blocked'
          : 'inserting';

  return {
    insertion,
    keyId: key.id,
    angle,
    pins,
    alignedCount,
    canTurn,
    blockingPins,
    status,
  };
}
