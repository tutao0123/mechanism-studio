import {createWolfTourV3Story} from '../tour-v3/story.mjs';
export {BPM,TOTAL_BEATS,DURATION,normalizeTime,ramp,localDisplayOffsets,SOURCE_SHA256} from '../tour-v3/story.mjs';
export const PLAN_REVISION='wolf-pair-cues-4';
export function createWolfTourV4Story(index){
  const base=createWolfTourV3Story(index),CHAPTERS=base.CHAPTERS.map(c=>c.id==='gearing'?{...c,title:'Tooth by tooth.',copy:'Highlighted teeth show the pairing. Arcs show spin and orbit.'}:c);
  return {...base,PLAN_REVISION,CHAPTERS,stateAt(seconds){const s=base.stateAt(seconds);return {...s,chapter:CHAPTERS[s.chapterIndex]};}};
}
