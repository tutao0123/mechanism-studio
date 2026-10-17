import { createState, mechanical, observe, poses, derived, bodyToGLTF, SPEC, ROTORS } from '../../examples/turbofan/model.mjs';
import { processState, processGeometry } from '../../examples/turbofan/process.mjs';
import { createTurbofanProcess } from '../../examples/turbofan/effects.mjs';
import { createFramingEnvelopes } from './camera-envelope.mjs';

const CHAPTERS = new Set(['overview', 'fan', 'compression', 'combustion', 'exhaust', 'assembly']);
const clamp = value => Math.max(0, Math.min(1, value));
function validateChapter(id) { if (!CHAPTERS.has(id)) throw new TypeError('Unknown turbofan chapter.'); }
export function sampleChapter({ chapterId = 'overview', localTime = 0, chapterProgress = 0, totalTime = 0, explode } = {}) {
  validateChapter(chapterId);
  for (const [key, value] of Object.entries({ localTime, chapterProgress, totalTime })) if (!Number.isFinite(value) || value < 0) throw new TypeError(`${key} must be finite and non-negative.`);
  if (explode !== undefined && (!Number.isFinite(explode) || explode < 0)) throw new TypeError('explode must be finite and non-negative.');
  const progress = clamp(chapterProgress);
  const fallbackExplosion = progress === 0 || progress === 1 ? 0 : Math.sin(progress * Math.PI);
  return { chapterId, localTime, chapterProgress: progress, totalTime,
    lowAngle: totalTime * SPEC.lowSpeedDegrees % 360, highAngle: totalTime * SPEC.highSpeedDegrees % 360,
    explode: chapterId === 'assembly' ? clamp(explode ?? fallbackExplosion) : 0 };
}

