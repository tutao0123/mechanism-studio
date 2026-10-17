import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readGlb, sha256, semanticNodes, accessorValues, boundsOf } from '../../shared/assets/glb.mjs';
import { validateSceneContract, assertNearVector } from '../../shared/assets/contract.mjs';

const root = new URL('../', import.meta.url);
const json = async file => JSON.parse(await readFile(new URL(file,root),'utf8'));
const provenance = await json('source/provenance.json');
const native = await json('source/research/source-inspection.json');
const sourceAssembly = await json('assets/source-assembly.json');
const contract = await json('assets/scene-contract.json');
const report = await json('assets/build-report.json');
const sceneIndex = await json('planning/scene-index.json');
const bytes = await readFile(new URL('assets/robot.glb',root));
const { json: gltf, buffer } = readGlb(bytes);
const semantic = semanticNodes(gltf);
const sourceJoint = new Map(native.joints.map(joint=>[joint.child,joint]));
const sourceLink = new Map(native.links.map(link=>[link.name,link]));
const identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const multiply = (a,b) => Array.from({length:16},(_,index)=>{
  const row = index % 4, column = Math.floor(index/4);
  return [0,1,2,3].reduce((sum,k)=>sum+a[k*4+row]*b[column*4+k],0);
});
const apply = (matrix,p) => [0,1,2].map(row=>matrix[row]*p[0]+matrix[4+row]*p[1]+matrix[8+row]*p[2]+matrix[12+row]);
const B = ([x,y,z]) => [x,z,-y];
const sourceWorldOffset = name => {
  const joint=sourceJoint.get(name);
  if(!joint)return [0,0,0];
  assert.deepEqual(joint.origin.rpy,[0,0,0], 'Pinned source zero-pose RPY remains zero');
  const parent=sourceWorldOffset(joint.parent);
  return parent.map((value,axis)=>value+joint.origin.xyz[axis]);
};
const parentIndex = new Map(); gltf.nodes.forEach((node,index)=>(node.children??[]).forEach(child=>parentIndex.set(child,index)));
const gltfWorld = index => parentIndex.has(index) ? multiply(gltfWorld(parentIndex.get(index)),gltf.nodes[index].matrix) : gltf.nodes[index].matrix;
const ownedBodyFor = node => {
  assert.equal(node.mesh,undefined,'Source link remains a geometry-free Group');
  const matches=(node.children??[]).map(index=>gltf.nodes[index]).filter(child=>child.extras?.displayOnly&&child.extras.ownerPartId===node.extras.part_id);
  assert.equal(matches.length,1,'Exactly one direct display-only solid per source link');
  return matches[0];
};

test('retained robot description, meshes and licence evidence match pinned upstream bytes',async()=>{
  assert.equal(provenance.revision,'e871f738c97f43de230cb04d340797da6a68c4b9');
  assert.equal(provenance.license,'CC-BY-4.0'); assert.equal(provenance.files.length,21);
  for(const file of provenance.files){
    const actual=await readFile(new URL(`source/${file.localFile}`,root));
    assert.equal(actual.length,file.bytes,file.localFile); assert.equal(sha256(actual),file.sha256,file.localFile);
    assert.equal(createHash('sha1').update(Buffer.from(`blob ${actual.length}\0`)).update(actual).digest('hex'),file.gitBlobSha1,file.localFile);
  }
  assert.equal(provenance.sha256,'d52437d3f901077d084492d81b4037952273a76d0a229bf7cf7de7ac5836da4f');
});

