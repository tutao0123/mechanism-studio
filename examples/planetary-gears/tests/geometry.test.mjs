import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, DoubleSide, Raycaster, Vector3, Triangle } from 'three';
import { readGlb, accessorValues, semanticNodes, boundsOf, sha256 } from '../../../shared/assets/glb.mjs';
import { validateSceneContract } from '../../../shared/assets/contract.mjs';
import { PARTS, ROOT_ID, MODULE, GEAR_SPEC, DIMENSIONS, HOUSING, SUPPORT_BEARINGS } from '../spec.mjs';
import { gearProfile, bearingGrooveRadius } from '../geometry.mjs';

const assets = new URL('../assets/', import.meta.url);
const bytes = await readFile(new URL('assembly.glb', assets)), { json, buffer } = readGlb(bytes);
const index = JSON.parse(await readFile(new URL('scene-index.json', assets), 'utf8'));
const contract = JSON.parse(await readFile(new URL('scene-contract.json', assets), 'utf8'));
const provenance = JSON.parse(await readFile(new URL('provenance.json', assets), 'utf8'));
const nodes = semanticNodes(json);
const epsilon = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function meshFor(id) {
  const primitive = json.meshes[nodes.get(id).mesh].primitives[0], geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(accessorValues(json, buffer, primitive.attributes.POSITION).flat(), 3));
  geometry.setIndex(accessorValues(json, buffer, primitive.indices).flat());
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide })); mesh.updateMatrixWorld(); return mesh;
}
function hitsAt(mesh, x, y) { return new Raycaster(new Vector3(x, y, 1), new Vector3(0, 0, -1)).intersectObject(mesh); }

test('planetary asset retains 80 real occurrences, one actual assembly and shared repeated definitions', () => {
  validateSceneContract(json, contract);
  assert.equal(nodes.size, 80); assert.equal(index.parts.length, 80); assert.equal(index.assemblies.length, 1);
  assert.equal(index.rootId, ROOT_ID); assert.equal(index.units, 'm');
  assert.deepEqual(index.assemblies[0].children, PARTS.map(p => p.id));
  for (const p of PARTS) {
    const record = index.parts.find(x => x.id === p.id), node = nodes.get(p.id);
    assert.equal(record.parentId, ROOT_ID); assert.equal(node.extras.definitionId, p.definitionId);
    assert.deepEqual(node.matrix, record.localMatrix); assert.deepEqual(record.localMatrix, record.worldMatrix);
    assert.deepEqual(record.localMatrix.slice(12, 15), p.translation);
  }
  assert.equal(nodes.get('pg:planet-1').mesh, nodes.get('pg:planet-3').mesh);
  assert.equal(nodes.get('pg:carrier-front').mesh, nodes.get('pg:carrier-rear').mesh);
  assert.equal(nodes.get('pg:screw-1').mesh, nodes.get('pg:screw-3').mesh);
  assert.equal(nodes.get('pg:support-bearing-front-ball-1').mesh, nodes.get('pg:support-bearing-front-ball-10').mesh);
  assert.notEqual(nodes.get('pg:support-bearing-front-ball-1').mesh, nodes.get('pg:support-bearing-rear-ball-1').mesh);
  assert.equal(index.parts.filter(p => p.bearingElement === 'ball').length, 20);
});

test('actual binary mesh has finite attributes, valid topology references and outward triangle winding', () => {
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    const P = accessorValues(json, buffer, primitive.attributes.POSITION), N = accessorValues(json, buffer, primitive.attributes.NORMAL);
    const I = accessorValues(json, buffer, primitive.indices).flat();
    assert.equal(I.length % 3, 0); assert.ok(P.every(p => p.every(Number.isFinite))); assert.ok(N.every(n => n.every(Number.isFinite)));
    assert.ok(I.every(i => Number.isInteger(i) && i >= 0 && i < P.length));
    for (let i = 0; i < I.length; i += 3) {
      const [a, b, c] = I.slice(i, i + 3), u = P[b].map((v, j) => v - P[a][j]), v = P[c].map((v, j) => v - P[a][j]);
      const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      assert.ok(Math.hypot(...cross) > 1e-18, `${mesh.name} has nonzero triangle area`);
      const intended = N[a].map((v, j) => v + N[b][j] + N[c][j]);
      assert.ok(cross.reduce((s, v, j) => s + v * intended[j], 0) >= -1e-13, `${mesh.name} winding agrees with normals`);
    }
  }
});

test('source fingerprints, GLB hash and vertex bounds describe the files actually shipped', async () => {
  assert.equal(index.asset.sha256, sha256(bytes)); assert.equal(json.extras.geometryRevision, index.geometryRevision);
  for (const source of provenance.inputFingerprints) {
    const actual = await readFile(new URL(`../../../${source.file}`, import.meta.url));
    // Resolve from the repository root, not from source strings in the browser.
    assert.equal(sha256(actual), source.sha256);
  }
  for (const p of index.parts) {
    const primitive = json.meshes[nodes.get(p.id).mesh].primitives[0], bounds = boundsOf(accessorValues(json, buffer, primitive.attributes.POSITION));
    for (const side of ['min', 'max']) for (let k = 0; k < 3; k++) {
      epsilon(bounds[side][k], p.localBounds[side][k]); epsilon(bounds[side][k] + p.translation[k], p.worldBounds[side][k]);
    }
  }
});

