import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createLineArt } from '../line-art.mjs';

const EPSILON = 1e-6;

function makeCamera(position = new THREE.Vector3(4, 1.5, 3)) {
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.01, 100);
  camera.position.copy(position);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

function featureLine(mesh) {
  const lines = mesh.children.filter(child => child.isLineSegments && child.userData.isLineArt);
  assert.equal(lines.length, 1, 'one line child is attached to each source mesh');
  return lines[0];
}

function outputSegments(mesh) {
  const geometry = featureLine(mesh).geometry;
  const positions = geometry.getAttribute('position');
  const { start, count } = geometry.drawRange;
  assert.equal(count % 2, 0, 'the output contains complete line segments');
  const segments = [];
  for (let i = start; i < start + count; i += 2) {
    segments.push([
      new THREE.Vector3().fromBufferAttribute(positions, i),
      new THREE.Vector3().fromBufferAttribute(positions, i + 1),
    ]);
  }
  return segments;
}

function outputColors(mesh) {
  const geometry = featureLine(mesh).geometry;
  const colors = geometry.getAttribute('color');
  const { start, count } = geometry.drawRange;
  return Array.from({ length: count }, (_, i) => new THREE.Color().fromBufferAttribute(colors, start + i));
}

function assertColor(actual, expected) {
  const wanted = new THREE.Color(expected);
  assert.ok(['r', 'g', 'b'].every(channel => Math.abs(actual[channel] - wanted[channel]) < EPSILON),
    `expected ${wanted.getHexString()}, got ${actual.getHexString()}`);
}

function cylinderSideSegments(mesh) {
  return outputSegments(mesh).filter(([a, b]) => (
    Math.abs(a.x - b.x) < EPSILON && Math.abs(a.z - b.z) < EPSILON && Math.abs(a.y - b.y) > 1
  ));
}

function disposeSource(mesh) {
  mesh.geometry.dispose();
  mesh.material.dispose();
}

test('box output contains 12 cube edges and no planar triangle diagonals', t => {
  // BoxGeometry duplicates positions at face/normal seams; the nonindexed
  // variant additionally duplicates every triangle corner.
  const indexed = new THREE.BoxGeometry();
  const meshes = [indexed, indexed.toNonIndexed()].map(geometry => new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  const originals = meshes.map(mesh => ({
    geometry: mesh.geometry,
    position: Array.from(mesh.geometry.getAttribute('position').array),
    index: mesh.geometry.index ? Array.from(mesh.geometry.index.array) : null,
  }));
  const art = createLineArt(meshes);
  t.after(() => { art.dispose(); meshes.forEach(disposeSource); });
  art.setStyle({ enabled: true });
  art.update(makeCamera());

  meshes.forEach((mesh, index) => {
    const segments = outputSegments(mesh);
    assert.equal(segments.length, 12);
    const unique = new Set();
    for (const [a, b] of segments) {
      const changingAxes = ['x', 'y', 'z'].filter(axis => Math.abs(a[axis] - b[axis]) > EPSILON);
      assert.equal(changingAxes.length, 1, 'a cube edge changes exactly one coordinate');
      assert.ok(Math.abs(a.distanceTo(b) - 1) < EPSILON);
      for (const point of [a, b]) {
        assert.ok(['x', 'y', 'z'].every(axis => Math.abs(Math.abs(point[axis]) - 0.5) < EPSILON));
      }
      unique.add([a.toArray().join(','), b.toArray().join(',')].sort().join('|'));
    }
    assert.equal(unique.size, 12, 'normal and UV seams do not duplicate cube edges');
    assert.equal(mesh.geometry, originals[index].geometry);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array), originals[index].position);
    assert.deepEqual(mesh.geometry.index ? Array.from(mesh.geometry.index.array) : null, originals[index].index);
  });
});

