import {Box3,Vector3} from 'three';
const UP=new Vector3(0,1,0);
const box=b=>new Box3(new Vector3(...b.min),new Vector3(...b.max));
const corners=b=>[b.min.x,b.max.x].flatMap(x=>[b.min.y,b.max.y].flatMap(y=>[b.min.z,b.max.z].map(z=>new Vector3(x,y,z))));
export function createGripperFraming(index,story,rig){
 const whole=new Box3(),expanded=new Box3(),detail=new Box3();
 for(let sample=0;sample<=150;sample++)for(const [id,b]of rig.boundsAtAngle(.75*sample/150)){if(index.parts.find(p=>p.id===id).hasGeometry!==false)whole.union(box(b));}
 for(const p of index.parts){if(p.hasGeometry===false)continue;const b=box(p.worldBounds),moved=b.clone().translate(new Vector3(...story.MAXIMUM_OFFSETS[p.id]));expanded.union(b).union(moved);if(story.details.includes(p.id))detail.union(moved);}
 expanded.union(whole);
 const front=new Vector3(.18,.12,1).normalize();
 const plans={work:whole,expand:expanded,detail,relation:expanded,return:expanded,resolve:whole};
 function cameraFor(name,aspect){
  if(!(aspect>0)||!Number.isFinite(aspect)||!plans[name])throw new Error('Valid framing chapter and aspect required');
  const bounds=plans[name],target=bounds.getCenter(new Vector3()),direction=front.clone();
  const right=new Vector3().crossVectors(UP,direction).normalize(),up=new Vector3().crossVectors(direction,right).normalize();
  let x=0,y=0;for(const p of corners(bounds)){p.sub(target);x=Math.max(x,Math.abs(p.dot(right)));y=Math.max(y,Math.abs(p.dot(up)));}
  // Portrait needs room for two retained names next to the actual outlines.
  // Keep the reviewed desktop composition; only the narrow detail pulls back.
  const narrowDetail=name==='detail'&&aspect<1.05;
  const reserve=name==='detail'?(narrowDetail?.52:.69):.82;
  const halfHeight=Math.max(y/(narrowDetail?.7:.8),x/(aspect*reserve),.025);
  return {position:target.clone().addScaledVector(direction,1).toArray(),target:target.toArray(),halfHeight};
 }
 return {cameraFor,annotationCameraFor:cameraFor,geometryRevision:index.geometryRevision,cameraRevision:'robotiq-framing-2',envelopes:plans,
  boundsMethod:'Rest and full exploded AABB endpoint unions; assembled working bounds sampled across the verified 0..0.75 rad driver range. No live auto-fit.'};
}
