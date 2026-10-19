import {Matrix4, Quaternion, Vector3, Box3} from 'three';
export const SOURCE_HASH='8d4a4f840ff5f928d56e387a8325d1f34437b35f72b82792e4d46f8de879e133';
export const MAX_DRIVER_ANGLE=.75;
const id=n=>`mjcf:${n}`;
const neutral=()=>({position:[0,0,0],quaternion:[0,0,0,1],scale:[1,1,1]});
const vec=a=>new Vector3(...a);
// Importer converts every local frame with B=[x,z,-y], not only the root.
const anchor=vec([-.0179014,.0044,.00651468]);
const axis=new Vector3(0,1,0);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const rotate=(v,n,q)=>v.clone().applyAxisAngle(n,q);
const project=(v,n)=>v.clone().addScaledVector(n,-v.dot(n));
const corners=b=>[b.min[0],b.max[0]].flatMap(x=>[b.min[1],b.max[1]].flatMap(y=>[b.min[2],b.max[2]].map(z=>new Vector3(x,y,z))));

/** Exact rigid-link closure in the source hinge planes. No contact/dynamics. */
export function createGripperRig(index){
  const parts=new Map(index.parts.map(p=>[p.id,p]));
  const rest=new Map(index.parts.map(p=>[p.id,new Matrix4().fromArray(p.worldMatrix)]));
  const local=new Map(index.parts.map(p=>[p.id,new Matrix4().fromArray(p.localMatrix)]));
  if(index.units!=='m'||parts.size!==11||index.source?.sha256!==SOURCE_HASH)throw new Error('Expected the pinned eleven-body source in metres.');
  const moving=new Set(['left','right'].flatMap(s=>['driver','spring_link','follower'].map(n=>id(`${s}_${n}`))));
  const sides=['left','right'].map(side=>{
    const ids=Object.fromEntries(['driver','coupler','spring_link','follower'].map(n=>[n,id(`${side}_${n}`)]));
    for(const value of Object.values(ids))if(!parts.has(value))throw new Error(`Missing source body ${value}`);
    const W=Object.fromEntries(Object.entries(ids).map(([k,v])=>[k,rest.get(v)]));
    const S=new Vector3().setFromMatrixPosition(W.spring_link),F=new Vector3().setFromMatrixPosition(W.follower);
    const A=anchor.clone().applyMatrix4(W.follower),couplerAnchor=A.clone().applyMatrix4(W.coupler.clone().invert());
    const n=axis.clone().transformDirection(W.spring_link),nf=axis.clone().transformDirection(W.follower);
    if(Math.abs(n.dot(nf))<1-1e-9)throw new Error('Expected parallel source linkage axes.');
    const l1=project(F.clone().sub(S),n).length(),l2=project(A.clone().sub(F),n).length();
    const u=project(F.clone().sub(S),n).normalize(),v=new Vector3().crossVectors(n,u).normalize();
    const base=parts.get(ids.driver).parentId, P=base?rest.get(base):new Matrix4();
    const driverWorld=q=>P.clone().multiply(local.get(ids.driver)).multiply(new Matrix4().makeRotationAxis(axis,q));
    const target=q=>couplerAnchor.clone().applyMatrix4(driverWorld(q).multiply(local.get(ids.coupler)));
    const candidates=q=>{
      const d=project(target(q).sub(S),n),r=d.length(),phi=Math.atan2(d.dot(v),d.dot(u));
      const cosine=(l1*l1+r*r-l2*l2)/(2*l1*r);
      if(cosine < -1-1e-9||cosine>1+1e-9)throw new Error('Source loop cannot close at requested angle.');
      const alpha=Math.acos(Math.max(-1,Math.min(1,cosine)));
      return [wrap(phi+alpha),wrap(phi-alpha)];
    };
    const initial=candidates(0),branch=Math.abs(initial[0])<Math.abs(initial[1])?0:1;
    const solve=q=>{
      const spring=q===0?0:candidates(q)[branch];
      const Fq=S.clone().add(rotate(F.clone().sub(S),n,spring));
      const from=project(rotate(A.clone().sub(F),n,spring),nf),to=project(target(q).sub(Fq),nf);
      const follower=q===0?0:Math.atan2(nf.dot(new Vector3().crossVectors(from,to)),from.dot(to));
      return {[ids.driver]:q,[ids.spring_link]:spring,[ids.follower]:follower};
    };
    return {ids,solve,couplerAnchor};
  });
  function coordinates(q=0){
    if(!Number.isFinite(q)||q<0||q>MAX_DRIVER_ANGLE)throw new RangeError('Driver angle outside verified 0..0.75 radians.');
    return Object.assign({},...sides.map(s=>s.solve(q)));
  }
  function worldMatrices(q){
    const qs=coordinates(q),world=new Map();
    for(const p of index.parts){
      const L=local.get(p.id).clone();
      if(moving.has(p.id))L.multiply(new Matrix4().makeRotationAxis(axis,qs[p.id]));
      world.set(p.id,(p.parentId?world.get(p.parentId).clone():new Matrix4()).multiply(L));
    }
    return world;
  }
  function posesForAngle(q=0){
    const qs=coordinates(q),poses={};
    for(const p of index.parts){
      poses[p.id]=neutral();if(!moving.has(p.id)||q===0)continue;
      const L=local.get(p.id),M=L.clone().multiply(new Matrix4().makeRotationAxis(axis,qs[p.id])).multiply(L.clone().invert());
      const pos=new Vector3(),quat=new Quaternion(),scale=new Vector3();M.decompose(pos,quat,scale);
      poses[p.id]={position:pos.toArray(),quaternion:quat.normalize().toArray(),scale:[1,1,1]};
    }return poses;
  }
  function closureErrors(q){const world=worldMatrices(q);return sides.map(s=>anchor.clone().applyMatrix4(world.get(s.ids.follower)).distanceTo(s.couplerAnchor.clone().applyMatrix4(world.get(s.ids.coupler))));}
  function boundsAtAngle(q){
    const W=worldMatrices(q);return new Map(index.parts.map(p=>{
      const motion=W.get(p.id).clone().multiply(rest.get(p.id).clone().invert());
      const b=new Box3().setFromPoints(corners(p.worldBounds).map(v=>v.applyMatrix4(motion)));
      return [p.id,{min:b.min.toArray(),max:b.max.toArray()}];
    }));
  }
  return {coordinates,worldMatrices,posesForAngle,closureErrors,boundsAtAngle,workingPoses:s=>posesForAngle(s.driverAngle),ownedIds:[...moving],
    evidence:{method:'Analytic two-circle intersection, branch continuous from the retained source zero pose; follower angle closes the source connect anchor.',sourceHash:SOURCE_HASH,maximumDriverAngle:MAX_DRIVER_ANGLE,connectAnchorSourceBody1:[-.0179014,-.00651468,.0044],connectAnchorDisplayBody1:anchor.toArray(),limitations:['Rigid source kinematics, no grasp/contact/force or adaptive response simulation.','Source STL bodies, not internal fasteners or manufacturing CAD.','Animation stays in an independently checked subset of source joint limits.']}};
}
