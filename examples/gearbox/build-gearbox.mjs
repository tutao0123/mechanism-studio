/** Build the original teaching gearbox: GLB, scene contract, scene index and
 * report, deterministically from spec.mjs. Run: node examples/gearbox/build-gearbox.mjs */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeGlb } from '../../shared/assets/write-glb.mjs';
import { readGlb, sha256, boundsOf } from '../../shared/assets/glb.mjs';
import { validateSceneContract } from '../../shared/assets/contract.mjs';
import * as spec from './spec.mjs';
import { gearPhases, KINEMATICS_REVISION } from './kinematics.mjs';
import { MeshBuilder, lathe, gearOutline, splineOutline, circleLike, ringExtrude, extrudePolygon, box, sphere, stadium } from './geometry.mjs';

const { LAYOUT, SHAFTS, SYNCHROS, BEARINGS, CASE, TEETH, AXES, HUB_WIDTH, SLEEVE_WIDTH, RING_WIDTH, SPLINE_TEETH } = spec;
const root = path.dirname(fileURLToPath(import.meta.url));
const phases = gearPhases();
const TAU = 2 * Math.PI;

// ---------- hierarchy ----------
const assemblies = [], parts = [], definitions = new Map();
function assembly(id, name, parentId, translation) { assemblies.push({ id: `gb-asm:${id}`, name, parentId: parentId && `gb-asm:${parentId}`, translation }); }
/** A part occurrence. `definition` names reusable geometry; `build` makes it once. */
function part(id, name, parentId, translation, { role = 'static', group, definition = id, build }) {
  if (!definitions.has(definition)) definitions.set(definition, { id: definition, builder: build() });
  parts.push({ id: `gb:${id}`, name, parentId: `gb-asm:${parentId}`, translation, role, group, definition });
}

const gearMesh = (key, x0, x1, { bore, dog, synchro }) => {
  const b = new MeshBuilder(), outline = gearOutline(TEETH[key], { phase: phases[key] });
  ringExtrude(outline, circleLike(outline, bore), x0, x1, { builder: b });
  if (dog) {
    const spline = SYNCHROS[synchro].spline, dogOutline = splineOutline(SPLINE_TEETH, spline, spline - 0.0025);
    ringExtrude(dogOutline, circleLike(dogOutline, bore), dog[0], dog[1], { builder: b });
  }
  return b;
};
const ring = (x0, x1, inner, outer) => lathe([[x0, inner], [x1, inner], [x1, outer], [x0, outer]]);

assembly('gearbox', 'Five-speed teaching gearbox', null, [0, 0, 0]);

// Input shaft: shaft, constant-mesh gear and 4th-gear dog ring are one forging.
assembly('input', 'Input shaft assembly', 'gearbox', [0, 0, 0]);
{
  const c = LAYOUT.input.teethCentre, r = SHAFTS.input.radius, half = LAYOUT.input.teethWidth / 2;
  part('input/shaft', 'Input shaft', 'input', [c, 0, 0], { role: 'spin:input', group: 'input', build: () => {
    const b = lathe([[LAYOUT.inputStart - c, 0], [LAYOUT.inputStart - c, r - .002], [LAYOUT.inputStart + .06 - c, r - .002], [LAYOUT.inputStart + .062 - c, r], [-half, r], [-half, 0]]);
    const outline = gearOutline(TEETH.input, { phase: phases.input });
    ringExtrude(outline, circleLike(outline, r - .001), -half, half, { builder: b });
    const spline = SYNCHROS.s34.spline, dog = splineOutline(SPLINE_TEETH, spline, spline - .0025);
    ringExtrude(dog, circleLike(dog, r - .001), LAYOUT.input.dogRange[0] - c, LAYOUT.input.dogRange[1] - c, { builder: b });
    return b;
  } });
}

function bearing(key, parentId, group) {
  const bearing = BEARINGS[key], g = spec.bearingGeometry(bearing), w = bearing.width / 2;
  const asmId = `${parentId}/bearing-${key}`;
  assembly(asmId, `${bearing.id} ball bearing`, parentId, [bearing.x, 0, 0]);
  part(`${asmId}/inner`, 'Inner race', asmId, [0, 0, 0], { role: `spin:inner:${key}`, group, definition: `race-inner-${key}`, build: () => ring(-w, w, bearing.bore, g.innerRace) });
  part(`${asmId}/outer`, 'Outer race', asmId, [0, 0, 0], { role: 'static', group, definition: `race-outer-${key}`, build: () => ring(-w, w, g.outerRace, bearing.outer) });
  for (let k = 0; k < bearing.balls; k++) {
    const angle = TAU * k / bearing.balls;
    part(`${asmId}/ball-${k + 1}`, `Ball ${k + 1}`, asmId, [0, g.pitch * Math.cos(angle), g.pitch * Math.sin(angle)],
      { role: `spin:cage:${key}`, group: `${group}:balls`, definition: `ball-${key}`, build: () => sphere(g.ball / 2) });
  }
}
bearing('input', 'input', 'input-bearing');

