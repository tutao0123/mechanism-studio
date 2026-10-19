import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3,Matrix4} from 'three';
import {createGripperStory,BPM,DURATION,CHAPTERS,MUSIC_EVENTS} from '../story.mjs';
import {createGripperRig} from '../kinematics.mjs';
import {createGripperFraming} from '../framing.mjs';
import {annotationCues} from '../annotations.mjs';
const index=JSON.parse(await readFile(new URL('../assets/scene-index.json',import.meta.url)));
const story=createGripperStory(index),rig=createGripperRig(index),framing=createGripperFraming(index,story,rig);
test('35.56-second loop restores source pose and changes no source identity',()=>{
 assert.ok(DURATION>30&&DURATION<40);assert.deepEqual(story.stateAt(0),story.stateAt(DURATION));
 for(const t of [0,DURATION-1e-8]){const s=story.stateAt(t);assert.equal(s.driverAngle,0);for(const v of Object.values(s.offsetsWorld))assert.ok(v.every(x=>x===0));}
 assert.deepEqual(framing.cameraFor('work',16/9),framing.cameraFor('resolve',16/9));
 for(const e of MUSIC_EVENTS){assert.ok(e.beat>=0&&e.beat<64);assert.ok(e.partIds.every(id=>index.parts.some(p=>p.id===id)));}
});
test('display separation occurs only at source zero and reconstructs absolute world offsets',()=>{
 for(let t=0;t<DURATION;t+=.07){const s=story.stateAt(t),local=story.localDisplayOffsets(index,s.offsetsWorld,Matrix4,Vector3),actual=new Map();if(Object.values(s.progress).some(p=>p>0))assert.equal(s.driverAngle,0);
  for(const p of index.parts){const parent=index.parts.find(x=>x.id===p.parentId),v=new Vector3(...local.get(p.id));if(parent){const M=new Matrix4().fromArray(parent.worldMatrix);v.applyMatrix4(M).sub(new Vector3().applyMatrix4(M)).add(actual.get(parent.id));}actual.set(p.id,v);v.toArray().forEach((x,i)=>assert.ok(Math.abs(x-s.offsetsWorld[p.id][i])<1e-10));}
 }
});
test('working and expanded geometry stay within static authored camera bounds',()=>{
 const up=new Vector3(0,1,0);
 for(const aspect of [16/9,1,390/650])for(let t=0;t<DURATION;t+=.07){const s=story.stateAt(t),c=framing.cameraFor(s.chapter.id,aspect,s.localTime),target=new Vector3(...c.target),dir=new Vector3(...c.position).sub(target).normalize(),right=new Vector3().crossVectors(up,dir).normalize(),vertical=new Vector3().crossVectors(dir,right).normalize(),bounds=rig.boundsAtAngle(s.driverAngle),shown=story.detailIds(s);
  for(const p of index.parts){if(!p.hasGeometry||shown&&!shown.includes(p.id))continue;const b=bounds.get(p.id);for(const x of [b.min[0],b.max[0]])for(const y of [b.min[1],b.max[1]])for(const z of [b.min[2],b.max[2]]){const v=new Vector3(x,y,z).add(new Vector3(...s.offsetsWorld[p.id])).sub(target);assert.ok(Math.abs(v.dot(right))<c.halfHeight*aspect*.96);assert.ok(Math.abs(v.dot(vertical))<c.halfHeight*.96);}}
 }
});
test('near labels settle, appear sequentially, retain and fade together',()=>{
 const c=CHAPTERS.find(c=>c.id==='detail'),a=c.firstBeat*60/BPM,b=c.lastBeat*60/BPM;
 assert.equal(annotationCues(story.stateAt(a+.9)).length,0);assert.equal(annotationCues(story.stateAt(a+1.5)).length,1);assert.equal(annotationCues(story.stateAt(a+2.8)).length,2);
 for(const cue of annotationCues(story.stateAt(a+2.8)))assert.deepEqual(story.stateAt(a+1).offsetsWorld[cue.id],story.stateAt(b-.5).offsetsWorld[cue.id]);
 assert.ok(annotationCues(story.stateAt(b-.05)).every(c=>c.opacity<.2));assert.equal(annotationCues(story.stateAt(b+.001)).length,0);
});
