/** Source-backed SO-ARM working poses. Original GLB nodes remain immutable. */
import { Box3, Euler, Matrix4, Quaternion, Vector3 } from 'three';

export const JOINT_RIG_REVISION = 'so-arm102-source-joints-1';
export const PINNED_SOURCE_SHA256 = 'd52437d3f901077d084492d81b4037952273a76d0a229bf7cf7de7ac5836da4f';
const SOURCE_REVISION = 'e871f738c97f43de230cb04d340797da6a68c4b9';
const B = new Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);
const INVERSE_B = B.clone().invert();
const LIMIT_EPSILON = 1e-12;
const REST_EPSILON = 1e-12;
const ROOT = 'base_link';
const partId = link => `urdf:${link}`;
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const finiteVector = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);

// Source-specific evidence, not new mechanism parameters. These values are
// checked against the retained, SHA-pinned URDF in tests. Keeping the selected
// motion fields here also rejects modified parsed metadata carrying an old SHA.
const PINNED_JOINTS = [
  ['base_to_link1', 'revolute', 'base_link', 'link1_1', [-.006, -1.10978314851e-16, .025], [-3.48927236311e-15, -1.38855301773e-17, -1], -3.07177948351, 3.07177948351],
  ['link1_to_link2', 'revolute', 'link1_1', 'link2_1', [.04, -.018, .073356707952], [3.7576779295e-14, -1, 3.11848821907e-14], -2.32128790515, 1.58824961931],
  ['link2_to_link3', 'revolute', 'link2_1', 'link3_1', [.0000339589458789, .035999879491, .113000833762], [5.4643524895e-8, -1, 3.71447673953e-8], -1.57079632679, 2.67035375555],
  ['link3_to_link4', 'revolute', 'link3_1', 'link4_1', [.135059233654, -2.61233757511e-7, .0336375809223], [-5.21611917629e-8, 1, -3.41984371354e-8], -1.72787595947, 1.69296937443],
  ['link4_to_link5', 'revolute', 'link4_1', 'link5_1', [.0591945817497, -.0180002669618, -.0000403637807994], [-1, -4.90398764451e-8, 1.40482066922e-10], -2.87979326579, 2.84488668075],
  ['clamp1', 'prismatic', 'link5_1', 'clamp1_1', [.0639999993385, .0165020797222, .0159979235363], [-5.21612507542e-8, 1, 4.50838078172e-8], 0, .0415],
  ['clamp2', 'prismatic', 'link5_1', 'clamp2_1', [.0640000007627, -.0154979202778, .0159979219163], [-4.9039873492e-8, 1, 4.73420869362e-8], -.0415, 3.46944695195e-17],
].map(([name, type, parent, child, xyz, axis, lower, upper]) => ({
  name, type, parent, child, origin: { xyz, rpy: [0, 0, 0] }, axis,
  limit: { effort: 100, velocity: 100, lower, upper },
  ...(name === 'clamp2' ? { mimic: { joint: 'clamp1', multiplier: -1, offset: 0 } } : {}),
}));

function motionFields(joint) {
  return {
    name: joint?.name, type: joint?.type, parent: joint?.parent, child: joint?.child,
    origin: { xyz: joint?.origin?.xyz, rpy: joint?.origin?.rpy }, axis: joint?.axis,
    limit: { effort: joint?.limit?.effort, velocity: joint?.limit?.velocity, lower: joint?.limit?.lower, upper: joint?.limit?.upper },
    ...(joint?.mimic ? { mimic: { joint: joint.mimic.joint, multiplier: joint.mimic.multiplier, offset: joint.mimic.offset } } : {}),
  };
}
function nearMatrix(actual, expected, label) {
  ensure(finiteVector(actual, 16), `${label}: expected a finite 16-value matrix`);
  ensure(actual.every((value, index) => Math.abs(value - expected.elements[index]) <= REST_EPSILON), `${label}: source rest matrix differs`);
}
function originMatrix(origin) {
  return new Matrix4().compose(new Vector3(...origin.xyz), new Quaternion().setFromEuler(new Euler(...origin.rpy, 'ZYX')), new Vector3(1, 1, 1));
}
function copyBox(box) { return { min: box.min.toArray(), max: box.max.toArray() }; }

