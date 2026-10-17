import { applyWorkingPoses, applyDisplayExplosion, resetDisplay } from '../../shared/viewer/scene.mjs';
import { SPEC, LEGS, robotState, motionPoses, bodyToGLTF } from '../../examples/quadruped/model.mjs';

// The source contract stores these vectors in Blender's body axes, already in
// metres. Convert the basis once; applying bodyToGLTF would scale them twice.
export function explosionVector(binding) {
  const [x, y, z] = binding.record?.explode || [0, 0, 0];
  return [x, z, -y];
}

function extrema(low, high, fn, stationary) {
  const values = [fn(low), fn(high)];
  for (let turn = -4; turn <= 4; turn++) {
    const angle = stationary + turn * Math.PI;
    if (angle >= low && angle <= high) values.push(fn(angle));
  }
  return [Math.min(...values), Math.max(...values)];
}

// Continuous bounds, not a phase sampling: all showcased foot targets lie in
// x=[-stride/2,+stride/2], z=[footRadius,footRadius+60]. The two-link triangle
// bounds the hip and knee angles over that entire rectangle. This covers both
// the trot and single-leg motions, including their intermediate poses.
export function motionRanges() {
  const x = SPEC.stride / 2, dMin = SPEC.hipHeight - SPEC.footRadius - 60;
  const dMax = SPEC.hipHeight - SPEC.footRadius;
  const rMin = dMin, rMax = Math.hypot(x, dMax), a = SPEC.thigh, b = SPEC.shin;
  const beta = r => Math.acos((a * a + r * r - b * b) / (2 * a * r));
  const knee = r => Math.acos((r * r - a * a - b * b) / (2 * a * b));
  const theta = Math.atan2(x, dMin);
  const hip = [-theta - beta(rMin), theta - beta(rMax)];
  const shin = [hip[0] + knee(rMax), hip[1] + knee(rMin)];
  const sin = extrema(...hip, Math.sin, Math.PI / 2), cos = extrema(...hip, Math.cos, 0);
  const result = {};
  for (const leg of LEGS) {
    const center = bodyToGLTF([leg.x, leg.y, SPEC.hipHeight]);
    result[`thigh-${leg.id}`] = { rotationZ: hip, position: { min: center, max: center } };
    result[`shin-${leg.id}`] = { rotationZ: shin, position: {
      min: [(leg.x + a * sin[0]) * .001, (SPEC.hipHeight - a * cos[1]) * .001, -leg.y * .001],
      max: [(leg.x + a * sin[1]) * .001, (SPEC.hipHeight - a * cos[0]) * .001, -leg.y * .001],
    } };
    result[`foot-${leg.id}`] = { rotationZ: [0, 0], position: {
      min: [(leg.x - x) * .001, SPEC.footRadius * .001, -leg.y * .001],
      max: [(leg.x + x) * .001, (SPEC.footRadius + 60) * .001, -leg.y * .001],
    } };
  }
  return result;
}

/** Copies transforms and shares only read-only geometry. The source pose,
 * hierarchy, visibility and display wrappers remain untouched by planning.
 * This is deliberately separate from the engines' X-axis framing helper. */
export function createQuadrupedFraming(THREE, viewer) {
  const copies = new Map();
  function copyTransform(source) {
    if (copies.has(source)) return copies.get(source);
    const copy = new THREE.Object3D(); copies.set(source, copy);
    copy.position.copy(source.position); copy.quaternion.copy(source.quaternion); copy.scale.copy(source.scale);
    if (source.parent) copyTransform(source.parent).add(copy);
    return copy;
  }
  const parts = new Map([...viewer.parts].map(([id, part]) => [id, {
    id, node: copyTransform(part.node), model: copyTransform(part.model), display: copyTransform(part.display), record: part.record,
  }]));
  const meshes = viewer.meshes.map(source => ({ source, copy: copyTransform(source) }));
  const roots = [...copies.values()].filter(copy => !copy.parent);
  const sync = () => { for (const root of roots) root.updateMatrixWorld(true); };
  resetDisplay(parts); applyWorkingPoses(parts, motionPoses(robotState()), { target: 'node' }); sync();
  const ranges = motionRanges(), records = [];
  for (const { source, copy } of meshes) {
    const part = parts.get(source.userData.selectionId);
    if (!part) throw new Error('Quadruped framing requires a semantic mesh binding.');
    const range = ranges[part.id], box = new THREE.Box3();
    if (!range) {
      if (!source.geometry.boundingBox) source.geometry.computeBoundingBox();
      records.push({ id: part.id, copy, box: source.geometry.boundingBox.clone() });
      continue;
    }
    if (Math.abs(part.node.rotation.x) > 1e-8 || Math.abs(part.node.rotation.y) > 1e-8) throw new Error('Quadruped poses require the declared glTF Z-axis pitch.');
    const relative = part.node.matrixWorld.clone().invert().multiply(copy.matrixWorld);
    const local = new THREE.Matrix4().makeScale(...part.node.scale.toArray()).multiply(relative);
    const attribute = source.geometry.getAttribute('position'), vertex = new THREE.Vector3();
    const [low, high] = range.rotationZ;
    for (let index = 0; index < attribute.count; index++) {
      vertex.fromBufferAttribute(attribute, index).applyMatrix4(local);
      const { x, y, z } = vertex;
      const xs = extrema(low, high, angle => x * Math.cos(angle) - y * Math.sin(angle), Math.atan2(-y, x));
      const ys = extrema(low, high, angle => x * Math.sin(angle) + y * Math.cos(angle), Math.atan2(x, y));
      box.expandByPoint(new THREE.Vector3(xs[0], ys[0], z)); box.expandByPoint(new THREE.Vector3(xs[1], ys[1], z));
    }
    box.min.add(new THREE.Vector3(...range.position.min)); box.max.add(new THREE.Vector3(...range.position.max));
    records.push({ id: part.id, copy: part.node.parent, box });
  }
  function envelope(explode, ids = null) {
    applyDisplayExplosion(parts, explode, explosionVector); sync();
    const box = new THREE.Box3();
    for (const record of records) if (!ids || ids.has(record.id)) box.union(record.box.clone().applyMatrix4(record.copy.matrixWorld));
    if (box.isEmpty()) throw new Error('Quadruped camera envelope is empty.');
    return box;
  }
  // Include the cover even when hidden in a teaching close-up. The assembly
  // chapter reveals it; visibility never changes a planned wide composition.
  const overview = envelope(0), assembly = overview.clone().union(envelope(1));
  const frontLeft = envelope(0, new Set(['hip-fl', 'thigh-fl', 'shin-fl', 'foot-fl']));
  for (const leg of LEGS) for (const x of [-SPEC.stride / 2, SPEC.stride / 2]) for (const z of [0, SPEC.footRadius + 60]) {
    const point = new THREE.Vector3(...bodyToGLTF([leg.x + x, leg.y, z]));
    overview.expandByPoint(point); assembly.expandByPoint(point);
    if (leg.id === 'fl') frontLeft.expandByPoint(point);
  }
  for (const leg of LEGS) for (const x of [-SPEC.stride / 2 - 14, SPEC.stride / 2 + 14]) for (const y of [leg.y - 14, leg.y + 14]) {
    overview.expandByPoint(new THREE.Vector3(...bodyToGLTF([leg.x + x, y, 0])));
  }
  assembly.union(overview);
  overview.expandByScalar(.003); assembly.expandByScalar(.003); frontLeft.expandByScalar(.006);
  return { overview, joints: frontLeft.clone(), trajectory: frontLeft.clone(), gait: overview.clone(), stance: overview.clone(), assembly };
}
