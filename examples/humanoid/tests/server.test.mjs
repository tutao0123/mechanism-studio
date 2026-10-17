import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHumanoidServer, publicFile } from '../serve.mjs';
const server=createHumanoidServer();server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
test.after(()=>new Promise(resolve=>server.close(resolve)));
test('humanoid preview exposes actual viewing assets and source attribution',async()=>{
  for(const path of ['/','/app.mjs','/story.mjs','/annotations.mjs','/framing.mjs','/assets/humanoid.glb','/assets/scene-index.json','/assets/scene-contract.json','/source/provenance.json','/source/unitree_g1/LICENSE','/shared/study/study.mjs','/vendor/three/build/three.module.js'])assert.equal((await fetch(base+path,{method:'HEAD'})).status,200,path);
  const response=await fetch(base+'/assets/humanoid.glb',{headers:{Range:'bytes=0-31'}});assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,32);
});
test('humanoid preview blocks build scripts, raw sources, credentials and arbitrary recorded output',async()=>{
  for(const path of ['/build-humanoid.mjs','/source/download-source.ps1','/source/unitree_g1/g1.xml','/audio/build.mjs','/audio/sfx/click_003.wav','/shared/voice/speech-cli.mjs','/.env','/output/capture.json','/output/other.mp4'])assert.equal((await fetch(base+path)).status,403,path);
  assert.equal(publicFile('/../README.md'),null);
  assert.equal(publicFile('/source/../.env'),null);
  assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
});
