/** Tooth identity on retained WOLF source vertices; an explanatory phase cue.
 * Measured herringbone sections bind complete teeth to the original GLB.
 * This does not compute a contact patch, load, pressure, or collision response.
 */
import {Vector3} from 'three';
import {createWolfGearRig} from '../tour-v2/gearing.mjs';
import {ramp,SOURCE_SHA256} from '../tour-v2/story.mjs';

export const TOOTH_PHASE_REVISION='wolf-source-tooth-phase-4';
export const REFERENCE_Y=.004;
const TAU=2*Math.PI;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const p=clamp(x);return p*p*p*(10-15*p+6*p*p);};
const mod=(x,n)=>((x%n)+n)%n;
const angleWrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
// Original GLB triangle-plane sections, Fourier phase of the tooth-count
// harmonic. Values are radians, unwrapped axially: do not modulo each knot,
// which would jump tooth identity where a helix crosses one tooth pitch.
const Y=[.00025,.001,.003,.004,.006,.008,.010,.011,.012,.014,.016,.018,.019,.021,.02175];
const DEGREES={
  sun:[-1.635112,-1.140059,.183022,.848108,2.174441,3.497659,4.831454,4.831409,4.831448,3.503550,2.176870,.853728,.191642,-1.135424,-1.633811],
  planet:[-.645124,-2.625868,-7.953640,-10.618584,-15.908315,-21.250520,-26.522894,-26.523144,-26.522892,-21.213370,-15.907173,-10.619726,-7.958133,-2.655309,-.664781],
};
const PART_SPECS={
  sun:{name:'sun-gear',count:96,rootRadius:.04873,tipRadius:.05078},
  planet:{name:'planet-4',count:24,rootRadius:.01131,tipRadius:.01337},
};
function phaseAt(role,y){
  if(!PART_SPECS[role]||!Number.isFinite(y))throw new TypeError('Finite source axial Y and sun/planet role required');
  const p=DEGREES[role];
  if(y<=Y[0])return p[0]*Math.PI/180;
  if(y>=Y.at(-1))return p.at(-1)*Math.PI/180;
  const i=Y.findIndex(v=>v>=y),f=(y-Y[i-1])/(Y[i]-Y[i-1]);
  return (p[i-1]+(p[i]-p[i-1])*f)*Math.PI/180;
}

