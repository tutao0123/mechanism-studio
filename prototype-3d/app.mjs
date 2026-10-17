import * as THREE from 'three';
import { createMechanismViewer } from '../shared/viewer/viewer.mjs';
import { createLessonPlayer } from '../shared/voice/player.mjs';
import { SPEC } from '../model.mjs';
import { createState, getSnapshot, transition } from './controller.mjs';
import { PALETTES, getPalette } from './palettes.mjs';

const $ = (id) => document.getElementById(id);
const GUIDE = {
  part: ['Meet the parts', 'Each of the five pin pairs contains a key pin, a driver pin and a spring. The key supports the key pin while the spring presses the driver down. Watch whether their joint reaches the boundary between the plug and shell. Optional audio is the original Chinese recording.'],
  wrong: ['Why the wrong key blocks', 'With the wrong key inserted, the joints of pairs 2 and 4 remain below the shear line. Their driver pins bridge the plug and shell, preventing rotation.'],
  align: ['Align with the shear line', 'The correct key profile raises all five joints to the shear line together. Partial alignment is not enough: the key must also be fully inserted before the plug can turn.'],
  turn: ['Turn the plug', 'From the axial view, watch the key and key pins rotate with the plug while the drivers and springs remain in the shell. The tail cam turns with the shaft to illustrate the output of the mechanism.'],
  reset: ['Withdraw and reset', 'Return the plug to its original angle, then withdraw the key. As the profile moves away, the springs press the pins back and block the plug again. Pause, switch cutaway views or explode the parts to review their contact relationships.'],
};
const audioStatus = info => info.phase === 'error' || info.status === 'error' ? 'Original Chinese audio · unavailable' : ({ loading: 'Original Chinese audio · checking lesson', ready: 'Original Chinese audio · ready', unavailable: 'Original Chinese audio · not available' }[info.status] || 'Original Chinese audio');

let state = createState();
let lessons = [];
let audioManifest = null;
let ready = false;
let applyScene = () => {};
let changeCamera = () => {};
let selectedMeshes = [];
let applyPaletteToScene = () => {};
const paletteStorageKey = 'mechanism-studio:palette';
let palette = getPalette(new URL(location.href).searchParams.get('palette') || readSavedPalette());
const paletteFamilies = [
  { id: 'line', name: 'Line art' },
  { id: 'vscode', name: 'VS Code' },
  { id: 'github', name: 'GitHub' },
  { id: 'cad', name: 'CAD' },
  { id: 'studio', name: 'Studio' },
];

function showPaletteFamily(id) {
  const options = $('palette-options');
  options.dataset.family = id;
  options.style.setProperty('--palette-columns', PALETTES.filter(option => (option.family || 'studio') === id).length);
  options.querySelectorAll('button').forEach(button => { button.hidden = button.dataset.family !== id; });
  $('palette-families').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.family === id)));
}

