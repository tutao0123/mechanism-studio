import * as THREE from 'three';

export function isWorldVisible(node) {
  for (let ancestor = node; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) return false;
  return true;
}

// The original GLB node retains its transform and source identity. Display and
// working-pose wrappers are distinct so an exploded view cannot alter a pose.
export function bindAssembly(assetRoot, { contract = null, parentForPart, configureMesh } = {}) {
  const nodes = [];
  assetRoot.traverse(node => { if (typeof node.userData.part_id === 'string') nodes.push(node); });
  if (!nodes.length) throw new Error('资产没有稳定零件 part_id');
  const records = new Map((contract?.parts || []).map(record => [record.part_id, record]));
  if (contract && (records.size !== contract.parts.length || records.size !== nodes.length)) throw new Error('资产与零件契约数量不一致');
  const parts = new Map(), meshes = [];
  assetRoot.updateWorldMatrix(true, true);
  for (const node of nodes) {
    const id = node.userData.part_id;
    if (parts.has(id)) throw new Error(`重复零件 ID：${id}`);
    if (contract && !records.has(id)) throw new Error(`契约缺少零件：${id}`);
    const originalParent = node.parent;
    const targetParent = parentForPart?.(id, node) || originalParent;
    if (!targetParent) throw new Error(`零件没有装配父层：${id}`);
    const display = new THREE.Group(); display.name = `${id}/display`;
    const model = new THREE.Group(); model.name = `${id}/model`; display.add(model);
    targetParent.add(display);
    if (targetParent === originalParent) model.add(node);
    else { targetParent.updateWorldMatrix(true, true); model.attach(node); }
    const binding = { id, node, model, display, record: records.get(id) || null, sourceParent: originalParent };
    parts.set(id, binding);
    const collectMeshes = mesh => {
      // Nested source assemblies may contain another semantic part. Its meshes
      // are bound by that part, never by an enclosing assembly instance.
      if (mesh !== node && typeof mesh.userData.part_id === 'string') return;
      mesh.userData.selectionId = id;
      if (mesh.isMesh) { configureMesh?.(mesh, binding); meshes.push(mesh); }
      for (const child of mesh.children) collectMeshes(child);
    };
    collectMeshes(node);
  }
  return { parts, meshes, contract, root: assetRoot };
}

export function visibleBounds(meshes) {
  const bounds = new THREE.Box3();
  for (const mesh of meshes) {
    if (!isWorldVisible(mesh)) continue;
    mesh.updateWorldMatrix(true, false);
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (mesh.geometry.boundingBox) bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
  }
  return bounds;
}

export function applyDisplayExplosion(parts, value, vectorForPart = binding => binding.record?.explode || [0, 0, 0]) {
  if (!Number.isFinite(value)) throw new TypeError('展开进度必须为有限数字');
  const progress = Math.max(0, Math.min(1, value));
  const prepared = [];
  for (const binding of parts.values()) {
    const vector = vectorForPart(binding);
    if (!Array.isArray(vector) || vector.length !== 3 || !vector.every(Number.isFinite)) throw new Error(`展开向量无效：${binding.id}`);
    prepared.push([binding.display, vector]);
  }
  for (const [display, vector] of prepared) display.position.fromArray(vector).multiplyScalar(progress);
  return progress;
}

export function resetDisplay(parts) {
  for (const { display } of parts.values()) {
    display.position.set(0, 0, 0); display.quaternion.identity(); display.scale.set(1, 1, 1); display.visible = true;
  }
}

export function applyWorkingPoses(parts, poses, { target = 'model' } = {}) {
  if (!['node', 'model'].includes(target)) throw new Error('工作姿态只能写入 node 或 model');
  const prepared = [];
  for (const [id, pose] of Object.entries(poses)) {
    const binding = parts.get(id);
    if (!binding) throw new Error(`缺少运动零件：${id}`);
    if (!pose || typeof pose !== 'object') throw new TypeError(`姿态无效：${id}`);
    for (const [key, size] of [['position', 3], ['quaternion', 4], ['scale', 3], ['rotation', 3]]) {
      const value = pose[key];
      if (value !== undefined && ((!Array.isArray(value) && !ArrayBuffer.isView(value)) || value.length !== size || !Array.from(value).every(Number.isFinite))) throw new TypeError(`姿态 ${key} 无效：${id}`);
    }
    for (const key of ['rotationX', 'rotationY', 'rotationZ']) if (pose[key] !== undefined && !Number.isFinite(pose[key])) throw new TypeError(`姿态 ${key} 无效：${id}`);
    if (pose.quaternion && Math.abs(Array.from(pose.quaternion).reduce((sum, value) => sum + value * value, 0) - 1) > 1e-5) throw new TypeError(`姿态 quaternion 必须为单位四元数：${id}`);
    prepared.push([binding[target], pose]);
  }
  // Validate the full update before writing any transform. Invalid input cannot
  // leave half of an assembly at a new working state.
  for (const [object, pose] of prepared) {
    if (pose.position) object.position.fromArray(pose.position);
    if (pose.quaternion) object.quaternion.fromArray(pose.quaternion);
    if (pose.scale) object.scale.fromArray(pose.scale);
    if (pose.rotation) object.rotation.set(...pose.rotation);
    if (pose.rotationX !== undefined) object.rotation.x = pose.rotationX;
    if (pose.rotationY !== undefined) object.rotation.y = pose.rotationY;
    if (pose.rotationZ !== undefined) object.rotation.z = pose.rotationZ;
  }
}
