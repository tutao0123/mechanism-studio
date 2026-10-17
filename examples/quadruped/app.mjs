import * as THREE from 'three';
import { createMechanismViewer } from '../../shared/viewer/viewer.mjs';
import { createLessonPlayer } from '../../shared/voice/player.mjs';
import { SPEC, LEGS, robotState, motionPoses, createSession, setMechanical, setObservation, bodyToGLTF, footTrajectory } from './model.mjs';

const $ = id => document.getElementById(id), viewport = $('viewport');
const LEG_NAMES = { fl: 'Front left', fr: 'Front right', rl: 'Rear left', rr: 'Rear right' };
const PART_TEXT = {
  body: ['Frame and crossmembers', 'Supports the body and four hip brackets. The body is fixed; no floating-base dynamics are simulated.'],
  cover: ['Vented cover', 'Hide the cover to inspect the battery and control board.'],
  battery: ['Illustrative battery', 'Shows the power-module location. Circuit behavior, charge and mass are not calculated.'],
  controller: ['Control board and connectors', 'Shows the controller layout. This page sends no hardware commands.'],
};
function partText(id) {
  if (PART_TEXT[id]) return PART_TEXT[id];
  const [type, legId] = id.split('-'), leg = LEG_NAMES[legId] || legId;
  const text = {
    hip: [leg + ' hip bracket', 'Fixes the abduction direction; hip pitch is driven by the upper leg.'],
    thigh: [leg + ' upper leg and knee motor', 'The joint-center spacing is 100 mm. Hip angle comes from inverse kinematics.'],
    shin: [leg + ' lower leg', 'The knee-to-foot-center distance is 115 mm. Its orientation combines hip and knee angles.'],
    foot: [leg + ' spherical foot pad', 'Its center comes from forward kinematics. Radius is 10 mm; pad compression and contact forces are not simulated.'],
  };
  return text[type] || [id, 'A teaching-model component with a stable part identity.'];
}
const GUIDE = {
  overview: ['01 · Eight joints', 'Each leg has hip pitch and knee pitch. Fixed abduction brackets prevent lateral stepping. Orbit the model to inspect the frame, battery, control board, motors and foot pads. These illustrative dimensions do not represent a production robot.'],
  'single-leg': ['02 · Lift one leg', 'Lift only the front-left leg. Hip and knee angles change together to raise the foot center by 40 mm and move it slightly forward. The upper and lower links remain 100 and 115 mm long. The body stays fixed; balance is not solved.'],
  inverse: ['03 · From a target to joint angles', 'A two-link inverse-kinematics calculation solves the hip and knee angles from a foot target. Forward kinematics then reconstructs that position. The residual comes from the same model. Unreachable targets and illustrative joint-limit violations are rejected.'],
  diagonal: ['04 · Diagonal leg pairs', 'Front left and rear right form one pair; front right and rear left form the other, half a cycle apart. Play the gait to inspect frequency and height. This is a geometric gait with a fixed body, not a dynamically validated running controller.'],
  limits: ['05 · Limits and foot paths', 'At a 60 mm step height, compare the two swing groups. Hip limits are −90° to 65° and knee limits are 15° to 135°. Every pose is checked against those limits. Reachability does not prove balance, available torque or collision-free motion.'],
  disassembly: ['06 · Explode and reassemble', 'Inspect the fixed hip brackets, upper legs, lower legs and feet separately. The display explosion keeps joint angles, link lengths and foot readouts at the same working pose. Reassemble to restore the view. Real hardware would also need contact, collision, actuator and balance validation.'],
};
function audioStatus(state) {
  if (state.phase === 'error' || state.status === 'error') return 'Original Chinese audio · unavailable';
  return { loading: 'Original Chinese audio · checking lesson', ready: 'Original Chinese audio · ready', unavailable: 'Original Chinese audio · not available' }[state.status] || 'Original Chinese audio';
}

