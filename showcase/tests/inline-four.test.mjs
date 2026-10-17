import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {bindAssembly,applyWorkingPoses,applyDisplayExplosion,visibleBounds} from '../../shared/viewer/scene.mjs';
import {createAdapter,sampleChapter} from '../adapters/inline-four.mjs';

async function fixture(){
  const root=new URL('../../examples/inline-four/',import.meta.url),bytes=await readFile(new URL('assets/inline-four.glb',root));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const contract=JSON.parse(await readFile(new URL('assets/scene-contract.json',root),'utf8'));
  const scene=new THREE.Scene();scene.add(gltf.scene);const binding=bindAssembly(gltf.scene,{contract});
  return {...binding,scene,
    applyPoses:(poses,config)=>applyWorkingPoses(binding.parts,poses,config),
    setExplode:(value,options)=>applyDisplayExplosion(binding.parts,value,options.vectorForPart),
    setCutaway:enabled=>{for(const b of binding.parts.values())b.display.visible=!(enabled&&b.record.cutawayHidden);},
  };
}
const frame=(chapterId,chapterProgress=.5,explode=0)=>({chapterId,chapterProgress,localTime:chapterProgress*8,totalTime:18+chapterProgress*8,explode});

test('story phases are deterministic, stage-correct and keep a readable finite ignition segment',()=>{
  assert.equal(sampleChapter({chapterId:'overview',totalTime:2}).angle,150);
  for(const [chapter,low,high] of [['intake',360,540],['compression',540,720],['ignition',0,180],['exhaust',180,360]])for(const p of [0,.1,.5,.9,1]){
    const a=sampleChapter(frame(chapter,p));assert.ok(a.angle>=low&&a.angle<high);assert.deepEqual(sampleChapter(frame(chapter,p)),a);
  }
  assert.ok(sampleChapter(frame('ignition',.25)).angle<14);assert.ok(sampleChapter(frame('ignition',.8)).angle>14);
  assert.equal(sampleChapter(frame('assembly',.5,1)).angle,90);
  assert.equal(sampleChapter({chapterId:'assembly',chapterProgress:.5}).explode,1);
  assert.equal(sampleChapter({chapterId:'assembly',chapterProgress:1}).explode,0);
  assert.equal(sampleChapter(frame('intake',.5,1)).explode,0);
  assert.throws(()=>sampleChapter({chapterId:'absent'}));assert.throws(()=>sampleChapter({totalTime:NaN}));
});

test('actual asset poses, moving English annotations and hidden explosion processes follow one story state',async t=>{
  const viewer=await fixture(),adapter=createAdapter(THREE,viewer);t.after(()=>adapter.dispose());
  adapter.update(frame('intake',.1));const start=adapter.snapshot(),a=adapter.annotations('intake').find(a=>a.id==='piston-1');
  adapter.update(frame('intake',.8));const end=adapter.snapshot(),b=adapter.annotations('intake').find(a=>a.id==='piston-1');
  assert.ok(end.mechanical.cylinders[0].pistonHeightMM<start.mechanical.cylinders[0].pistonHeightMM);
  assert.ok(Math.abs((b.point[1]-a.point[1])-(end.mechanical.cylinders[0].pistonHeightMM-start.mechanical.cylinders[0].pistonHeightMM)*.001)<1e-10);
  assert.ok(end.process.cylinders[0].injection.intensity>0);
  adapter.update(frame('compression'));assert.equal(adapter.snapshot().mechanical.cylinders[0].intakeLiftMM,0);assert.equal(adapter.snapshot().mechanical.cylinders[0].exhaustLiftMM,0);
  adapter.update(frame('ignition',.2));assert.equal(adapter.snapshot().process.cylinders[0].spark.active,true);
  adapter.update(frame('assembly',.2,.2));const mechanical=adapter.snapshot().mechanical;
  adapter.update(frame('assembly',.8,1));assert.deepEqual(adapter.snapshot().mechanical,mechanical);assert.equal(adapter.snapshot().process.visible,false);
  assert.equal(viewer.parts.size,46);assert.equal(viewer.meshes.length,423);
  adapter.update(frame('assembly',1,0));for(const part of viewer.parts.values())assert.ok(part.display.position.toArray().every(value=>value===0));
  for(const chapter of ['overview','intake','compression','ignition','exhaust','assembly']){
    adapter.update(frame(chapter));
    for(const label of adapter.annotations(chapter)){assert.ok(viewer.parts.has(label.id));assert.ok(label.point.every(Number.isFinite));assert.ok(['left','right'].includes(label.side));assert.doesNotMatch(label.label,/[\u3400-\u9fff]/);}
    assert.doesNotMatch(JSON.stringify(adapter.snapshot().mechanical),/[\u3400-\u9fff]/);
    assert.doesNotMatch(JSON.stringify(adapter.snapshot().process),/[\u3400-\u9fff]/);
  }
  adapter.dispose();assert.equal(viewer.scene.getObjectByName('showcase/inline-four/process'),undefined);
});

test('overview/assembly fit the actual current bounds and close-up annotations stay framed at portrait and desktop aspects',async t=>{
  const viewer=await fixture(),adapter=createAdapter(THREE,viewer);t.after(()=>adapter.dispose());
  for(const chapter of ['overview','intake','compression','ignition','exhaust','assembly'])for(const p of [.1,.5,.9])for(const aspect of [.5,.65,1,1.6,2.4]){
    adapter.update(frame(chapter,p,chapter==='assembly'?p:0));const framing=adapter.camera(chapter,p,aspect);
    const camera=new THREE.OrthographicCamera(-framing.halfHeight*aspect,framing.halfHeight*aspect,framing.halfHeight,-framing.halfHeight,.001,20);
    camera.position.fromArray(framing.position);camera.lookAt(new THREE.Vector3(...framing.target));camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
    const points=adapter.annotations(chapter).map(a=>new THREE.Vector3(...a.point));
    if(chapter==='overview'||chapter==='assembly'){
      const box=visibleBounds(viewer.meshes);for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z));
    }
    for(const world of points){const q=world.project(camera);assert.ok(Math.abs(q.x)<.95&&Math.abs(q.y)<.95,`${chapter}/${aspect}: annotation or assembly crop`);assert.ok(q.z>-1&&q.z<1);}
    assert.deepEqual(adapter.snapshot().camera,framing);
  }
});
