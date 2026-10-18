import {createWolfTourV2Story,ramp} from '../tour-v2/story.mjs';
export {BPM,TOTAL_BEATS,DURATION,normalizeTime,ramp,localDisplayOffsets,SOURCE_SHA256} from '../tour-v2/story.mjs';
export const PLAN_REVISION='wolf-contact-closeup-3';
export function createWolfTourV3Story(index){
  const previous=createWolfTourV2Story(index);
  const selectedPlanet=index.parts.find(p=>p.name==='planet-4');
  if(!selectedPlanet||!previous.gearIds.includes(selectedPlanet.id))throw new Error('Missing original focus planet');
  const selectedPair={sun:previous.bindings.whole.sun,planet:selectedPlanet.id,planetName:selectedPlanet.name};
  const CHAPTERS=previous.CHAPTERS.map(c=>c.id==='gearing'?{...c,title:'At the tooth interface.',copy:'The sun drives the planet as it spins and travels around.'}:c);
  const macroAt=beat=>ramp(beat,25,28)*(1-ramp(beat,36,39));
  const contextAt=beat=>ramp(beat,24.5,25.75)*(1-ramp(beat,38.5,39));
  function stateAt(seconds){const s=previous.stateAt(seconds);return {...s,chapter:CHAPTERS[s.chapterIndex],gearMacro: s.chapter.id==='gearing'?macroAt(s.beat):0};}
  function opacityFor(s,id){const opacity=previous.opacityFor(s,id);if(s.chapter.id!=='gearing'||id===selectedPair.sun||id===selectedPair.planet)return opacity;return opacity*(1-contextAt(s.beat));}
  return {...previous,previous,PLAN_REVISION,CHAPTERS,selectedPair,macroAt,contextAt,stateAt,opacityFor,labelObstacleIds:s=>index.parts.filter(p=>opacityFor(s,p.id)>=.5).map(p=>p.id)};
}