let session = createSession(), ready = false, selectedId = 'body', currentLesson = null, lessons = [], dirty = true, lastTime = 0;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#ffffff');
scene.add(new THREE.AmbientLight('#ffffff', 2.25));
for (const [position, intensity] of [[[1,2,3],2], [[-2,1,-1],.8]]) {
  const light = new THREE.DirectionalLight('#ffffff', intensity); light.position.set(...position); scene.add(light);
}
const fill = new THREE.MeshStandardMaterial({ color: '#f3f3ef', roughness: .85, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const selectedFill = fill.clone(); selectedFill.color.set('#deded8');
const CAMERAS = {
  overview: { position: [.6,.47,.64], target: [0,.12,0], scale: .235 },
  side: { position: [0,.14,.9], target: [0,.13,0], scale: .235 },
  front: { position: [.9,.15,0], target: [0,.13,0], scale: .235 },
  feet: { position: [.32,.13,-.41], target: [.10,.075,-.09], scale: .135 },
};
const viewer = createMechanismViewer({
  viewport, assetUrl: 'assets/quadruped.glb', contractUrl: 'assets/scene-contract.json', scene,
  cameraPresets: CAMERAS, cameraHalfHeight: .235, target: [0,.12,0], autoRender: false,
  lineStyle: { enabled: true, color: '#1e1e1b', detailColor: '#91918b' },
  configureMesh(mesh) { mesh.material = fill; },
  onPick(id) { if (id) selectPart(id); },
  onControlsChange() { dirty = true; }, onResize() { dirty = true; }, onVisibilityChange() { dirty = true; },
  validateContract(contract) { if (contract.mechanismId !== SPEC.mechanismId || contract.assetRevision !== '1') throw new Error('Robot asset version mismatch'); },
});
const paths = new THREE.Group(); scene.add(paths);
const floor = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-.24,0,-.16],[.24,0,-.16],[.24,0,.16],[-.24,0,.16]].map(p => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color: '#d5d5d0' })); scene.add(floor);
function updatePaths() {
  while (paths.children.length) { const line = paths.children[0]; paths.remove(line); line.geometry.dispose(); line.material.dispose(); }
  for (const leg of LEGS) {
    const points = Array.from({ length: 65 }, (_, index) => { const path = footTrajectory(index / 64, session.stepHeight); return new THREE.Vector3(...bodyToGLTF([leg.x + path.x, leg.y, path.z])); });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: '#b0b0a9', dashSize: .003, gapSize: .002 })); line.computeLineDistances(); paths.add(line);
  }
  paths.visible = $('trajectory').checked && session.view.explode === 0;
}
const voice = createLessonPlayer({
  lessonURL: 'voice/lesson.json', manifestURL: 'voice/audio-manifest.json', baseURL: new URL('./', location.href),
  onStatus(state) { $('audio-status').textContent = audioStatus(state); },
  onPlayback(state) { $('audio-toggle').textContent = state.phase === 'loading' ? 'Checking Chinese audio…' : state.playing ? 'Pause Chinese audio' : state.paused ? 'Resume Chinese audio' : 'Play Chinese audio'; },
});
function stopLesson() {
  voice.stop(); currentLesson = null; $('audio-toggle').disabled = true;
  document.querySelectorAll('[data-lesson]').forEach(button => button.classList.remove('active'));
  $('narration').textContent = 'Explore manually, or select a guided step to pause at its mechanical state. Optional audio remains the original Chinese recording.';
}
function selectPart(id) {
  const binding = viewer.parts.get(id); if (!binding) return;
  selectedId = id;
  for (const mesh of viewer.meshes) mesh.material = mesh.userData.selectionId === id ? selectedFill : fill;
  const [title, description] = partText(id); $('part-title').textContent = title; $('part-description').textContent = description; dirty = true;
}
function applyModel() {
  const state = robotState(session);
  if (ready) viewer.applyPoses(motionPoses(state), { target: 'node' });
  return state;
}
function sync() {
  const state = applyModel(), leg = state.legs[0];
  $('mode-title').textContent = { stand: 'Standing', single: 'Front-left lift', trot: 'Diagonal gait' }[session.mode];
  $('foot-height').textContent = leg.footPosition[2].toFixed(1);
  $('hip-angle').textContent = leg.hip.toFixed(2) + '°'; $('knee-angle').textContent = leg.knee.toFixed(2) + '°';
  $('foot-position').textContent = leg.footPosition[0].toFixed(1) + ' / ' + leg.footPosition[2].toFixed(1) + ' mm';
  $('residual').textContent = state.maxResidual < 1e-6 ? '< 0.000001 mm' : state.maxResidual.toFixed(6) + ' mm';
  $('joint-check').textContent = state.legs.every(item => item.withinLimits) ? '8 / 8 within limits' : 'Outside limits';
  $('contact').textContent = state.contactLegs.map(id => LEG_NAMES[id]).join(', ') || 'None';
  $('mode').value = session.mode; $('speed').value = session.speed; $('height').value = session.stepHeight; $('lift').value = session.singleLift;
  $('speed-value').textContent = session.speed.toFixed(1) + ' Hz'; $('height-value').textContent = session.stepHeight + ' mm'; $('lift-value').textContent = session.singleLift + ' mm';
  $('phase').value = Math.round(session.phase * 1000); $('phase-value').textContent = Math.round(session.phase * 100) + '%';
  const exploded = session.view.explode > 0;
  for (const id of ['mode','play','speed','height','lift','phase']) $(id).disabled = exploded;
  $('play').textContent = session.playing ? 'Pause gait' : 'Play gait';
  $('explode').value = session.view.explode * 100; $('explode-value').textContent = Math.round(session.view.explode * 100) + '%';
  $('cutaway').checked = session.view.cutaway;
  $('operation-note').textContent = exploded ? 'Explosion pauses the gait. Mechanical readouts retain the working pose; reassemble to continue.' : 'Observation is separate from mechanics. Explosion changes neither joint angles nor foot readouts.';
  for (const item of state.legs) {
    const card = document.querySelector(`[data-leg="${item.id}"]`); card.classList.toggle('swing', item.swing);
    card.innerHTML = `<b>${LEG_NAMES[item.id]} · ${item.swing ? 'swing' : 'contact cue'}</b><span>Hip ${item.hip.toFixed(1)}° / Knee ${item.knee.toFixed(1)}°</span><span>Foot-center Z ${item.footPosition[2].toFixed(1)} mm</span>`;
  }
  dirty = true;
}
function mechanical(patch) {
  stopLesson(); session = setMechanical(session, patch); sync(); updatePaths();
}
function camera(id, fit = false) {
  session = setObservation(session, { camera: id });
  if (id !== 'free') viewer.setCamera(id, { fit });
  document.querySelectorAll('[data-camera]').forEach(button => button.classList.toggle('active', button.dataset.camera === id));
  $('view-caption').textContent = id === 'free' ? 'Free orbit: drag to inspect; the mechanical state is unchanged.' : 'Drag to orbit · Scroll to zoom · Click a part'; dirty = true;
}
function observation(patch) {
  voice.stop(); if (patch.explode > 0) session = { ...session, playing: false };
  session = setObservation(session, patch);
  if (ready) { viewer.setExplode(session.view.explode); viewer.setCutaway(session.view.cutaway); if (patch.explode !== undefined) { if (session.view.camera !== 'free') viewer.setCamera(session.view.camera); viewer.fitVisibleAssembly(); } }
  paths.visible = $('trajectory').checked && session.view.explode === 0; floor.visible = session.view.explode === 0;
  sync();
}
for (const button of document.querySelectorAll('[data-camera]')) button.addEventListener('click', () => camera(button.dataset.camera, session.view.explode > 0));
$('mode').addEventListener('change', () => mechanical({ mode: $('mode').value, playing: false }));
$('play').addEventListener('click', () => mechanical({ mode: 'trot', playing: !session.playing }));
$('reset').addEventListener('click', () => { observation({ explode: 0 }); mechanical({ mode: 'stand', phase: 0, playing: false }); });
$('speed').addEventListener('input', () => mechanical({ speed: +$('speed').value }));
$('height').addEventListener('input', () => mechanical({ stepHeight: +$('height').value }));
$('lift').addEventListener('input', () => mechanical({ mode: 'single', singleLift: +$('lift').value, playing: false }));
$('phase').addEventListener('input', () => mechanical({ mode: 'trot', phase: +$('phase').value / 1000, playing: false }));
$('explode').addEventListener('input', () => observation({ explode: +$('explode').value / 100 }));
$('assemble').addEventListener('click', () => observation({ explode: 0 }));
$('cutaway').addEventListener('change', () => observation({ cutaway: $('cutaway').checked }));
$('trajectory').addEventListener('change', () => { updatePaths(); dirty = true; });
$('audio-toggle').addEventListener('click', () => { if (currentLesson) voice.toggleStep(currentLesson); });
async function selectLesson(step) {
  voice.stop(); currentLesson = step.id;
  session = setMechanical(session, { mode: step.mode, phase: step.phase, playing: false, singleLift: step.singleLift ?? 40, stepHeight: step.stepHeight ?? 40 });
  observation({ explode: 0 }); camera(step.camera); observation({ explode: step.explode ?? 0 }); selectPart(step.partId); sync(); updatePaths();
  document.querySelectorAll('[data-lesson]').forEach(button => button.classList.toggle('active', button.dataset.lesson === step.id));
  $('narration').textContent = GUIDE[step.id]?.[1] || 'This step retains the original Chinese audio. Select another step for an English guide.'; $('audio-toggle').disabled = !voice.snapshot().manifest;
}
try {
  await viewer.ready; ready = true; $('loading').hidden = true;
  applyModel(); viewer.setCutaway(session.view.cutaway); camera('overview'); selectPart('body');
} catch { $('loading').textContent = 'The 3D asset could not load. Kinematic readouts and the text guide remain available.'; }
try {
  const result = await voice.load(); lessons = result.lesson.steps;
  for (const step of lessons) { const button = document.createElement('button'); button.dataset.lesson = step.id; button.textContent = GUIDE[step.id]?.[0] || step.id; button.addEventListener('click', () => selectLesson(step)); $('lesson-buttons').append(button); }
} catch { $('audio-status').textContent = 'Original Chinese lesson could not be loaded'; }
sync(); updatePaths();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
reduced.addEventListener('change', event => { if (event.matches) { session = { ...session, playing: false }; voice.stop(); sync(); } });
document.addEventListener('visibilitychange', () => { lastTime = 0; if (document.hidden) voice.stop(); else dirty = true; });
window.addEventListener('scroll', () => { dirty = true; }, { passive: true });
function frame(time) {
  requestAnimationFrame(frame); if (document.hidden) { lastTime = 0; return; }
  const dt = lastTime ? Math.min((time - lastTime) / 1000, .06) : 0; lastTime = time;
  if (session.playing && session.view.explode === 0) { session = setMechanical(session, { phase: (session.phase + dt * session.speed) % 1 }); sync(); }
  if (dirty) { viewer.draw(); dirty = false; }
}
requestAnimationFrame(frame);
window.quadrupedExample = { snapshot: () => ({ ready, mechanical: { mode: session.mode, phase: session.phase, stepHeight: session.stepHeight, singleLift: session.singleLift, speed: session.speed, playing: session.playing }, view: { ...session.view }, derived: robotState(session), selectedId, partCount: viewer.parts.size, meshCount: viewer.meshes.length, narration: { lessonId: currentLesson, provider: voice.snapshot().manifest?.provider ?? null, readySteps: voice.snapshot().readySteps, playing: voice.snapshot().playing }, mcpUsed: false }) };
