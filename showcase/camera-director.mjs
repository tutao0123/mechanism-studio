import { Quaternion, Vector3 } from 'three';

const clonePose = pose => ({ position: [...pose.position], target: [...pose.target], halfHeight: pose.halfHeight });
const clamp = value => Math.max(0, Math.min(1, value));
const smoothstep5 = t => t * t * t * (10 + t * (-15 + 6 * t));

function validatePose(pose) {
  for (const key of ['position', 'target']) {
    if (!Array.isArray(pose?.[key]) || pose[key].length !== 3 || ![0, 1, 2].every(index => Number.isFinite(pose[key][index]))) {
      throw new TypeError(`Camera ${key} must contain three finite coordinates.`);
    }
  }
  if (!Number.isFinite(pose.halfHeight) || pose.halfHeight <= 0) throw new TypeError('Camera halfHeight must be positive and finite.');
  const distance = new Vector3(...pose.position).distanceTo(new Vector3(...pose.target));
  if (!Number.isFinite(distance) || distance <= 0) throw new TypeError('Camera position and target must have a finite, non-zero separation.');
  return clonePose(pose);
}

function interpolatePose(from, to, amount) {
  if (amount <= 0) return clonePose(from);
  if (amount >= 1) return clonePose(to);
  const target = new Vector3(...from.target.map((value, index) => value * (1 - amount) + to.target[index] * amount));
  const fromOffset = new Vector3(...from.position).sub(new Vector3(...from.target));
  const toOffset = new Vector3(...to.position).sub(new Vector3(...to.target));
  const fromDistance = fromOffset.length(), toDistance = toOffset.length();
  const fromDirection = fromOffset.divideScalar(fromDistance), toDirection = toOffset.divideScalar(toDistance);
  // Rotate the eye around its moving target by the shortest arc. Unlike a
  // Cartesian eye lerp, opposite viewpoints cannot pass through the target.
  // The returned target remains compatible with the caller's camera.lookAt().
  const delta = new Quaternion().setFromUnitVectors(fromDirection, toDirection);
  const rotation = new Quaternion().slerp(delta, amount);
  const distance = Math.exp(Math.log(fromDistance) * (1 - amount) + Math.log(toDistance) * amount);
  const eye = fromDirection.applyQuaternion(rotation).multiplyScalar(distance).add(target);
  return {
    position: eye.toArray(), target: target.toArray(),
    halfHeight: Math.exp(Math.log(from.halfHeight) * (1 - amount) + Math.log(to.halfHeight) * amount),
  };
}

/**
 * Stateful only in captured camera origins; all progress comes from localTime.
 * No geometry, DOM, rendering loop, audio or independent clock is owned here.
 * Use cut:true for explicit seeks/restarts. reset(actualPose) resumes from orbit.
 */
export function createCameraDirector({ duration = 2.4 } = {}) {
  if (!Number.isFinite(duration) || duration < 0) throw new TypeError('Camera transition duration must be finite and non-negative.');
  let chapterKey = null, lastPose = null, transition = null, pendingResume = null, progress = 1;

  const reset = (fromPose = null) => {
    const origin = fromPose === null ? null : validatePose(fromPose);
    chapterKey = null; lastPose = origin; transition = null; pendingResume = origin && clonePose(origin); progress = 1;
  };

  const sample = ({ chapterKey: key, localTime, pose, cut = false } = {}) => {
    if ((typeof key !== 'string' || !key) && (typeof key !== 'number' || !Number.isFinite(key))) throw new TypeError('Camera chapterKey must be a non-empty string or finite number.');
    if (!Number.isFinite(localTime) || localTime < 0) throw new TypeError('Camera localTime must be finite and non-negative.');
    if (typeof cut !== 'boolean') throw new TypeError('Camera cut must be boolean.');
    const planned = validatePose(pose);
    if (cut || lastPose === null || duration === 0) {
      chapterKey = key; transition = pendingResume = null; progress = 1; lastPose = planned;
      return clonePose(lastPose);
    }
    if (pendingResume || key !== chapterKey) {
      transition = { from: clonePose(pendingResume ?? lastPose), startLocalTime: localTime };
      pendingResume = null; chapterKey = key;
    }
    progress = transition ? clamp((localTime - transition.startLocalTime) / duration) : 1;
    lastPose = transition ? interpolatePose(transition.from, planned, smoothstep5(progress)) : planned;
    return clonePose(lastPose);
  };

  const snapshot = () => ({
    chapterKey, lastPose: lastPose && clonePose(lastPose), transitioning: !!transition && progress < 1,
    progress, startLocalTime: transition?.startLocalTime ?? null, pendingResume: !!pendingResume,
  });
  return { sample, reset, snapshot };
}
