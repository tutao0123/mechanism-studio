/** A separate real-WOLF component study. No G1 meshes are added or inferred. */
import { createWolfStory, localDisplayOffsets, normalizeTime, BPM, DURATION, TOTAL_BEATS, SOURCE_SHA256 } from '../story.mjs';
export { localDisplayOffsets, normalizeTime, BPM, DURATION, TOTAL_BEATS, SOURCE_SHA256 };
export const PLAN_REVISION='wolf-motor-detail-1';
const smooth=x=>{const p=Math.max(0,Math.min(1,x));return p**3*(10-15*p+6*p*p);};
const mul=(a,k)=>a.map(v=>v*k||0),add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),length=a=>Math.hypot(...a),unit=a=>mul(a,1/length(a));
const frozen=value=>Object.freeze(value);

export function createWolfMotorDetail(index){
  const sourceStory=createWolfStory(index),all=new Map([...index.assemblies,...index.parts].map(p=>[p.id,p]));
  const motors=index.assemblies.filter(a=>a.name==='motor-8318 <1>');if(motors.length!==1)throw new Error('Expected one real 8318 motor assembly');
  const motor=motors[0],motorParts=index.parts.filter(p=>p.parentId===motor.id);
  const one=name=>{const values=motorParts.filter(p=>p.name===name);if(values.length!==1)throw new Error(`Expected one source motor component: ${name}`);return values[0];};
  const shaft=one('motor-shaft'),nut=one('motor-hex-nut'),mount=one('motor-mount-plate-8318'),rotor=one('rotor'),body=one('rotor-body'),stator=one('stator');
  const magnets=motorParts.filter(p=>p.name==='magnet'),cc=motorParts.filter(p=>p.name==='cc');
  if(motorParts.length!==86||magnets.length!==40||cc.length!==40)throw new Error('Expected 86 real motor leaves, including forty magnet and forty generic cc source names');
  // These actual pinned occurrences sit on exposed projected boundaries in the
  // planned detail view. Original mesh order is not a readable label policy.
  const labelMagnet=magnets.find(p=>p.id==='occ-b352183e1bd0-root-953098-1010-926');
  const labelCc=cc.find(p=>p.id==='occ-b352183e1bd0-root-953098-1010-929');
  if(!labelMagnet||!labelCc)throw new Error('Pinned visible source annotation targets changed');
  const axis=sourceStory.editorialAxis.direction,u=sourceStory.editorialAxis.radialU,center=stator.worldCenter;
  const maximum=Object.fromEntries(index.parts.map(p=>[p.id,[0,0,0]]));
  maximum[shaft.id]=mul(axis,.10);maximum[nut.id]=mul(axis,.135);maximum[mount.id]=mul(axis,-.105);
  maximum[rotor.id]=add(mul(axis,-.042),mul(u,.072));maximum[body.id]=add(mul(axis,.042),mul(u,-.072));
  for(const [parts,radialDistance,axialDistance]of [[magnets,.032,.032],[cc,.026,-.038]])for(const p of parts){
    const relative=sub(p.worldCenter,center),radial=sub(relative,mul(axis,dot(relative,axis)));
    if(length(radial)<1e-7)throw new Error('Expected off-axis actual source motor repeat geometry');
    maximum[p.id]=add(mul(unit(radial),radialDistance),mul(axis,axialDistance));
  }
  const groups=[
    {id:'shaft-nut',ids:[shaft.id,nut.id],outBeat:8,inBeat:52},
    {id:'mount',ids:[mount.id],outBeat:12,inBeat:48},
    {id:'shells',ids:[rotor.id,body.id],outBeat:16,inBeat:44},
    {id:'repeats',ids:[...magnets,...cc].map(p=>p.id),outBeat:20,inBeat:40},
  ];
  const ids=motorParts.map(p=>p.id),hardware=[shaft,nut,mount,rotor,body,stator].map(p=>p.id),repeatIds=[...magnets,...cc].map(p=>p.id);
  const front=all.get(sourceStory.bindings.front),back=all.get(sourceStory.bindings.back);
  const chapters=[
    {id:'whole',firstBeat:0,lastBeat:8,title:'One actuator. Look inside.',copy:'A real WOLF STEP assembly. This study follows its 8318 motor into 86 source components.',labels:[[front.id,'Front plate'],[back.id,'Back plate']]},
    {id:'motor',firstBeat:8,lastBeat:16,title:'An assembly inside the assembly.',copy:'The motor is isolated from the surrounding WOLF parts. Its shaft, nut and mount remain independent source occurrences.',labels:[[shaft.id,'Motor shaft'],[nut.id,'Motor hex nut']]},
    {id:'layers',firstBeat:16,lastBeat:24,title:'Separate the actual motor parts.',copy:'Rotating shells, mounting hardware and repeated components unfold with display offsets. No new geometry is invented.',labels:[[rotor.id,'Source part: rotor'],[body.id,'Source part: rotor-body']]},
    {id:'repeats',firstBeat:24,lastBeat:32,title:'Forty. And forty.',copy:'The source separately names 40 pieces “magnet” and 40 pieces “cc”. “cc” is retained as supplied; its function is not inferred.',labels:[[labelMagnet.id,'Magnet'],[labelCc.id,'Source part: cc']]},
    {id:'hardware',firstBeat:32,lastBeat:40,title:'Six named hardware components.',copy:'Shaft, nut, mounting plate, rotor, stator and rotor-body. These are source components, not cuts through one merged mesh.',labels:[[stator.id,'Stator'],[mount.id,'Motor mount plate']]},
    {id:'return',firstBeat:40,lastBeat:56,title:'Every part returns to its source pose.',copy:'Repeated pieces, shells, mount, then shaft and nut. Only display translations change; original placements stay intact.',labels:[[stator.id,'Stator · source pose retained']]},
    {id:'resolve',firstBeat:56,lastBeat:64,title:'Back in the WOLF assembly.',copy:'86 motor leaves within 245 actuator components. A real component study, separate from the G1 humanoid example.',labels:[[front.id,'Front plate'],[back.id,'Back plate']]},
  ];
  const CHAPTERS=frozen(chapters.map(c=>frozen({...c,labels:frozen(c.labels.map(frozen))}))),GROUPS=frozen(groups.map(g=>frozen({...g,ids:frozen(g.ids)})));
  const MAXIMUM_OFFSETS=frozen(Object.fromEntries(Object.entries(maximum).map(([id,offset])=>[id,frozen(offset)])));
  function stateAt(seconds){
    let time=normalizeTime(seconds),beat=time*BPM/60;const nearest=Math.round(beat);if(Math.abs(beat-nearest)<1e-10){beat=nearest;time=beat*60/BPM;}
    const chapterIndex=CHAPTERS.findIndex(c=>beat>=c.firstBeat&&beat<c.lastBeat),chapter=CHAPTERS[chapterIndex];
    const progress=Object.fromEntries(GROUPS.map(g=>[g.id,smooth((beat-g.outBeat)/2)*(1-smooth((beat-g.inBeat)/2))]));
    const offsetsWorld=Object.fromEntries(index.parts.map(p=>[p.id,[0,0,0]]));
    for(const g of GROUPS)for(const id of g.ids)offsetsWorld[id]=mul(MAXIMUM_OFFSETS[id],progress[g.id]);
    return {time,beat,chapter,chapterIndex,localTime:time-chapter.firstBeat*60/BPM,progress,offsetsWorld};
  }
  const details=frozen({motor:frozen(ids),layers:frozen(ids),repeats:frozen(repeatIds),hardware:frozen(hardware),return:frozen(ids)});
  return {BPM,DURATION,TOTAL_BEATS,PLAN_REVISION,CHAPTERS,GROUPS,MAXIMUM_OFFSETS,stateAt,normalizeTime,localDisplayOffsets,details,
    detailIds:state=>details[state.chapter.id]??null,editorialAxis:sourceStory.editorialAxis,
    bindings:frozen({motor:motor.id,shaft:shaft.id,nut:nut.id,mount:mount.id,rotor:rotor.id,body:body.id,stator:stator.id,magnets:frozen(magnets.map(p=>p.id)),cc:frozen(cc.map(p=>p.id)),motorParts:frozen(ids),hardware:frozen(hardware),labelMagnet:labelMagnet.id,labelCc:labelCc.id})};
}
