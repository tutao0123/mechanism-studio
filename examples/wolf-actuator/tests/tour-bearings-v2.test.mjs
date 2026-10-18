import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Matrix4,Vector3,Quaternion} from 'three';
import {createWolfBearingRig,BEARING_DATA} from '../tour-v2/bearings.mjs';
const index=JSON.parse(fs.readFileSync(new URL('../assets/scene-index.json',import.meta.url)));
const rig=createWolfBearingRig(index),axis=new Vector3(0,-1,0),identity=new Matrix4();
const near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);

test('bearing aliases bind exact source leaves, alternating cylinders, races and cage without renaming source',()=>{
  assert.equal(rig.ownedIds.length,138);assert.equal(new Set(rig.ownedIds).size,138);
  for(const[side,g]of Object.entries(rig.groups)){
    assert.equal(g.rollers.length,66);
    for(const[id,name]of[[g.innerRace,'Part 59'],[g.outerRace,'Part 69'],[g.cage,'Part 62']])assert.equal(index.parts.find(p=>p.id===id).name,name);
    const ordered=[...g.rollers].sort((a,b)=>Math.atan2(a.center[2],a.center[0])-Math.atan2(b.center[2],b.center[0]));
    const signs=[];
    for(const p of ordered){
      const source=index.parts.find(s=>s.id===p.id);assert.equal(source.name,p.sourceName);assert.equal(source.triangleCount,716);
      const radial=new Vector3(p.center[0],0,p.center[2]);near(radial.length(),.08825,1e-9);radial.normalize();
      const u=new Vector3(...p.axis);near(u.length(),1);near(u.dot(axis),Math.SQRT1_2);near(Math.abs(u.dot(radial)),Math.SQRT1_2);assert.ok(p.measuredAxisError<2e-6);
      assert.ok(p.center.every((v,i)=>v>=source.worldBounds.min[i]&&v<=source.worldBounds.max[i]));
      signs.push(Math.sign(u.dot(radial)));
    }
    for(let i=0;i<66;i++)assert.equal(signs[i],-signs[(i+1)%66]);
  }
  for(const p of index.parts.filter(p=>p.name.startsWith('outer-ring-')))assert.ok(!rig.ownedIds.includes(p.id));
});

test('bearing rotation preserves cage-relative roller centre, spin axis and rigid source parent conjugation',()=>{
  const frozen=JSON.stringify(index),input={innerAngle:-.23,outerAngle:.42,bearing:'both'},world=rig.worldMotionsForAngles(input),poses=rig.posesForAngles(input),a=rig.angles(input);
  assert.equal(world.size,138);assert.equal(Object.keys(poses).length,245);
  for(const g of Object.values(rig.groups)){
    const pivot=new Vector3(...g.pivot),orbit=new Matrix4().makeRotationAxis(axis,a.cageAngle);
    for(const roller of g.rollers){
      const c=new Vector3(...roller.center),expected=c.clone().sub(pivot).applyMatrix4(orbit).add(pivot),actual=c.clone().applyMatrix4(world.get(roller.id));
      assert.ok(actual.distanceTo(expected)<1e-12);
      const u=new Vector3(...roller.axis).transformDirection(world.get(roller.id)),expectedU=new Vector3(...roller.axis).transformDirection(orbit);assert.ok(u.distanceTo(expectedU)<1e-12);
    }
  }
  const all=new Map([...index.parts,...index.assemblies].map(p=>[p.id,p]));
  for(const[id,w]of world){const p=all.get(id),parent=new Matrix4().fromArray(all.get(p.parentId).worldMatrix),pose=poses[id],delta=new Matrix4().compose(new Vector3(...pose.position),new Quaternion(...pose.quaternion),new Vector3(...pose.scale)),reconstructed=parent.clone().multiply(delta).multiply(parent.clone().invert());near(w.determinant(),1);w.elements.forEach((v,i)=>near(v,reconstructed.elements[i]));}
  assert.equal(JSON.stringify(index),frozen);
});

test('finite-difference world velocity agrees at both ideal roller-race contacts',()=>{
  // Independently differentiate moving material points, not the rig's residual helper.
  const dt=1e-6,innerSpeed=-.4,outerSpeed=.8;
  const before=rig.worldMotionsForAngles({innerAngle:-dt*innerSpeed,outerAngle:-dt*outerSpeed}),after=rig.worldMotionsForAngles({innerAngle:dt*innerSpeed,outerAngle:dt*outerSpeed});
  for(const g of Object.values(rig.groups))for(const roller of g.rollers){
    const c=new Vector3(...roller.center),u=new Vector3(...roller.axis),radial=new Vector3(c.x,0,c.z).normalize(),n=radial.clone().addScaledVector(u,-radial.dot(u)).normalize();
    for(const[sign,speed]of[[1,outerSpeed],[-1,innerSpeed]]){
      const point=c.clone().addScaledVector(n,sign*.00299),velocity=point.clone().applyMatrix4(after.get(roller.id)).sub(point.clone().applyMatrix4(before.get(roller.id))).multiplyScalar(1/(2*dt));
      const raceVelocity=new Vector3().crossVectors(axis,point.clone().sub(new Vector3(...g.pivot))).multiplyScalar(speed);
      assert.ok(velocity.distanceTo(raceVelocity)<1e-8,`${roller.id} contact residual ${velocity.distanceTo(raceVelocity)}`);
    }
  }
  assert.ok(rig.contactResiduals({innerSpeed,outerSpeed}).every(v=>v.inner<1e-9&&v.outer<1e-9));
});

test('equal race speeds produce common rigid rotation; zero input restores all 245 leaves after arbitrary seeks',()=>{
  for(const angle of[-.7,.3]){const a=rig.angles({innerAngle:angle,outerAngle:angle});near(a.cageAngle,angle);near(a.rollerSpinAngle,0);}
  rig.posesForAngles({outerAngle:1.7});const zero=rig.posesForAngles({});
  for(const p of Object.values(zero))assert.deepEqual(p,{position:[0,0,0],quaternion:[0,0,0,1],scale:[1,1,1]});
  const only=rig.worldMotionsForAngles({bearing:'A',outerAngle:.4});assert.equal(only.size,69);for(const id of only.keys())assert.ok(id.includes('-923-'));
  const held=rig.posesForAngles({bearing:'A',outerAngle:.4});for(const p of index.parts.filter(p=>!only.has(p.id)))assert.deepEqual(held[p.id],zero[p.id]);
});

test('bearing motion bounds contain all transformed original corners and invalid inputs fail',()=>{
  const input={outerAngle:.6,innerAngle:-.1},b=rig.boundsAtAngles(input),m=rig.worldMotionsForAngles(input);
  for(const p of index.parts){const box=b.get(p.id);for(const x of[p.worldBounds.min[0],p.worldBounds.max[0]])for(const y of[p.worldBounds.min[1],p.worldBounds.max[1]])for(const z of[p.worldBounds.min[2],p.worldBounds.max[2]]){const v=new Vector3(x,y,z).applyMatrix4(m.get(p.id)||identity);v.toArray().forEach((a,i)=>assert.ok(a>=box.min[i]-1e-12&&a<=box.max[i]+1e-12));}}
  assert.throws(()=>rig.posesForAngles({outerAngle:NaN}));assert.throws(()=>rig.posesForAngles({bearing:'C'}));assert.throws(()=>createWolfBearingRig({...index,geometryRevision:'another'}));
  assert.equal(BEARING_DATA.sourceRollingClearance,.00001);assert.match(rig.evidence.model,/Ideal no-slip/);assert.match(rig.evidence.limitations.join(' '),/clearance/);
});
