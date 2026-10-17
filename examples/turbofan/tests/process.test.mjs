import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createState, mechanical, observe, advance, derived, bodyToGLTF } from '../model.mjs';
import { processState, processGeometry, PROCESS_LIMITS } from '../process.mjs';
import { createTurbofanProcess } from '../effects.mjs';
const near = (a,b,epsilon=1e-9) => assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);

test('prescribed core and bypass routes stay distinct and progress from inlet toward their exits', () => {
  const {routes}=processGeometry();assert.equal(routes.filter(r=>r.section==='bypass').length,6);
  assert.equal(routes.filter(r=>r.section==='core').length,3);assert.equal(routes.filter(r=>r.section==='hot').length,3);
  for(const route of routes){
    const axial=route.bodyPoints.map(p=>p[0]);assert.ok(axial.every((x,i)=>i===0||x>axial[i-1]));
    if(route.section==='bypass')assert.ok(route.bodyPoints.every(p=>Math.hypot(p[1],p[2])>=149-1e-8));
    if(route.section==='core') {assert.equal(axial.at(0),-515);assert.equal(axial.at(-1),28);near(Math.hypot(...route.bodyPoints.at(-1).slice(1)),80);}
    if(route.section==='hot'){assert.equal(axial.at(0),28);assert.equal(axial.at(-1),PROCESS_LIMITS.coreNozzleExitX);assert.ok(axial.some(x=>x===245)&&axial.some(x=>x===375));}
    if(route.section==='exhaust'){assert.equal(axial[0],540);assert.equal(axial.at(-1),625);}
  }
});

test('all process coordinates use the asset metre frame exactly once', () => {
  const geometry=processGeometry();
  for(const route of geometry.routes)for(const [i,point]of route.bodyPoints.entries())assert.deepEqual(route.points[i],bodyToGLTF(point));
  for(const pocket of geometry.combustion)assert.deepEqual(pocket.position,bodyToGLTF(pocket.bodyPosition));
});

test('continuous combustion remains inside the annular liner and never forms an external tail flame', () => {
  const {combustion}=processGeometry();assert.equal(combustion.length,36);
  for(const pocket of combustion){const[x,y,z]=pocket.bodyPosition,radius=Math.hypot(y,z);
    assert.ok(x-pocket.axialHalfLengthMM>=PROCESS_LIMITS.combustorX[0]);assert.ok(x+pocket.axialHalfLengthMM<=PROCESS_LIMITS.combustorX[1]);
    assert.ok(radius-pocket.radialRadiusMM>PROCESS_LIMITS.combustorInnerMM);assert.ok(radius+pocket.radialRadiusMM<PROCESS_LIMITS.combustorOuterMM);
    assert.ok(x<PROCESS_LIMITS.coreNozzleExitX);
  }
  for(const angle of [0,45,90,180,360]){const state=processState(mechanical(createState(),{lowAngle:angle,highAngle:angle}));assert.equal(state.combustionIntensity,.72);assert.equal(state.continuousCombustion,true);assert.equal(state.tailFlame,false);assert.equal(state.tailIntensity,.22);}
});

test('flow phases follow independent shaft angles and do not advance when the model is paused', () => {
  const stopped=mechanical(createState(),{lowAngle:90,highAngle:180,playing:false});
  const process=processState(stopped);near(process.bypassPhase,.25);near(process.corePhase,.5);
  assert.deepEqual(processState(advance(stopped,12)),process);
  const moving=mechanical(stopped,{playing:true});const moved=processState(advance(moving,1));
  near(moved.bypassPhase,126/360);near(moved.corePhase,246/360);
  assert.deepEqual(processState(moving),process); // playing alone does not resample a clock or flicker flame.
  near(processState(mechanical(stopped,{highAngle:360})).corePhase,0);
});

test('closed shell, explosion and independent visual toggles hide effects without changing mechanical readouts', () => {
  const input=mechanical(createState(),{lowAngle:58,highAngle:149}),before=structuredClone(input);
  for(const [patch,reason]of [[{cutaway:false},'closed-shell'],[{explode:.01},'exploded']]){
    const viewed=observe(input,patch),process=processState(viewed);assert.equal(process.visible,false);assert.equal(process.suppression,reason);assert.equal(process.flowVisible,false);assert.equal(process.combustionIntensity,0);assert.deepEqual(derived(viewed),derived(input));
  }
  assert.equal(processState(input,{enabled:false}).suppression,'disabled');
  const noFlame=processState(input,{combustion:false});assert.equal(noFlame.flowVisible,true);assert.equal(noFlame.combustionVisible,false);
  const noFlow=processState(input,{flow:false});assert.equal(noFlow.flowVisible,false);assert.equal(noFlow.combustionVisible,true);
  assert.deepEqual(input,before);
});

test('same angles reproduce the same real THREE marker matrices; changing high spool leaves bypass fixed', () => {
  const effect=createTurbofanProcess(THREE),input=mechanical(createState(),{lowAngle:83,highAngle:143});
  const state=processState(input);effect.update(state);
  const matrices=()=>effect.group.children.filter(g=>g.name.startsWith('process/')&&g.children.some(c=>c.isInstancedMesh)).map(g=>[g.name,Array.from(g.children.find(c=>c.isInstancedMesh).instanceMatrix.array)]);
  const a=matrices();effect.update(processState(input));assert.deepEqual(matrices(),a);
  effect.update(processState(mechanical(input,{highAngle:240})));
  const b=matrices();for(let i=0;i<a.length;i++){if(a[i][0].startsWith('process/bypass-'))assert.deepEqual(b[i],a[i]);else assert.notDeepEqual(b[i],a[i]);}
  const snapshot=effect.snapshot();assert.equal(snapshot.externalFlamePockets,0);assert.equal(snapshot.annularBands,3);
  effect.dispose();
});

test('real process group hides all flow/combustion effects while exploded, and restores the same phase after assembly', () => {
  const effect=createTurbofanProcess(THREE),input=mechanical(createState(),{lowAngle:28,highAngle:216});
  effect.update(processState(input));const offsets=effect.snapshot().flows.map(f=>f.offsets);
  effect.update(processState(observe(input,{explode:1})));assert.equal(effect.group.visible,false);assert.ok(effect.snapshot().flows.every(f=>!f.visible));
  effect.update(processState(input));assert.equal(effect.group.visible,true);assert.deepEqual(effect.snapshot().flows.map(f=>f.offsets),offsets);
  const holder=new THREE.Group();holder.add(effect.group);effect.dispose();assert.equal(holder.children.length,0);
});

test('invalid angles, view state and process switches fail instead of producing uncontrolled particles', () => {
  for(const angle of [NaN,Infinity,-1,361])assert.throws(()=>processState({...createState(),highAngle:angle}),/轴角/);
  assert.throws(()=>processState(createState(),{enabled:1}),/布尔/);
  assert.throws(()=>processState({...createState(),view:{cutaway:true,explode:NaN}}),/观察状态/);
});
