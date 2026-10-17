/** Deterministic G1 MJCF visual derivative. Original source bytes remain intact. */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { writeGlb } from '../../shared/assets/write-glb.mjs';
import { readGlb, sha256, boundsOf } from '../../shared/assets/glb.mjs';
import { validateSceneContract } from '../../shared/assets/contract.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const provenance=JSON.parse(await readFile(path.join(root,'source/provenance.json'),'utf8'));
if(provenance.revision!=='71f066ad0be9cd271f7ed58c030243ef157af9f4'||provenance.license!=='BSD-3-Clause')throw new Error('Expected pinned G1 source');
const files=new Map();
for(const file of provenance.files){
  if(path.isAbsolute(file.localFile)||file.localFile.split(/[\\/]/).includes('..'))throw new Error('Retained source paths must remain local');
  const bytes=await readFile(path.join(root,'source',file.localFile));
  const gitHash=createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
  if(bytes.length!==file.bytes||sha256(bytes)!==file.sha256||gitHash!==file.gitBlobSha1)throw new Error(`Retained source changed: ${file.localFile}`);
  files.set(file.localFile,{...file,data:bytes});
}
const sourceBytes=files.get(provenance.localFile).data;
if(sha256(sourceBytes)!==provenance.sha256)throw new Error('Source XML hash differs');
const localPython=path.resolve(root,'../../.tools/cad-python/Scripts/python.exe');
let python=process.env.MECHANISM_PYTHON;
if(!python){try{await access(localPython);python=localPython;}catch{python=process.platform==='win32'?'python':'python3';}}
const parsed=spawnSync(python,[path.join(root,'parse-mjcf.py'),path.join(root,'source',provenance.localFile)],{encoding:'utf8',windowsHide:true,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},maxBuffer:2**20});
if(parsed.status!==0)throw new Error(`MJCF parser failed: ${parsed.error?.message??parsed.stderr}`);
const source=JSON.parse(parsed.stdout),bodyMap=new Map(source.bodies.map(body=>[body.name,body])),meshMap=new Map(source.meshes.map(mesh=>[mesh.name,mesh]));
if(bodyMap.size!==30||source.bodies.reduce((sum,body)=>sum+body.joints.length,0)!==29||source.meshes.length!==35)throw new Error('Expected complete pinned 29-DoF G1');
const B=new Matrix4().set(1,0,0,0, 0,0,1,0, 0,-1,0,0, 0,0,0,1),inverseB=B.clone().invert(),identity=new Matrix4().toArray();
const matrixFor=record=>{
  const [w,x,y,z]=record.quatWxyz;
  return new Matrix4().compose(new Vector3(...record.pos),new Quaternion(x,y,z,w).normalize(),new Vector3(1,1,1));
};
const id=name=>`mjcf:${name}`;
const local=new Map(),sourceWorld=new Map(),displayWorld=new Map();
function worldFor(name,visiting=new Set()){
  if(sourceWorld.has(name))return sourceWorld.get(name);
  const body=bodyMap.get(name);if(!body||visiting.has(name))throw new Error('Invalid source body tree');
  const matrix=matrixFor(body);local.set(name,B.clone().multiply(matrix).multiply(inverseB));
  const world=body.parent?worldFor(body.parent,new Set([...visiting,name])).clone().multiply(matrix):matrix;
  sourceWorld.set(name,world);displayWorld.set(name,B.clone().multiply(world).multiply(inverseB));return world;
}
source.bodies.forEach(body=>worldFor(body.name));
const meshIdentity=provenance.files.filter(file=>/\.stl$/i.test(file.localFile)).map(file=>`${file.localFile}:${file.sha256}`).sort().join('\n');
const geometryRevision=`unitree-g1-${provenance.sha256.slice(0,12)}-${sha256(Buffer.from(meshIdentity)).slice(0,12)}-mjcf-display-1`;
const nodes=[],meshes=[],parts=[],sceneParts=[],allWorldPoints=[];
const loader=new STLLoader();
for(const body of source.bodies){
  if(!body.visuals.length)throw new Error(`Unexpected visual-free body: ${body.name}`);
  const positions=[],normals=[],indices=[],visualRecords=[],unique=new Map();
  for(const visual of body.visuals){
    const asset=meshMap.get(visual.mesh);if(!asset)throw new Error('Visual must reference a retained mesh definition');
    const file=files.get(`unitree_g1/assets/${asset.file}`);if(!file)throw new Error('Visual source bytes missing');
    const data=file.data,geometry=loader.parse(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
    const transform=B.clone().multiply(matrixFor(visual)).scale(new Vector3(...asset.scale));
    geometry.applyMatrix4(transform);
    const p=geometry.attributes.position.array,n=geometry.attributes.normal.array;
    const firstIndex=indices.length;
    for(let vertex=0;vertex<p.length/3;vertex++){
      const offset=vertex*3,values=[p[offset],p[offset+1],p[offset+2],n[offset],n[offset+1],n[offset+2]];
      // Exact Float32 attributes only: no welding tolerance, decimation or lost triangles.
      const key=values.join(',');let index=unique.get(key);
      if(index===undefined){index=positions.length/3;unique.set(key,index);positions.push(...values.slice(0,3));normals.push(...values.slice(3));}
      indices.push(index);
    }
    visualRecords.push({visualOccurrenceId:`${id(body.name)}/geom:${visual.sourceGeomIndex}`,sourceGeomIndex:visual.sourceGeomIndex,
      definitionId:`mjcf-mesh:${visual.mesh}`,meshName:visual.mesh,file:`source/${file.localFile}`,sha256:file.sha256,
      sourceGeomTransform:{pos:visual.pos,quatWxyz:visual.quatWxyz},meshScale:asset.scale,
      materialName:visual.material,firstIndex,indexCount:indices.length-firstIndex,triangleCount:(indices.length-firstIndex)/3});
    geometry.dispose();
  }
  const points=Array.from({length:positions.length/3},(_,i)=>positions.slice(i*3,i*3+3));
  const worldMatrix=displayWorld.get(body.name),worldPoints=points.map(point=>new Vector3(...point).applyMatrix4(worldMatrix).toArray());
  const localBounds=boundsOf(points),worldBounds=boundsOf(worldPoints),worldCenter=worldBounds.min.map((value,axis)=>(value+worldBounds.max[axis])/2);
  for(const point of worldPoints)allWorldPoints.push(point);
  const localMatrix=local.get(body.name).toArray(),parentId=body.parent?id(body.parent):null;
  const sourceIdentity={body:body.name,parentBody:body.parent,visuals:visualRecords};
  const semanticNodeIndex=nodes.length;
  nodes.push({name:body.name,matrix:localMatrix,children:[],extras:{part_id:id(body.name),motionOwner:'static',source:sourceIdentity}});
  meshes.push({name:body.name,positions,normals,indices,color:[1,1,1],extras:{sourceBody:body.name,visualDefinitions:visualRecords,geometryRevision}});
  parts.push({part_id:id(body.name),parent_id:parentId,label:body.name,sourceKind:'mjcf-body',motionOwner:'static',rest:{matrix:localMatrix},explode:[0,0,0],source:sourceIdentity,localBoundsGltfMeters:localBounds});
  sceneParts.push({id:id(body.name),name:body.name,parentId,worldBounds,worldCenter,localBounds,localMatrix,worldMatrix:worldMatrix.toArray(),
    mesh:{file:'assets/humanoid.glb',sha256:null,triangleCount:indices.length/3,sourceVisualCount:body.visuals.length},source:sourceIdentity,zeroPose:true,
    displayBinding:{semanticNodeIndex,ownedBodyNodeIndex:null,ownedBodyRest:'identity; geometry is local to its source MJCF body'}});
}
const indexByName=new Map(source.bodies.map((body,index)=>[body.name,index]));
for(const body of source.bodies)if(body.parent)nodes[indexByName.get(body.parent)].children.push(indexByName.get(body.name));
for(let index=0;index<source.bodies.length;index++){
  const body=source.bodies[index],ownedBodyNodeIndex=nodes.length;
  nodes[index].children.push(ownedBodyNodeIndex);
  nodes.push({name:`${body.name} / owned visual body`,mesh:index,matrix:identity,extras:{displayOnly:true,ownerPartId:id(body.name)}});
  sceneParts[index].displayBinding.ownedBodyNodeIndex=ownedBodyNodeIndex;
}
for(const node of nodes)if(node.children&&!node.children.length)delete node.children;
const bounds=boundsOf(allWorldPoints),limits=provenance.geometrySubset.limitations;
const contract={schemaVersion:'1.0.0',mechanismId:'unitree-g1-humanoid',assetRevision:geometryRevision,
  units:{source:'MJCF metres; mesh numeric coordinates metres; angles radian',asset:'m',angle:'rad'},sourceSHA256:provenance.sha256,
  coordinateMap:'B:[x,z,-y]; source body node B*M*B^-1; geometry B*geomTransform*meshScale; source quaternions normalized per MJCF convention',
  identity:'part_id is mjcf:<original body name>; direct original source hierarchy. Visual occurrence IDs derive from body-local original geom index, separate from mesh definitions.',limitations:limits,parts};
const glb=writeGlb({nodes,meshes,scenes:[{name:'Unitree G1 original MJCF zero-joint pose',nodes:[indexByName.get('pelvis')]}],
  extras:{sourceSHA256:provenance.sha256,geometryRevision,units:'m',coordinateMap:contract.coordinateMap,source:{repository:provenance.repository,revision:provenance.revision,license:provenance.license}},
  generator:'Mechanism Studio pinned MJCF visual exporter 1'});
validateSceneContract(readGlb(glb).json,contract);
const glbHash=sha256(glb);sceneParts.forEach(part=>part.mesh.sha256=glbHash);
const index={schemaVersion:'1.0.0',geometryRevision,units:'m',coordinateBasis:'glTF right-handed Y up; B=[x,z,-y]',
  source:{title:provenance.title,author:provenance.author,repository:provenance.repository,revision:provenance.revision,license:provenance.license,sourceFile:`source/${provenance.localFile}`,sha256:provenance.sha256},
  asset:{file:'assets/humanoid.glb',sha256:glbHash,assembledWorldBounds:bounds,assembledWorldCenter:bounds.min.map((value,axis)=>(value+bounds.max[axis])/2)},parts:sceneParts};
const assembly={schemaVersion:'1.0.0',sourceSHA256:provenance.sha256,sourceUnits:{length:'m',angle:'rad'},sourceCoordinateBasis:'right-handed Z up',
  zeroPose:'Every hinge q=0 with original worldbody root pos/quat. The source stand keyframe is retained but not applied.',...source,
  sourceWorldMatrices:Object.fromEntries([...sourceWorld].map(([name,matrix])=>[name,matrix.toArray()])),limitations:limits};
const report={schemaVersion:'1.0.0',mechanismId:contract.mechanismId,exporter:'mechanism-studio-mjcf-display-1',geometryRevision,sourceSHA256:provenance.sha256,
  glbSHA256:glbHash,glbBytes:glb.length,originalFilesVerified:files.size,partCount:parts.length,meshCount:meshes.length,sourceVisualCount:source.bodies.reduce((sum,body)=>sum+body.visuals.length,0),
  sourceJointCount:29,sourceFreeJointCount:1,displayOnlyBodyNodeCount:30,gltfNodeCount:nodes.length,triangleCount:meshes.reduce((sum,mesh)=>sum+mesh.indices.length/3,0),
  assetBoundsMeters:bounds,geometrySimplified:false,exactAttributeDeduplication:true,sourcePoseModified:false,mcpUsed:false,
  motionOwner:'static; authored display offsets belong to the Showcase wrapper',limitations:limits};
await mkdir(path.join(root,'assets'),{recursive:true});
await writeFile(path.join(root,'assets/humanoid.glb'),glb);
await writeFile(path.join(root,'assets/LICENSE'),files.get('unitree_g1/LICENSE').data);
for(const [filename,value]of [['scene-contract.json',contract],['scene-index.json',index],['source-assembly.json',assembly],['build-report.json',report]])await writeFile(path.join(root,'assets',filename),`${JSON.stringify(value,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
