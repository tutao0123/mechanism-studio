import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {bindAssembly,visibleBounds} from '../../../shared/viewer/scene.mjs';
import {createEngineProcessEffects} from '../effects.mjs';
import {processState,PROCESS} from '../process.mjs';

test('gas geometry follows piston volume and the same paused input reproduces every effect transform',t=>{
  const effects=createEngineProcessEffects(THREE);t.after(()=>effects.dispose());
  const snapshot=processState(450);effects.update(snapshot);
  const first=effects.group.getObjectByName('cylinder-1/process'),gas=first.getObjectByName('illustrative-charge-volume');
  assert.equal(gas.scale.y,snapshot.cylinders[0].heightMM*.001);
  assert.equal(gas.position.y,(snapshot.cylinders[0].topMM+snapshot.cylinders[0].bottomMM)*.0005);
  assert.equal(gas.scale.x,PROCESS.chamberRadiusMM*.001);
  const positions=()=>{const data=[];effects.group.traverse(o=>{data.push([o.name,o.position.toArray(),o.scale.toArray(),o.visible]);if(o.isInstancedMesh)data.push(Array.from(o.instanceMatrix.array));});return data;};
  const before=positions();effects.update(processState(450));assert.deepEqual(positions(),before);
  assert.equal(first.getObjectByName('schematic-port-fuel-spray').visible,true);
  effects.update(processState(630));assert.equal(first.getObjectByName('schematic-port-fuel-spray').visible,false);
  for(const flags of [{explode:.5},{cutaway:false},{enabled:false}]){effects.update(processState(5,flags));assert.equal(effects.group.visible,false);}
  effects.update(processState(5));assert.equal(effects.group.visible,true);
});

test('process helpers do not enter actual asset identities, picking, geometry or fitted bounds',async t=>{
  const bytes=await readFile(new URL('../assets/inline-four.glb',import.meta.url));
  const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const scene=new THREE.Scene();scene.add(asset.scene);const binding=bindAssembly(asset.scene);
  const before=visibleBounds(binding.meshes),sources=binding.meshes.map(mesh=>({geometry:mesh.geometry,material:mesh.material}));
  const effects=createEngineProcessEffects(THREE);t.after(()=>effects.dispose());scene.add(effects.group);effects.update(processState(90));
  assert.equal(binding.parts.size,46);assert.equal(binding.meshes.length,423);
  const after=visibleBounds(binding.meshes);assert.deepEqual(after.min.toArray(),before.min.toArray());assert.deepEqual(after.max.toArray(),before.max.toArray());
  binding.meshes.forEach((mesh,i)=>{assert.equal(mesh.geometry,sources[i].geometry);assert.equal(mesh.material,sources[i].material);});
  const hits=[];effects.group.traverse(node=>{assert.equal(node.userData.part_id,undefined);node.raycast(new THREE.Raycaster(),hits);});assert.equal(hits.length,0);
  effects.dispose();effects.dispose();assert.equal(effects.group.parent,null);
});

test('visible ignition star stays inside the actual open front chamber instead of behind the intake disc',t=>{
  const effects=createEngineProcessEffects(THREE);t.after(()=>effects.dispose());
  for(const angle of [0,5,13.9]){
    const snapshot=processState(angle);effects.update(snapshot);effects.group.updateMatrixWorld(true);
    const cylinder=snapshot.cylinders[0],star=effects.group.getObjectByName('cylinder-1/process').getObjectByName('visible-chamber-spark-star');
    assert.equal(star.visible,true);assert.equal(star.position.z,.027,'front half of the cutaway, toward the side/valve camera');
    const bounds=new THREE.Box3().setFromObject(star);
    assert.ok(bounds.min.y>cylinder.bottomMM*.001,'all branches stay above the piston crown');
    assert.ok(bounds.max.y<cylinder.topMM*.001,'all branches stay below the display chamber roof');
    assert.ok(Math.max(Math.abs(bounds.min.x-cylinder.xMM*.001),Math.abs(bounds.max.x-cylinder.xMM*.001))<.008);
    assert.ok(Math.hypot(.008,Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z)))<PROCESS.chamberRadiusMM*.001);
    star.traverse(o=>{if(o.isMesh)assert.equal(o.material.depthTest,true,'the marker cannot shine through the opaque source model');});
  }
  effects.update(processState(14));assert.equal(effects.group.getObjectByName('visible-chamber-spark-star').visible,false);
});

test('port spray stays on the unobscured external intake segment and meets the blue entrance',t=>{
  const effects=createEngineProcessEffects(THREE);t.after(()=>effects.dispose());
  const snapshot=processState(90);effects.update(snapshot);effects.group.updateMatrixWorld(true);
  const fourth=effects.group.getObjectByName('cylinder-4/process'),spray=fourth.getObjectByName('schematic-port-fuel-spray');
  assert.equal(spray.visible,true);
  const bounds=new THREE.Box3().setFromObject(spray);
  assert.ok(bounds.min.z>.1,'spray remains at body Y < −100 mm, ahead of head/valves and their occlusion');
  assert.ok(bounds.max.y<.295&&bounds.min.y>.25,'spray and its short rear nozzle stay near the intake runner height');
  const nozzle=spray.getObjectByName('schematic-external-injector-anchor');assert.ok(nozzle);assert.equal(nozzle.material.depthTest,true);
  const trace=spray.children.find(o=>o.isMesh&&!o.isInstancedMesh&&o.name!=='schematic-external-injector-anchor');
  const last=trace.geometry.parameters.path.getPointAt(1);
  assert.ok(last.distanceTo(new THREE.Vector3(.156,.257,.112))<1e-12,'gold reaches the exact blue intake first point');
  effects.update(processState(270));assert.equal(spray.visible,false,'fuel spray disappears outside the intake stroke');
});