// Mainshaft: free-running gears on needle bearings, three synchronizers.
assembly('main', 'Mainshaft assembly', 'gearbox', [0, 0, 0]);
{
  const r = SHAFTS.main.radius, start = LAYOUT.input.x1 + .001, rear = BEARINGS.rear.x + BEARINGS.rear.width / 2;
  const mid = LAYOUT.s12.centre;
  part('main/shaft', 'Mainshaft', 'main', [mid, 0, 0], { role: 'spin:output', group: 'mainshaft', build: () =>
    lathe([[start - mid, 0], [start - mid, r - .002], [start + .002 - mid, r], [rear - mid, r], [rear - mid, r - .002], [LAYOUT.mainEnd - mid, r - .002], [LAYOUT.mainEnd - mid, 0]]) });
  const synchroFor = { main3: 's34', main2: 's12', main1: 's12', mainR: 's5r', main5: 's5r' };
  for (const key of ['main3', 'main2', 'main1', 'mainR', 'main5']) {
    const L = LAYOUT[key], c = L.teethCentre, half = L.teethWidth / 2, label = { main3: '3rd', main2: '2nd', main1: '1st', mainR: 'Reverse', main5: '5th' }[key];
    part(`main/gear-${key.slice(4).toLowerCase()}`, `${label} gear`, 'main', [c, 0, 0], { role: `spin:${key}`, group: `gear:${key}`,
      build: () => gearMesh(key, -half, half, { bore: r + .003, dog: [L.dogRange[0] - c, L.dogRange[1] - c], synchro: synchroFor[key] }) });
    part(`main/needle-${key.slice(4).toLowerCase()}`, `${label} gear needle bearing`, 'main', [c, 0, 0], { role: `needle:${key}`, group: `gear:${key}`,
      build: () => ring(L.x0 - c + .001, L.x1 - c - .001, r + .0002, r + .0028) });
  }
  for (const [id, gapStart, gapEnd] of [['washer-23', LAYOUT.main3.x1, LAYOUT.main2.x0], ['washer-1r', LAYOUT.main1.x1, LAYOUT.mainR.x0]]) {
    const c = (gapStart + gapEnd) / 2;
    part(`main/${id}`, 'Thrust washer', 'main', [c, 0, 0], { role: 'spin:output', group: `washer:${id}`, definition: 'thrust-washer',
      build: () => ring(-.002, .002, r + .0002, .030) });
  }
  for (const synchro of Object.values(SYNCHROS)) {
    const s = synchro.id, spline = synchro.spline, asmId = `main/synchro-${s}`, half = HUB_WIDTH / 2;
    assembly(asmId, `${synchro.label} synchronizer`, 'main', [LAYOUT[s].centre, 0, 0]);
    part(`${asmId}/hub`, 'Synchronizer hub', asmId, [0, 0, 0], { role: 'spin:output', group: `synchro:${s}`, definition: `hub-${s}`, build: () => {
      const outline = splineOutline(SPLINE_TEETH, spline, spline - .0025);
      return ringExtrude(outline, circleLike(outline, r + .0002), -half, half);
    } });
    part(`${asmId}/sleeve`, 'Synchronizer sleeve', asmId, [0, 0, 0], { role: `sleeve:${s}`, group: `synchro:${s}:sleeve`, definition: `sleeve-${s}`, build: () => {
      const inner = splineOutline(SPLINE_TEETH, spline - .002, spline + .0005, { inward: true }), w = SLEEVE_WIDTH / 2;
      const b = ringExtrude(circleLike(inner, spline + .0045), inner, -w, w);
      for (const [x0, x1] of [[-w, -.0035], [.0035, w]]) lathe([[x0, spline + .004], [x1, spline + .004], [x1, spline + .012], [x0, spline + .012]], { builder: b });
      return b;
    } });
    for (const side of [-1, 1]) {
      const x = side * (half + .0005 + RING_WIDTH / 2);
      part(`${asmId}/ring-${side < 0 ? 'front' : 'rear'}`, `Blocker ring (${side < 0 ? 'front' : 'rear'})`, asmId, [x, 0, 0],
        { role: `ring:${s}:${side}`, group: `synchro:${s}:ring${side}`, definition: `ring-${s}`, build: () => {
          const outline = splineOutline(SPLINE_TEETH, spline, spline - .0025);
          return ringExtrude(outline, circleLike(outline, spline - .007), -RING_WIDTH / 2, RING_WIDTH / 2);
        } });
    }
    for (let k = 0; k < 3; k++) {
      const angle = TAU * k / 3 + TAU / 12;
      part(`${asmId}/key-${k + 1}`, `Synchronizer key ${k + 1}`, asmId, [0, 0, 0], { role: `key:${s}`, group: `synchro:${s}:keys`, definition: `key-${s}-${k + 1}`, build: () => {
        const b = new MeshBuilder(), rIn = spline - .0045, rOut = spline - .0012, t = .0025;
        const local = box([-.008, rIn, -t], [.008, rOut, t]);
        const c = Math.cos(angle), sn = Math.sin(angle);
        return b.append(local, ([x, y, z]) => [x, y * c - z * sn, y * sn + z * c], ([x, y, z]) => [x, y * c - z * sn, y * sn + z * c]);
      } });
    }
  }
  part('main/output-flange', 'Output flange', 'main', [LAYOUT.mainEnd - .012, 0, 0], { role: 'spin:output', group: 'output', build: () =>
    lathe([[-.018, r - .0015], [-.002, r - .0015], [-.002, .022], [-.018, .022]]).append(lathe([[0, r - .0015], [.009, r - .0015], [.009, .047], [0, .047]])) });
}
bearing('rear', 'main', 'rear-bearing');

