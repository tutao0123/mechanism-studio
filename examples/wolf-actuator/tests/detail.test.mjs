import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {Vector3,Matrix4,OrthographicCamera} from 'three';
import {createWolfMotorDetail,localDisplayOffsets} from '../detail/story.mjs';
import {createWolfMotorFraming,CAMERA_UP} from '../detail/framing.mjs';
import {createWolfMotorAnnotations} from '../detail/annotations.mjs';
import {createWolfServer,publicFile} from '../serve.mjs';
import {readGlb,accessorValues} from '../../../shared/assets/glb.mjs';
import {placeAnnotation,moveAnnotation} from '../../../shared/viewer/annotation-layout.mjs';

const read=async file=>JSON.parse(await readFile(new URL(file,import.meta.url),'utf8'));
const index=await read('../assets/scene-index.json'),manifest=await read('../assets/assembly-manifest.json'),story=createWolfMotorDetail(index),annotations=createWolfMotorAnnotations(story),framing=createWolfMotorFraming(index,story);
const sec=beat=>beat*60/story.BPM,sourceBefore=JSON.stringify(index);

test('motor deep dive binds 86 exact source occurrences and retains generic cc names without invented CAD',()=>{
  const occurrences=new Map(manifest.occurrences.map(o=>[o.occurrence_id,o])),definitions=new Map(manifest.definitions.map(d=>[d.definition_id,d]));
  assert.equal(story.bindings.motor,'occ-b352183e1bd0-root-953098-1010');assert.equal(story.bindings.motorParts.length,86);
  assert.equal(story.bindings.magnets.length,40);assert.equal(story.bindings.cc.length,40);assert.equal(story.bindings.hardware.length,6);
  for(const id of story.bindings.motorParts){const source=occurrences.get(id);assert.ok(source);assert.equal(source.parent_id,story.bindings.motor);assert.ok(definitions.has(source.definition_id));assert.equal(index.parts.find(p=>p.id===id).parentId,source.parent_id);}
  for(const id of story.bindings.cc)assert.equal(index.parts.find(p=>p.id===id).name,'cc');
  assert.equal(story.bindings.shaft,'occ-b352183e1bd0-root-953098-1010-934');assert.equal(story.bindings.nut,'occ-b352183e1bd0-root-953098-1010-992');
  assert.deepEqual(story.GROUPS.map(g=>g.ids.length),[2,1,2,80]);assert.equal(new Set(story.GROUPS.flatMap(g=>g.ids)).size,85);
  assert.equal(story.details.repeats.length,80);assert.equal(story.details.hardware.length,6);
  for(const id of story.GROUPS.flatMap(g=>g.ids))assert.ok(story.bindings.motorParts.includes(id));
  assert.match(story.CHAPTERS.find(c=>c.id==='repeats').copy,/function is not inferred/);assert.equal(JSON.stringify(index),sourceBefore);
  const wrong=structuredClone(index);wrong.parts=wrong.parts.filter(p=>p.id!==story.bindings.cc[0]);assert.throws(()=>createWolfMotorDetail(wrong),/86 real motor/);
});

