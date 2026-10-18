import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {OrthographicCamera,Vector3} from 'three';
import {createWolfTourV3Story} from '../tour-v3/story.mjs';
import {createWolfTourV4Story} from '../tour-v4/story.mjs';
import {createWolfTourV3Framing,CAMERA_UP} from '../tour-v3/framing.mjs';
import {createWolfTourV2Motion} from '../tour-v2/kinematics.mjs';
import {createWolfTourV2Annotations} from '../tour-v2/annotations.mjs';
import {createDirectionCues} from '../tour-v4/direction-cues.mjs';

const index=JSON.parse(await readFile(new URL('../assets/scene-index.json',import.meta.url),'utf8'));
const sourceBefore=JSON.stringify(index),base=createWolfTourV3Story(index),story=createWolfTourV4Story(index),rig=createWolfTourV2Motion(index);
const cues=createDirectionCues(index,story,rig),framing=createWolfTourV3Framing(index,story,rig),oldFraming=createWolfTourV3Framing(index,base,rig);
const labels=createWolfTourV2Annotations(story),oldLabels=createWolfTourV2Annotations(base),seconds=beat=>beat*60/story.BPM;
const near=(a,b,message,epsilon=1e-9)=>assert.ok(Math.abs(a-b)<epsilon,`${message}: ${a} versus ${b}`);
const wrappedDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const cameraFor=(state,aspect)=>{
  const p=framing.cameraFor(state.chapter.id,aspect,state.localTime),c=new OrthographicCamera(-p.halfHeight*aspect,p.halfHeight*aspect,p.halfHeight,-p.halfHeight,.0001,1000);
  c.up.fromArray(CAMERA_UP);c.position.fromArray(p.position);c.lookAt(new Vector3(...p.target));c.updateMatrixWorld(true);return c;
};

test('pair cues preserve v3 mechanics, timing, camera, opacity and every outside-chapter state',()=>{
  assert.equal(story.DURATION,base.DURATION);assert.equal(story.BPM,base.BPM);assert.deepEqual(story.MOTION_EVENTS,base.MOTION_EVENTS);
  assert.deepEqual(story.selectedPair,base.selectedPair);
  for(let beat=0;beat<160;beat+=.2){
    const a=base.stateAt(seconds(beat)),b=story.stateAt(seconds(beat));
    const {chapter:oldChapter,...oldState}=a,{chapter,...state}=b;
    assert.deepEqual(state,oldState,'editorial cues cannot change working angles or display offsets');
    assert.deepEqual(labels.annotationCues(b),oldLabels.annotationCues(a));
    for(const part of index.parts)assert.equal(story.opacityFor(b,part.id),base.opacityFor(a,part.id));
    if(chapter.id!=='gearing'){assert.deepEqual(chapter,oldChapter);assert.deepEqual(cues.sample(b),[],'other captured chapters remain cue-free');}
    for(const aspect of[364/410,16/9,2.5])for(const method of['cameraFor','stillCameraFor'])assert.deepEqual(framing[method](chapter.id,aspect,b.localTime),oldFraming[method](oldChapter.id,aspect,a.localTime),'v4 retains the actual v3 camera path');
  }
  assert.equal(JSON.stringify(index),sourceBefore,'source identities and placements remain untouched');
});

test('spin and orbit directions agree with the actual source world transforms and clear at reversal',()=>{
  const planet=index.parts.find(p=>p.id===story.selectedPair.planet),pivot=new Vector3(...rig.gear.pivotWorld);
  function actualVelocity(state,role){
    const dt=.0001,ends=[state.time-dt,state.time+dt].map(time=>{
      const s=story.stateAt(time),m=rig.gear.worldMotionsForAngle(s.gearAngle);
      const v=role==='planet-orbit'?new Vector3(...planet.worldCenter).applyMatrix4(m.get(planet.id)).sub(pivot):new Vector3(1,0,0).transformDirection(m.get(role==='sun-spin'?story.selectedPair.sun:planet.id));
      return Math.atan2(v.z,v.x);
    });return wrappedDelta(ends[1],ends[0])/(2*dt);
  }
  for(let beat=28;beat<=36;beat+=.017){
    const state=story.stateAt(seconds(beat)),records=cues.sample(state);
    assert.ok(records.length<=2,'no more than two simultaneous motion cues');
    for(const cue of records){
      assert.ok(cue.opacity>0&&cue.opacity<=1);
      const actual=actualVelocity(state,cue.role);assert.equal(cue.sign,Math.sign(actual));near(cue.angularVelocity,actual,`${cue.role} actual angular velocity`,1e-8);
      if(cue.role==='sun-spin')assert.equal(cue.sign,1);
      if(cue.role==='planet-spin')assert.equal(cue.sign,-1);
      if(cue.role==='planet-orbit')assert.equal(cue.sign,-1,'orbit follows the return motion rather than a decorative fixed arrow');
    }
  }
  for(const beat of[0,20,25,28,31.5,31.99,32,32.01,32.5,35.75,39,44,88,159.9])assert.deepEqual(cues.sample(story.stateAt(seconds(beat))),[],`no misleading arrows at ${beat}`);
  assert.deepEqual(cues.sample(story.stateAt(story.DURATION)),[]);
});

