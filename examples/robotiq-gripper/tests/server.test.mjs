import test from 'node:test';
import assert from 'node:assert/strict';
import {createGripperServer,publicFile} from '../serve.mjs';
test('preview allowlist exposes the adapter, source notice and generated asset while excluding private inputs',()=>{
 for(const p of ['/','/app.mjs','/kinematics.mjs','/assets/assembly.glb','/source/LICENSE','/audio/showcase-loop.wav'])assert.ok(publicFile(p),p);
 for(const p of ['/source/assets/base.stl','/.env','/output/server.log','/source/../README.md','/source\\provenance.json','/package.json'])assert.equal(publicFile(p),null,p);
});
test('HTTP asset ranges and local transport methods work without exposing private output',async()=>{
 const server=createGripperServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const root=await fetch(base+'/');assert.equal(root.status,200);assert.match(await root.text(),/Robotiq/);
  const js=await fetch(base+'/kinematics.mjs');assert.equal(js.status,200);assert.match(js.headers.get('content-type'),/javascript/);
  const range=await fetch(base+'/assets/assembly.glb',{headers:{Range:'bytes=0-11'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,12);
  assert.equal((await fetch(base+'/output/server.log')).status,403);
  assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
