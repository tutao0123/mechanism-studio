/** Original deterministic polygonal solids, with all shaft axes along +Z. */
import { Shape, Path, ExtrudeGeometry } from 'three';
import { MODULE, PRESSURE_ANGLE, TEETH, GEAR_SPEC, DIMENSIONS as D, ORBIT_RADIUS, PLANET_ANGLES, HOUSING as H, SUPPORT_BEARINGS } from './spec.mjs';

const TAU = 2 * Math.PI;
export class MeshBuilder {
  constructor() { this.positions = []; this.normals = []; this.indices = []; }
  vertex(p, n) { const length = Math.hypot(...n) || 1; this.positions.push(...p); this.normals.push(...n.map(x => x / length)); return this.positions.length / 3 - 1; }
  triangle(a, b, c) {
    const p = i => this.positions.slice(i * 3, i * 3 + 3), A = p(a), B = p(b), C = p(c);
    const u = B.map((v, i) => v - A[i]), v = C.map((v, i) => v - A[i]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...n) < 1e-16) return;
    const intended = [0, 1, 2].map(k => this.normals[a * 3 + k] + this.normals[b * 3 + k] + this.normals[c * 3 + k]);
    if (n.reduce((s, x, i) => s + x * intended[i], 0) < 0) this.indices.push(a, c, b); else this.indices.push(a, b, c);
  }
  quad(a, b, c, d) { this.triangle(a, b, c); this.triangle(a, c, d); }
  append(other, offset = [0, 0, 0]) { const start = this.positions.length / 3;
    for (let i = 0; i < other.positions.length; i++) this.positions.push(other.positions[i] + offset[i % 3]);
    this.normals.push(...other.normals); this.indices.push(...other.indices.map(i => i + start)); return this; }
  get triangleCount() { return this.indices.length / 3; }
}

const inv = a => Math.tan(a) - a;
/** Boundary of an external tooth (phase=crest), or internal tooth SPACE
 * (phase=gap). Internal material lies OUTSIDE this outline. Root joins are
 * radial simplifications, explicitly not generated cutter fillets. */
export function gearProfile(teeth, { internal = false, phase = 0, backlash = .04, flankSteps = 10 } = {}) {
  const pitch = MODULE * teeth / 2, base = pitch * Math.cos(PRESSURE_ANGLE);
  const lower = pitch - (internal ? 1 : 1.25) * MODULE, upper = pitch + (internal ? 1.25 : 1) * MODULE;
  const halfPitch = Math.PI / (2 * teeth) + (internal ? 1 : -1) * backlash * MODULE / (2 * pitch);
  const half = radius => halfPitch + inv(PRESSURE_ANGLE) - inv(Math.acos(Math.min(1, base / Math.max(radius, base))));
  const flankStart = Math.max(lower, base), points = [];
  const add = (a, r) => points.push({ angle: a, radius: r, point: [r * Math.cos(a), r * Math.sin(a)] });
  for (let k = 0; k < teeth; k++) {
    const center = phase + k * TAU / teeth;
    if (lower < base) add(center - half(base), lower);
    for (let j = 0; j <= flankSteps; j++) { const r = flankStart + (upper - flankStart) * j / flankSteps; add(center - half(r), r); }
    for (const f of [-.5, 0, .5]) add(center + f * half(upper), upper);
    for (let j = flankSteps; j >= 0; j--) { const r = flankStart + (upper - flankStart) * j / flankSteps; add(center + half(r), r); }
    if (lower < base) add(center + half(base), lower);
    const start = center + half(flankStart), end = center + TAU / teeth - half(flankStart);
    for (const f of [.25, .5, .75]) add(start + (end - start) * f, lower);
  }
  return points;
}
export function circle(radius, segments = 96, center = [0, 0]) { return Array.from({ length: segments }, (_, k) => [center[0] + radius * Math.cos(k * TAU / segments), center[1] + radius * Math.sin(k * TAU / segments)]); }

