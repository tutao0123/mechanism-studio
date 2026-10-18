import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Mesh, MeshStandardMaterial, LineSegments, LineBasicMaterial, BufferGeometry } from 'three';
import { createMeshColorLayer, createMeshVisibilityLayer } from '../../appearance/mesh-color-layer.mjs';

test('context fades include feature lines, preserve source shape and restore opaque depth', () => {
  const geometry = new BoxGeometry(), original = new MeshStandardMaterial();
  const mesh = new Mesh(geometry, original); mesh.userData.selectionId = 'source-occurrence';
  mesh.position.set(1,2,3); mesh.updateMatrix(); const matrix = mesh.matrix.toArray();
  const line = new LineSegments(new BufferGeometry(), new LineBasicMaterial({depthWrite:false}));
  line.userData.isLineArt = true; mesh.add(line);
  const colors = createMeshColorLayer([mesh]); const layer = createMeshVisibilityLayer([mesh]);
  layer.apply(id => { assert.equal(id, 'source-occurrence'); return .15; });
  assert.equal(mesh.material.opacity, .15); assert.equal(line.material.opacity, .15);
  assert.equal(mesh.material.depthWrite,true); assert.equal(mesh.material.transparent,true);
  assert.equal(line.material.depthWrite,false);
  assert.equal(original.opacity,1); assert.equal(mesh.geometry,geometry); assert.deepEqual(mesh.matrix.toArray(),matrix);
  colors.apply(new Map([['source-occurrence',{color:'#abcdef'}]])); assert.equal(mesh.material.opacity,.15);
  layer.apply(()=>0); assert.equal(mesh.visible,false);
  layer.apply(()=>1); assert.equal(mesh.visible,true); assert.equal(mesh.material.depthWrite,true);
  assert.equal(line.material.depthWrite,false); assert.equal(mesh.material.transparent,false);
  layer.apply(()=>.2); layer.restore(); assert.equal(mesh.material.opacity,1); assert.equal(line.material.opacity,1);
  assert.throws(()=>layer.apply(()=>NaN),RangeError); assert.throws(()=>layer.apply(()=>1.5),RangeError);
  colors.dispose(); geometry.dispose(); original.dispose(); line.geometry.dispose(); line.material.dispose();
});
