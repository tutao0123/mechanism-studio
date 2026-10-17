import * as THREE from 'three';

// Feature edges, rather than triangle wireframes. This module changes no source
// geometry/material; opaque fill surfaces in the viewer supply the depth buffer.
const CREASE_COS = Math.cos(25 * Math.PI / 180);
const FACING_EPSILON = 1e-7;

function buildTopology(source) {
  const position = source.getAttribute('position');
  if (!position) throw new TypeError('Line art requires a position attribute.');
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) bounds.expandByPoint(point.fromBufferAttribute(position, i));
  const size = bounds.getSize(new THREE.Vector3());
  // Relative precision also handles the metre GLB and its unit-height springs.
  const tolerance = Math.max(size.x, size.y, size.z, 1e-4) * 1e-6;
  const toleranceSquared = tolerance * tolerance;
  const vertices = [];
  const buckets = new Map();
  const welded = new Uint32Array(position.count);
  const bucketKey = (x, y, z) => `${x},${y},${z}`;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const bx = Math.floor((x - bounds.min.x) / tolerance);
    const by = Math.floor((y - bounds.min.y) / tolerance);
    const bz = Math.floor((z - bounds.min.z) / tolerance);
    let match = -1;
    // Neighbour buckets avoid a seam when two near-equal positions happen to
    // lie on opposite rounding boundaries. Vertex normals/UVs are not welded.
    for (let dx = -1; dx <= 1 && match < 0; dx++) {
      for (let dy = -1; dy <= 1 && match < 0; dy++) {
        for (let dz = -1; dz <= 1 && match < 0; dz++) {
          const candidates = buckets.get(bucketKey(bx + dx, by + dy, bz + dz));
          if (!candidates) continue;
          for (const candidate of candidates) {
            const p = candidate * 3;
            const ex = vertices[p] - x, ey = vertices[p + 1] - y, ez = vertices[p + 2] - z;
            if (ex * ex + ey * ey + ez * ez <= toleranceSquared) { match = candidate; break; }
          }
        }
      }
    }
    if (match < 0) {
      match = vertices.length / 3;
      vertices.push(x, y, z);
      const key = bucketKey(bx, by, bz);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(match); else buckets.set(key, [match]);
    }
    welded[i] = match;
  }

  const index = source.getIndex();
  const count = index ? index.count : position.count;
  const normals = [];
  const edgeMap = new Map();
  const addEdge = (a, b, face) => {
    const low = Math.min(a, b), high = Math.max(a, b);
    const key = `${low}:${high}`;
    const edge = edgeMap.get(key);
    if (edge) edge.faces.push(face);
    else edgeMap.set(key, { a: low, b: high, faces: [face] });
  };
  for (let i = 0; i + 2 < count; i += 3) {
    const a = welded[index ? index.getX(i) : i];
    const b = welded[index ? index.getX(i + 1) : i + 1];
    const c = welded[index ? index.getX(i + 2) : i + 2];
    if (a === b || b === c || a === c) continue;
    const ap = a * 3, bp = b * 3, cp = c * 3;
    const abx = vertices[bp] - vertices[ap], aby = vertices[bp + 1] - vertices[ap + 1], abz = vertices[bp + 2] - vertices[ap + 2];
    const acx = vertices[cp] - vertices[ap], acy = vertices[cp + 1] - vertices[ap + 1], acz = vertices[cp + 2] - vertices[ap + 2];
    const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
    const length = Math.hypot(nx, ny, nz);
    if (length <= toleranceSquared) continue;
    const face = normals.length / 3;
    normals.push(nx / length, ny / length, nz / length);
    addEdge(a, b, face); addEdge(b, c, face); addEdge(c, a, face);
  }

  return { vertices: new Float32Array(vertices), normals: new Float32Array(normals), edges: [...edgeMap.values()], bounds };
}