test('a smooth cylinder has two side silhouettes that move with the camera', t => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 64), new THREE.MeshBasicMaterial());
  const art = createLineArt([mesh]);
  t.after(() => { art.dispose(); disposeSource(mesh); });
  const camera = makeCamera();
  art.setStyle({ enabled: true });
  art.update(camera);
  const initial = cylinderSideSegments(mesh);
  assert.equal(initial.length, 2, 'the cylinder has side outlines rather than a grid of radial edges');
  initial.forEach(([a, b]) => {
    assert.ok(Math.abs(Math.hypot(a.x, a.z) - 1) < EPSILON);
    assert.ok(Math.abs(a.distanceTo(b) - 2) < EPSILON);
  });

  camera.position.set(-3, 1.5, 4);
  camera.lookAt(0, 0, 0);
  art.update(camera);
  const moved = cylinderSideSegments(mesh);
  assert.equal(moved.length, 2);
  const sideLocations = segments => segments.map(([a]) => [a.x, a.z].join(',')).sort();
  assert.notDeepEqual(sideLocations(moved), sideLocations(initial), 'silhouettes follow the new viewing direction');
});

test('strong cube outlines follow the projected hull while interior structure stays light', t => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const art = createLineArt([mesh]);
  t.after(() => { art.dispose(); disposeSource(mesh); });
  const camera = makeCamera();
  art.setStyle({ enabled: true, color: '#111111', detailColor: '#aaaaaa' });

  for (const cameraPosition of [new THREE.Vector3(4, 1.5, 3), new THREE.Vector3(-3, 2, 4)]) {
    camera.position.copy(cameraPosition); camera.lookAt(0, 0, 0);
    art.update(camera);
    const vertices = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(
      i & 1 ? 0.5 : -0.5, i & 2 ? 0.5 : -0.5, i & 4 ? 0.5 : -0.5,
    ).project(camera));
    const segments = outputSegments(mesh);
    const colors = outputColors(mesh);
    let outlineCount = 0, detailCount = 0;
    // Independent screen-space oracle: a convex hull edge has every projected
    // corner on one side of its supporting line. No face normals are consulted.
    segments.forEach(([localA, localB], index) => {
      const a = localA.clone().project(camera), b = localB.clone().project(camera);
      const sides = vertices.map(p => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
      const isHull = !sides.some(s => s > EPSILON) || !sides.some(s => s < -EPSILON);
      const expected = isHull ? '#111111' : '#aaaaaa';
      assertColor(colors[index * 2], expected); assertColor(colors[index * 2 + 1], expected);
      if (isHull) outlineCount++; else detailCount++;
    });
    assert.equal(outlineCount, 6, 'all six projected outside edges receive the dark outline');
    assert.equal(detailCount, 6, 'the remaining structural edges receive the quieter detail tone');
  }
});

test('rotated, nonuniformly scaled smooth curves retain only their visible shape features', t => {
  // Eight sides deliberately make the tessellation angles large. Opting into
  // smooth line art must suppress these facets while keeping the silhouette.
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 8), new THREE.MeshBasicMaterial());
  mesh.scale.set(2, 0.15, 0.6);
  mesh.userData.lineArtSmooth = true;
  const parent = new THREE.Group();
  parent.rotation.y = 0.37;
  parent.add(mesh);
  const art = createLineArt([mesh]);
  t.after(() => { art.dispose(); disposeSource(mesh); });
  const camera = makeCamera();
  art.setStyle({ enabled: true });
  art.update(camera);
  const sideLines = cylinderSideSegments(mesh);
  assert.equal(sideLines.length, 2);

  // Independent geometric oracle: the two side lines must sit at the left
  // and right projected extremes of the transformed cylinder's vertices.
  const position = mesh.geometry.getAttribute('position');
  let minX = Infinity, maxX = -Infinity;
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).project(camera);
    minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
  }
  const outlineX = sideLines.map(([a, b]) => a.clone().add(b).multiplyScalar(0.5).applyMatrix4(mesh.matrixWorld).project(camera).x).sort((a, b) => a - b);
  assert.ok(Math.abs(outlineX[0] - minX) < EPSILON, 'left outline follows the rotated and scaled projected shape');
  assert.ok(Math.abs(outlineX[1] - maxX) < EPSILON, 'right outline follows the rotated and scaled projected shape');

  const smoothCount = outputSegments(mesh).length;
  mesh.userData.lineArtSmooth = false;
  art.update(camera);
  assert.ok(outputSegments(mesh).length > smoothCount, 'disabling smooth mode restores physical crease features');
  mesh.userData.lineArtSmooth = true;
  art.update(camera);
  assert.equal(outputSegments(mesh).length, smoothCount, 'smooth mode can be restored without recreating the object');
});

