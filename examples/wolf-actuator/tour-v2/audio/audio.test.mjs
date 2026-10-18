import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createWolfTourV2Story } from '../story.mjs';
import { createScore, renderScore, encodeWav } from './synth.mjs';
const index=JSON.parse(await readFile(new URL('../../assets/scene-index.json',import.meta.url))),story=createWolfTourV2Story(index);
const metadata=JSON.parse(await readFile(new URL('../music-score.json',import.meta.url)));
const score=createScore(story,index);
// The long WAV is a reproducible local output; a fresh source checkout can
// validate it in memory without modifying or requiring generated assets.
const wav=await readFile(new URL('tour-loop.wav',import.meta.url)).catch(error=>{if(error.code!=='ENOENT')throw error;return encodeWav(renderScore(score));});

test('tour v2 retained stereo PCM matches the current 160-beat story and score',()=>{
  assert.equal(score.totalBeats,160);assert.equal(score.frames,3780000);assert.equal(score.sampleRate,44100);
  assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');
  assert.equal(wav.readUInt16LE(20),1);assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt16LE(34),16);
  assert.equal(wav.readUInt32LE(24),44100);assert.equal(wav.readUInt32LE(40),3780000*4);assert.equal(wav.length,44+3780000*4);
  assert.equal(createHash('sha256').update(wav).digest('hex'),metadata.sha256);
  for(const key of ['storyRevision','geometryRevision','sourceSHA256','frames','durationSeconds'])assert.equal(metadata[key],score[key]);
  for(const key of ['harmony','events','motionBindings','automation','cues'])assert.deepEqual(metadata[key],score[key]);
  assert.equal(score.harmony.length,20);assert.equal(score.harmony.at(-1).lastBeat,160);
});

test('tour v2 effects bind actual teardown events; rotation studies do not invent recorded contact',()=>{
  const motionById=new Map(story.MOTION_EVENTS.map(e=>[e.id,e]));
  const boundIds=new Set();
  for(const cue of score.effects.actionCues){
    const motion=cue.animation.motionEventIds.map(id=>{boundIds.add(id);assert.ok(motionById.has(id));return motionById.get(id);});
    assert.equal(cue.animation.firstBeat,Math.min(...motion.map(e=>e.startBeat)));
    assert.equal(cue.animation.lastBeat,Math.max(...motion.map(e=>e.endBeat)));
    assert.deepEqual(new Set(cue.animation.partIds),new Set(motion.flatMap(e=>e.ids)));
    assert.equal(cue.beat,cue.cueRole==='seating'?cue.animation.lastBeat:cue.animation.firstBeat);
    assert.ok(cue.beat>=0&&cue.beat+cue.durationBeats<=160);
    for(const [start,end]of[[20,44],[88,104]])assert.ok(cue.beat+cue.durationBeats<=start||cue.beat>=end,'No artificial gearing or bearing-contact SFX');
  }
  assert.deepEqual(boundIds,new Set(story.MOTION_EVENTS.map(e=>e.id)));
  assert.equal(score.automation.readingDips.length,2);
  for(const dip of score.automation.readingDips){assert.ok(index.parts.some(p=>p.id===dip.partId));assert.ok(dip.firstBeat<dip.fullBeat&&dip.fullBeat<dip.releaseBeat&&dip.releaseBeat<dip.lastBeat);}
});

test('tour v2 delivered PCM has headroom, quiet macros and a continuous loop boundary',()=>{
  let peak=0,energy=0,clipped=0;
  for(let i=44;i<wav.length;i+=2){const v=wav.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(v));energy+=v*v;if(Math.abs(v)>=.9999)clipped++;}
  const rms=20*Math.log10(Math.sqrt(energy/(score.frames*2)));
  assert.equal(clipped,0);assert.ok(20*Math.log10(peak)<-8);assert.ok(rms>-32&&rms<-19);
  for(let ch=0;ch<2;ch++)assert.ok(Math.abs(wav.readInt16LE(44+ch*2)-wav.readInt16LE(wav.length-4+ch*2))/32768<.012);
  for(const dip of score.automation.readingDips){
    const begin=Math.round(dip.fullBeat*60/112*44100),end=Math.round(dip.releaseBeat*60/112*44100);let sum=0;
    for(let f=begin;f<end;f++)for(let ch=0;ch<2;ch++){const v=wav.readInt16LE(44+f*4+ch*2)/32768;sum+=v*v;}
    assert.ok(20*Math.log10(Math.sqrt(sum/((end-begin)*2)))<rms-3);
  }
});
