import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createStudyScore,renderStudyScore,encodeStudyWav,sha256} from '../tools/audio/study-score.mjs';
const index={geometryRevision:'fixture-1',sourceSHA256:'a'.repeat(64),parts:[{id:'mjcf:finger'}]};
const story={BPM:120,TOTAL_BEATS:16,DURATION:8,PLAN_REVISION:'fixture-story',MUSIC_EVENTS:[{id:'release',beat:4,kind:'release',level:.5,partIds:['mjcf:finger']},{id:'seat',beat:12,kind:'seat',level:.5,partIds:['mjcf:finger']}]};
test('code score retains actual motion identities and rejects out-of-range or unbound cues',()=>{
  const score=createStudyScore(story,index);assert.equal(score.frames,352800);assert.equal(score.actionCues[0].seconds,2);
  assert.equal(score.actionCues[0].geometryRevision,index.geometryRevision);
  for(const update of [{partIds:['unknown']},{beat:16},{level:2},{beat:NaN},{kind:'collision'}])assert.throws(()=>createStudyScore({...story,MUSIC_EVENTS:[{...story.MUSIC_EVENTS[0],...update}]},index));
  assert.throws(()=>createStudyScore({...story,DURATION:9},index));
});
test('both composition variants are deterministic stereo, have headroom and loop without a large boundary step',()=>{
  const hashes=[];
  for(const variant of ['hand','gripper']){
    const score=createStudyScore(story,index,{variant}),first=encodeStudyWav(renderStudyScore(score)),second=encodeStudyWav(renderStudyScore(score));
    assert.equal(first.bytes.toString('ascii',0,4),'RIFF');assert.equal(first.bytes.readUInt16LE(22),2);
    assert.equal(first.bytes.length,44+352800*4);assert.equal(first.bytes.readUInt32LE(24),44100);
    assert.equal(sha256(first.bytes),sha256(second.bytes));hashes.push(sha256(first.bytes));
    assert.ok(first.analysis.peakDbfs<=-9.99);assert.ok(first.analysis.loopBoundaryStep<.012);assert.equal(first.analysis.clippedSamples,0);
  }
  assert.notEqual(hashes[0],hashes[1]);
});

test('retained robot scores bind the current story, source geometry and reproducible PCM',async()=>{
  for(const [example,variant] of [['allegro-hand','hand'],['robotiq-gripper','gripper']]){
    const base=new URL(`../examples/${example}/`,import.meta.url);
    const read=async path=>JSON.parse(await readFile(new URL(path,base),'utf8'));
    const [index,assembly,retained,module]=await Promise.all([read('assets/scene-index.json'),read('assets/source-assembly.json'),read('audio/music-score.json'),import(new URL('story.mjs',base))]);
    const story=module.createMusicStory(index,assembly),score=createStudyScore(story,index,{variant,title:retained.title});
    const wav=encodeStudyWav(renderStudyScore(score));
    assert.deepEqual(score.actionCues,retained.actionCues);
    assert.equal(score.geometryRevision,retained.geometryRevision);
    assert.equal(sha256(wav.bytes),retained.sha256);
    assert.equal(wav.bytes.length,retained.byteLength);
    assert.ok(Math.abs(score.durationSeconds-64*60/108)<1e-9);
    // A fresh checkout can verify the score without retaining the generated WAV.
    assert.equal(retained.listeningReviewed,false);
  }
});