/** A closed polygon with genuine polygonal holes; no painted fake bores. */
export function extrude(outline, holes, z0, z1, { bevel = 0 } = {}) {
  const path = (points, Type) => { const p = new Type(); p.moveTo(...points[0]); for (const point of points.slice(1)) p.lineTo(...point); p.closePath(); return p; };
  const shape = path(outline, Shape); shape.holes = holes.map(hole => path(hole, Path));
  const geometry = new ExtrudeGeometry(shape, { depth: z1 - z0, steps: 1, bevelEnabled: bevel > 0, bevelThickness: bevel,
    bevelSize: bevel, bevelSegments: 2, curveSegments: 12 });
  const P = geometry.attributes.position, N = geometry.attributes.normal, b = new MeshBuilder();
  for (let i = 0; i < P.count; i++) b.vertex([P.getX(i), P.getY(i), P.getZ(i) + z0], [N.getX(i), N.getY(i), N.getZ(i)]);
  if (geometry.index) { const I = geometry.index; for (let i = 0; i < I.count; i += 3) b.triangle(I.getX(i), I.getX(i + 1), I.getX(i + 2)); }
  else for (let i = 0; i < P.count; i += 3) b.triangle(i, i + 1, i + 2);
  geometry.dispose(); return b;
}

/** Revolve a closed [z,r] profile. Chamfers are actual solids, not decals. */
export function lathe(profile, segments = 96) {
  const b = new MeshBuilder(), area = profile.reduce((s, [z, r], i) => { const q = profile[(i + 1) % profile.length]; return s + z * q[1] - q[0] * r; }, 0), sign = Math.sign(area);
  for (let i = 0; i < profile.length; i++) {
    const [z0, r0] = profile[i], [z1, r1] = profile[(i + 1) % profile.length], dz = z1 - z0, dr = r1 - r0;
    if ((r0 === 0 && r1 === 0) || Math.hypot(dz, dr) < 1e-14) continue;
    const nr = -sign * dz, nz = sign * dr;
    const a = [], c = [];
    for (let k = 0; k <= segments; k++) { const angle = TAU * k / segments, x = Math.cos(angle), y = Math.sin(angle), n = [nr * x, nr * y, nz];
      a.push(b.vertex([r0 * x, r0 * y, z0], n)); c.push(b.vertex([r1 * x, r1 * y, z1], n)); }
    for (let k = 0; k < segments; k++) b.quad(a[k], a[k + 1], c[k + 1], c[k]);
  }
  return b;
}
export const annulus = (inner, outer, z0, z1) => lathe([[z0, inner], [z1, inner], [z1, outer], [z0, outer]]);

function carrier() {
  // Radial boundary of the union of a hub, three narrow webs and rounded pads.
  const outline = Array.from({ length: 720 }, (_, k) => {
    const theta = k * TAU / 720; let r = .014;
    for (const alpha of PLANET_ANGLES) {
      const d = Math.atan2(Math.sin(theta - alpha), Math.cos(theta - alpha)), c = Math.cos(d), s = Math.sin(d);
      if (c > 0) { const web = Math.min(ORBIT_RADIUS / c, Math.abs(s) < 1e-12 ? Infinity : .0065 / Math.abs(s)); r = Math.max(r, web); }
      const disc = .0085 ** 2 - ORBIT_RADIUS ** 2 * s ** 2;
      if (disc >= 0) r = Math.max(r, ORBIT_RADIUS * c + Math.sqrt(disc));
    }
    return [r * Math.cos(theta), r * Math.sin(theta)];
  });
  const holes = [circle(D.carrierBore), ...PLANET_ANGLES.map(a => circle(.00405, 64, [ORBIT_RADIUS * Math.cos(a), ORBIT_RADIUS * Math.sin(a)]))];
  return extrude(outline, holes, -.0017, .0017, { bevel: .0003 });
}

/** Proper rotation, not reflection: rear heads/bosses face -Z while all source
 * matrices remain translations. Keeping this baked avoids a second rest pose. */
function rearFacing(mesh) {
  const result = new MeshBuilder();
  for (let i = 0; i < mesh.positions.length; i += 3) result.vertex([mesh.positions[i], -mesh.positions[i + 1], -mesh.positions[i + 2]], [mesh.normals[i], -mesh.normals[i + 1], -mesh.normals[i + 2]]);
  result.indices.push(...mesh.indices); return result;
}
const boltHoles = () => Array.from({ length: 6 }, (_, k) => { const a = TAU * (k + .5) / 6; return circle(H.boltBore, 48, [H.boltCircle * Math.cos(a), H.boltCircle * Math.sin(a)]); });

function endplate(bearing) {
  const bore = bearing.outer + .0001, outerBoss = bearing.outer + .005;
  const plate = extrude(circle(H.outer, 192), [circle(bore, 128), ...boltHoles()], -.003, .003);
  // The real retaining groove is inside the integral bearing boss. The forward
  // stepped seat supports the separately identified annular shaft seal.
  plate.append(lathe([[.003, bore], [.0045, bore], [.0045, bearing.outer + .00055], [.0055, bearing.outer + .00055],
    [.0055, bore], [.0065, bore], [.0065, bearing.sealOuter + .0001], [.0115, bearing.sealOuter + .0001],
    [.0115, outerBoss - .0004], [.0111, outerBoss], [.003, outerBoss]], 128));
  return plate;
}

