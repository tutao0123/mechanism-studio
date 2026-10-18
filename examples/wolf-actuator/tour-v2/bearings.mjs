/** Source-bound ideal crossed-roller kinematics. Not a recovered mate/contact solver.
 * The pinned generator specifies 10 micrometres of rolling clearance. This model
 * neglects that clearance and elastic deformation when imposing no-slip contacts.
 */
import {Matrix4,Vector3,Quaternion,Box3} from 'three';
import {BEARING_DATA} from './bearing-data.mjs';
export {BEARING_DATA};
export const BEARING_REVISION='wolf-crossed-roller-ideal-1';
const clean=v=>Math.abs(v)<1e-14?0:v;
const neutral=()=>({position:[0,0,0],quaternion:[0,0,0,1],scale:[1,1,1]});
const finiteAngle=(v,name)=>{if(!Number.isFinite(v))throw new TypeError(`${name} must be finite`);return v;};
const corners=b=>{const a=[];for(const x of[b.min[0],b.max[0]])for(const y of[b.min[1],b.max[1]])for(const z of[b.min[2],b.max[2]])a.push(new Vector3(x,y,z));return a;};
const around=(point,axis,angle)=>angle===0?new Matrix4():new Matrix4().makeTranslation(...point).multiply(new Matrix4().makeRotationAxis(axis,angle)).multiply(new Matrix4().makeTranslation(...point.map(v=>-v)));

