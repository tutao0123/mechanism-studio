import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SPEC, LEGS, robotState, motionPoses, bodyToGLTF } from '../model.mjs';
import { readGlb, semanticNodes, sha256, positionArrays } from '../../../shared/assets/glb.mjs';
import { validateSceneContract } from '../../../shared/assets/contract.mjs';
import { validateLesson } from '../../../shared/voice/lesson.mjs';
import { validateManifest } from '../../../shared/voice/player.mjs';
import { webcrypto } from 'node:crypto';
import { optionalAssetSet } from '../../../tests/optional-assets.mjs';
const root = new URL('../',import.meta.url);
const raw = await readFile(new URL('assets/quadruped.glb',root)), {json:gltf,buffer}=readGlb(raw), nodes=semanticNodes(gltf);
const contract=JSON.parse(await readFile(new URL('assets/scene-contract.json',root)));
const report=JSON.parse(await readFile(new URL('assets/build-report.json',root)));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('delivered GLB/source identities, ownership, units and real assembly parents match common contract', () => {
  const result=validateSceneContract(gltf,contract,{restToAsset:bodyToGLTF,epsilon:1e-6});
  assert.equal(result.partCount,20); assert.equal(contract.mechanismId,SPEC.mechanismId); assert.equal(report.meshes,291);
  assert.ok(gltf.nodes.some(node=>node.extras?.assembly_id==='quadruped')); assert.equal(gltf.animations,undefined);
});
test('delivered GLB and model hashes match editable procedural build input', async () => {
  assert.equal(sha256(raw),report.glbSHA256);assert.equal(sha256(await readFile(new URL('model.mjs',root))),report.modelSHA256);
  assert.equal(sha256(await readFile(new URL('blender/build-input.json',root))),report.buildInputSHA256);
  assert.ok((await readFile(new URL('blender/build.py',root),'utf8')).includes('bpy'));
  const localBlend = await optionalAssetSet([new URL('assets/quadruped.blend',root)]);
  if (localBlend) assert.equal(localBlend[0].subarray(0,7).toString(),'BLENDER');
  const input=JSON.parse(await readFile(new URL('blender/build-input.json',root)));assert.deepEqual(input.spec,SPEC);assert.deepEqual(input.rest,robotState());assert.equal(report.mcpUsed,false);
});
test('exported rest positions and joint quaternions agree with the same kinematic baseline', () => {
  for (const [id,pose] of Object.entries(motionPoses(robotState()))) {
    const node=nodes.get(id);pose.position.forEach((value,index)=>near(value,(node.translation??[0,0,0])[index]));
    const angle=pose.rotation[2],expected=[0,0,Math.sin(angle/2),Math.cos(angle/2)];
    const actual=node.rotation??[0,0,0,1]; expected.forEach((value,index)=>near(value,actual[index]));
  }
});
test('every leg has a genuine fixed hip, moving upper/lower links and separate foot mesh', () => {
  for(const leg of LEGS)for(const type of ['hip','thigh','shin','foot']){
    const id=type+'-'+leg.id,node=nodes.get(id);assert.ok(node,id);assert.equal(node.extras.motionOwner,type==='hip'?'static':'model');
    const record=contract.parts.find(p=>p.part_id===id);assert.ok(record.role_zh.length>10);assert.ok(record.explode.every(Number.isFinite));
  }
  assert.equal(contract.parts.filter(p=>p.cutawayHidden).map(p=>p.part_id).join(','),'cover');
  assert.ok(gltf.meshes.length>200);for(const node of gltf.nodes.filter(node=>node.mesh!==undefined))assert.ok(positionArrays(gltf,buffer,node).length>0);
});
test('six teaching steps bind valid assets, control values and shared arbitrary-count lesson contract', async () => {
  const input=JSON.parse(await readFile(new URL('voice/lesson.json',root)));assert.equal(validateLesson(input).steps.length,6);
  for(const step of input.steps){assert.ok(nodes.has(step.partId));assert.ok(step.narration.length>60);const state=robotState(step);assert.ok(state.maxResidual<1e-6);}
  assert.match(input.steps.find(s=>s.id==='diagonal').narration,/动力学/);assert.match(input.steps[0].narration,/外展/);
});
test('six Doubao records match lesson identity; a complete optional local set matches exact bytes', async t => {
  const lesson=JSON.parse(await readFile(new URL('voice/lesson.json',root))), manifest=JSON.parse(await readFile(new URL('voice/audio-manifest.json',root)));
  await validateManifest(manifest,lesson,{baseURL:'http://localhost/examples/quadruped/',cryptoImpl:webcrypto});
  assert.equal(Object.keys(manifest.steps).length,6);
  const records=Object.values(manifest.steps), files=await optionalAssetSet(records.map(record=>new URL(record.src,root)));
  if (!files) { t.diagnostic('Provider narration is excluded from the public release; lesson and manifest remain validated.'); return; }
  records.forEach((record,index)=>{const bytes=files[index];assert.equal(bytes.length,record.bytes);assert.equal(sha256(bytes),record.sha256);});
});