test('complete offset maps are seekable, finite, disjoint, source-preserving and restore exactly',()=>{
  const ids=index.parts.map(p=>p.id).sort();assert.equal(story.DURATION,34.285714285714285);
  assert.deepEqual(story.GROUPS.map(g=>[g.outBeat,g.inBeat]),[[8,52],[12,48],[16,44],[20,40]]);
  assert.deepEqual(story.stateAt(story.DURATION),story.stateAt(0));
  for(let beat=0;beat<=64;beat+=.17){
    const state=story.stateAt(sec(beat));assert.deepEqual(Object.keys(state.offsetsWorld).sort(),ids);
    for(const p of index.parts){const delta=state.offsetsWorld[p.id];assert.equal(delta.length,3);assert.ok(delta.every(Number.isFinite));if(!story.bindings.motorParts.includes(p.id)||p.id===story.bindings.stator)assert.deepEqual(delta,[0,0,0]);}
    const before=story.stateAt(sec(beat));story.stateAt(sec(beat+17));assert.deepEqual(story.stateAt(sec(beat)),before);
  }
  assert.ok(Object.values(story.stateAt(sec(54)).offsetsWorld).every(v=>v.every(n=>n===0)));assert.equal(JSON.stringify(index),sourceBefore);
  const local=localDisplayOffsets(index,story.stateAt(sec(24)).offsetsWorld,Matrix4,Vector3),records=new Map([...index.assemblies,...index.parts].map(p=>[p.id,p]));
  assert.equal(local.size,245);
  for(const p of index.parts){const parent=records.get(p.parentId),matrix=new Matrix4().fromArray(parent.worldMatrix),delta=new Vector3(...local.get(p.id)).applyMatrix4(matrix).sub(new Vector3().applyMatrix4(matrix));assert.ok(delta.distanceTo(new Vector3(...story.stateAt(sec(24)).offsetsWorld[p.id]))<1e-12);}
});

test('all visible source bounds fit fixed cameras throughout separation and reverse assembly on three aspects',()=>{
  for(const aspect of [364/410,16/9,2.5]){
    assert.deepEqual(framing.cameraFor('whole',aspect),framing.cameraFor('resolve',aspect));
    for(let beat=0;beat<64;beat+=.2){
      const state=story.stateAt(sec(beat)),pose=framing.cameraFor(state.chapter.id,aspect,state.localTime),camera=new OrthographicCamera(-pose.halfHeight*aspect,pose.halfHeight*aspect,pose.halfHeight,-pose.halfHeight,.0001,1000);
      camera.up.fromArray(CAMERA_UP);camera.position.fromArray(pose.position);camera.lookAt(new Vector3(...pose.target));camera.updateMatrixWorld(true);
      const visible=story.detailIds(state);
      for(const p of index.parts){if(visible&&!visible.includes(p.id))continue;const delta=new Vector3(...state.offsetsWorld[p.id]);for(const x of [p.worldBounds.min[0],p.worldBounds.max[0]])for(const y of [p.worldBounds.min[1],p.worldBounds.max[1]])for(const z of [p.worldBounds.min[2],p.worldBounds.max[2]]){const projected=new Vector3(x,y,z).add(delta).project(camera);assert.ok(Math.abs(projected.x)<=.720001&&Math.abs(projected.y)<=.820001&&Math.abs(projected.z)<=1,`${state.chapter.id}: ${p.id} remains in view`);}}
    }
  }
  assert.equal(JSON.stringify(index),sourceBefore);
});

test('near-part names appear sequentially on stationary visible targets and fade as one scene group',()=>{
  for(let time=0;time<story.DURATION;time+=.029){
    const state=story.stateAt(time),cues=annotations.annotationCues(state),visible=story.detailIds(state);assert.ok(cues.length<=2);
    for(const cue of cues){if(visible)assert.ok(visible.includes(cue.id));const a=story.stateAt(time-.000001).offsetsWorld[cue.id],b=story.stateAt(time+.000001).offsetsWorld[cue.id];assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1e-11),`${state.chapter.id}: retained named target stays still`);}
  }
  for(const chapter of story.CHAPTERS){const duration=(chapter.lastBeat-chapter.firstBeat)*60/story.BPM,state=story.stateAt(sec(chapter.firstBeat)+duration-.16),cues=annotations.annotationCues(state);assert.equal(cues.length,chapter.labels.length);assert.ok(cues.every(c=>Math.abs(c.opacity-.5)<1e-9));assert.deepEqual(annotations.annotationCues(story.stateAt(sec(chapter.lastBeat))),[]);}
});

