import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Group,Matrix4,Quaternion,Vector3} from 'three';
import {createWolfWorkingMotion,KINEMATICS_REVISION} from '../tour/kinematics.mjs';
import {localDisplayOffsets} from '../story.mjs';
import {bindAssembly,applyWorkingPoses,applyDisplayExplosion} from '../../../shared/viewer/scene.mjs';
import {readGlb} from '../../../shared/assets/glb.mjs';

const read=async file=>JSON.parse(await readFile(new URL(file,import.meta.url),'utf8'));
const index=await read('../assets/scene-index.json'),rig=createWolfWorkingMotion(index),before=JSON.stringify(index),identityPose={position:[0,0,0],quaternion:[0,0,0,1],scale:[1,1,1]};
const near=(a,b,label,epsilon=1e-11)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<epsilon,`${label}[${i}]: ${v} != ${b[i]}`));};
const matrixOf=pose=>new Matrix4().compose(new Vector3(...pose.position),new Quaternion(...pose.quaternion),new Vector3(...pose.scale));
const corners=b=>{const result=[];for(const x of[b.min[0],b.max[0]])for(const y of[b.min[1],b.max[1]])for(const z of[b.min[2],b.max[2]])result.push(new Vector3(x,y,z));return result;};

test('input rig evidence retains primary attachment sources and explicitly authored 46-leaf membership',async()=>{
  const evidence=await read('../tour/motion-evidence.json');assert.equal(evidence.revision,KINEMATICS_REVISION);assert.equal(evidence.sourceSHA256,index.sourceSHA256);
  assert.deepEqual(evidence.rotatingIds,rig.rotatingIds);assert.equal(new Set(rig.rotatingIds).size,46);assert.equal(rig.rotatingIds.length,46);
  const rotating=index.parts.filter(p=>rig.rotatingIds.includes(p.id));assert.equal(rotating.filter(p=>p.name==='magnet').length,40);
  assert.deepEqual(rotating.filter(p=>p.name!=='magnet').map(p=>p.name).sort(),['rotor','rotor-body','motor-shaft','motor-hex-nut','sun-gear','encoder-magnet-holder'].sort());
  assert.ok(index.parts.filter(p=>p.name==='cc'||p.name==='stator'||p.name==='motor-mount-plate-8318').every(p=>!rig.rotatingIds.includes(p.id)));
  const manual=await readFile(new URL('../source/WOLF-Assembly-Guide-V1.1.pdf',import.meta.url));assert.equal(createHash('sha256').update(manual).digest('hex'),'fb1aea34edd40510d8bb681856b0035ac25a1c5782fff4e04d53003e41ffe58a');
  const text=await readFile(new URL('../source/UPSTREAM-README.md',import.meta.url),'utf8');assert.match(text,/does not require a planet gear carrier/);assert.match(text,/secure sun gear to motor/);
  assert.match(rig.evidence.membershipPolicy,/explicit mechanical interpretation/);assert.match(rig.evidence.membershipPolicy,/no rigid mates/);assert.match(rig.evidence.fixedPolicy,/not inferred/);
});

test('motion progress is seekable and returns complete exact identity resets for all 245 source parts',()=>{
  assert.deepEqual(rig.axisWorld,[0,-1,0]);assert.deepEqual(rig.pivotWorld,[0,.0149995213351072,0]);
  for(const progress of[0,1,0,.14,.73,.14,.5,1]){
    const poses=rig.workingPoses({motionDemoProgress:progress});assert.equal(Object.keys(poses).length,245);
    for(const[id,pose]of Object.entries(poses)){
      assert.ok(index.parts.some(p=>p.id===id));assert.ok(pose.position.every(Number.isFinite)&&pose.quaternion.every(Number.isFinite));near(pose.scale,[1,1,1],'unit scale');
      assert.ok(Math.abs(pose.quaternion.reduce((sum,v)=>sum+v*v,0)-1)<1e-12);
      if(progress===0||progress===1||!rig.rotatingIds.includes(id))assert.deepEqual(pose,identityPose);
    }
    const saved=rig.workingPoses({motionDemoProgress:progress});rig.workingPoses({motionDemoProgress:.43});assert.deepEqual(rig.workingPoses({motionDemoProgress:progress}),saved);
  }
  assert.deepEqual(rig.workingPoses(),rig.workingPoses({motionDemoProgress:0}));
  for(const p of[NaN,Infinity,-.1,1.1])assert.throws(()=>rig.workingPoses({motionDemoProgress:p}),/progress/);
  assert.equal(JSON.stringify(index),before);
});

