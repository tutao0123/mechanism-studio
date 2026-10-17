import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {wrapPhase,sampleFlowOffsets,createFlowPath,createPulse} from './effects.mjs';

test('flow phase is deterministic, periodic and solely caller controlled', () => {
  assert.deepEqual(sampleFlowOffsets(4,.25),[.25,.5,.75,0]);
  assert.deepEqual(sampleFlowOffsets(4,.25),sampleFlowOffsets(4,12.25));
  assert.equal(wrapPhase(-.25),.75);
  assert.throws(()=>sampleFlowOffsets(0,0));assert.throws(()=>sampleFlowOffsets(3,NaN));
});
test('real flow instances point along the path, pause identically, and reject invalid updates atomically',()=>{
  const flow=createFlowPath(THREE,{points:[[0,0,0],[.2,0,0]],count:4});
  flow.update({phase:.25,intensity:1});
  const mesh=flow.group.children[1],old=Array.from(mesh.instanceMatrix.array),state=flow.snapshot();
  flow.update({phase:.25,intensity:1});assert.deepEqual(Array.from(mesh.instanceMatrix.array),old);
  const matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);
  const pos=new THREE.Vector3().setFromMatrixPosition(matrix),direction=new THREE.Vector3(0,1,0).transformDirection(matrix);
  assert.ok(Math.abs(pos.x-.05)<1e-6);assert.ok(direction.x>.9999);
  assert.throws(()=>flow.update({phase:Infinity,intensity:.5}));assert.deepEqual(flow.snapshot(),state);
  assert.throws(()=>flow.update({phase:0,intensity:2}));assert.deepEqual(flow.snapshot(),state);
  flow.update({phase:.25,intensity:0});assert.equal(flow.group.visible,false);
  assert.equal(flow.group.userData.part_id,undefined);flow.dispose();flow.dispose();
  assert.throws(()=>flow.update({phase:0}));
  assert.throws(()=>createFlowPath(THREE,{points:[[0,0,0],[0,0,0]]}));
});
test('event pulses have explicit finite envelopes and no implicit progression',()=>{
  const pulse=createPulse(THREE,{radius:.004});assert.equal(pulse.group.visible,false);
  pulse.update({intensity:.8,scale:2});const before=pulse.snapshot();
  assert.equal(pulse.group.children[0].scale.x,2);assert.deepEqual(pulse.snapshot(),before);
  assert.throws(()=>pulse.update({intensity:1,scale:NaN}));assert.deepEqual(pulse.snapshot(),before);
  pulse.update({intensity:0});assert.equal(pulse.group.visible,false);pulse.dispose();
});