test('GLB has eight original static link identities, real source parents and one zero-pose rest transform',()=>{
  assert.equal(validateSceneContract(gltf,contract).partCount,8);
  assert.equal(semantic.size,8); assert.equal(gltf.meshes.length,8); assert.equal(gltf.animations,undefined);
  assert.equal(report.partCount,8); assert.equal(report.displayOnlyBodyNodeCount,8); assert.equal(report.gltfNodeCount,16);
  assert.match(report.geometryRevision,/-urdf-display-2$/);
  assert.equal(contract.units.asset,'m'); assert.equal(sceneIndex.units,'m');
  assert.equal(report.sourcePoseModified,false); assert.equal(report.geometrySimplified,false);
  assert.equal(report.glbSHA256,sha256(bytes)); assert.equal(sceneIndex.asset.sha256,sha256(bytes));
  assert.equal(sceneIndex.geometryRevision,report.geometryRevision); assert.equal(contract.assetRevision,report.geometryRevision);
  for(const part of contract.parts){
    const name=part.part_id.replace(/^urdf:/,''), joint=sourceJoint.get(name), node=semantic.get(part.part_id);
    assert.ok(sourceLink.has(name)); assert.equal(part.parent_id,joint?`urdf:${joint.parent}`:null);
    assert.equal(node.extras.motionOwner,'static'); assert.equal(node.extras.source.link,name);
    assert.equal(node.translation,undefined); assert.equal(node.rotation,undefined); assert.equal(node.scale,undefined);
    const expectedLocal=identity.slice(); expectedLocal.splice(12,3,...B(joint?.origin.xyz??[0,0,0]));
    assertNearVector(node.matrix,expectedLocal,1e-12,`${name} source local placement`);
    const expectedWorld=identity.slice(); expectedWorld.splice(12,3,...B(sourceWorldOffset(name)));
    assertNearVector(gltfWorld(gltf.nodes.indexOf(node)),expectedWorld,1e-12,`${name} source world placement`);
  }
});

test('every GLB triangle retains original STL geometry with visual origins, millimetre scale and one coordinate basis',async()=>{
  const globalPoints=[]; let triangleTotal=0;
  for(const part of sceneIndex.parts){
    const name=part.name, source=sourceLink.get(name), node=semantic.get(part.id);
    const mesh=await readFile(new URL(`source/simulation/urdf/${source.mesh}`,root));
    assert.deepEqual(source.meshScale,[.001,.001,.001]); assert.deepEqual(source.visualOrigin.rpy,[0,0,0]);
    const body=ownedBodyFor(node);
    const triangleCount=mesh.readUInt32LE(80), primitive=gltf.meshes[body.mesh].primitives[0];
    assert.equal(triangleCount,source.triangleCount); triangleTotal+=triangleCount;
    const indices=accessorValues(gltf,buffer,primitive.indices).flat();
    const positions=accessorValues(gltf,buffer,primitive.attributes.POSITION);
    assert.equal(indices.length,triangleCount*3); assert.equal(positions.length,triangleCount*3);
    const offset=sourceWorldOffset(name), matrix=gltfWorld(gltf.nodes.indexOf(body)), worldPoints=[];
    for(let i=0;i<indices.length;i++){
      const triangle=Math.floor(i/3),vertex=i%3;
      const raw=[0,1,2].map(axis=>mesh.readFloatLE(84+triangle*50+12+vertex*12+axis*4));
      const expected=B(raw.map((value,axis)=>value*.001+source.visualOrigin.xyz[axis]+offset[axis]));
      const actual=apply(matrix,positions[indices[i]]);
      assertNearVector(actual,expected,8e-8,`${name} source vertex ${i}`);
      worldPoints.push(actual); globalPoints.push(actual);
    }
    const measured=boundsOf(worldPoints);
    assertNearVector(part.worldBounds.min,measured.min,1e-12); assertNearVector(part.worldBounds.max,measured.max,1e-12);
    assertNearVector(part.worldCenter,measured.min.map((value,axis)=>(value+measured.max[axis])/2),1e-12);
    assertNearVector(part.worldMatrix,matrix,1e-12); assertNearVector(part.localMatrix,node.matrix,1e-12);
    assert.equal(part.mesh.sha256,sha256(mesh)); assert.equal(part.mesh.triangleCount,triangleCount);
  }
  assert.equal(triangleTotal,62064); assert.equal(report.triangleCount,triangleTotal);
  const globalBounds=boundsOf(globalPoints);
  assertNearVector(sceneIndex.asset.assembledWorldBounds.min,globalBounds.min,1e-12);
  assertNearVector(sceneIndex.asset.assembledWorldBounds.max,globalBounds.max,1e-12);
  assert.ok(globalBounds.max[0]-globalBounds.min[0]>.42 && globalBounds.max[0]-globalBounds.min[0]<.44,'Actual robot span is in metres, not millimetres');
});

