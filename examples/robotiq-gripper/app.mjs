import {createAssemblyStudy} from '/shared/study/study.mjs';
import {createStudyShell} from '/shared/study/shell.mjs';
import {createGripperStory} from './story.mjs';
import {createGripperRig} from './kinematics.mjs';
import {createGripperFraming} from './framing.mjs';
import * as annotations from './annotations.mjs';
const title='A grasp, connected.';
const credit='Robotiq 2F-85 model © ROS-Industrial · BSD-2-Clause\nSource: MuJoCo Menagerie · Kinematic adaptation\nMechanism Studio · Original synthesized score';
createStudyShell({title,creditLabel:credit});
document.querySelector('.eyebrow').textContent='A study in coupled motion.';
document.querySelector('.figure-index').textContent='Robotiq 2F-85 / Linkage study';
document.querySelector('.intro-note').textContent='One command. Two fingers. One closed loop on each side.';
try{
 const response=await fetch('/assets/scene-index.json');if(!response.ok)throw new Error('Source index unavailable');
 const index=await response.json(),timeline=createGripperStory(index),rig=createGripperRig(index);
 window.robotiqShowcase=createAssemblyStudy({
  timeline,annotations,workingPoses:rig.workingPoses,detailIds:timeline.detailIds,
  cameraCuts:timeline.CAMERA_CUTS,cameraTransitionSeconds:.8,
  createFraming:actual=>createGripperFraming(actual,timeline,rig),
  appearanceCues:(s,labels)=>labels.map(c=>({id:c.id,weight:c.opacity*.65})),
  indexUrl:'/assets/scene-index.json',sourceUrl:'/source/provenance.json',assetUrl:'/assets/assembly.glb',contractUrl:'/assets/scene-contract.json',
  scoreUrl:'/audio/music-score.json',audioUrl:'/audio/showcase-loop.wav',
  title,documentTitle:'Robotiq gripper, connected · Mechanism Studio',creditLabel:credit,sourceName:'Robotiq 2F-85 via MuJoCo Menagerie · BSD-2-Clause',
  initialStatus:'35.56 s · Source body inspection and closed-loop kinematics. No contact or force simulation.',
  playingStatus:'One music clock · Coupled grasp, source link separation and complete reassembly.',
 });
 window.robotiqRig=rig;
}catch(error){document.getElementById('status').textContent=`Could not prepare the gripper: ${error.message}`;console.error(error);}