test('involute boundary dimensions and internal/external phase meanings are explicit', () => {
  const ext = gearProfile(24), internal = gearProfile(72, { internal: true, phase: GEAR_SPEC.ringGapPhase });
  epsilon(Math.max(...ext.map(p => p.radius)), MODULE * 24 / 2 + MODULE);
  epsilon(Math.min(...ext.map(p => p.radius)), MODULE * 24 / 2 - 1.25 * MODULE);
  epsilon(Math.min(...internal.map(p => p.radius)), .070); epsilon(Math.max(...internal.map(p => p.radius)), .0745);
  assert.ok(ext.every((p, i) => i === 0 || p.angle >= ext[i - 1].angle));
  assert.ok(internal.every((p, i) => i === 0 || p.angle >= internal[i - 1].angle));
});

test('bores, carrier pin holes and screw sockets are actual geometry, with correctly phased ring teeth', () => {
  const sun = meshFor('pg:sun'), ring = meshFor('pg:ring'), carrier = meshFor('pg:carrier-front'), screw = meshFor('pg:screw-1');
  assert.equal(hitsAt(sun, 0, 0).length, 0);
  assert.ok(hitsAt(sun, .025, 0).length > 0);
  assert.equal(hitsAt(sun, .025 * Math.cos(Math.PI / 24), .025 * Math.sin(Math.PI / 24)).length, 0);
  assert.equal(hitsAt(ring, 0, 0).length, 0);
  assert.ok(hitsAt(ring, .071, 0).length > 0, 'ring material tooth at +X');
  assert.equal(hitsAt(ring, .071 * Math.cos(Math.PI / 72), .071 * Math.sin(Math.PI / 72)).length, 0, 'ring gap at π/72');
  assert.equal(hitsAt(carrier, 0, 0).length, 0); assert.equal(hitsAt(carrier, .048, 0).length, 0);
  assert.ok(hitsAt(carrier, .03, 0).length > 0, 'carrier web remains solid');
  const socket = hitsAt(screw, 0, 0)[0]; assert.ok(socket); epsilon(socket.point.z, .0007);
  const head = hitsAt(screw, .002, 0)[0]; epsilon(head.point.z, .0026);
  assert.equal(hitsAt(meshFor('pg:bearing-1'), 0, 0).length, 0);
  assert.ok(DIMENSIONS.bearingOuter < DIMENSIONS.planetBore, 'display journal clearance is explicitly authored');
});

test('housing, gaskets, endplates and seals have genuine bores and separate occurrence identities', () => {
  const housing = meshFor('pg:housing'); assert.equal(hitsAt(housing, 0, 0).length, 0);
  assert.ok(hitsAt(housing, .094, 0).length > 0);
  for (const side of ['front', 'rear']) {
    const plate = meshFor(`pg:endplate-${side}`), gasket = meshFor(`pg:gasket-${side}`), seal = meshFor(`pg:shaft-seal-${side}`);
    assert.equal(hitsAt(plate, 0, 0).length, 0); assert.equal(hitsAt(gasket, 0, 0).length, 0); assert.equal(hitsAt(seal, 0, 0).length, 0);
    assert.ok(hitsAt(plate, .06, 0).length > 0); assert.ok(hitsAt(gasket, .094, 0).length > 0);
    for (let k = 0; k < 6; k++) {
      const a = 2 * Math.PI * (k + .5) / 6, x = HOUSING.boltCircle * Math.cos(a), y = HOUSING.boltCircle * Math.sin(a);
      assert.equal(hitsAt(housing, x, y).length, 0); assert.equal(hitsAt(plate, x, y).length, 0); assert.equal(hitsAt(gasket, x, y).length, 0);
    }
    const b = SUPPORT_BEARINGS[side], inner = meshFor(`pg:support-bearing-${side}-inner`), outer = meshFor(`pg:support-bearing-${side}-outer`);
    assert.equal(hitsAt(inner, 0, 0).length, 0); assert.equal(hitsAt(outer, 0, 0).length, 0);
    const radialHit = (mesh, z, fromOutside = false) => new Raycaster(new Vector3(fromOutside ? .04 : 0, 0, z), new Vector3(fromOutside ? -1 : 1, 0, 0)).intersectObject(mesh)[0]?.point.x;
    epsilon(radialHit(inner, 0, true), b.pitch - b.ballRadius, 1e-7);
    epsilon(radialHit(outer, 0), b.pitch + b.ballRadius, 1e-7);
    assert.ok(radialHit(inner, .003, true) > radialHit(inner, 0, true) + .0005, 'inner race has a concave outer groove');
    assert.ok(radialHit(outer, .003) < radialHit(outer, 0) - .0005, 'outer race has a concave inner groove');
  }
});

