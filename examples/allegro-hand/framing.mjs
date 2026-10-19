import { Box3, Vector3 } from 'three';
import { BPM, CHAPTERS, DETAIL_IDS, ramp } from './story.mjs';
export const CAMERA_UP=[1,0,0];
const up=new Vector3(...CAMERA_UP),direction=new Vector3(.24,1,.24).normalize();
const asBox=b=>new Box3(new Vector3(...b.min),new Vector3(...b.max));
const corners=b=>[b.min.x,b.max.x].flatMap(x=>[b.min.y,b.max.y].flatMap(y=>[b.min.z,b.max.z].map(z=>new Vector3(x,y,z))));
export function fitBounds(bounds,aspect){
 if(!Number.isFinite(aspect)||aspect<=0)throw new Error('Positive aspect required');
 const target=bounds.getCenter(new Vector3()),right=new Vector3().crossVectors(up,direction).normalize(),screenUp=new Vector3().crossVectors(direction,right).normalize();
 let x=0,y=0;for(const point of corners(bounds)){point.sub(target);x=Math.max(x,Math.abs(point.dot(right)));y=Math.max(y,Math.abs(point.dot(screenUp)));}
 const halfHeight=Math.max(y/.78,x/(aspect*.7),.015),distance=Math.max(halfHeight*4,bounds.getSize(new Vector3()).length()*2,.35);
 return {target:target.toArray(),position:target.clone().addScaledVector(direction,distance).toArray(),halfHeight};
}
const mix=(a,b,t)=>({target:a.target.map((v,i)=>v+(b.target[i]-v)*t),position:a.position.map((v,i)=>v+(b.position[i]-v)*t),halfHeight:a.halfHeight+(b.halfHeight-a.halfHeight)*t});
/** Precomputed source-derived envelopes; no live bounds or per-frame refit. */
export function createHandFraming(index,timeline){
 const {rig}=timeline,whole=new Box3(),expanded=new Box3(),detail=new Box3();
 // Smooth joint trajectories are sampled densely, then a conservative reserve
 // is added. The tests additionally project actual posed geometry at 120 Hz.
 for(let beat=0;beat<=22;beat+=.125){const s=timeline.stateAt(beat*60/BPM);for(const b of rig.boundsForAngles(s.angles).values())whole.union(b);}
 for(const p of rig.neutralIndex.parts){const b=asBox(p.worldBounds),m=new Vector3(...timeline.maximumOffsets[p.id]);expanded.union(b).union(b.clone().translate(m));if(DETAIL_IDS.includes(p.id))detail.union(b.clone().translate(m));}
 whole.expandByScalar(.004);expanded.union(whole).expandByScalar(.004);detail.expandByScalar(.004);
 function atBeat(beat,aspect){
  const a=fitBounds(whole,aspect),e=fitBounds(expanded,aspect),d=fitBounds(detail,aspect);
  if(beat<22)return mix(a,e,ramp(beat,19,22));
  if(beat<34)return e;
  if(beat<46)return mix(e,d,ramp(beat,35.5,37.3));
  if(beat<58)return mix(d,e,ramp(beat,46,49));
  return mix(e,a,ramp(beat,58,60.5));
 }
 function beatFor(id,local=0){const c=CHAPTERS.find(c=>c.id===id);if(!c)throw new Error(`Unknown chapter ${id}`);return c.firstBeat+local*BPM/60;}
 return {geometryRevision:index.geometryRevision,envelopes:{whole,expanded,detail},atBeat,
  cameraFor:(id,aspect,local=0)=>atBeat(beatFor(id,local),aspect),
  annotationCameraFor:(id,aspect)=>atBeat(({separate:30,detail:39,resolve:62})[id]??CHAPTERS.find(c=>c.id===id).firstBeat,aspect),
  stillCameraFor:(id,aspect,local=0)=>id==='detail'?fitBounds(detail,aspect):fitBounds(expanded,aspect)};
}
