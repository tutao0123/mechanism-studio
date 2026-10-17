import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
import {sha256,readGlb,positionArrays,boundsOf,semanticNodes,accessorValues} from '../../../shared/assets/glb.mjs';import{validateSceneContract,assertNearVector}from'../../../shared/assets/contract.mjs';import{extractStepMetadata}from'../../../tools/cad/step-metadata.mjs';
const example=new URL('../',import.meta.url),json=async p=>JSON.parse(await readFile(new URL(p,example),'utf8'));
const source=await readFile(new URL('source/kfl08.step',example)),bytes=await readFile(new URL('assets/assembly.glb',example));
const provenance=await json('source/provenance.json'),report=await json('assets/import-report.json'),contract=await json('assets/scene-contract.json'),metadata=await json('assets/source-metadata.json');
const {json:gltf,buffer}=readGlb(bytes),nodes=semanticNodes(gltf),expectedHash='938d5e7e596d5e9586e7b2d7cef89da3003d3cf734dbfa5ab39f6e790319c090';
test('retained existing source matches pinned upstream checksum, AP214 units and real occurrence graph',()=>{
  assert.equal(sha256(source),expectedHash);assert.equal(provenance.sourceSHA256,expectedHash);assert.equal(provenance.license,'CC-BY-3.0');assert.equal(provenance.author,'hasecilu');assert.equal(provenance.commit,'f5ca01cdcaa2f69b9295a6382719c2d90628780c');
  assert.deepEqual(extractStepMetadata(source.toString('utf8')),metadata);assert.match(metadata.schema,/AUTOMOTIVE_DESIGN/);assert.deepEqual(metadata.statistics,{productCount:30,occurrenceCount:29,assemblyOccurrences:7,leafOccurrences:22});
  assert.ok(metadata.lengthUnits.length>0&&metadata.lengthUnits.every(u=>u.unit==='mm'));assert.ok(metadata.angleUnits.length>0&&metadata.angleUnits.every(u=>u.unit==='rad'));assert.equal(new Set(metadata.occurrences.map(o=>o.entity)).size,29);assert.ok(metadata.occurrences.every(o=>o.parentProduct&&o.childProduct));assert.ok(metadata.placements.length>20);
});
test('GLB and contract retain OCCT tree, static pose ownership and honest source fragment mapping',()=>{
  validateSceneContract(gltf,contract);assert.equal(sha256(bytes),report.glbSHA256);assert.equal(gltf.extras.sourceSHA256,expectedHash);assert.equal(nodes.size,35);assert.equal(contract.units.asset,'m');assert.equal(report.sourceStatistics.leafOccurrences,22);
  const groups=report.occtTree.children[0].children;assert.deepEqual(groups.map(g=>[g.name,g.meshes.length]),[['Balls',7],['Cages',14],['Rivets',7],['Seals',2],['Rings',2],['Set screws',2],['Case',1]]);
  const sourceProducts=new Set(metadata.products.map(p=>p.id)),sourceOccurrences=new Set(metadata.occurrences.map(p=>p.entity));let unknown=0;
  for(const p of contract.parts){assert.equal(p.motionOwner,'static');if(p.source.sourceOccurrenceEntity){assert.ok(sourceOccurrences.has(p.source.sourceOccurrenceEntity));assert.ok(sourceProducts.has(p.source.sourceProductEntity));assert.equal(p.source.sourceDefinitionEntity,metadata.occurrences.find(o=>o.entity===p.source.sourceOccurrenceEntity).childDefinition);}else{unknown++;assert.equal(p.source.mapping,'group-only-importer-does-not-expose-leaf');}}
  assert.equal(unknown,16);assert.equal(gltf.animations,undefined);assert.equal(report.importer.version,'0.0.23');
});
test('actual binary positions, indices, source mesh bounds and millimetre conversion agree',()=>{
  const global=[];
  for(const p of contract.parts){const node=nodes.get(p.part_id),positions=positionArrays(gltf,buffer,node).flatMap(p=>p.values),bounds=boundsOf(positions);assertNearVector(bounds.min,p.localBoundsGltfMeters.min,2e-9);assertNearVector(bounds.max,p.localBoundsGltfMeters.max,2e-9);
    for(const point of positions)global.push(point.map((v,i)=>v+node.translation[i]));
    for(const prim of gltf.meshes[node.mesh].primitives){const indices=accessorValues(gltf,buffer,prim.indices).flat();assert.equal(indices.length%3,0);assert.ok(indices.every(i=>Number.isInteger(i)&&i>=0&&i<positions.length));}
  }
  const bounds=boundsOf(global);assertNearVector(bounds.min,report.display.assetBoundsMeters.min,2e-9);assertNearVector(bounds.max,report.display.assetBoundsMeters.max,2e-9);
  assertNearVector(report.display.sourceBoundsMillimetres.min,[-4.1,-24,-13.5],1e-8);assertNearVector(report.display.sourceBoundsMillimetres.max,[8.5,24,13.5],1e-8);assertNearVector(bounds.max.map((v,i)=>v-bounds.min[i]),[.0126,.027,.048],3e-9);
});
test('real OCCT re-import checks millimetres/metres and two distinct tessellation densities',async()=>{
  const require=createRequire(import.meta.url),occt=await require('occt-import-js')(),fine=occt.ReadStepFile(source,report.importer.settings),coarse=occt.ReadStepFile(source,report.tessellationComparison.coarse),meters=occt.ReadStepFile(source,{...report.importer.settings,linearUnit:'meter',linearDeflection:.00008});
  for(const result of[fine,coarse,meters]){assert.equal(result.success,true);assert.equal(result.meshes.length,35);assert.deepEqual(result.root,report.occtTree);}
  const triangles=result=>result.meshes.reduce((sum,m)=>sum+m.index.array.length/3,0);assert.equal(triangles(fine),22942);assert.equal(triangles(coarse),8820);assert.equal(triangles(meters),report.tessellationComparison.unitCalibration.triangles);assert.ok(Math.abs(triangles(meters)-triangles(fine))/triangles(fine)<.01,'scale-dependent mesher difference is recorded and bounded for this specimen');
  const bounds=result=>boundsOf(result.meshes.flatMap(m=>Array.from({length:m.attributes.position.array.length/3},(_,i)=>m.attributes.position.array.slice(i*3,i*3+3))));
  const mm=bounds(fine),m=bounds(meters),c=bounds(coarse);assertNearVector(c.min,report.tessellationComparison.coarseSourceBoundsMillimetres.min,1e-6);assertNearVector(c.max,report.tessellationComparison.coarseSourceBoundsMillimetres.max,1e-6);assert.ok(Math.max(...mm.min.map((v,i)=>Math.abs(v-c.min[i])),...mm.max.map((v,i)=>Math.abs(v-c.max[i])))<.05,'coarse mesh bounds differ by less than 0.05mm for this specimen');assertNearVector(mm.min.map(v=>v*.001),m.min,1e-8);assertNearVector(mm.max.map(v=>v*.001),m.max,1e-8);
});
