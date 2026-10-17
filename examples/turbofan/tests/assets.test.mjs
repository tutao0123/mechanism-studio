import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {bindAssembly,applyWorkingPoses,applyDisplayExplosion,resetDisplay} from '../../../shared/viewer/scene.mjs';
import {ROTORS,createState,mechanical,poses,bodyToGLTF} from '../model.mjs';
import {optionalAssetSet} from '../../../tests/optional-assets.mjs';
const root=new URL('../',import.meta.url);
const raw=await readFile(new URL('assets/turbofan.glb',root));
const doc=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)).toString('utf8').trim());
const contract=JSON.parse(await readFile(new URL('assets/scene-contract.json',root),'utf8'));
const report=JSON.parse(await readFile(new URL('assets/build-report.json',root),'utf8'));
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const byId=new Map(doc.nodes.filter(n=>n.extras?.part_id).map(n=>[n.extras.part_id,n]));

test('actual GLB and editable procedural source match the reproducible builder report',async()=>{
  assert.equal(raw.readUInt32LE(0),0x46546c67);assert.equal(raw.readUInt32LE(4),2);assert.equal(raw.readUInt32LE(8),raw.length);
  assert.equal(hash(raw),report.glbSha256);assert.equal(hash(await readFile(new URL('blender/build-turbofan.py',root))),report.builderSha256);
  const localBlend=await optionalAssetSet([new URL('assets/turbofan.blend',root)]);if(localBlend)assert.equal(localBlend[0].subarray(0,7).toString(),'BLENDER');
  assert.equal(report.mcpUsed,false);assert.equal(report.partCount,34);assert.equal(report.meshCount,34);assert.ok(report.triangles>50000&&report.triangles<100000);
});

test('all stable source IDs have assembly ancestry, explicit motion owner and finite display vectors',()=>{
  const assembly=doc.nodes.find(n=>n.extras?.assembly_id==='turbofan');assert.ok(assembly);
  assert.equal(byId.size,contract.parts.length);assert.equal(new Set(contract.parts.map(p=>p.part_id)).size,contract.parts.length);
  for(const part of contract.parts){const node=byId.get(part.part_id);assert.ok(node,part.part_id);assert.ok(assembly.children.includes(doc.nodes.indexOf(node)));assert.equal(node.extras.motionOwner,part.motionOwner);assert.ok(['static','model'].includes(part.motionOwner));assert.equal(node.extras.spool,part.spool);assert.ok(part.explode.every(Number.isFinite));assert.deepEqual(part.rest.translation,[0,0,0]);}
  for(const [id,spool] of Object.entries(ROTORS)){assert.equal(byId.get(id).extras.spool,spool);assert.equal(byId.get(id).extras.motionOwner,'model');}
  for(const id of ['combustor','bypass-duct','nozzle','casing-front','bearing-support-1','bearing-support-2'])assert.equal(byId.get(id).extras.motionOwner,'static');
});

test('shaft source geometry has concentric clearance and thick three-dimensional blade solids',async()=>{
  const asset=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
  const {parts}=bindAssembly(asset.scene,{contract});
  const positions=id=>{const result=[];parts.get(id).node.traverse(node=>{if(node.isMesh){const pos=node.geometry.getAttribute('position');for(let i=0;i<pos.count;i++)result.push(new THREE.Vector3().fromBufferAttribute(pos,i));}});return result;};
  const low=positions('low-shaft'),high=positions('high-shaft');
  assert.ok(Math.max(...low.map(p=>Math.hypot(p.y,p.z)))<.0181);
  assert.ok(Math.min(...high.map(p=>Math.hypot(p.y,p.z)))>.0169);
  // At the overlapping straight shaft section, LP radius 11 mm fits inside HP
  // inner radius 17 mm. End shoulders are intentionally outside this section.
  const lowStraightEnds=low.filter(p=>Math.abs(p.x+.4425)<1e-6||Math.abs(p.x-.4025)<1e-6);
  assert.ok(lowStraightEnds.length>100);
  assert.ok(lowStraightEnds.every(p=>Math.hypot(p.y,p.z)<.0111));
  const fan=positions('fan'),box=new THREE.Box3().setFromPoints(fan);
  assert.ok(box.max.y-box.min.y>.42);assert.ok(box.max.z-box.min.z>.42);assert.ok(box.max.x-box.min.x>.05);
  assert.equal(contract.units.body,'mm');assert.equal(contract.units.asset,'m');
});

test('actual loaded model follows separate spool inputs while every stator stays fixed through explode/reset',async()=>{
  const asset=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
  const binding=bindAssembly(asset.scene,{contract}),state=mechanical(createState(),{lowAngle:45,highAngle:135});
  applyWorkingPoses(binding.parts,poses(state),{target:'node'});
  for(const [id,spool] of Object.entries(ROTORS))assert.equal(binding.parts.get(id).node.rotation.x,(spool==='low'?45:135)*Math.PI/180);
  for(const record of contract.parts.filter(p=>p.motionOwner==='static'))assert.equal(binding.parts.get(record.part_id).node.rotation.x,0);
  const work=[...binding.parts].map(([id,b])=>({id,rotation:b.node.quaternion.toArray(),position:b.node.position.toArray()}));
  applyDisplayExplosion(binding.parts,1,b=>bodyToGLTF(b.record.explode));resetDisplay(binding.parts);
  assert.deepEqual([...binding.parts].map(([id,b])=>({id,rotation:b.node.quaternion.toArray(),position:b.node.position.toArray()})),work);
  for(const {display} of binding.parts.values())assert.deepEqual(display.position.toArray(),[0,0,0]);
});
