/** Deterministic mesh primitives for the teaching gearbox, in part-local metres.
 * Shaft axes run along +X; angles in the YZ plane are measured from +Y toward
 * +Z. Every triangle is wound to face its intended normal because the viewer
 * draws front faces only. Segment counts keep neighbouring faces under the
 * 25° line-art crease angle on curved surfaces, so only real edges are drawn. */
import { MODULE, PRESSURE_ANGLE } from './spec.mjs';

const TAU = 2 * Math.PI;
const CREASE_COS = Math.cos(22 * Math.PI / 180);

export class MeshBuilder {
  constructor() { this.positions = []; this.normals = []; this.indices = []; }
  vertex(p, n) {
    const length = Math.hypot(...n) || 1;
    this.positions.push(p[0], p[1], p[2]); this.normals.push(n[0] / length, n[1] / length, n[2] / length);
    return this.positions.length / 3 - 1;
  }
  /** Add a triangle wound so its geometric normal agrees with its vertex normals. */
  triangle(a, b, c) {
    const P = this.positions, N = this.normals, v = i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
    const [pa, pb, pc] = [v(a), v(b), v(c)];
    const u = pb.map((x, i) => x - pa[i]), w = pc.map((x, i) => x - pa[i]);
    const cross = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (Math.hypot(...cross) < 1e-16) return;
    const intended = [0, 1, 2].map(k => N[a * 3 + k] + N[b * 3 + k] + N[c * 3 + k]);
    if (cross[0] * intended[0] + cross[1] * intended[1] + cross[2] * intended[2] < 0) this.indices.push(a, c, b);
    else this.indices.push(a, b, c);
  }
  quad(a, b, c, d) { this.triangle(a, b, c); this.triangle(a, c, d); }
  append(other, transform = p => p, rotateNormal = n => n) {
    const offset = this.positions.length / 3;
    for (let i = 0; i < other.positions.length; i += 3) {
      const p = transform([other.positions[i], other.positions[i + 1], other.positions[i + 2]]);
      const n = rotateNormal([other.normals[i], other.normals[i + 1], other.normals[i + 2]]);
      this.positions.push(...p); this.normals.push(...n);
    }
    for (const index of other.indices) this.indices.push(index + offset);
    return this;
  }
  get triangleCount() { return this.indices.length / 3; }
}

const yz = (angle, radius) => [radius * Math.cos(angle), radius * Math.sin(angle)];

/** Solid of revolution about +X from a closed profile of [x, r] points (r ≥ 0).
 * Corners split normals; each edge becomes one smooth strip. */
export function lathe(profile, { segments = 48, builder = new MeshBuilder(), offset = [0, 0, 0] } = {}) {
  const area = profile.reduce((sum, [x, r], i) => { const [x2, r2] = profile[(i + 1) % profile.length]; return sum + x * r2 - x2 * r; }, 0);
  const outward = area > 0 ? 1 : -1;
  for (let i = 0; i < profile.length; i++) {
    const [x0, r0] = profile[i], [x1, r1] = profile[(i + 1) % profile.length];
    if (r0 <= 0 && r1 <= 0) continue;
    const dx = x1 - x0, dr = r1 - r0, length = Math.hypot(dx, dr);
    if (length < 1e-12) continue;
    // For a counter-clockwise (x, r) profile the outward normal is (dr, −dx).
    const nx = outward * dr / length, nr = -outward * dx / length;
    const ring = (x, r) => Array.from({ length: segments + 1 }, (_, k) => {
      const angle = TAU * k / segments, [y, z] = yz(angle, r), [ny, nz] = yz(angle, nr);
      return builder.vertex([x + offset[0], y + offset[1], z + offset[2]], [nx, ny, nz]);
    });
    const a = ring(x0, r0), b = ring(x1, r1);
    for (let k = 0; k < segments; k++) builder.quad(a[k], a[k + 1], b[k + 1], b[k]);
  }
  return builder;
}

/** Points of a closed outline sampled in increasing polar angle, from a list
 * of [angle, radius] corners. Used for gears, splines and dog rings. */
function polar(points) { return points.map(([angle, radius]) => ({ angle, point: yz(angle, radius) })); }

