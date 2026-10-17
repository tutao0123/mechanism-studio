import * as THREE from 'three';
import {createMechanismViewer} from '../../shared/viewer/viewer.mjs';
import {createLessonPlayer} from '../../shared/voice/player.mjs';
import {SPEC,engineState,motionPoses,createSession,setMechanical,setObservation,bodyToGLTF} from './model.mjs';
import {processState} from './process.mjs';
import {createEngineProcessEffects} from './effects.mjs';

if(new URLSearchParams(location.search).get('embed')==='1')document.body.classList.add('embed');
const $=id=>document.getElementById(id),viewport=$('viewport');
const STROKE_TEXT={
  power:['Power','After idealized ignition, the piston travels from top to bottom dead center. Both valves remain closed.'],
  exhaust:['Exhaust','The piston rises and the exhaust valve opens. This model represents exhaust over the ideal full stroke.'],
  intake:['Intake','The piston descends and the intake valve opens. This model represents intake over the ideal full stroke.'],
  compression:['Compression','The piston rises with both valves closed. Compression is a process cue; pressure is not solved.'],
};
const PROCESS_LABEL={intake:'Intake inflow',compression:'Piston rising · mixture compression',power:'Expansion after ignition',exhaust:'Exhaust outflow'};
const PART_TEXT={
  block:['Block and main-bearing seats','Fixes the four cylinder positions and supports the crankshaft. The prebuilt front cutaway changes observation only.'],
  'block-front':['Front block wall','A teaching shell hidden when the cutaway is open.'],
  crankshaft:['Crankshaft','Four crank throws connect the reciprocating rods to one rotating output shaft.'],
  'oil-pan':['Oil pan','Shows the oil-storage and housing location. Lubrication flow is not simulated.'],
  'oil-pan-front':['Front oil-pan wall','A housing section hidden in the cutaway view.'],
  'cylinder-head':['Cylinder head and valve seats','Holds the valves and spark plugs. The teaching cutaway leaves the cylinder tops visible.'],
  'intake-camshaft':['Intake camshaft','Rotates at half crank speed. Cam profiles are sampled from the same ideal valve-lift model.'],
  'exhaust-camshaft':['Exhaust camshaft','Rotates at half crank speed. Cam profiles are sampled from the same ideal valve-lift model.'],
  flywheel:['Flywheel and output','Rotates with the crankshaft. Rotational inertia is not solved.'],
  'timing-drive':['Crank timing pulley','The crank and cam pulleys illustrate the 2:1 speed relationship.'],
  'timing-belt':['Timing belt and tensioner','Shows the transmission connection. Belt material and tooth engagement are not simulated.'],
  'cam-cover':['Cam cover','Hidden in the cutaway to reveal the cams and valves.'],
  'intake-manifold':['Intake manifold','Four branches identify the intake passages. Mass flow is not calculated.'],
  'exhaust-manifold':['Exhaust manifold','Four branches join the rear of the head. Gas flow is not solved.'],
};
function enginePartText(id){
  if(PART_TEXT[id])return PART_TEXT[id];
  const match=/^(.*)-(\d)$/.exec(id);if(!match)return[id,'A component of the teaching assembly.'];
  const [,kind,n]=match,prefix='Cylinder '+n+' · ';
  const roles={
    liner:['Liner','The half-cylinder is a prebuilt cutaway mesh; illustrative bore is 82 mm.'],
    piston:['Piston','The crank-and-rod model sets the wrist-pin center. Rings and skirt identify the assembly.'],
    rod:['Connecting rod','The illustrative center distance from crankpin to wrist pin remains 150 mm.'],
    'intake-valve':['Intake valve','Moves down to open under ideal stroke timing. Maximum illustrative lift is 9 mm, without overlap.'],
    'exhaust-valve':['Exhaust valve','Moves down to open under ideal stroke timing. Maximum illustrative lift is 9 mm, without overlap.'],
    'intake-spring':['Intake-valve spring','A positional illustration; elasticity and dynamic compression are not simulated.'],
    'exhaust-spring':['Exhaust-valve spring','A positional illustration; elasticity and dynamic compression are not simulated.'],
    'spark-plug':['Spark plug','Ignition is marked at ideal power-stroke TDC. No real ignition advance is used.'],
  };
  return roles[kind]?[prefix+roles[kind][0],roles[kind][1]]:[id,'A component of the teaching assembly.'];
}
const GUIDE={
  overview:['Overview · Four cylinders take turns','Four pistons connect to one crankshaft through their rods. A complete four-stroke cycle takes two crank revolutions, with firing order 1–3–4–2. Cylinders 1 and 4 move together; 2 and 3 move opposite them. Equal piston positions can belong to different strokes. Dimensions and valve timing are illustrative, without pressure or power calculation.'],
  intake:['Intake · Drawing the charge in','Pause halfway through cylinder 1 intake. The piston descends, the intake valve opens and the exhaust valve stays shut. The camshaft turns at half crank speed. Valve opening is limited to the ideal intake stroke, without real advance, delayed closing or overlap.'],
  compression:['Compression · Closed valves, rising piston','Both valves are closed as cylinder 1 rises. Wrist-pin height and travel from top dead center come from the same crank-and-rod calculation. The display describes compression without calculating pressure, temperature or compression ratio.'],
  power:['Power · Driving the crank','Idealized ignition occurs at power-stroke TDC. The piston then descends, the rod swings and the crankshaft turns. The crankpin follows a circle while the wrist pin follows the cylinder axis, maintaining a 150 mm rod center distance. This is geometric motion, not a combustion-force simulation.'],
  exhaust:['Exhaust · Pushing the gases out','Pause halfway through cylinder 1 exhaust. The piston rises, the exhaust valve opens and intake stays closed. Compare the other cylinders: a new power stroke starts every 180°. Display explosion changes the observation positions while readouts retain the working assembly state.'],
};
const audioStatus=info=>info.phase==='error'||info.status==='error'?'Original Chinese audio · unavailable':({loading:'Original Chinese audio · checking lesson',ready:'Original Chinese audio · ready',unavailable:'Original Chinese audio · not available'}[info.status]||'Original Chinese audio');

