import {Vector3,Quaternion} from 'three';
import {createWolfTourV2Framing,CAMERA_UP} from '../tour-v2/framing.mjs';
export {CAMERA_UP};
const UP=new Vector3(...CAMERA_UP);
function mix(a,b,p){if(p<=0)return structuredClone(a);if(p>=1)return structuredClone(b);const target=new Vector3(...a.target).lerp(new Vector3(...b.target),p),x=new Vector3(...a.position).sub(new Vector3(...a.target)),y=new Vector3(...b.position).sub(new Vector3(...b.target)),distance=Math.exp(Math.log(x.length())*(1-p)+Math.log(y.length())*p);x.normalize();y.normalize();const rotation=new Quaternion().slerp(new Quaternion().setFromUnitVectors(x,y),p);return {position:x.applyQuaternion(rotation).multiplyScalar(distance).add(target).toArray(),target:target.toArray(),halfHeight:Math.exp(Math.log(a.halfHeight)*(1-p)+Math.log(b.halfHeight)*p)};}
export function createWolfTourV3Framing(index,story,rig){
  const previous=createWolfTourV2Framing(index,story.previous,rig),axis=new Vector3(...rig.gear.axisWorld),pivot=new Vector3(...rig.gear.pivotWorld),planet=index.parts.find(p=>p.id===story.selectedPair.planet);
  const radial=new Vector3(...planet.worldCenter).sub(pivot);radial.addScaledVector(axis,-radial.dot(axis));
  // Source centre distance and measured 96:24 teeth locate the pitch interface.
  // This is an observation target, not an invented contact constraint or mesh.
  const pitchRadius=radial.length()*96/120,restContact=radial.clone().setLength(pitchRadius);restContact.y=.004;
  const direction=new Vector3(...story.editorialAxis.direction).multiplyScalar(.80).addScaledVector(new Vector3(...story.editorialAxis.radialU),.40).addScaledVector(new Vector3(...story.editorialAxis.radialV),.56).normalize();
  function contactAt(s){const q=rig.gear.coordinatesForAngle(s.gearAngle);const v=restContact.clone();v.y=0;v.applyAxisAngle(axis,q.orbit);v.y=restContact.y;return v.toArray();}
  // Fixed authored magnification. The target follows a single known analytic
  // orbit; changing mesh bounds never re-fit or breathe the camera each frame.
  const focusHalfHeight=aspect=>Math.max(.036,.040/aspect);
  function macroPose(s,aspect){const target=new Vector3(...contactAt(s));return {target:target.toArray(),position:target.clone().addScaledVector(direction,.5).toArray(),halfHeight:focusHalfHeight(aspect)};}
  const state=(id,local)=>{const c=story.CHAPTERS.find(c=>c.id===id);if(!c||!Number.isFinite(local))throw new Error('Unknown macro camera chapter');return story.stateAt(c.firstBeat*60/story.BPM+local);};
  function cameraFor(id,aspect,local=0){const original=previous.cameraFor(id,aspect,local),s=state(id,local);return id==='gearing'?mix(original,macroPose(s,aspect),s.gearMacro):original;}
  function stillCameraFor(id,aspect,local=0){if(id!=='gearing')return previous.stillCameraFor(id,aspect,local);const s=state(id,local);return s.gearMacro>0?macroPose(s,aspect):previous.stillCameraFor(id,aspect,local);}
  return {...previous,cameraRevision:'wolf-original-tooth-interface-3',cameraFor,stillCameraFor,selectedPair:story.selectedPair,contactAt,macroPose,focusHalfHeight,pitchRadius,direction:direction.toArray(),annotationCameraFor:previous.annotationCameraFor};
}
