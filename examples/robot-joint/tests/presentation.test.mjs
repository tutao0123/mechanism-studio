import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Matrix4, Vector3 } from 'three';
import { createJointPresentation } from '../presentation.mjs';
import { createJointExample } from '../example.mjs';
import { prepareStudyExample } from '../../../shared/study/example-contract.mjs';
import { inspectPresentation } from '../../../tools/study/check-presentation.mjs';
import { PARTS } from '../spec.mjs';
import { sunAngleAt, DURATION, MUSIC_EVENTS } from '../choreography.mjs';
const read = async name => JSON.parse(await readFile(new URL(`../${name}`,import.meta.url),'utf8'));
const index = await read('assets/scene-index.json'), source = await read('assets/provenance.json'), score = await read('audio/music-score.json');
const presentation = createJointPresentation(index), { timeline, rig, plan } = presentation;
const near = (a,b,eps=1e-8) => assert.ok(Math.abs(a-b)<eps,`${a} vs ${b}`);

test('the authored joint binds the shared player, real geometry and synchronized score', () => {
  const definition = createJointExample(); assert.equal(definition.appearance,'atlas');
  assert.equal(index.parts.length,PARTS.length); assert.equal(DURATION,36);
  assert.equal(score.geometryRevision,index.geometryRevision); assert.equal(score.durationSeconds,DURATION);
  assert.equal(score.storyRevision,plan.id);
  assert.equal(prepareStudyExample(definition,index,source).config.timeline.DURATION,DURATION);
  const report = inspectPresentation({example:'robot-joint',index,source,score,presentation});
  assert.equal(report.status,'automated-passed',JSON.stringify(report.checks));
  for (const cue of MUSIC_EVENTS) for (const id of cue.partIds) assert.ok(index.parts.some(p=>p.id===id));
});

test('explosion is seekable, restores every occurrence and preserves sun/planet spacing', () => {
  const original = JSON.stringify(index);
  for (const t of [0,8.8,11.8,16,22.6,27.5,30.8,33.3,35.99]) {
    const state = timeline.stateAt(t), expected = structuredClone(state);
    timeline.stateAt(2); assert.deepEqual(timeline.stateAt(t),expected);
    assert.deepEqual(state.offsetsWorld['rj:sun'],state.offsetsWorld['rj:planet-1']);
    const local = timeline.localDisplayOffsets(index,state.offsetsWorld,Matrix4,Vector3);
    assert.equal(local.size,PARTS.length);
    const motion = rig.motionState(state.sunAngle); near(motion.carrierAngle,state.sunAngle/4);
  }
  for (const t of [0,33.3,35.99]) for (const offset of Object.values(timeline.stateAt(t).offsetsWorld)) offset.forEach(n=>near(n,0));
  near(sunAngleAt(DURATION),8*Math.PI); assert.deepEqual(timeline.stateAt(36),timeline.stateAt(0));
  assert.equal(JSON.stringify(index),original);
});

test('display changes happen during mechanical holds and labels settle before each detail drive', () => {
  for (const {channel} of plan.offsets) for (const range of Object.values(plan.channels[channel])) {
    for (let i=0;i<=10;i++) near(sunAngleAt(range[0]+(range[1]-range[0])*i/10),sunAngleAt(range[0]));
  }
  for (const chapter of plan.chapters) for (const [start,end] of plan.annotations.windows[chapter.id]) {
    const offset = chapter.firstBeat*60/plan.bpm;
    for(let i=0;i<=10;i++) near(sunAngleAt(offset+start+(end-start)*i/10),sunAngleAt(offset+start));
  }
});

test('every visible part stays inside the precomputed shot envelope at sampled motion times', () => {
  for (let i=0;i<360;i++) {
    const t=i/10,state=timeline.stateAt(t), bound=plan.cameras[state.chapter.id].bounds;
    for (const [id,box] of rig.boundsAtAngle(state)) {
      if(presentation.presentationOpacity(state,id)<1e-8) continue;
      for (const key of ['min','max']) box[key].forEach((v,a)=> {
        const actual=v+state.offsetsWorld[id][a];
        assert.ok(actual>=bound.min[a]-1e-7&&actual<=bound.max[a]+1e-7,`${state.chapter.id} ${id} axis${a} at ${t}`);
      });
    }
  }
});

test('rolling identities are concealed only at editorial reset; underlying bearing ratios are not reset', () => {
  for(const p of PARTS.filter(p=>['ball','cage'].includes(p.bearingElement))) {
    for (const t of [0,35.999]) assert.equal(presentation.presentationOpacity(timeline.stateAt(t),p.id),0);
  }
  const first=rig.worldMatrices(0),last=rig.worldMatrices(sunAngleAt(36));
  assert.notDeepEqual(first.get('rj:support-bearing-front-cage').elements,last.get('rj:support-bearing-front-cage').elements);
  for (const aspect of [16/9,1,9/16]) assert.deepEqual(presentation.framing.cameraFor('whole',aspect),presentation.framing.cameraFor('resolve',aspect));
});
