import { SPEC, LEGS, robotState, motionPoses, bodyToGLTF, footTrajectory, cycle } from '../../examples/quadruped/model.mjs';
import { createQuadrupedFraming, explosionVector } from './quadruped-framing.mjs';

const CHAPTERS = new Set(['overview', 'joints', 'trajectory', 'gait', 'stance', 'assembly']);
const PRESENTATION_MODES = new Set(['showcase', 'explain']);
const NAMES = { fl: 'Front left', fr: 'Front right', rl: 'Rear left', rr: 'Rear right' };
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value * value * (3 - 2 * value);
function validateChapter(id) { if (!CHAPTERS.has(id)) throw new TypeError('Unknown quadruped chapter.'); }
function validateMode(mode) { if (!PRESENTATION_MODES.has(mode)) throw new TypeError('Unknown quadruped presentation mode.'); }
const PACING = {
  explain: { gaitHz: .32, jointTiming: 'chapter-progress', assemblyTiming: 'chapter-progress' },
  showcase: { gaitHz: .76, jointCycleSeconds: 3, jointLiftSeconds: 1, jointHoldSeconds: .45,
    assemblyExpandSeconds: 1.2, assemblyHoldSeconds: 1, assemblyReassembleSeconds: 1.2 },
};

function showcaseLift(localTime) {
  const seconds = localTime % PACING.showcase.jointCycleSeconds;
  if (seconds <= 1) return 40 * smooth(seconds);
  if (seconds <= 1.45) return 40;
  if (seconds <= 2.45) return 40 * (1 - smooth(seconds - 1.45));
  return 0;
}

function showcaseExplosion(localTime) {
  if (localTime <= 1.2) return smooth(clamp(localTime / 1.2));
  if (localTime <= 2.2) return 1;
  if (localTime <= 3.4) return 1 - smooth(clamp((localTime - 2.2) / 1.2));
  return 0;
}

export function sampleChapter({ chapterId = 'overview', localTime = 0, chapterProgress = 0, totalTime = 0, explode } = {}, presentationMode = 'explain') {
  validateChapter(chapterId); validateMode(presentationMode);
  for (const [key, value] of Object.entries({ localTime, chapterProgress, totalTime })) if (!Number.isFinite(value) || value < 0) throw new TypeError(`${key} must be finite and non-negative.`);
  if (explode !== undefined && (!Number.isFinite(explode) || explode < 0)) throw new TypeError('explode must be finite and non-negative.');
  const p = clamp(chapterProgress), fallback = p === 0 || p === 1 ? 0 : Math.sin(p * Math.PI);
  const showcase = presentationMode === 'showcase';
  return { chapterId, localTime, chapterProgress: p, totalTime, presentationMode,
    // The short assembly holds the next loop's phase-zero trot pose. Display
    // explosion can close without snapping neutral feet into a new stride.
    mode: chapterId === 'assembly' ? (showcase ? 'trot' : 'stand') : chapterId === 'joints' ? 'single' : chapterId === 'trajectory' ? 'single-path' : 'trot',
    phase: chapterId === 'assembly' ? 0 : cycle(totalTime * PACING[presentationMode].gaitHz),
    stepHeight: 40, singleLift: showcase ? showcaseLift(localTime) : 40 * smooth(p),
    explode: chapterId === 'assembly' ? clamp(explode ?? (showcase ? showcaseExplosion(localTime) : fallback)) : 0,
  };
}

function mechanicalState(current) {
  if (current.mode !== 'single-path') return robotState(current);
  const stand = robotState(), moving = robotState({ ...current, mode: 'trot' });
  const legs = stand.legs.map(leg => leg.id === 'fl' ? moving.legs[0] : leg);
  return { ...moving, mode: 'single-path', legs, contactLegs: legs.filter(leg => leg.contact).map(leg => leg.id), maxResidual: Math.max(...legs.map(leg => leg.residual)) };
}

