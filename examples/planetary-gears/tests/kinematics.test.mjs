import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { applyWorkingPoses, bindAssembly, applyDisplayExplosion, resetDisplay } from '../../../shared/viewer/scene.mjs';
import { Group } from 'three';
import { createPlanetaryRig, meshPhaseErrors, motionState, pitchVelocityResiduals } from '../kinematics.mjs';
import { PARTS, GEAR_SPEC, ROOT_ID, PLANET_ANGLES, SUPPORT_BEARINGS } from '../spec.mjs';
import { gearProfile } from '../geometry.mjs';

const index = JSON.parse(await readFile(new URL('../assets/scene-index.json', import.meta.url), 'utf8'));
const rig = createPlanetaryRig(index);
const TAU = 2 * Math.PI;
const near = (a, b, epsilon = 1e-10, label = '') => assert.ok(Math.abs(a - b) < epsilon, `${label}: ${a} vs ${b}`);
const nearVector = (a, b, epsilon = 1e-10) => a.forEach((value, i) => near(value, b[i], epsilon));

test('authored tooth counts satisfy coaxial, equal-spacing and neighbour conditions', () => {
  const { sunTeeth: s, planetTeeth: p, ringTeeth: r, planetCount: n, module: m, orbitRadius: a } = GEAR_SPEC;
  assert.equal(r, s + 2 * p);
  assert.equal((s + r) / n, 32);
  near(m * (s + p) / 2, a);
  near(m * (r - p) / 2, a);
  assert.ok(2 * a * Math.sin(Math.PI / n) - m * (p + 2) > .031);
  assert.deepEqual([s, p, r], [24, 24, 72]);
});

test('Willis equation, both carrier-frame meshes and repeated occurrence phases hold in either direction', () => {
  for (let sample = 0; sample <= 2000; sample++) {
    const theta = -8 * TAU + 16 * TAU * sample / 2000, s = motionState(theta);
    near(24 * (s.sunAngle - s.carrierAngle) + 72 * (s.ringAngle - s.carrierAngle), 0, 1e-11, 'Willis');
    near(24 * (s.sunAngle - s.carrierAngle) + 24 * (s.planetAngle - s.carrierAngle), 0, 1e-11, 'external');
    near(72 * (s.ringAngle - s.carrierAngle) - 24 * (s.planetAngle - s.carrierAngle), 0, 1e-11, 'internal');
    near(s.planetAngle, -.5 * theta);
    near(s.planetRelativeCarrier, -.75 * theta);
    for (const phase of meshPhaseErrors(theta)) {
      near(phase.external, 0, 2e-12, `${phase.id} external phase`);
      near(phase.internal, 0, 2e-12, `${phase.id} internal phase`);
    }
    const velocity = pitchVelocityResiduals(theta);
    near(velocity.external, 0);
    near(velocity.internal, 0);
  }
});

test('model wrappers reproduce absolute centres and own-axis spin without applying source rest twice', () => {
  const snapshot = JSON.stringify(index);
  for (const angle of [0, .173, TAU / 6, 3.2, 8 * Math.PI, -1.6, .173, 0]) {
    const poses = rig.posesForAngle(angle), state = motionState(angle), expected = rig.worldMatrices(angle);
    for (const spec of PARTS) {
      const p = poses[spec.id], part = index.parts.find(part => part.id === spec.id);
      near(p.quaternion.reduce((sum, x) => sum + x * x, 0), 1);
      assert.deepEqual(p.scale, [1, 1, 1]);
      const actual = new Matrix4().compose(new Vector3(...p.position), new Quaternion(...p.quaternion), new Vector3(...p.scale))
        .multiply(new Matrix4().fromArray(part.localMatrix));
      nearVector(actual.elements, expected.get(spec.id).elements);
      const centre = new Vector3().setFromMatrixPosition(actual);
      if (spec.planetIndex !== undefined) {
        const alpha = PLANET_ANGLES[spec.planetIndex] + state.carrierAngle;
        nearVector(centre.toArray(), [GEAR_SPEC.orbitRadius * Math.cos(alpha), GEAR_SPEC.orbitRadius * Math.sin(alpha), spec.translation[2]]);
      } else if (spec.motionRole === 'bearing-ball') {
        const bearing = SUPPORT_BEARINGS[spec.supportSide], phase = TAU * spec.ballIndex / bearing.balls + state.bearings[spec.supportSide].cageAngle;
        nearVector(centre.toArray(), [bearing.pitch * Math.cos(phase), bearing.pitch * Math.sin(phase), bearing.z]);
      } else nearVector(centre.toArray(), spec.translation);
      const spin = spec.motionRole === 'bearing-cage' ? state.bearings[spec.supportSide].cageAngle
        : spec.motionRole === 'bearing-ball' ? state.bearings[spec.supportSide].ballSpinAngle
          : spec.motionRole === 'sun' ? angle : spec.motionRole === 'planet' ? -.5 * angle : spec.motionRole === 'carrier' ? .25 * angle : 0;
      const direction = new Vector3(1, 0, 0).transformDirection(actual);
      nearVector(direction.toArray(), [Math.cos(spin), Math.sin(spin), 0]);
    }
  }
  assert.equal(JSON.stringify(index), snapshot);
});