test('style overrides, updates, and disposal preserve the source and reuse line resources', t => {
  const meshes = ['selected', 'ordinary'].map(id => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ color: '#6789ab' }));
    mesh.userData.selectionId = id;
    return mesh;
  });
  const sources = meshes.map(mesh => ({ geometry: mesh.geometry, material: mesh.material }));
  const art = createLineArt(meshes);
  t.after(() => { art.dispose(); meshes.forEach(disposeSource); });
  const lines = meshes.map(featureLine);
  const camera = makeCamera();
  art.setStyle({ enabled: true, color: '#ffffff', detailColor: '#aaaaaa', partColors: { selected: '#ff0088' } });
  art.update(camera);
  outputColors(meshes[0]).forEach(color => assertColor(color, '#ff0088'));
  assert.ok(outputColors(meshes[1]).some(color => color.getHexString() === 'ffffff'));
  assert.ok(outputColors(meshes[1]).some(color => color.getHexString() === 'aaaaaa'));
  const resources = lines.map(line => ({
    geometry: line.geometry, material: line.material,
    attribute: line.geometry.getAttribute('position'), array: line.geometry.getAttribute('position').array,
    colorAttribute: line.geometry.getAttribute('color'), colorArray: line.geometry.getAttribute('color').array,
  }));

  lines.forEach(line => {
    assert.equal(line.material.depthTest, true);
    assert.equal(line.material.depthWrite, false);
    assert.equal(line.material.transparent, false, 'depth-tested ink stays opaque');
    assert.equal(line.material.vertexColors, true);
    assert.equal(line.material.color.getHexString(), 'ffffff', 'vertex colours are not darkened by a second material tint');
    assert.equal(line.geometry.getAttribute('position').usage, THREE.DynamicDrawUsage);
    assert.equal(line.geometry.getAttribute('color').usage, THREE.DynamicDrawUsage);
    const hits = [];
    line.raycast(new THREE.Raycaster(), hits);
    assert.equal(hits.length, 0, 'line children do not intercept source mesh picking');
  });
  for (let i = 0; i < 5; i++) {
    meshes[0].rotation.y = i * 0.2;
    camera.position.x = 4 - i * 0.2;
    camera.lookAt(0, 0, 0);
    art.update(camera);
  }
  lines.forEach((line, index) => {
    assert.equal(line.geometry, resources[index].geometry);
    assert.equal(line.material, resources[index].material);
    assert.equal(line.geometry.getAttribute('position'), resources[index].attribute);
    assert.equal(line.geometry.getAttribute('position').array, resources[index].array);
    assert.equal(line.geometry.getAttribute('color'), resources[index].colorAttribute);
    assert.equal(line.geometry.getAttribute('color').array, resources[index].colorArray);
    assert.equal(meshes[index].geometry, sources[index].geometry);
    assert.equal(meshes[index].material, sources[index].material);
    assert.equal(meshes[index].material.color.getHexString(), '6789ab');
  });
  art.setStyle({ enabled: true, color: '#334455' });
  art.update(camera);
  meshes.forEach(mesh => outputColors(mesh).forEach(color => assertColor(color, '#334455')));
  art.setStyle({ enabled: false });
  lines.forEach(line => assert.equal(line.visible, false));
  let lineDisposals = 0, sourceDisposals = 0;
  lines.forEach(line => {
    line.geometry.addEventListener('dispose', () => lineDisposals++);
    line.material.addEventListener('dispose', () => lineDisposals++);
  });
  sources.forEach(source => {
    source.geometry.addEventListener('dispose', () => sourceDisposals++);
    source.material.addEventListener('dispose', () => sourceDisposals++);
  });
  art.dispose(); art.dispose();
  assert.equal(lineDisposals, 4, 'each owned line geometry/material is disposed exactly once');
  assert.equal(sourceDisposals, 0, 'disposing the line system leaves source resources intact');
  meshes.forEach(mesh => assert.equal(mesh.children.filter(child => child.userData.isLineArt).length, 0));
});
