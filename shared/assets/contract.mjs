/** Pure scene/ownership checks; these validate display data, not CAD precision. */
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const vector = (value, length, message) => ensure(Array.isArray(value) && value.length === length && value.every(Number.isFinite), message);
export function assertNearVector(actual, expected, epsilon = 1e-7, label = 'vector') {
  vector(actual, expected.length, `${label}: finite values`);
  vector(expected, actual.length, `${label}: finite expected values`);
  actual.forEach((v, i) => ensure(Math.abs(v - expected[i]) <= epsilon, `${label}[${i}]: ${v} differs from ${expected[i]}`));
}

export function validateSceneContract(gltf, contract, { restToAsset = v => v, checkOwnersInAsset = true, epsilon = 1e-7 } = {}) {
  const nodes = gltf.nodes ?? [], byId = new Map(), nodeIndex = new Map();
  nodes.forEach((node, i) => {
    for (const id of [node.extras?.part_id, node.extras?.assembly_id].filter(v => v !== undefined)) {
      ensure(typeof id === 'string' && id && !byId.has(id), `unique scene identity: ${id}`);
      byId.set(id, node); nodeIndex.set(id, i);
    }
  });
  ensure(Array.isArray(contract.parts) && contract.parts.length > 0, 'contract has parts');
  const ids = new Set(), parentIndex = new Map();
  nodes.forEach((node, parent) => {
    for (const child of node.children ?? []) {
      ensure(Number.isInteger(child) && child >= 0 && child < nodes.length && !parentIndex.has(child), 'single valid node parent');
      parentIndex.set(child, parent);
    }
  });
  for (let i = 0; i < nodes.length; i++) {
    const chain = new Set(); for (let cursor = i; cursor !== undefined; cursor = parentIndex.get(cursor)) {
      ensure(!chain.has(cursor), 'acyclic exported node hierarchy'); chain.add(cursor);
    }
  }
  const unit = contract.units?.asset ?? contract.units?.assetLength ?? contract.assetUnits;
  ensure(unit === 'm' || unit === 'meters', 'display asset length is metres');
  for (const part of contract.parts) {
    const id = part.part_id, node = byId.get(id);
    ensure(typeof id === 'string' && id && !ids.has(id) && node?.extras?.part_id === id, `unique mapped part: ${id}`); ids.add(id);
    ensure(['static', 'model', 'clip'].includes(part.motionOwner), `${id}: explicit motion owner`);
    if (checkOwnersInAsset) ensure(node.extras.motionOwner === part.motionOwner, `${id}: asset/contract owner agreement`);
    if (part.parent_id !== undefined) {
      const expected = part.parent_id === null ? undefined : nodeIndex.get(part.parent_id);
      ensure(part.parent_id === null || expected !== undefined, `${id}: parent identity exists`);
      ensure(parentIndex.get(nodeIndex.get(id)) === expected, `${id}: actual exported parent matches`);
    }
    if (part.rest?.translation) assertNearVector(node.translation ?? [0, 0, 0], restToAsset(part.rest.translation), epsilon, `${id}: rest translation`);
    if (part.rest?.rotation) assertNearVector(node.rotation ?? [0, 0, 0, 1], part.rest.rotation, epsilon, `${id}: rest quaternion`);
    if (part.rest?.scale) assertNearVector(node.scale ?? [1, 1, 1], part.rest.scale, epsilon, `${id}: rest scale`);
    if (part.rest?.matrix) {
      vector(part.rest.matrix, 16, `${id}: finite rest matrix`);
      ensure(node.matrix !== undefined && node.translation === undefined && node.rotation === undefined && node.scale === undefined, `${id}: matrix rest has one exported transform representation`);
      assertNearVector(node.matrix, part.rest.matrix, epsilon, `${id}: rest matrix`);
    }
    if (part.explode) vector(part.explode, 3, `${id}: finite display delta`);
    if (part.axis) { vector(part.axis, 3, `${id}: axis`); ensure(Math.hypot(...part.axis) > 0, `${id}: nonzero axis`); }
  }
  const semanticIds = nodes.filter(n => n.extras?.part_id).map(n => n.extras.part_id);
  ensure(semanticIds.length === ids.size && semanticIds.every(id => ids.has(id)), 'all exported semantic parts declared');
  for (const animation of gltf.animations ?? []) for (const channel of animation.channels ?? []) {
    const node = nodes[channel.target?.node];
    const part = contract.parts.find(p => p.part_id === node?.extras?.part_id);
    ensure(part?.motionOwner === 'clip', 'animation may only write a clip-owned part');
  }
  return { partCount: ids.size, byId, parentIndex };
}