// Countershaft cluster: every gear is pressed on and turns with the shaft.
assembly('counter', 'Countershaft assembly', 'gearbox', [0, AXES.counter[0], AXES.counter[1]]);
{
  const r = SHAFTS.counter.radius, x0 = LAYOUT.frontWall[0] + .002, x1 = LAYOUT.rearWall[1] - .002, mid = (x0 + x1) / 2;
  part('counter/shaft', 'Countershaft', 'counter', [mid, 0, 0], { role: 'spin:counter', group: 'counter', build: () => ring(x0 - mid, x1 - mid, 0, r) });
  const placements = [['counterDrive', 'input', 'Countershaft drive gear'], ['counter3', 'main3', 'Countershaft 3rd gear'], ['counter2', 'main2', 'Countershaft 2nd gear'],
    ['counter1', 'main1', 'Countershaft 1st gear'], ['counterR', 'mainR', 'Countershaft reverse gear'], ['counter5', 'main5', 'Countershaft 5th gear']];
  for (const [key, mate, name] of placements) {
    const L = LAYOUT[mate], half = L.teethWidth / 2;
    part(`counter/gear-${key.replace('counter', '').toLowerCase() || 'drive'}`, name, 'counter', [L.teethCentre, 0, 0], { role: 'spin:counter', group: 'counter',
      build: () => gearMesh(key, -half, half, { bore: r - .0002 }) });
  }
}
// The countershaft bearings live in the countershaft frame (on its axis).
for (const key of ['counterFront', 'counterRear']) bearing(key, 'counter', 'counter-bearing');

// Reverse idler: a fixed shaft and a gear that reverses the countershaft.
assembly('idler', 'Reverse idler assembly', 'gearbox', [0, AXES.idler[0], AXES.idler[1]]);
{
  const L = LAYOUT.mainR, c = L.teethCentre, half = L.teethWidth / 2, r = SHAFTS.idler.radius;
  part('idler/shaft', 'Reverse idler shaft', 'idler', [c, 0, 0], { role: 'static', group: 'idler', build: () => ring(-half - .014, half + .014, 0, r) });
  part('idler/gear', 'Reverse idler gear', 'idler', [c, 0, 0], { role: 'spin:idler', group: 'idler', build: () => gearMesh('idler', -half, half, { bore: r + .0025 }) });
  part('idler/needle', 'Reverse idler needle bearing', 'idler', [c, 0, 0], { role: 'needle:idler', group: 'idler', build: () => ring(-half + .001, half - .001, r + .0002, r + .0023) });
}

