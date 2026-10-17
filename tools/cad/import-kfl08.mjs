import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { sha256, boundsOf, readGlb } from '../../shared/assets/glb.mjs';
import { writeGlb } from '../../shared/assets/write-glb.mjs';
import { validateSceneContract } from '../../shared/assets/contract.mjs';
import { extractStepMetadata } from './step-metadata.mjs';
const root=new URL('../../',import.meta.url),example=new URL('examples/step-assembly/',root),require=createRequire(import.meta.url);
const sourceBytes=await readFile(new URL('source/kfl08.step',example)),provenance=JSON.parse(await readFile(new URL('source/provenance.json',example),'utf8'));
if(sha256(sourceBytes)!==provenance.sourceSHA256)throw Error('Source checksum differs from reviewed provenance');
const metadata=extractStepMetadata(sourceBytes.toString('utf8'));
if(metadata.lengthUnits.some(u=>u.unit!=='mm'))throw Error('This specimen must explicitly declare millimetres');
const factory=require('occt-import-js'),occt=await factory(),version=require('occt-import-js/package.json').version;
const settings={linearUnit:'millimeter',linearDeflectionType:'absolute_value',linearDeflection:.08,angularDeflection:.4};
const result=occt.ReadStepFile(sourceBytes,settings);if(!result.success)throw Error('OCCT STEP import failed');
const meters=occt.ReadStepFile(sourceBytes,{...settings,linearUnit:'meter',linearDeflection:.00008});if(!meters.success)throw Error('Metre calibration import failed');
const coarse=occt.ReadStepFile(sourceBytes,{...settings,linearDeflection:.4,angularDeflection:.8});if(!coarse.success)throw Error('Coarse validation import failed');
const mapPoint=([x,y,z])=>[x*.001,z*.001,-y*.001],mapNormal=([x,y,z])=>[x,z,-y];
const arraysToPoints=values=>Array.from({length:values.length/3},(_,i)=>values.slice(i*3,i*3+3));
const nodes=[],outputMeshes=[],parts=[],meshMappings=[];
const labels={Balls:'滚珠',Cages:'保持架',Rivets:'铆钉',Seals:'密封圈',Rings:'内外圈','Set screws':'紧定螺钉',Case:'法兰壳体'};
function visit(group,path,parent=null) {
  const id=path.length?'cad-'+path.join('-'):'cad-root',index=nodes.length;
  nodes.push({name:group.name||'OCCT root',extras:{assembly_id:id,occtPath:path,sourceName:group.name},children:[]});if(parent!==null)nodes[parent].children.push(index);
  for(const meshIndex of group.meshes) {
    const mesh=result.meshes[meshIndex],sourcePoints=arraysToPoints(mesh.attributes.position.array),sourceBounds=boundsOf(sourcePoints),center=sourceBounds.min.map((v,i)=>(v+sourceBounds.max[i])/2),rest=mapPoint(center);
    const points=sourcePoints.map(p=>mapPoint(p.map((v,i)=>v-center[i]))),partId='cad-mesh-'+String(meshIndex).padStart(3,'0');
    const sourceProduct=metadata.products.find(p=>p.name===mesh.name),sourceOccurrence=sourceProduct?metadata.occurrences.find(o=>o.childProduct===sourceProduct.id):null;
    const explode=group.name==='Case'?[-.026,0,0]:group.name==='Seals'?[meshIndex===28?-.018:.018,0,0]:group.name==='Rings'?[meshIndex===30?-.01:.01,0,0]:group.name==='Cages'?[meshIndex<14?-.025:.025,0,0]:group.name==='Rivets'?[.03,0,0]:group.name==='Set screws'?[.03,.015,0]:[0,rest[1]*1.7,rest[2]*1.7];
    const record={part_id:partId,parent_id:id,label_zh:(labels[group.name]??group.name)+' · '+(mesh.name||'网格 '+(meshIndex+1)),motionOwner:'static',rest:{translation:rest,rotation:[0,0,0,1],scale:[1,1,1]},explode,source:{meshIndex,occtGroupPath:path,occtGroupName:group.name,sourceProductEntity:sourceProduct?.id??null,sourceDefinitionEntity:sourceOccurrence?.childDefinition??null,sourceOccurrenceEntity:sourceOccurrence?.entity??null,mapping:sourceProduct?'source-name-to-product':'group-only-importer-does-not-expose-leaf'},localBoundsGltfMeters:boundsOf(points)};
    parts.push(record);meshMappings.push({part_id:partId,...record.source,sourceBoundsMillimetres:sourceBounds,brepFaceTriangleRanges:mesh.brep_faces,triangleCount:mesh.index.array.length/3});
    const outMesh=outputMeshes.length;outputMeshes.push({name:mesh.name||record.label_zh,positions:points.flat(),normals:mesh.attributes.normal?arraysToPoints(mesh.attributes.normal.array).map(mapNormal).flat():undefined,indices:mesh.index.array,color:mesh.color,extras:{occtMeshIndex:meshIndex,brepFaceCount:mesh.brep_faces.length}});
    const partNode=nodes.length;nodes.push({name:partId,mesh:outMesh,translation:rest,extras:{part_id:partId,motionOwner:'static',sourceProductEntity:sourceProduct?.id??null,sourceDefinitionEntity:sourceOccurrence?.childDefinition??null,sourceOccurrenceEntity:sourceOccurrence?.entity??null}});nodes[index].children.push(partNode);
  }
  group.children.forEach((child,i)=>visit(child,[...path,i],index));return index;
}
visit(result.root,[]);
const limitations=['OCCT output exposes 35 mesh fragments; source has 22 leaf occurrences plus 7 subassembly occurrences. Mesh counts are not source part counts.','Original CAD local transforms and definition/instance IDs are not exposed by this importer. Vertex coordinates contain assembled placement; source placement entities remain in STEP and source-metadata.json.','Anonymous cage and screw fragments retain group and mesh identity only. They cannot be assigned to an individual source occurrence reliably.','No precise B-rep measurement, solid cutting, interference, constraint solving or parameter editing is implemented. Explosion is a display offset, not a validated assembly/disassembly sequence.'];
const contract={schemaVersion:'1.0.0',mechanismId:'step-kfl08',assetRevision:'1',units:{body:'mm',asset:'m',source:'mm',angle:'rad'},coordinateMap:'0.001*[x,z,-y]',sourceSHA256:sha256(sourceBytes),limitations,parts};
const glb=writeGlb({nodes,scenes:[{name:'KFL08 retained OCCT hierarchy',nodes:[0]}],meshes:outputMeshes,extras:{sourceSHA256:sha256(sourceBytes),sourceLengthUnit:'mm',assetLengthUnit:'m',coordinateMap:contract.coordinateMap}});
validateSceneContract(readGlb(glb).json,contract);
const sourceBounds=boundsOf(result.meshes.flatMap(m=>arraysToPoints(m.attributes.position.array))),count=r=>r.meshes.reduce((s,m)=>s+m.index.array.length/3,0);
const report={schemaVersion:'1.0.0',status:'real-step-display-import-verified',source:provenance,importer:{name:'occt-import-js',version,license:'LGPL-2.1',settings,documentation:'https://github.com/kovacsv/occt-import-js'},sourceStatistics:metadata.statistics,occtTree:result.root,display:{meshFragments:parts.length,triangles:count(result),sourceBoundsMillimetres:sourceBounds,assetBoundsMeters:boundsOf(result.meshes.flatMap(m=>arraysToPoints(m.attributes.position.array).map(mapPoint)))},tessellationComparison:{fine:settings,coarse:{...settings,linearDeflection:.4,angularDeflection:.8},fineTriangles:count(result),coarseTriangles:count(coarse),coarseMeshCount:coarse.meshes.length,unitCalibration:{outputUnit:'m',absoluteLinearDeflection:.00008,meshCount:meters.meshes.length,triangles:count(meters),bounds:boundsOf(meters.meshes.flatMap(m=>arraysToPoints(m.attributes.position.array)))},coarseSourceBoundsMillimetres:boundsOf(coarse.meshes.flatMap(m=>arraysToPoints(m.attributes.position.array)))},glbSHA256:sha256(glb),mapping:meshMappings,limitations};
await mkdir(new URL('assets/',example),{recursive:true});
await writeFile(new URL('assets/assembly.glb',example),glb);
for(const [name,data]of [['scene-contract.json',contract],['import-report.json',report],['source-metadata.json',metadata]])await writeFile(new URL('assets/'+name,example),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({sourceSHA256:sha256(sourceBytes),sourceOccurrences:metadata.statistics,displayMeshes:parts.length,triangles:count(result),coarseTriangles:count(coarse),glbSHA256:sha256(glb)},null,2));