function readSavedPalette() {
  try { return localStorage.getItem(paletteStorageKey); } catch { return null; }
}
function setPalette(id, remember = false) {
  palette = getPalette(id);
  const root = document.documentElement;
  root.dataset.palette = palette.id;
  root.dataset.renderStyle = palette.renderStyle || 'material';
  root.style.colorScheme = palette.scheme;
  for (const [key, value] of Object.entries(palette.ui)) root.style.setProperty(`--${key}`, value);
  for (const role of ['lower', 'driver', 'spring', 'key']) root.style.setProperty(`--role-${role}`, palette.materials[role].color);
  root.style.setProperty('--blocked-pin', palette.lighting.blockedColor);
  $('palette-options').querySelectorAll('[data-palette]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.palette === palette.id)));
  $('palette-current').textContent = palette.name;
  showPaletteFamily(palette.family || 'studio');
  if (remember) {
    try { localStorage.setItem(paletteStorageKey, palette.id); } catch { /* Private mode may disallow storage. */ }
    const url = new URL(location.href); url.searchParams.set('palette', palette.id);
    history.replaceState(null, '', url);
  }
  // Appearance is independent of lesson, audio, mechanism and orbit controls.
  applyPaletteToScene();
}
for (const family of paletteFamilies) {
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.family = family.id;
  button.setAttribute('aria-label', family.name);
  const count = PALETTES.filter(option => (option.family || 'studio') === family.id).length;
  button.textContent = `${family.name} · ${count}`;
  button.addEventListener('click', () => showPaletteFamily(family.id));
  $('palette-families').append(button);
}
for (const option of PALETTES) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'palette-option'; button.dataset.palette = option.id;
  button.dataset.family = option.family || 'studio';
  button.setAttribute('aria-label', option.name);
  const swatches = document.createElement('span'); swatches.className = 'palette-swatches'; swatches.setAttribute('aria-hidden', 'true');
  swatches.style.background = option.ui.stage;
  for (const color of [option.materials.shell.color, option.materials.driver.color, option.materials.key.color]) {
    const dot = document.createElement('i'); dot.style.background = color;
    if (option.renderStyle === 'line') dot.style.borderColor = option.line.color;
    swatches.append(dot);
  }
  const text = document.createElement('span'); text.className = 'palette-option-text';
  const title = document.createElement('strong'); title.textContent = option.name;
  const description = document.createElement('small'); description.textContent = option.description;
  text.append(title, description); button.append(swatches, text);
  button.addEventListener('click', () => setPalette(option.id, true));
  $('palette-options').append(button);
}
setPalette(palette.id);
const names = { overview: 'Overview', section: 'Longitudinal · Inspect the shear line', end: 'Axial · What rotates?', detail: 'Pin detail · Contact and alignment', rear: 'Rear · Plug and tail cam' };
const statusNames = { empty: 'Key out', inserting: 'Inserting', blocked: 'Blocked', ready: 'Ready to turn', open: 'Turned' };
const indicators = SPEC.pinXs.map((_, i) => {
  const el = document.createElement('span');
  el.title = `Pin pair ${i + 1}`;
  $('pin-indicators').append(el);
  return el;
});
const tags = SPEC.pinXs.map((_, i) => {
  const el = document.createElement('span'); el.className = 'pin-tag'; el.textContent = i + 1;
  $('pin-tags').append(el); return el;
});