const involute = alpha => Math.tan(alpha) - alpha;
/** Involute spur-gear outline: tooth k centred at phase + k·2π/Z. */
export function gearOutline(teeth, { phase = 0, module = MODULE, backlash = 0.04, flankSteps = 7 } = {}) {
  const r = module * teeth / 2, rb = r * Math.cos(PRESSURE_ANGLE), ra = r + module, rf = r - 1.25 * module;
  const halfPitch = Math.PI / (2 * teeth) - backlash * module / (2 * r);
  const halfAngle = rho => halfPitch + involute(PRESSURE_ANGLE) - involute(Math.acos(Math.min(1, rb / Math.max(rho, rb))));
  const flank = Array.from({ length: flankSteps + 1 }, (_, i) => Math.max(rf, Math.min(rb, ra)) + (ra - Math.max(rf, Math.min(rb, ra))) * i / flankSteps);
  const corners = [];
  for (let k = 0; k < teeth; k++) {
    const centre = phase + k * TAU / teeth;
    if (rf < rb) corners.push([centre - halfAngle(rb), rf]);
    for (const rho of flank) corners.push([centre - halfAngle(rho), rho]);
    for (const f of [-1 / 3, 1 / 3]) corners.push([centre + f * halfAngle(ra), ra]);
    for (const rho of [...flank].reverse()) corners.push([centre + halfAngle(rho), rho]);
    if (rf < rb) corners.push([centre + halfAngle(rb), rf]);
    // Root arc to the next tooth.
    const next = centre + TAU / teeth, start = centre + halfAngle(rb), end = next - halfAngle(rb);
    for (const f of [1 / 3, 2 / 3]) corners.push([start + (end - start) * f, rf]);
  }
  return polar(corners);
}

/** Straight-sided spline or dog teeth. `inward` puts the teeth on the inside
 * (a sleeve), so the tips are the smaller radius. */
export function splineOutline(count, tip, root, { phase = 0, tooth = .5, inward = false } = {}) {
  const corners = [], pitch = TAU / count, half = pitch * tooth / 2;
  for (let k = 0; k < count; k++) {
    const centre = phase + k * pitch + (inward ? pitch / 2 : 0);
    corners.push([centre - half * 1.08, root], [centre - half * .92, tip], [centre + half * .92, tip], [centre + half * 1.08, root]);
    corners.push([centre + pitch / 2, root]);
  }
  return polar(corners);
}

/** Circle sampled at the same polar angles as an outline, for stitched caps. */
export const circleLike = (outline, radius) => outline.map(({ angle }) => ({ angle, point: yz(angle, radius) }));

/** Extrude the ring between an outer and an inner outline (same sample count,
 * matched by polar angle) along X from x0 to x1. Faces are smooth across
 * gentle bends and split at corners, keeping tooth flanks clean in line art. */
export function ringExtrude(outer, inner, x0, x1, { builder = new MeshBuilder(), offset = [0, 0, 0] } = {}) {
  if (outer.length !== inner.length) throw new Error('Ring outlines need matching samples.');
  const n = outer.length, at = (p, x) => [x + offset[0], p[0] + offset[1], p[1] + offset[2]];
  const wall = (outline, sign) => {
    const edgeNormal = i => {
      const a = outline[i].point, b = outline[(i + 1) % n].point, dy = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dy, dz) || 1;
      // Counter-clockwise outline (increasing angle): outward normal is (dz, −dy).
      return [sign * dz / l, -sign * dy / l];
    };
    const normals = outline.map((_, i) => edgeNormal(i));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, here = normals[i];
      const vertexNormal = (k, own) => {
        const other = k === i ? normals[(i - 1 + n) % n] : normals[(j + 1) % n];
        const dot = own[0] * other[0] + own[1] * other[1];
        return dot > CREASE_COS ? [own[0] + other[0], own[1] + other[1]] : own;
      };
      const ni = vertexNormal(i, here), nj = vertexNormal(j, here);
      const a = builder.vertex(at(outline[i].point, x0), [0, ...ni]), b = builder.vertex(at(outline[j].point, x0), [0, ...nj]);
      const c = builder.vertex(at(outline[j].point, x1), [0, ...nj]), d = builder.vertex(at(outline[i].point, x1), [0, ...ni]);
      builder.quad(a, b, c, d);
    }
  };
  wall(outer, 1); wall(inner, -1);
  for (const [x, nx] of [[x0, -1], [x1, 1]]) {
    const o = outer.map(({ point }) => builder.vertex(at(point, x), [nx, 0, 0]));
    const q = inner.map(({ point }) => builder.vertex(at(point, x), [nx, 0, 0]));
    for (let i = 0; i < n; i++) builder.quad(o[i], o[(i + 1) % n], q[(i + 1) % n], q[i]);
  }
  return builder;
}

