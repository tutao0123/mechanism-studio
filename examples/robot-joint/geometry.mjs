/** Original robot-joint additions around the project's authored reducer.
 * Build-time reuse only: browser motion imports this example's own spec.
 */
import { MeshBuilder, buildDefinitions as reducerDefinitions, circle, extrude, lathe, annulus } from '../planetary-gears/geometry.mjs';
import { REDUCER_SCALE, MOTOR_SPEC as M } from './spec.mjs';
export { MeshBuilder };
const TAU = Math.PI * 2;
function transformed(mesh, point, normal = point) {
  const out = new MeshBuilder();
  for (let i = 0; i < mesh.positions.length; i += 3) out.vertex(point(mesh.positions.slice(i, i + 3)), normal(mesh.normals.slice(i, i + 3)));
  out.indices.push(...mesh.indices); return out;
}
const scaled = (mesh, scale) => transformed(mesh, p => p.map(v => v * scale), n => n);
function float32Solid(mesh) {
  // Quantize before winding validation. Very narrow inherited carrier bevel
  // triangles can flip when a double-precision 0.6 scale is serialized to
  // glTF Float32. Check the positions that will actually be shipped.
  const out = new MeshBuilder();
  for (let i = 0; i < mesh.positions.length; i += 3) out.vertex(mesh.positions.slice(i, i + 3).map(Math.fround), mesh.normals.slice(i, i + 3));
  for (let i = 0; i < mesh.indices.length; i += 3) out.triangle(...mesh.indices.slice(i, i + 3));
  return out;
}
function sector(inner, outer, halfAngle, z0, z1) {
  const points = [], steps = 32;
  for (let k = 0; k <= steps; k++) { const a = -halfAngle + 2 * halfAngle * k / steps; points.push([outer * Math.cos(a), outer * Math.sin(a)]); }
  for (let k = steps; k >= 0; k--) { const a = -halfAngle + 2 * halfAngle * k / steps; points.push([inner * Math.cos(a), inner * Math.sin(a)]); }
  return extrude(points, [], z0, z1, { bevel: .00008 });
}
const turn = (mesh, a) => transformed(mesh, ([x, y, z]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z]);
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const holesAt = (radius, bore, count, phase = 0) => Array.from({ length: count }, (_, k) => {
  const a = TAU * k / count + phase; return circle(bore, 40, [radius * Math.cos(a), radius * Math.sin(a)]);
});
function statorCore() {
  const b = annulus(M.statorYokeInner, M.statorOuter, -.0105, .0105);
  for (let k = 0; k < M.coilCount; k++) {
    const tooth = extrude(rect(.0329, -.0015, .042, .0015), [], -.0105, .0105);
    // The pole shoe approaches the rotor without filling the winding pocket.
    tooth.append(sector(M.statorInner, .033, .075, -.0105, .0105));
    b.append(turn(tooth, TAU * k / M.coilCount));
  }
  return b;
}
function windingPack() {
  // A real hollow pack wrapping a radial tooth. Extrude along local X by a
  // proper axis permutation; its opening is along X, never a fake axial bore.
  const section = extrude(rect(-.0038, -.012, .0038, .012), [rect(-.0018, -.01075, .0018, .01075)], .034, .0413,
    { bevel: .00008 });
  return transformed(section, ([y, z, x]) => [x, y, z], ([y, z, x]) => [x, y, z]);
}
function motorSleeve() {
  const z0 = -.014, z1 = .014, points = [[z0, M.housingInner], [z1, M.housingInner], [z1, M.housingOuter]];
  for (let k = 6; k >= 0; k--) {
    const z = -.012 + .004 * k;
    points.push([z + .0008, M.housingOuter], [z + .0002, M.housingOuter - .0011], [z - .0002, M.housingOuter - .0011], [z - .0008, M.housingOuter]);
  }
  points.push([z0, M.housingOuter]);
  // Bores pass through the sleeve wall and line up with the cap fasteners.
  const outline = circle(M.housingOuter, 192), holes = [circle(M.housingInner, 192), ...holesAt(M.boltCircle, .0011, 6)];
  // Cut the bores using actual polygonal holes. Six narrow annular cooling
  // lands are integral surface detail, with sufficient bore-edge clearance.
  const sleeve = extrude(outline, holes, z0, z1);
  for (let k = 0; k < 7; k++) sleeve.append(annulus(M.housingOuter, M.housingOuter + .0007, -.012 + .004 * k - .0005, -.012 + .004 * k + .0005));
  return sleeve;
}
export function buildDefinitions() {
  const definitions = new Map([...reducerDefinitions()].map(([id, mesh]) => [id.replace('pg-def:', 'rj-def:'), scaled(mesh, REDUCER_SCALE)]));
  // Lengthened original output sleeve carries the new flange without passing
  // through a solid cap; its existing carrier attachment face is unchanged.
  definitions.set('rj-def:output-hub', lathe([[-.0165, .00378], [.0084, .00378], [.0084, .0048], [.006, .0048],
    [.006, .0072], [.0042, .0072], [.0042, .0048], [-.0163, .0048], [-.0165, .0046]], 128));
  definitions.set('rj-def:output-flange', extrude(circle(.031, 160), [circle(.00486, 96), ...holesAt(.022, .0021, 6)], -.0025, .0025));
  definitions.set('rj-def:motor-adapter', extrude(circle(M.housingOuter, 192), [circle(.0251, 128), ...holesAt(M.boltCircle, .0011, 6),
    ...holesAt(M.boltCircle, .0022, 6, Math.PI / 6)], -.0039, .0039));
  definitions.set('rj-def:motor-shaft', lathe([[-.0162, 0], [-.0162, M.shaftRadius], [.017, M.shaftRadius], [.017, 0]], 96));
  definitions.set('rj-def:motor-rotor', lathe([[-.0105, .00365], [-.0085, .00365], [-.0085, M.rotorInner], [.0105, M.rotorInner],
    [.0105, M.rotorOuter], [-.0105, M.rotorOuter]], 160));
  definitions.set('rj-def:motor-stator', statorCore());
  definitions.set('rj-def:motor-magnet', sector(M.magnetInner, M.magnetOuter, .185, -.0098, .0098));
  definitions.set('rj-def:motor-coil', windingPack());
  definitions.set('rj-def:motor-housing', motorSleeve());
  definitions.set('rj-def:motor-endcap', extrude(circle(M.housingOuter, 192), [circle(.0042, 96), ...holesAt(M.boltCircle, .0011, 6)], -.0015, .0015));
  definitions.set('rj-def:motor-tail-bushing', annulus(.00365, .00417, -.0015, .0015));
  const bolt = lathe([[-.010, 0], [-.010, .00085], [-.0098, .001], [.0005, .001], [.0005, .002], [.001, .002], [.001, 0]], 48);
  bolt.append(extrude(circle(.002, 48), [circle(.0009, 6)], .001, .0022));
  definitions.set('rj-def:motor-bolt', bolt);
  definitions.set('rj-def:motor-washer', annulus(.0011, .0023, -.0005, .0005));
  definitions.set('rj-def:encoder-disc', annulus(.00365, .012, -.0005, .0005));
  definitions.set('rj-def:encoder-board', extrude(circle(.017, 96), [circle(.0041, 64), ...holesAt(.014, .0008, 3)], -.00035, .00035));
  definitions.set('rj-def:encoder-sensor', extrude(rect(-.0017, -.0012, .0017, .0012), [], -.0001, .0001, { bevel: .00004 }));
  return new Map([...definitions].map(([id, mesh]) => [id, float32Solid(mesh)]));
}
