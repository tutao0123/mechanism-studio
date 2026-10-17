import * as THREE from 'three';
import { createMechanismViewer } from '../shared/viewer/viewer.mjs';
import { createLessonPlayer } from '../shared/voice/player.mjs';
import { STORIES } from './stories.mjs';
import { createTimeline, locateTime, formatTime } from './timeline.mjs';
import { createCameraDirector } from './camera-director.mjs';
import { PRESENTATION_PROFILES, resolvePresentation } from './presentation.mjs';

const $ = id => document.getElementById(id), viewport = $('viewport');
const params = new URLSearchParams(location.search), reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (params.get('clean') === '1') document.body.classList.add('clean');
const captureEnabled = params.get('capture') === '1';
if (captureEnabled) document.body.classList.add('capture');
let capturing = false;
let captureFramingScale = 1;
let storyId = 'inline-four', viewer, adapter, player, audio, fill, timeline, voiceTimeline, clips;
let epoch = 0, audioEpoch = 0, ready = false, voiceReady = false, playing = false, mode = 'silent', muted = false;
let time = 0, voiceIndex = 0, loopCount = 0, manualCamera = false, dirty = true, lastFrame = 0, lastChapter = -1, resumeAfterHidden = false;
let frameCount = 0, renderedLabels = [];
let cutCamera = true, annotationEpoch = 0, cameraMotion = { transitioning: false, progress: 1 };
let cameraDirector = createCameraDirector({ duration: .8 });
let activeStory, presentationMode = 'showcase', presentationProfile = PRESENTATION_PROFILES.showcase;
const labelNodes = new Map(), svgNS = 'http://www.w3.org/2000/svg';
const chapterNames = { overview: 'Overview', intake: 'Intake', compression: 'Compression', ignition: 'Ignition & power', exhaust: 'Exhaust', assembly: 'Explode & restore', fan: 'Fan & bypass', combustion: 'Combustion', joints: 'Hip & knee', trajectory: 'Foot path', gait: 'Diagonal gait', stance: 'Planned stance' };
const annotationText = {
  'FOUR CYLINDERS': 'Four cylinders', 'ONE CRANKSHAFT': 'Shared crankshaft',
  'AIR + PORT SPRAY': 'Air & fuel', 'PISTON MOVES DOWN': 'Piston descends',
  'VALVES CLOSED': 'Valves closed', 'VOLUME SHRINKS': 'Charge compressed',
  'SPARK AT TDC': 'Spark at top dead centre', 'POWER STROKE': 'Power stroke',
  'EXPANDING CHARGE': 'Expanding mixture', 'EXHAUST FLOWS OUT': 'Exhaust out',
  'PISTON MOVES UP': 'Piston rises', 'DISPLAY LAYER': 'Cylinder head',
  'SAME MECHANICAL POSE': 'Piston & rod', 'RESTORE WITHOUT DRIFT': 'Crankshaft',
  'TWO CONCENTRIC SPOOLS': 'Concentric shafts', 'CORE + BYPASS': 'Core & bypass',
  'FAN / LOW SPOOL': 'Fan · low spool', 'AIR GOES AROUND THE CORE': 'Bypass air',
  'HIGH-PRESSURE CORE': 'High-pressure core', 'INDEPENDENT INNER SHAFT': 'Inner shaft',
  'STEADY ANNULAR COMBUSTION': 'Continuous combustion', 'CLEAR SHAFT CENTRE': 'Central shaft',
  'TURBINES DRIVE THE FAN': 'Low-pressure turbine', 'CORE EXHAUST / NO AFTERBURNER': 'Core exhaust',
  'INNER LOW-PRESSURE SHAFT': 'Low-pressure shaft', 'HOLLOW HIGH-PRESSURE SHAFT': 'High-pressure shaft',
  'FIXED COMBUSTOR': 'Combustor',
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ease = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };

