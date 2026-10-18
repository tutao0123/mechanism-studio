/** Pinned WOLF source geometry + manual attachment topology, ideal gear kinematics.
 * Counts come from measured source sections, not the README's nominal 34:1.
 * No source TRS, display offset, wall clock, contact force or dynamics is written.
 */
import {Matrix4,Quaternion,Vector3,Box3} from 'three';
import {createWolfWorkingMotion} from '../tour/kinematics.mjs';
export const GEARING_REVISION='wolf-source-teeth-96-24-144-156-v2';
export const TOOTH_COUNTS=Object.freeze({sun:96,planetMiddle:24,planetEnds:24,outputRings:144,fixedPlates:156});
export const SIGNED_RATIOS=Object.freeze({sun:1,orbit:8/21,planet:-44/21,output:-2/63});
const clean=v=>Math.abs(v)<1e-14?0:v;
const neutral=()=>({position:[0,0,0],quaternion:[0,0,0,1],scale:[1,1,1]});
const corners=b=>{const out=[];for(const x of[b.min[0],b.max[0]])for(const y of[b.min[1],b.max[1]])for(const z of[b.min[2],b.max[2]])out.push(new Vector3(x,y,z));return out;};
const angle=value=>{if(!Number.isFinite(value))throw new RangeError('Gear input angle must be finite radians');return value;};

