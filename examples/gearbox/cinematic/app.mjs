import * as THREE from 'three';
import { createGearboxStory } from '../story.mjs';
import { DURATION, sourceTimeAt, shotAt } from './timeline.mjs';
import { cameraAt } from './camera.mjs';
import { createCinematicRenderer } from './renderer.mjs';

const output=document.getElementById('film'),ctx=output.getContext('2d',{alpha:false});
const W=1920,H=1080,renderMode=new URLSearchParams(location.search).get('render')==='1';
if(renderMode)document.body.classList.add('render');
const audio=new Audio('/cinematic/audio/gearbox-cinematic-loop.wav');audio.loop=true;audio.preload='auto';
let engine,story,index,time=0,playing=false,music=false,last=0,rendering=false,lastExport=-1;
const clamp=v=>Math.min(1,Math.max(0,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const status=text=>document.getElementById('status').textContent=text;
function text(value,x,y,{size=30,weight=400,color='#e4edf3',spacing=0,alpha=1}={}){
  ctx.save();ctx.globalAlpha=alpha;ctx.font=`${weight} ${size}px "Segoe UI",Arial,sans-serif`;ctx.fillStyle=color;ctx.textBaseline='alphabetic';ctx.letterSpacing=`${spacing}px`;ctx.fillText(value,x,y);ctx.restore();
}
function frameState(seconds){
  const sourceState=story.stateAt(sourceTimeAt(seconds)),offsetsWorld={...sourceState.offsetsWorld};
  // This edition also moves the fading housing toward rest on return. These
  // remain display-only offsets, not a collision-checked service procedure.
  if(sourceState.time>=33.4375)for(const [id,v]of story.caseParts)offsetsWorld[id]=v.map(n=>n*sourceState.progress.case);
  const powers=new Map();
  for(const {gear,weight} of sourceState.drive.path)for(const id of story.powerPathIds(gear))powers.set(id,Math.max(powers.get(id)||0,weight));
  const focused=new Set(story.FOCUS.ids);
  return {time:seconds,sourceState,workingPoses:story.workingPoses(sourceState),offsetsLocal:story.localDisplayOffsets(index,offsetsWorld,THREE.Matrix4,THREE.Vector3),
    opacityFor:id=>story.caseParts.has(id)?story.presentationOpacity(sourceState,id):(focused.has(id)?1:1-.96*sourceState.progress.focus),
    powerIds:powers,camera:cameraAt(seconds),effect:{lightSweep:.5-.5*Math.cos(seconds*Math.PI*2/DURATION),power:1}};
}
function compose(seconds){
  const state=frameState(seconds), {shot,index:shotIndex,localTime}=shotAt(seconds);
  const rendered=engine.render(state);ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.drawImage(rendered,0,0,W,H);
  const edge=ctx.createRadialGradient(W*.52,H*.43,H*.2,W*.52,H*.43,W*.64);edge.addColorStop(0,'rgba(3,7,13,0)');edge.addColorStop(1,'rgba(2,5,11,.62)');ctx.fillStyle=edge;ctx.fillRect(0,0,W,H);
  const lower=ctx.createLinearGradient(0,735,0,H);lower.addColorStop(0,'rgba(4,8,14,0)');lower.addColorStop(.6,'rgba(4,8,14,.82)');lower.addColorStop(1,'rgba(4,8,14,.98)');ctx.fillStyle=lower;ctx.fillRect(0,735,W,345);
  ctx.fillStyle='#060a10';ctx.fillRect(0,0,W,86);ctx.fillRect(0,1030,W,50);
  ctx.fillStyle='#74dbe5';ctx.fillRect(76,32,3,28);
  text('MECHANISM STUDIO',96,54,{size:24,weight:600,spacing:5,color:'#cad8e4'});
  text('TRANSMISSION / REVEALED',1340,53,{size:22,weight:500,spacing:3,color:'#788d9d'});
  const fade=Math.min(smooth(localTime/.28),smooth((shot.end-seconds)/.22));
  text(`${String(shotIndex+1).padStart(2,'0')}  /  MOTION STUDY`,82,838,{size:22,weight:600,spacing:4,color:'#7ad9e3',alpha:fade});
  text(shot.title,78,926,{size:76,weight:650,spacing:-1.8,alpha:fade});
  text(shot.subtitle,82,984,{size:42,color:'#a4b5c3',alpha:fade});
  text('ORIGINAL TEACHING MODEL · IDEAL KINEMATICS',82,1061,{size:18,spacing:1.3,color:'#657987'});
  text('MIT  /  MECHANISM STUDIO',1500,1061,{size:18,spacing:1.2,color:'#657987'});
  ctx.fillStyle='#233945';ctx.fillRect(82,1012,1756,2);ctx.fillStyle='#76d7df';ctx.fillRect(82,1012,1756*seconds/DURATION,2);
  time=seconds;document.getElementById('seek').value=seconds;
  return output;
}
async function init(){
  await document.fonts.ready;
  const response=await fetch('/assets/scene-index.json');if(!response.ok)throw new Error('Scene index unavailable.');index=await response.json();story=createGearboxStory(index);
  engine=await createCinematicRenderer({canvas:document.createElement('canvas'),width:W,height:H,index});
  compose(0);status('24 seconds · Direct rendering · Original synthesized score · Teaching model');return true;
}
const ready=init().catch(error=>{status(error.message);console.error(error);throw error;});
async function play(){await ready;rendering=false;music=true;audio.currentTime=time;await audio.play();playing=true;last=0;status('Playing with the original cinematic score.');}
function pause(){playing=false;audio.pause();music=false;last=0;}
document.getElementById('play').onclick=()=>play().catch(error=>status(audio.error?'The score is not built yet. Run npm run build:audio, then reload.':`Audio could not start: ${error.message}`));
document.getElementById('pause').onclick=pause;
document.getElementById('restart').onclick=async()=>{pause();await ready;compose(0);};
document.getElementById('seek').oninput=async event=>{pause();await ready;compose(Number(event.target.value)%DURATION);};
function tick(now){if(playing&&!rendering&&engine){const t=music?audio.currentTime%DURATION:(time+(last?(now-last)/1000:0))%DURATION;compose(t);last=now;}requestAnimationFrame(tick);}
requestAnimationFrame(tick);
window.gearboxCinema={ready,
  async start(){await ready;pause();rendering=true;lastExport=-1;compose(0);},
  async frame(seconds){await ready;if(!rendering||seconds<lastExport||seconds<0||seconds>=DURATION)throw new RangeError('Start an export and advance within 0–24 seconds.');lastExport=seconds;return compose(seconds).toDataURL('image/jpeg',.96);},
  stop(){rendering=false;pause();},
  seek:async seconds=>{await ready;pause();return compose(seconds);},
  snapshot:()=>({time,duration:DURATION,width:W,height:H,method:'direct-webgl-and-canvas-graphics',sourceTime:sourceTimeAt(time),engine:engine?.snapshot()}),
};
