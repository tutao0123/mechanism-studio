import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Matrix4, Vector3 } from 'three';
import { createHumanoidStory, stateAt, DURATION, GROUPS, MAXIMUM_OFFSETS, CHAPTERS, BPM, localDisplayOffsets, MOVEMENT_BEATS } from '../story.mjs';
import { createHumanoidFraming, DETAIL_SETTLED_SECONDS } from '../framing.mjs';
import { annotationCues } from '../annotations.mjs';
const index = JSON.parse(await readFile(new URL('../assets/scene-index.json', import.meta.url), 'utf8'));
const story = createHumanoidStory(index), framing = createHumanoidFraming(index, story);
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('whole loop restores every source display offset and exact opening framing', () => {
  assert.ok(DURATION>=30 && DURATION<=40);
  assert.deepEqual(stateAt(0),stateAt(DURATION));
  for(const time of [0,DURATION-1e-8])for(const values of Object.values(stateAt(time).offsetsWorld))values.forEach(value=>near(value,0));
  assert.deepEqual(framing.cameraFor('whole',16/9,0),framing.cameraFor('resolve',16/9,3));
  assert.equal(Object.keys(MAXIMUM_OFFSETS).length,index.parts.length);
  assert.equal(GROUPS.flatMap(g=>g.ids).length,29);
  assert.equal(new Set(GROUPS.flatMap(g=>g.ids)).size,29);
});
test('each separation and return advances monotonically with no simultaneous working-pose channel', () => {
  for(const group of GROUPS){
    let previous=0;
    for(let i=0;i<=40;i++){
      const p=stateAt((group.outBeat+MOVEMENT_BEATS*i/40)*60/BPM).progress[group.id];
      assert.ok(p>=previous-1e-10);previous=p;
    }
    near(previous,1);previous=1;
    for(let i=0;i<=40;i++){
      const p=stateAt((group.inBeat+MOVEMENT_BEATS*i/40)*60/BPM).progress[group.id];
      assert.ok(p<=previous+1e-10);previous=p;
    }
    near(previous,0);
  }
  assert.deepEqual(story.detailIds(stateAt(0)),null);
});
test('parent compensation reconstructs desired absolute world offsets without touching source rest', () => {
  const source=JSON.stringify(index);
  for(let sample=0;sample<=160;sample++){
    const state=stateAt(sample*DURATION/160), local=localDisplayOffsets(index,state.offsetsWorld,Matrix4,Vector3);
    const rendered=new Map();
    for(const part of index.parts){
      const parent=index.parts.find(p=>p.id===part.parentId);
      const displacement=new Vector3(...local.get(part.id));
      if(parent){const transform=new Matrix4().fromArray(parent.worldMatrix);displacement.applyMatrix4(transform).sub(new Vector3().applyMatrix4(transform));displacement.add(rendered.get(parent.id));}
      const expected=state.offsetsWorld[part.id];displacement.toArray().forEach((value,i)=>near(value,expected[i]));rendered.set(part.id,displacement);
    }
  }
  assert.equal(JSON.stringify(index),source);
});
test('camera envelopes contain all visible source bounds for the complete timed presentation', () => {
  const UP=new Vector3(0,1,0), parts=new Map(index.parts.map(part=>[part.id,part]));
  for(const aspect of [16/9,4/3,1,390/650])for(let sample=0;sample<=Math.ceil(DURATION*60);sample++){
    const state=stateAt(Math.min(DURATION-1e-8,sample/60)), camera=framing.cameraFor(state.chapter.id,aspect,state.localTime);
    const direction=new Vector3(...camera.position).sub(new Vector3(...camera.target)).normalize();
    const right=new Vector3().crossVectors(UP,direction).normalize(),up=new Vector3().crossVectors(direction,right).normalize();
    for(const id of story.detailIds(state)??parts.keys()){
      const bounds=parts.get(id).worldBounds,delta=new Vector3(...state.offsetsWorld[id]).sub(new Vector3(...camera.target));
      for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]]){
        const p=new Vector3(x,y,z).add(delta);
        assert.ok(Math.abs(p.dot(right))<=camera.halfHeight*aspect*.96+1e-8,`${state.chapter.id} horizontal crop`);
        assert.ok(Math.abs(p.dot(up))<=camera.halfHeight*.96+1e-8,`${state.chapter.id} vertical crop`);
      }
    }
  }
});
test('close names reveal sequentially after settled arcs, retain together and never name moving targets', () => {
  for(const chapter of CHAPTERS){
    const start=chapter.firstBeat*60/BPM;
    if(!chapter.labels.length){assert.deepEqual(annotationCues(stateAt(start+.2)),[]);continue;}
    assert.ok(DETAIL_SETTLED_SECONDS<1.05);
    assert.equal(annotationCues(stateAt(start+1.3)).length,1);
    const both=annotationCues(stateAt(start+2.5));assert.equal(both.length,2);
    for(const cue of both)assert.deepEqual(stateAt(start+2.5).offsetsWorld[cue.id],stateAt(start+3.8).offsetsWorld[cue.id]);
    const end=chapter.lastBeat*60/BPM;assert.ok(annotationCues(stateAt(end-.05)).every(cue=>cue.opacity<.2));
    assert.deepEqual(annotationCues(stateAt(end)),[]);
    assert.deepEqual(annotationCues(stateAt(start+2.5),{cameraSettled:false}),[]);
  }
});
