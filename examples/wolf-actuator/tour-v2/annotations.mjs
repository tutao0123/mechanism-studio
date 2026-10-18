import {createWolfTourAnnotations} from '../tour/annotations.mjs';
export function createWolfTourV2Annotations(story){
  const base=createWolfTourAnnotations(story.base);
  return {CUE_WINDOWS:{...base.CUE_WINDOWS,gearing:[], 'bearing-roll':[]},annotationCues(state,options){
    if(state.chapter.id==='gearing'||state.chapter.id==='bearing-roll')return [];
    return base.annotationCues(state.baseState,options).map(c=>c.id===story.bindings.bearingPart?{...c,text:'Roller · Part 1'}:c);
  }};
}
