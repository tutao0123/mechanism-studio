import {Box3,Quaternion,Vector3} from 'three';
import {createWolfTourFraming as createBaseFraming,CAMERA_UP} from '../tour/framing.mjs';
import {ramp} from './story.mjs';
export {CAMERA_UP};
const UP=new Vector3(...CAMERA_UP),corners=b=>[b.min[0],b.max[0]].flatMap(x=>[b.min[1],b.max[1]].flatMap(y=>[b.min[2],b.max[2]].map(z=>new Vector3(x,y,z))));
function interpolate(a,b,p){
  if(p<=0)return structuredClone(a);if(p>=1)return structuredClone(b);
  const target=new Vector3(...a.target).lerp(new Vector3(...b.target),p),x=new Vector3(...a.position).sub(new Vector3(...a.target)),y=new Vector3(...b.position).sub(new Vector3(...b.target)),dx=x.length(),dy=y.length();x.normalize();y.normalize();
  const rotation=new Quaternion().slerp(new Quaternion().setFromUnitVectors(x,y),p),distance=Math.exp(Math.log(dx)*(1-p)+Math.log(dy)*p);
  return {target:target.toArray(),position:x.applyQuaternion(rotation).multiplyScalar(distance).add(target).toArray(),halfHeight:Math.exp(Math.log(a.halfHeight)*(1-p)+Math.log(b.halfHeight)*p)};
}
function fit(points,direction,aspect){
  const bounds=new Box3().setFromPoints(points),target=bounds.getCenter(new Vector3()),right=new Vector3().crossVectors(UP,direction).normalize(),up=new Vector3().crossVectors(direction,right).normalize();
  let width=0,height=0;for(const p of points){const q=p.clone().sub(target);width=Math.max(width,Math.abs(q.dot(right)));height=Math.max(height,Math.abs(q.dot(up)));}
  const halfHeight=Math.max(height/.78,width/(aspect*.72),.001),distance=Math.max(bounds.getSize(new Vector3()).length()*2,.3);
  return {position:target.clone().addScaledVector(direction,distance).toArray(),target:target.toArray(),halfHeight};
}
export function createWolfTourV2Framing(index,story,rig){
  const original=createBaseFraming(index,story.base),axis=new Vector3(...story.editorialAxis.direction),u=new Vector3(...story.editorialAxis.radialU),v=new Vector3(...story.editorialAxis.radialV);
  const gearDirection=axis.clone().multiplyScalar(.95).addScaledVector(u,.25).addScaledVector(v,.35).normalize();
  const bearingDirection=axis.clone().multiplyScalar(.95).addScaledVector(u,.30).addScaledVector(v,.42).normalize();
  const gearPoints=[];
  for(let i=0;i<=24;i++){const bounds=rig.gearBoundsAt(Math.PI/2*i/24);for(const id of story.gearIds)gearPoints.push(...corners(bounds.get(id)));}
  const bearingPoints=index.parts.filter(p=>story.bindings.bearing.bearingParts.includes(p.id)).flatMap(p=>corners(p.worldBounds).map(v=>v.add(new Vector3(...story.MACRO_MAXIMUM_OFFSETS[p.id]))));
  const basePose=(beat,aspect,reduced=false)=>{const s=story.base.stateAt(beat*60/story.BPM);return original[reduced?'stillCameraFor':'cameraFor'](s.chapter.id,aspect,s.localTime);};
  function poseAt(s,aspect,reduced=false){
    if(s.chapter.id==='gearing'){
      const detail=fit(gearPoints,gearDirection,aspect);
      if(reduced)return detail;
      if(s.beat<25)return interpolate(basePose(20,aspect),detail,ramp(s.beat,22,25));
      if(s.beat<=39)return detail;
      return interpolate(detail,basePose(28,aspect),ramp(s.beat,39,44));
    }
    if(s.chapter.id==='bearing-roll'){
      const detail=fit(bearingPoints,bearingDirection,aspect),entry=basePose(72,aspect,reduced);
      if(reduced)return detail;
      if(s.beat<90)return interpolate(entry,detail,ramp(s.beat,88,90));
      if(s.beat<=102)return detail;
      return interpolate(detail,entry,ramp(s.beat,102,104));
    }
    return original[reduced?'stillCameraFor':'cameraFor'](s.baseState.chapter.id,aspect,s.baseState.localTime);
  }
  const state=(id,local)=>{const c=story.CHAPTERS.find(c=>c.id===id);if(!c||!Number.isFinite(local))throw new Error('Unknown tour camera chapter');return story.stateAt(c.firstBeat*60/story.BPM+local);};
  return {cameraRevision:'wolf-source-motion-camera-2',geometryRevision:index.geometryRevision,cameraFor:(id,a,t=0)=>poseAt(state(id,t),a),stillCameraFor:(id,a,t=0)=>poseAt(state(id,t),a,true),annotationCameraFor:(id,a)=>{if(id==='gearing'||id==='bearing-roll')return poseAt(state(id,3),a);return original.annotationCameraFor(id,a);},fullEnvelope:original.fullEnvelope,gearPoints,bearingPoints};
}
