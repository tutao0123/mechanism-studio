import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3,OrthographicCamera} from 'three';
import {createWolfTourV2Story} from '../tour-v2/story.mjs';
import {createWolfTourV2Framing,CAMERA_UP} from '../tour-v2/framing.mjs';
import {createWolfTourV2Annotations} from '../tour-v2/annotations.mjs';
import {createWolfTourV2Motion} from '../tour-v2/kinematics.mjs';
const index=JSON.parse(await readFile(new URL('../assets/scene-index.json',import.meta.url),'utf8')),unchanged=JSON.stringify(index);
const story=createWolfTourV2Story(index),rig=createWolfTourV2Motion(index),framing=createWolfTourV2Framing(index,story,rig),annotations=createWolfTourV2Annotations(story),sec=b=>b*60/story.BPM;
const near=(a,b,label,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,`${label}: ${a} vs ${b}`);
const corners=b=>[b.min[0],b.max[0]].flatMap(x=>[b.min[1],b.max[1]].flatMap(y=>[b.min[2],b.max[2]].map(z=>new Vector3(x,y,z))));
const maxOffsetDifference=(a,b)=>Math.max(...index.parts.flatMap(p=>a.offsetsWorld[p.id].map((v,i)=>Math.abs(v-b.offsetsWorld[p.id][i]))));
const identity={position:[0,0,0],quaternion:[0,0,0,1],scale:[1,1,1]};
function camera(pose,aspect){const c=new OrthographicCamera(-pose.halfHeight*aspect,pose.halfHeight*aspect,pose.halfHeight,-pose.halfHeight,.0001,1000);c.up.fromArray(CAMERA_UP);c.position.fromArray(pose.position);c.lookAt(new Vector3(...pose.target));c.updateMatrixWorld(true);return c;}
function primary(s){
  if(s.chapter.id==='gearing')return index.parts.filter(p=>story.opacityFor(s,p.id)>=.5).map(p=>p.id);
  if(s.chapter.id==='bearing-roll')return story.bindings.bearing.bearingParts.filter(id=>story.opacityFor(s,id)>=.5);
  const b=s.baseState;
  if(b.scope==='motor')return b.studyState.chapter.id==='magnet'?[story.bindings.motorMagnet]:b.studyState.chapter.id==='repeats'?[...story.bindings.motor.magnets,...story.bindings.motor.cc]:story.bindings.motor.motorParts;
  if(b.scope==='bearing')return b.studyState.chapter.id==='component'?[story.bindings.bearingPart]:b.studyState.chapter.id==='repeats'?story.bindings.bearing.smallParts:story.bindings.bearing.bearingParts;
  if(b.chapter.id==='transfer'&&b.beat>=68.5)return story.bindings.bearing.bearingParts;
  return index.parts.map(p=>p.id);
}

test('160-beat tour preserves both source studies, continuous display offsets and a zero-pose loop',()=>{
  assert.equal(story.TOTAL_BEATS,160);near(story.DURATION,600/7,'duration');assert.equal(story.CHAPTERS[0].firstBeat,0);assert.equal(story.CHAPTERS.at(-1).lastBeat,160);
  story.CHAPTERS.forEach((c,i)=>{assert.ok(c.firstBeat<c.lastBeat);if(i)near(c.firstBeat,story.CHAPTERS[i-1].lastBeat,`${c.id} continuous chapter coverage`);});
  for(const beat of[0,8,20,23,25,32,39,41,44,58,74,82,88,90,96,102,104,118,142,156,159.9]){
    const s=story.stateAt(sec(beat));assert.ok(s.chapter);assert.equal(Object.keys(s.offsetsWorld).length,245);assert.ok(Object.values(s.offsetsWorld).flat().every(Number.isFinite));
    const again=structuredClone(s);story.stateAt(sec(beat+57));assert.deepEqual(story.stateAt(sec(beat)),again);
  }
  for(const beat of[20,23,25,32,39,41,44,82,88,90,96,102,104,142,156]){const a=story.stateAt(sec(beat-1e-6)),b=story.stateAt(sec(beat+1e-6));assert.ok(maxOffsetDifference(a,b)<1e-7,`no display reset at beat ${beat}`);for(const p of index.parts)near(story.opacityFor(a,p.id),story.opacityFor(b,p.id),`opacity join ${beat}:${p.name}`,1e-6);}
  for(const beat of[25,29,32,36,39]){const s=story.stateAt(sec(beat));for(const id of story.gearIds)assert.ok(s.offsetsWorld[id].every(v=>v===0),'teeth return to actual meshing placements during working motion');}
  for(const beat of[0,39,44,88,102,104,159]){const s=story.stateAt(sec(beat));assert.equal(s.gearAngle,0);assert.equal(s.bearingAngle,0);for(const p of Object.values(rig.workingPoses(s)))assert.deepEqual(p,identity);}
  const final=story.stateAt(sec(159));assert.ok(Object.values(final.offsetsWorld).flat().every(v=>v===0));assert.deepEqual(story.stateAt(story.DURATION),story.stateAt(0));
  for(const beat of[44,50,58,70,82,104,112,118,130,142,150,159]){const s=story.stateAt(sec(beat));assert.deepEqual(s.offsetsWorld,s.baseState.offsetsWorld,'legacy whole/local paths retained outside new windows');}
  assert.equal(JSON.stringify(index),unchanged);
});