function distanceToMesh(mesh, point) {
  const P = mesh.geometry.attributes.position, I = mesh.geometry.index, a = new Vector3(), b = new Vector3(), c = new Vector3(), nearest = new Vector3(), triangle = new Triangle();
  let minimum = Infinity;
  for (let i = 0; i < I.count; i += 3) {
    a.fromBufferAttribute(P, I.getX(i)); b.fromBufferAttribute(P, I.getX(i + 1)); c.fromBufferAttribute(P, I.getX(i + 2));
    triangle.set(a, b, c).closestPointToPoint(point, nearest); minimum = Math.min(minimum, nearest.distanceTo(point));
  }
  return minimum;
}

test('actual support-bearing balls clear their cage and stay within the nominal race mesh tolerance', () => {
  for (const [side, b] of Object.entries(SUPPORT_BEARINGS)) {
    const surfaces = ['inner', 'outer', 'cage'].map(element => meshFor(`pg:support-bearing-${side}-${element}`));
    const ball = meshFor(`pg:support-bearing-${side}-ball-1`), P = ball.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) epsilon(Math.hypot(P.getX(i), P.getY(i), P.getZ(i)), b.ballRadius);
    for (let k = 0; k < b.balls; k++) {
      const a = 2 * Math.PI * k / b.balls, centre = new Vector3(b.pitch * Math.cos(a), b.pitch * Math.sin(a), 0);
      for (const [surface, mesh] of surfaces.entries()) {
        const allowance = surface === 2 ? .000015 : -.00001;
        assert.ok(distanceToMesh(mesh, centre) > b.ballRadius + allowance,
          `${side} ball ${k + 1}: cage clearance or 10 micrometre race tessellation allowance`);
      }
      const p = index.parts.find(p => p.id === `pg:support-bearing-${side}-ball-${k + 1}`);
      assert.equal(p.motionRole, PARTS.find(part => part.id === p.id).motionRole);
      assert.deepEqual(p.translation, [centre.x, centre.y, b.z]);
    }
    const cageId = `pg:support-bearing-${side}-cage`;
    assert.equal(index.parts.find(p => p.id === cageId).motionRole, PARTS.find(part => part.id === cageId).motionRole);
  }
});

test('race profiles meet the nominal ball at alpha=0 and open away from that contact', () => {
  for (const bearing of Object.values(SUPPORT_BEARINGS)) {
    epsilon(bearingGrooveRadius(bearing, 0, 'inner'), bearing.pitch - bearing.ballRadius);
    epsilon(bearingGrooveRadius(bearing, 0, 'outer'), bearing.pitch + bearing.ballRadius);
    for (let k = 1; k < 100; k++) {
      const z = bearing.ballRadius * k / 100;
      const radialBallHalf = Math.sqrt(bearing.ballRadius ** 2 - z ** 2);
      assert.ok(bearingGrooveRadius(bearing, z, 'inner') < bearing.pitch - radialBallHalf);
      assert.ok(bearingGrooveRadius(bearing, z, 'outer') > bearing.pitch + radialBallHalf);
    }
  }
});

test('nominal ball contact stays within the tessellation budget at independently rotating race phases', () => {
  // Both actual race meshes have 128 identical angular sectors. Samples across
  // one complete facet period check representative relative ball/race phases,
  // including inner-race rotation independent of the ball/cage orbit. Use the
  // ball's circumscribed sphere, so every possible ball spin is included.
  for (const [side, bearing] of Object.entries(SUPPORT_BEARINGS)) {
    for (const element of ['inner', 'outer']) {
      const race = meshFor(`pg:support-bearing-${side}-${element}`);
      for (let sample = 0; sample <= 12; sample++) {
        const phase = 2 * Math.PI / 128 * sample / 12;
        const centre = new Vector3(bearing.pitch * Math.cos(phase), bearing.pitch * Math.sin(phase), 0);
        const clearance = distanceToMesh(race, centre) - bearing.ballRadius;
        assert.ok(clearance > -.00001, `${side} ${element} race mesh deviation ${clearance} m at facet phase ${phase}`);
        assert.ok(clearance < .00001, 'The nominal alpha=0 contact only differs by the declared mesh discretization budget');
      }
    }
  }
});

test('v2 fixes the output flange overlap while preserving the original shaft and rest placement', () => {
  const hub = meshFor('pg:output-hub'), hit = hitsAt(hub, .0105, 0)[0];
  epsilon(hit.point.z, .010); // +10 mm local + (-24 mm rest) = rear carrier face -14 mm.
  assert.deepEqual(index.parts.find(p => p.id === 'pg:output-hub').translation, [0, 0, -.024]);
  const rest = index.parts.find(p => p.id === 'pg:carrier-rear');
  epsilon(hit.point.z - .024, rest.worldBounds.min[2], 1e-7);
});