test('hiding the base owned solid cannot hide a downstream wrist solid or alter source identity',()=>{
  const base=semantic.get('urdf:base_link'), wrist=semantic.get('urdf:link4_1');
  const baseBody=ownedBodyFor(base), wristBody=ownedBodyFor(wrist);
  for(const [id,node] of semantic){
    const body=ownedBodyFor(node);
    assert.deepEqual(body.matrix,identity,'Display body transform is identity');
    assert.equal(body.extras.part_id,undefined,'Display wrapper adds no source part identity');
    assert.equal(body.extras.assembly_id,undefined);
    assert.equal(body.children,undefined,'Solid child has no downstream source links');
    const binding=sceneIndex.parts.find(part=>part.id===id).displayBinding;
    assert.equal(gltf.nodes[binding.semanticNodeIndex],node);
    assert.equal(gltf.nodes[binding.ownedBodyNodeIndex],body);
  }
  const hiddenIndex=gltf.nodes.indexOf(baseBody);
  const hiddenAncestor = node => {
    for(let index=gltf.nodes.indexOf(node);index!==undefined;index=parentIndex.get(index))if(index===hiddenIndex)return true;
    return false;
  };
  assert.equal(hiddenAncestor(baseBody),true);
  assert.equal(hiddenAncestor(wristBody),false,'Wrist solid remains visible when only base solid is hidden');
  assert.equal(parentIndex.get(gltf.nodes.indexOf(wrist)),gltf.nodes.indexOf(semantic.get('urdf:link3_1')),'Native wrist parent remains direct');
});

test('native joint axes, limits, mimic and original visual data remain available separately from display geometry',()=>{
  assert.equal(sourceAssembly.sourceSHA256,provenance.sha256);
  assert.deepEqual(sourceAssembly.sourceUnits,{length:'m',visualMeshNumeric:'mm',angle:'rad'});
  assert.equal(sourceAssembly.links.length,8); assert.equal(sourceAssembly.joints.length,7);
  for(const joint of sourceAssembly.joints){
    const original=native.joints.find(item=>item.name===joint.name); assert.ok(original);
    for(const field of ['parent','child','origin','axis','limit'])assert.deepEqual(joint[field],original[field]);
    assert.equal(joint.type,original.type);
    if(original.mimic)assert.deepEqual(joint.mimic,{joint:original.mimic.joint,multiplier:Number(original.mimic.multiplier),offset:Number(original.mimic.offset)});
  }
  for(const link of sourceAssembly.links){
    const original=sourceLink.get(link.name); assert.deepEqual(link.visuals[0].origin,original.visualOrigin);
    assert.deepEqual(link.visuals[0].scale,original.meshScale); assert.equal(link.visuals[0].mesh,original.mesh);
  }
  assert.match(report.limitations.join(' '),/not collision-checked/);
  assert.match(report.limitations.join(' '),/does not retain per-screw identity/);
});

test('common ownership validation rejects modified rest placement or source parent wiring',()=>{
  const badRest=structuredClone(gltf); badRest.nodes[2].matrix[12]+=.01;
  assert.throws(()=>validateSceneContract(badRest,contract),/rest matrix/);
  const badParent=structuredClone(gltf); badParent.nodes[1].children=badParent.nodes[1].children.filter(index=>index!==2); badParent.nodes[0].children.push(2);
  assert.throws(()=>validateSceneContract(badParent,contract),/actual exported parent matches/);
});