function updateControls() {
  document.body.classList.toggle('playing', playing);
  $('play').textContent = playing ? 'Pause' : 'Play';
  $('play').setAttribute('aria-label', playing ? 'Pause tour' : 'Play tour');
  const hasEditions = activeStory?.availableModes.length > 1;
  $('stage-state').textContent = manualCamera ? (hasEditions ? 'Explore · rotate' : 'Explore · drag to rotate') : playing ? (hasEditions ? 'Guided motion' : 'Live assembly · guided camera') : 'Tour paused';
  $('voice-toggle').disabled = !voiceReady;
  $('voice-toggle').textContent = mode === 'silent' ? 'Play with narration' : muted ? 'Unmute narration' : 'Mute narration';
  $('voice-label').textContent = mode === 'silent' ? (playing ? 'A silent preview is playing.' : 'The silent preview is paused.') : muted ? 'English narration is muted.' : playing ? 'English narration is playing.' : 'English narration is paused.';
  if (voiceReady) $('voice-status').textContent = mode === 'silent' ? 'English voice is ready. Start the story with sound.' : 'Model, camera and captions follow the voice.';
  $('explore').textContent = manualCamera ? 'Resume tour' : 'Explore model';
}

function disposeStory() {
  audioEpoch += 1;
  if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
  player?.dispose(); adapter?.dispose();
  if (viewer) {
    const geometries = new Set(viewer.meshes.map(mesh => mesh.geometry));
    viewer.dispose(); for (const geometry of geometries) geometry.dispose();
  }
  fill?.dispose(); viewer = adapter = player = audio = fill = null;
  labelNodes.clear(); $('callouts').replaceChildren(); $('leader-lines').replaceChildren();
}

function metadataDuration(url) {
  return new Promise((resolve, reject) => {
    const probe = new Audio(); let timer;
    const finish = error => {
      clearTimeout(timer); probe.removeAttribute('src'); probe.load();
      if (error) reject(error);
    };
    probe.preload = 'metadata';
    probe.addEventListener('loadedmetadata', () => {
      const duration = probe.duration;
      if (Number.isFinite(duration) && duration > 0 && duration < 180) { resolve(duration); finish(); }
      else finish(new Error('Invalid narration duration.'));
    }, { once: true });
    probe.addEventListener('error', () => finish(new Error('Narration could not be decoded.')), { once: true });
    timer = setTimeout(() => finish(new Error('Narration metadata timed out.')), 15000);
    probe.src = url;
  });
}

async function prepareVoice(story, token) {
  const localPlayer = player;
  try {
    const info = await localPlayer.load();
    if (token !== epoch) return;
    if (info.status !== 'ready') throw new Error('Narration is not available.');
    const prepared = await localPlayer.preloadAll();
    if (token !== epoch) return;
    const measured = await Promise.all(timeline.chapters.map(async chapter => [chapter.id, await metadataDuration(prepared[chapter.id].url)]));
    if (token !== epoch) return;
    clips = prepared;
    voiceTimeline = createTimeline(info.lesson.steps, Object.fromEntries(measured));
    // Use the same measured chapter lengths for the silent and audible edition.
    // Preserve chapter position while metadata replaces the initial hints.
    if (mode === 'silent') {
      const current = locateTime(timeline, time);
      timeline = voiceTimeline;
      time = timeline.chapters[current.index].start + Math.min(current.localTime, timeline.chapters[current.index].duration - .001);
      $('seek').max = timeline.total; $('total').textContent = formatTime(timeline.total);
      cameraDirector.reset(); cutCamera = true; annotationEpoch += 1;
    }
    voiceReady = true;
    updateControls(); dirty = true;
  } catch (error) {
    console.error('Narration preparation failed:', error);
    if (token !== epoch) return;
    voiceReady = false;
    $('voice-status').textContent = 'English audio is unavailable. The visual tour and captions still work.';
    updateControls();
  }
}