export function createToothPhase(index){
  if(index.sourceSHA256!==SOURCE_SHA256||index.geometryRevision!=='wolf-b352183e1bd0-2793c41488d0-xcaf-1')throw new Error('Tooth phases require the pinned WOLF source geometry');
  const rig=createWolfGearRig(index),axis=new Vector3(...rig.axisWorld),pivot=new Vector3(...rig.pivotWorld);
  const specs=Object.fromEntries(Object.entries(PART_SPECS).map(([role,s])=>{
    const matches=index.parts.filter(p=>p.name===s.name);
    if(matches.length!==1)throw new Error(`Exactly one original ${s.name} occurrence required`);
    const part=matches[0];
    return [role,Object.freeze({...s,id:part.id,pitch:TAU/s.count,
      center:Object.freeze([...part.worldCenter]),axialRange:Object.freeze([0,.022]),
      phaseKnots:Object.freeze(Y.map((y,i)=>Object.freeze([y,DEGREES[role][i]*Math.PI/180])))})];
  }));
  const restAzimuth=Math.atan2(specs.planet.center[2]-pivot.z,specs.planet.center[0]-pivot.x);
  const orbitRadius=Math.hypot(specs.planet.center[0]-pivot.x,specs.planet.center[2]-pivot.z);
  const qs0=(restAzimuth-phaseAt('sun',REFERENCE_Y))/specs.sun.pitch;
  const qp0=(restAzimuth+Math.PI-phaseAt('planet',REFERENCE_Y))/specs.planet.pitch;
  const phaseSum=qs0+qp0,pairSum=Math.round(phaseSum);

  /** Bind a source-world vertex once, BEFORE working/display transforms.
   * Only the middle tooth band participates; planet end teeth are excluded.
   */
  function vertexBinding(role,sourceWorld){
    const spec=specs[role];
    if(!spec||!sourceWorld||sourceWorld.length!==3||!sourceWorld.every(Number.isFinite))throw new TypeError('sun/planet and finite source-world position required');
    const [x,y,z]=sourceWorld,dx=x-spec.center[0],dz=z-spec.center[2],radius=Math.hypot(dx,dz),phase=phaseAt(role,y);
    const angle=Math.atan2(dz,dx),unwrappedIndex=Math.round((angle-phase)/spec.pitch),toothIndex=mod(unwrappedIndex,spec.count);
    const angleOffset=angleWrap(angle-phase-unwrappedIndex*spec.pitch);
    const radialWeight=smooth((radius-(spec.rootRadius-.00008))/.00028);
    // End faces are retained, but there is no spill into distinct end gears.
    const axialWeight=y>=-1e-7&&y<=.0220001?1:0;
    return {toothIndex,bandWeight:radialWeight*axialWeight,angleOffset,radius,sourceY:y};
  }

  function sample(state){
    if(!state||!Number.isFinite(state.gearAngle)||!Number.isFinite(state.beat))throw new TypeError('Finite gearAngle and beat required');
    const q=rig.coordinatesForAngle(state.gearAngle),azimuth=restAzimuth+q.orbit;
    const qs=(azimuth-q.sun-phaseAt('sun',REFERENCE_Y))/specs.sun.pitch;
    const qp=(azimuth+Math.PI-q.planet-phaseAt('planet',REFERENCE_Y))/specs.planet.pitch;
    // Equal and opposite rolling phases keep each tooth pair's integer sum
    // fixed. The small handoff window crossfades neighbours only near the
    // midpoint; the same source tooth remains selected during its passage.
    const passage=qs+(pairSum-phaseSum)/2,lower=Math.floor(passage),fraction=passage-lower;
    const handoff=smooth((fraction-.38)/.24);
    const pairs=[{sunIndex:mod(lower,96),planetIndex:mod(pairSum-lower,24),weight:1-handoff,passage:passage-lower},
      {sunIndex:mod(lower+1,96),planetIndex:mod(pairSum-lower-1,24),weight:handoff,passage:passage-lower-1}].filter(p=>p.weight>1e-12);
    const planetCenter=new Vector3(...specs.planet.center).sub(pivot).applyAxisAngle(axis,q.orbit).add(pivot).toArray();
    const interfaceWorld=[pivot.x+orbitRadius*.8*Math.cos(azimuth),REFERENCE_Y,pivot.z+orbitRadius*.8*Math.sin(azimuth)];
    const inChapter=state.chapter?.id==='gearing',opacity=inChapter?ramp(state.beat,28,29)*(1-ramp(state.beat,35,36)):0;
    const direction=state.beat>25&&state.beat<32?1:state.beat>32&&state.beat<39?-1:0;
    return {revision:TOOTH_PHASE_REVISION,opacity,pairs,interfaceWorld,phaseResidual:qs+qp-phaseSum,
      sun:{id:specs.sun.id,centerWorld:[...specs.sun.center],spinRadians:q.sun,direction},
      planet:{id:specs.planet.id,centerWorld:planetCenter,spinRadians:q.planet,direction:-direction,orbitRadians:q.orbit,orbitDirection:direction},
      toothCoordinates:{sun:qs,planet:qp,passage},pairSum,axisWorld:[...rig.axisWorld],
      explanation:'Source-bound tooth phase cue; not a solved contact patch.'};
  }
  function toothWeight(role,binding,current){
    if(!specs[role])throw new TypeError('sun/planet role required');
    const key=role==='sun'?'sunIndex':'planetIndex';
    return binding.bandWeight*current.opacity*current.pairs.reduce((sum,p)=>sum+(p[key]===binding.toothIndex?p.weight:0),0);
  }
  return {revision:TOOTH_PHASE_REVISION,specs,phaseAt,vertexBinding,sample,toothWeight,referenceY:REFERENCE_Y,phaseSum,pairSum,
    evidence:{sourceSHA256:index.sourceSHA256,geometryRevision:index.geometryRevision,sourceSections:15,radialSamplesPerSection:16384,originalSourceVertices:true,
      limitations:['Fourier phase and interpolated axial knots identify teeth on retained tessellated source geometry.','Neighbour-pair handoff is an explanatory phase convention, not a computed loaded tooth-flank contact.','No geometry, source rest pose, tooth count, mechanical ratio, camera, music, or timeline is changed.']}};
}
