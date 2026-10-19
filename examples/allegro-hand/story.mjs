import { createHandMotion } from './motion.mjs';
export const BPM=108, TOTAL_BEATS=64, DURATION=TOTAL_BEATS*60/BPM, PLAN_REVISION='allegro-source-study-1';
export const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*t*(10+t*(-15+6*t));};
export const ramp=(t,a,b)=>smooth((t-a)/(b-a));
export function normalizeTime(seconds){if(!Number.isFinite(seconds))throw new TypeError('Finite story time required');const t=((seconds%DURATION)+DURATION)%DURATION;return t<1e-9||DURATION-t<1e-9?0:t;}
export const CHAPTERS=[
 {id:'gesture',firstBeat:0,lastBeat:12,title:'Sixteen joints. One hand.',copy:'Three fingers curl. The thumb turns toward them.',labels:[]},
 {id:'opposition',firstBeat:12,lastBeat:22,title:'Opposition changes the reach.',copy:'The thumb approaches from a different axis.',labels:[]},
 {id:'separate',firstBeat:22,lastBeat:34,title:'Four chains, revealed.',copy:'Separate the links to see how each finger is built.',labels:[['mjcf:palm','Palm'],['mjcf:mf_proximal','Finger link']]},
 {id:'detail',firstBeat:34,lastBeat:46,title:'One finger. Four hinges.',copy:'Side motion at the base. Flexion along the finger.',labels:[['mjcf:ff_base','Base joint'],['mjcf:ff_proximal','Flexion link']]},
 {id:'restore',firstBeat:46,lastBeat:58,title:'Every link returns.',copy:'The same source parts return along their display paths.',labels:[]},
 {id:'resolve',firstBeat:58,lastBeat:64,title:'Whole again.',copy:'A source-based motion study, ready to repeat.',labels:[['mjcf:palm','Allegro Hand V3']]},
].map(c=>Object.freeze({...c,labels:Object.freeze(c.labels)}));
export const MUSIC_EVENTS=Object.freeze([
 {id:'finger-flex',beat:1,kind:'motion',level:.38,partIds:['mjcf:ff_proximal','mjcf:mf_proximal','mjcf:rf_proximal']},
 {id:'thumb-opposition',beat:13,kind:'motion',level:.32,partIds:['mjcf:th_base','mjcf:th_proximal']},
 {id:'chains-release',beat:22.5,kind:'release',level:.4,partIds:['mjcf:ff_base','mjcf:mf_base','mjcf:rf_base','mjcf:th_base']},
 {id:'finger-detail',beat:36.8,kind:'detail',level:.22,partIds:['mjcf:ff_base','mjcf:ff_proximal']},
 {id:'last-chain-seat',beat:57,kind:'seat',level:.38,partIds:['mjcf:ff_base','mjcf:ff_proximal','mjcf:ff_medial','mjcf:ff_distal','mjcf:ff_tip']},
 {id:'whole-resolve',beat:60,kind:'resolve',level:.25,partIds:['mjcf:palm']},
]);
export const DETAIL_IDS=Object.freeze(['base','proximal','medial','distal','tip'].map(n=>`mjcf:ff_${n}`));
export function createHandStory(index,sourceAssembly){
 const rig=createHandMotion(index,sourceAssembly),ids=index.parts.map(p=>p.id),detailSet=new Set(DETAIL_IDS);
 for(const id of DETAIL_IDS)if(!ids.includes(id))throw new Error(`Missing source detail ${id}`);
 const maximumOffsets=Object.fromEntries(index.parts.map(p=>{
   const name=p.id.replace(/^mjcf:/,''),[finger,link]=name.split('_');
   if(name==='palm')return[p.id,[0,0,0]];
   const rank=['base','proximal','medial','distal','tip'].indexOf(link);
   const cohort={ff:[-.05,.014],mf:[0,0],rf:[.05,.014],th:[-.06,-.045]}[finger];
   if(rank<0||!cohort)throw new Error(`Unmapped source part ${p.id}`);
   return[p.id,[.013*(rank+1),cohort[1],-cohort[0]]];
 }));
 function stateAt(seconds){
   const time=normalizeTime(seconds),beat=time*BPM/60;
   const chapterIndex=Math.max(0,CHAPTERS.findIndex(c=>beat>=c.firstBeat-1e-9&&beat<c.lastBeat-1e-9)),chapter=CHAPTERS[chapterIndex];
   const offsetsWorld=Object.fromEntries(ids.map(id=>{
     const f=id.slice(5,7),order={ff:0,mf:1,rf:2,th:3}[f];
     const amount=order===undefined?0:ramp(beat,22+order*.7,24.6+order*.7)*(1-ramp(beat,50+(3-order)*1,54+(3-order)*1));
     return[id,maximumOffsets[id].map(v=>v*amount)];
   }));
   const angles=rig.neutralAngles();
   const flex=ramp(beat,1,4.5)*(1-ramp(beat,7,10.5));
   for(const [j,phase] of [['ff',0],['mf',.15],['rf',.3]]){
     const strength=ramp(beat,1+phase,4.5+phase)*(1-ramp(beat,7+phase,10.5+phase));
     angles[`${j}j0`]=({ff:.07,mf:0,rf:-.07}[j])*strength||0;
     angles[`${j}j1`]=.65*strength;angles[`${j}j2`]=.76*strength;angles[`${j}j3`]=.48*strength;
   }
   angles.thj0+=.27*flex;angles.thj1=.22*flex;angles.thj2=.32*flex;angles.thj3=.2*flex;
   const oppose=ramp(beat,12.5,15.5)*(1-ramp(beat,18,21));
   angles.thj0+=.46*oppose;angles.thj1+=.45*oppose;angles.thj2+=.3*oppose;angles.thj3+=.12*oppose;
   angles.ffj1+=.16*oppose;angles.ffj2+=.18*oppose;
   return {time,beat,chapter,chapterIndex,localTime:time-chapter.firstBeat*60/BPM,offsetsWorld,angles};
 }
 function localDisplayOffsets(_,offsetsWorld,Matrix4,Vector3){
   const parts=new Map(rig.neutralIndex.parts.map(p=>[p.id,p]));return new Map(rig.neutralIndex.parts.map(p=>{
     const own=offsetsWorld[p.id];if(!Array.isArray(own)||own.length!==3||!own.every(Number.isFinite))throw new Error(`Invalid offset ${p.id}`);
     const parent=parts.get(p.parentId),inherited=parent?offsetsWorld[parent.id]:[0,0,0],v=new Vector3(...own).sub(new Vector3(...inherited));
     if(parent){const inverse=new Matrix4().fromArray(parent.worldMatrix).invert(),o=new Vector3().applyMatrix4(inverse);v.applyMatrix4(inverse).sub(o);}
     return[p.id,v.toArray()];
   }));
 }
 function opacityFor(state,id){if(detailSet.has(id))return 1;return 1-ramp(state.beat,34,35.5)*(1-ramp(state.beat,49,50));}
 return {BPM,TOTAL_BEATS,DURATION,PLAN_REVISION,CHAPTERS,MUSIC_EVENTS,normalizeTime,stateAt,localDisplayOffsets,rig,maximumOffsets,opacityFor,labelObstacleIds:state=>state.beat>=35.5&&state.beat<=49?DETAIL_IDS:ids};
}
export const createMusicStory=createHandStory;