let session=createSession(),ready=false,dirty=true,lineArt,parts=new Map(),meshes=[],contract,lessons=[],manifest=null,visible=true,lastTime=0,updatingBridge=false;
const partRecords=new Map(),labels=[];
const scene=new THREE.Scene();scene.background=new THREE.Color('#ffffff');
const camera=new THREE.OrthographicCamera(-.42,.42,.36,-.36,.001,8);
const controlsTarget=new THREE.Vector3(0,.13,0);
let renderer,controls,viewer;
let processEnabled=true,processEffects=null,processSnapshot=processState(0);
scene.add(new THREE.AmbientLight('#ffffff',2.15));
for(const [pos,intensity] of [[[1,2,2],2.3],[[-1,.5,-1],1]]){const light=new THREE.DirectionalLight('#ffffff',intensity);light.position.set(...pos);scene.add(light);}
const fillMaterial=new THREE.MeshStandardMaterial({color:'#f5f5f2',roughness:.88,metalness:0,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
const selectedMaterial=fillMaterial.clone();selectedMaterial.color.set('#dddeda');
const CAMERAS={
  overview:{position:[.69,.55,.79],target:[0,.13,0],scale:.29,caption:'Inspect the spatial relationship between four crank-and-rod assemblies and their valves.'},
  end:{position:[-1.05,.16,.025],target:[0,.16,0],scale:.32,caption:'From the crank end, compare crank rotation and rod swing. Some cylinders overlap along the shaft.'},
  side:{position:[0,.145,1.1],target:[0,.145,0],scale:.34,caption:'Side cutaway: compare piston positions and strokes. Equal heights need not mean the same stroke.'},
  valves:{position:[.09,.42,.44],target:[0,.258,0],scale:.155,caption:'Valve detail: ideal profiles and half-speed cams, without contact or assembly-constraint solving.'}
};
try {
  viewer=createMechanismViewer({
    viewport,assetUrl:'assets/inline-four.glb',contractUrl:'assets/scene-contract.json',scene,camera,
    cameraHalfHeight:.37,target:[0,.13,0],minZoom:.45,maxZoom:4,pixelRatio:1.8,autoRender:false,
    rendererOptions:{alpha:false},lineStyle:{enabled:true,color:'#161616',detailColor:'#81817e'},
    explodeVector:record=>bodyToGLTF(record.explode),
    validateContract(value){if(value.mechanismId!=='teaching-inline-four'||value.assetRevision!=='1')throw new Error('Asset version mismatch');},
    configureMesh(mesh){mesh.material=fillMaterial;},onPick:id=>{if(id)choosePart(id);},
    onControlsChange:()=>{dirty=true;},afterDraw:()=>updateLabels(),
    onResize(v){dirty=true;if(ready&&(session.view.explode>0||session.view.camera==='overview'))v.fitVisibleAssembly();},
  });
  ({renderer,controls}=viewer);renderer.setClearColor('#ffffff');
}catch(error){$('loading').textContent='WebGL is unavailable on this device. Crank-angle controls and cylinder readouts remain available.';document.body.dataset.graphics='unavailable';}
function setCamera(id){
  session=setObservation(session,{camera:id});
  if(id!=='free'){
    const preset=CAMERAS[id],x=id==='valves'?SPEC.cylinderX[session.selectedCylinder-1]*.001:0;
    if(viewer)viewer.setCamera(preset,{offset:[x,0,0],zoom:1/(1+.9*session.view.explode)});
    else {camera.position.set(...preset.position);camera.lookAt(...preset.target);}
    $('view-caption').textContent=preset.caption;dirty=true;
  }else $('view-caption').textContent='Free orbit: drag to inspect. Crank angle and readouts retain the current mechanical state.';
  document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===id));if(ready){applyObservation();if(session.view.explode>0)viewer.fitVisibleAssembly();}dirty=true;
}
function postState(){if(window.parent!==window&&!updatingBridge)window.parent.postMessage({type:'engine-compare-state',variant:'mechanism-studio',angle:session.angle,playing:session.playing,selectedCylinder:session.selectedCylinder,exploded:session.view.explode>0},location.origin);}
const lessonPlayer=createLessonPlayer({
  lessonURL:'voice/lesson.json',manifestURL:'voice/audio-manifest.json',baseURL:new URL('./',location.href),
  onStatus:info=>{$('audio-status').textContent=audioStatus(info);},
  onPlayback:info=>{$('audio-toggle').textContent=info.phase==='loading'?'Checking Chinese audio…':info.playing?'Pause Chinese audio':info.paused?'Resume Chinese audio':'Play Chinese audio';},
});
function stopAudio(){lessonPlayer.stop();}
function mechanical(patch,{bridge=false}={}){
  stopAudio();session=setMechanical(session,patch);if(session.view.explode>0)session={...session,playing:false};
  document.querySelectorAll('[data-lesson]').forEach(b=>b.classList.remove('active'));
  $('narration').textContent='Explore manually, or select a guided step to pause at its corresponding state. Optional audio is the original Chinese recording.';
  $('audio-toggle').disabled=true;
  sync();dirty=true;if(!bridge)postState();
}
function sync(){
  const state=engineState(session.angle),c=state.cylinders[session.selectedCylinder-1];
  $('angle').value=String(session.angle);$('angle-value').textContent=`${session.angle.toFixed(0)}° / 720° · Cam ${state.camAngle.toFixed(0)}°`;
  $('play').textContent=session.playing?'Pause':'Play';$('play').setAttribute('aria-label',session.playing?'Pause the engine':'Play the engine');
  $('quick-play').textContent=session.playing?'Pause demo':'Play demo';$('quick-play').setAttribute('aria-pressed',String(session.playing));
  $('cylinder-heading').textContent=`Cylinder ${c.number} · ${STROKE_TEXT[c.stroke.id][0]}${c.ignition?' / ideal ignition instant':''}`;
  $('phase-angle').textContent=`Phase ${c.phase.toFixed(0)}°`;$('travel').textContent=c.travelFromTDC.toFixed(1);
  $('piston-height').textContent=`${c.pistonHeight.toFixed(1)} mm`;$('intake-lift').textContent=`${c.intakeLift.toFixed(1)} mm`;$('exhaust-lift').textContent=`${c.exhaustLift.toFixed(1)} mm`;
  $('cam-angle').textContent=`${state.camAngle.toFixed(1)}°`;
  $('stroke-explanation').textContent=STROKE_TEXT[c.stroke.id][1];$('displacement').textContent=state.displacementCC.toFixed(0);
  document.querySelectorAll('[data-cylinder]').forEach(b=>{const ci=state.cylinders[+b.dataset.cylinder-1];b.classList.toggle('active',ci.number===session.selectedCylinder);b.querySelector('span').textContent=`${STROKE_TEXT[ci.stroke.id][0]} ${ci.phase.toFixed(0)}°`;});
  const exploded=session.view.explode>0;$('play').disabled=exploded;$('angle').disabled=exploded;$('speed').disabled=exploded;
  $('quick-play').disabled=exploded;
  $('operation-note').textContent=exploded?'Playback paused. Explosion moves only the display layer; readouts retain the working pose. Reassemble to continue.':'';
  $('cutaway').checked=session.view.cutaway;$('explode').value=String(session.view.explode*100);$('explode-value').textContent=`${(session.view.explode*100).toFixed(0)}%`;
  if(ready){applyPoses(state);applyObservation();}else updateProcess();return state;
}
function updateProcess(){
  processSnapshot=processState(session.angle,{enabled:processEnabled,cutaway:session.view.cutaway,explode:session.view.explode});
  processEffects?.update(processSnapshot);
  const current=processSnapshot.cylinders[session.selectedCylinder-1];
  $('process-caption').textContent=!processEnabled?'Process cues are off. Mechanical motion and readouts are unchanged.':session.view.explode>0?'Process cues are hidden during explosion and return at the same crank phase after reassembly.':!session.view.cutaway?'Open the cutaway to inspect intake, injection, compression and combustion.':`Cylinder ${current.number} · ${PROCESS_LABEL[current.stage]}${current.spark.active?' · TDC flash window':''}. Pause or scrub the crank angle to inspect this process.`;
  $('chamber-height').textContent=current.heightMM.toFixed(1)+' mm';
}
function applyPoses(state){viewer.applyPoses(motionPoses(state),{target:'node'});}
function applyObservation(){
  viewer.setExplode(session.view.explode);
  viewer.setCutaway(session.view.cutaway);
  meshes.forEach(m=>{m.material=m.userData.selectionId===session.view.selectedPart?selectedMaterial:fillMaterial;m.visible=!(session.view.cutaway&&session.view.camera==='end'&&m.userData.endCutaway===true);});
  updateProcess();
}
function choosePart(id){
  const rec=partRecords.get(id);if(!rec)return;
  session=setObservation(session,{selectedPart:id});const [title,description]=enginePartText(id);$('part-title').textContent=title;$('part-description').textContent=description;
  const match=id.match(/-(\d)$/);if(match)session={...session,selectedCylinder:+match[1]};
  if(session.view.camera==='valves')setCamera('valves');sync();dirty=true;postState();
}
function observe(patch){
  stopAudio();if(patch.explode>0)session={...session,playing:false};session=setObservation(session,patch);
  if(patch.explode!==undefined&&session.view.explode===0&&session.view.camera!=='free')setCamera(session.view.camera);
  sync();if(ready&&session.view.explode>0)viewer.fitVisibleAssembly();dirty=true;postState();
}
document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>setCamera(b.dataset.camera)));
document.querySelectorAll('[data-cylinder]').forEach(b=>b.addEventListener('click',()=>{mechanical({selectedCylinder:+b.dataset.cylinder});if(session.view.camera==='valves')setCamera('valves');}));
$('angle').addEventListener('input',()=>mechanical({angle:+$('angle').value,playing:false}));
$('play').addEventListener('click',()=>mechanical({playing:!session.playing}));
$('quick-play').addEventListener('click',()=>mechanical({playing:!session.playing}));
$('reset').addEventListener('click',()=>{observe({explode:0});mechanical({angle:0,playing:false,selectedCylinder:1});});
$('cutaway').addEventListener('change',()=>observe({cutaway:$('cutaway').checked}));
$('explode').addEventListener('input',()=>observe({explode:+$('explode').value/100}));
$('assemble').addEventListener('click',()=>observe({explode:0}));
$('process-toggle').addEventListener('change',()=>{processEnabled=$('process-toggle').checked;updateProcess();dirty=true;});
window.addEventListener('message',event=>{
  if(window.parent===window||event.source!==window.parent||event.origin!==location.origin)return;
  const data=event.data;if(!data||data.type!=='engine-compare-control'||!Number.isFinite(data.angle)||typeof data.playing!=='boolean')return;
  if(data.selectedCylinder!==undefined&&(!Number.isInteger(data.selectedCylinder)||data.selectedCylinder<1||data.selectedCylinder>4))return;
  updatingBridge=true;try{mechanical({angle:data.angle,playing:data.playing,selectedCylinder:data.selectedCylinder??session.selectedCylinder},{bridge:true});}finally{updatingBridge=false;}postState();
});
function selectedLesson(){return lessons.find(s=>s.id===session.lessonId);}
function selectLesson(step){
  stopAudio();session=setMechanical(session,{angle:step.angle,playing:false,selectedCylinder:step.cylinder});session={...session,lessonId:step.id};session=setObservation(session,{explode:0,cutaway:true});
  setCamera(step.camera);choosePart(step.partId);session={...session,lessonId:step.id};
  document.querySelectorAll('[data-lesson]').forEach(b=>b.classList.toggle('active',b.dataset.lesson===step.id));$('narration').textContent=GUIDE[step.id]?.[1]||'Optional audio is the original Chinese recording.';$('audio-toggle').disabled=!manifest?.steps?.[step.id]?.src;sync();postState();
}
$('audio-toggle').addEventListener('click',async()=>{
  const step=selectedLesson();if(!manifest?.steps?.[step?.id]?.src)return;
  try{await lessonPlayer.toggleStep(step.id);}catch{$('audio-status').textContent='Original Chinese audio is not ready for this step';}
});
async function loadLessons(){
  try{
    const result=await lessonPlayer.load();lessons=result.lesson.steps;manifest=result.manifest;
    for(const step of lessons){const button=document.createElement('button');button.dataset.lesson=step.id;button.textContent=GUIDE[step.id]?.[0]||step.id;button.addEventListener('click',()=>selectLesson(step));$('lesson-buttons').append(button);}
  }catch{$('narration').textContent='The lesson could not load. Core mechanical controls remain available.';}
}
async function loadEngine(){
  try{
    if(!viewer)return;
    await viewer.ready;contract=viewer.contract;contract.parts.forEach(p=>partRecords.set(p.part_id,p));
    parts=viewer.parts;meshes=viewer.meshes;lineArt=viewer.lineArt;
    processEffects=createEngineProcessEffects(THREE);scene.add(processEffects.group);
    ready=true;document.body.dataset.graphics='ready';$('loading').hidden=true;
    for(let i=0;i<4;i++){const label=document.createElement('span');label.className='cyl-label';label.textContent=`Cyl ${i+1}`;$('cylinder-labels').append(label);labels.push(label);}
    sync();choosePart('crankshaft');dirty=true;postState();
  }catch(error){$('loading').hidden=false;$('loading').textContent='The 3D asset could not load. Mechanical model readouts remain available.';document.body.dataset.graphics='error';}
}
function updateLabels(){if(!ready||!renderer)return;for(let i=0;i<4;i++){const p=new THREE.Vector3(...bodyToGLTF([SPEC.cylinderX[i],-44,228]));p.project(camera);const label=labels[i];label.style.left=`${(p.x*.5+.5)*viewport.clientWidth}px`;label.style.top=`${(-p.y*.5+.5)*viewport.clientHeight}px`;label.hidden=session.view.camera==='valves'||session.view.explode>0||Math.abs(p.x)>1||Math.abs(p.y)>1;}}
document.addEventListener('visibilitychange',()=>{lastTime=0;visible=!document.hidden;dirty=true;});
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
reducedMotion.addEventListener('change',event=>{if(event.matches&&session.playing){session={...session,playing:false};stopAudio();sync();postState();}dirty=true;});
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting&&!document.hidden;lastTime=0;dirty=true;}).observe(viewport);
function frame(time){requestAnimationFrame(frame);if(!visible){lastTime=0;return;}const dt=lastTime?Math.min((time-lastTime)/1000,.08):0;lastTime=time;if(session.playing&&session.view.explode===0){session={...session,angle:(session.angle+dt*+$('speed').value)%720,lessonId:null};sync();dirty=true;}if(renderer&&dirty){viewer.draw();dirty=false;}}
// A read-only audit snapshot; tests may inspect it without mutating the model.
window.engineExample={snapshot:()=>({variant:'mechanism-studio',ready,mechanical:{angle:session.angle,playing:session.playing,selectedCylinder:session.selectedCylinder},view:{...session.view},derived:engineState(session.angle),process:structuredClone(processSnapshot),narration:{lessonId:session.lessonId,provider:manifest?.provider??null,readySteps:Object.keys(manifest?.steps??{}).length,playing:lessonPlayer.snapshot().playing,duration:lessonPlayer.snapshot().duration},partCount:parts.size,meshCount:meshes.length,mcpUsed:false})};
setCamera('overview');sync();loadLessons();loadEngine();requestAnimationFrame(frame);
