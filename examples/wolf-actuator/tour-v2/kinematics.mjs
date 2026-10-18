import {Box3,Vector3} from 'three';
import {createWolfGearRig} from './gearing.mjs';
import {createWolfBearingRig} from './bearings.mjs';
const corners=b=>[b.min[0],b.max[0]].flatMap(x=>[b.min[1],b.max[1]].flatMap(y=>[b.min[2],b.max[2]].map(z=>new Vector3(x,y,z))));
export function createWolfTourV2Motion(index){
  const gear=createWolfGearRig(index),bearing=createWolfBearingRig(index);
  if(gear.ownedIds.some(id=>bearing.ownedIds.includes(id)))throw new Error('Mechanical channels must have one owner');
  const bearingInput=s=>s.chapter?.id==='bearing-roll'?{innerAngle:0,outerAngle:s.bearingAngle,bearing:'A'}:{innerAngle:0,outerAngle:gear.coordinatesForAngle(s.gearAngle??0).output,bearing:'both'};
  function workingPoses(state){const poses=gear.posesForAngle(state.gearAngle??0),bp=bearing.posesForAngles(bearingInput(state));for(const id of bearing.ownedIds)poses[id]=bp[id];return poses;}
  function worldMotions(state){const motions=gear.worldMotionsForAngle(state.gearAngle??0);for(const[id,m]of bearing.worldMotionsForAngles(bearingInput(state)))motions.set(id,m);return motions;}
  function boundsAt(state){const motions=worldMotions(state),result=new Map();for(const p of index.parts){const bounds=new Box3().setFromPoints(corners(p.worldBounds).map(v=>v.applyMatrix4(motions.get(p.id))));result.set(p.id,{min:bounds.min.toArray(),max:bounds.max.toArray()});}return result;}
  return {workingPoses,worldMotions,boundsAt,gearBoundsAt:gear.boundsAtAngle,gear,bearing};
}