test('working motions reverse through the same source poses; labels avoid moving mechanical targets',()=>{
  for(const[a,b]of[[26,38],[28,36],[31,33],[91,101],[93,99],[95,97]]){
    const x=story.stateAt(sec(a)),y=story.stateAt(sec(b));near(x.gearAngle,y.gearAngle,'symmetric gear excursion');near(x.bearingAngle,y.bearingAngle,'symmetric bearing excursion');
    const px=rig.workingPoses(x),py=rig.workingPoses(y);for(const id of Object.keys(px))for(const key of['position','quaternion','scale'])px[id][key].forEach((v,i)=>near(v,py[id][key][i],`reverse retraces ${id}:${key}`,1e-10));
  }
  near(story.stateAt(sec(32)).gearAngle,Math.PI/2,'gear excursion peak');near(story.stateAt(sec(96)).bearingAngle,Math.PI/3,'bearing excursion peak');
  for(let beat=0;beat<160;beat+=.13){const s=story.stateAt(sec(beat)),cues=annotations.annotationCues(s);if(s.chapter.id==='gearing'||s.chapter.id==='bearing-roll')assert.deepEqual(cues,[]);for(const cue of cues){assert.ok(story.opacityFor(s,cue.id)>=.5);const x=story.stateAt(sec(beat-1e-6)),y=story.stateAt(sec(beat+1e-6));assert.ok(new Vector3(...x.offsetsWorld[cue.id]).distanceTo(new Vector3(...y.offsetsWorld[cue.id]))<1e-10);}}
});

test('actual moving source bounds stay framed on three aspects and camera joins remain continuous',()=>{
  const joins=[...story.CHAPTERS.slice(1).map(c=>c.firstBeat),22,23,25,32,39,41,90,96,102];
  const clipped=new Map();
  for(const aspect of[364/410,16/9,2.5]){
    for(const beat of joins){const x=story.stateAt(sec(beat-1e-7)),y=story.stateAt(sec(beat+1e-7)),a=framing.cameraFor(x.chapter.id,aspect,x.localTime),b=framing.cameraFor(y.chapter.id,aspect,y.localTime);assert.ok(new Vector3(...a.target).distanceTo(new Vector3(...b.target))<1e-7,`camera target join ${beat}`);assert.ok(new Vector3(...a.position).distanceTo(new Vector3(...b.position))<1e-6,`camera position join ${beat}`);near(a.halfHeight,b.halfHeight,`camera zoom join ${beat}`,1e-7);}
    const start=framing.cameraFor('overview',aspect),end=framing.cameraFor('resolve',aspect,1);assert.deepEqual(start,end,'loop camera exact');
    // 15 Hz across the full film plus exact gesture boundaries. Bounds are
    // transformed by the real combined gear/roller adapter, not static boxes.
    for(let frame=0;frame<Math.ceil(story.DURATION*15);frame++){
      const s=story.stateAt(frame/15),bounds=rig.boundsAt(s),using=camera(framing.cameraFor(s.chapter.id,aspect,s.localTime),aspect);
      for(const id of primary(s)){const delta=new Vector3(...s.offsetsWorld[id]);for(const point of corners(bounds.get(id))){const p=point.add(delta).project(using);if(Math.abs(p.x)>.985||Math.abs(p.y)>.985||Math.abs(p.z)>1){const key=`${s.chapter.id}/${aspect}`;if(!clipped.has(key))clipped.set(key,`${id} at beat ${s.beat.toFixed(4)}: ${p.toArray()}`);}}}
    }
  }
  assert.deepEqual([...clipped],[],'Primary transformed source bounds must stay in frame');
  assert.equal(JSON.stringify(index),unchanged);
});