test('arcs remain in their real source axis planes, with truthful tangent arrowheads and clear tooth interface',()=>{
  const original=index.parts.find(p=>p.id===story.selectedPair.planet),pivot=new Vector3(...rig.gear.pivotWorld);
  for(let beat=28.2;beat<=35.7;beat+=.025){
    const state=story.stateAt(seconds(beat)),contact=new Vector3(...framing.contactAt(state)),world=rig.gear.worldMotionsForAngle(state.gearAngle);
    const planet=new Vector3(...original.worldCenter).applyMatrix4(world.get(original.id));
    for(const cue of cues.sample(state)){
      const center=new Vector3(...cue.centerWorld),axis=new Vector3(...cue.axisWorld);
      if(cue.role==='planet-spin'){near(center.x,planet.x,'spin follows the true orbiting centre');near(center.z,planet.z,'spin follows the true orbiting centre');}
      else {near(center.x,pivot.x,'source axis X');near(center.z,pivot.z,'source axis Z');}
      if(cue.role==='planet-orbit')near(cue.radiusMetres,Math.hypot(planet.x-pivot.x,planet.z-pivot.z),'orbit uses the actual centre radius');
      for(const p of cue.pointsWorld){
        assert.ok(p.every(Number.isFinite));const d=new Vector3(...p).sub(center);
        near(d.dot(axis),0,'arc plane normal is the actual shaft axis');near(d.length(),cue.radiusMetres,'arc radius constant');
        assert.ok(Math.hypot(p[0]-contact.x,p[2]-contact.z)>.004,'arc avoids the central tooth-interface neighbourhood');
      }
      assert.deepEqual(cue.headWorld[0],cue.pointsWorld.at(-1));
      const tip=new Vector3(...cue.headWorld[0]),tangent=axis.clone().cross(tip.clone().sub(center)).multiplyScalar(cue.sign).normalize();
      for(const wing of cue.headWorld.slice(1))assert.ok(new Vector3(...wing).sub(tip).dot(tangent)<0,'arrow wings trail the actual signed direction');
    }
  }
});

test('projected arcs and arrowheads remain within the authored macro view on three aspects',()=>{
  const clipped=[];
  for(const aspect of[364/410,16/9,2.5])for(let beat=28.2;beat<=35.7;beat+=.025){
    const state=story.stateAt(seconds(beat)),camera=cameraFor(state,aspect);
    for(const cue of cues.sample(state))for(const p of[...cue.pointsWorld,...cue.headWorld]){
      const q=new Vector3(...p).project(camera);
      if(Math.abs(q.x)>.97||Math.abs(q.y)>.97||Math.abs(q.z)>1)clipped.push({aspect,beat,role:cue.role,point:q.toArray()});
    }
  }
  assert.deepEqual(clipped.slice(0,5),[],'no forced screen-edge arrowhead or clipping needed for the authored view');
});

test('cue sampling is independent of seek order and returns fresh owned arrays',()=>{
  const snapshots=[28.5,29.5,31,32,33.5,35].map(beat=>({beat,state:cues.sample(story.stateAt(seconds(beat)))}));
  for(const {beat,state}of snapshots.toReversed()){cues.sample(story.stateAt(seconds(150)));assert.deepEqual(cues.sample(story.stateAt(seconds(beat))),state);}
  const state=story.stateAt(seconds(29.5)),first=cues.sample(state),expected=structuredClone(first);
  first[0].pointsWorld[0][0]=1e9;first[0].headWorld[0][0]=1e9;first[0].centerWorld[0]=1e9;
  assert.deepEqual(cues.sample(state),expected,'one render cannot mutate later samples');
  assert.throws(()=>cues.sample({...state,time:NaN}),/finite/);
  assert.equal(JSON.stringify(index),sourceBefore);
});
