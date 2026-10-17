const clamp=value=>Math.max(0,Math.min(1,value));
export function createWolfMotorAnnotations(story){
  const starts={whole:[.45,2],motor:[1.2,2.35],layers:[1.25,2.5],repeats:[.95,2.15],hardware:[.95,2.15],return:[.95],resolve:[.95,2.15]};
  const CUE_WINDOWS=Object.freeze(Object.fromEntries(story.CHAPTERS.map(c=>[c.id,Object.freeze(starts[c.id].map(start=>Object.freeze([start,(c.lastBeat-c.firstBeat)*60/story.BPM])))])));
  function annotationCues(state,{paused=false,cameraSettled=true}={}){
    if(!cameraSettled)return[];
    return CUE_WINDOWS[state.chapter.id].flatMap(([start,end],index)=>{
      if(state.localTime<start||state.localTime>=end)return[];const[id,text]=state.chapter.labels[index];
      return[{id,text,index,start,end,opacity:paused?1:Math.min(clamp((state.localTime-start)/.18),clamp((end-state.localTime)/.32))}];
    });
  }
  return {CUE_WINDOWS,annotationCues,ANNOTATION_REVISION:'wolf-motor-annotations-1'};
}