export function createWolfBearingRig(index){
  if(index?.sourceSHA256!==BEARING_DATA.sourceSHA256||index?.geometryRevision!==BEARING_DATA.geometryRevision||index.units!=='m'||index.parts.length!==245)throw new Error('Bearing rig requires the pinned source geometry and metre coordinate basis');
  const all=new Map([...index.assemblies,...index.parts].map(p=>[p.id,p]));
  if(all.size!==index.parts.length+index.assemblies.length)throw new Error('Duplicate source occurrence ID');
  const axis=new Vector3(...BEARING_DATA.axis),R=BEARING_DATA.pitchRadius,r=BEARING_DATA.rollerRadius,h=r*Math.cos(BEARING_DATA.contactAngle);
  const groups=BEARING_DATA.groups,ownedIds=Object.freeze(Object.values(groups).flatMap(g=>[g.innerRace,g.outerRace,g.cage,...g.rollers.map(p=>p.id)]));
  const parents=new Map();
  for(const side of['A','B']){
    const g=groups[side];if(g.rollers.length!==66)throw new Error('Exactly 66 source rollers are required per bearing');
    for(const [id,name] of[[g.innerRace,'Part 59'],[g.outerRace,'Part 69'],[g.cage,'Part 62'],...g.rollers.map(p=>[p.id,p.sourceName])]){
      const p=all.get(id);if(!p||p.name!==name||!index.parts.includes(p))throw new Error(`Pinned bearing identity changed: ${id}`);
      const parent=all.get(p.parentId);if(!parent?.worldMatrix||parent.worldMatrix.length!==16||!parent.worldMatrix.every(Number.isFinite))throw new Error('Rigid source parent matrix required');
      const matrix=new Matrix4().fromArray(parent.worldMatrix);
      if(Math.abs(matrix.determinant()-1)>1e-8)throw new Error('Bearing source parent must be a rigid transform');
      parents.set(id,{matrix,inverse:matrix.clone().invert()});
    }
  }
  if(new Set(ownedIds).size!==138)throw new Error('Bearing motion owners must be 138 distinct leaves');
  function angles({innerAngle=0,outerAngle=0,bearing='both'}={}){
    finiteAngle(innerAngle,'innerAngle');finiteAngle(outerAngle,'outerAngle');
    if(!['A','B','both'].includes(bearing))throw new RangeError('bearing must be A, B, or both');
    return {innerAngle,outerAngle,bearing,cageAngle:((R+h)*outerAngle+(R-h)*innerAngle)/(2*R),rollerSpinAngle:(R*R-h*h)/(2*R*r)*(outerAngle-innerAngle)};
  }
  function worldMotionsForAngles(input={}){
    const a=angles(input),result=new Map();
    for(const side of(a.bearing==='both'?['A','B']:[a.bearing])){
      const g=groups[side],orbit=around(g.pivot,axis,a.cageAngle);
      result.set(g.innerRace,around(g.pivot,axis,a.innerAngle));
      result.set(g.outerRace,around(g.pivot,axis,a.outerAngle));
      result.set(g.cage,orbit);
      for(const roller of g.rollers)result.set(roller.id,orbit.clone().multiply(around(roller.center,new Vector3(...roller.axis),a.rollerSpinAngle)));
    }
    return result;
  }
  function posesForAngles(input={}){
    const result=Object.fromEntries(index.parts.map(p=>[p.id,neutral()]));
    for(const[id,world]of worldMotionsForAngles(input)){
      const parent=parents.get(id),matrix=parent.inverse.clone().multiply(world).multiply(parent.matrix),p=new Vector3(),q=new Quaternion(),s=new Vector3();
      matrix.decompose(p,q,s);q.normalize();result[id]={position:p.toArray().map(clean),quaternion:q.toArray().map(clean),scale:[1,1,1]};
    }
    return result;
  }
  function boundsAtAngles(input={}){
    const motions=worldMotionsForAngles(input),result=new Map();
    for(const p of index.parts){const m=motions.get(p.id);if(!m){result.set(p.id,{min:[...p.worldBounds.min],max:[...p.worldBounds.max]});continue;}const box=new Box3().setFromPoints(corners(p.worldBounds).map(v=>v.applyMatrix4(m)));result.set(p.id,{min:box.min.toArray(),max:box.max.toArray()});}
    return result;
  }
  // Independent velocity check at the ideal inner and outer contact points.
  // The model combines cage precession with spin about each tilted roller axis.
  function contactResiduals({innerSpeed=0,outerSpeed=1,bearing='both'}={}){
    const a=angles({innerAngle:innerSpeed,outerAngle:outerSpeed,bearing}),result=[];
    for(const side of(a.bearing==='both'?['A','B']:[a.bearing]))for(const roller of groups[side].rollers){
      const centre=new Vector3(...roller.center).sub(new Vector3(...groups[side].pivot)),radial=centre.clone().addScaledVector(axis,-centre.dot(axis)).normalize(),u=new Vector3(...roller.axis);
      const normal=radial.clone().addScaledVector(u,-radial.dot(u)).normalize(),offset=normal.multiplyScalar(r),velocityCentre=new Vector3().crossVectors(axis,centre).multiplyScalar(a.cageAngle),omega=axis.clone().multiplyScalar(a.cageAngle).addScaledVector(u,a.rollerSpinAngle);
      const outerPoint=centre.clone().add(offset),innerPoint=centre.clone().sub(offset);
      const outerV=velocityCentre.clone().add(new Vector3().crossVectors(omega,offset));
      const innerV=velocityCentre.clone().sub(new Vector3().crossVectors(omega,offset));
      const outerRaceV=new Vector3().crossVectors(axis,outerPoint).multiplyScalar(outerSpeed),innerRaceV=new Vector3().crossVectors(axis,innerPoint).multiplyScalar(innerSpeed);
      result.push({id:roller.id,inner:innerV.distanceTo(innerRaceV),outer:outerV.distanceTo(outerRaceV)});
    }
    return result;
  }
  const evidence=Object.freeze({revision:BEARING_REVISION,sourceSHA256:BEARING_DATA.sourceSHA256,geometryRevision:BEARING_DATA.geometryRevision,sourceGeneratorRevision:'2b63192188d81eea663c04e5a2b98c44d60186f2',sourceGenerator:'https://github.com/Anthrobotics/modular-bearing/blob/2b63192188d81eea663c04e5a2b98c44d60186f2/ModularBearingGenerator.scad',model:'Ideal no-slip crossed-roller bearing; geometry-bound kinematics, not recovered CAD mates or a contact/load simulation',innerRacePolicy:'Part 59 rests on the fixed front/back plate; source manual step 11 and matching inner mounting pattern.',outerRacePolicy:'Part 69 follows the output outer-ring support; source manual steps 6, 7 and 11. Both outer-race halves are represented by one source occurrence and are never split synthetically.',cagePolicy:'Part 62 follows cage angle. Exactly 66 original source rollers per side orbit with the cage and spin about their measured alternating 45-degree axes.',pitchRadius:R,rollerRadius:r,contactAngle:BEARING_DATA.contactAngle,rollingClearanceIgnored:BEARING_DATA.sourceRollingClearance,limitations:['10-micrometre source rolling clearance is neglected for ideal no-slip motion.','The imported bearing is source-triangulated AP242 geometry, not an analytic solid/contact model.','No elastic deformation, preload, lubrication, slip, force, collision or load-life calculation.','Support rings are excluded from this rig and belong to the gearbox output motion owner.']});
  return {posesForAngles,worldMotionsForAngles,boundsAtAngles,contactResiduals,angles,ownedIds,groups,axisWorld:[...BEARING_DATA.axis],evidence};
}
