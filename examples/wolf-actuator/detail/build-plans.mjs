import {readFile,writeFile} from 'node:fs/promises';
import {createWolfMotorDetail} from './story.mjs';
import {createWolfMotorAnnotations} from './annotations.mjs';
const read=async file=>JSON.parse(await readFile(new URL(file,import.meta.url),'utf8'));
const index=await read('../assets/scene-index.json'),story=createWolfMotorDetail(index),annotations=createWolfMotorAnnotations(story),original=await read('../audio/music-score.json');
const score=structuredClone(original);
function rebind(value){
  if(!value||typeof value!=='object')return;
  if(value.animation){
    const group=story.GROUPS.find(g=>(value.animation.phase==='explode'?g.outBeat:g.inBeat)===value.animation.firstBeat);
    if(!group)throw new Error('Source score does not share this action beat grid');
    value.id=value.id?.replace(value.animation.groupId,group.id);value.animation.groupId=group.id;value.animation.partIds=[...group.ids];
  }
  for(const child of Object.values(value))if(child&&typeof child==='object')rebind(child);
}
rebind(score);
score.title='WOLF / Motor Component Study';score.edition='wolf-motor-detail-quiet-rebind-v1';score.file='../audio/wolf-loop.wav';
score.compositionReuse={source:'../audio/music-score.json',sourceEdition:original.edition,pcmChanged:false,
  note:'Byte-identical original WOLF PCM. This metadata rebinds the same eight two-beat motion and four seating accents to source motor occurrences, at the same beats; no new sound or inference of physical motor sound.'};
score.geometryRevision=index.geometryRevision;score.sourceSHA256=index.sourceSHA256;
const plan={schemaVersion:'1.0.0',stage:'bound',planRevision:story.PLAN_REVISION,geometryRevision:index.geometryRevision,sourceSHA256:index.sourceSHA256,
  sourceComponentId:story.bindings.motor,sourceComponentName:'motor-8318 <1>',sourcePartCount:86,sourceGroups:{magnet:40,cc:40,namedHardware:6},
  identityPolicy:'Original source occurrence paths and labels; cc has no assigned function. The component is from WOLF, not the G1 humanoid.',
  durationSeconds:story.DURATION,bpm:story.BPM,chapters:story.CHAPTERS,groups:story.GROUPS,maximumOffsets:story.MAXIMUM_OFFSETS,
  bindings:story.bindings,editorialAxis:story.editorialAxis,annotationWindows:annotations.CUE_WINDOWS,music:{file:'../audio/wolf-loop.wav',sha256:score.sha256,byteLength:score.byteLength,edition:score.edition},
  limitations:['Display-only explosion; not collision-checked service disassembly.','STEP placements do not supply validated motor or gear constraints.','No inferred winding function, per-turn detail, magnetic force, current, balance or dynamics.','Motor source contains one named hex nut; mounting screws are not added from the upstream BOM.']};
await writeFile(new URL('music-score.json',import.meta.url),`${JSON.stringify(score,null,2)}\n`);
await writeFile(new URL('plan.json',import.meta.url),`${JSON.stringify(plan,null,2)}\n`);
console.log(JSON.stringify({component:plan.sourceComponentId,sourcePartCount:86,scoreEdition:score.edition,sha256:score.sha256,pcmChanged:false}));
