import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Matrix4,Vector3,Quaternion} from 'three';
import {createGripperRig,SOURCE_HASH} from '../kinematics.mjs';
const read=p=>readFile(new URL(p,import.meta.url));
const index=JSON.parse(await read('../assets/scene-index.json'));
const source=JSON.parse(await read('../assets/source-assembly.json'));
const provenance=JSON.parse(await read('../source/provenance.json'));
const rig=createGripperRig(index);
test('pinned source bytes, source identities and source constraints are retained',async()=>{
 for(const f of provenance.files){const b=await read(`../source/${f.localFile}`);assert.equal(b.length,f.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256);}
 assert.equal(source.sourceSHA256,SOURCE_HASH);assert.equal(source.bodies.length,11);
 assert.equal(source.bodies.flatMap(b=>b.joints).length,6);assert.equal(index.parts.filter(p=>p.hasGeometry).length,9);
 const connects=source.equalities.filter(e=>e.type==='connect');assert.equal(connects.length,2);
 for(const c of connects)assert.deepEqual(c.sourceAttributes.anchor.split(' ').map(Number),rig.evidence.connectAnchorSourceBody1);
 assert.equal(source.equalities.find(e=>e.type==='joint').sourceAttributes.polycoef,'0 1 0 0 0');
});
test('both source closure anchors remain coincident and all six source joint limits hold',()=>{
 for(let n=0;n<=750;n++){
  const q=.75*n/750,values=rig.coordinates(q);
  assert.equal(values['mjcf:left_driver'],values['mjcf:right_driver']);
  for(const e of rig.closureErrors(q))assert.ok(e<1e-10,`closure ${q}: ${e}`);
  for(const b of source.bodies)for(const j of b.joints){const value=values[`mjcf:${b.name}`];assert.ok(value>=j.range[0]-1e-10&&value<=j.range[1]+1e-10,`${j.name}: ${value}`);}
 }
 assert.throws(()=>rig.coordinates(-.01));assert.throws(()=>rig.coordinates(.8));assert.throws(()=>rig.coordinates(NaN));
});
test('actual hierarchy/model-channel transforms reproduce the closed-loop world poses',()=>{
 const snapshot=JSON.stringify(index);
 for(const q of [0,.13,.37,.72,0]){
  const poses=rig.posesForAngle(q),expected=rig.worldMatrices(q),world=new Map();
  for(const part of index.parts){const p=poses[part.id],model=new Matrix4().compose(new Vector3(...p.position),new Quaternion(...p.quaternion),new Vector3(...p.scale));const W=(part.parentId?world.get(part.parentId).clone():new Matrix4()).multiply(model).multiply(new Matrix4().fromArray(part.localMatrix));world.set(part.id,W);W.elements.forEach((v,i)=>assert.ok(Math.abs(v-expected.get(part.id).elements[i])<1e-10));}
 }
 assert.equal(JSON.stringify(index),snapshot);
});
