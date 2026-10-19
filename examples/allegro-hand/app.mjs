import {createAssemblyStudy} from '/shared/study/study.mjs';
import {createStudyShell} from '/shared/study/shell.mjs';
import {createHandStory} from './story.mjs';
import {createHandFraming,CAMERA_UP} from './framing.mjs';
import * as annotations from './annotations.mjs';
const title='Allegro, link by link.';
const credit='Allegro Hand V3 · SimLab / Wonik · BSD-2-Clause\nMuJoCo Menagerie · Presentation & score: Mechanism Studio';
createStudyShell({title,creditLabel:credit,sourceUrl:'https://github.com/google-deepmind/mujoco_menagerie/tree/62ab00f2bc44f6f20c1c9b7a13f3fb1dd41a4e35/wonik_allegro'});
try{
 const read=async path=>{const r=await fetch(path);if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);return r.json();};
 const[index,source]=await Promise.all([read('./assets/scene-index.json'),read('./assets/source-assembly.json')]);
 const timeline=createHandStory(index,source);
 window.allegroStudy=createAssemblyStudy({timeline,annotations,cameraUp:CAMERA_UP,cameraContinuity:'authored',workingPoses:timeline.rig.workingPoses,presentationOpacity:timeline.opacityFor,labelObstacleIds:timeline.labelObstacleIds,
  createFraming:actual=>{if(actual.geometryRevision!==index.geometryRevision)throw new Error('Geometry revision changed');return createHandFraming(actual,timeline);},
  appearanceCues:()=>[],indexUrl:'./assets/scene-index.json',sourceUrl:'./source/provenance.json',assetUrl:'./assets/assembly.glb',contractUrl:'./assets/scene-contract.json',scoreUrl:'./audio/music-score.json',audioUrl:'./audio/showcase-loop.wav',
  title,documentTitle:'Allegro Hand · Mechanism Studio',sourceName:'Allegro Hand V3 · BSD-2-Clause',creditLabel:credit,
  initialStatus:'35.56 s · 21 source link meshes · 16 source hinge joints · Authored joint poses.',playingStatus:'Original score · Source-axis gestures, one finger close-up, and complete reassembly.',
 });
}catch(error){document.getElementById('status').textContent=`Could not prepare Allegro: ${error.message}`;console.error(error);}
