import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createWolfMotorDetail} from './story.mjs';
import {createWolfMotorAnnotations} from './annotations.mjs';
const read=async file=>JSON.parse(await readFile(new URL(file,import.meta.url),'utf8'));
const index=await read('../assets/scene-index.json'),story=createWolfMotorDetail(index),annotations=createWolfMotorAnnotations(story),score=await read('music-score.json');
const wav=await readFile(new URL('audio/motor-loop.wav',import.meta.url));
if(score.sha256!==createHash('sha256').update(wav).digest('hex')||score.byteLength!==wav.length||score.bpm!==story.BPM||Math.abs(score.durationSeconds-story.DURATION)>1/score.sampleRate)throw new Error('Rebuild the component score before its authoring plan.');
const step=1/120;let moving=0,longest=0,still=0;
for(let t=0;t<story.DURATION-step;t+=step){const a=story.stateAt(t),b=story.stateAt(t+step),active=index.parts.some(p=>a.offsetsWorld[p.id].some((v,i)=>Math.abs(v-b.offsetsWorld[p.id][i])>1e-9));if(active){moving+=step;still=0;}else{still+=step;longest=Math.max(longest,still);}}
const plan={schemaVersion:'1.1.0',stage:'bound',planRevision:story.PLAN_REVISION,geometryRevision:index.geometryRevision,sourceSHA256:index.sourceSHA256,
  sourceComponentId:story.bindings.motor,sourceComponentName:'motor-8318 <1>',sourcePartCount:86,sourceGroups:{magnet:40,cc:40,namedHardware:6},
  identityPolicy:'Original occurrences only. The single-magnet close-up translates the selected occurrence and changes camera magnification; no cloned or scaled part. The generic cc source name remains unspecified.',
  durationSeconds:story.DURATION,bpm:story.BPM,chapters:story.CHAPTERS,groups:story.GROUPS,motionEvents:story.MOTION_EVENTS,maximumOffsets:story.MAXIMUM_OFFSETS,pathMaximumOffsets:story.PATH_MAXIMUM_OFFSETS,focusOffset:story.FOCUS_OFFSET,
  bindings:story.bindings,editorialAxis:story.editorialAxis,annotationWindows:annotations.CUE_WINDOWS,
  presentation:{camera:'Continuous authored path on story time; reduced-motion still plans.',context:'Owned solid and feature-line alpha fades; no source hierarchy changes.',closeup:'Follow one real magnet out of its ring, inspect, pull back, return before reassembly.'},
  diagnostics:{method:'120 Hz finite differences of display offsets; excludes camera and opacity motion, threshold 1e-9 metres per sample.',movingSeconds:moving,movingFraction:moving/story.DURATION,longestUnmovingIntervalSeconds:longest},
  music:{file:'audio/motor-loop.wav',sha256:score.sha256,byteLength:score.byteLength,edition:score.edition},
  limitations:['Display-only explosion; not collision-checked service disassembly.','STEP placements do not supply validated motor or gear constraints.','No inferred winding function, per-turn detail, magnetic force, current, balance or dynamics.','Motor source contains one named hex nut; mounting screws are not added from the upstream BOM.']};
await writeFile(new URL('plan.json',import.meta.url),`${JSON.stringify(plan,null,2)}\n`);
console.log(JSON.stringify({component:plan.sourceComponentId,planRevision:story.PLAN_REVISION,scoreEdition:score.edition,...plan.diagnostics}));
