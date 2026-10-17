import { Box3,Vector3 } from 'three';
export const CAMERA_UP=Object.freeze([0,0,1]);
const smooth=x=>{const p=Math.max(0,Math.min(1,x));return p**3*(10-15*p+6*p*p);};
const box=record=>new Box3(new Vector3(...record.min),new Vector3(...record.max));
function corners(box){const result=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])result.push(new Vector3(x,y,z));return result;}
export function createWolfMotorFraming(index,story){
  const axis=new Vector3(...story.editorialAxis.direction),u=new Vector3(...story.editorialAxis.radialU),v=new Vector3(...story.editorialAxis.radialV);
  const records=new Map(index.parts.map(p=>[p.id,{rest:box(p.worldBounds),offset:new Vector3(...story.MAXIMUM_OFFSETS[p.id])}]));
  const envelope=(ids,swept)=>{const bounds=new Box3();for(const id of ids){const r=records.get(id);if(!r||r.rest.isEmpty())throw new Error('Actual source bounds required');if(swept)bounds.union(r.rest);bounds.union(r.rest.clone().translate(r.offset));}return bounds;};
  const all=index.parts.map(p=>p.id),plans=new Map(story.CHAPTERS.map(chapter=>{
    const whole=['whole','resolve'].includes(chapter.id),ids=whole?all:story.details[chapter.id];
    const swept=['motor','layers','return'].includes(chapter.id),bounds=whole?all.reduce((b,id)=>b.union(records.get(id).rest),new Box3()):envelope(ids,swept);
    // Fit the real individual part boxes, rather than corners of an empty
    // diagonal between unrelated extrema of one large union box. Linear
    // editorial translations stay inside their rest/full endpoint envelope.
    const points=[];
    for(const id of ids){const record=records.get(id);if(whole||swept)points.push(...corners(record.rest));if(!whole)points.push(...corners(record.rest.clone().translate(record.offset)));}
    const direction=axis.clone().multiplyScalar(whole?.75:.86).addScaledVector(u,whole?.65:.60).addScaledVector(v,.70).normalize();
    return [chapter.id,{bounds,direction,points}];
  }));
  function cameraFor(chapterId,aspect,localTime=0){
    const plan=plans.get(chapterId);if(!plan||!Number.isFinite(aspect)||aspect<=0||!Number.isFinite(localTime)||localTime<0)throw new Error('Invalid camera request');
    const target=plan.bounds.getCenter(new Vector3()),direction=plan.direction;
    const right=new Vector3().crossVectors(new Vector3(...CAMERA_UP),direction).normalize(),up=new Vector3().crossVectors(direction,right).normalize();
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const point of plan.points){const p=point.clone().sub(target),x=p.dot(right),y=p.dot(up);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    target.addScaledVector(right,(minX+maxX)/2).addScaledVector(up,(minY+maxY)/2);
    const ex=(maxX-minX)/2,ey=(maxY-minY)/2;
    const pullback=['repeats','hardware'].includes(chapterId)?1+.035*smooth((localTime-3.15)/.65):1;
    const halfHeight=Math.max(ey/.82,ex/(aspect*.72),.001)*pullback,distance=Math.max(plan.bounds.getSize(new Vector3()).length()*2,halfHeight*2.5,.1);
    return {position:target.clone().addScaledVector(direction,distance).toArray(),target:target.toArray(),halfHeight};
  }
  return {geometryRevision:index.geometryRevision,envelopes:Object.fromEntries([...plans].map(([id,p])=>[id,p.bounds.clone()])),cameraFor,annotationCameraFor:(chapterId,aspect)=>cameraFor(chapterId,aspect,0)};
}
