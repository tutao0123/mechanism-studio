import { Matrix4, Quaternion, Vector3, Box3 } from 'three';
const identityPose=()=>({position:[0,0,0],quaternion:[0,0,0,1],scale:[1,1,1]});
const matrix=value=>new Matrix4().fromArray(value);
const box=b=>new Box3(new Vector3(...b.min),new Vector3(...b.max));
/** Source nodes retain their local transforms. Joint rotations are conjugated
 * into each model wrapper's parent frame, before that original source node. */
export function createHandMotion(index,source){
 if(!Array.isArray(source?.bodies)||!source.bodies.length)throw new Error('Resolved source bodies are required');
 const byId=new Map(index.parts.map(p=>[p.id,p]));
 // The narrow importer uses B: source [x,y,z] -> display [x,z,-y].
 // Its local matrices and geometry already contain B; joint axes/anchors in
 // source-assembly remain native and must be converted exactly once here.
 const basis=v=>[v[0],v[2],-v[1]];
 const bodies=source.bodies.map(b=>({...b,id:b.id??`mjcf:${b.name}`,joints:(b.joints??[]).map(j=>({...j,axis:basis(j.axis),pos:basis(j.pos??[0,0,0])}))}));
 const sourceById=new Map(bodies.map(b=>[b.id,b]));
 const joints=bodies.flatMap(b=>b.joints.map(j=>({...j,bodyId:b.id})));
 if(joints.length!==16||bodies.length!==21)throw new Error('Expected the pinned 21-body, 16-hinge Allegro model');
 for(const j of joints){if(j.type!=='hinge'||!Array.isArray(j.axis)||!Array.isArray(j.range))throw new Error(`Unsupported or unresolved joint ${j.name}`);}
 function neutralAngles(){return Object.fromEntries(joints.map(j=>[j.name,Math.max(j.range[0],Math.min(j.range[1],j.ref??0))]));}
 function validateAngles(angles){for(const j of joints){const q=angles[j.name];if(!Number.isFinite(q)||q<j.range[0]-1e-9||q>j.range[1]+1e-9)throw new RangeError(`${j.name} is outside the source range`);}return angles;}
 function localMotion(b,angles){
  const result=new Matrix4();
  for(const j of b.joints){const axis=new Vector3(...j.axis).normalize(),p=j.pos??[0,0,0],q=new Quaternion().setFromAxisAngle(axis,angles[j.name]-(j.ref??0));
   result.multiply(new Matrix4().makeTranslation(...p)).multiply(new Matrix4().makeRotationFromQuaternion(q)).multiply(new Matrix4().makeTranslation(...p.map(v=>-v)));
  }return result;
 }
 function posesForAngles(angles){
  validateAngles(angles);return Object.fromEntries(bodies.map(b=>{
   const p=byId.get(b.id);if(!p)throw new Error(`Source/index mismatch ${b.id}`);
   if(!b.joints.length)return[b.id,identityPose()];
   const local=matrix(p.localMatrix),model=local.clone().multiply(localMotion(b,angles)).multiply(local.clone().invert());
   const position=new Vector3(),quaternion=new Quaternion(),scale=new Vector3();model.decompose(position,quaternion,scale);
   return[b.id,{position:position.toArray(),quaternion:quaternion.normalize().toArray(),scale:scale.toArray()}];
  }));
 }
 function worldMatricesForAngles(angles){
  validateAngles(angles);const worlds=new Map();
  function visit(id){if(worlds.has(id))return worlds.get(id);const p=byId.get(id),b=sourceById.get(id);if(!p||!b)throw new Error(`Missing source identity ${id}`);
   const local=matrix(p.localMatrix),parent=byId.has(p.parentId)?visit(p.parentId):matrix(p.worldMatrix).multiply(local.clone().invert());
   const world=parent.clone().multiply(local).multiply(localMotion(b,angles));worlds.set(id,world);return world;
  }
  for(const id of byId.keys())visit(id);return worlds;
 }
 function boundsForAngles(angles){const worlds=worldMatricesForAngles(angles);return new Map(index.parts.map(p=>[p.id,box(p.localBounds).applyMatrix4(worlds.get(p.id))]));}
 const neutral=neutralAngles(),neutralWorld=worldMatricesForAngles(neutral),neutralIndex={...index,parts:index.parts.map(p=>{
   const bounds=box(p.localBounds).applyMatrix4(neutralWorld.get(p.id));return {...p,worldMatrix:neutralWorld.get(p.id).toArray(),worldBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},worldCenter:bounds.getCenter(new Vector3()).toArray()};
 })};
 return {joints,bodies,neutralAngles,neutralIndex,validateAngles,posesForAngles,worldMatricesForAngles,boundsForAngles,workingPoses:state=>posesForAngles(state.angles)};
}