async function loadStory(id, requestedMode) {
  const token = ++epoch; ready = voiceReady = playing = false; disposeStory();
  storyId = id; time = voiceIndex = loopCount = 0; mode = 'silent'; muted = manualCamera = resumeAfterHidden = false; lastChapter = -1; voiceTimeline = clips = null;
  const story = resolvePresentation(STORIES[id], requestedMode);
  activeStory = story; presentationMode = story.presentationMode; presentationProfile = story.profile;
  cameraDirector = createCameraDirector({ duration: presentationProfile.transitionDuration }); cutCamera = true; annotationEpoch += 1;
  $('mode-choice').hidden = story.availableModes.length < 2;
  $('presentation-mode').replaceChildren(...story.availableModes.map(value => {
    const option = document.createElement('option'); option.value = value; option.textContent = PRESENTATION_PROFILES[value].label; return option;
  }));
  $('presentation-mode').value = presentationMode; $('presentation-mode').disabled = true;
  $('story').value = id; $('story').disabled = true;
  $('loading').hidden = false; $('loading').textContent = 'Loading the assembly…';
  $('voice-badge').textContent = 'English narration';
  document.title = `${story.subtitle} · ${presentationMode === 'showcase' ? 'Showcase' : 'Explain'} · Mechanism Studio`;
  $('title').textContent = story.title; $('subtitle').textContent = story.subtitle; $('model-note').textContent = story.note;
  $('voice-status').textContent = 'Preparing English voice…';
  $('legend').replaceChildren(...story.legend.map(([color, text]) => {
    const span = document.createElement('span'), dot = document.createElement('i');
    dot.style.background = color; span.append(dot, document.createTextNode(text)); return span;
  }));
  for (const id of ['play', 'restart', 'seek', 'voice-toggle', 'explore']) $(id).disabled = true;
  updateControls();
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#ffffff');
  scene.add(new THREE.AmbientLight('#ffffff', 2.1));
  const light = new THREE.DirectionalLight('#ffffff', 1.7); light.position.set(.5, 1, 1); scene.add(light);
  fill = new THREE.MeshStandardMaterial({ color: '#f1f2ef', roughness: .87, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const sourceMaterials = new Set();
  viewer = createMechanismViewer({ viewport, scene, assetUrl: new URL(story.asset, import.meta.url).href, contractUrl: new URL(story.contract, import.meta.url).href, autoRender: false,
    configureMesh(mesh) { for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) sourceMaterials.add(material); mesh.material = fill; },
    lineStyle: { enabled: true, color: '#43474a', opacity: .54 },
    onResize() { dirty = true; cutCamera = true; annotationEpoch += 1; }, onControlsChange() { dirty = true; },
    explodeVector: record => [record.explode[0] * .001, record.explode[2] * .001, -record.explode[1] * .001],
  });
  viewer.controls.enabled = false;
  audio = new Audio(); audio.preload = 'auto';
  audio.addEventListener('ended', () => {
    if (token !== epoch || mode !== 'voice' || !playing) return;
    let next = voiceIndex + 1;
    if (next === timeline.chapters.length) { next = 0; loopCount += 1; }
    startClip(next, 0); dirty = true;
  });
  audio.addEventListener('error', () => { if (token === epoch && mode === 'voice') voiceFallback(); });
  player = createLessonPlayer({ lessonURL: new URL(story.lesson, import.meta.url), manifestURL: new URL(story.manifest, import.meta.url), baseURL: new URL('./', new URL(story.lesson, import.meta.url)), locale: 'en-US' });
  try {
    const [localViewer, lessonResponse, adapterModule] = await Promise.all([viewer.ready, fetch(new URL(story.lesson, import.meta.url)), import(story.adapter)]);
    if (token !== epoch) return;
    if (!lessonResponse.ok) throw new Error('Tour chapters are unavailable.');
    const lesson = await lessonResponse.json(); timeline = createTimeline(lesson.steps);
    adapter = adapterModule.createAdapter(THREE, localViewer, { mode: presentationMode });
    for (const material of sourceMaterials) material.dispose();
    $('chapters').replaceChildren(...timeline.chapters.map((chapter, index) => {
      const button = document.createElement('button'), number = document.createElement('span'); number.textContent = String(index + 1).padStart(2, '0');
      button.append(number, document.createTextNode(chapterNames[chapter.id] || chapter.title)); button.addEventListener('click', () => seekTo(timeline.chapters[index].start, { animateCamera: true })); return button;
    }));
    $('seek').max = timeline.total; $('total').textContent = formatTime(timeline.total);
    $('loading').hidden = true; ready = true; playing = !reducedMotion && !document.hidden; resumeAfterHidden = !reducedMotion && document.hidden;
    for (const id of ['play', 'restart', 'seek', 'explore']) $(id).disabled = false;
    $('story').disabled = false; $('presentation-mode').disabled = false; updateControls(); dirty = true;
    if (reducedMotion) $('hint').textContent = 'Motion is paused for your reduced-motion preference. Press Play when you are ready.';
    prepareVoice(story, token);
  } catch (error) {
    console.error('Assembly preparation failed:', error);
    if (token !== epoch) return;
    $('loading').textContent = 'The assembly could not be loaded. Refresh this page to try again.';
    $('stage-state').textContent = 'Assembly unavailable'; $('story').disabled = false; $('presentation-mode').disabled = false;
  }
}

function voiceFallback() {
  audioEpoch += 1; audio.pause(); mode = 'silent'; playing = false; dirty = true; updateControls();
  $('voice-status').textContent = 'Sound could not start. Click “Play with narration” to try again.';
}

function startClip(index, offset) {
  const request = ++audioEpoch, currentEpoch = epoch, chapter = timeline.chapters[index];
  voiceIndex = index; time = chapter.start + offset;
  audio.pause(); audio.src = clips[chapter.id].url; audio.muted = muted; audio.currentTime = Math.min(offset, chapter.duration - .001);
  if (playing) audio.play().catch(() => { if (currentEpoch === epoch && request === audioEpoch) voiceFallback(); });
}

function setPlaying(value) {
  if (!ready) return;
  if (value && manualCamera) {
    cameraDirector.reset({ position: viewer.camera.position.toArray(), target: viewer.controls.target.toArray(), halfHeight: viewer.camera.top / viewer.camera.zoom });
    cutCamera = false;
  }
  if (mode === 'voice') time = timeline.chapters[voiceIndex].start + Math.min(audio.currentTime, timeline.chapters[voiceIndex].duration - .0001);
  playing = value; manualCamera = false; viewer.controls.enabled = false;
  if (mode === 'voice') {
    const request = ++audioEpoch, token = epoch;
    if (playing) audio.play().catch(() => { if (request === audioEpoch && token === epoch) voiceFallback(); });
    else audio.pause();
  }
  lastFrame = 0; dirty = true; updateControls();
}

function seekTo(value, { animateCamera = false } = {}) {
  if (!ready) return;
  const next = locateTime(timeline, Math.min(Math.max(0, value), timeline.total - .001));
  time = next.time; manualCamera = false; viewer.controls.enabled = false;
  cutCamera = !playing || !animateCamera; annotationEpoch += 1;
  if (mode === 'voice') startClip(next.index, next.localTime);
  dirty = true; updateControls();
}

function setCamera(chapter, progress, localTime, aspect) {
  const planned = adapter.camera(chapter.id, progress, aspect);
  const pose = cameraDirector.sample({ chapterKey: `${storyId}/${presentationMode}/${loopCount}/${chapter.id}`, localTime, pose: planned, cut: cutCamera || reducedMotion });
  cutCamera = false; cameraMotion = cameraDirector.snapshot();
  const camera = viewer.camera; camera.position.fromArray(pose.position); viewer.controls.target.fromArray(pose.target);
  const halfHeight = pose.halfHeight * (capturing ? captureFramingScale : 1);
  camera.zoom = 1; camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
  camera.top = halfHeight; camera.bottom = -halfHeight; camera.lookAt(viewer.controls.target);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}

function annotate(chapter, localTime) {
  const width = viewport.clientWidth, height = viewport.clientHeight, active = new Set();
  const annotations = adapter.annotations(chapter.id);
  let projectedEnvelope;
  function wideEnvelope() {
    if (projectedEnvelope !== undefined) return projectedEnvelope;
    const plan = adapter.snapshot().cameraPlan?.[chapter.id];
    if (!plan) return projectedEnvelope = null;
    const rect = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (const x of [plan.min[0], plan.max[0]]) for (const y of [plan.min[1], plan.max[1]]) for (const z of [plan.min[2], plan.max[2]]) {
      const q = new THREE.Vector3(x, y, z).project(viewer.camera), sx = (q.x + 1) * width / 2, sy = (1 - q.y) * height / 2;
      rect.left = Math.min(rect.left, sx); rect.right = Math.max(rect.right, sx); rect.top = Math.min(rect.top, sy); rect.bottom = Math.max(rect.bottom, sy);
    }
    return projectedEnvelope = rect;
  }
  $('leaders').setAttribute('viewBox', `0 0 ${width} ${height}`); renderedLabels = [];
  const timing = presentationProfile.annotations;
  const settling = cameraMotion.transitioning ? ease((cameraMotion.progress - timing.settleStart) / (1 - timing.settleStart)) : 1;
  for (const [index, annotation] of annotations.slice(0, 2).entries()) {
    const point = new THREE.Vector3(...annotation.point).project(viewer.camera);
    if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) continue;
    const key = annotation.id + annotation.side; active.add(key);
    let record = labelNodes.get(key);
    if (!record) {
      const label = document.createElement('div'); label.className = 'callout'; $('callouts').append(label);
      const path = document.createElementNS(svgNS, 'path'); path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#92928a'); path.setAttribute('stroke-width', '.65');
      const circle = document.createElementNS(svgNS, 'circle'); circle.setAttribute('r', '1.4'); circle.setAttribute('fill', '#5c5c55');
      $('leader-lines').append(path, circle); record = { label, path, circle }; labelNodes.set(key, record);
    }
    const label = annotationText[annotation.label] || annotation.label;
    if (record.text !== label) { record.text = label; record.label.textContent = label; record.layoutKey = null; }
    const px = (point.x + 1) * width / 2, py = (1 - point.y) * height / 2;
    const opacity = !playing || reducedMotion ? 1 : Math.min(ease((localTime - timing.start - index * timing.stagger) / timing.fadeIn), ease((chapter.duration - localTime) / timing.fadeOut), settling);
    const layoutKey = `${annotationEpoch}/${width}/${height}`;
    if (record.layoutKey !== layoutKey && opacity > .01) {
      const margin = clamp(width * .035, 14, 28), left = annotation.side === 'left';
      record.width = record.label.offsetWidth; record.height = record.label.offsetHeight;
      record.x = left ? margin : width - record.width - margin;
      const ductMargin = storyId === 'turbofan' && !['overview', 'assembly'].includes(chapter.id);
      const preferredY = Number.isFinite(annotation.labelY) ? height * clamp(annotation.labelY, 0, 1) - record.height / 2
        : ductMargin ? height * (left ? .13 : .84) - record.height / 2 : py - record.height / 2 + (left ? -26 : 26);
      record.y = clamp(preferredY, 32, height - record.height - 30);
      const envelope = ['overview', 'assembly'].includes(chapter.id) ? wideEnvelope() : null;
      if (envelope && record.x < envelope.right + 8 && record.x + record.width > envelope.left - 8 && record.y < envelope.bottom + 8 && record.y + record.height > envelope.top - 8) {
        record.y = clamp(left ? envelope.top - record.height - 16 : envelope.bottom + 16, 16, height - record.height - 16);
      }
      record.label.style.left = `${record.x}px`; record.label.style.top = `${record.y}px`; record.layoutKey = layoutKey;
    }
    if (record.x == null) { record.label.style.opacity = '0'; record.path.setAttribute('opacity', '0'); record.circle.setAttribute('opacity', '0'); continue; }
    // Text stays still once placed; the fine leader alone follows the part.
    const { x, y } = record, withinText = px >= x && px <= x + record.width;
    const startX = withinText ? clamp(px, x + 4, x + record.width - 4) : px > x ? x + record.width : x;
    const startY = withinText ? py > y + record.height / 2 ? y + record.height : y : y + record.height / 2;
    const bend = startX + (px - startX) * .65;
    record.path.setAttribute('d', `M${startX},${startY} L${bend},${startY} L${px},${py}`);
    record.circle.setAttribute('cx', px); record.circle.setAttribute('cy', py);
    record.label.style.opacity = opacity; record.path.setAttribute('opacity', String(opacity * .8)); record.circle.setAttribute('opacity', String(opacity));
    renderedLabels.push({ id: annotation.id, label, x: px, y: py, opacity });
  }
  for (const [key, record] of labelNodes) if (!active.has(key)) { record.label.remove(); record.path.remove(); record.circle.remove(); labelNodes.delete(key); }
}

