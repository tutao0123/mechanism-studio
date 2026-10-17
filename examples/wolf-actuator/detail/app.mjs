import {createAssemblyStudy} from '/shared/study/study.mjs';
import {createStudyShell} from '/shared/study/shell.mjs';
import {createWolfMotorDetail} from './story.mjs';
import {createWolfMotorAnnotations} from './annotations.mjs';
import {createWolfMotorFraming,CAMERA_UP} from './framing.mjs';

const title='Inside a WOLF actuator.';
const credit='WOLF by Anthrobotics · CC BY-SA 4.0\nMotor component study & original score: Mechanism Studio';
createStudyShell({title,creditLabel:credit,sourceUrl:'https://github.com/Anthrobotics/wolf-actuator'});
try{
  const response=await fetch('../assets/scene-index.json');if(!response.ok)throw new Error(`Actual source index: HTTP ${response.status}`);
  const index=await response.json(),timeline=createWolfMotorDetail(index);
  window.wolfMotorDetail=createAssemblyStudy({timeline,annotations:createWolfMotorAnnotations(timeline),cameraUp:CAMERA_UP,
    cameraCuts:['motor','layers','repeats','hardware','return','resolve'],
    createFraming:actual=>{if(actual.geometryRevision!==index.geometryRevision)throw new Error('Source revision changed during initialization');return createWolfMotorFraming(actual,timeline);},
    detailIds:timeline.detailIds,indexUrl:'../assets/scene-index.json',sourceUrl:'../source/provenance.json',assetUrl:'../assets/assembly.glb',contractUrl:'../assets/scene-contract.json',
    scoreUrl:'./music-score.json',audioUrl:'../audio/wolf-loop.wav',title,documentTitle:'WOLF motor component study · Mechanism Studio',
    sourceName:'Anthrobotics WOLF · CC BY-SA 4.0',creditLabel:credit,
    initialStatus:`${timeline.DURATION.toFixed(2)} s · 86 actual motor occurrences · “cc” is the original unspecified source name · Separate from the G1 humanoid.`,
    playingStatus:'Original quiet WOLF score · Four separation and reverse seating beats drive the component study.',
  });
}catch(error){document.getElementById('status').textContent=`Could not prepare the motor component study: ${error.message}`;console.error(error);}