/**
 * All methods are synchronous, absolute in q, and return fresh mutable results.
 * q uses native joint names, metres and radians. clamp2 follows source mimic.
 * posesAt writes ONLY viewer.model, which precedes an immutable source node J:
 *     wrapper D = J * M(q) * inverse(J); effective local = D * J = J * M(q).
 * No display explosion is included. Keep q=0 during the editorial explosion.
 */
export function createRobotJointRig(sourceAssembly, index) {
  ensure(sourceAssembly?.sourceSHA256 === PINNED_SOURCE_SHA256 && index?.source?.sha256 === PINNED_SOURCE_SHA256, 'Joint rig requires the pinned SO-ARM URDF digest in source metadata and scene index');
  ensure(index.source.revision === SOURCE_REVISION, 'Joint rig source revision differs');
  ensure(sourceAssembly.robotName === 'so_arm_102_pre_for_urdf_v5', 'Joint rig robot name differs');
  ensure(sourceAssembly.sourceUnits?.length === 'm' && sourceAssembly.sourceUnits?.angle === 'rad' && index.units === 'm', 'Joint rig requires metre/radian source and metre display units');
  ensure(sourceAssembly.sourceCoordinateBasis === 'right-handed Z up' && index.coordinateBasis === 'glTF right-handed Y up; B=[x,z,-y]', 'Joint rig coordinate basis differs');
  ensure(Array.isArray(sourceAssembly.joints) && sourceAssembly.joints.length === 7, 'Joint rig requires seven source joints');
  const sourceJoints = new Map(sourceAssembly.joints.map(joint => [joint.name, joint]));
  ensure(sourceJoints.size === 7, 'Joint rig source joint names must be unique');
  for (const pinned of PINNED_JOINTS) ensure(JSON.stringify(motionFields(sourceJoints.get(pinned.name))) === JSON.stringify(pinned), `Pinned URDF joint metadata differs: ${pinned.name}`);

  const linkNames = [ROOT, ...PINNED_JOINTS.map(joint => joint.child)];
  ensure(Array.isArray(sourceAssembly.links) && sourceAssembly.links.length === 8 && new Set(sourceAssembly.links.map(link => link.name)).size === 8 && sourceAssembly.links.every(link => linkNames.includes(link.name)), 'Joint rig requires eight original source links');
  ensure(Array.isArray(index.parts) && index.parts.length === 8, 'Joint rig requires eight scene-index parts');
  const parts = new Map(index.parts.map(part => [part.id, part]));
  ensure(parts.size === 8 && linkNames.every(link => parts.has(partId(link))), 'Joint rig scene-index identities differ');
  const records = new Map();
  for (const joint of PINNED_JOINTS) {
    const sourceRest = originMatrix(joint.origin);
    const rest = B.clone().multiply(sourceRest).multiply(INVERSE_B);
    records.set(joint.child, {
      ...joint, sourceRest, rest, inverseRest: rest.clone().invert(),
      axis: new Vector3(...joint.axis).normalize(),
    });
  }

  const zeroWorld = new Map(), zeroSourceWorld = new Map(), bounds = new Map();
  for (const link of linkNames) {
    const record = records.get(link), part = parts.get(partId(link));
    ensure(part.name === link && part.source?.link === link && part.parentId === (record ? partId(record.parent) : null), `Source identity/parent differs: ${partId(link)}`);
    ensure(part.zeroPose === true, `Scene-index pose must remain original zero: ${partId(link)}`);
    if (record) ensure(part.source.joint === record.name && part.source.parentLink === record.parent, `Scene-index source joint mapping differs: ${partId(link)}`);
    const rest = record?.rest ?? new Matrix4();
    nearMatrix(part.localMatrix, rest, `${partId(link)} local`);
    const world = record ? zeroWorld.get(record.parent).clone().multiply(rest) : rest.clone();
    const sourceWorld = record ? zeroSourceWorld.get(record.parent).clone().multiply(record.sourceRest) : new Matrix4();
    nearMatrix(part.worldMatrix, world, `${partId(link)} world`);
    nearMatrix(sourceAssembly.sourceWorldMatrices?.[link], sourceWorld, `${partId(link)} native source world`);
    zeroWorld.set(link, world); zeroSourceWorld.set(link, sourceWorld);
    ensure(finiteVector(part.localBounds?.min, 3) && finiteVector(part.localBounds?.max, 3) && part.localBounds.min.every((value, axis) => value <= part.localBounds.max[axis]), `Finite ordered local mesh bounds required: ${partId(link)}`);
    bounds.set(link, new Box3(new Vector3(...part.localBounds.min), new Vector3(...part.localBounds.max)));
  }

  function resolvedValuesAt(values = {}) {
    ensure(values !== null && typeof values === 'object' && !Array.isArray(values) && (Object.getPrototypeOf(values) === Object.prototype || Object.getPrototypeOf(values) === null), 'Joint values must be a plain object keyed by native joint names');
    for (const name of Reflect.ownKeys(values)) ensure(typeof name === 'string' && sourceJoints.has(name), `Unknown source joint: ${String(name)}`);
    const result = Object.fromEntries(PINNED_JOINTS.map(joint => [joint.name, Object.hasOwn(values, joint.name) ? values[joint.name] : 0]));
    for (const [name, value] of Object.entries(result)) ensure(Number.isFinite(value), `Joint value must be finite: ${name}`);
    const expectedMimic = -result.clamp1;
    ensure(!Object.hasOwn(values, 'clamp2') || Math.abs(result.clamp2 - expectedMimic) <= LIMIT_EPSILON, 'clamp2 must follow source mimic: -clamp1');
    result.clamp2 = expectedMimic;
    for (const joint of PINNED_JOINTS) {
      const value = result[joint.name], { lower, upper } = joint.limit;
      ensure(value >= lower - LIMIT_EPSILON && value <= upper + LIMIT_EPSILON, `Joint value outside source limits: ${joint.name}`);
      // Only round-off at a bound is clamped. Authored out-of-range input fails.
      result[joint.name] = Math.max(lower, Math.min(upper, value));
    }
    // Resolve after round-off clamping so mimic remains exact at both limits.
    result.clamp2 = -result.clamp1;
    return result;
  }
  function motionMatrix(record, q) {
    const native = record.type === 'revolute'
      ? new Matrix4().makeRotationAxis(record.axis, q)
      : new Matrix4().makeTranslation(...record.axis.clone().multiplyScalar(q).toArray());
    return B.clone().multiply(native).multiply(INVERSE_B);
  }
  function posesAt(values = {}) {
    const q = resolvedValuesAt(values), result = new Map();
    for (const record of records.values()) {
      // Exact identity at q=0 prevents tiny accumulated display/reset drift.
      const wrapper = q[record.name] === 0 ? new Matrix4() : record.rest.clone().multiply(motionMatrix(record, q[record.name])).multiply(record.inverseRest);
      const position = new Vector3(), quaternion = new Quaternion(), scale = new Vector3();
      wrapper.decompose(position, quaternion, scale); quaternion.normalize();
      result.set(partId(record.child), { position: position.toArray(), quaternion: quaternion.toArray(), scale: scale.toArray() });
    }
    return result;
  }
  function worldMatricesAt(values = {}) {
    const q = resolvedValuesAt(values), worlds = new Map([[ROOT, new Matrix4()]]);
    for (const record of records.values()) worlds.set(record.child, worlds.get(record.parent).clone().multiply(record.rest).multiply(motionMatrix(record, q[record.name])));
    return new Map(linkNames.map(link => [partId(link), worlds.get(link).toArray()]));
  }
  function boundsAt(values = {}) {
    const worlds = worldMatricesAt(values);
    return new Map(linkNames.map(link => [partId(link), copyBox(bounds.get(link).clone().applyMatrix4(new Matrix4().fromArray(worlds.get(partId(link)))))]));
  }
  return Object.freeze({
    revision: JOINT_RIG_REVISION, sourceSHA256: PINNED_SOURCE_SHA256,
    workingOwner: 'kinetic source-joint rig -> viewer.model; immutable source nodes retain static rest ownership',
    boundsMethod: 'Conservative axis-aligned bounds of all eight corners of each actual source-link local mesh AABB transformed by source forward kinematics; not collision bounds or an exact mesh sweep',
    jointNames: Object.freeze(PINNED_JOINTS.map(joint => joint.name)),
    resolvedValuesAt, posesAt, worldMatricesAt, boundsAt,
  });
}
