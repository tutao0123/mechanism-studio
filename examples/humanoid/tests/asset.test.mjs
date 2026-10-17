import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readGlb,sha256,semanticNodes } from '../../../shared/assets/glb.mjs';
import { validateSceneContract,assertNearVector } from '../../../shared/assets/contract.mjs';

const root=new URL('../',import.meta.url),json=async file=>JSON.parse(await readFile(new URL(file,root),'utf8'));
const provenance=await json('source/provenance.json'),pins=await json('source/upstream-blobs.json');
const contract=await json('assets/scene-contract.json'),index=await json('assets/scene-index.json'),report=await json('assets/build-report.json'),assembly=await json('assets/source-assembly.json');
const glb=await readFile(new URL('assets/humanoid.glb',root)),{json:gltf,buffer}=readGlb(glb),semantic=semanticNodes(gltf);
const xml=await readFile(new URL('source/unitree_g1/g1.xml',root),'utf8');
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const B=([x,y,z])=>[x,z,-y],inverseB=([x,y,z])=>[x,-z,y];
const near=(a,b,message,epsilon=2e-7)=>assertNearVector(a,b,epsilon,message);
const attrs=text=>Object.fromEntries([...text.matchAll(/([\w]+)="([^"]*)"/g)].map(match=>[match[1],match[2]]));
const vector=(text,fallback)=> (text??fallback).split(/\s+/).map(Number);
// Independent pinned-XML structural pass: do not trust the exporter's JSON for
// source parents, local placements or visual ownership.
const sourceBodies=[],stack=[];
for(const match of xml.matchAll(/<(\/?)(body|geom|joint|freejoint)\b([^>]*)>/g)){
  const [,closing,tag,text]=match,a=attrs(text);
  if(tag==='body'){
    if(closing){stack.pop();continue;}
    const record={name:a.name,parent:stack.at(-1)?.name??null,pos:vector(a.pos,'0 0 0'),quat:vector(a.quat,'1 0 0 0'),visuals:[],geoms:0,joints:[],freeJoint:null};
    sourceBodies.push(record);stack.push(record);
  }else if(stack.length){
    const body=stack.at(-1);
    if(tag==='geom'){if(a.class==='visual')body.visuals.push({index:body.geoms,mesh:a.mesh,pos:vector(a.pos,'0 0 0'),quat:vector(a.quat,'1 0 0 0')});body.geoms++;}
    else if(tag==='joint')body.joints.push(a);
    else body.freeJoint=a;
  }
}
const sourceByName=new Map(sourceBodies.map(body=>[body.name,body]));
const normalize=q=>{const length=Math.hypot(...q);return q.map(value=>value/length);};
const rotate=(point,quat)=>{
  const [w,x,y,z]=normalize(quat),[px,py,pz]=point;
  const tx=2*(y*pz-z*py),ty=2*(z*px-x*pz),tz=2*(x*py-y*px);
  return [px+w*tx+y*tz-z*ty,py+w*ty+z*tx-x*tz,pz+w*tz+x*ty-y*tx];
};
const applySource=(body,p)=>{const local=rotate(p,body.quat).map((value,axis)=>value+body.pos[axis]);return body.parent?applySource(sourceByName.get(body.parent),local):local;};
const multiply=(a,b)=>Array.from({length:16},(_,i)=>{const row=i%4,col=Math.floor(i/4);return [0,1,2,3].reduce((sum,k)=>sum+a[k*4+row]*b[col*4+k],0);});
const applyMatrix=(m,p)=>[0,1,2].map(axis=>m[axis]*p[0]+m[4+axis]*p[1]+m[8+axis]*p[2]+m[12+axis]);
const parents=new Map();gltf.nodes.forEach((node,parent)=>(node.children??[]).forEach(child=>parents.set(child,parent)));
const gltfWorld=i=>parents.has(i)?multiply(gltfWorld(parents.get(i)),gltf.nodes[i].matrix):gltf.nodes[i].matrix;
const bounds=()=>({min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
const extend=(box,p)=>p.forEach((value,axis)=>{box.min[axis]=Math.min(box.min[axis],value);box.max[axis]=Math.max(box.max[axis],value);});
function accessor(index){const a=gltf.accessors[index],view=gltf.bufferViews[a.bufferView];return {a,offset:(view.byteOffset??0)+(a.byteOffset??0),stride:view.byteStride??(a.type==='VEC3'?12:4)};}
const readPosition=(view,index)=>[0,1,2].map(axis=>buffer.readFloatLE(view.offset+index*view.stride+axis*4));
const readIndex=(view,index)=>buffer.readUInt32LE(view.offset+index*view.stride);

test('G1 original XML, 35 meshes and model-specific licence retain exact pinned Git blob bytes',async()=>{
  assert.equal(provenance.revision,pins.revision);assert.equal(provenance.revision,'71f066ad0be9cd271f7ed58c030243ef157af9f4');
  assert.equal(provenance.license,'BSD-3-Clause');assert.equal(provenance.files.length,39);
  assert.equal(provenance.sha256,'3c2616550a31f33e84d3c80b8e913ac5618c8888019b0c9490dae93493e647f3');
  for(const file of provenance.files){
    const bytes=await readFile(new URL(`source/${file.localFile}`,root)),expected=pins.files[file.localFile.replace(/^unitree_g1\//,'')];
    assert.equal(bytes.length,file.bytes,file.localFile);assert.equal(bytes.length,expected[0]);assert.equal(sha256(bytes),file.sha256,file.localFile);
    assert.equal(createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex'),expected[1]);assert.equal(file.gitBlobSha1,expected[1]);
  }
  const license=await readFile(new URL('source/unitree_g1/LICENSE',root),'utf8'),readme=await readFile(new URL('source/unitree_g1/README.md',root),'utf8');
  assert.match(license,/Unitree Robotics/);assert.match(license,/Redistribution and use in source and binary forms/);assert.match(readme,/BSD-3-Clause/);
});

test('all 30 semantic bodies retain direct original source parents and quaternion rest placements',()=>{
  assert.equal(sourceBodies.length,30);assert.equal(validateSceneContract(gltf,contract).partCount,30);assert.equal(semantic.size,30);
  assert.equal(gltf.meshes.length,30);assert.equal(gltf.nodes.length,60);assert.equal(gltf.animations,undefined);
  assert.equal(sha256(glb),index.asset.sha256);assert.equal(report.glbSHA256,index.asset.sha256);assert.equal(contract.assetRevision,index.geometryRevision);
  for(const body of sourceBodies){
    const part=index.parts.find(part=>part.id===`mjcf:${body.name}`),node=semantic.get(part.id),record=assembly.bodies.find(item=>item.name===body.name);
    assert.equal(part.parentId,body.parent?`mjcf:${body.parent}`:null);assert.equal(record.parent,body.parent);assert.deepEqual(record.pos,body.pos);assert.deepEqual(record.quatWxyz,body.quat);
    const expectedOrigin=B(body.pos),actualOrigin=applyMatrix(node.matrix,[0,0,0]);near(actualOrigin,expectedOrigin,`${body.name} origin`,1e-12);
    for(const basis of [[1,0,0],[0,1,0],[0,0,1]]){
      const expected=B(rotate(inverseB(basis),body.quat).map((value,axis)=>value+body.pos[axis]));
      near(applyMatrix(node.matrix,basis),expected,`${body.name} quaternion basis`,1e-12);
      near(applyMatrix(gltfWorld(gltf.nodes.indexOf(node)),basis),B(applySource(body,inverseB(basis))),`${body.name} source world basis`,1e-12);
    }
    assert.equal(node.mesh,undefined);assert.equal(node.extras.motionOwner,'static');assert.equal(part.zeroPose,true);
    assert.equal(record.visuals.length,body.visuals.length);assert.deepEqual(record.joints.map(joint=>joint.sourceAttributes),body.joints);assert.deepEqual(record.freeJoint,body.freeJoint);
  }
  assert.equal(assembly.bodies.reduce((sum,body)=>sum+body.joints.length,0),29);assert.equal(assembly.bodies.filter(body=>body.freeJoint).length,1);
});

test('every original visual triangle survives exact indexing with one metre coordinate conversion and verified world bounds',async()=>{
  let triangleTotal=0,visualTotal=0;const global=bounds();
  for(const body of sourceBodies){
    const part=index.parts.find(part=>part.id===`mjcf:${body.name}`),binding=part.displayBinding,semanticNode=gltf.nodes[binding.semanticNodeIndex],owned=gltf.nodes[binding.ownedBodyNodeIndex];
    assert.equal(owned.extras.ownerPartId,part.id);assert.equal(owned.extras.part_id,undefined);assert.equal(owned.extras.displayOnly,true);assert.deepEqual(owned.matrix,identity);
    assert.equal(parents.get(binding.ownedBodyNodeIndex),binding.semanticNodeIndex);assert.equal(owned.children,undefined);assert.ok(semanticNode.children.includes(binding.ownedBodyNodeIndex));
    const primitive=gltf.meshes[owned.mesh].primitives[0],positions=accessor(primitive.attributes.POSITION),indices=accessor(primitive.indices),world=gltfWorld(binding.ownedBodyNodeIndex),worldBounds=bounds();
    let indexCount=0;
    for(let visualIndex=0;visualIndex<body.visuals.length;visualIndex++){
      const original=body.visuals[visualIndex],visual=part.source.visuals[visualIndex],meshDefinition=assembly.meshes.find(mesh=>mesh.name===original.mesh),bytes=await readFile(new URL(`source/unitree_g1/assets/${meshDefinition.file}`,root));
      assert.equal(visual.sourceGeomIndex,original.index);assert.equal(visual.definitionId,`mjcf-mesh:${original.mesh}`);assert.deepEqual(visual.sourceGeomTransform,{pos:original.pos,quatWxyz:original.quat});
      assert.equal(visual.sha256,sha256(bytes));assert.equal(visual.firstIndex,indexCount);const triangles=bytes.readUInt32LE(80);assert.equal(visual.indexCount,triangles*3);assert.equal(visual.triangleCount,triangles);assert.equal(bytes.length,84+triangles*50);
      for(let i=0;i<triangles*3;i++){
        const offset=84+Math.floor(i/3)*50+12+(i%3)*12;
        const raw=[0,1,2].map(axis=>bytes.readFloatLE(offset+axis*4)*meshDefinition.scale[axis]);
        const sourceLocal=rotate(raw,original.quat).map((value,axis)=>value+original.pos[axis]);
        const expected=B(applySource(body,sourceLocal)),actual=applyMatrix(world,readPosition(positions,readIndex(indices,indexCount+i)));
        near(actual,expected,`${body.name}/${original.mesh} triangle vertex ${i}`);extend(worldBounds,actual);extend(global,actual);
      }
      indexCount+=visual.indexCount;triangleTotal+=triangles;visualTotal++;
    }
    assert.equal(indices.a.count,indexCount);assert.equal(part.mesh.triangleCount,indexCount/3);
    near(part.worldBounds.min,worldBounds.min,`${body.name} min`,1e-12);near(part.worldBounds.max,worldBounds.max,`${body.name} max`,1e-12);
    near(part.worldCenter,worldBounds.min.map((value,axis)=>(value+worldBounds.max[axis])/2),`${body.name} center`,1e-12);
    near(part.worldMatrix,world,`${body.name} matrix`,1e-12);
  }
  assert.equal(visualTotal,35);assert.equal(triangleTotal,393270);assert.equal(report.triangleCount,triangleTotal);assert.equal(report.sourceVisualCount,visualTotal);
  near(index.asset.assembledWorldBounds.min,global.min,'global min',1e-12);near(index.asset.assembledWorldBounds.max,global.max,'global max',1e-12);
  assert.ok(global.max[1]-global.min[1]>1.3&&global.max[1]-global.min[1]<1.4,'Real humanoid metre height, not millimetres or invented dimensions');
});

test('head and hand visuals retain source ownership instead of invented joints or screw identities',()=>{
  assert.equal(index.parts.some(part=>part.name==='head_link'),false);assert.equal(index.parts.some(part=>part.name.includes('rubber_hand')),false);
  assert.deepEqual(index.parts.find(part=>part.name==='torso_link').source.visuals.map(visual=>visual.meshName),['torso_link','logo_link','head_link']);
  for(const side of ['left','right'])assert.ok(index.parts.find(part=>part.name===`${side}_wrist_yaw_link`).source.visuals.some(visual=>visual.meshName===`${side}_rubber_hand`));
  assert.equal(report.sourcePoseModified,false);assert.equal(report.geometrySimplified,false);assert.equal(report.mcpUsed,false);
  assert.match(report.limitations.join(' '),/not collision-checked/);assert.match(report.limitations.join(' '),/no per-screw identity/);
});

test('contract validator rejects a changed source rest or rewired native body parent',()=>{
  const rest=structuredClone(gltf);rest.nodes[1].matrix[12]+=.01;assert.throws(()=>validateSceneContract(rest,contract),/rest matrix/);
  const hierarchy=structuredClone(gltf),child=2;hierarchy.nodes[1].children=hierarchy.nodes[1].children.filter(index=>index!==child);hierarchy.nodes[0].children.push(child);
  assert.throws(()=>validateSceneContract(hierarchy,contract),/actual exported parent matches/);
});
