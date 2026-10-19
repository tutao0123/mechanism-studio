import { BPM, CHAPTERS } from './story.mjs';
export const CUE_WINDOWS=Object.fromEntries(CHAPTERS.map(c=>[c.id,({separate:[4.15,5.4],detail:[2.15,3.55],resolve:[1.8]}[c.id]??[]).map(start=>[start,(c.lastBeat-c.firstBeat)*60/BPM])]));
export function annotationCues(state,{paused=false,cameraSettled=true}={}){
 if(!cameraSettled)return[];
 return CUE_WINDOWS[state.chapter.id].flatMap(([start,end],index)=>{
  if(state.localTime<start||state.localTime>=end)return[];
  const[id,text]=state.chapter.labels[index];
  const opacity=paused?1:Math.min(1,(state.localTime-start)/.2,(end-state.localTime)/.32);
  return[{id,text,index,start,end,opacity:Math.max(0,opacity)}];
 });
}
