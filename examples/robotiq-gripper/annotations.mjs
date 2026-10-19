import {BPM,CHAPTERS} from './story.mjs';
export const CUE_WINDOWS=Object.fromEntries(CHAPTERS.map(c=>[c.id,c.labels.map((_,i)=>[1.05+i*1.2,(c.lastBeat-c.firstBeat)*60/BPM])]));
export function annotationCues(state,{paused=false,cameraSettled=true}={}){
 if(!cameraSettled)return[];
 return CUE_WINDOWS[state.chapter.id].flatMap(([start,end],i)=>{
  if(state.localTime<start||state.localTime>=end)return[];
  const [id,text]=state.chapter.labels[i],opacity=paused?1:Math.max(0,Math.min(1,(state.localTime-start)/.2,(end-state.localTime)/.32));
  return[{id,text,index:i,start,end,opacity}];
 });
}
