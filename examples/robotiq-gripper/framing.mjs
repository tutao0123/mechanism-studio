import {Box3,Vector3} from 'three';
const box=b=>new Box3(new Vector3(...b.min),new Vector3(...b.max));
export function createGripperCameraPlan(index,story,rig){
 const whole=new Box3(),expanded=new Box3(),detail=new Box3();
 for(let sample=0;sample<=150;sample++)for(const [id,b]of rig.boundsAtAngle(.75*sample/150)){if(index.parts.find(p=>p.id===id).hasGeometry!==false)whole.union(box(b));}
 for(const p of index.parts){if(p.hasGeometry===false)continue;const b=box(p.worldBounds),moved=b.clone().translate(new Vector3(...story.MAXIMUM_OFFSETS[p.id]));expanded.union(b).union(moved);if(story.details.includes(p.id))detail.union(moved);}
 expanded.union(whole);
 const front=new Vector3(.18,.12,1).normalize();
 const plans={work:whole,expand:expanded,detail,relation:expanded,return:expanded,resolve:whole};
 // Portrait detail keeps the existing extra room for the two retained names.
 // The shared executor projects these fixed envelopes; live bounds never fit the camera.
 const cameras=Object.fromEntries(Object.entries(plans).map(([name,bounds])=>[name,{
  bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},direction:front.toArray(),
  fillX:name==='detail'?.69:.82,fillY:.8,minHalfHeight:.025,distance:1,
  ...(name==='detail'?{narrow:{belowAspect:1.05,fillX:.52,fillY:.7}}:{}),
 }]));
 return {cameras,geometryRevision:index.geometryRevision,cameraRevision:'robotiq-framing-2',envelopes:plans,
  boundsMethod:'Rest and full exploded AABB endpoint unions; assembled working bounds sampled across the verified 0..0.75 rad driver range. No live auto-fit.'};
}

/** Existing callers share the compiled chapter camera executor. */
export function createGripperFraming(index,story) {
 if(story.geometryRevision!==index.geometryRevision||!story.framing)throw new Error('Compiled gripper presentation required.');
 return story.framing;
}
