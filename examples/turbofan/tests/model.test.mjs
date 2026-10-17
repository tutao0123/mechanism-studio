import test from 'node:test';
import assert from 'node:assert/strict';
import { SPEC, ROTORS, createState, mechanical, observe, advance, poses, derived, bodyToGLTF } from '../model.mjs';

test('two source spools own the complete 12 rotating parts and separate angles', () => {
  let state = mechanical(createState(), { lowAngle: 90, highAngle: 210 });
  const transforms = poses(state);
  assert.equal(Object.keys(transforms).length, 12);
  for (const [id, spool] of Object.entries(ROTORS)) assert.equal(transforms[id].rotationX, (spool === 'low' ? 90 : 210) * Math.PI / 180);
  assert.equal(transforms.fan.rotationX, transforms['lp-turbine-2'].rotationX);
  assert.equal(transforms['hp-compressor-2'].rotationX, transforms['hp-turbine'].rotationX);
  assert.notEqual(transforms.fan.rotationX, transforms['hp-turbine'].rotationX);
  const previousHigh = state.highAngle;
  state = mechanical(state, { lowAngle: 140 }); assert.equal(state.highAngle, previousHigh);
  state = mechanical(state, { highAngle: 300 }); assert.equal(state.lowAngle, 140);
});

test('only prescribed demonstration angles advance; no thrust or thermodynamic result exists', () => {
  const input = mechanical(createState(), { playing: true, lowAngle: 350, highAngle: 340 });
  const advanced = advance(input, 1);
  assert.equal(advanced.lowAngle, 26); assert.equal(advanced.highAngle, 46);
  assert.equal(input.lowAngle, 350); assert.equal(input.highAngle, 340);
  assert.equal(SPEC.lowSpeedDegrees, 36); assert.equal(SPEC.highSpeedDegrees, 66);
  assert.equal(derived(advanced).forceOrThermodynamicSolver, false);
  assert.equal(derived(advanced).mechanicalSource, 'prescribed-kinematics');
  assert.equal(advance(createState(), 1).lowAngle, 0);
});

test('camera, cutaway and explosion preserve mechanical readouts and never advance while exploded', () => {
  const initial = mechanical(createState(), { lowAngle: 37, highAngle: 128, playing: true });
  for (const patch of [{ camera:'side' }, { camera:'front',cutaway:false }, { camera:'core',cutaway:true }]) {
    const changed = observe(initial, patch); assert.deepEqual(derived(changed), derived(initial));
    assert.equal(changed.playing, true); assert.equal(initial.view.camera, 'overview');
  }
  const exploded = observe(initial, { explode: 1 });
  assert.deepEqual(derived(exploded), derived(initial)); assert.equal(exploded.playing, false);
  assert.equal(advance(exploded, 1), exploded);
  const gated = mechanical(exploded, { lowAngle: 200, highAngle: 250, playing: true });
  assert.equal(gated.lowAngle, 37); assert.equal(gated.highAngle, 128); assert.equal(gated.playing, false);
  const assembled = observe(exploded, { explode: 0 }); assert.deepEqual(derived(assembled), derived(initial));
});

test('invalid mechanical and observation values reject; instances do not share view objects', () => {
  for (const value of [NaN, Infinity, -1, 361]) assert.throws(() => mechanical(createState(), { lowAngle:value }), TypeError);
  assert.throws(() => mechanical(createState(), { playing:1 }), TypeError);
  assert.throws(() => observe(createState(), { explode:NaN }), TypeError);
  assert.throws(() => observe(createState(), { camera:'unknown' }), TypeError);
  assert.throws(() => observe(createState(), { cutaway:1 }), TypeError);
  assert.throws(() => advance(createState(), -1), TypeError);
  const a=createState(),b=createState();a.view.explode=1;assert.equal(b.view.explode,0);
});

test('body millimetres map to GLTF metres once', () => {
  assert.deepEqual(bodyToGLTF([100, 200, 300]), [.1, .3, -.2]);
  assert.throws(() => bodyToGLTF([1, NaN, 3]), TypeError);
});
