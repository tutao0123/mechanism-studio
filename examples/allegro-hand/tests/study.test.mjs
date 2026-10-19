import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Matrix4, Quaternion, Vector3, Box3, OrthographicCamera } from 'three';
import {createHandStory,BPM,DURATION,DETAIL_IDS,CHAPTERS} from '../story.mjs';
import {createHandFraming,CAMERA_UP} from '../framing.mjs';
import {annotationCues,CUE_WINDOWS} from '../annotations.mjs';
import {createHandServer,publicFile} from '../serve.mjs';
const root=new URL('../',import.meta.url),json=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const index=await json('assets/scene-index.json'),source=await json('assets/source-assembly.json'),provenance=await json('source/provenance.json');
const timeline=createHandStory(index,source),rig=timeline.rig,framing=createHandFraming(index,timeline),byId=new Map(index.parts.map(p=>[p.id,p]));
const near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const nearMatrix=(a,b)=>a.elements.forEach((n,i)=>near(n,b.elements[i],1e-8));
const bmat=new Matrix4().set(1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1),binv=bmat.clone().invert();
test('pinned source bytes, model-specific license and true assembly counts',async()=>{
 assert.equal(provenance.license,'BSD-2-Clause');assert.equal(provenance.revision,'62ab00f2bc44f6f20c1c9b7a13f3fb1dd41a4e35');
 for(const file of provenance.files){const bytes=await readFile(new URL(`source/${file.localFile}`,root));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
 assert.equal(index.parts.length,21);assert.equal(source.bodies.length,21);assert.equal(rig.joints.length,16);assert.equal(new Set(index.parts.map(p=>p.id)).size,21);
 assert.match(await readFile(new URL('source/LICENSE',root),'utf8'),/Copyright \(c\) 2016, SimLab/);
});
test('authored hand angles remain inside all source limits; explosion occurs only at valid neutral',()=>{
 for(let t=0;t<DURATION;t+=1/120){const s=timeline.stateAt(t);rig.validateAngles(s.angles);if(Object.values(s.offsetsWorld).some(v=>v.some(x=>Math.abs(x)>1e-12)))assert.deepEqual(s.angles,rig.neutralAngles());}
 assert.equal(rig.neutralAngles().thj0,.263);assert.equal(source.bodies.find(b=>b.name==='th_base').joints[0].ref,0);
 assert.throws(()=>rig.posesForAngles({...rig.neutralAngles(),thj0:0}),/outside/);
});
test('working FK agrees with independently evaluated native MJCF joints and basis',()=>{
 for(const beat of [0,3,5,9,15,18,28,42,62]){
  const angles=timeline.stateAt(beat*60/BPM).angles,actual=rig.worldMatricesForAngles(angles),native=new Map();
  for(const body of source.bodies){const q=body.quatWxyz,local=new Matrix4().compose(new Vector3(...body.pos),new Quaternion(q[1],q[2],q[3],q[0]).normalize(),new Vector3(1,1,1));
   for(const joint of body.joints){const p=joint.pos,rotation=new Matrix4().makeRotationAxis(new Vector3(...joint.axis).normalize(),angles[joint.name]-joint.ref);local.multiply(new Matrix4().makeTranslation(...p)).multiply(rotation).multiply(new Matrix4().makeTranslation(...p.map(v=>-v)));}
   const world=(native.get(body.parent)?.clone()??new Matrix4()).multiply(local);native.set(body.name,world);nearMatrix(actual.get(`mjcf:${body.name}`),bmat.clone().multiply(world).multiply(binv));
  }
 }
});
test('model wrappers and posed-parent offsets match desired world displacements without mutating source',()=>{
 const before=JSON.stringify(index),sourceBefore=JSON.stringify(source);
 for(const beat of [0,4,16,22.5,25,27,38,50,54,56.5,59]){
  const s=timeline.stateAt(beat*60/BPM),pose=rig.workingPoses(s),offsets=timeline.localDisplayOffsets(index,s.offsetsWorld,Matrix4,Vector3),worlds=new Map(),expected=rig.worldMatricesForAngles(s.angles);
  for(const p of index.parts){const q=pose[p.id],working=new Matrix4().compose(new Vector3(...q.position),new Quaternion(...q.quaternion),new Vector3(...q.scale));
   const actual=(worlds.get(p.parentId)?.clone()??new Matrix4()).multiply(new Matrix4().makeTranslation(...offsets.get(p.id))).multiply(working).multiply(new Matrix4().fromArray(p.localMatrix));worlds.set(p.id,actual);
   const desired=new Matrix4().makeTranslation(...s.offsetsWorld[p.id]).multiply(expected.get(p.id));nearMatrix(actual,desired);
  }
 }
 assert.equal(JSON.stringify(index),before);assert.equal(JSON.stringify(source),sourceBefore);
});
test('original finger detail is identity-bound and fixed-scale; complete loop and backward seeking recover',()=>{
 assert.deepEqual(DETAIL_IDS.map(id=>byId.get(id).source.body),['ff_base','ff_proximal','ff_medial','ff_distal','ff_tip']);
 for(const second of [0,5,20,3,34,DURATION,20]){const a=timeline.stateAt(second);assert.deepEqual(a,timeline.stateAt(second+DURATION));for(const pose of Object.values(rig.workingPoses(a)))pose.scale.forEach(v=>near(v,1));}
 const start=timeline.stateAt(0),end=timeline.stateAt(DURATION-1e-7);assert.deepEqual(end.angles,start.angles);assert.deepEqual(end.offsetsWorld,start.offsetsWorld);
 const a=framing.cameraFor('gesture',16/9,0),b=framing.cameraFor('resolve',16/9,6*60/BPM-1e-7);a.target.forEach((n,i)=>near(n,b.target[i]));near(a.halfHeight,b.halfHeight);
});
test('every retained annotation names a stationary source part after camera settling',()=>{
 for(const chapter of CHAPTERS)for(const[start,end]of CUE_WINDOWS[chapter.id]){
  const first=timeline.stateAt(chapter.firstBeat*60/BPM+start+.01),pose=rig.worldMatricesForAngles(first.angles),camera=framing.cameraFor(chapter.id,16/9,start+.01);
  for(let local=start+.01;local<end-.01;local+=.1){const state=timeline.stateAt(chapter.firstBeat*60/BPM+local);for(const cue of annotationCues(state)){nearMatrix(rig.worldMatricesForAngles(state.angles).get(cue.id),pose.get(cue.id));assert.deepEqual(state.offsetsWorld[cue.id],first.offsetsWorld[cue.id]);}const now=framing.cameraFor(chapter.id,16/9,local);camera.target.forEach((v,i)=>near(v,now.target[i]));near(camera.halfHeight,now.halfHeight);}
 }
 for(const c of CHAPTERS){const state=timeline.stateAt(c.firstBeat*60/BPM+.01);assert.deepEqual(annotationCues(state),[]);assert.deepEqual(annotationCues(state,{cameraSettled:false}),[]);}
});
test('preplanned camera contains every visible posed part through working, explosion and detail transitions',()=>{
 for(const aspect of [16/9,1,390/450])for(let beat=0;beat<64;beat+=.125){
  const s=timeline.stateAt(beat*60/BPM),plan=framing.cameraFor(s.chapter.id,aspect,s.localTime),camera=new OrthographicCamera(-plan.halfHeight*aspect,plan.halfHeight*aspect,plan.halfHeight,-plan.halfHeight,.001,20);
  camera.up.fromArray(CAMERA_UP);camera.position.fromArray(plan.position);camera.lookAt(new Vector3(...plan.target));camera.updateMatrixWorld(true);const bounds=rig.boundsForAngles(s.angles);
  for(const p of index.parts){if(timeline.opacityFor(s,p.id)<.001)continue;const b=bounds.get(p.id).clone().translate(new Vector3(...s.offsetsWorld[p.id]));
   for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z]){const point=new Vector3(x,y,z).project(camera);assert.ok(Math.abs(point.x)<.99&&Math.abs(point.y)<.99&&Math.abs(point.z)<1,`${p.id} at beat${beat}, aspect${aspect} cropped: ${point.toArray()}`);}
  }
 }
});
test('music events bind real identities and meaningful source actions',()=>{
 assert.equal(DURATION,64*60/108);assert.equal(timeline.MUSIC_EVENTS.length,6);for(const event of timeline.MUSIC_EVENTS){assert.ok(event.beat>=0&&event.beat<64);assert.ok(event.partIds.every(id=>byId.has(id)));assert.ok(event.level>=0&&event.level<=1);}
 const seat=timeline.MUSIC_EVENTS.find(e=>e.kind==='seat');assert.ok(seat.partIds.every(id=>timeline.stateAt(seat.beat*60/BPM).offsetsWorld[id].every(v=>v===0)));
});
test('preview serves the working public entry and refuses private or traversal paths',async()=>{
 for(const path of ['/.env','/source/../../AGENTS.md','/output/secrets.json','/source/right_hand.xml','/tests/study.test.mjs','/vendor/three/../../../package.json'])assert.equal(publicFile(path),null);
 const server=createHandServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{const base=`http://127.0.0.1:${server.address().port}`;const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/Allegro Hand/);const asset=await fetch(`${base}/assets/assembly.glb`,{headers:{range:'bytes=0-3'}});assert.equal(asset.status,206);assert.equal(await asset.text(),'glTF');assert.equal((await fetch(`${base}/.env`)).status,403);}finally{await new Promise(resolve=>server.close(resolve));}
});