export function createAdapter(THREE, viewer) {
  if (!viewer?.scene || !viewer.parts || typeof viewer.applyPoses !== 'function') throw new TypeError('Turbofan adapter requires a loaded mechanism viewer.');
  for (const id of ['fan', 'low-shaft', 'high-shaft', 'combustor', 'nozzle', 'bypass-duct']) if (!viewer.parts.has(id)) throw new Error(`Turbofan asset is missing ${id}.`);
  const framing = createFramingEnvelopes(THREE, viewer, {
    referencePoses: poses(createState()),
    motionRanges: Object.fromEntries(Object.keys(ROTORS).map(id => [id, { rotationX: 'full' }])),
    explodeVector: binding => bodyToGLTF(binding.record?.explode || [0, 0, 0]),
    points: processGeometry().routes.flatMap(route => route.points),
  });
  const effects = createTurbofanProcess(THREE); effects.group.name = 'showcase/turbofan/process'; viewer.scene.add(effects.group);
  let current = sampleChapter(), state = createState(), process = processState(state), lastCamera = null, disposed = false;
  function sourcePoint(id, bodyPoint) {
    const binding = viewer.parts.get(id);
    if (!binding) throw new Error(`Missing annotation source ${id}.`);
    binding.node.updateWorldMatrix(true, false);
    return binding.node.localToWorld(new THREE.Vector3(...bodyToGLTF(bodyPoint))).toArray();
  }
  const item = (id, label, point, side) => ({ id, label, point, side });
  function annotations(chapterId = current.chapterId) {
    validateChapter(chapterId);
    if (chapterId === 'overview') return [
      item('fan', 'TWO CONCENTRIC SPOOLS', sourcePoint('fan', [-440, 0, 60]), 'left'),
      item('bypass-duct', 'CORE + BYPASS', sourcePoint('bypass-duct', [-40, -175, 0]), 'right'),
    ];
    if (chapterId === 'fan') return [
      item('fan', 'FAN / LOW SPOOL', sourcePoint('fan', [-440, 0, 120]), 'left'),
      item('bypass-duct', 'AIR GOES AROUND THE CORE', sourcePoint('bypass-duct', [-300, -178, 0]), 'right'),
    ];
    if (chapterId === 'compression') return [
      item('high-shaft', 'HIGH-PRESSURE CORE', sourcePoint('high-shaft', [-160, 22, 15]), 'left'),
      item('low-shaft', 'INDEPENDENT INNER SHAFT', sourcePoint('low-shaft', [-350, 0, 0]), 'right'),
    ];
    if (chapterId === 'combustion') return [
      item('combustor', 'STEADY ANNULAR COMBUSTION', sourcePoint('combustor', [100, -80, 0]), 'left'),
      item('high-shaft', 'CLEAR SHAFT CENTRE', sourcePoint('high-shaft', [80, 22, 15]), 'right'),
    ];
    if (chapterId === 'exhaust') return [
      item('low-shaft', 'TURBINES DRIVE THE FAN', sourcePoint('low-shaft', [350, 0, 0]), 'left'),
      item('nozzle', 'CORE EXHAUST / NO AFTERBURNER', sourcePoint('nozzle', [500, 0, 80]), 'right'),
    ];
    return [
      item('low-shaft', 'INNER LOW-PRESSURE SHAFT', sourcePoint('low-shaft', [-160, 0, 0]), 'left'),
      item('high-shaft', 'HOLLOW HIGH-PRESSURE SHAFT', sourcePoint('high-shaft', [80, 22, 15]), 'right'),
      item('combustor', 'FIXED COMBUSTOR', sourcePoint('combustor', [100, 0, 105]), 'right'),
    ];
  }
  function update(input) {
    if (disposed) return;
    current = sampleChapter(input);
    state = mechanical(createState(), { lowAngle: current.lowAngle, highAngle: current.highAngle, playing: false });
    state = observe(state, { cutaway: true, explode: current.explode });
    viewer.applyPoses(poses(state), { target: 'node' }); viewer.setCutaway(true);
    viewer.setExplode(current.explode, { vectorForPart: binding => bodyToGLTF(binding.record?.explode || [0, 0, 0]) });
    process = processState(state, { enabled: true, flow: true, combustion: true });
    effects.update(process); viewer.scene.updateMatrixWorld(true);
  }
  function fit(box, target, offset, aspect, floor, margin = .77) {
    const position = target.clone().add(new THREE.Vector3(...offset));
    const virtual = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, .001, 20);
    virtual.position.copy(position); virtual.lookAt(target); virtual.updateMatrixWorld(true); virtual.updateProjectionMatrix();
    let halfHeight = floor;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const q = new THREE.Vector3(x, y, z).project(virtual); halfHeight = Math.max(halfHeight, Math.abs(q.x) / margin, Math.abs(q.y) / margin);
    }
    return { position: position.toArray(), target: target.toArray(), halfHeight };
  }
  function camera(chapterId = current.chapterId, progress = current.chapterProgress, aspect = 1.6) {
    validateChapter(chapterId);
    if (!Number.isFinite(progress) || !Number.isFinite(aspect) || aspect <= 0) throw new TypeError('Camera progress and aspect must be finite.');
    const p = clamp(progress), sway = Math.sin(p * Math.PI);
    let result;
    if (chapterId === 'overview' || chapterId === 'assembly') {
      const box = framing[chapterId];
      // Fixed reference target and scale: rotor angle and display explosion
      // have no influence on the planned wide shot.
      result = fit(box, box.getCenter(new THREE.Vector3()), [-1.05, .52, 1.2], aspect,
        chapterId === 'assembly' ? .44 : .36, chapterId === 'assembly' ? .7 : .77);
    } else {
      const ranges = {
        fan: { min: [-525, -245, -245], max: [-235, 245, 245], target: [-385, -20, 0], offset: [-.65, .29, .78], floor: .3 },
        compression: { min: [-375, -150, -155], max: [12, 150, 155], target: [-180, -20, 0], offset: [.08, .24, .78], floor: .22 },
        combustion: { min: [-30, -140, -140], max: [218, 140, 140], target: [95, -15, 0], offset: [.045, .2, .7], floor: .2 },
        exhaust: { min: [180, -165, -165], max: [650, 165, 165], target: [415, -10, 0], offset: [.26, .24, .78], floor: .25 },
      };
      const framing = ranges[chapterId];
      const box = new THREE.Box3(new THREE.Vector3(...bodyToGLTF(framing.min)), new THREE.Vector3(...bodyToGLTF(framing.max)));
      // body Y flips into glTF Z: repair the two box endpoints accordingly.
      const a = box.min.clone(), b = box.max.clone(); box.min.copy(a).min(b); box.max.copy(a).max(b);
      const target = new THREE.Vector3(...bodyToGLTF(framing.target)), offset = [...framing.offset]; offset[0] += .025 * sway; offset[1] += .01 * p;
      result = fit(box, target, offset, aspect, framing.floor, .79);
    }
    lastCamera = result; return structuredClone(result);
  }
  function snapshot() {
    return { id: 'turbofan', ...current, mechanical: { ...derived(state), lowSpeedDegrees: SPEC.lowSpeedDegrees, highSpeedDegrees: SPEC.highSpeedDegrees },
      process: { ...process }, effects: effects.snapshot(), annotations: annotations(current.chapterId),
      camera: lastCamera ? structuredClone(lastCamera) : null,
      cameraPlan: Object.fromEntries(Object.entries(framing).map(([id, box]) => [id, { min: box.min.toArray(), max: box.max.toArray() }])),
      partCount: viewer.parts.size, disposed };
  }
  update(current);
  return { update, camera, annotations, snapshot, dispose() { if (disposed) return; disposed = true; effects.dispose(); } };
}
