// Illustrative rigid kinematics. No combustion, forces, heat, lubrication or CAD solver.
export const SPEC = Object.freeze({bore:82,stroke:90,rodLength:150,cylinderPitch:104,cylinderX:[-156,-52,52,156],firingOrder:[1,3,4,2],firingOffsets:[0,540,180,360],valveLift:9,metersPerUnit:0.001});
export const STROKES = Object.freeze([
  {id:'power',zh:'做功',start:0,end:180,explanation:'理想化点火后，活塞从上止点向下止点移动。气门保持关闭。'},
  {id:'exhaust',zh:'排气',start:180,end:360,explanation:'活塞向上移动，排气门打开；本示意用整段行程表示排气。'},
  {id:'intake',zh:'进气',start:360,end:540,explanation:'活塞向下移动，进气门打开；本示意用整段行程表示进气。'},
  {id:'compression',zh:'压缩',start:540,end:720,explanation:'活塞向上移动，两侧气门关闭；混合气压缩只用阶段说明，不求解压力。'}
]);
export const normalizeAngle = angle => ((angle % 720) + 720) % 720;
export function engineState(angle=0) {
  if(!Number.isFinite(angle)) throw new TypeError('曲轴角必须是有限数值。');
  const crankAngle=normalizeAngle(angle), r=SPEC.stroke/2,l=SPEC.rodLength;
  const cylinders=SPEC.cylinderX.map((x,i)=>{
    const phase=normalizeAngle(crankAngle-SPEC.firingOffsets[i]);
    const theta=phase*Math.PI/180;
    const pinY=-r*Math.sin(theta),pinZ=r*Math.cos(theta);
    const pistonHeight=pinZ+Math.sqrt(l*l-r*r*Math.sin(theta)**2);
    const stroke=STROKES[Math.floor(phase/180)];
    const intakeOpen=stroke.id==='intake', exhaustOpen=stroke.id==='exhaust';
    // A sinusoidal display lift is zero at the ideal phase boundaries.
    const lift=SPEC.valveLift*Math.sin((phase%180)*Math.PI/180);
    return {number:i+1,x,phase,theta,pinY,pinZ,pistonHeight,travelFromTDC:r+l-pistonHeight,
      rodAngle:-Math.asin(r*Math.sin(theta)/l),stroke,intakeOpen,exhaustOpen,
      intakeLift:intakeOpen?lift:0,exhaustLift:exhaustOpen?lift:0,
      ignition:phase<1e-8};
  });
  const displayedAngle=angle>=0&&angle<=720?angle:crankAngle;
  return {angle:crankAngle,inputAngle:displayedAngle,camAngle:displayedAngle/2,crankRadians:displayedAngle*Math.PI/180,cylinders,displacementCC:Math.PI/4*SPEC.bore**2*SPEC.stroke*4/1000};
}
export const bodyToGLTF = ([x,y,z]) => [x*.001,z*.001,-y*.001];
export function motionPoses(state){
  const poses={'crankshaft':{rotationX:state.crankRadians},'flywheel':{rotationX:state.crankRadians},'timing-drive':{rotationX:state.crankRadians},'intake-camshaft':{rotationX:state.crankRadians/2},'exhaust-camshaft':{rotationX:state.crankRadians/2}};
  for(const c of state.cylinders){
    poses[`piston-${c.number}`]={position:bodyToGLTF([c.x,0,c.pistonHeight])};
    poses[`rod-${c.number}`]={position:bodyToGLTF([c.x,c.pinY,c.pinZ]),rotationX:c.rodAngle};
    poses[`intake-valve-${c.number}`]={position:bodyToGLTF([c.x,-17,232-c.intakeLift])};
    poses[`exhaust-valve-${c.number}`]={position:bodyToGLTF([c.x,17,232-c.exhaustLift])};
  }
  return poses;
}
export function createSession(){return {angle:0,playing:false,selectedCylinder:1,view:{camera:'overview',cutaway:true,explode:0,selectedPart:null},lessonId:null};}
export function setMechanical(session,{angle=session.angle,playing=session.playing,selectedCylinder=session.selectedCylinder}){
  if(!Number.isFinite(angle)||typeof playing!=='boolean'||!Number.isInteger(selectedCylinder)||selectedCylinder<1||selectedCylinder>4) throw new TypeError('非法发动机输入');
  return {...session,angle:angle>=0&&angle<=720?angle:normalizeAngle(angle),playing,selectedCylinder,lessonId:null};
}
export function setObservation(session,patch){return {...session,view:{...session.view,...patch}};}