export function bearingGrooveRadius(bearing, z, element) {
  const radius = bearing.ballRadius + bearing.grooveClearance;
  // The excess groove radius is curvature relief, not a radial gap at both
  // contacts. Offset its centre so the nominal unloaded alpha=0 contact is
  // exactly at pitch +/- ballRadius; the larger groove opens away from z=0.
  const centre = bearing.pitch + (element === 'inner' ? 1 : -1) * bearing.grooveClearance;
  const chord = Math.sqrt(Math.max(0, radius ** 2 - z ** 2));
  return element === 'inner' ? Math.min(bearing.innerShoulder, centre - chord)
    : Math.max(bearing.outerShoulder, centre + chord);
}
function bearingRace(bearing, element) {
  const half = bearing.width / 2, isInner = element === 'inner', face = isInner ? bearing.innerShoulder : bearing.outerShoulder;
  const radius = bearing.ballRadius + bearing.grooveClearance;
  const centre = bearing.pitch + (isInner ? 1 : -1) * bearing.grooveClearance;
  const dz = Math.sqrt(radius ** 2 - (face - centre) ** 2);
  const groove = Array.from({ length: 33 }, (_, k) => { const z = dz * (1 - 2 * k / 32); return [z, bearingGrooveRadius(bearing, z, element)]; });
  if (isInner) return lathe([[-half, bearing.bore + .0002], [-half + .0002, bearing.bore], [half - .0002, bearing.bore],
    [half, bearing.bore + .0002], [half, face - .0002], [half - .0002, face], ...groove, [-half + .0002, face], [-half, face - .0002]], 128);
  return lathe([[-half, bearing.outer - .00025], [-half + .00025, bearing.outer], [half - .00025, bearing.outer],
    [half, bearing.outer - .00025], [half, face + .0002], [half - .0002, face], ...groove, [-half + .0002, face], [-half, face + .0002]], 128);
}
function bearingCage(bearing) {
  const b = new MeshBuilder(), z = bearing.ballRadius + .0002, railHalf = .00015, inner = bearing.pitch - .00045, outer = bearing.pitch + .00045;
  b.append(annulus(inner, outer, z - railHalf, z + railHalf));
  b.append(annulus(inner, outer, -z - railHalf, -z + railHalf));
  for (let k = 0; k < bearing.balls; k++) {
    const angle = TAU * (k + .5) / bearing.balls;
    b.append(lathe([[-z, 0], [-z, .00035], [z, .00035], [z, 0]], 24), [bearing.pitch * Math.cos(angle), bearing.pitch * Math.sin(angle), 0]);
  }
  return b;
}
function ball(radius) {
  return lathe(Array.from({ length: 25 }, (_, k) => { const theta = Math.PI * k / 24; return [-radius * Math.cos(theta), radius * Math.sin(theta)]; }), 48);
}
function retainingClip(bearing) {
  const inner = bearing.outer - .00115, outer = bearing.outer + .0004, start = .22, end = TAU - .22, points = [];
  for (let k = 0; k <= 128; k++) { const angle = start + (end - start) * k / 128; points.push([outer * Math.cos(angle), outer * Math.sin(angle)]); }
  for (let k = 128; k >= 0; k--) { const angle = start + (end - start) * k / 128; points.push([inner * Math.cos(angle), inner * Math.sin(angle)]); }
  return extrude(points, [], -.0004, .0004);
}
function shaftSeal(bearing) {
  const shaft = bearing.bore - .00005, outer = bearing.sealOuter;
  return lathe([[-.002, shaft + .0024], [-.0011, shaft + .0024], [-.00025, shaft + .00008],
    [.00035, shaft + .00008], [.0008, shaft + .0012], [.002, shaft + .0012],
    [.002, outer - .00025], [.00175, outer], [-.00175, outer], [-.002, outer - .00025]], 128);
}