test('reused original PCM and rebound music metadata match all four new motor action groups',async()=>{
  const score=await read('../detail/music-score.json'),old=await read('../audio/music-score.json'),plan=await read('../detail/plan.json'),wav=await readFile(new URL('../audio/wolf-loop.wav',import.meta.url));
  assert.equal(score.sha256,createHash('sha256').update(wav).digest('hex'));assert.equal(score.sha256,old.sha256);assert.equal(score.byteLength,wav.length);assert.equal(score.durationSeconds,story.DURATION);assert.equal(score.bpm,story.BPM);assert.equal(score.compositionReuse.pcmChanged,false);
  assert.equal(plan.sourceComponentId,story.bindings.motor);assert.deepEqual(plan.groups,story.GROUPS);assert.equal(plan.geometryRevision,index.geometryRevision);
  assert.equal(score.effects.actionCues.length,12);for(const cue of score.effects.actionCues){const group=story.GROUPS.find(g=>g.id===cue.animation.groupId);assert.ok(group);assert.deepEqual(cue.animation.partIds,group.ids);assert.equal(cue.animation.firstBeat,cue.animation.phase==='explode'?group.outBeat:group.inBeat);assert.equal(cue.beat,cue.cueRole==='seating'?cue.animation.lastBeat:cue.animation.firstBeat);}
});