test('actual GLB source hierarchy composes working input rotation before independent display translations',async()=>{
  const {json:gltf}=readGlb(await readFile(new URL('../assets/assembly.glb',import.meta.url))),asset=new Group(),objects=gltf.nodes.map(node=>{
    const group=new Group();group.name=node.name;group.userData={...node.extras};new Matrix4().fromArray(node.matrix).decompose(group.position,group.quaternion,group.scale);return group;
  });
  gltf.nodes.forEach((node,i)=>(node.children??[]).forEach(child=>objects[i].add(objects[child])));for(const root of gltf.scenes[gltf.scene??0].nodes)asset.add(objects[root]);
  const sourceNodeById=new Map(objects.filter(o=>o.userData.part_id).map(o=>[o.userData.part_id,o])),sourceLocal=new Map([...sourceNodeById].map(([id,node])=>{node.updateMatrix();return[id,node.matrix.toArray()];})),bound=bindAssembly(asset);
  assert.equal(bound.parts.size,245);
  const all=new Map([...index.assemblies,...index.parts].map(p=>[p.id,p]));
  for(const p of[0,.13,.25,.5,.79,1,0]){
    const offsets=Object.fromEntries(index.parts.map((part,i)=>[part.id,rig.rotatingIds.includes(part.id)?[.001*(i%3),-.001*(i%4),.001*(i%5)]:[0,0,0]]));
    const local=localDisplayOffsets(index,offsets,Matrix4,Vector3),poses=rig.workingPoses({motionDemoProgress:p});applyWorkingPoses(bound.parts,poses);applyDisplayExplosion(bound.parts,1,binding=>local.get(binding.id));asset.updateMatrixWorld(true);
    const W=rig.worldRotation(p);
    for(const part of index.parts){
      const expected=new Matrix4().fromArray(part.worldMatrix);if(rig.rotatingIds.includes(part.id))expected.premultiply(W);
      expected.elements[12]+=offsets[part.id][0];expected.elements[13]+=offsets[part.id][1];expected.elements[14]+=offsets[part.id][2];
      const node=bound.parts.get(part.id).node;near(node.matrixWorld.toArray(),expected.toArray(),`${part.id}: actual viewer composition`,2e-11);near(node.matrix.toArray(),sourceLocal.get(part.id),`${part.id}: immutable source rest`,2e-12);
      assert.equal(bound.parts.get(part.id).sourceParent.userData.assembly_id,part.parentId,'Original source parent identity remains direct');
    }
  }
  assert.equal(JSON.stringify(index),before);
});

test('parent-frame conjugation retains a common world rotation under noncommuting rigid placements',()=>{
  const transformed=structuredClone(index),P=new Matrix4().makeRotationX(.43).multiply(new Matrix4().makeRotationZ(-.61)).setPosition(.2,-.3,.4);
  const motor=transformed.assemblies.find(p=>p.name==='motor-8318 <1>');motor.worldMatrix=P.toArray();
  for(const part of transformed.parts.filter(p=>p.parentId===motor.id))part.worldMatrix=P.clone().multiply(new Matrix4().fromArray(part.worldMatrix)).toArray();
  const alternate=createWolfWorkingMotion(transformed),poses=alternate.workingPoses({motionDemoProgress:.31}),W=alternate.worldRotation(.31);
  for(const id of alternate.rotatingIds){const part=transformed.parts.find(p=>p.id===id),parent=transformed.assemblies.find(p=>p.id===part.parentId),parentMatrix=new Matrix4().fromArray(parent.worldMatrix),expected=W.clone().multiply(parentMatrix),actual=parentMatrix.clone().multiply(matrixOf(poses[id]));near(actual.toArray(),expected.toArray(),`${id}: conjugated world delta`);}
  const invalid=structuredClone(index);invalid.assemblies.find(p=>p.id===motor.id).worldMatrix=new Matrix4().makeScale(1,2,1).toArray();assert.throws(()=>createWolfWorkingMotion(invalid),/rigid source parent/);
});

test('fixed camera envelopes contain every moving source-box corner throughout a full input turn',()=>{
  const envelope=rig.rotationEnvelope();assert.equal(envelope.size,245);
  for(let i=0;i<=96;i++){
    const progress=i/96,bounds=rig.boundsAt(progress),W=rig.worldRotation(progress);assert.equal(bounds.size,245);
    for(const part of index.parts){const box=bounds.get(part.id),full=envelope.get(part.id);assert.ok([...box.min,...box.max,...full.min,...full.max].every(Number.isFinite));
      for(const point of corners(part.worldBounds)){if(rig.rotatingIds.includes(part.id))point.applyMatrix4(W);for(let axis=0;axis<3;axis++){assert.ok(point.getComponent(axis)>=box.min[axis]-1e-12&&point.getComponent(axis)<=box.max[axis]+1e-12,`${part.id}: actual working corner within sampled box`);assert.ok(point.getComponent(axis)>=full.min[axis]-1e-12&&point.getComponent(axis)<=full.max[axis]+1e-12,`${part.id}: actual working corner within full rotation envelope`);}}
      if(!rig.rotatingIds.includes(part.id))assert.deepEqual(box,part.worldBounds);
    }
  }
  assert.equal(JSON.stringify(index),before);
});