test('the detailed assembly binds 80 real occurrences and owns both rolling bearing internals', () => {
  assert.equal(PARTS.length, 80);
  assert.equal(index.parts.length, 80);
  for (const side of ['front', 'rear']) {
    const innerId = `pg:support-bearing-${side}-inner`, innerRole = side === 'front' ? 'sun' : 'carrier';
    assert.equal(index.parts.find(part => part.id === innerId).motionRole, innerRole);
    const outer = index.parts.find(part => part.id === `pg:support-bearing-${side}-outer`);
    assert.equal(outer.motionRole, 'fixed');
    for (const angle of [0, .8, -2.1, 8 * Math.PI]) nearVector(rig.worldMatrices(angle).get(outer.id).elements, outer.worldMatrix);
    for (const element of ['cage', ...Array.from({ length: 10 }, (_, i) => `ball-${i + 1}`)]) {
      const id = `pg:support-bearing-${side}-${element}`, part = index.parts.find(part => part.id === id);
      assert.ok(part, id); assert.equal(part.motionRole, element === 'cage' ? 'bearing-cage' : 'bearing-ball');
      assert.ok(rig.ownedIds.includes(id), id);
    }
  }
  assert.equal(rig.ownedIds.length, 44);
  assert.match(rig.evidence.supportBearingMotion, /no-slip.*outer races are fixed.*absolute housing-frame/);
});

test('actual transformed pitch-point velocities agree at both interfaces while planet centres orbit', () => {
  const radius = GEAR_SPEC.module * GEAR_SPEC.planetTeeth / 2;
  const derivative = (id, materialPoint, angle) => {
    const h = 1e-5;
    const plus = materialPoint.clone().applyMatrix4(rig.worldMatrices(angle + h).get(id));
    const minus = materialPoint.clone().applyMatrix4(rig.worldMatrices(angle - h).get(id));
    return plus.sub(minus).multiplyScalar(1 / (2 * h));
  };
  for (const angle of [0, .31, 2.1, -4.7, 12]) {
    const state = motionState(angle), world = rig.worldMatrices(angle);
    for (const planet of state.planets) {
      const u = new Vector3(Math.cos(planet.orbitAngle), Math.sin(planet.orbitAngle), 0);
      const innerPoint = u.clone().multiplyScalar(radius), outerPoint = u.clone().multiplyScalar(GEAR_SPEC.module * GEAR_SPEC.ringTeeth / 2);
      const sunMaterial = innerPoint.clone().applyMatrix4(world.get('pg:sun').clone().invert());
      const planetInnerMaterial = innerPoint.clone().applyMatrix4(world.get(planet.id).clone().invert());
      const planetOuterMaterial = outerPoint.clone().applyMatrix4(world.get(planet.id).clone().invert());
      assert.ok(derivative('pg:sun', sunMaterial, angle).distanceTo(derivative(planet.id, planetInnerMaterial, angle)) < 1e-10);
      assert.ok(derivative(planet.id, planetOuterMaterial, angle).length() < 1e-10);
    }
  }
});

test('sampled generated gear sections maintain separation at both meshes over a relative tooth period', () => {
  const sun = gearProfile(24, { phase: GEAR_SPEC.sunPhase });
  const planet = gearProfile(24, { phase: GEAR_SPEC.planetPhase });
  const ring = gearProfile(72, { internal: true, phase: GEAR_SPEC.ringGapPhase });
  const dense = profile => profile.flatMap((p, i) => {
    const q = profile[(i + 1) % profile.length];
    return [0, .25, .5, .75].map(f => [p.point[0] * (1 - f) + q.point[0] * f, p.point[1] * (1 - f) + q.point[1] * f]);
  });
  // Intersect a ray with the actual straight profile edge; using interpolated
  // radii instead would silently replace each polygon edge with a curve.
  const radialBoundary = (profile, theta) => {
    theta = (theta - profile[0].angle) % TAU;
    if (theta < 0) theta += TAU;
    theta += profile[0].angle;
    let lo = 0, hi = profile.length - 1;
    while (lo < hi) {
      const middle = Math.ceil((lo + hi) / 2);
      if (profile[middle].angle <= theta) lo = middle; else hi = middle - 1;
    }
    const a = profile[lo].point, b = profile[(lo + 1) % profile.length].point;
    const vx = b[0] - a[0], vy = b[1] - a[1];
    return (a[0] * vy - a[1] * vx) / (Math.cos(theta) * vy - Math.sin(theta) * vx);
  };
  const rotate = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
  const sunPoints = dense(sun), planetPoints = dense(planet);
  let minimumExternal = Infinity, minimumInternal = Infinity;
  // (sun - carrier) advances one 24-tooth pitch, while the carrier advances
  // exactly one ring pitch. All three occurrence identities are evaluated.
  for (let sample = 0; sample <= 720; sample++) {
    const state = motionState(TAU / 18 * sample / 720);
    for (const occurrence of state.planets) {
      const c = occurrence.center;
      for (const p of planetPoints) {
        const q = rotate(p, state.planetAngle); q[0] += c[0]; q[1] += c[1];
        const r = Math.hypot(...q), a = Math.atan2(q[1], q[0]);
        minimumInternal = Math.min(minimumInternal, radialBoundary(ring, a) - r);
        minimumExternal = Math.min(minimumExternal, r - radialBoundary(sun, a - state.sunAngle));
      }
      for (const p of sunPoints) {
        const q = rotate(p, state.sunAngle); q[0] -= c[0]; q[1] -= c[1];
        minimumExternal = Math.min(minimumExternal, Math.hypot(...q) - radialBoundary(planet, Math.atan2(q[1], q[0]) - state.planetAngle));
      }
    }
  }
  assert.ok(minimumExternal > 0 && minimumExternal < .0005, `Sampled external radial clearance: ${minimumExternal} m`);
  assert.ok(minimumInternal > 0 && minimumInternal < .0005, `Sampled internal radial clearance: ${minimumInternal} m`);
  // Positive section samples are useful regression evidence, not continuous
  // collision certification, load/contact analysis or manufacturing clearance.
});

