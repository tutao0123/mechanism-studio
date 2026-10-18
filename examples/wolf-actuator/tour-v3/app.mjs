import {createAssemblyStudy} from '/shared/study/study.mjs';
import {createStudyShell} from '/shared/study/shell.mjs';
import {createWolfTourV3Story,ramp} from './story.mjs';
import {createWolfTourV3Framing,CAMERA_UP} from './framing.mjs';
import {createWolfTourV2Annotations} from '../tour-v2/annotations.mjs';
import {createWolfTourV2Motion} from '../tour-v2/kinematics.mjs';
const title='WOLF, from whole to motion.';
const credit='WOLF by Anthrobotics · CC BY-SA 4.0\nSource-based motion & original score: Mechanism Studio';
createStudyShell({title,creditLabel:credit,sourceUrl:'https://github.com/Anthrobotics/wolf-actuator'});
try{
  const response=await fetch('../assets/scene-index.json');if(!response.ok)throw new Error('Could not load pinned source index');
  const index=await response.json(),timeline=createWolfTourV3Story(index),rig=createWolfTourV2Motion(index);
  window.wolfMeshTour=createAssemblyStudy({
    timeline,annotations:createWolfTourV2Annotations(timeline),cameraUp:CAMERA_UP,cameraContinuity:'authored',
    workingPoses:rig.workingPoses,presentationOpacity:timeline.opacityFor,labelObstacleIds:timeline.labelObstacleIds,detailIds:timeline.detailIds,
    appearanceCues:(state,cues)=>{
      if(state.chapter.id==='gearing'){const weight=ramp(state.beat,23,25)*(1-ramp(state.beat,39,41));return [{id:timeline.selectedPair.sun,weight:weight*.3},{id:timeline.selectedPair.planet,weight}];}
      if(state.chapter.id==='bearing-roll'){const weight=ramp(state.beat,89,90)*(1-ramp(state.beat,102,103));return[{id:timeline.bindings.bearingPart,weight}];}
      return cues.map(c=>({id:c.id,weight:c.opacity}));
    },
    createFraming:actual=>{if(actual.geometryRevision!==index.geometryRevision)throw new Error('Source revision changed');return createWolfTourV3Framing(actual,timeline,rig);},
    indexUrl:'../assets/scene-index.json',sourceUrl:'../source/provenance.json',assetUrl:'../assets/assembly.glb',contractUrl:'../assets/scene-contract.json',scoreUrl:'../tour-v2/music-score.json',audioUrl:'../tour-v2/audio/tour-loop.wav',
    title,documentTitle:'WOLF source motion tour · Mechanism Studio',sourceName:'Anthrobotics WOLF · CC BY-SA 4.0',creditLabel:credit,
    initialStatus:'85.71 s · 245 original parts · CAD-derived gearing and ideal crossed-roller motion.',
    playingStatus:'One continuous score · Working gears, crossed rollers, close-up details and full restoration.',
  });
}catch(error){document.getElementById('status').textContent=`Could not prepare WOLF motion: ${error.message}`;console.error(error);}
