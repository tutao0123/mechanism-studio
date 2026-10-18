import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,Matrix4,Quaternion,Vector3} from 'three';
import {createWolfGearRig,TOOTH_COUNTS,SIGNED_RATIOS} from '../tour-v2/gearing.mjs';
import {localDisplayOffsets} from '../story.mjs';
import {bindAssembly,applyWorkingPoses,applyDisplayExplosion} from '../../../shared/viewer/scene.mjs';
import {readGlb} from '../../../shared/assets/glb.mjs';
const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const index=await read('../assets/scene-index.json'),rig=createWolfGearRig(index),before=JSON.stringify(index);
const near=(a,b,label='',eps=1e-10)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<eps,`${label}[${i}]: ${v} vs ${b[i]}`));};
const poseMatrix=p=>new Matrix4().compose(new Vector3(...p.position),new Quaternion(...p.quaternion),new Vector3(...p.scale));
const identity={position:[0,0,0],quaternion:[0,0,0,1],scale:[1,1,1]};

test('WOLF measured source tooth periods support separate fixed plates and keyed output rings',async()=>{
  const evidence=await read('../tour/research-v2/gear-section-results.json');
  assert.equal(evidence.sourceSHA256,index.sourceSHA256);
  for(const[name,count]of[['sun-gear',96],['front-plate',156],['back-plate',156],['internal-ring-gear-A',144],['internal-ring-gear-B',144],...Array.from({length:12},(_,i)=>[`planet-${i+1}`,24])]){
    const sections=evidence.sections.filter(s=>s.name===name);assert.ok(sections.length>=3,`${name}: multiple axial slices required`);
    for(const s of sections){assert.equal(s.toothPeakCount,count);assert.equal(s.leadingFourierHarmonics[0].cyclesPerTurn,count);}
  }
  assert.equal(rig.ownedIds.length,62);assert.equal(new Set(rig.ownedIds).size,62);
  assert.equal(rig.ids.input.length,46);assert.equal(rig.ids.planets.length,12);assert.equal(rig.ids.output.length,4);
  assert.deepEqual(index.parts.filter(p=>rig.ids.output.includes(p.id)).map(p=>p.name).sort(),['internal-ring-gear-A','internal-ring-gear-B','outer-ring-A','outer-ring-B']);
  assert.ok(rig.ids.fixed.every(id=>!rig.ownedIds.includes(id)));assert.equal(rig.evidence.signedInputToOutputRatio,-31.5);assert.equal(rig.evidence.publishedNominalReduction,34);
});

test('all three gear phase constraints hold for positive, negative and arbitrary seek angles',()=>{
  const N=TOOTH_COUNTS;
  for(const s of[-6*Math.PI,-1.1,0,.001,.33,Math.PI,17.2,100]){
    const q=rig.coordinatesForAngle(s);
    near([N.sun*(q.sun-q.orbit)+N.planetMiddle*(q.planet-q.orbit),N.outputRings*(q.output-q.orbit)-N.planetMiddle*(q.planet-q.orbit),N.fixedPlates*(q.fixed-q.orbit)-N.planetEnds*(q.planet-q.orbit)],[0,0,0],'signed mesh residual',1e-10);
    if(s)assert.ok(q.output/s<0,'output reverses relative to input');
    const poses=rig.posesForAngle(s),again=rig.posesForAngle(s);rig.posesForAngle(-s+.01);assert.deepEqual(rig.posesForAngle(s),again);
    assert.equal(Object.keys(poses).length,245);for(const[id,p]of Object.entries(poses)){near(p.scale,[1,1,1]);assert.ok(p.quaternion.every(Number.isFinite));near([p.quaternion.reduce((a,v)=>a+v*v,0)],[1]);if(!rig.ownedIds.includes(id)||s===0)assert.deepEqual(p,identity);}
  }
  for(const invalid of[NaN,Infinity,-Infinity])assert.throws(()=>rig.posesForAngle(invalid),/finite radians/);
  assert.equal(JSON.stringify(index),before);
});

test('actual source hierarchy places each planet on its orbit while spinning about its own geometric axis',async()=>{
  const {json:gltf}=readGlb(await readFile(new URL('../assets/assembly.glb',import.meta.url))),asset=new Group(),nodes=gltf.nodes.map(n=>{const g=new Group();g.name=n.name;g.userData={...n.extras};new Matrix4().fromArray(n.matrix).decompose(g.position,g.quaternion,g.scale);return g;});
  gltf.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>nodes[i].add(nodes[c])));for(const i of gltf.scenes[gltf.scene??0].nodes)asset.add(nodes[i]);
  const bound=bindAssembly(asset),rest=new Map([...bound.parts].map(([id,b])=>{b.node.updateMatrix();return[id,b.node.matrix.toArray()];})),axis=new Vector3(...rig.axisWorld),pivot=new Vector3(...rig.pivotWorld);
  for(const s of[0,.37,Math.PI,-2.7,6*Math.PI,0]){
    const offsets=Object.fromEntries(index.parts.map((p,i)=>[p.id,[.002*(i%3),-.001*(i%5),.003*(i%4)]])),local=localDisplayOffsets(index,offsets,Matrix4,Vector3),q=rig.coordinatesForAngle(s),world=rig.worldMotionsForAngle(s);
    applyWorkingPoses(bound.parts,rig.posesForAngle(s));applyDisplayExplosion(bound.parts,1,b=>local.get(b.id));asset.updateMatrixWorld(true);
    for(const p of index.parts){
      const expected=world.get(p.id).clone().multiply(new Matrix4().fromArray(p.worldMatrix));expected.elements[12]+=offsets[p.id][0];expected.elements[13]+=offsets[p.id][1];expected.elements[14]+=offsets[p.id][2];
      near(bound.parts.get(p.id).node.matrixWorld.toArray(),expected.toArray(),`${p.id} actual pose`);near(bound.parts.get(p.id).node.matrix.toArray(),rest.get(p.id),'source TRS stays fixed');
    }
    for(const id of rig.ids.planets){
      const center=new Vector3(...rig.planetCenters.get(id)),rotatedCenter=center.clone().sub(pivot).applyAxisAngle(axis,q.orbit).add(pivot);
      near(center.clone().applyMatrix4(world.get(id)).toArray(),rotatedCenter.toArray(),'orbit centre');
      const vector=new Vector3(.003,.002,-.001),point=center.clone().add(vector).applyMatrix4(world.get(id));
      near(point.toArray(),vector.clone().applyAxisAngle(axis,q.planet).add(rotatedCenter).toArray(),'independent own-axis spin');
      near([center.clone().sub(pivot).cross(axis).length()],[rotatedCenter.clone().sub(pivot).cross(axis).length()],'orbit radius stays fixed');
    }
  }
  assert.equal(JSON.stringify(index),before);
});

test('nested outer-ring source parents receive conjugated output poses and finite bounds',()=>{
  const all=new Map([...index.assemblies,...index.parts].map(p=>[p.id,p]));
  for(const s of[-9,.1,5]){
    const poses=rig.posesForAngle(s),world=rig.worldMotionsForAngle(s),bounds=rig.boundsAtAngle(s);
    for(const id of rig.ownedIds){const p=all.get(id),P=new Matrix4().fromArray(all.get(p.parentId).worldMatrix);near(P.clone().multiply(poseMatrix(poses[id])).toArray(),world.get(id).clone().multiply(P).toArray(),'actual source parent conjugation');}
    for(const p of index.parts){const b=bounds.get(p.id);assert.ok([...b.min,...b.max].every(Number.isFinite));for(let i=0;i<3;i++)assert.ok(b.max[i]>=b.min[i]);}
  }
});