test('actual motor GLB vertices retain two short desktop labels and at least one mobile label in repeat and hardware views',async t=>{
  const {json:gltf,buffer}=readGlb(await readFile(new URL('../assets/assembly.glb',import.meta.url))),geometry=new Map();
  function visit(i,parent=new Matrix4()){
    const node=gltf.nodes[i],world=parent.clone().multiply(new Matrix4().fromArray(node.matrix));
    if(node.extras?.part_id&&story.bindings.motorParts.includes(node.extras.part_id))geometry.set(node.extras.part_id,gltf.meshes[node.mesh].primitives.flatMap(p=>accessorValues(gltf,buffer,p.attributes.POSITION)).map(p=>new Vector3(...p).applyMatrix4(world)));
    for(const child of node.children??[])visit(child,world);
  }
  for(const root of gltf.scenes[gltf.scene??0].nodes)visit(root);
  const counts={};
  for(const[width,height]of[[1844,790],[1844,840],[1204,600],[364,410]])for(const reduced of [false,true])for(const chapterId of ['repeats','hardware']){
    const chapter=story.CHAPTERS.find(c=>c.id===chapterId),state=story.stateAt(sec(chapter.firstBeat)+2.6),visible=story.detailIds(state),plan=framing.annotationCameraFor(chapterId,width/height);
    const cameraFor=pose=>{const camera=new OrthographicCamera(-pose.halfHeight*width/height,pose.halfHeight*width/height,pose.halfHeight,-pose.halfHeight,.0001,1000);camera.up.fromArray(CAMERA_UP);camera.position.fromArray(pose.position);camera.lookAt(new Vector3(...pose.target));camera.updateMatrixWorld(true);return camera;};
    const camera=cameraFor(plan),project=(world,using=camera)=>{const p=world.clone().project(using);return{x:(p.x+1)*width/2,y:(1-p.y)*height/2,z:p.z,world};};
    const clouds=new Map(visible.map(id=>[id,geometry.get(id).map(p=>project(p.clone().add(new Vector3(...state.offsetsWorld[id]))))]));
    const exclusions=new Map(visible.map(id=>{
      const part=index.parts.find(p=>p.id===id),points=[];
      for(const time of [sec(chapter.firstBeat),sec(chapter.lastBeat)-1e-6]){const offset=new Vector3(...story.stateAt(time).offsetsWorld[id]);for(const x of[part.worldBounds.min[0],part.worldBounds.max[0]])for(const y of[part.worldBounds.min[1],part.worldBounds.max[1]])for(const z of[part.worldBounds.min[2],part.worldBounds.max[2]])points.push(project(new Vector3(x,y,z).add(offset)));}
      const xs=points.map(p=>p.x),ys=points.map(p=>p.y);return[id,{x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)}];
    }));
    const creditWidth=Math.min(280,width-24),credit={x:width-12-creditWidth,y:height-40,width:creditWidth,height:32},retained=[];
    for(const[labelIndex,[id,text]]of chapter.labels.entries()){
      const input={points:clouds.get(id),width,height,textWidth:text.length*(width<540?6.5:8),textHeight:width<540?18:21,obstacles:[credit,...[...exclusions].filter(([other])=>other!==id).map(([,rect])=>rect),...retained.map(r=>r.layout.rect)],preferredSide:labelIndex?'right':'left'};
      const layout=placeAnnotation(input);if(!layout)continue;
      const anchor=input.points.find(p=>p.x===layout.anchor.x&&p.y===layout.anchor.y);assert.ok(anchor,'Leader starts on a real retained source mesh vertex');
      assert.ok(layout.leaderLength<=(width<540?10:15)+1e-9);assert.ok(layout.rect.x>=9&&layout.rect.y>=9&&layout.rect.x+layout.rect.width<=width-9&&layout.rect.y+layout.rect.height<=height-9);
      retained.push({layout,worldAnchor:anchor.world});
    }
    const key=`${width}x${height}/${reduced?'reduced':'settled'}/${chapterId}`;counts[key]=retained.length;
    assert.ok(retained.length>=(width<540?1:2),`${key}: usable source labels, without allowing distant leaders or overlap`);
    for(const localTime of[2.8,3.2,3.8,4.1]){
      const current=cameraFor(framing.cameraFor(chapterId,width/height,reduced?0:localTime)),moved=retained.map(r=>moveAnnotation(r.layout,project(r.worldAnchor,current))),shown=[];
      for(let i=0;i<moved.length;i++){
        const layout=moved[i];assert.ok(layout.rect.x>=5&&layout.rect.y>=5&&layout.rect.x+layout.rect.width<=width-5&&layout.rect.y+layout.rect.height<=height-5,`${key}: name remains onscreen during planned pullback`);
        assert.equal(layout.side,retained[i].layout.side);assert.equal(layout.rect.width,retained[i].layout.rect.width);assert.ok(Math.abs(layout.leaderLength-retained[i].layout.leaderLength)<1e-9);
        // Match the study runtime's final screen-space rejection during a tiny
        // pullback. A crowded mobile second name may be omitted; it may never
        // overlap an existing label or be forced to an unrelated screen edge.
        const collision=shown.some(other=>layout.rect.x<other.rect.x+other.rect.width+4&&layout.rect.x+layout.rect.width>other.rect.x-4&&layout.rect.y<other.rect.y+other.rect.height+4&&layout.rect.y+layout.rect.height>other.rect.y-4);
        if(!collision)shown.push(layout);
      }
      assert.ok(shown.length>=(width<540?1:2),`${key}: planned pullback retains two desktop or one mobile readable labels`);
    }
  }
  t.diagnostic(`Actual source geometry label counts: ${JSON.stringify(counts)}. Font/credit metrics are conservative estimates; browser QA remains separate.`);
});

test('detail preview adds explicit viewing routes and keeps builders, source CAD and output private',async()=>{
  const server=createWolfServer();server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  try{
    for(const route of ['/detail/','/detail/index.html','/detail/app.mjs','/detail/story.mjs','/detail/framing.mjs','/detail/annotations.mjs','/detail/music-score.json','/detail/plan.json','/detail/README.md','/detail/review.html'])assert.equal((await fetch(base+route)).status,200,route);
    for(const route of ['/detail/build-plans.mjs','/detail/output/file.mp4','/detail/.cache/a','/source/assembly.step','/detail/../../source/assembly.step'])assert.equal(publicFile(route),null,route);
    assert.equal((await fetch(base+'/detail/',{method:'POST'})).status,405);
    const app=await readFile(new URL('../detail/app.mjs',import.meta.url),'utf8');assert.match(app,/assetUrl:'\.\.\/assets\/assembly\.glb'/);assert.equal(app.includes('humanoid.glb'),false);
  }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});