function render() {
  const location = locateTime(timeline, time), { chapter, index, localTime, progress } = location;
  if (index !== lastChapter) {
    annotationEpoch += 1;
    lastChapter = index; $('chapter-eyebrow').textContent = chapter.eyebrow.toLowerCase().replace(/(^|\/\s*)([a-z])/g, (_, prefix, letter) => prefix + letter.toUpperCase()); $('chapter-title').textContent = chapter.title; $('transcript').textContent = chapter.narration;
    $('chapter-number').textContent = `${String(index + 1).padStart(2, '0')} / ${String(timeline.chapters.length).padStart(2, '0')}`;
    [...$('chapters').children].forEach((button, i) => { button.classList.toggle('active', i === index); if (i === index) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current'); });
  }
  adapter.update({ chapterId: chapter.id, localTime, chapterProgress: progress, chapterDuration: chapter.duration, totalTime: time });
  if (!manualCamera) setCamera(chapter, reducedMotion ? .5 : progress, reducedMotion ? 1 : localTime, viewport.clientWidth / Math.max(1, viewport.clientHeight));
  viewer.draw(); annotate(chapter, localTime); frameCount += 1;
  $('seek').value = time;
  const elapsedText = formatTime(time), loopText = loopCount ? `↻ LOOP ${loopCount + 1}` : '↻ LOOP';
  if ($('elapsed').textContent !== elapsedText) $('elapsed').textContent = elapsedText;
  if ($('loop-status').textContent !== loopText) $('loop-status').textContent = loopText;
}

function frame(now) {
  const delta = lastFrame ? Math.min(.1, (now - lastFrame) / 1000) : 0; lastFrame = now;
  if (ready && !document.hidden && !capturing) {
    if (playing) {
      if (mode === 'voice') time = timeline.chapters[voiceIndex].start + Math.min(audio.currentTime, timeline.chapters[voiceIndex].duration - .0001);
      else { time += delta; if (time >= timeline.total) { loopCount += Math.floor(time / timeline.total); time %= timeline.total; } }
    }
    if (playing || dirty) { dirty = false; render(); }
  }
  requestAnimationFrame(frame);
}

$('play').addEventListener('click', () => setPlaying(!playing));
$('restart').addEventListener('click', () => { loopCount = 0; seekTo(0); });
$('seek').addEventListener('input', event => seekTo(Number(event.target.value)));
$('voice-toggle').addEventListener('click', () => {
  if (!voiceReady) return;
  if (mode === 'silent') {
    cameraDirector.reset(); cutCamera = true; annotationEpoch += 1;
    timeline = voiceTimeline; $('seek').max = timeline.total; $('total').textContent = formatTime(timeline.total);
    mode = 'voice'; muted = false; playing = true; loopCount = 0; manualCamera = false; viewer.controls.enabled = false; startClip(0, 0);
  }
  else { muted = !muted; audio.muted = muted; }
  dirty = true; updateControls();
});
$('explore').addEventListener('click', () => {
  if (manualCamera) { setPlaying(true); return; }
  setPlaying(false); manualCamera = true; viewer.controls.enabled = true; updateControls();
});
$('story').addEventListener('change', event => {
  const url = new URL(location.href); url.searchParams.set('story', event.target.value); url.searchParams.delete('mode'); history.replaceState(null, '', url);
  loadStory(event.target.value);
});
$('presentation-mode').addEventListener('change', event => {
  const url = new URL(location.href); url.searchParams.set('mode', event.target.value); history.replaceState(null, '', url);
  loadStory(storyId, event.target.value);
});
$('fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { $('hint').textContent = 'Use your browser’s fullscreen command to present this story.'; }
});
document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? 'Exit fullscreen ↙' : 'Present ↗'; dirty = true; });
document.addEventListener('keydown', event => {
  if (event.code === 'Space' && !['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'A'].includes(event.target.tagName)) { event.preventDefault(); setPlaying(!playing); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { resumeAfterHidden = playing; if (playing) setPlaying(false); }
  else if (resumeAfterHidden) { resumeAfterHidden = false; setPlaying(true); }
});
window.addEventListener('pagehide', () => { playing = false; audio?.pause(); });
window.mechanismShowcase = Object.freeze({
  // Opt-in offline recording: advance the existing lesson, mechanics and camera
  // sequentially at exact source times, independent of capture or machine speed.
  ...(captureEnabled ? { capture: Object.freeze({
    start(sourceTime = 0, { framingScale = 1, soundtrack = 'narration' } = {}) {
      if (!ready || !voiceReady) throw new Error('Wait for the measured narration timeline.');
      if (!Number.isFinite(sourceTime) || !Number.isFinite(framingScale) || framingScale < 1 || framingScale > 2) throw new Error('Invalid capture time or framing scale.');
      if (!['narration', 'music'].includes(soundtrack)) throw new Error('Invalid capture soundtrack.');
      captureFramingScale = framingScale;
      $('voice-badge').textContent = soundtrack === 'music' ? 'Original code score' : 'English narration';
      capturing = true; audio.pause(); mode = 'silent'; timeline = voiceTimeline;
      playing = true; manualCamera = false; viewer.controls.enabled = false;
      loopCount = 0; lastChapter = -1; cutCamera = true; annotationEpoch += 1;
      cameraDirector.reset(); time = clamp(sourceTime, 0, timeline.total - .0001);
      updateControls(); render();
    },
    frame(sourceTime) {
      if (!capturing) throw new Error('Start capture first.');
      if (!Number.isFinite(sourceTime) || sourceTime < time) throw new Error('Capture frames must be finite and sequential.');
      time = clamp(sourceTime, 0, timeline.total - .0001); render();
      return { time, chapterId: locateTime(timeline, time).chapter.id, frameCount };
    },
    stop() { capturing = false; playing = false; lastFrame = 0; dirty = true; $('voice-badge').textContent = 'English narration'; updateControls(); },
  }) } : {}),
  snapshot: () => ({ story: storyId, ready, playing, mode, muted, manualCamera, voiceReady, time, total: timeline?.total ?? null,
  presentationMode, presentationProfile, lesson: activeStory?.lesson ?? null,
  chapterId: ready ? locateTime(timeline, time).chapter.id : null, chapterIndex: ready ? locateTime(timeline, time).index : null, loopCount, audioTime: audio?.currentTime ?? 0,
  audioDuration: Number.isFinite(audio?.duration) ? audio.duration : null, audioPaused: audio?.paused ?? true, frameCount, labels: structuredClone(renderedLabels),
  camera: viewer ? { position: viewer.camera.position.toArray(), target: viewer.controls.target.toArray(), halfHeight: viewer.camera.top } : null,
  cameraMotion: cameraDirector.snapshot(),
  mechanism: adapter?.snapshot() ?? null }) });
requestAnimationFrame(frame);
loadStory(STORIES[params.get('story')] ? params.get('story') : 'inline-four', params.get('mode'));
