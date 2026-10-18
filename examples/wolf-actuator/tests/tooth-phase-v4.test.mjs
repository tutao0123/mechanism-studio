import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Matrix4,Vector3} from 'three';
import {readGlb,accessorValues} from '../../../shared/assets/glb.mjs';
import {createToothPhase} from '../tour-v4/tooth-phase.mjs';
import {createWolfTourV3Story} from '../tour-v3/story.mjs';
import {createWolfGearRig} from '../tour-v2/gearing.mjs';
const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const index=await read('../assets/scene-index.json'),before=JSON.stringify(index),cue=createToothPhase(index),story=createWolfTourV3Story(index),rig=createWolfGearRig(index);
const time=beat=>beat*60/112;
const close=(a,b,eps=1e-10)=>assert.ok(Math.abs(a-b)<eps,`${a} differs from ${b}`);

test('source-bound tooth phases retain measured middle-band herringbone identity',async()=>{
  const sections=await read('../tour-v4/research/tooth-phase-sections.json'),bytes=await readFile(new URL('../assets/assembly.glb',import.meta.url));
  assert.equal(sections.sourceSHA256,index.sourceSHA256);
  assert.equal(sections.geometryRevision,index.geometryRevision);
  assert.equal(sections.assetSHA256,createHash('sha256').update(bytes).digest('hex'));
  for(const part of sections.parts){
    const spec=cue.specs[part.role];assert.equal(spec.id,part.id);assert.equal(part.samples.length,15);
    for(const sample of part.samples){
      assert.equal(sample.peakCount,spec.count);
      close(cue.phaseAt(part.role,sample.y),sample.phase,1e-8);
      assert.ok(sample.harmonicAmplitude>.0002);
    }
    const deltaA=cue.phaseAt(part.role,.008)-cue.phaseAt(part.role,.001),deltaB=cue.phaseAt(part.role,.021)-cue.phaseAt(part.role,.014);
    assert.ok(deltaA*deltaB<0,'original herringbone reverses at its centre');
    assert.ok(Math.abs(cue.phaseAt(part.role,.010)-cue.phaseAt(part.role,.012))<.00001,'source centre plateau retained');
  }
  const {json:gltf,buffer}=readGlb(bytes);
  for(const role of['sun','planet']){
    const spec=cue.specs[role],part=index.parts.find(p=>p.id===spec.id),node=gltf.nodes.find(n=>n.extras?.part_id===spec.id),matrix=new Matrix4().fromArray(part.worldMatrix),coverage=new Set();
    let eligible=0,excludedEnds=0;
    for(const primitive of gltf.meshes[node.mesh].primitives){
      const positions=accessorValues(gltf,buffer,primitive.attributes.POSITION);
      for(const point of positions){
        const source=new Vector3(...point).applyMatrix4(matrix).toArray(),binding=cue.vertexBinding(role,source);
        assert.ok(binding.bandWeight>=0&&binding.bandWeight<=1);
        assert.ok(binding.toothIndex>=0&&binding.toothIndex<spec.count);
        if(source[1]<-1e-7||source[1]>.0220001){assert.equal(binding.bandWeight,0);excludedEnds++;}
        if(binding.bandWeight>.9){coverage.add(binding.toothIndex);eligible++;assert.ok(binding.radius>spec.rootRadius);}
      }
    }
    assert.equal(coverage.size,spec.count,'every original tooth has real source vertices');
    assert.ok(eligible>spec.count*5,'highlighter is bound to source surfaces');
    if(role==='planet')assert.ok(excludedEnds>100,'the two different end gear bands cannot be coloured as central teeth');
  }
  assert.equal(JSON.stringify(index),before);
});

test('paired tooth indices travel with actual mechanical phases and reverse deterministically',()=>{
  const axis=new Vector3(...rig.axisWorld),pivot=new Vector3(...rig.pivotWorld);
  for(let beat=25;beat<=39;beat+=.03125){
    const state=story.stateAt(time(beat)),sample=cue.sample(state),world=rig.worldMotionsForAngle(state.gearAngle);
    close(sample.phaseResidual,0,1e-10);
    close(sample.pairs.reduce((s,p)=>s+p.weight,0),1);
    assert.ok(sample.pairs.length===1||sample.pairs.length===2);
    for(const p of sample.pairs){assert.equal((p.sunIndex+p.planetIndex)%24,cue.pairSum%24);assert.ok(p.weight>0&&p.weight<=1);}
    const sourceCentre=new Vector3(...cue.specs.planet.center),actual=sourceCentre.clone().applyMatrix4(world.get(cue.specs.planet.id));
    sample.planet.centerWorld.forEach((v,i)=>close(v,actual.toArray()[i]));
    const sunVector=new Vector3(1,0,0).applyMatrix4(world.get(cue.specs.sun.id)).sub(pivot.clone().applyMatrix4(world.get(cue.specs.sun.id)));
    assert.ok(sunVector.length()>0);
    const radial=new Vector3(...sample.planet.centerWorld).sub(pivot);radial.addScaledVector(axis,-radial.dot(axis));
    close(Math.hypot(sample.interfaceWorld[0],sample.interfaceWorld[2]),radial.length()*.8);
    const reversed=cue.sample(story.stateAt(time(64-beat)));
    for(const p of sample.pairs){const other=reversed.pairs.find(v=>v.sunIndex===p.sunIndex&&v.planetIndex===p.planetIndex);assert.ok(other);close(other.weight,p.weight,1e-9);}
  }
  for(const beat of[29,30,31]){const s=cue.sample(story.stateAt(time(beat)));assert.equal(s.sun.direction,1);assert.equal(s.planet.direction,-1);assert.equal(s.planet.orbitDirection,1);}
  for(const beat of[33,34,35]){const s=cue.sample(story.stateAt(time(beat)));assert.equal(s.sun.direction,-1);assert.equal(s.planet.direction,1);assert.equal(s.planet.orbitDirection,-1);}
  assert.equal(cue.sample(story.stateAt(time(32))).sun.direction,0);
});

test('handoff is continuous per physical tooth, seek independent, and absent outside closeup',()=>{
  const perTooth=(role,s)=>Array.from({length:cue.specs[role].count},(_,toothIndex)=>cue.toothWeight(role,{toothIndex,bandWeight:1},s));
  let previous;
  for(let beat=27.9;beat<=36.1;beat+=.0005){
    const sample=cue.sample(story.stateAt(time(beat)));
    const weights=[...perTooth('sun',sample),...perTooth('planet',sample)];
    if(previous)assert.ok(Math.max(...weights.map((v,i)=>Math.abs(v-previous[i])))<.03,'no abrupt tooth identity flash');
    previous=weights;
  }
  for(const beat of[0,12,27,28,36,37,44,100,159]){
    const s=cue.sample(story.stateAt(time(beat)));assert.equal(s.opacity,0);
    assert.ok(perTooth('sun',s).every(v=>v===0));
  }
  const expected=cue.sample(story.stateAt(time(30.4)));cue.sample(story.stateAt(time(100)));cue.sample(story.stateAt(time(29)));
  assert.deepEqual(cue.sample(story.stateAt(time(30.4))),expected);
  assert.deepEqual(cue.sample(story.stateAt(0)),cue.sample(story.stateAt(story.DURATION)));
  assert.throws(()=>createToothPhase({...index,geometryRevision:'different'}),/pinned/);
  assert.throws(()=>cue.vertexBinding('planet',[NaN,0,0]),/finite/);
  assert.throws(()=>cue.sample({gearAngle:Infinity,beat:30}),/Finite/);
});
