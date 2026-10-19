export const BPM=108,TOTAL_BEATS=64,DURATION=TOTAL_BEATS*60/BPM;
export const PLAN_REVISION='robotiq-linkage-showcase-1';
const id=n=>`mjcf:${n}`;
export const smooth=v=>{const p=Math.max(0,Math.min(1,v));return p**3*(10-15*p+6*p*p);};
const ramp=(b,a,z)=>smooth((b-a)/(z-a));
const label=(n,t)=>[id(n),t];
export const CHAPTERS=Object.freeze([
 {id:'work',firstBeat:0,lastBeat:12,title:'One input. Two fingers.',copy:'A coupled linkage turns rotation into a closing grasp.',labels:[]},
 {id:'expand',firstBeat:12,lastBeat:24,title:'See the links separate.',copy:'Source bodies move apart; their identities stay connected.',labels:[]},
 {id:'detail',firstBeat:24,lastBeat:36,title:'Follow one four-bar loop.',copy:'Separate the links to see how one side is built.',labels:[label('right_driver','Driver link'),label('right_follower','Follower link')]},
 {id:'relation',firstBeat:36,lastBeat:42,title:'Two sides. One command.',copy:'The source couples both driver angles equally.',labels:[]},
 {id:'return',firstBeat:42,lastBeat:54,title:'Return to the source pose.',copy:'Every original body returns to its own place.',labels:[]},
 {id:'resolve',firstBeat:54,lastBeat:64,title:'Connected. And moving.',copy:'Robotiq 2F-85 · A kinematic study by Mechanism Studio.',labels:[]},
]);
export const GROUPS=Object.freeze([
 {id:'drivers',ids:['left','right'].flatMap(s=>['driver','coupler'].map(n=>id(`${s}_${n}`))),outBeat:14,inBeat:50},
 {id:'springs',ids:['left','right'].map(s=>id(`${s}_spring_link`)),outBeat:16,inBeat:47},
 {id:'followers',ids:['left','right'].flatMap(s=>['follower','pad'].map(n=>id(`${s}_${n}`))),outBeat:18,inBeat:44},
]);
export const MUSIC_EVENTS=Object.freeze([
 {id:'first-grasp',beat:2,kind:'motion',level:.3,partIds:[id('left_driver'),id('right_driver')]},
 ...GROUPS.map(g=>({id:`release-${g.id}`,beat:g.outBeat,kind:'release',level:.4,partIds:g.ids})),
 {id:'linkage-detail',beat:26,kind:'detail',level:.35,partIds:[id('right_driver'),id('right_follower')]},
 ...GROUPS.map(g=>({id:`seat-${g.id}`,beat:g.inBeat+2,kind:'seat',level:.35,partIds:g.ids})),
 {id:'second-grasp',beat:55,kind:'motion',level:.3,partIds:[id('left_driver'),id('right_driver')]},
 {id:'resolve',beat:62,kind:'resolve',level:.2,partIds:[id('base')]},
]);
export function normalizeTime(s){if(!Number.isFinite(s))throw new TypeError('Finite seconds required');const t=((s%DURATION)+DURATION)%DURATION;return t<1e-10||DURATION-t<1e-10?0:t;}
export function localDisplayOffsets(index,offsets,Matrix4,Vector3){
 const byId=new Map(index.parts.map(p=>[p.id,p]));
 return new Map(index.parts.map(p=>{const parent=byId.get(p.parentId),v=new Vector3(...offsets[p.id]).sub(new Vector3(...(parent?offsets[parent.id]:[0,0,0])));if(parent){const inv=new Matrix4().fromArray(parent.worldMatrix).invert();v.applyMatrix4(inv).sub(new Vector3().applyMatrix4(inv));}return[p.id,v.toArray()];}));
}
export function createGripperStory(index){
 const ids=new Set(index.parts.map(p=>p.id));if(ids.size!==11||!ids.has(id('base')))throw new Error('Retained Robotiq source index required.');
 const maximum=Object.fromEntries([...ids].map(n=>[n,[0,0,0]]));
 for(const g of GROUPS)for(const part of g.ids){const sign=part.includes(':left_')?-1:1;maximum[part]=g.id==='drivers'?[sign*.055,.015,0]:g.id==='springs'?[sign*.085,.025,-.025]:[sign*.105,.065,.025];}
 function stateAt(seconds){
  const time=normalizeTime(seconds),beat=time*BPM/60,chapterIndex=CHAPTERS.findIndex(c=>beat>=c.firstBeat&&beat<c.lastBeat),chapter=CHAPTERS[chapterIndex];
  const progress=Object.fromEntries(GROUPS.map(g=>[g.id,ramp(beat,g.outBeat,g.outBeat+2)*(1-ramp(beat,g.inBeat,g.inBeat+2))]));
  const offsetsWorld=Object.fromEntries([...ids].map(n=>[n,[0,0,0]]));
  for(const g of GROUPS)for(const n of g.ids)offsetsWorld[n]=maximum[n].map(v=>v*progress[g.id]);
  const pulse=(a,b,c,d)=>.72*ramp(beat,a,b)*(1-ramp(beat,c,d));
  const driverAngle=pulse(1,4,6,10)+pulse(55,58,59,62);
  return {time,beat,chapter,chapterIndex,localTime:time-chapter.firstBeat*60/BPM,progress,offsetsWorld,driverAngle};
 }
 const detailIds=['right_driver','right_coupler','right_spring_link','right_follower'].map(id);
 // Keep the named source links settled; local detail explains the same loop in separation.
 return {BPM,TOTAL_BEATS,DURATION,PLAN_REVISION,MUSIC_EVENTS,GROUPS,CHAPTERS,MAXIMUM_OFFSETS:maximum,normalizeTime,stateAt,localDisplayOffsets,
  geometryRevision:index.geometryRevision,details:detailIds,CAMERA_CUTS:['detail','relation'],detailIds:s=>s.chapter.id==='detail'?detailIds:null};
}
export const createMusicStory=createGripperStory;
