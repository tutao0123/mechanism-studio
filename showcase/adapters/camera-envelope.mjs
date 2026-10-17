import { applyWorkingPoses, applyDisplayExplosion, resetDisplay, isWorldVisible } from '../../shared/viewer/scene.mjs';

/** Plan against copied transforms and shared, read-only geometry. No source
 * transform is sampled or changed, and no live bounds enter the camera clock.
 * These two teaching assets use X-axis rotation and bounded translation only.
 */
export function createFramingEnvelopes(THREE, viewer, { referencePoses, motionRanges = {}, explodeVector, points = [] }) {
  const copies = new Map();
  function copyTransform(source) {
    if (copies.has(source)) return copies.get(source);
    const copy = new THREE.Object3D(); copies.set(source, copy);
    copy.position.copy(source.position); copy.quaternion.copy(source.quaternion); copy.scale.copy(source.scale);
    copy.visible = source.visible;
    if (source.parent) copyTransform(source.parent).add(copy);
    return copy;
  }
  const parts = new Map();
  for (const [id, part] of viewer.parts) parts.set(id, {
    id, node: copyTransform(part.node), model: copyTransform(part.model),
    display: copyTransform(part.display), record: part.record,
  });
  const meshes = viewer.meshes.map(mesh => ({ source: mesh, copy: copyTransform(mesh) }));
  const roots = [...copies.values()].filter(node => !node.parent);
  const sync = () => { for (const root of roots) root.updateMatrixWorld(true); };
  resetDisplay(parts); applyWorkingPoses(parts, referencePoses, { target: 'node' });
  for (const part of parts.values()) part.display.visible = !part.record?.cutawayHidden;
  sync();

  const planned = [];
  for (const { source, copy } of meshes) {
    if (!isWorldVisible(copy)) continue;
    const part = parts.get(source.userData.selectionId);
    if (!part) throw new Error('Camera envelope mesh is missing its semantic binding.');
    if (!source.geometry.boundingBox) source.geometry.computeBoundingBox();
    const range = motionRanges[part.id];
    if (!range) { planned.push({ copy, box: source.geometry.boundingBox.clone() }); continue; }
    if (Math.abs(part.node.rotation.y) > 1e-8 || Math.abs(part.node.rotation.z) > 1e-8) throw new Error('Camera envelope requires the declared X-axis motion.');
    const relative = part.node.matrixWorld.clone().invert().multiply(copy.matrixWorld);
    const scaled = new THREE.Matrix4().makeScale(...part.node.scale.toArray()).multiply(relative);
    let box;
    if (range.rotationX === 'full') {
      // The maximum vertex radius bounds the complete circular sweep, without
      // enlarging a circular fan by using a square bounding-box diagonal.
      const positions = source.geometry.getAttribute('position'), vertex = new THREE.Vector3();
      let minX = Infinity, maxX = -Infinity, radius = 0;
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(scaled);
        minX = Math.min(minX, vertex.x); maxX = Math.max(maxX, vertex.x);
        radius = Math.max(radius, Math.hypot(vertex.y, vertex.z));
      }
      box = new THREE.Box3(new THREE.Vector3(minX, -radius, -radius), new THREE.Vector3(maxX, radius, radius));
    } else {
      const interval = range.rotationX ?? [part.node.rotation.x, part.node.rotation.x];
      box = rotatedBox(THREE, source.geometry.boundingBox.clone().applyMatrix4(scaled), interval);
    }
    const position = range.position ?? { min: part.node.position.toArray(), max: part.node.position.toArray() };
    box.min.add(new THREE.Vector3(...position.min)); box.max.add(new THREE.Vector3(...position.max));
    planned.push({ copy: part.node.parent, box });
  }

  function worldEnvelope(explode) {
    applyDisplayExplosion(parts, explode, explodeVector); sync();
    const box = new THREE.Box3();
    for (const record of planned) box.union(record.box.clone().applyMatrix4(record.copy.matrixWorld));
    if (box.isEmpty()) throw new Error('Camera envelope has no visible geometry.');
    return box;
  }
  const overview = worldEnvelope(0), assembly = overview.clone().union(worldEnvelope(1));
  // Process paths are explicit teaching geometry, not CAD/picking bounds.
  for (const point of points) overview.expandByPoint(new THREE.Vector3(...point));
  assembly.union(overview);
  overview.expandByScalar(.001); assembly.expandByScalar(.001);
  return { overview, assembly };
}

function rotatedBox(THREE, box, [low, high]) {
  if (![low, high].every(Number.isFinite) || low > high || high - low > Math.PI * 2) throw new Error('Invalid planned rotation interval.');
  const result = new THREE.Box3();
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const angles = [low, high];
    for (const stationary of [Math.atan2(-z, y), Math.atan2(y, z)]) {
      for (let turn = -3; turn <= 3; turn++) {
        const angle = stationary + turn * Math.PI;
        if (angle >= low && angle <= high) angles.push(angle);
      }
    }
    for (const angle of angles) result.expandByPoint(new THREE.Vector3(x, y * Math.cos(angle) - z * Math.sin(angle), y * Math.sin(angle) + z * Math.cos(angle)));
  }
  return result;
}