export function buildDefinitions() {
  const definitions = new Map();
  const sun = extrude(gearProfile(TEETH.sun, { phase: GEAR_SPEC.sunPhase }).map(p => p.point), [circle(D.sunBore)], -.006, .006);
  // Raised bore collars make journal locations legible in the line-art study.
  sun.append(annulus(D.sunBore, .010, -.0075, -.006)).append(annulus(D.sunBore, .010, .006, .0075));
  definitions.set('pg-def:sun', sun);
  const planet = extrude(gearProfile(TEETH.planet, { phase: GEAR_SPEC.planetPhase }).map(p => p.point), [circle(D.planetBore)], -.006, .006);
  planet.append(annulus(D.planetBore, .009, -.0067, -.006)).append(annulus(D.planetBore, .009, .006, .0067));
  definitions.set('pg-def:planet', planet);
  const ringHoles = [gearProfile(TEETH.ring, { internal: true, phase: GEAR_SPEC.ringGapPhase }).map(p => p.point),
    ...Array.from({ length: 6 }, (_, k) => circle(.002, 48, [.0795 * Math.cos(TAU * (k + .5) / 6), .0795 * Math.sin(TAU * (k + .5) / 6)]))];
  const ring = extrude(circle(D.ringOuter, 192), ringHoles, -.008, .008);
  ring.append(annulus(.0818, .0846, -.009, -.008)).append(annulus(.0818, .0846, .008, .009));
  definitions.set('pg-def:ring', ring);
  definitions.set('pg-def:carrier', carrier());
  definitions.set('pg-def:pin', lathe([[-.014, D.pinBore], [.014, D.pinBore], [.014, .0036], [.0137, D.pinRadius], [-.0137, D.pinRadius], [-.014, .0036]]));
  definitions.set('pg-def:bearing', lathe([[-.0062, D.bearingInner], [.0062, D.bearingInner], [.0062, .0052], [.0059, D.bearingOuter], [-.0059, D.bearingOuter], [-.0062, .0052]]));
  definitions.set('pg-def:washer', lathe([[-.0007, .0020], [.0007, .0020], [.0007, .0057], [.0004, .006], [-.0004, .006], [-.0007, .0057]]));
  const hex = radius => circle(radius, 6);
  const screw = lathe([[-.005, 0], [-.005, .0013], [-.0047, .0015], [0, .0015], [0, .003], [.0007, .003], [.0007, 0]], 48);
  screw.append(extrude(circle(.003, 48), [hex(.0014)], .0007, .0026));
  definitions.set('pg-def:screw', screw);
  definitions.set('pg-def:input-shaft', lathe([[-.027, 0], [-.027, .0058], [-.0267, .006], [.0167, .006], [.017, .0057], [.017, 0]]));
  // Through-bored output tube permits the independent sun shaft through it.
  // v2 corrects the original flange's 1 mm overlap with the rear carrier. The
  // shoulder now ends at world Z=-14 mm; shaft, bore, ID and rest are unchanged.
  definitions.set('pg-def:output-hub', lathe([[-.014, .0063], [.014, .0063], [.014, .008], [.010, .008], [.010, .012], [.007, .012], [.007, .008], [-.0137, .008], [-.014, .0077]]));
  definitions.set('pg-def:housing', extrude(circle(H.outer, 192), [circle(H.inner, 192), ...boltHoles()], -H.halfLength, H.halfLength));
  definitions.set('pg-def:gasket', extrude(circle(H.outer - .00015, 192), [circle(H.inner + .00015, 192), ...boltHoles()], -.0005, .0005));
  definitions.set('pg-def:housing-washer', annulus(.0018, .0034, -.0005, .0005));
  const housingBolt = lathe([[-.0155, 0], [-.0155, .00125], [-.01525, .0015], [.0005, .0015], [.0005, .003], [.0012, .003], [.0012, 0]], 48);
  housingBolt.append(extrude(circle(.003, 48), [circle(.0014, 6)], .0012, .0031));
  definitions.set('pg-def:housing-bolt-front', housingBolt);
  definitions.set('pg-def:housing-bolt-rear', rearFacing(housingBolt));
  for (const [side, bearing] of Object.entries(SUPPORT_BEARINGS)) {
    const oriented = mesh => side === 'rear' ? rearFacing(mesh) : mesh;
    definitions.set(`pg-def:endplate-${side}`, oriented(endplate(bearing)));
    definitions.set(`pg-def:shaft-seal-${side}`, oriented(shaftSeal(bearing)));
    definitions.set(`pg-def:bearing-clip-${side}`, oriented(retainingClip(bearing)));
    definitions.set(`pg-def:support-bearing-${side}-inner`, bearingRace(bearing, 'inner'));
    definitions.set(`pg-def:support-bearing-${side}-outer`, bearingRace(bearing, 'outer'));
    definitions.set(`pg-def:support-bearing-${side}-cage`, bearingCage(bearing));
    definitions.set(`pg-def:support-bearing-${side}-ball`, ball(bearing.ballRadius));
  }
  return definitions;
}