/** Ear-clipping triangulation of a simple polygon given as [y, z] points. */
function triangulate(points) {
  const signed = points.reduce((sum, [y, z], i) => { const [y2, z2] = points[(i + 1) % points.length]; return sum + y * z2 - y2 * z; }, 0);
  const order = points.map((_, i) => i); if (signed < 0) order.reverse();
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p, a, b, c) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  const triangles = [], remaining = [...order];
  let guard = 0;
  while (remaining.length > 3 && guard++ < 10000) {
    let clipped = false;
    for (let i = 0; i < remaining.length; i++) {
      const ia = remaining[(i - 1 + remaining.length) % remaining.length], ib = remaining[i], ic = remaining[(i + 1) % remaining.length];
      const [a, b, c] = [points[ia], points[ib], points[ic]];
      if (cross(a, b, c) <= 1e-18) continue;
      if (remaining.some(k => k !== ia && k !== ib && k !== ic && inside(points[k], a, b, c))) continue;
      triangles.push([ia, ib, ic]); remaining.splice(i, 1); clipped = true; break;
    }
    if (!clipped) throw new Error('Polygon could not be triangulated.');
  }
  triangles.push(remaining);
  return triangles;
}

/** Extrude a simple polygon of [y, z] points along X. */
export function extrudePolygon(points, x0, x1, { builder = new MeshBuilder(), offset = [0, 0, 0] } = {}) {
  const outline = points.map(point => ({ point }));
  const at = (p, x) => [x + offset[0], p[0] + offset[1], p[1] + offset[2]], n = points.length;
  const signed = points.reduce((sum, [y, z], i) => { const [y2, z2] = points[(i + 1) % n]; return sum + y * z2 - y2 * z; }, 0), sign = signed > 0 ? 1 : -1;
  const normals = outline.map((_, i) => {
    const a = points[i], b = points[(i + 1) % n], dy = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dy, dz) || 1;
    return [sign * dz / l, -sign * dy / l];
  });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, own = normals[i];
    const blend = other => own[0] * other[0] + own[1] * other[1] > CREASE_COS ? [own[0] + other[0], own[1] + other[1]] : own;
    const ni = blend(normals[(i - 1 + n) % n]), nj = blend(normals[j]);
    const a = builder.vertex(at(points[i], x0), [0, ...ni]), b = builder.vertex(at(points[j], x0), [0, ...nj]);
    const c = builder.vertex(at(points[j], x1), [0, ...nj]), d = builder.vertex(at(points[i], x1), [0, ...ni]);
    builder.quad(a, b, c, d);
  }
  const triangles = triangulate(points);
  for (const [x, nx] of [[x0, -1], [x1, 1]]) {
    const ids = points.map(point => builder.vertex(at(point, x), [nx, 0, 0]));
    for (const [a, b, c] of triangles) builder.triangle(ids[a], ids[b], ids[c]);
  }
  return builder;
}

/** Axis-aligned box from min/max corners. */
export function box(min, max, { builder = new MeshBuilder() } = {}) {
  const corner = (i, j, k) => [[min[0], max[0]][i], [min[1], max[1]][j], [min[2], max[2]][k]];
  const faces = [
    [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]], [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
    [[0, 1, 0], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]], [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]], [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]],
  ];
  for (const [normal, quad] of faces) builder.quad(...quad.map(([i, j, k]) => builder.vertex(corner(i, j, k), normal)));
  return builder;
}

/** UV sphere with enough bands to stay below the crease angle. */
export function sphere(radius, centre = [0, 0, 0], { builder = new MeshBuilder(), around = 18, bands = 10 } = {}) {
  const rows = [];
  for (let j = 0; j <= bands; j++) {
    const theta = Math.PI * j / bands, row = [];
    for (let i = 0; i <= around; i++) {
      const phi = TAU * i / around, n = [Math.cos(theta), Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi)];
      row.push(builder.vertex(n.map((v, k) => centre[k] + radius * v), n));
    }
    rows.push(row);
  }
  for (let j = 0; j < bands; j++) for (let i = 0; i < around; i++) builder.quad(rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]);
  return builder;
}

/** Stadium outline around two axis centres on Y, sampled by polar angle about
 * their midpoint. Returns [y, z] points relative to that midpoint. The stadium
 * is every point within `radius` of the segment y ∈ [−halfSpan, halfSpan], so a
 * ray's distance to that segment grows monotonically: bisection is exact enough. */
export function stadium(halfSpan, radius, samples = 96) {
  const distance = (y, z) => Math.hypot(y - Math.max(-halfSpan, Math.min(halfSpan, y)), z);
  return Array.from({ length: samples }, (_, i) => {
    const angle = TAU * i / samples, dy = Math.cos(angle), dz = Math.sin(angle);
    let low = 0, high = halfSpan + radius;
    for (let k = 0; k < 60; k++) { const mid = (low + high) / 2; if (distance(dy * mid, dz * mid) < radius) low = mid; else high = mid; }
    return { angle, point: [dy * low, dz * low] };
  });
}
