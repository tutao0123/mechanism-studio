import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Matrix4,OrthographicCamera,Vector3} from 'three';
import {readGlb,accessorValues} from '../../../shared/assets/glb.mjs';
import {createWolfTourV2Story} from '../tour-v2/story.mjs';
import {createWolfTourV2Framing} from '../tour-v2/framing.mjs';
import {createWolfTourV2Annotations} from '../tour-v2/annotations.mjs';
import {createWolfTourV2Motion} from '../tour-v2/kinematics.mjs';
import {createWolfTourV3Story} from '../tour-v3/story.mjs';
import {createWolfTourV3Framing,CAMERA_UP} from '../tour-v3/framing.mjs';

const index=JSON.parse(await readFile(new URL('../assets/scene-index.json',import.meta.url),'utf8'));
const unchanged=JSON.stringify(index),oldStory=createWolfTourV2Story(index),story=createWolfTourV3Story(index),rig=createWolfTourV2Motion(index);
const oldFraming=createWolfTourV2Framing(index,oldStory,rig),framing=createWolfTourV3Framing(index,story,rig);
const oldLabels=createWolfTourV2Annotations(oldStory),labels=createWolfTourV2Annotations(story);
const seconds=beat=>beat*60/story.BPM,aspects=[364/410,16/9,2.5];
const near=(a,b,message,epsilon=1e-9)=>assert.ok(Math.abs(a-b)<epsilon,`${message}: ${a} versus ${b}`);
const camera=(pose,aspect)=>{const c=new OrthographicCamera(-pose.halfHeight*aspect,pose.halfHeight*aspect,pose.halfHeight,-pose.halfHeight,.0001,1000);c.up.fromArray(CAMERA_UP);c.position.fromArray(pose.position);c.lookAt(new Vector3(...pose.target));c.updateMatrixWorld(true);return c;};
const {json:gltf,buffer}=readGlb(await readFile(new URL('../assets/assembly.glb',import.meta.url)));
let planetVertices=[];
function visit(nodeIndex,parent=new Matrix4()){
  const node=gltf.nodes[nodeIndex],world=parent.clone().multiply(new Matrix4().fromArray(node.matrix));
  if(node.extras?.part_id===story.selectedPair.planet)planetVertices=gltf.meshes[node.mesh].primitives.flatMap(p=>accessorValues(gltf,buffer,p.attributes.POSITION)).map(p=>new Vector3(...p).applyMatrix4(world));
  for(const child of node.children??[])visit(child,world);
}
for(const node of gltf.scenes[gltf.scene??0].nodes)visit(node);

test('tooth close-up preserves the original 160-beat physics and all other chapters',()=>{
  assert.equal(story.DURATION,oldStory.DURATION);assert.equal(story.BPM,oldStory.BPM);
  assert.deepEqual(story.MOTION_EVENTS,oldStory.MOTION_EVENTS,'existing musical action timing remains valid');
  assert.equal(index.parts.find(p=>p.id===story.selectedPair.sun)?.name,'sun-gear');
  assert.equal(index.parts.find(p=>p.id===story.selectedPair.planet)?.name,story.selectedPair.planetName);
  assert.ok(rig.gear.ids.planets.includes(story.selectedPair.planet));assert.ok(planetVertices.length>1000);
  for(let frame=0;frame<Math.ceil(story.DURATION*15);frame++){
    const old=oldStory.stateAt(frame/15),current=story.stateAt(frame/15);
    const {chapter:oldChapter,...oldState}=old,{chapter:chapter,gearMacro,...state}=current;
    assert.deepEqual(state,oldState,'camera edit cannot change source mechanical angles or display offsets');
    if(chapter.id!=='gearing'){
      assert.equal(gearMacro,0);assert.deepEqual(chapter,oldChapter);
      for(const part of index.parts)assert.equal(story.opacityFor(current,part.id),oldStory.opacityFor(old,part.id));
      assert.deepEqual(labels.annotationCues(current),oldLabels.annotationCues(old));
    }else{
      assert.deepEqual(labels.annotationCues(current),[],'no moving-target labels over the contact patch');
      for(const id of[story.selectedPair.sun,story.selectedPair.planet])assert.equal(story.opacityFor(current,id),oldStory.opacityFor(old,id),'source working pair remains visible');
      if(current.beat>=28&&current.beat<=36)for(const part of index.parts)if(![story.selectedPair.sun,story.selectedPair.planet].includes(part.id))assert.equal(story.opacityFor(current,part.id),0,'other teeth do not obscure the close-up');
    }
  }
  for(const beat of[25,28,30,32,34,36,39])assert.deepEqual(rig.workingPoses(story.stateAt(seconds(beat))),rig.workingPoses(oldStory.stateAt(seconds(beat))));
  assert.deepEqual(story.stateAt(story.DURATION),story.stateAt(0));
  assert.equal(JSON.stringify(index),unchanged,'source identities, hierarchy and placements remain untouched');
});