function createTeachingGuides(THREE, scene) {
  const group = new THREE.Group(); group.name = 'showcase/quadruped/teaching-guides';
  group.userData.geometryOnly = true; scene.add(group);
  const paths = new THREE.Group(), chain = new THREE.Group(), contacts = new THREE.Group(); group.add(paths, chain, contacts);
  const materials = [], geometries = [];
  const lineMaterial = options => { const value = new THREE.LineBasicMaterial(options); materials.push(value); return value; };
  function line(points, material, parent, loop = false) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(...point))); geometries.push(geometry);
    const object = loop ? new THREE.LineLoop(geometry, material) : new THREE.Line(geometry, material); parent.add(object); return object;
  }
  const pathObjects = new Map(), contactObjects = new Map();
  for (const leg of LEGS) {
    const material = new THREE.LineDashedMaterial({ color: '#a5a59c', dashSize: .003, gapSize: .002, transparent: true, opacity: .8 }); materials.push(material);
    const points = Array.from({ length: 97 }, (_, index) => { const target = footTrajectory(index / 96, 40); return bodyToGLTF([leg.x + target.x, leg.y, target.z]); });
    const path = line(points, material, paths); path.computeLineDistances(); path.name = `foot-path/${leg.id}`; pathObjects.set(leg.id, path);
    const ring = line(Array.from({ length: 48 }, (_, index) => { const angle = index * Math.PI * 2 / 48; return [.014 * Math.cos(angle), .0006, .014 * Math.sin(angle)]; }), lineMaterial({ color: '#6d6d65' }), contacts, true);
    ring.name = `planned-contact/${leg.id}`; contactObjects.set(leg.id, ring);
  }
  const chainLine = line([[0, 0, 0], [0, 0, 0], [0, 0, 0]], lineMaterial({ color: '#56564e', depthTest: false, transparent: true, opacity: .7 }), chain); chainLine.renderOrder = 4;
  const pointGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Array(9).fill(0), 3)); geometries.push(pointGeometry);
  const pointMaterial = new THREE.PointsMaterial({ color: '#56564e', size: 4, sizeAttenuation: false, depthTest: false }); materials.push(pointMaterial);
  const joints = new THREE.Points(pointGeometry, pointMaterial); joints.renderOrder = 5; chain.add(joints);
  let status = {};
  function update(current, model) {
    group.visible = current.explode === 0;
    paths.visible = ['trajectory', 'gait'].includes(current.chapterId);
    for (const [id, path] of pathObjects) path.visible = current.chapterId === 'gait' || id === 'fl';
    chain.visible = current.chapterId === 'joints'; contacts.visible = current.chapterId === 'stance';
    const leg = model.legs[0], points = [leg.hipPosition, leg.kneePosition, leg.footPosition].flatMap(bodyToGLTF);
    chainLine.geometry.getAttribute('position').array.set(points); chainLine.geometry.getAttribute('position').needsUpdate = true;
    pointGeometry.getAttribute('position').array.set(points); pointGeometry.getAttribute('position').needsUpdate = true;
    chainLine.geometry.computeBoundingSphere(); pointGeometry.computeBoundingSphere();
    for (const leg of model.legs) { const ring = contactObjects.get(leg.id); ring.position.fromArray(bodyToGLTF([leg.footPosition[0], leg.footPosition[1], 0])); ring.visible = leg.contact; }
    status = { pathsVisible: group.visible && paths.visible, chainVisible: group.visible && chain.visible, contactCuesVisible: group.visible && contacts.visible,
      visiblePathLegs: group.visible && paths.visible ? [...pathObjects].filter(([, object]) => object.visible).map(([id]) => id) : [],
      contactCueLegs: group.visible && contacts.visible ? model.contactLegs.slice() : [], geometryOnly: true, forceSimulation: false };
  }
  return { update, snapshot: () => structuredClone(status), dispose() { group.removeFromParent(); for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose(); } };
}

