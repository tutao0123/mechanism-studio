import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {bindAssembly,applyWorkingPoses,applyDisplayExplosion,visibleBounds} from '../../shared/viewer/scene.mjs';
import {ROTORS} from '../../examples/turbofan/model.mjs';
import {createAdapter,sampleChapter} from '../adapters/turbofan.mjs';

async function fixture(){
  const root=new URL('../../examples/turbofan/',import.meta.url),bytes=await readFile(new URL('assets/turbofan.glb',root));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const contract=JSON.parse(await readFile(new URL('assets/scene-contract.json',root),'utf8'));
  const scene=new THREE.Scene();scene.add(gltf.scene);const binding=bindAssembly(gltf.scene,{contract});
  return {...binding,scene,
    applyPoses:(poses,config)=>applyWorkingPoses(binding.parts,poses,config),
    setExplode:(value,options)=>applyDisplayExplosion(binding.parts,value,options.vectorForPart),
    setCutaway:enabled=>{for(const b of binding.parts.values())b.display.visible=!(enabled&&b.record.cutawayHidden);},
  };
}
const frame=(chapterId,p=.5,explode=0,time=27)=>({chapterId,chapterProgress:p,localTime:p*12,totalTime:time,explode});

test('the two prescribed shafts share the total clock while assembly has a deterministic open/close fallback',()=>{
  for(const chapterId of ['overview','fan','compression','combustion','exhaust','assembly']){
    const s=sampleChapter({chapterId,totalTime:7,chapterProgress:.5});assert.equal(s.lowAngle,252);assert.equal(s.highAngle,102);
  }
  assert.equal(sampleChapter({chapterId:'assembly',chapterProgress:0}).explode,0);
  assert.equal(sampleChapter({chapterId:'assembly',chapterProgress:.5}).explode,1);
  assert.equal(sampleChapter({chapterId:'assembly',chapterProgress:1}).explode,0);
  assert.equal(sampleChapter({chapterId:'fan',explode:1}).explode,0);
  assert.throws(()=>sampleChapter({chapterId:'absent'}));assert.throws(()=>sampleChapter({totalTime:NaN}));
});

test('actual rotor ownership, steady combustion and separate air paths remain independent of chapter display',async t=>{
  const viewer=await fixture(),adapter=createAdapter(THREE,viewer);t.after(()=>adapter.dispose());
  adapter.update(frame('combustion',.2,0,7));const first=adapter.snapshot();
  for(const [id,spool] of Object.entries(ROTORS))assert.equal(viewer.parts.get(id).node.rotation.x,(spool==='low'?252:102)*Math.PI/180);
  for(const binding of viewer.parts.values())if(binding.record.motionOwner==='static')assert.equal(binding.node.rotation.x,0);
  assert.equal(first.process.continuousCombustion,true);assert.equal(first.process.tailFlame,false);assert.equal(first.effects.externalFlamePockets,0);
  assert.equal(first.process.combustionIntensity,.72);
  const sections=new Set(first.effects.flows.map(f=>f.section));for(const name of ['core','bypass','hot','exhaust'])assert.ok(sections.has(name));
  adapter.update(frame('combustion',.8,0,19));assert.equal(adapter.snapshot().process.combustionIntensity,first.process.combustionIntensity,'combustion cannot re-ignite on a rotor clock');
  adapter.update(frame('assembly',.5,1,19));const exploded=adapter.snapshot();assert.equal(exploded.process.visible,false);assert.equal(exploded.effects.visible,false);
  const mechanics=exploded.mechanical;
  adapter.update(frame('assembly',1,0,19));assert.deepEqual(adapter.snapshot().mechanical,mechanics);assert.equal(adapter.snapshot().process.visible,true);
  for(const part of viewer.parts.values())assert.ok(part.display.position.toArray().every(v=>v===0));
  assert.equal(viewer.parts.size,34);assert.equal(viewer.meshes.length,34);
  for(const chapterId of ['overview','fan','compression','combustion','exhaust','assembly']){
    adapter.update(frame(chapterId));for(const a of adapter.annotations(chapterId)){assert.ok(viewer.parts.has(a.id));assert.ok(a.point.every(Number.isFinite));assert.doesNotMatch(a.label,/[\u3400-\u9fff]/);}
    assert.doesNotMatch(JSON.stringify(adapter.snapshot()),/[\u3400-\u9fff]/);
  }
  adapter.dispose();assert.equal(viewer.scene.getObjectByName('showcase/turbofan/process'),undefined);
});

test('safe cameras keep current English anchors and wide assembly bounds visible across mobile/desktop aspects',async t=>{
  const viewer=await fixture(),adapter=createAdapter(THREE,viewer);t.after(()=>adapter.dispose());
  for(const chapter of ['overview','fan','compression','combustion','exhaust','assembly'])for(const p of [.1,.5,.9])for(const aspect of [.5,.65,1,1.6,2.4]){
    adapter.update(frame(chapter,p,chapter==='assembly'?p:0));const framing=adapter.camera(chapter,p,aspect);
    const camera=new THREE.OrthographicCamera(-framing.halfHeight*aspect,framing.halfHeight*aspect,framing.halfHeight,-framing.halfHeight,.001,20);
    camera.position.fromArray(framing.position);camera.lookAt(new THREE.Vector3(...framing.target));camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
    const points=adapter.annotations(chapter).map(a=>new THREE.Vector3(...a.point));
    if(chapter==='overview'||chapter==='assembly'){
      const bounds=visibleBounds(viewer.meshes);for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new THREE.Vector3(x,y,z));
    }
    for(const world of points){const q=world.project(camera);assert.ok(Math.abs(q.x)<.95&&Math.abs(q.y)<.95,`${chapter}/${aspect}: anchor or assembly crop`);assert.ok(q.z>-1&&q.z<1);}
    assert.deepEqual(adapter.snapshot().camera,framing);
  }
});