test('camera returns to the unchanged film, with continuous approach and a settled magnification',()=>{
  for(const aspect of aspects){
    for(let beat=0;beat<160;beat+=.25){
      if(beat>=20&&beat<44)continue;
      const s=story.stateAt(seconds(beat)),old=oldStory.stateAt(seconds(beat));
      for(const method of['cameraFor','stillCameraFor'])assert.deepEqual(framing[method](s.chapter.id,aspect,s.localTime),oldFraming[method](old.chapter.id,aspect,old.localTime),`${method} unchanged at ${beat}`);
    }
    for(const beat of[20,24.5,25,25.75,28,32,36,38.5,39,41,44]){
      const a=story.stateAt(seconds(beat-1e-7)),b=story.stateAt(seconds(beat+1e-7));
      const pa=framing.cameraFor(a.chapter.id,aspect,a.localTime),pb=framing.cameraFor(b.chapter.id,aspect,b.localTime);
      assert.ok(new Vector3(...pa.position).distanceTo(new Vector3(...pb.position))<1e-6,`position continuity at ${beat}`);
      assert.ok(new Vector3(...pa.target).distanceTo(new Vector3(...pb.target))<1e-7,`target continuity at ${beat}`);
      near(pa.halfHeight,pb.halfHeight,`zoom continuity at ${beat}`,1e-7);
      for(const part of index.parts)near(story.opacityFor(a,part.id),story.opacityFor(b,part.id),`context opacity continuity at ${beat}`,1e-6);
    }
    let settledDirection;
    for(let beat=28;beat<=36;beat+=.125){
      const s=story.stateAt(seconds(beat)),pose=framing.cameraFor('gearing',aspect,s.localTime),old=oldFraming.cameraFor('gearing',aspect,s.localTime);
      near(pose.halfHeight,framing.focusHalfHeight(aspect),'fixed magnification throughout moving contact hold');
      assert.ok(pose.halfHeight<old.halfHeight*.5,'close-up magnifies the source teeth by at least 2x');
      const direction=new Vector3(...pose.position).sub(new Vector3(...pose.target)).normalize();
      if(settledDirection)assert.ok(direction.distanceTo(settledDirection)<1e-12,'no extra orbit during tooth inspection');
      settledDirection=direction;
    }
  }
});

test('the real moving planet and a two-tooth-pitch contact neighborhood stay in the close-up',()=>{
  const sun=index.parts.find(p=>p.id===story.selectedPair.sun),planet=index.parts.find(p=>p.id===story.selectedPair.planet),axis=new Vector3(...rig.gear.axisWorld);
  const actualPitch=2*Math.PI*framing.pitchRadius/96,clipped=[],contextClipped=[];
  for(const aspect of aspects)for(let beat=25;beat<=39;beat+=.05){
    const s=story.stateAt(seconds(beat)),motions=rig.worldMotions(s),contact=new Vector3(...framing.contactAt(s));
    const sc=new Vector3(...sun.worldCenter).applyMatrix4(motions.get(sun.id)),pc=new Vector3(...planet.worldCenter).applyMatrix4(motions.get(planet.id));
    // Independently verify the target is on the current line of centres at
    // the 96:24 pitch ratio, rather than a static or arbitrary screen anchor.
    const separation=pc.clone().sub(sc);separation.addScaledVector(axis,-separation.dot(axis));
    const radial=contact.clone().sub(sc);radial.addScaledVector(axis,-radial.dot(axis));
    assert.ok(radial.clone().sub(separation.multiplyScalar(96/120)).length()<1e-10,'camera observes the actual moving mesh interface');
    assert.ok(contact.y>sun.worldBounds.min[1]&&contact.y<sun.worldBounds.max[1],'contact target remains within source sun tooth depth');
    const c=camera(framing.cameraFor('gearing',aspect,s.localTime),aspect),pm=motions.get(planet.id);
    // Transform source vertices directly: repeatedly rotating an axis-aligned
    // bounding box overestimates this small compound gear enough to hide teeth.
    for(const original of planetVertices){const p=original.clone().applyMatrix4(pm).project(c);if(Math.abs(p.x)>.97||Math.abs(p.y)>.97||Math.abs(p.z)>1){clipped.push({aspect,beat,point:p.toArray()});break;}}
    // The sun is deliberately cropped; unrelated context must have faded
    // before leaving the frame, and only return once the camera pulls back.
    for(const part of index.parts){
      if([sun.id,planet.id].includes(part.id)||story.opacityFor(s,part.id)<.1)continue;
      const b=part.worldBounds,m=motions.get(part.id),offset=new Vector3(...s.offsetsWorld[part.id]);
      for(const x of[b.min[0],b.max[0]])for(const y of[b.min[1],b.max[1]])for(const z of[b.min[2],b.max[2]]){
        const p=new Vector3(x,y,z).applyMatrix4(m).add(offset).project(c);
        if(Math.abs(p.x)>.985||Math.abs(p.y)>.985||Math.abs(p.z)>1)contextClipped.push({aspect,beat,part:part.name});
      }
    }
    if(beat>=28&&beat<=36)for(const x of[-2*actualPitch,2*actualPitch])for(const y of[-2*actualPitch,2*actualPitch])for(const z of[-2*actualPitch,2*actualPitch]){
      const p=contact.clone().add(new Vector3(x,y,z)).project(c);
      assert.ok(Math.abs(p.x)<.75&&Math.abs(p.y)<.75&&Math.abs(p.z)<1,'several actual tooth pitches remain visible around contact');
    }
  }
  assert.deepEqual(clipped.slice(0,3),[],'Complete selected source planet must stay within the macro crop');
  assert.deepEqual(contextClipped.slice(0,3),[],'Other parts fade before the camera crops them');
  assert.equal(JSON.stringify(index),unchanged);
});
