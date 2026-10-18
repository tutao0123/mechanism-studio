import {Vector3} from 'three';

export const DIRECTION_CUE_REVISION='wolf-source-axis-direction-cues-4';
const smooth=x=>{const p=Math.max(0,Math.min(1,x));return p*p*p*(p*(p*6-15)+10);};
const fade=(beat,start,end)=>smooth((beat-start)/.35)*(1-smooth((beat-(end-.35))/.35));
const TAU=Math.PI*2;

/** Source-plane direction cues for the existing WOLF close-up.
 *
 * sample(state) returns at most two renderer-independent records with a stable
 * source partId, role/label, opacity, signed angular velocity, true axis centre,
 * circle radius, arc pointsWorld, and headWorld=[tip,leftWing,rightWing]. These
 * are editorial direction indicators, not tooth contact, force or torque marks.
 * A renderer projects them through the actual camera and hides offscreen cues;
 * it must not clamp their endpoints to a screen edge or modify mechanical poses.
 *
 * Sun/planet arrows describe absolute spin about their own source axes. The
 * later orbit arrow follows the actual planet-centre circle. All signs derive
 * from the same seekable mechanical state, including reversal; no wall clock,
 * previous frame, source placement or display offset is written here.
 */
export function createDirectionCues(index,story,rig){
  const axis=new Vector3(...rig.gear.axisWorld),pivot=new Vector3(...rig.gear.pivotWorld);
  if(axis.distanceTo(new Vector3(0,-1,0))>1e-10)throw new Error('WOLF direction cues require the verified source shaft axis');
  const sun=index.parts.find(p=>p.id===story.selectedPair.sun),planet=index.parts.find(p=>p.id===story.selectedPair.planet);
  if(sun?.name!=='sun-gear'||planet?.name!=='planet-4')throw new Error('Direction cues require the original selected WOLF occurrences');
  const originalPlanet=new Vector3(...planet.worldCenter),radial=originalPlanet.clone().sub(pivot);
  radial.addScaledVector(axis,-radial.dot(axis));
  const orbitRadius=radial.length(),restAngle=Math.atan2(radial.z,radial.x);

  function arc({role,label,partId,opacity,sign,angularVelocity,center,radius,start,sweep}){
    const point=angle=>[center[0]+radius*Math.cos(angle),center[1],center[2]+radius*Math.sin(angle)];
    const pointsWorld=Array.from({length:25},(_,i)=>point(start+sign*sweep*i/24));
    const end=start+sign*sweep,tip=new Vector3(...pointsWorld.at(-1));
    const tangent=new Vector3(-Math.sin(end)*sign,0,Math.cos(end)*sign),normal=new Vector3(Math.cos(end),0,Math.sin(end));
    const size=Math.min(.0015,radius*.16),base=tip.clone().addScaledVector(tangent,-size);
    return {role,label,partId,opacity,sign,angularVelocity,axisWorld:axis.toArray(),centerWorld:[...center],radiusMetres:radius,
      pointsWorld,headWorld:[tip.toArray(),base.clone().addScaledVector(normal,size*.48).toArray(),base.clone().addScaledVector(normal,-size*.48).toArray()]};
  }

  function ratesAt(state){
    const epsilon=.0001,a=story.stateAt(state.time-epsilon),b=story.stateAt(state.time+epsilon);
    const input=(b.gearAngle-a.gearAngle)/(2*epsilon),coordinates=rig.gear.coordinatesForAngle(input);
    return {input,planet:coordinates.planet,orbit:coordinates.orbit};
  }

  function sample(state){
    if(!Number.isFinite(state?.time)||!Number.isFinite(state?.beat))throw new TypeError('Direction cues require finite story time and beat');
    if(state.chapter.id!=='gearing'||state.gearMacro<.999)return [];
    const rates=ratesAt(state);
    if(!Number.isFinite(rates.input)||Math.abs(rates.input)<.015)return [];
    const coordinates=rig.gear.coordinatesForAngle(state.gearAngle),angle=(restAngle+coordinates.orbit)%TAU;
    const currentPlanet=originalPlanet.clone().sub(pivot).applyAxisAngle(axis,coordinates.orbit).add(pivot);
    const records=[];
    const sunOpacity=fade(state.beat,28.2,31.45),planetOpacity=fade(state.beat,29,31.45),orbitOpacity=fade(state.beat,33,35.7);
    if(sunOpacity>0){
      const sign=Math.sign(rates.input),sweep=.32;
      records.push(arc({role:'sun-spin',label:'Sun input',partId:sun.id,opacity:sunOpacity,sign,angularVelocity:rates.input,
        center:[pivot.x,-.011,pivot.z],radius:.040,start:angle-sign*sweep/2,sweep}));
    }
    if(planetOpacity>0){
      const sign=Math.sign(rates.planet),sweep=1.5;
      records.push(arc({role:'planet-spin',label:'Planet spin',partId:planet.id,opacity:planetOpacity,sign,angularVelocity:rates.planet,
        center:[currentPlanet.x,-.013,currentPlanet.z],radius:.0075,start:angle-sign*sweep/2,sweep}));
    }
    if(orbitOpacity>0){
      const sign=Math.sign(rates.orbit);
      // Start beyond the planet's own angular envelope so the short orbital
      // direction segment does not draw across its teeth or the mesh interface.
      records.push(arc({role:'planet-orbit',label:'Planet orbit',partId:planet.id,opacity:orbitOpacity,sign,angularVelocity:rates.orbit,
        center:[pivot.x,-.014,pivot.z],radius:orbitRadius,start:angle+sign*.32,sweep:.16}));
    }
    return records;
  }
  return {revision:DIRECTION_CUE_REVISION,sample,ratesAt,orbitRadius,sourcePair:{sun:sun.id,planet:planet.id}};
}