export function createAdapter(THREE, viewer, { mode: presentationMode = 'explain' } = {}) {
  validateMode(presentationMode);
  if (!viewer?.scene || !viewer.parts || typeof viewer.applyPoses !== 'function') throw new TypeError('Quadruped adapter requires a loaded mechanism viewer.');
  for (const id of ['body', 'cover', 'battery', 'controller', ...LEGS.flatMap(leg => ['hip-', 'thigh-', 'shin-', 'foot-'].map(prefix => prefix + leg.id))]) if (!viewer.parts.has(id)) throw new Error(`Quadruped asset is missing ${id}.`);
  const framing = createQuadrupedFraming(THREE, viewer), guides = createTeachingGuides(THREE, viewer.scene);
  let current = sampleChapter({}, presentationMode), model = mechanicalState(current), lastCamera = null, disposed = false;
  function sourcePoint(id, local = [0, 0, 0]) {
    const binding = viewer.parts.get(id); binding.node.updateWorldMatrix(true, false);
    return binding.node.localToWorld(new THREE.Vector3(...local)).toArray();
  }
  const item = (id, label, local, side, labelY) => ({ id, label, point: sourcePoint(id, local), side, labelY });
  function annotations(chapterId = current.chapterId) {
    validateChapter(chapterId);
    if (chapterId === 'overview') return [item('body', 'Fixed body', bodyToGLTF([0, 65, 210]), 'left', .12), item('thigh-fl', 'Eight pitch joints', [0, -.04, 0], 'right', .86)];
    if (chapterId === 'joints') return [item('thigh-fl', 'Hip pitch', [0, 0, -.009], 'left', .12), item('shin-fl', 'Knee pitch', [0, 0, -.022], 'right', .86)];
    if (chapterId === 'trajectory') return [item('foot-fl', 'Foot-centre path', [0, 0, 0], 'left', .12), item('shin-fl', 'Two fixed link lengths', [0, -.06, 0], 'right', .86)];
    if (chapterId === 'gait') return [item('foot-fl', 'Front left + rear right', [0, 0, 0], 'left', .12), item('foot-fr', 'Half a cycle apart', [0, 0, 0], 'right', .86)];
    if (chapterId === 'stance') {
      // The front-left foot swings for half the cycle. Bind this caption to an
      // actual planned-contact foot, and therefore its visible ground cue.
      const contactId = model.contactLegs[0];
      return [item(`foot-${contactId}`, 'Planned stance phase', [0, 0, 0], 'left', .12), item('body', 'Body remains fixed', bodyToGLTF([0, 65, 210]), 'right', .86)];
    }
    return [item('cover', 'Vented cover', bodyToGLTF([0, 0, 238]), 'left', .12), item('controller', 'Control board', bodyToGLTF([61, 0, 224]), 'right', .86)];
  }
  function update(input) {
    if (disposed) return;
    current = sampleChapter(input, presentationMode); model = mechanicalState(current);
    viewer.applyPoses(motionPoses(model), { target: 'node' });
    viewer.setCutaway(current.chapterId !== 'assembly');
    viewer.setExplode(current.explode, { vectorForPart: explosionVector });
    guides.update(current, model); viewer.scene.updateMatrixWorld(true);
  }
  function fit(box, target, offset, aspect, margin, floor) {
    const position = target.clone().add(new THREE.Vector3(...offset));
    const camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, .001, 20); camera.position.copy(position); camera.lookAt(target); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
    let halfHeight = floor;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const point = new THREE.Vector3(x, y, z).project(camera); halfHeight = Math.max(halfHeight, Math.abs(point.x) / margin, Math.abs(point.y) / margin);
    }
    return { position: position.toArray(), target: target.toArray(), halfHeight };
  }
  function camera(chapterId = current.chapterId, progress = current.chapterProgress, aspect = 1.6) {
    validateChapter(chapterId);
    if (!Number.isFinite(progress) || !Number.isFinite(aspect) || aspect <= 0) throw new TypeError('Camera progress and aspect must be finite.');
    const box = framing[chapterId], target = box.getCenter(new THREE.Vector3());
    const offset = chapterId === 'joints' || chapterId === 'trajectory' ? [.13, .065, -.62] : chapterId === 'gait' ? [.53, .68, -.62] : chapterId === 'stance' ? [.58, .27, -.64] : [.6, .43, -.66];
    lastCamera = fit(box, target, offset, aspect, chapterId === 'assembly' ? .69 : .75, chapterId === 'joints' || chapterId === 'trajectory' ? .15 : .25);
    return structuredClone(lastCamera);
  }
  function snapshot() {
    return { id: 'quadruped', ...current, pacing: { ...PACING[presentationMode] }, mechanical: { mode: model.mode, phase: model.phase, jointCount: model.jointCount, maxResidualMM: model.maxResidual,
      stepHeightMM: model.stepHeight, contactLegs: model.contactLegs.slice(), fixedBody: true, dynamicsSolved: false,
      legs: model.legs.map(leg => ({ id: leg.id, name: NAMES[leg.id], hipDegrees: leg.hip, kneeDegrees: leg.knee,
        hipPositionMM: [...leg.hipPosition], kneePositionMM: [...leg.kneePosition], footPositionMM: [...leg.footPosition], targetMM: [...leg.target],
        localPhase: leg.localPhase, swing: leg.swing, contact: leg.contact, withinLimits: leg.withinLimits, residualMM: leg.residual })) },
      effects: guides.snapshot(), annotations: annotations(current.chapterId), camera: lastCamera ? structuredClone(lastCamera) : null,
      cameraPlan: Object.fromEntries(Object.entries(framing).map(([id, box]) => [id, { min: box.min.toArray(), max: box.max.toArray() }])), partCount: viewer.parts.size, disposed };
  }
  update(current);
  return { update, camera, annotations, snapshot, dispose() { if (disposed) return; disposed = true; guides.dispose(); } };
}
