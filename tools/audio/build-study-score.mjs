import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createStudyScore, renderStudyScore, encodeStudyWav, sha256 } from './study-score.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const variants={'examples/allegro-hand':{variant:'hand',title:'Allegro / Four fingers, sixteen joints'},'examples/robotiq-gripper':{variant:'gripper',title:'Robotiq / A parallel relationship'}};
export async function buildStudyScore(example){
  if(!Object.hasOwn(variants,example))throw new Error('Choose examples/allegro-hand or examples/robotiq-gripper.');
  const directory=resolve(root,example),read=async path=>JSON.parse(await readFile(resolve(directory,path),'utf8'));
  const index=await read('assets/scene-index.json'),assembly=await read('assets/source-assembly.json');
  const module=await import(pathToFileURL(resolve(directory,'story.mjs')));
  const story=module.createMusicStory(index,assembly),score=createStudyScore(story,index,variants[example]);
  const {bytes,analysis}=encodeStudyWav(renderStudyScore(score));
  if(analysis.loopBoundaryStep>.012||analysis.rmsDbfs < -34 || analysis.rmsDbfs > -17)throw new Error('Audio continuity/headroom check failed.');
  const metadata={...score,file:'showcase-loop.wav',byteLength:bytes.length,sha256:sha256(bytes),analysis};
  await mkdir(resolve(directory,'audio'),{recursive:true});
  await writeFile(resolve(directory,'audio/showcase-loop.wav'),bytes);
  await writeFile(resolve(directory,'audio/music-score.json'),JSON.stringify(metadata,null,2)+'\n');
  return metadata;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==4||process.argv[2]!=='--example')throw new Error('Usage: node tools/audio/build-study-score.mjs --example examples/<id>');
  const value=await buildStudyScore(process.argv[3]);console.log(JSON.stringify({edition:value.edition,durationSeconds:value.durationSeconds,sha256:value.sha256,analysis:value.analysis},null,2));
}