const lessonPlayer = createLessonPlayer({
  lessonURL: './voice/lesson.json', manifestURL: './voice/audio-manifest.json', baseURL: new URL('./', location.href),
  audioElement: $('voice'),
  onStatus(info) { $('voice-status').textContent = audioStatus(info); },
  onPlayback(info) {
    $('narrate').textContent = info.phase === 'loading' ? 'Checking Chinese audio…' : info.playing ? 'Ⅱ Pause Chinese audio' : info.paused ? '▶ Resume Chinese audio' : '▶ Play Chinese audio';
  },
});
function stopVoice() { lessonPlayer.stop(); }
function dispatch(action) {
  if (action.type !== 'view') stopVoice();
  state = transition(state, action);
  if (action.type === 'lesson' || action.type === 'reset' || (action.type === 'view' && 'camera' in action)) changeCamera(state.view.camera);
  syncUI(); applyScene();
}
function describePart(id) {
  if (!id) return ['Select a part to inspect its role', 'Key pins follow the key profile; driver pins and springs remain in the shell. The legend follows the current palette. Open the cutaway to inspect contact and alignment.'];
  const n = id.match(/\d+$/)?.[0];
  if (id.startsWith('lower-')) return [`Pair ${n} · Key pin`, 'Contacts the key profile and rises during insertion. With the correct key fully inserted, its top reaches the shear line and rotates with the plug.'];
  if (id.startsWith('driver-')) return [`Pair ${n} · Driver pin`, 'The spring presses it against the key pin. If their joint misses the shear line, one pin bridges the plug and shell and blocks rotation.'];
  if (id.startsWith('spring-')) return [`Pair ${n} · Spring`, 'Pushes the pins down inside the shell. Compression length is displayed, but spring force and friction are not calculated.'];
  if (id.startsWith('key-')) return ['Key · A profile that sets pin heights', 'Different cuts raise the key pins to different heights. Rotation is allowed only when the key is fully inserted and all five pairs align.'];
  if (id.startsWith('plug-')) return ['Plug · The rotating inner cylinder', 'Contains the key and key pins. Once all pin joints align, it can turn inside the stationary shell. The cutaway is a display opening for inspection.'];
  if (id.startsWith('shell-')) return ['Shell · The stationary housing', 'Holds the driver pins and springs. It stays fixed as the plug turns; their interface is the shear surface.'];
  if (id === 'cam') return ['Tail cam · Passing the rotation onward', 'Turns coaxially with the plug. A real door lock uses additional mechanisms to drive its bolt; this prototype displays the cam only.'];
  return ['Display base', 'Supports the teaching model and does not participate in the unlocking condition.'];
}
function syncUI() {
  const snap = getSnapshot(state);
  const blocked = Boolean(snap.uiBlockReason) || !ready;
  $('insertion').value = snap.insertion * 100;
  $('insertion-value').textContent = `${Math.round(snap.insertion * 100)}%`;
  $('angle').value = snap.angle; $('angle-value').textContent = `${Math.round(snap.angle)}°`;
  $('insertion').disabled = blocked; $('angle').disabled = blocked || !snap.canTurn;
  $('insert-key').disabled = blocked; $('insert-key').textContent = snap.insertion === 1 ? 'Remove key' : 'Insert fully';
  $('cutaway').checked = state.view.cutaway;
  $('explode').value = state.view.explode * 100; $('explode-value').textContent = `${Math.round(state.view.explode * 100)}%`;
  $('status').textContent = statusNames[snap.status]; $('status').className = `status ${snap.status}`;
  $('alignment').innerHTML = `${snap.alignedCount} <small>/ 5 pairs</small>`;
  indicators.forEach((el, i) => { el.className = snap.pins[i].aligned ? 'good' : snap.insertion === 1 ? 'blocked' : ''; el.title = `Pair ${i + 1}: ${snap.pins[i].aligned ? 'aligned' : 'not aligned'}; height error ${snap.pins[i].error} (illustrative units)`; });
  tags.forEach((el, i) => el.classList.toggle('good', snap.pins[i].aligned));
  $('view-label').textContent = names[state.view.camera] || 'Free orbit';
  let reason = 'The key is out. Pins cross the shear line and block the plug.';
  if (snap.status === 'inserting') reason = 'The key profile is lifting the pins. Insert fully, then inspect whether all five joints align.';
  if (snap.status === 'blocked') reason = `Pairs ${snap.blockingPins.map(i => i + 1).join(', ')} are not aligned. Pins still cross the shear surface and prevent rotation.`;
  if (snap.status === 'ready') reason = 'All five joints meet the shear line. Move the Turn plug slider and watch which parts rotate together.';
  if (snap.status === 'open') reason = 'The plug, key, key pins and tail cam rotate together. Driver pins and springs remain inside the stationary shell.';
  $('reason').textContent = snap.uiBlockReason ? 'Reassemble the parts before operating the key.' : reason;
  document.querySelectorAll('[data-key]').forEach(el => { el.classList.toggle('active', el.dataset.key === snap.keyId); el.disabled = blocked; el.setAttribute('aria-pressed', String(el.dataset.key === snap.keyId)); });
  document.querySelectorAll('[data-camera]').forEach(el => { el.classList.toggle('active', el.dataset.camera === state.view.camera); el.setAttribute('aria-pressed', String(el.dataset.camera === state.view.camera)); });
  document.querySelectorAll('[data-lesson]').forEach(el => { el.classList.toggle('active', el.dataset.lesson === state.lesson); el.setAttribute('aria-current', el.dataset.lesson === state.lesson ? 'step' : 'false'); });
  const part = describePart(state.view.selected); $('part-name').textContent = part[0]; $('part-description').textContent = part[1];
  const lesson = lessons.find(l => l.id === state.lesson);
  $('lesson-title').textContent = GUIDE[lesson?.id]?.[0] || 'Explore freely';
  $('lesson-caption').textContent = GUIDE[lesson?.id]?.[1] || 'This is your own mechanical state. Try a key or camera view, or choose a guided step. Optional audio is the original Chinese recording.';
  $('lesson-number').textContent = lesson ? String(lessons.indexOf(lesson) + 1).padStart(2, '0') : '↗';
  $('narrate').disabled = !lesson || !audioManifest?.steps?.[lesson.id];
  document.body.dataset.ready = String(ready);
  document.body.dataset.status = snap.status;
}

