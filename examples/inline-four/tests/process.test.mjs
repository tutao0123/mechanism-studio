import test from 'node:test';
import assert from 'node:assert/strict';
import {engineState,SPEC} from '../model.mjs';
import {processState,PROCESS} from '../process.mjs';

test('each finite spark window follows the original four-cylinder firing offsets and order',()=>{
  const order=[];
  for(const angle of [0,180,360,540]){
    const snapshot=processState(angle),active=snapshot.cylinders.filter(c=>c.spark.active);
    assert.equal(active.length,1);order.push(active[0].number);assert.equal(active[0].phase,0);assert.equal(active[0].spark.intensity,1);
  }
  assert.deepEqual(order,SPEC.firingOrder);
  for(let cylinder=0;cylinder<4;cylinder++){
    const start=SPEC.firingOffsets[cylinder];
    assert.equal(processState(start+PROCESS.sparkWindowDegrees-.001).cylinders[cylinder].spark.active,true);
    assert.equal(processState(start+PROCESS.sparkWindowDegrees).cylinders[cylinder].spark.active,false);
    assert.equal(processState(start-.001).cylinders[cylinder].spark.active,false);
  }
  for(let angle=0;angle<720;angle++)assert.ok(processState(angle).cylinders.filter(c=>c.spark.active).length<=1);
});

test('intake, port injection and exhaust use the original valve openings and cannot flow across a closed valve',()=>{
  for(let angle=0;angle<=720;angle+=2.5){
    const model=engineState(angle),process=processState(angle);
    for(let i=0;i<4;i++){
      const mechanical=model.cylinders[i],effect=process.cylinders[i];
      assert.equal(effect.intake.intensity,mechanical.intakeLift/SPEC.valveLift);
      assert.equal(effect.injection.intensity,effect.intake.intensity);
      assert.equal(effect.exhaust.intensity,mechanical.exhaustLift/SPEC.valveLift);
      if(effect.stage!=='intake')assert.equal(effect.injection.intensity,0);
      if(effect.stage!=='exhaust')assert.equal(effect.exhaust.intensity,0);
      assert.ok(effect.intake.intensity>=0&&effect.intake.intensity<=1);
    }
  }
  assert.equal(processState(450).cylinders[0].injection.intensity,1);
  for(const angle of [0,180,360,540,720])assert.equal(processState(angle).cylinders[0].injection.intensity,0);
});

test('display volume follows the same nonlinear piston curve and contracts during compression',()=>{
  for(let angle=0;angle<=720;angle+=1.75){
    const model=engineState(angle),process=processState(angle);
    for(let i=0;i<4;i++){
      const chamber=process.cylinders[i];
      assert.equal(chamber.bottomMM,model.cylinders[i].pistonHeight+PROCESS.crownOffsetMM);
      assert.equal(chamber.heightMM,chamber.topMM-chamber.bottomMM);
      assert.ok(chamber.heightMM>=12.5-1e-9&&chamber.heightMM<=102.5+1e-9);
      assert.ok(chamber.bottomMM>model.cylinders[i].pistonHeight+22,'fill stays above the actual piston crown');
    }
  }
  let previous=Infinity;
  for(let angle=540;angle<=720;angle++){
    const volume=processState(angle).cylinders[0].volumeMM3;
    assert.ok(volume<=previous+1e-6);previous=volume;
  }
});

test('flame is a bounded phase illustration restricted to the power stroke',()=>{
  assert.ok(processState(30).cylinders[0].flame.intensity>0);
  assert.equal(processState(140).cylinders[0].flame.intensity<1e-12,true);
  for(let angle=0;angle<720;angle++)for(const c of processState(angle).cylinders){
    assert.ok(c.flame.progress>=0&&c.flame.progress<=1);assert.ok(c.flame.intensity>=0&&c.flame.intensity<=1);
    if(c.stage!=='power')assert.equal(c.flame.intensity,0);
  }
  assert.equal(processState(12).pressureOrFlowSolver,false);
});

test('paused/seeked same angles reproduce identical effects; visibility never changes mechanical or process phase',()=>{
  const before=engineState(137),baseline=processState(137);
  for(const observation of [{enabled:false},{cutaway:false},{explode:.001},{explode:1}]){
    const hidden=processState(137,observation);assert.equal(hidden.visible,false);assert.deepEqual(hidden.cylinders,baseline.cylinders);
  }
  assert.deepEqual(engineState(137),before);
  assert.deepEqual(processState(137),baseline);
  assert.deepEqual(processState(0),processState(720));
  const spark=processState(5);assert.deepEqual(processState(5),spark,'paused spark stays at the chosen crank phase, without a timer');
  for(const angle of [137,450,0,540,137])if(angle===137)assert.deepEqual(processState(angle),baseline);
});

test('nonfinite angles and invalid observation inputs fail explicitly',()=>{
  for(const angle of [NaN,Infinity,-Infinity])assert.throws(()=>processState(angle),TypeError);
  for(const explode of [NaN,-.1,1.1])assert.throws(()=>processState(0,{explode}),TypeError);
  assert.throws(()=>processState(0,{enabled:1}),TypeError);assert.throws(()=>processState(0,{cutaway:1}),TypeError);
});