export function createWolfGearRig(index){
  const inputRig=createWolfWorkingMotion(index),axis=new Vector3(...inputRig.axisWorld),pivot=new Vector3(...inputRig.pivotWorld);
  const all=new Map([...index.assemblies,...index.parts].map(p=>[p.id,p]));
  const one=name=>{const a=index.parts.filter(p=>p.name===name);if(a.length!==1)throw new Error(`Expected exactly one retained source gear member: ${name}`);return a[0];};
  const planets=Array.from({length:12},(_,i)=>one(`planet-${i+1}`));
  const output=['internal-ring-gear-A','internal-ring-gear-B','outer-ring-A','outer-ring-B'].map(one);
  const fixed=['front-plate','back-plate','stator','motor-mount-plate-8318'].map(one);
  const ids=Object.freeze({input:Object.freeze([...inputRig.rotatingIds]),planets:Object.freeze(planets.map(p=>p.id)),output:Object.freeze(output.map(p=>p.id)),fixed:Object.freeze(fixed.map(p=>p.id))});
  const ownedIds=Object.freeze([...ids.input,...ids.planets,...ids.output]);
  if(new Set(ownedIds).size!==62)throw new Error('Gear channels require exactly 62 disjoint source leaves');
  const moving=new Set(ownedIds),parents=new Map();
  for(const id of ownedIds){
    const part=all.get(id),parent=all.get(part.parentId),matrix=new Matrix4().fromArray(parent.worldMatrix),position=new Vector3(),quaternion=new Quaternion(),scale=new Vector3();matrix.decompose(position,quaternion,scale);
    if(Math.abs(matrix.determinant()-1)>1e-8||scale.toArray().some(v=>Math.abs(v-1)>1e-8))throw new Error('Gear rig requires rigid source parent transforms');
    for(let cursor=parent;cursor;cursor=all.get(cursor.parentId))if(moving.has(cursor.id))throw new Error('Nested mechanical ownership would duplicate a source gear channel');
    parents.set(id,{matrix,inverse:matrix.clone().invert()});
  }
  // The STEP has baked planet geometry away from its semantic-node origin.
  // Each inferred axis therefore passes through that part's source geometric
  // centre, not the node origin. Bounds introduce sub-micrometre approximation;
  // it is retained as a documented tessellation-based axis, not a CAD mate.
  const planetCenters=new Map(planets.map(p=>[p.id,new Vector3(...p.worldCenter)]));
  const rotate=(center,radians)=>new Matrix4().makeTranslation(...center.toArray()).multiply(new Matrix4().makeRotationAxis(axis,radians)).multiply(new Matrix4().makeTranslation(...center.toArray().map(v=>-v)));

  function coordinatesForAngle(inputRadians=0){
    const s=angle(inputRadians);return {inputRadians:s,sun:s,orbit:s*SIGNED_RATIOS.orbit,planet:s*SIGNED_RATIOS.planet,output:s*SIGNED_RATIOS.output,fixed:0};
  }
  function worldMotionsForAngle(inputRadians=0){
    const q=coordinatesForAngle(inputRadians),result=new Map(index.parts.map(p=>[p.id,new Matrix4()]));
    if(q.sun===0)return result;
    const input=rotate(pivot,q.sun),out=rotate(pivot,q.output),orbit=rotate(pivot,q.orbit);
    for(const id of ids.input)result.set(id,input.clone());
    for(const id of ids.output)result.set(id,out.clone());
    for(const id of ids.planets)result.set(id,orbit.clone().multiply(rotate(planetCenters.get(id),q.planet-q.orbit)));
    return result;
  }
  function posesForAngle(inputRadians=0){
    const q=angle(inputRadians),poses=Object.fromEntries(index.parts.map(p=>[p.id,neutral()]));
    if(q===0)return poses;
    const world=worldMotionsForAngle(q);
    for(const id of ownedIds){
      const parent=parents.get(id),m=parent.inverse.clone().multiply(world.get(id)).multiply(parent.matrix),position=new Vector3(),quaternion=new Quaternion(),scale=new Vector3();m.decompose(position,quaternion,scale);quaternion.normalize();
      poses[id]={position:position.toArray().map(clean),quaternion:quaternion.toArray().map(clean),scale:[1,1,1]};
    }
    return poses;
  }
  function boundsAtAngle(inputRadians=0){
    const world=worldMotionsForAngle(inputRadians),result=new Map();
    for(const part of index.parts){
      if(!moving.has(part.id)){result.set(part.id,{min:[...part.worldBounds.min],max:[...part.worldBounds.max]});continue;}
      const box=new Box3().setFromPoints(corners(part.worldBounds).map(v=>v.applyMatrix4(world.get(part.id))));result.set(part.id,{min:box.min.toArray(),max:box.max.toArray()});
    }
    return result;
  }
  const evidence=Object.freeze({revision:GEARING_REVISION,sourceSHA256:index.sourceSHA256,sourceRevision:index.sourceRevision,geometryRevision:index.geometryRevision,
    toothCounts:TOOTH_COUNTS,signedRatios:SIGNED_RATIOS,signedInputToOutputRatio:-31.5,publishedNominalReduction:34,
    ratioDiscrepancy:'The retained STEP geometry has 96/24/144/156 teeth. Ideal kinematics derives -31.5:1. The upstream README publishes 34:1; that discrepancy is unresolved and is not silently forced into the model.',
    attachmentTopology:'Manual steps 6–7 key both inner ring gears into the two outer rings and bolt the outer rings together. Steps 9–10 mesh the front/back plates with the planet ends. Usage fixes the plates and attaches loads to the outer rings. Both named inner rings are output members.',
    coordinateMeaning:'Positive rotation is right-handed about source motor-shaft axis [0,-1,0]. Orbit is a virtual coordinate; no physical planet carrier is added. Planet world spin equals -44/21 input, and spin relative to orbit equals -52/21 input.',
    sourcePhasePolicy:'Keep every original source tooth phase; apply only world delta transforms. Planet orbit and own-axis spin are composed before source placement.',
    bearingPolicy:'Only the two named outer-ring leaves belong to this gear adapter. Rolling elements and other bearing race parts require the independent bearing adapter; they are not driven here.',
    ownedIds,ids,
    limitations:Object.freeze(['Ideal rigid kinematics, not recovered STEP mates.','Tessellated section counts and sampled nonpenetration do not certify 3D contact or manufacturing clearance.','No torque, friction, deformation, dynamic load, backlash or lubrication model.','Source geometric planet centres are an explicit mesh-based axis approximation.'])});
  return {posesForAngle,worldMotionsForAngle,coordinatesForAngle,boundsAtAngle,ids,ownedIds,axisWorld:inputRig.axisWorld,pivotWorld:inputRig.pivotWorld,planetCenters:new Map([...planetCenters].map(([id,c])=>[id,c.toArray()])),evidence};
}