// Shift mechanism: three rails and forks; each fork rides in its sleeve groove.
assembly('shift', 'Shift mechanism', 'gearbox', [0, 0, 0]);
{
  const x0 = LAYOUT.frontWall[1] + .004, x1 = LAYOUT.rearWall[0] - .004, mid = (x0 + x1) / 2;
  for (const synchro of Object.values(SYNCHROS)) {
    const s = synchro.id, [yr, zr] = synchro.rail, spline = synchro.spline, centre = LAYOUT[s].centre;
    part(`shift/rail-${s}`, `${synchro.label} shift rail`, 'shift', [mid, yr, zr], { role: `rail:${s}`, group: 'shift', build: () => ring(x0 - mid, x1 - mid, 0, .0055) });
    part(`shift/fork-${s}`, `${synchro.label} shift fork`, 'shift', [centre, 0, 0], { role: `fork:${s}`, group: 'shift', build: () => {
      const rIn = spline + .0047, rOut = spline + .0175, span = 65 * Math.PI / 180, steps = 24, arc = [];
      for (let i = 0; i <= steps; i++) { const a = -span + 2 * span * i / steps; arc.push([rOut * Math.cos(a), rOut * Math.sin(a)]); }
      for (let i = steps; i >= 0; i--) { const a = -span + 2 * span * i / steps; arc.push([rIn * Math.cos(a), rIn * Math.sin(a)]); }
      const b = extrudePolygon(arc, -.003, .003);
      const base = rOut - .004, dir = [yr - base, zr], len = Math.hypot(...dir), n = [-dir[1] / len * .0055, dir[0] / len * .0055];
      extrudePolygon([[base + n[0], n[1]], [yr + n[0], zr + n[1]], [yr - n[0], zr - n[1]], [base - n[0], -n[1]]], -.005, .005, { builder: b });
      lathe([[-.009, .0057], [.009, .0057], [.009, .0105], [-.009, .0105]], { builder: b, offset: [0, yr, zr] });
      return b;
    } });
  }
}

// Case: shell, end plates, bell housing, rear extension, cover, lever and bolts.
assembly('case', 'Gearbox case', 'gearbox', [0, 0, 0]);
{
  const half = spec.CENTRE_DISTANCE / 2, mid = -half, R = CASE.radius, [f0, f1] = LAYOUT.frontWall, [r0, r1] = LAYOUT.rearWall;
  part('case/main-case', 'Main case', 'case', [(f1 + r0) / 2, mid, 0], { group: 'case:shell', build: () => {
    const outer = stadium(half, R), inner = stadium(half, R - CASE.wall), w = (r0 - f1) / 2;
    return ringExtrude(outer, inner, -w, w);
  } });
  const plate = (id, name, a, b) => part(`case/${id}`, name, 'case', [(a + b) / 2, mid, 0], { group: `case:${id}`, definition: 'end-plate', build: () =>
    extrudePolygon(stadium(half, R + CASE.plateMargin).map(({ point }) => point), -(b - a) / 2, (b - a) / 2) });
  plate('front-plate', 'Front plate', f0, f1); plate('rear-plate', 'Rear plate', r0, r1);
  part('case/bell-housing', 'Bell housing', 'case', [f0, 0, 0], { group: 'case:bell', build: () =>
    lathe([[LAYOUT.bellStart - f0, .165], [LAYOUT.bellStart - f0, .159], [0, .094], [0, .100]]) });
  const extEnd = LAYOUT.mainEnd - .022;
  part('case/rear-extension', 'Rear extension', 'case', [r1, 0, 0], { group: 'case:extension', build: () =>
    lathe([[0, .044], [extEnd - r1, .028], [extEnd - r1, .034], [0, .052]]) });
  const coverX0 = LAYOUT.s34.x0 - .012, coverX1 = LAYOUT.s5r.x1 + .012, coverMid = (coverX0 + coverX1) / 2;
  part('case/top-cover', 'Top cover', 'case', [coverMid, R, 0], { group: 'case:cover', build: () => box([coverX0 - coverMid, -.003, -.05], [coverX1 - coverMid, .007, .05]) });
  part('case/shift-lever', 'Shift lever', 'case', [LAYOUT.s12.centre, R + .007, 0], { role: 'lever', group: 'case:cover', build: () => {
    const upright = new MeshBuilder();
    const toY = ([x, y, z]) => [-y, x, z];
    upright.append(lathe([[0, .0], [0, .016], [.011, .010], [.105, .0055], [.105, 0]]), toY, toY);
    upright.append(sphere(.0145, [.112, 0, 0]), toY, toY);
    return upright;
  } });
  assembly('case/fasteners', 'Case bolts', 'case', [0, 0, 0]);
  const holes = stadium(half, R + CASE.plateMargin / 2, 10).map(({ point }) => [point[0] + mid, point[1]]);
  holes.forEach(([y, z], k) => {
    part(`case/fasteners/front-bolt-${k + 1}`, `Front bolt ${k + 1}`, 'case/fasteners', [f1, y, z], { group: 'case:bolts', definition: 'bolt-front', build: () => {
      const hex = Array.from({ length: 6 }, (_, i) => [.0046 * Math.cos(TAU * i / 6 + Math.PI / 6), .0046 * Math.sin(TAU * i / 6 + Math.PI / 6)]);
      return extrudePolygon(hex, .001, .0055).append(ring(0, .001, 0, .0058));
    } });
    part(`case/fasteners/rear-bolt-${k + 1}`, `Rear bolt ${k + 1}`, 'case/fasteners', [r0, y, z], { group: 'case:bolts', definition: 'bolt-rear', build: () => {
      const hex = Array.from({ length: 6 }, (_, i) => [.0046 * Math.cos(TAU * i / 6 + Math.PI / 6), .0046 * Math.sin(TAU * i / 6 + Math.PI / 6)]);
      return extrudePolygon(hex, -.0055, -.001).append(ring(-.001, 0, 0, .0058));
    } });
  });
}