test('viewer display explosion stays independent of mechanics and resetting it restores the same working assembly', () => {
  const root = new Group(); root.userData.assembly_id = ROOT_ID;
  for (const spec of PARTS) {
    const node = new Group(); node.userData.part_id = spec.id; node.position.fromArray(spec.translation); root.add(node);
  }
  const binding = bindAssembly(root), angle = 1.237;
  applyWorkingPoses(binding.parts, rig.workingPoses({ sunAngle: angle }));
  root.updateMatrixWorld(true);
  const before = new Map([...binding.parts].map(([id, b]) => [id, b.node.matrixWorld.clone()]));
  const mechanicalBefore = rig.workingPoses({ sunAngle: angle });
  applyDisplayExplosion(binding.parts, 1, b => b.id === 'pg:planet-1' ? [.05, .02, .1] : [0, 0, .03]);
  assert.deepEqual(rig.workingPoses({ sunAngle: angle, offsetsWorld: { 'pg:planet-1': [10, 20, 30] } }), mechanicalBefore);
  resetDisplay(binding.parts); root.updateMatrixWorld(true);
  for (const [id, b] of binding.parts) {
    nearVector(b.node.matrixWorld.elements, before.get(id).elements);
    nearVector(b.node.position.toArray(), PARTS.find(part => part.id === id).translation);
  }
});

test('full carrier revolution returns the gear train but does not falsely reset bearing phases', () => {
  const zero = rig.worldMatrices(0), end = rig.worldMatrices(4 * TAU);
  for (const part of PARTS.filter(part => !['bearing-cage', 'bearing-ball'].includes(part.motionRole))) nearVector(end.get(part.id).elements, zero.get(part.id).elements);
  for (const side of ['front', 'rear']) {
    assert.ok(new Vector3().setFromMatrixPosition(end.get(`pg:support-bearing-${side}-ball-1`))
      .distanceTo(new Vector3().setFromMatrixPosition(zero.get(`pg:support-bearing-${side}-ball-1`))) > .005);
  }
  assert.equal(rig.evidence.fullPoseRepeatSunRadians, null);
  near(rig.evidence.gearTrainPoseRepeatSunRadians, 4 * TAU);
  const poses = rig.posesForAngle(0);
  for (const pose of Object.values(poses)) assert.deepEqual(pose, { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] });
  assert.deepEqual(rig.posesForAngle(.74), rig.posesForAngle(.74));
});

test('rig rejects unknown source identities, revisions, rest frames and invalid angles', () => {
  for (const mutate of [copy => { copy.units = 'mm'; }, copy => { copy.rootId = 'other'; },
    copy => { copy.geometryRevision = 'unknown'; }, copy => { copy.parts[0].id = copy.parts[1].id; },
    copy => { copy.source.specRevision = 'old-specification'; }, copy => { copy.gearSpec.ringGapPhase = 0; },
    copy => { copy.supportBearingSpec.front.pitch += .001; }, copy => { delete copy.supportBearingSpec; },
    copy => { copy.parts.find(part => part.bearingElement === 'ball').ballIndex = 8; },
    copy => { copy.parts[0].parentId = 'pg:planet-1'; }, copy => { copy.parts[0].motionRole = 'carrier'; },
    copy => { copy.parts[0].worldMatrix[12] += .001; }, copy => { copy.parts[0].localMatrix[0] = NaN; }]) {
    const copy = structuredClone(index); mutate(copy); assert.throws(() => createPlanetaryRig(copy));
  }
  for (const value of [NaN, Infinity, -Infinity, undefined, '1']) {
    assert.throws(() => rig.workingPoses({ sunAngle: value }));
  }
  assert.throws(() => rig.workingPoses({}));
});
