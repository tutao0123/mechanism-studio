import test from 'node:test';
import assert from 'node:assert/strict';
import { SPEC, LEGS, forwardKinematics, inverseKinematics, footTrajectory, robotState, motionPoses, createSession, setMechanical, setObservation, bodyToGLTF } from '../model.mjs';
const near = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
test('four 2R legs give eight joints and standing foot sphere tangent to floor', () => {
  const state = robotState(); assert.equal(state.jointCount, 8); assert.equal(state.legs.length, 4);
  assert.deepEqual(state.contactLegs, ['fl','fr','rl','rr']);
  for (const leg of state.legs) { near(leg.footPosition[2], SPEC.footRadius); near(leg.footPosition[0], leg.x); near(leg.footPosition[1], leg.y); }
});
test('IK followed by FK recovers targets throughout every supported gait height and phase', () => {
  for (const height of [10,20,40,60]) for (let index = 0; index <= 200; index++) {
    const state = robotState({ mode: 'trot', phase: index / 200, stepHeight: height });
    for (const leg of state.legs) { assert.ok(leg.withinLimits); assert.ok(leg.residual < 1e-7); const fk = forwardKinematics(leg.hip, leg.knee); near(fk.foot[0], leg.target[0]-leg.x); near(fk.foot[1], leg.target[2]-SPEC.hipHeight); }
  }
});
test('both link lengths remain constant for all gait poses', () => {
  for (let index = 0; index < 100; index++) for (const leg of robotState({ mode: 'trot', phase: index / 100, stepHeight: 60 }).legs) {
    const length = (a,b) => Math.hypot(...a.map((x,i)=>x-b[i]));
    near(length(leg.hipPosition, leg.kneePosition), SPEC.thigh); near(length(leg.kneePosition, leg.footPosition), SPEC.shin);
  }
});
test('single leg lift changes only left-front motion while other legs retain standing state', () => {
  const stand = robotState(), single = robotState({ mode: 'single', singleLift: 60 });
  near(single.legs[0].footPosition[2], 70); near(single.legs[0].footPosition[0], 125);
  for (let i = 1; i < 4; i++) assert.deepEqual(single.legs[i], stand.legs[i]);
  assert.deepEqual(single.contactLegs, ['fr','rl','rr']);
});
test('diagonal pairs share phase and alternate the two swing groups at half-cycle', () => {
  for (const phase of [.1,.25,.4,.6,.75,.9]) {
    const state = robotState({ mode: 'trot', phase });
    near(state.legs[0].hip, state.legs[3].hip); near(state.legs[1].hip, state.legs[2].hip);
    assert.equal(state.legs[0].swing, state.legs[3].swing); assert.notEqual(state.legs[0].swing, state.legs[1].swing);
    assert.equal(state.contactLegs.length, 2);
  }
});
test('foot trajectory is periodic, continuous at joins, bounded and never below nominal contact height', () => {
  for (const edge of [0,.5,1]) {
    const a = footTrajectory(edge-1e-8,60), b = footTrajectory(edge+1e-8,60); near(a.x,b.x,1e-5); near(a.z,b.z,1e-5);
  }
  for (let i=0;i<1000;i++) { const point=footTrajectory(i/1000,60); assert.ok(point.z>=10-1e-9&&point.z<=70+1e-9); assert.ok(Math.abs(point.x)<=SPEC.stride/2); }
  assert.deepEqual(footTrajectory(.25),footTrajectory(1.25));
});
test('unreachable targets, joint-limit violations and invalid control inputs fail explicitly', () => {
  assert.throws(()=>inverseKinematics(1000,0),/可达/); assert.throws(()=>inverseKinematics(0,-214),/限位/);
  assert.throws(()=>robotState({mode:'unknown'}),/模式/); assert.throws(()=>footTrajectory(0,80),/步高/);
  assert.throws(()=>robotState({mode:'stand',stepHeight:80}),/步高/);
  assert.throws(()=>robotState({singleLift:100}),/抬高/); assert.throws(()=>setMechanical(createSession(),{speed:0}),/步频/);
  assert.throws(()=>robotState({phase:NaN}),/有限/);
});
test('observation changes preserve all mechanical state and derived joint/foot values', () => {
  const session = createSession({ mode:'trot', phase:.25, stepHeight:60 });
  const observed = setObservation(session,{explode:1,camera:'side',cutaway:false});
  assert.deepEqual(robotState(observed),robotState(session)); assert.equal(observed.phase,session.phase);
  assert.deepEqual(motionPoses(robotState(observed)),motionPoses(robotState(session)));
});
test('display poses use metre/Y-up coordinates once, with thigh and shin owned by model', () => {
  const state=robotState({mode:'single',singleLift:40}), poses=motionPoses(state);
  assert.equal(Object.keys(poses).length,12);
  for (const leg of state.legs) { assert.deepEqual(poses['thigh-'+leg.id].position,bodyToGLTF(leg.hipPosition));assert.deepEqual(poses['shin-'+leg.id].position,bodyToGLTF(leg.kneePosition));assert.deepEqual(poses['foot-'+leg.id].position,bodyToGLTF(leg.footPosition));near(poses['shin-'+leg.id].rotation[2],(leg.hip+leg.knee)*Math.PI/180); }
});
