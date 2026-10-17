/** Strict, dependency-free checks of the self-contained GLB files we export. */
import { createHash } from 'node:crypto';

const ensure = (condition, message) => { if (!condition) throw new Error(message); };
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const parseJson = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));

export function readGlb(bytes) {
  ensure(Buffer.isBuffer(bytes) && bytes.length >= 20, 'GLB header is present');
  ensure(bytes.readUInt32LE(0) === 0x46546c67, 'GLB magic');
  ensure(bytes.readUInt32LE(4) === 2, 'glTF 2 binary format');
  ensure(bytes.readUInt32LE(8) === bytes.length, 'declared GLB length');
  let json, buffer;
  for (let offset = 12; offset < bytes.length;) {
    ensure(offset + 8 <= bytes.length, 'complete chunk header');
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    ensure(length % 4 === 0, 'chunks are aligned');
    ensure(offset + 8 + length <= bytes.length, 'complete chunk payload');
    const payload = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) {
      ensure(offset === 12 && json === undefined, 'one JSON chunk must be first');
      json = parseJson(payload);
    } else if (type === 0x004e4942) {
      ensure(buffer === undefined, 'one embedded binary buffer'); buffer = payload;
    }
    offset += length + 8;
  }
  ensure(json && buffer, 'JSON and binary chunks are present');
  ensure(json.asset?.version === '2.0', 'glTF asset version');
  ensure(json.buffers?.length === 1 && json.buffers[0].uri === undefined, 'one self-contained buffer');
  ensure(buffer.length >= json.buffers[0].byteLength && buffer.length - json.buffers[0].byteLength < 4, 'declared buffer and padding');
  return { json, buffer };
}

export function accessorValues(gltf, buffer, index) {
  const accessor = gltf.accessors?.[index];
  ensure(accessor && accessor.sparse === undefined, `dense accessor ${index}`);
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
  const component = {
    5121: { bytes: 1, read: offset => buffer.readUInt8(offset) },
    5123: { bytes: 2, read: offset => buffer.readUInt16LE(offset) },
    5125: { bytes: 4, read: offset => buffer.readUInt32LE(offset) },
    5126: { bytes: 4, read: offset => buffer.readFloatLE(offset) },
  }[accessor.componentType];
  ensure(components && component, `supported accessor ${index} layout`);
  const view = gltf.bufferViews?.[accessor.bufferView];
  ensure(view && view.buffer === 0, 'accessor uses embedded buffer view');
  const stride = view.byteStride ?? components * component.bytes;
  ensure(stride >= components * component.bytes, 'stride covers element');
  ensure(Number.isInteger(accessor.count) && accessor.count >= 0, 'accessor count');
  const relative = accessor.byteOffset ?? 0;
  const required = accessor.count === 0 ? 0 : (accessor.count - 1) * stride + components * component.bytes;
  ensure(Number.isInteger(relative) && relative >= 0 && relative + required <= view.byteLength, 'accessor fits its buffer view');
  const start = (view.byteOffset ?? 0) + relative;
  ensure(start >= 0 && start + required <= buffer.length, 'accessor fits binary payload');
  return Array.from({ length: accessor.count }, (_, i) => Array.from({ length: components }, (_, c) => component.read(start + i * stride + c * component.bytes)));
}

export function positionArrays(gltf, buffer, node) {
  ensure(node, 'semantic part node exists');
  const mesh = gltf.meshes?.[node.mesh];
  ensure(mesh?.primitives?.length, 'semantic mesh has primitives');
  return mesh.primitives.map(primitive => {
    const index = primitive.attributes?.POSITION, accessor = gltf.accessors?.[index];
    ensure(accessor?.type === 'VEC3' && accessor.componentType === 5126 && !accessor.normalized, 'POSITION is unnormalized FLOAT VEC3');
    const values = accessorValues(gltf, buffer, index);
    ensure(values.length > 0, 'POSITION is nonempty');
    return { accessor, values };
  });
}

export function boundsOf(points) {
  ensure(points.length > 0, 'bounds need points');
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    ensure(point.length === 3 && point.every(Number.isFinite), 'finite three-dimensional positions');
    point.forEach((value, i) => { min[i] = Math.min(min[i], value); max[i] = Math.max(max[i], value); });
  }
  return { min, max };
}

export function semanticNodes(gltf) {
  const result = new Map();
  for (const node of gltf.nodes ?? []) if (node.extras?.part_id !== undefined) {
    const id = node.extras.part_id;
    ensure(typeof id === 'string' && id.length > 0 && !result.has(id), `unique semantic part ID: ${id}`);
    result.set(id, node);
  }
  return result;
}
