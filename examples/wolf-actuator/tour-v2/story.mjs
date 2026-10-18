/** Preserve the complete source tour, adding two source-derived mechanism views. */
import {createWolfTourStory as createBaseStory, localDisplayOffsets, SOURCE_SHA256} from '../tour/story.mjs';
export {localDisplayOffsets,SOURCE_SHA256};
export const BPM=112,TOTAL_BEATS=160,DURATION=TOTAL_BEATS*60/BPM,PLAN_REVISION='wolf-complete-tour-2';
const smooth=x=>{const p=Math.max(0,Math.min(1,x));return p*p*p*(10-15*p+6*p*p);};
export const ramp=(b,a,z)=>smooth((b-a)/(z-a));
export const tourBeat=old=>old<28?old:old<72?old+16:old+32;
export function normalizeTime(t){if(!Number.isFinite(t))throw new TypeError('Finite tour time required');const n=(t%DURATION+DURATION)%DURATION;return n<1e-10||DURATION-n<1e-10?0:n;}
// Slow reversible input keeps the source tooth motion legible at 30 fps and
// returns every mechanical channel to its actual rest phase before teardown.
const excursion=(beat,first,middle,last,angle)=>beat<first||beat>=last?0:angle*(beat<=middle?ramp(beat,first,middle):1-ramp(beat,middle,last));
export function createWolfTourV2Story(index){
  const base=createBaseStory(index),w=base.bindings.whole,b=base.bindings.bearing,m=base.bindings.motor;
  const gearIds=[w.front,w.back,w.ringA,w.ringB,w.sun,...w.planets],gearSet=new Set(gearIds),motorSet=new Set(m.motorParts),bearingSet=new Set(b.bearingParts);
  const bearingRecords=index.parts.filter(p=>bearingSet.has(p.id));
  const findBearing=name=>{const p=bearingRecords.find(p=>p.name===name);if(!p)throw new Error(`Missing source bearing ${name}`);return p.id;};
  const bearingRoles={inner:findBearing('Part 59'),outer:findBearing('Part 69'),cage:findBearing('Part 62'),focus:base.bindings.bearingPart,support:w.outerA};
  const CHAPTERS=base.CHAPTERS.map(c=>{
    if(c.id==='motion')return {...c,id:'gearing',firstBeat:20,lastBeat:44,title:'Teeth define the motion.',copy:'Fixed end plates guide the planets. The central rings turn together.',labels:[]};
    const value={...c,firstBeat:c.firstBeat<20?c.firstBeat:tourBeat(c.firstBeat),lastBeat:c.lastBeat<=20?c.lastBeat:c.id==='transfer'?88:tourBeat(c.lastBeat)};
    if(c.id==='motor-return')value.lastBeat=82;
    if(c.id==='bearing-component'){value.title='One roller, up close.';value.copy='The original Part 1: a crossed roller, isolated from its bearing.';value.labels=[[base.bindings.bearingPart,'Roller · Part 1']];}
    if(c.id==='bearing-repeats')value.copy='Sixty-six crossed rollers open around the centre.';
    return value;
  });
  CHAPTERS.splice(CHAPTERS.findIndex(c=>c.id==='bearing-bearing'),0,{id:'bearing-roll',firstBeat:88,lastBeat:104,title:'One bearing, in motion.',copy:'An isolated outer-race input drives cage orbit and roller spin.',labels:[],scope:'bearing-motion'});
  // Existing action events remain individually bound to original occurrences.
  const remapEvent=e=>{const delta=e.scope==='motor'?16:e.scope==='bearing'?32:e.firstBeat>=110?32:0;return {...e,firstBeat:e.firstBeat+delta,lastBeat:e.lastBeat+delta,startBeat:e.startBeat+delta,endBeat:e.endBeat+delta};};
  const MOTION_EVENTS=base.MOTION_EVENTS.map(remapEvent);
  function stateAt(seconds){
    let time=normalizeTime(seconds),beat=time*BPM/60;
    if(Math.abs(beat-Math.round(beat))<1e-10){beat=Math.round(beat);time=beat*60/BPM;}
    const oldBeat=beat<20?beat:beat<44?20:beat<88?beat-16:beat<104?72:beat-32;
    const baseState=base.stateAt(oldBeat*60/BPM),chapterIndex=CHAPTERS.findIndex(c=>beat>=c.firstBeat&&beat<c.lastBeat),chapter=CHAPTERS[chapterIndex];
    const offsetsWorld=Object.fromEntries(Object.entries(baseState.offsetsWorld).map(([id,v])=>[id,[...v]]));
    const gather=beat>=20&&beat<44?ramp(beat,20,23)*(1-ramp(beat,41,44)):0;
    for(const id of gearIds)offsetsWorld[id]=offsetsWorld[id].map(v=>v*(1-gather));
    const gearAngle=excursion(beat,25,32,39,Math.PI/2);
    const bearingAngle=excursion(beat,90,96,102,Math.PI/3);
    return {...baseState,time,beat,chapter,chapterIndex,localTime:(beat-chapter.firstBeat)*60/BPM,baseState,gearAngle,bearingAngle,gather,offsetsWorld,motionDemoProgress:0};
  }
  function opacityFor(s,id){
    if(s.chapter.id==='gearing'){
      const entry=ramp(s.beat,20,23),exit=ramp(s.beat,39,41);
      const target=gearSet.has(id)?(id===w.front||id===w.back? .055:1):0;
      const end=motorSet.has(id)?1:0;
      return (1-entry+entry*target)*(1-exit)+end*ramp(s.beat,41,44);
    }
    if(s.chapter.id==='bearing-roll'){
      if(!bearingSet.has(id))return 0;
      const amount=ramp(s.beat,88,90)*(1-ramp(s.beat,102,104));
      const hidden=id===bearingRoles.outer||id===bearingRoles.support;
      return hidden?1-amount:id===bearingRoles.cage?1-amount*.86:1;
    }
    return base.opacityFor(s.baseState,id);
  }
  const labelObstacleIds=s=>index.parts.filter(p=>opacityFor(s,p.id)>=.5).map(p=>p.id);
  return {...base,BPM,TOTAL_BEATS,DURATION,PLAN_REVISION,CHAPTERS,MOTION_EVENTS,base,stateAt,normalizeTime,opacityFor,labelObstacleIds,detailIds:()=>null,gearIds,bearingRoles,localDisplayOffsets,
    offsetOwnership:'Native source poses + mechanically derived model wrappers + independent reversible display offsets. Gear demonstration returns source teeth to native meshing placements before motion.'};
}
export const createWolfTourStory=createWolfTourV2Story;