// ---------- world transforms and outputs ----------
const asmById = new Map(assemblies.map(a => [a.id, a]));
const worldTranslation = id => {
  const a = asmById.get(id); if (!a) throw new Error(`Unknown assembly ${id}`);
  const parent = a.parentId ? worldTranslation(a.parentId) : [0, 0, 0];
  return a.translation.map((v, i) => v + parent[i]);
};
const matrix = t => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1];
const definitionIndex = new Map([...definitions.keys()].map((id, i) => [id, i]));
const meshes = [...definitions.values()].map(({ id, builder }) => ({ name: id, positions: builder.positions, normals: builder.normals, indices: builder.indices, color: [1, 1, 1], extras: { definitionId: `gb-def:${id}` } }));
const nodes = [], nodeIndex = new Map();
for (const a of assemblies) { nodeIndex.set(a.id, nodes.length); nodes.push({ name: a.name, matrix: matrix(a.translation), children: [], extras: { assembly_id: a.id } }); }
for (const p of parts) {
  nodeIndex.set(p.id, nodes.length);
  const owner = p.role === 'static' ? 'static' : 'model';
  nodes.push({ name: p.name, matrix: matrix(p.translation), mesh: definitionIndex.get(p.definition), extras: { part_id: p.id, motionOwner: owner, definitionId: `gb-def:${p.definition}`, role: p.role } });
}
for (const record of [...assemblies, ...parts]) if (record.parentId) nodes[nodeIndex.get(record.parentId)].children.push(nodeIndex.get(record.id));
for (const node of nodes) if (node.children && !node.children.length) delete node.children;

const sceneParts = parts.map(p => {
  const parentWorld = worldTranslation(p.parentId), world = p.translation.map((v, i) => v + parentWorld[i]);
  const { builder } = definitions.get(p.definition), points = [];
  for (let i = 0; i < builder.positions.length; i += 3) points.push([builder.positions[i], builder.positions[i + 1], builder.positions[i + 2]]);
  const localBounds = boundsOf(points), worldBounds = { min: localBounds.min.map((v, i) => v + world[i]), max: localBounds.max.map((v, i) => v + world[i]) };
  return { id: p.id, name: p.name, parentId: p.parentId, role: p.role, group: p.group, motionOwner: p.role === 'static' ? 'static' : 'model', definitionId: `gb-def:${p.definition}`,
    localMatrix: matrix(p.translation), worldMatrix: matrix(world), localBounds, worldBounds, worldCenter: worldBounds.min.map((v, i) => (v + worldBounds.max[i]) / 2), triangleCount: builder.triangleCount };
});
const sceneAssemblies = assemblies.map(a => ({ id: a.id, name: a.name, parentId: a.parentId, children: [...assemblies.filter(c => c.parentId === a.id), ...parts.filter(c => c.parentId === a.id)].map(c => c.id),
  localMatrix: matrix(a.translation), worldMatrix: matrix(worldTranslation(a.id)) }));
const depth = id => { let d = 0; for (let a = asmById.get(id); a?.parentId; a = asmById.get(a.parentId)) d++; return d; };