function refreshCreases(record, normalMatrix, metric) {
  // Explicit presentation opt-in for tessellated smooth surfaces. Their
  // faceting is useful for rendering but should not become drawn crease lines.
  if (record.mesh.userData.lineArtSmooth === true) {
    if (!record.smooth) {
      for (let i = 0; i < record.topology.edges.length; i++) record.creases[i] = record.topology.edges[i].faces.length === 1 ? 1 : 0;
      record.smooth = true;
    }
    return;
  }
  if (record.smooth) { record.creaseMetric.fill(NaN); record.smooth = false; }
  const e = normalMatrix.elements;
  // N^T N captures the angle-changing part of the world normal transform.
  // Its normalized values ignore translations, rotations and uniform scaling.
  metric[0] = e[0] * e[0] + e[1] * e[1] + e[2] * e[2];
  metric[1] = e[0] * e[3] + e[1] * e[4] + e[2] * e[5];
  metric[2] = e[0] * e[6] + e[1] * e[7] + e[2] * e[8];
  metric[3] = e[3] * e[3] + e[4] * e[4] + e[5] * e[5];
  metric[4] = e[3] * e[6] + e[4] * e[7] + e[5] * e[8];
  metric[5] = e[6] * e[6] + e[7] * e[7] + e[8] * e[8];
  const scale = Math.max(metric[0], metric[3], metric[5]);
  let changed = false;
  for (let i = 0; i < 6; i++) {
    metric[i] /= scale;
    if (!Number.isFinite(record.creaseMetric[i]) || Math.abs(metric[i] - record.creaseMetric[i]) > 1e-10) changed = true;
  }
  if (!changed) return;
  record.creaseMetric.set(metric);
  const { normals, edges } = record.topology;
  const transformed = record.transformedNormals;
  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i], y = normals[i + 1], z = normals[i + 2];
    const nx = e[0] * x + e[3] * y + e[6] * z;
    const ny = e[1] * x + e[4] * y + e[7] * z;
    const nz = e[2] * x + e[5] * y + e[8] * z;
    const length = Math.hypot(nx, ny, nz);
    transformed[i] = nx / length; transformed[i + 1] = ny / length; transformed[i + 2] = nz / length;
  }
  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
    const faces = edges[edgeIndex].faces;
    let sharp = faces.length === 1;
    // Non-manifold edges count as creases if any adjacent pair exceeds 25°.
    for (let i = 0; i < faces.length && !sharp; i++) {
      for (let j = i + 1; j < faces.length; j++) {
        const a = faces[i] * 3, b = faces[j] * 3;
        const dot = transformed[a] * transformed[b] + transformed[a + 1] * transformed[b + 1] + transformed[a + 2] * transformed[b + 2];
        if (dot <= CREASE_COS) { sharp = true; break; }
      }
    }
    record.creases[edgeIndex] = sharp ? 1 : 0;
  }
}

function isWorldVisible(object) {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}

/**
 * Attach feature-line children to a list of static, unskinned Mesh geometries.
 * Parent/mesh motion and nonuniform scaling remain owned by the viewer.
 * update(camera) supports OrthographicCamera, including rotated parent groups.
 * detailColor applies to creases; boundaries and live silhouettes keep color.
 * partColors maps mesh.userData.selectionId to an override for both line tones.
 * mesh.userData.lineArtSmooth === true draws silhouettes/boundaries only.
 */
