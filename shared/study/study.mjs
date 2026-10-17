import * as THREE from 'three';
import { createMechanismViewer } from '/shared/viewer/viewer.mjs';
import { createCameraDirector } from '/showcase/camera-director.mjs';
import { placeAnnotation, moveAnnotation } from '/shared/viewer/annotation-layout.mjs';
import { COLOR_ACCENT_REVISION, sampleColorAccents } from '/shared/appearance/color-accents.mjs';
import { createMeshColorLayer } from '/shared/appearance/mesh-color-layer.mjs';

/** One instance owns the study shell on a page. The example supplies all source
 * identities, mechanics, chapter timing, detail targets and framing policy. */
export function createAssemblyStudy(config) {
const { BPM, DURATION, CHAPTERS, stateAt, normalizeTime, localDisplayOffsets } = config.timeline;
const { annotationCues, CUE_WINDOWS } = config.annotations;
if (!CHAPTERS?.length || !Number.isFinite(DURATION) || DURATION <= 0 || typeof config.createFraming !== 'function') throw new TypeError('An assembly study needs chapters, duration and source framing.');
const $ = id => document.getElementById(id);
const parameters = new URLSearchParams(location.search);
const captureEnabled = parameters.get('capture') === '1';
if (parameters.get('clean') === '1') document.body.classList.add('clean');
if (captureEnabled) document.body.classList.add('capture');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const audio = new Audio(); audio.id = 'study-audio'; audio.loop = true; audio.preload = 'auto'; document.body.append(audio);
let viewer, index, framing, score, source, musicReady = false, ready = false, musicError = null;
let partRecords = new Map(), partIds = [];
let playing = !reduced.matches, musicClock = false, muted = false, time = 0, lastFrame = 0, lastChapter = -1, loops = 0, previousTime = 0;
let dirty = true, cut = true, manualCamera = false, transportEpoch = 0, hiddenResume = false;
let annotationLayouts = [], annotationKey = null, annotationSnapshots = [];
let colorLayer, colorCues = true, colorAssignments = new Map();
let capturing = false, lastCaptureTime = -1;
const director = createCameraDirector({ duration: config.cameraTransitionSeconds ?? .8 });
const formatTime = value => `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
function status(text) { $('status').textContent = text; }
function transport() {
  $('play').disabled = !ready || !musicReady;
  $('pause').disabled = !ready; $('pause').textContent = playing ? 'Pause' : 'Resume';
  $('restart').disabled = !ready; $('seek').disabled = !ready; $('sound').disabled = !musicReady;
  $('play').textContent = musicClock && playing ? 'Music playing' : 'Play with music';
  $('sound').textContent = musicClock && !muted ? 'Sound on' : 'Sound off';
  $('sound').setAttribute('aria-pressed', String(musicClock && !muted));
  $('color-cues').disabled = !ready;
  $('color-cues').setAttribute('aria-pressed', String(colorCues));
}
async function readJson(url) { const result = await fetch(url); if (!result.ok) throw new Error(`${url}: HTTP ${result.status}`); return result.json(); }
async function loadMusic() {
  score = await readJson(config.scoreUrl);
  if (score.bpm !== BPM || Math.abs(score.durationSeconds - DURATION) > 1 / score.sampleRate) throw new Error('Score and visual timeline disagree.');
  const response = await fetch(config.audioUrl); if (!response.ok) throw new Error('Music file is unavailable.');
  const bytes = await response.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (bytes.byteLength !== score.byteLength || hash !== score.sha256) throw new Error('Music checksum differs from its score.');
  const metadata = new Promise((resolve, reject) => {
    audio.addEventListener('loadedmetadata', resolve, { once: true });
    audio.addEventListener('error', () => reject(new Error('The browser could not decode the music.')), { once: true });
  });
  audio.src = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })); audio.load(); await metadata;
  if (Math.abs(audio.duration - DURATION) > .002) throw new Error('Decoded music duration differs from the score.');
  musicReady = true; transport();
}
const musicPromise = loadMusic().catch(error => { musicError = error.message; status(`${musicError} The silent presentation remains available.`); transport(); });
function currentPose() { return { position: viewer.camera.position.toArray(), target: viewer.controls.target.toArray(), halfHeight: viewer.camera.top / viewer.camera.zoom }; }
async function playMusic() {
  if (!ready || !musicReady || capturing) return;
  const token = ++transportEpoch;
  audio.currentTime = normalizeTime(time); audio.muted = muted;
  try {
    await audio.play(); if (token !== transportEpoch) return;
    if (manualCamera) { director.reset(currentPose()); manualCamera = false; }
    musicClock = true; playing = true; lastFrame = 0; viewer.controls.enabled = false;
    status(config.playingStatus || 'Soft score · Quiet motion and seating cues follow the assembly.'); transport();
  } catch { if (token === transportEpoch) { musicClock = false; status('Sound could not start. Click Play with music to try again.'); transport(); } }
}
function pause() { ++transportEpoch; if (musicClock && !audio.paused) time = normalizeTime(audio.currentTime); audio.pause(); playing = false; lastFrame = 0; viewer.controls.enabled = true; dirty = true; transport(); }
async function resume() {
  if (musicClock) return playMusic();
  if (manualCamera) { director.reset(currentPose()); manualCamera = false; }
  playing = true; lastFrame = 0; viewer.controls.enabled = false; transport();
}
function seek(value) {
  time = Math.max(0, Math.min(DURATION - .00001, value));
  if (musicReady) audio.currentTime = time;
  previousTime = time; lastFrame = 0; cut = dirty = true; manualCamera = false;
}
function prepareLabels(state, width, height, viewportBox) {
  const aspect = width / height, plan = reduced.matches && !capturing
    ? framing.cameraFor(state.chapter.id, aspect, 0)
    : framing.annotationCameraFor?.(state.chapter.id, aspect) ?? framing.cameraFor(state.chapter.id, aspect, 0);
  const camera = viewer.camera.clone();
  camera.position.fromArray(plan.position); camera.lookAt(new THREE.Vector3(...plan.target));
  camera.left = -plan.halfHeight * aspect; camera.right = plan.halfHeight * aspect; camera.top = plan.halfHeight; camera.bottom = -plan.halfHeight; camera.zoom = 1;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  const point = new THREE.Vector3(), placed = [], layouts = [];
  const project = vector => {
    point.fromArray(vector).project(camera);
    return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2, z: point.z };
  };
  const chapterStart = state.chapter.firstBeat * 60 / BPM, chapterEnd = state.chapter.lastBeat * 60 / BPM;
  const endpoints = [stateAt(chapterStart), stateAt(chapterEnd - 1e-6)];
  const credit = document.querySelector('.asset-credit').getBoundingClientRect();
  for (const [i, [id, text]] of state.chapter.labels.entries()) {
    const reference = stateAt(chapterStart + CUE_WINDOWS[state.chapter.id][i][0] + .001);
    const label = $(`label-${i ? 'b' : 'a'}`); label.textContent = text;
    const points = [], obstacles = [...placed, { x: credit.left - viewportBox.left, y: credit.top - viewportBox.top, width: credit.width, height: credit.height }];
    for (const mesh of viewer.meshes) {
      if (!mesh.visible) continue;
      const meshId = mesh.userData.selectionId;
      if (meshId === id) {
        const vertices = mesh.geometry.getAttribute('position'), correction = new THREE.Vector3(...reference.offsetsWorld[id]).sub(new THREE.Vector3(...state.offsetsWorld[id]));
        for (let vertex = 0; vertex < vertices.count; vertex++) {
          const world = point.fromBufferAttribute(vertices, vertex).applyMatrix4(mesh.matrixWorld).add(correction).toArray();
          points.push({ ...project(world), world });
        }
      } else {
        const part = partRecords.get(meshId), projected = [];
        // Every other link follows an authored linear segment. Reserve its full
        // chapter sweep so retained names are not covered by a later movement.
        for (const endpoint of endpoints) {
          const delta = endpoint.offsetsWorld[meshId];
          for (const x of [part.worldBounds.min[0], part.worldBounds.max[0]]) for (const y of [part.worldBounds.min[1], part.worldBounds.max[1]]) for (const z of [part.worldBounds.min[2], part.worldBounds.max[2]]) projected.push(project([x + delta[0], y + delta[1], z + delta[2]]));
        }
        const xs = projected.map(p => p.x), ys = projected.map(p => p.y);
        obstacles.push({ x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) });
      }
    }
    const layout = placeAnnotation({ points, width, height, textWidth: label.getComputedTextLength(), textHeight: parseFloat(getComputedStyle(label).fontSize) * 1.3, obstacles, preferredSide: i ? 'right' : 'left' });
    if (layout) {
      layout.anchorWorld = points.find(p => p.x === layout.anchor.x && p.y === layout.anchor.y).world;
      placed.push(layout.rect);
    }
    layouts.push(layout);
  }
  return layouts;
}
function showLabels(state, cues) {
  const box = $('viewport').getBoundingClientRect(), width = box.width, height = box.height;
  $('annotations').setAttribute('viewBox', `0 0 ${width} ${height}`);
  $('annotation-a').style.opacity = '0'; $('annotation-b').style.opacity = '0'; annotationSnapshots = [];
  if (!cues.length) return;
  const key = `${state.chapter.id}:${width}:${height}:${reduced.matches && !capturing ? 'still' : 'motion'}`;
  if (annotationKey !== key) { annotationKey = key; annotationLayouts = prepareLabels(state, width, height, box); }
  for (const cue of cues) {
    const cached = annotationLayouts[cue.index];
    if (!cached) continue;
    const p = new THREE.Vector3(...cached.anchorWorld).project(viewer.camera);
    if (p.z < -1 || p.z > 1 || Math.abs(p.x) >= 1 || Math.abs(p.y) >= 1) continue;
    const layout = moveAnnotation(cached, { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 });
    const rect = layout.rect;
    if (rect.x < 5 || rect.y < 5 || rect.x + rect.width > width - 5 || rect.y + rect.height > height - 5 || annotationSnapshots.some(other => rect.x < other.rect.x + other.rect.width + 4 && rect.x + rect.width > other.rect.x - 4 && rect.y < other.rect.y + other.rect.height + 4 && rect.y + rect.height > other.rect.y - 4)) continue;
    const suffix = cue.index ? 'b' : 'a', label = $(`label-${suffix}`);
    label.setAttribute('x', layout.text.x); label.setAttribute('y', layout.text.y); label.setAttribute('text-anchor', layout.text.anchor);
    $(`leader-${suffix}`).setAttribute('d', `M${layout.anchor.x},${layout.anchor.y} L${layout.end.x},${layout.end.y}`);
    $(`annotation-${suffix}`).style.opacity = String(cue.opacity);
    annotationSnapshots.push({ id: cue.id, name: cue.text, opacity: cue.opacity, ...layout });
  }
}
function applyFrame({ forceCut = false } = {}) {
  if (!ready) return;
  const state = stateAt(time), offsets = localDisplayOffsets(index, state.offsetsWorld, THREE.Matrix4, THREE.Vector3);
  // A source-backed adapter supplies absolute working poses, including reset
  // identities. Display explosion remains a separate, later transform channel.
  if (config.workingPoses) viewer.applyPoses(config.workingPoses(state), { target: 'model' });
  viewer.setExplode(1, { vectorForPart: binding => offsets.get(binding.id) });
  const detailIds = config.detailIds?.(state) ?? null;
  // Hide only owned solids, never semantic source wrappers with descendants.
  for (const mesh of viewer.meshes) mesh.visible = !detailIds || detailIds.includes(mesh.userData.selectionId);
  if (!manualCamera) {
    const aspect = Math.max(1, $('viewport').clientWidth) / Math.max(1, $('viewport').clientHeight);
    const plan = framing.cameraFor(state.chapter.id, aspect, reduced.matches && !capturing ? 0 : state.localTime);
    // A detail edit changes which source solids are shown. Explicit editorial
    // cuts prevent a new whole assembly popping into the previous macro camera.
    const chapterCut = lastChapter !== state.chapterIndex && config.cameraCuts?.includes(state.chapter.id);
    const pose = director.sample({ chapterKey: state.chapter.id, localTime: state.localTime, pose: plan, cut: forceCut || cut || chapterCut || (reduced.matches && !capturing) });
    viewer.camera.position.fromArray(pose.position); viewer.controls.target.fromArray(pose.target);
    viewer.camera.zoom = 1; viewer.camera.left = -pose.halfHeight * aspect; viewer.camera.right = pose.halfHeight * aspect;
    viewer.camera.top = pose.halfHeight; viewer.camera.bottom = -pose.halfHeight;
    viewer.camera.updateProjectionMatrix(); viewer.controls.update(); viewer.camera.updateMatrixWorld(true);
  }
  if (lastChapter !== state.chapterIndex) {
    lastChapter = state.chapterIndex; $('chapter-number').textContent = `${String(lastChapter + 1).padStart(2, '0')} / ${String(CHAPTERS.length).padStart(2, '0')}`;
    $('chapter-title').textContent = state.chapter.title; $('chapter-copy').textContent = state.chapter.copy;
  }
  $('seek').value = time; $('elapsed').textContent = formatTime(time);
  const cues = manualCamera ? [] : annotationCues(state, { paused: !playing, cameraSettled: director.snapshot().progress >= .999 });
  const accents = config.appearanceCues?.(state, cues) ?? cues.map(cue => ({ id: cue.id, weight: cue.opacity }));
  colorAssignments = sampleColorAccents(partIds, accents, { enabled: colorCues });
  colorLayer.apply(colorAssignments);
  viewer.draw(); showLabels(state, cues); cut = dirty = false;
}
function frame(now) {
  if (capturing) {
    // Screenshot surfaces may resize after a requested recording frame. Repaint
    // that same frozen time; neither advance the clock nor restart its camera.
    if (ready && dirty) applyFrame();
    requestAnimationFrame(frame); return;
  }
  if (ready && playing && !document.hidden) {
    const dt = lastFrame ? Math.max(0, (now - lastFrame) / 1000) : 0;
    time = musicClock && !audio.paused ? normalizeTime(audio.currentTime) : normalizeTime(time + dt);
    if (time < previousTime - .1) loops++;
    previousTime = time; lastFrame = now; applyFrame();
  } else if (ready && dirty) applyFrame();
  requestAnimationFrame(frame);
}
$('play').addEventListener('click', playMusic);
$('pause').addEventListener('click', () => playing ? pause() : resume());
$('restart').addEventListener('click', () => { seek(0); applyFrame({ forceCut: true }); });
$('seek').addEventListener('input', event => { seek(Number(event.target.value)); applyFrame({ forceCut: true }); });
$('sound').addEventListener('click', () => { if (!musicClock) { muted = false; playMusic(); } else { muted = !muted; audio.muted = muted; transport(); } });
$('color-cues').addEventListener('click', () => { colorCues = !colorCues; transport(); dirty = true; applyFrame(); });
$('viewport').addEventListener('pointerdown', () => { if (ready) { pause(); manualCamera = true; } }, { passive: true, capture: true });
audio.addEventListener('error', () => { if (musicClock) { musicClock = false; status('Music is unavailable. Continuing with the same visual timeline.'); transport(); } });
document.addEventListener('visibilitychange', () => {
  if (!ready || capturing) return;
  if (document.hidden) { hiddenResume = playing; pause(); }
  else { lastFrame = 0; dirty = true; if (hiddenResume) { hiddenResume = false; resume(); } }
});
reduced.addEventListener('change', event => { if (event.matches && ready && !capturing) pause(); });

async function init() {
  transport();
  [index, source] = await Promise.all([readJson(config.indexUrl), readJson(config.sourceUrl)]);
  partRecords = new Map(index.parts.map(part => [part.id, part])); partIds = [...partRecords.keys()];
  if (partIds.length !== index.parts.length) throw new Error('Scene-index part identities must be unique.');
  $('robot-title').textContent = config.title; document.title = config.documentTitle || config.title + ' · Mechanism Studio';
  const sourceLink = source.sourceUrl || source.url;
  $('source-name').textContent = config.sourceName;
  if (sourceLink) { $('source-link').href = sourceLink; document.querySelector('.asset-credit').href = sourceLink; }
  if (config.creditLabel) document.querySelector('.asset-credit').textContent = config.creditLabel;
  $('duration').textContent = formatTime(DURATION); $('seek').max = DURATION;
  framing = config.createFraming(index);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#ffffff');
  scene.add(new THREE.HemisphereLight('#ffffff', '#d9d9d5', 2.4));
  const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(-.5, 1.5, 1.2); scene.add(key);
  const fill = new THREE.DirectionalLight('#ffffff', .65); fill.position.set(.8, .35, -.7); scene.add(fill);
  const camera = new THREE.OrthographicCamera(-.4, .4, .3, -.3, .001, 20);
  if (config.cameraUp !== undefined) {
    if (!Array.isArray(config.cameraUp) || config.cameraUp.length !== 3 || !config.cameraUp.every(Number.isFinite) || Math.hypot(...config.cameraUp) <= 0) throw new TypeError('Camera up must contain three finite coordinates with nonzero length.');
    // OrbitControls captures the camera's up basis at construction. Set it here,
    // before the viewer creates controls; cloned annotation cameras inherit it.
    camera.up.fromArray(config.cameraUp).normalize();
  }
  viewer = createMechanismViewer({
    viewport: $('viewport'), scene, camera, assetUrl: config.assetUrl, contractUrl: config.contractUrl, autoRender: false,
    lineStyle: { enabled: true, color: '#353532', detailColor: '#93938e' }, pixelRatio: captureEnabled ? 1 : 1.8,
    // A deterministic recording can sit on one frame between screenshot calls.
    // Retain that frame instead of depending on a live RAF repaint at capture.
    rendererOptions: captureEnabled ? { preserveDrawingBuffer: true } : {},
    configureMesh(mesh) { mesh.material = new THREE.MeshStandardMaterial({ color: '#f1f1ed', metalness: 0, roughness: .88, side: THREE.FrontSide }); },
    onControlsChange() { if (manualCamera) dirty = true; }, onResize() { dirty = true; if (!capturing) cut = true; },
  });
  await viewer.ready; if (viewer.parts.size !== partIds.length || [...viewer.parts.keys()].some(id => !partRecords.has(id))) throw new Error('Scene-index and visible source parts disagree.');
  colorLayer = createMeshColorLayer(viewer.meshes);
  viewer.controls.enabled = !playing; ready = true; applyFrame({ forceCut: true });
  status(config.initialStatus);
  await musicPromise;
  if (musicError) status(`${musicError} The silent presentation remains available.`);
  transport();
}
// Local inspection API, used for deterministic visual verification and capture.
const api = {
  seek(seconds) { pause(); seek(seconds); applyFrame({ forceCut: true }); },
  play: playMusic, pause,
  snapshot() { const state = stateAt(time); return { ready, playing, musicReady, musicClock, muted, capturing, colorCues, colorAccentRevision: COLOR_ACCENT_REVISION, appearance: Object.fromEntries(colorAssignments), audioEdition: score?.edition, audioSha256: score?.sha256, feltBpm: score?.feltBpm, time, audioTime: audio.currentTime, duration: DURATION, loops, chapter: state.chapter.id, progress: state.progress, offsetsWorld: state.offsetsWorld, camera: viewer && currentPose(), annotations: annotationSnapshots, geometryRevision: index?.geometryRevision, sourceRevision: source?.revision || source?.commit, parts: viewer?.parts.size }; },
  get viewer() { return viewer; }, get framing() { return framing; }, get index() { return index; },
};
if (captureEnabled) api.capture = {
  start() {
    if (!ready) throw new Error('The assembly is not ready for capture.');
    pause(); hiddenResume = false; capturing = true; musicClock = false; playing = true; manualCamera = false;
    time = previousTime = 0; lastFrame = 0; loops = 0; lastCaptureTime = -1; viewer.controls.enabled = false;
    lastChapter = -1; annotationKey = null; annotationLayouts = []; director.reset();
    cut = true; applyFrame({ forceCut: true }); transport(); return api.snapshot();
  },
  frame(seconds) {
    if (!capturing) throw new Error('Start capture before requesting frames.');
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > DURATION || seconds < lastCaptureTime) throw new RangeError('Capture frames must advance monotonically within one loop. Restart capture to record again.');
    time = normalizeTime(seconds); lastCaptureTime = seconds; previousTime = time;
    applyFrame(); return api.snapshot();
  },
  stop() { hiddenResume = false; capturing = false; pause(); applyFrame(); return api.snapshot(); },
};
requestAnimationFrame(frame);
api.ready = init().then(() => api).catch(error => { playing = false; status('Could not prepare the assembly: ' + error.message); transport(); console.error(error); return null; });
return api;
}
