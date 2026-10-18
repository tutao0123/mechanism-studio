/** Authored source-bound input rotation, not recovered STEP mates or dynamics.
 * The timeline supplies progress. Source rest nodes and display offsets stay separate.
 */
import {Matrix4,Quaternion,Vector3,Box3} from 'three';
import {SOURCE_SHA256} from '../story.mjs';
export const KINEMATICS_REVISION='wolf-input-rotation-illustrative-1';
const clean=value=>Math.abs(value)<1e-14?0:value;
const neutral=()=>({position:[0,0,0],quaternion:[0,0,0,1],scale:[1,1,1]});
const copyBounds=b=>({min:[...b.min],max:[...b.max]});
const corners=b=>{const result=[];for(const x of[b.min[0],b.max[0]])for(const y of[b.min[1],b.max[1]])for(const z of[b.min[2],b.max[2]])result.push(new Vector3(x,y,z));return result;};
const progressOf=value=>{const p=value??0;if(!Number.isFinite(p)||p< -1e-10||p>1+1e-10)throw new RangeError('Input demonstration progress must be finite within 0..1');return Math.max(0,Math.min(1,p));};

export function createWolfWorkingMotion(index){
  if(index?.sourceSHA256!==SOURCE_SHA256||index.units!=='m')throw new Error('Input rotation requires the exact retained WOLF STEP index in metres');
  const all=new Map([...index.assemblies,...index.parts].map(p=>[p.id,p]));if(all.size!==index.assemblies.length+index.parts.length)throw new Error('Source occurrence IDs must be unique');
  const one=(name,records=index.parts)=>{const matches=records.filter(p=>p.name===name);if(matches.length!==1)throw new Error(`Expected one source component: ${name}`);return matches[0];};
  const motor=one('motor-8318 <1>',index.assemblies),motorParts=index.parts.filter(p=>p.parentId===motor.id),shaft=one('motor-shaft',motorParts),nut=one('motor-hex-nut',motorParts),rotor=one('rotor',motorParts),body=one('rotor-body',motorParts),stator=one('stator',motorParts),mount=one('motor-mount-plate-8318',motorParts),sun=one('sun-gear'),holder=one('encoder-magnet-holder');
  const magnets=motorParts.filter(p=>p.name==='magnet'),cc=motorParts.filter(p=>p.name==='cc');
  if(motorParts.length!==86||magnets.length!==40||cc.length!==40||index.parts.length!==245)throw new Error('Pinned complete motor and actuator source sets required');
  const rotating=[rotor,body,shaft,nut,...magnets,sun,holder],rotatingIds=Object.freeze(rotating.map(p=>p.id)),moving=new Set(rotatingIds);
  if(moving.size!==46)throw new Error('Authored input group must contain 46 distinct source leaves');
  // Use the original coaxial rest frame, not an asymmetric tessellated rotor's
  // bounding-box centroid. This chooses a presentation axis, not a source joint.
  const shaftWorld=new Matrix4().fromArray(shaft.worldMatrix),pivot=new Vector3().setFromMatrixPosition(shaftWorld),axis=new Vector3(0,1,0).transformDirection(shaftWorld).normalize();
  const pivotWorld=Object.freeze(pivot.toArray().map(clean)),axisWorld=Object.freeze(axis.toArray().map(clean));pivot.fromArray(pivotWorld);axis.fromArray(axisWorld).normalize();
  const parents=new Map();
  for(const part of rotating){
    const parent=all.get(part.parentId);if(!parent||parent.worldMatrix?.length!==16||!parent.worldMatrix.every(Number.isFinite))throw new Error(`Actual source parent matrix required: ${part.id}`);
    const matrix=new Matrix4().fromArray(parent.worldMatrix),scale=new Vector3(),position=new Vector3(),q=new Quaternion();matrix.decompose(position,q,scale);
    if(Math.abs(matrix.determinant()-1)>1e-8||scale.toArray().some(v=>Math.abs(v-1)>1e-8))throw new Error('Working-pose adapter requires rigid source parent placements');
    for(let cursor=parent;cursor;cursor=all.get(cursor.parentId))if(moving.has(cursor.id))throw new Error('Nested rotating semantic leaves require inherited-motion compensation');
    parents.set(part.id,{matrix,inverse:matrix.clone().invert()});
  }
  function worldRotation(progress){
    const p=progressOf(progress);if(p===0||p===1)return new Matrix4();
    return new Matrix4().makeTranslation(...pivotWorld).multiply(new Matrix4().makeRotationAxis(axis,2*Math.PI*p)).multiply(new Matrix4().makeTranslation(...pivotWorld.map(v=>-v)));
  }
  function workingPoses(state={}){
    const progress=progressOf(state.motionDemoProgress),poses=Object.fromEntries(index.parts.map(p=>[p.id,neutral()]));
    if(progress===0||progress===1)return poses;
    const world=worldRotation(progress);
    for(const id of rotatingIds){
      const parent=parents.get(id),matrix=parent.inverse.clone().multiply(world).multiply(parent.matrix),position=new Vector3(),quaternion=new Quaternion(),scale=new Vector3();
      matrix.decompose(position,quaternion,scale);quaternion.normalize();
      poses[id]={position:position.toArray().map(clean),quaternion:quaternion.toArray().map(clean),scale:[1,1,1]};
    }
    return poses;
  }
  function boundsAt(progress){
    const rotation=worldRotation(progress),result=new Map();
    for(const part of index.parts){
      if(!moving.has(part.id)){result.set(part.id,copyBounds(part.worldBounds));continue;}
      const box=new Box3().setFromPoints(corners(part.worldBounds).map(p=>p.applyMatrix4(rotation)));result.set(part.id,{min:box.min.toArray(),max:box.max.toArray()});
    }
    return result;
  }
  function rotationEnvelope(){
    const result=new Map();
    for(const part of index.parts){
      if(!moving.has(part.id)){result.set(part.id,copyBounds(part.worldBounds));continue;}
      const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
      for(const point of corners(part.worldBounds)){
        const relative=point.clone().sub(pivot),axial=relative.dot(axis),center=pivot.clone().addScaledVector(axis,axial),radius=Math.sqrt(Math.max(0,relative.lengthSq()-axial*axial));
        for(let i=0;i<3;i++){const extent=radius*Math.sqrt(Math.max(0,1-axis.getComponent(i)**2));bounds.min[i]=Math.min(bounds.min[i],center.getComponent(i)-extent);bounds.max[i]=Math.max(bounds.max[i],center.getComponent(i)+extent);}
      }
      result.set(part.id,bounds);
    }
    return result;
  }
  const evidence=Object.freeze({revision:KINEMATICS_REVISION,sourceSHA256:SOURCE_SHA256,sourceKind:'STEP source identities with authored teaching kinematics',sourceComponentId:motor.id,
    anglePolicy:'One illustrative input turn: angle=2*pi*motionDemoProgress; progress 0 and 1 return exact identity. The timeline owns easing and timing.',
    axisPolicy:'Original motor-shaft rest origin and its source local +Y axis, mapped into display world metres; this is an authored input-axis choice, not a recovered revolute mate.',
    membershipPolicy:'Rotor/body/magnet/shaft/nut co-rotation is an explicit mechanical interpretation of source names and coaxial geometry; the original STEP supplies no rigid mates. The source manual confirms sun-to-motor attachment and encoder-holder-to-rear-nut attachment.',
    fixedPolicy:'Stator, mount and forty generic cc pieces hold their source placement; cc is not assigned a winding function. Ring/planet/bearing output motion is not inferred.',
    sourceManual:'../source/WOLF-Assembly-Guide-V1.1.pdf',sourceManualSteps:[2,3,12],sourceReadme:'../source/UPSTREAM-README.md',
    rotatingIds,explicitStationaryIds:Object.freeze([stator.id,mount.id,...cc.map(p=>p.id)]),limitations:Object.freeze(['Not recovered CAD mates.','No gear contact, signed reduction, tooth counts, torque, speed or load model.','No dynamics, electromagnetic or collision validation.','Display translations remain separate; rotating labels must be suppressed.'])});
  return {workingPoses,boundsAt,rotationEnvelope,worldRotation,rotatingIds,axisWorld,pivotWorld,evidence,KINEMATICS_REVISION};
}
