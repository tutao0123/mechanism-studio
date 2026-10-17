import test from 'node:test';import assert from 'node:assert/strict';
import {readGlb,accessorValues,semanticNodes,sha256} from './glb.mjs';
import {writeGlb} from './write-glb.mjs';import {validateSceneContract} from './contract.mjs';
const fixture=()=>writeGlb({nodes:[{name:'root',extras:{assembly_id:'root'},children:[1]},{mesh:0,extras:{part_id:'part',motionOwner:'model'}}],scenes:[{nodes:[0]}],meshes:[{name:'part',positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,2]}]});
const contract=()=>({units:{asset:'m'},parts:[{part_id:'part',parent_id:'root',motionOwner:'model',rest:{translation:[0,0,0]},explode:[1,0,0]}]});
test('GLB detects a truncated payload, wrong length, duplicate identity and accessor overrun',()=>{
  const original=fixture();assert.equal(readGlb(original).json.meshes.length,1);assert.match(sha256(original),/^[0-9a-f]{64}$/);
  assert.throws(()=>readGlb(original.subarray(0,-4)),/length/);const bad=Buffer.from(original);bad.writeUInt32LE(1,4);assert.throws(()=>readGlb(bad),/format/);
  const {json,buffer}=readGlb(original);assert.deepEqual(accessorValues(json,buffer,0),[[0,0,0],[1,0,0],[0,1,0]]);
  json.accessors[0].count=999;assert.throws(()=>accessorValues(json,buffer,0),/fits/);json.nodes.push({...json.nodes[1]});assert.throws(()=>semanticNodes(json),/unique/);
});
test('contract rejects units, duplicate IDs, wrong parent, parent cycles, rest errors and motion conflicts',()=>{
  const original=readGlb(fixture()).json;validateSceneContract(original,contract());
  let c=contract();c.units.asset='mm';assert.throws(()=>validateSceneContract(original,c),/metres/);
  c=contract();c.parts.push({...c.parts[0]});assert.throws(()=>validateSceneContract(original,c),/unique/);
  c=contract();c.parts[0].parent_id=null;assert.throws(()=>validateSceneContract(original,c),/parent matches/);
  c=contract();c.parts[0].rest.translation=[0,1,0];assert.throws(()=>validateSceneContract(original,c),/rest/);
  let g=structuredClone(original);g.nodes[1].children=[0];assert.throws(()=>validateSceneContract(g,contract()),/acyclic/);
  g=structuredClone(original);g.animations=[{channels:[{target:{node:1,path:'translation'}}]}];assert.throws(()=>validateSceneContract(g,contract()),/clip-owned/);
  c=contract();c.parts[0].motionOwner='clip';g.nodes[1].extras.motionOwner='clip';validateSceneContract(g,c);
});