const specIdentity = JSON.stringify({ spec: spec.SPEC_REVISION, kinematics: KINEMATICS_REVISION, teeth: TEETH, layout: LAYOUT, synchros: SYNCHROS, bearings: BEARINGS, case: CASE });
const geometryRevision = `gearbox-${sha256(Buffer.from(specIdentity)).slice(0, 12)}-display-1`;
const contract = { schemaVersion: '1.0.0', mechanismId: 'teaching-gearbox-5r', assetRevision: geometryRevision,
  units: { source: 'authored metres and radians', asset: 'm', angle: 'rad' }, coordinateMap: 'glTF metres, right-handed, +Y up; shafts along +X from the engine side (−X) to the output (+X)',
  identity: 'part_id is gb:<assembly path>/<part>; assembly_id is gb-asm:<path>. Repeated occurrences share a gb-def mesh definition.',
  limitations: spec.LIMITATIONS,
  parts: parts.map(p => ({ part_id: p.id, parent_id: p.parentId, label: p.name, motionOwner: p.role === 'static' ? 'static' : 'model', rest: { matrix: matrix(p.translation) }, explode: [0, 0, 0], role: p.role, definitionId: `gb-def:${p.definition}` })) };
const glb = writeGlb({ nodes, meshes, scenes: [{ name: 'Teaching gearbox, neutral at rest', nodes: [nodeIndex.get('gb-asm:gearbox')] }],
  extras: { geometryRevision, units: 'm', specRevision: spec.SPEC_REVISION, kinematicsRevision: KINEMATICS_REVISION, license: 'MIT (original Mechanism Studio teaching model)' },
  generator: 'Mechanism Studio teaching gearbox exporter 1' });
validateSceneContract(readGlb(glb).json, contract);
const glbHash = sha256(glb), allBounds = boundsOf(sceneParts.flatMap(p => [p.worldBounds.min, p.worldBounds.max]));
const index = { schemaVersion: '1.0.0', geometryRevision, units: 'm', coordinateBasis: contract.coordinateMap, rootId: 'gb-asm:gearbox',
  source: { title: 'Five-speed teaching gearbox', author: 'Mechanism Studio', license: 'MIT', specRevision: spec.SPEC_REVISION, kinematicsRevision: KINEMATICS_REVISION },
  asset: { file: 'assets/gearbox.glb', sha256: glbHash, assembledWorldBounds: allBounds }, parts: sceneParts, assemblies: sceneAssemblies,
  boundsMethod: 'Exact vertex bounds of each authored definition translated by its occurrence; assemblies are pure translations.', limitations: spec.LIMITATIONS };
const report = { schemaVersion: '1.0.0', mechanismId: contract.mechanismId, geometryRevision, glbSHA256: glbHash, glbBytes: glb.length,
  partCount: parts.length, assemblyCount: assemblies.length, maximumAssemblyDepth: Math.max(...assemblies.map(a => depth(a.id))) + 1,
  definitionCount: definitions.size, movingPartCount: parts.filter(p => p.role !== 'static').length,
  triangleCount: sceneParts.reduce((sum, p) => sum + p.triangleCount, 0), uniqueTriangleCount: meshes.reduce((sum, m) => sum + m.indices.length / 3, 0),
  ratios: Object.fromEntries(Object.entries(spec.GEARS).map(([k, g]) => [k, Number(g.ratio.toFixed(6))])), centreDistance: spec.CENTRE_DISTANCE, assetBoundsMeters: allBounds, limitations: spec.LIMITATIONS };
await mkdir(path.join(root, 'assets'), { recursive: true });
await writeFile(path.join(root, 'assets/gearbox.glb'), glb);
const provenance = { schemaVersion: '1.0.0', kind: 'original-teaching-model', title: 'Five-speed teaching gearbox', author: 'Mechanism Studio', license: 'MIT',
  revision: `${spec.SPEC_REVISION}+${KINEMATICS_REVISION}`, generator: 'examples/gearbox/build-gearbox.mjs', inputs: ['examples/gearbox/spec.mjs', 'examples/gearbox/kinematics.mjs', 'examples/gearbox/geometry.mjs'],
  note: 'Authored from first principles for teaching. No third-party CAD, mesh or drawing is used.' };
for (const [file, value] of [['scene-contract.json', contract], ['scene-index.json', index], ['build-report.json', report], ['provenance.json', provenance]]) await writeFile(path.join(root, 'assets', file), `${JSON.stringify(value, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