$('insertion').addEventListener('input', e => dispatch({ type: 'insertion', value: Number(e.target.value) / 100 }));
$('angle').addEventListener('input', e => dispatch({ type: 'angle', value: Number(e.target.value) }));
$('cutaway').addEventListener('change', e => dispatch({ type: 'view', cutaway: e.target.checked }));
$('explode').addEventListener('input', e => dispatch({ type: 'view', explode: Number(e.target.value) / 100 }));
$('reset').addEventListener('click', () => dispatch({ type: 'reset' }));
$('insert-key').addEventListener('click', () => dispatch({ type: 'insertion', value: getSnapshot(state).insertion === 1 ? 0 : 1 }));
document.querySelectorAll('[data-key]').forEach(el => el.addEventListener('click', () => dispatch({ type: 'key', keyId: el.dataset.key })));
document.querySelectorAll('[data-camera]').forEach(el => el.addEventListener('click', () => dispatch({ type: 'view', camera: el.dataset.camera })));
document.querySelectorAll('[data-lesson]').forEach(el => el.addEventListener('click', () => dispatch({ type: 'lesson', id: el.dataset.lesson })));
$('narrate').addEventListener('click', async () => {
  if (!state.lesson || !audioManifest?.steps?.[state.lesson]) return;
  try { await lessonPlayer.toggleStep(state.lesson); }
  catch { $('voice-status').textContent = 'Original Chinese audio is not ready for this step'; }
});
const voiceReady = (async () => {
  try {
    const result = await lessonPlayer.load();
    lessons = result.lesson.steps; audioManifest = result.manifest;
    $('narrate').title = audioManifest ? 'Play the original local Chinese Doubao recording' : 'Original Chinese audio has not been generated locally';
  } catch { $('voice-status').textContent = 'Original Chinese audio · waiting for local recordings'; }
  syncUI();
})();