export function createLineArt(meshes) {
  const records = [];
  const worldDirection = new THREE.Vector3();
  const localDirection = new THREE.Vector3();
  const inverse = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  const metric = new Float64Array(6);
  let enabled = false;
  let disposed = false;

  for (const mesh of new Set(meshes)) {
    if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh) throw new TypeError('Line art expects individual static Mesh geometries.');
    const topology = buildTopology(mesh.geometry);
    const positions = new Float32Array(topology.edges.length * 6);
    const colors = new Float32Array(topology.edges.length * 6);
    const attribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
    const colorAttribute = new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', attribute);
    geometry.setAttribute('color', colorAttribute);
    geometry.setDrawRange(0, 0);
    geometry.boundingBox = topology.bounds.clone();
    geometry.boundingSphere = topology.bounds.getBoundingSphere(new THREE.Sphere());
    const material = new THREE.LineBasicMaterial({
      color: '#ffffff', vertexColors: true, linewidth: 1, depthTest: true, depthWrite: false, toneMapped: false,
    });
    const line = new THREE.LineSegments(geometry, material);
    line.name = `${mesh.name || mesh.userData.selectionId || 'mesh'}/feature-lines`;
    line.visible = false;
    line.renderOrder = 1;
    line.userData.isLineArt = true;
    line.userData.selectionId = mesh.userData.selectionId;
    // These children should not intercept the viewer's existing mesh picking.
    line.raycast = () => {};
    mesh.add(line);
    records.push({
      mesh, line, geometry, material, positions, attribute, colors, colorAttribute, topology,
      outlineColor: new THREE.Color('#000000'), detailColor: new THREE.Color('#000000'),
      facing: new Float32Array(topology.normals.length / 3),
      transformedNormals: new Float32Array(topology.normals.length),
      creases: new Uint8Array(topology.edges.length),
      creaseMetric: new Float64Array(6).fill(NaN),
      smooth: false,
    });
  }

  return {
    setStyle({ enabled: nextEnabled = false, color = '#000000', detailColor = color, partColors = {} } = {}) {
      if (disposed) return;
      enabled = Boolean(nextEnabled);
      for (const record of records) {
        const id = record.mesh.userData.selectionId;
        record.line.visible = enabled;
        record.outlineColor.set(partColors[id] ?? color);
        record.detailColor.set(partColors[id] ?? detailColor);
      }
    },

    update(camera) {
      if (disposed || !enabled) return;
      if (!camera.isOrthographicCamera) throw new TypeError('Line art requires an OrthographicCamera.');
      camera.getWorldDirection(worldDirection);
      for (const record of records) {
        const { mesh, topology, facing, positions, geometry, attribute, colors, colorAttribute } = record;
        if (!isWorldVisible(mesh)) continue;
        mesh.updateWorldMatrix(true, false);
        if (mesh.matrixWorld.determinant() === 0) { geometry.setDrawRange(0, 0); continue; }
        inverse.copy(mesh.matrixWorld).invert();
        normalMatrix.setFromMatrix4(inverse).transpose();
        refreshCreases(record, normalMatrix, metric);
        // inv(A) * viewDirection is equivalent to transforming face normals by
        // inv(A)^T for their world-space facing test, even with nonuniform scale.
        localDirection.copy(worldDirection).transformDirection(inverse);
        const { normals, vertices, edges } = topology;
        for (let face = 0, n = 0; face < facing.length; face++, n += 3) {
          facing[face] = normals[n] * localDirection.x + normals[n + 1] * localDirection.y + normals[n + 2] * localDirection.z;
        }
        let offset = 0;
        for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
          const edge = edges[edgeIndex];
          // Classify the view-dependent outline even when this edge is already
          // a crease. A silhouette always takes the stronger outline tone.
          let outline = edge.faces.length === 1;
          let front = false, back = false;
          for (const face of edge.faces) {
            if (facing[face] < -FACING_EPSILON) front = true; else back = true;
            if (front && back) { outline = true; break; }
          }
          if (!outline && record.creases[edgeIndex] !== 1) continue;
          const a = edge.a * 3, b = edge.b * 3;
          const color = outline ? record.outlineColor : record.detailColor;
          colors[offset] = color.r; colors[offset + 1] = color.g; colors[offset + 2] = color.b;
          colors[offset + 3] = color.r; colors[offset + 4] = color.g; colors[offset + 5] = color.b;
          positions[offset++] = vertices[a]; positions[offset++] = vertices[a + 1]; positions[offset++] = vertices[a + 2];
          positions[offset++] = vertices[b]; positions[offset++] = vertices[b + 1]; positions[offset++] = vertices[b + 2];
        }
        geometry.setDrawRange(0, offset / 3);
        if (offset) { attribute.needsUpdate = true; colorAttribute.needsUpdate = true; }
      }
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const record of records) {
        record.line.removeFromParent(); record.geometry.dispose(); record.material.dispose();
      }
      records.length = 0;
    },
  };
}
