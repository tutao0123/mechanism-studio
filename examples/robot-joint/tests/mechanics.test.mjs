import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, DoubleSide, Raycaster, Vector3, Matrix4, Quaternion } from 'three';
import { readGlb, accessorValues, semanticNodes, boundsOf, sha256 } from '../../../shared/assets/glb.mjs';
import { validateSceneContract } from '../../../shared/assets/contract.mjs';
import { PARTS, ASSEMBLIES, ROOT_ID, MOTOR_SPEC as M, HOUSING, SUPPORT_BEARINGS, GEAR_SPEC } from '../spec.mjs';
import { createJointRig, motionState, meshPhaseErrors, pitchVelocityResiduals, bearingMotionState, bearingVelocityResiduals, bearingBallPose } from '../kinematics.mjs';
const assets = new URL('../assets/', import.meta.url);
const bytes = await readFile(new URL('assembly.glb', assets)), { json, buffer } = readGlb(bytes);
const index = JSON.parse(await readFile(new URL('scene-index.json', assets), 'utf8'));
const contract = JSON.parse(await readFile(new URL('scene-contract.json', assets), 'utf8'));
const provenance = JSON.parse(await readFile(new URL('provenance.json', assets), 'utf8'));
const nodes = semanticNodes(json), rig = createJointRig(index);
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const record = id => index.parts.find(p => p.id === `rj:${id}`);
function meshFor(id) {
  const primitive = json.meshes[nodes.get(`rj:${id}`).mesh].primitives[0], geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(accessorValues(json, buffer, primitive.attributes.POSITION).flat(), 3));
  geometry.setIndex(accessorValues(json, buffer, primitive.indices).flat());
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide })); mesh.updateMatrixWorld(); return mesh;
}
const hits = (mesh, origin, direction) => new Raycaster(new Vector3(...origin), new Vector3(...direction).normalize()).intersectObject(mesh);
const axial = (mesh, x, y) => hits(mesh, [x, y, 1], [0, 0, -1]);
function localPoints(id) {
  const primitive = json.meshes[nodes.get(id).mesh].primitives[0];
  return accessorValues(json, buffer, primitive.attributes.POSITION);
}
test('original 129-part joint has a truthful nested tree and repeated geometry identity', () => {
  validateSceneContract(json, contract);
  assert.equal(PARTS.length, 129); assert.equal(nodes.size, PARTS.length); assert.equal(index.assemblies.length, 6);
  assert.equal(index.rootId, ROOT_ID); assert.equal(index.units, 'm');
  for (const assembly of ASSEMBLIES) {
    const a = index.assemblies.find(a => a.id === assembly.id), node = json.nodes.find(n => n.extras?.assembly_id === a.id);
    assert.deepEqual(a.children, assembly.children); assert.equal(a.parentId, assembly.parentId);
    assert.deepEqual(node.children.map(i => json.nodes[i].extras?.part_id || json.nodes[i].extras?.assembly_id), a.children);
  }
  for (const p of PARTS) {
    const r = index.parts.find(r => r.id === p.id), node = nodes.get(p.id);
    assert.equal(r.parentId, p.parentId); assert.equal(node.extras.definitionId, p.definitionId);
    assert.deepEqual(node.matrix, r.localMatrix); assert.deepEqual(r.localMatrix, r.worldMatrix);
    assert.deepEqual(r.localMatrix.slice(12, 15), p.translation);
  }
  for (const [first, last] of [['planet-1','planet-3'], ['motor-magnet-1','motor-magnet-14'], ['motor-coil-1','motor-coil-12'], ['motor-bolt-1','motor-bolt-6'], ['support-bearing-front-ball-1','support-bearing-front-ball-10']])
    assert.equal(nodes.get(`rj:${first}`).mesh, nodes.get(`rj:${last}`).mesh);
  assert.notDeepEqual(record('motor-magnet-1').worldMatrix, record('motor-magnet-2').worldMatrix, 'repeated definition retains distinct authored pole phase');
  assert.equal(provenance.kind, 'original-parametric-teaching-model'); assert.equal(provenance.license, 'MIT');
});
test('actual GLB has finite vertices, valid indices and nondegenerate outward triangles', () => {
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    const P = accessorValues(json, buffer, primitive.attributes.POSITION), N = accessorValues(json, buffer, primitive.attributes.NORMAL), I = accessorValues(json, buffer, primitive.indices).flat();
    assert.equal(I.length % 3, 0); assert.ok(P.every(p => p.every(Number.isFinite))); assert.ok(N.every(n => n.every(Number.isFinite)));
    assert.ok(I.every(i => Number.isInteger(i) && i >= 0 && i < P.length));
    for (let i = 0; i < I.length; i += 3) {
      const [a,b,c] = I.slice(i,i+3), u = P[b].map((v,j) => v-P[a][j]), v = P[c].map((v,j) => v-P[a][j]);
      const cross = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]], intended = N[a].map((v,j) => v+N[b][j]+N[c][j]);
      assert.ok(Math.hypot(...cross)>1e-18, `${mesh.name} nonzero face`);
      assert.ok(cross.reduce((s,v,j)=>s+v*intended[j],0)>=-1e-13, `${mesh.name} outward normals`);
    }
  }
});
test('provenance covers reused source helpers and actual rotated-vertex bounds', async () => {
  assert.equal(index.asset.sha256, sha256(bytes)); assert.equal(json.extras.geometryRevision, index.geometryRevision);
  assert.ok(provenance.inputFingerprints.some(p=>p.file==='examples/planetary-gears/geometry.mjs'));
  for (const source of provenance.inputFingerprints) assert.equal(sha256(await readFile(new URL(`../../../${source.file}`, import.meta.url))), source.sha256);
  for (const p of index.parts) {
    const points = localPoints(p.id), local = boundsOf(points), matrix = new Matrix4().fromArray(p.worldMatrix);
    const world = boundsOf(points.map(v=>new Vector3(...v).applyMatrix4(matrix).toArray()));
    for (const side of ['min','max']) for (let k=0;k<3;k++) { near(local[side][k],p.localBounds[side][k],1e-8); near(world[side][k],p.worldBounds[side][k],1e-8); }
  }
});
test('motor coils actually wrap radial teeth and magnetic air gap is positive', () => {
  const coil = meshFor('motor-coil-1');
  assert.equal(hits(coil,[0,0,0],[1,0,0]).length,0,'radial tooth opening is a real hole');
  assert.ok(hits(coil,[0,.0025,0],[1,0,0]).length>0,'winding side wall');
  assert.ok(hits(coil,[0,0,.0114],[1,0,0]).length>0,'axial end turn');
  const magnet = localPoints('rj:motor-magnet-1'), stator = localPoints('rj:motor-stator');
  const magnetOuter = Math.max(...magnet.map(p=>Math.hypot(p[0],p[1]))), statorInner = Math.min(...stator.map(p=>Math.hypot(p[0],p[1])));
  assert.ok(statorInner-magnetOuter>.0005, 'actual faceted magnet and pole-shoe surfaces retain >0.5mm radial air gap');
  near(M.statorInner-M.magnetOuter,M.airGap); assert.equal(M.magnetCount,14); assert.equal(M.coilCount,12);
  const bore = meshFor('motor-rotor'); assert.equal(axial(bore,0,0).length,0);
  assert.ok(axial(bore,.026,0).length>0);
});
test('cap, adapter and output bores clear their actual shafts and existing bolt heads', () => {
  for (const id of ['output-flange','motor-adapter','motor-endcap','motor-tail-bushing','motor-housing','support-bearing-front-inner','support-bearing-rear-inner'])
    assert.equal(axial(meshFor(id),0,0).length,0,`${id} central opening`);
  const flange = meshFor('output-flange');
  for(let k=0;k<6;k++) {const a=2*Math.PI*k/6; assert.equal(axial(flange,.022*Math.cos(a),.022*Math.sin(a)).length,0);}
  const adapter = meshFor('motor-adapter');
  for(let k=0;k<6;k++) {
    const a=2*Math.PI*(k+.5)/6, x=HOUSING.boltCircle*Math.cos(a), y=HOUSING.boltCircle*Math.sin(a);
    assert.equal(axial(adapter,x,y).length,0,'reducer screw head clearance passage');
    assert.equal(axial(adapter,x+.0019*Math.cos(a),y+.0019*Math.sin(a)).length,0,'clearance covers actual screw-head/washer radius');
  }
  const endcap=meshFor('motor-endcap');
  for(let k=0;k<6;k++) {const a=2*Math.PI*k/6;assert.equal(axial(endcap,M.boltCircle*Math.cos(a),M.boltCircle*Math.sin(a)).length,0);}
  const bushing = record('motor-tail-bushing'), shaft=record('motor-shaft');
  assert.ok(shaft.worldBounds.min[2]<bushing.worldBounds.min[2] && shaft.worldBounds.max[2]>bushing.worldBounds.max[2]);
  const input=record('input-shaft'); near(input.worldBounds.max[2],shaft.worldBounds.min[2],1e-8);
  near(record('motor-washer-1').worldBounds.min[2],record('motor-endcap').worldBounds.max[2],1e-8);
  assert.ok(record('encoder-board').worldBounds.max[2]<record('motor-endcap').worldBounds.min[2]);
});
test('motor to sun to carrier preserves 4:1 speed, phase and both ideal gear contacts', () => {
  assert.equal(GEAR_SPEC.ringTeeth,GEAR_SPEC.sunTeeth+2*GEAR_SPEC.planetTeeth);
  assert.equal((GEAR_SPEC.sunTeeth+GEAR_SPEC.ringTeeth)%GEAR_SPEC.planetCount,0);
  for(const a of [-117,-Math.PI,-.2,0,.1,3.6,23,105]) {
    const s=motionState(a); near(s.motorAngle,a);near(s.outputAngle,a/4);near(s.planetAngle,-a/2);
    for(const p of meshPhaseErrors(a)) {near(p.external,0,1e-10);near(p.internal,0,1e-10);}
    const v=pitchVelocityResiduals(a);near(v.external,0);near(v.internal,0);
  }
});
test('race, cage and ball velocities agree at both contacts and keep real ball identity', () => {
  for(const [side,b] of Object.entries(SUPPORT_BEARINGS)) for(const inner of [-7,0,.8,17]) for(const outer of [-.4,0,.7]) {
    const s=bearingMotionState(side,inner,outer), residual=bearingVelocityResiduals(side,inner,outer);
    near(residual.inner,0);near(residual.outer,0);
    for(let k=0;k<b.balls;k++) {
      const p=bearingBallPose(side,k,inner,outer);near(Math.hypot(p.centre[0],p.centre[1]),b.pitch);near(p.centre[2],b.z);near(p.spinAngle,s.ballSpinAngle);
    }
  }
  const s=motionState(1); near(s.bearings.front.innerAngle,1);near(s.bearings.rear.innerAngle,.25);
});
test('model wrappers preserve rotated source rests, independent display offsets and deterministic seeks', () => {
  for(const angle of [0,.15,Math.PI,8.7,-11]) {
    const poses=rig.posesForAngle(angle), world=rig.worldMatrices(angle), bounds=rig.boundsAtAngle(angle);
    for(const part of PARTS) {
      const pose=poses[part.id], model=new Matrix4().compose(new Vector3(...pose.position),new Quaternion(...pose.quaternion),new Vector3(...pose.scale));
      const actual=model.multiply(new Matrix4().fromArray(index.parts.find(p=>p.id===part.id).worldMatrix)).toArray();
      world.get(part.id).toArray().forEach((value,k)=>near(actual[k],value));
      const b=bounds.get(part.id);assert.ok([...b.min,...b.max].every(Number.isFinite));
      if(part.motionRole==='fixed') assert.deepEqual(pose,{position:[0,0,0],quaternion:[0,0,0,1],scale:[1,1,1]});
    }
    assert.deepEqual(poses,rig.workingPoses({sunAngle:angle}));
    rig.posesForAngle(angle+2);assert.deepEqual(poses,rig.posesForAngle(angle));
  }
});
test('rig rejects altered metadata, missing parts, changed rests or incompatible mechanics', () => {
  for(const corrupt of [x=>x.parts.pop(),x=>x.parts[0].worldMatrix[12]+=.001,x=>x.gearSpec.ringTeeth=70,x=>x.supportBearingSpec.front.pitch=.01,x=>x.parts[0].definitionId='false']) {
    const changed=structuredClone(index);corrupt(changed);assert.throws(()=>createJointRig(changed));
  }
  assert.throws(()=>motionState(NaN));assert.throws(()=>rig.posesForAngle(Infinity));
});