async function initScene() {
  const viewport = $('viewport');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-.2, .2, .14, -.14, .001, 3);
  const machine = new THREE.Group(); scene.add(machine);
  const rotor = new THREE.Group(); rotor.position.set(0, SPEC.plugAxisZ / 1000, 0); machine.add(rotor);
  const viewer = createMechanismViewer({
    viewport, assetUrl: './assets/lock.glb', scene, camera, cameraHalfHeight: .135,
    pixelRatio: 2, enableDamping: !reduced,
    parentForPart: id => id.startsWith('plug-') || id.startsWith('key-') || id.startsWith('lower-') || id === 'cam' ? rotor : machine,
    configureMesh(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.material = mesh.material.clone(); },
    onPick: id => dispatch({ type: 'view', selected: id }),
    afterDraw: () => updateLabels(),
    onResize(v) { if (state.view.explode > 0 || (state.view.camera === 'overview' && viewport.clientWidth < 500)) v.fitVisibleAssembly(); },
  });
  const { renderer, controls } = viewer;
  const requestDraw = viewer.requestDraw;
  renderer.setClearColor(0xe8efef, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x758e95, 3.3); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 4.2); sun.position.set(-.08, .4, .3);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -.5, right: .5, top: .5, bottom: -.5, near: .01, far: 1.2 });
  sun.shadow.bias = -.00008; sun.shadow.normalBias = .0002; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe0efff, 2); fill.position.set(.35, .12, -.2); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShadowMaterial({ color: 0x3b646a, opacity: .11 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.007; ground.receiveShadow = true; scene.add(ground);
  await viewer.ready;
  const parts = viewer.parts;
  selectedMeshes = viewer.meshes;
  if (parts.size < 20) throw new Error('GLB is missing stable part IDs');
  for (const mesh of selectedMeshes) {
    mesh.userData.studioMaterial = mesh.material;
    // Continuous spring tubes need silhouettes, rather than polygon facet lines.
    mesh.userData.lineArtSmooth = mesh.userData.selectionId.startsWith('spring-');
    // Line drawings and CAD shaded-edge views share opaque diffuse surfaces.
    mesh.userData.lineSurface = new THREE.MeshLambertMaterial({
      color: '#ffffff', side: mesh.material.side,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      toneMapped: false,
    });
  }
  const lineArt = viewer.lineArt;
  const required = ['plug-back', 'plug-front', 'shell-back', 'shell-front', 'cam', 'key-correct', 'key-wrong', 'key-blank'];
  for (let i = 1; i <= 5; i++) required.push(`lower-${i}`, `driver-${i}`, `spring-${i}`);
  for (const id of required) if (!parts.has(id)) throw new Error(`Missing part: ${id}`);
  // This line is a teaching marker; the mechanical model uses SPEC.shearZ.
  const shearGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.012, SPEC.shearZ / 1000, .009), new THREE.Vector3(.14, SPEC.shearZ / 1000, .009)]);
  const shearLine = new THREE.Line(shearGeo, new THREE.LineDashedMaterial({ color: 0x24856b, dashSize: .004, gapSize: .002, depthTest: false, transparent: true, opacity: .75 }));
  shearLine.computeLineDistances(); shearLine.renderOrder = 10; machine.add(shearLine);
  function paintMaterials(snap) {
    const isLine = palette.renderStyle === 'line';
    const isCAD = palette.renderStyle === 'cad';
    const hasEdges = isLine || isCAD;
    const partColors = {};
    for (const mesh of selectedMeshes) {
      const id = mesh.userData.selectionId;
      const role = id.split('-')[0];
      const material = palette.materials[role];
      mesh.material = hasEdges ? mesh.userData.lineSurface : mesh.userData.studioMaterial;
      mesh.material.color.set(material.color);
      if (!hasEdges) { mesh.material.metalness = material.metalness; mesh.material.roughness = material.roughness; }
      const index = /^(lower|driver)-(\d+)$/.exec(id);
      const blocked = index && snap.insertion === 1 && !snap.pins[Number(index[2]) - 1].aligned;
      if (blocked) {
        if (hasEdges) partColors[id] = palette.lighting.blockedColor;
        if (!isLine) mesh.material.color.set(palette.lighting.blockedColor);
      }
      if (hasEdges && id === state.view.selected) {
        partColors[id] ??= palette.lighting.selectionLineColor || palette.lighting.selectionColor;
        if (isLine) mesh.material.color.set(palette.scheme === 'dark' ? '#292929' : '#e5e5e5');
        else if (!blocked) mesh.material.color.lerp(new THREE.Color(palette.lighting.selectionColor), palette.lighting.selectionStrength ?? .35);
      }
      if (mesh.material.emissive) {
        mesh.material.emissive.set(!hasEdges && id === state.view.selected ? palette.lighting.selectionColor : '#000000');
        mesh.material.emissiveIntensity = .3;
      }
    }
    lineArt.setStyle({ enabled: hasEdges, color: palette.line?.color || '#111111', detailColor: palette.line?.detailColor, partColors });
  }
  applyPaletteToScene = () => {
    const isLine = palette.renderStyle === 'line';
    const hasEdges = isLine || palette.renderStyle === 'cad';
    ground.visible = !isLine;
    renderer.shadowMap.enabled = !isLine;
    renderer.toneMapping = hasEdges ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = palette.lighting.exposure;
    hemi.intensity = palette.lighting.hemisphereIntensity ?? 3.3;
    sun.intensity = palette.lighting.sunIntensity ?? 4.2;
    fill.intensity = palette.lighting.fillIntensity ?? 2;
    hemi.groundColor.set(palette.lighting.hemisphereGround); fill.color.set(palette.lighting.fill);
    ground.material.color.set(palette.lighting.shadowColor);
    ground.material.opacity = palette.lighting.shadowOpacity ?? (palette.scheme === 'dark' ? .25 : .11);
    shearLine.material.color.set(palette.lighting.shearColor);
    paintMaterials(getSnapshot(state)); requestDraw();
  };
  applyPaletteToScene();
  const presets = {
    overview: { position: [.38, .235, .36], target: [.15, .06, 0], zoom: 1.18 },
    section: { position: [.09, .075, .38], target: [.09, .068, 0], zoom: 1.38 },
    end: { position: [.46, .080, .02], target: [.085, .057, 0], zoom: 1.6 },
    detail: { position: [.075, .088, .24], target: [.072, .078, 0], zoom: 2.7 },
    rear: { position: [-.20, .135, .25], target: [.068, .044, 0], zoom: 1.4 },
  };
  let lastExplode = 0;
  let fitPending = false;
  const fitVisibleAssembly = viewer.fitVisibleAssembly;
  changeCamera = (name) => {
    viewer.setCamera(presets[name] || presets.overview);
    fitPending = true;
  };
  applyScene = () => {
    const snap = getSnapshot(state); const explode = state.view.explode;
    rotor.rotation.x = snap.angle * Math.PI / 180;
    shearLine.visible = state.view.cutaway && explode === 0 && snap.angle === 0;
    const explodeVectors = {};
    for (const { id, display, model } of parts.values()) {
      model.position.set(0, 0, 0); model.scale.set(1, 1, 1); display.position.set(0, 0, 0);
      display.visible = !(id.endsWith('-front') && state.view.cutaway);
      if (id.startsWith('key-')) {
        display.visible = id === `key-${snap.keyId}`;
        model.position.x = (1 - snap.insertion) * .160;
        explodeVectors[id] = [0, 0, .04];
      } else if (id.startsWith('lower-')) {
        const pin = snap.pins[Number(id.split('-')[1]) - 1];
        model.position.y = pin.tipZ / 1000; explodeVectors[id] = [0, 0, .035];
      } else if (id.startsWith('driver-')) {
        const pin = snap.pins[Number(id.split('-')[1]) - 1];
        model.position.y = pin.jointZ / 1000; explodeVectors[id] = [0, .037, 0];
      } else if (id.startsWith('spring-')) {
        const pin = snap.pins[Number(id.split('-')[1]) - 1];
        const bottom = (pin.jointZ + SPEC.driverLength) / 1000;
        model.position.y = bottom; model.scale.y = Math.max(.001, SPEC.springTopZ / 1000 - bottom);
        explodeVectors[id] = [0, .075, 0];
      } else if (id === 'shell-back') explodeVectors[id] = [0, 0, -.075];
      else if (id === 'shell-front') explodeVectors[id] = [0, 0, .075];
      else if (id === 'plug-back') explodeVectors[id] = [0, 0, -.022];
      else if (id === 'plug-front') explodeVectors[id] = [0, 0, .022];
      else if (id === 'cam') explodeVectors[id] = [-.025, 0, 0];
      else if (id === 'base') explodeVectors[id] = [0, -.025, 0];
    }
    viewer.setExplode(explode, { vectorForPart: binding => explodeVectors[binding.id] || [0, 0, 0] });
    paintMaterials(snap);
    scene.updateMatrixWorld(true);
    if (lastExplode !== explode || fitPending) {
      if (explode > 0) fitVisibleAssembly();
      else {
        if (lastExplode > 0) changeCamera(state.view.camera);
        if (fitPending && state.view.camera === 'overview' && viewport.clientWidth < 500) fitVisibleAssembly();
      }
      lastExplode = explode; fitPending = false;
    }
    requestDraw();
  };
  viewer.resize(); changeCamera(state.view.camera);
  ready = true; $('loading').remove(); syncUI(); applyScene();
  function updateLabels() {
    if (!ready) return;
    const p = new THREE.Vector3();
    for (let i = 0; i < tags.length; i++) {
      p.set(SPEC.pinXs[i] / 1000, .132 + .075 * state.view.explode, 0).project(camera);
      tags[i].style.left = `${(p.x + 1) / 2 * viewport.clientWidth}px`;
      tags[i].style.top = `${(1 - p.y) / 2 * viewport.clientHeight}px`;
      tags[i].hidden = !state.view.cutaway || ['end', 'rear'].includes(state.view.camera) || p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
    }
    p.set(.148, SPEC.shearZ / 1000, .009).project(camera);
    $('shear-tag').style.left = `${(p.x + 1) / 2 * viewport.clientWidth}px`;
    $('shear-tag').style.top = `${(1 - p.y) / 2 * viewport.clientHeight}px`;
    $('shear-tag').hidden = !shearLine.visible || ['end', 'rear'].includes(state.view.camera) || p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
  }
  requestDraw();
  window.__mechanismDebug = {
    snapshot: () => structuredClone({ state, model: getSnapshot(state) }),
    metrics: () => { scene.updateMatrixWorld(true); return { paletteId: palette.id,
      renderStyle: palette.renderStyle || 'material', shadows: renderer.shadowMap.enabled,
      camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), zoom: camera.zoom, target: controls.target.toArray() },
      partCount: parts.size, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls,
      units: 'm', nodes: [...parts.values()].map(({ id, node, model, display }) => ({ id, position: node.getWorldPosition(new THREE.Vector3()).toArray(), quaternion: node.getWorldQuaternion(new THREE.Quaternion()).toArray(), pose: model.position.toArray(), scale: model.scale.toArray(), visible: display.visible })) }; },
  };
}
syncUI();
initScene().catch(error => {
  $('loading').classList.add('error');
  $('loading').textContent = 'The 3D model could not load. Open the local preview and check that the Blender asset has been generated.';
  syncUI(); console.error(error);
});
await voiceReady;
