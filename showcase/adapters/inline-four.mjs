import { engineState, motionPoses, bodyToGLTF, SPEC } from '../../examples/inline-four/model.mjs';
import { processState, sparkAnchorMM } from '../../examples/inline-four/process.mjs';
import { createEngineProcessEffects } from '../../examples/inline-four/effects.mjs';
import { createFramingEnvelopes } from './camera-envelope.mjs';

const CHAPTERS = new Set(['overview', 'intake', 'compression', 'ignition', 'exhaust', 'assembly']);
const ENGLISH_STAGE = Object.freeze({ intake: 'Intake', compression: 'Compression', power: 'Power', exhaust: 'Exhaust' });
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => value * value * (3 - 2 * value);
function validateChapter(id) { if (!CHAPTERS.has(id)) throw new TypeError('Unknown inline-four chapter.'); }

// Story pacing is deterministic and deliberately slows the ignition display.
// It is an editorial demonstration, not a claim of constant engine speed.
export function sampleChapter({ chapterId = 'overview', localTime = 0, chapterProgress = 0, totalTime = 0, explode } = {}) {
  validateChapter(chapterId);
  for (const [name, value] of Object.entries({ localTime, chapterProgress, totalTime })) if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be finite and non-negative.`);
  if (explode !== undefined && (!Number.isFinite(explode) || explode < 0)) throw new TypeError('explode must be finite and non-negative.');
  const progress = clamp(chapterProgress);
  let angle;
  if (chapterId === 'overview') angle = totalTime * 75 % 720;
  else if (chapterId === 'intake') angle = 360 + 170 * ease(progress);
  else if (chapterId === 'compression') angle = 540 + 178 * ease(progress);
  else if (chapterId === 'ignition') angle = progress < .32 ? 10 * progress / .32 : 10 + 155 * ease((progress - .32) / .68);
  else if (chapterId === 'exhaust') angle = 180 + 170 * ease(progress);
  else angle = 90;
  const fallbackExplosion = progress === 0 || progress === 1 ? 0 : Math.sin(progress * Math.PI);
  return { chapterId, localTime, chapterProgress: progress, totalTime, angle, explode: chapterId === 'assembly' ? clamp(explode ?? fallbackExplosion) : 0 };
}

export function createAdapter(THREE, viewer) {
  if (!viewer?.scene || !viewer.parts || typeof viewer.applyPoses !== 'function') throw new TypeError('Inline-four adapter requires a loaded mechanism viewer.');
  for (const id of ['crankshaft', 'cylinder-head', 'piston-1', 'spark-plug-1', 'intake-valve-1', 'exhaust-valve-1']) if (!viewer.parts.has(id)) throw new Error(`Inline-four asset is missing ${id}.`);
  const motionRanges = Object.fromEntries(['crankshaft', 'flywheel', 'timing-drive', 'intake-camshaft', 'exhaust-camshaft'].map(id => [id, { rotationX: 'full' }]));
  const r = SPEC.stroke / 2, l = SPEC.rodLength, rodAngle = Math.asin(r / l);
  for (const [index, x] of SPEC.cylinderX.entries()) {
    const number = index + 1;
    motionRanges[`piston-${number}`] = { position: { min: [x * .001, (l - r) * .001, 0], max: [x * .001, (l + r) * .001, 0] } };
    motionRanges[`rod-${number}`] = { rotationX: [-rodAngle, rodAngle], position: { min: [x * .001, -r * .001, -r * .001], max: [x * .001, r * .001, r * .001] } };
    for (const [kind, y] of [['intake', -17], ['exhaust', 17]]) motionRanges[`${kind}-valve-${number}`] = {
      position: { min: bodyToGLTF([x, y, 232 - SPEC.valveLift]), max: bodyToGLTF([x, y, 232]) },
    };
  }
  const framing = createFramingEnvelopes(THREE, viewer, {
    referencePoses: motionPoses(engineState(0)), motionRanges,
    explodeVector: binding => bodyToGLTF(binding.record?.explode || [0, 0, 0]),
    points: SPEC.cylinderX.flatMap(x => [[x + 14, -146, 288], [x, 114, 222]].map(bodyToGLTF)),
  });
  const effects = createEngineProcessEffects(THREE); effects.group.name = 'showcase/inline-four/process'; viewer.scene.add(effects.group);
  let current = sampleChapter(), model = engineState(0), process = processState(0), disposed = false, lastCamera = null;

  function sourcePoint(id, bodyOffset = [0, 0, 0]) {
    const binding = viewer.parts.get(id);
    if (!binding) throw new Error(`Missing annotation source ${id}.`);
    binding.node.updateWorldMatrix(true, false);
    return binding.node.localToWorld(new THREE.Vector3(...bodyToGLTF(bodyOffset))).toArray();
  }
  function annotation(id, label, point, side) { return { id, label, point, side }; }
  function annotations(chapterId = current.chapterId) {
    validateChapter(chapterId);
    const piston = sourcePoint('piston-1', [0, -27, 20]);
    if (chapterId === 'overview') return [
      annotation('cylinder-head', 'FOUR CYLINDERS', sourcePoint('cylinder-head', [0, -38, 248]), 'left'),
      annotation('crankshaft', 'ONE CRANKSHAFT', sourcePoint('crankshaft', [0, -22, 0]), 'right'),
    ];
    if (chapterId === 'intake') return [
      annotation('intake-valve-1', 'AIR + PORT SPRAY', bodyToGLTF([SPEC.cylinderX[0] + 6, -124, 267]), 'left'),
      annotation('piston-1', 'PISTON MOVES DOWN', piston, 'right'),
    ];
    if (chapterId === 'compression') return [
      annotation('intake-valve-1', 'VALVES CLOSED', sourcePoint('intake-valve-1'), 'left'),
      annotation('piston-1', 'VOLUME SHRINKS', piston, 'right'),
    ];
    if (chapterId === 'ignition') return [
      annotation('spark-plug-1', process.cylinders[0].spark.active ? 'SPARK AT TDC' : 'POWER STROKE', bodyToGLTF(sparkAnchorMM(process.cylinders[0])), 'left'),
      annotation('piston-1', 'EXPANDING CHARGE', piston, 'right'),
    ];
    if (chapterId === 'exhaust') return [
      annotation('exhaust-valve-1', 'EXHAUST FLOWS OUT', sourcePoint('exhaust-valve-1', [0, 8, 0]), 'left'),
      annotation('piston-1', 'PISTON MOVES UP', piston, 'right'),
    ];
    return [
      annotation('cylinder-head', 'DISPLAY LAYER', sourcePoint('cylinder-head', [0, -38, 248]), 'left'),
      annotation('piston-1', 'SAME MECHANICAL POSE', piston, 'right'),
      annotation('crankshaft', 'RESTORE WITHOUT DRIFT', sourcePoint('crankshaft'), 'right'),
    ];
  }
  function update(input) {
    if (disposed) return;
    current = sampleChapter(input); model = engineState(current.angle);
    viewer.applyPoses(motionPoses(model), { target: 'node' });
    viewer.setCutaway(true);
    viewer.setExplode(current.explode, { vectorForPart: binding => bodyToGLTF(binding.record?.explode || [0, 0, 0]) });
    process = processState(current.angle, { enabled: true, cutaway: true, explode: current.explode });
    effects.update(process); viewer.scene.updateMatrixWorld(true);
  }

  function fitBox(box, target, offset, aspect, margin, floor) {
    const position = target.clone().add(new THREE.Vector3(...offset));
    const virtual = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, .001, 20);
    virtual.position.copy(position); virtual.lookAt(target); virtual.updateMatrixWorld(true); virtual.updateProjectionMatrix();
    let height = floor;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new THREE.Vector3(x, y, z).project(virtual);
      height = Math.max(height, Math.abs(p.x) / margin, Math.abs(p.y) / margin);
    }
    return { position: position.toArray(), target: target.toArray(), halfHeight: height };
  }
  function camera(chapterId = current.chapterId, progress = current.chapterProgress, aspect = 1.6) {
    validateChapter(chapterId);
    if (!Number.isFinite(progress) || !Number.isFinite(aspect) || aspect <= 0) throw new TypeError('Camera progress and aspect must be finite.');
    const p = clamp(progress), sway = Math.sin(p * Math.PI);
    let result;
    if (chapterId === 'overview' || chapterId === 'assembly') {
      const box = framing[chapterId];
      const target = box.getCenter(new THREE.Vector3());
      // Hold the opening and full explosion view. Moving piston bounds must
      // never steer the camera or resize the composition each frame.
      result = fitBox(box, target,
        chapterId === 'assembly' ? [.7, .48, .95] : [.65, .42, .84],
        aspect, chapterId === 'assembly' ? .72 : .78, chapterId === 'assembly' ? .34 : .26);
    } else {
      const x = SPEC.cylinderX[0];
      // A deliberate cylinder-one cutaway close-up. Include the external port
      // spray, cam deck, chamber and piston travel even in a portrait viewport.
      const box = new THREE.Box3(
        new THREE.Vector3(...bodyToGLTF([x - 55, 45, 95])),
        new THREE.Vector3(...bodyToGLTF([x + 55, -155, 335])));
      const target = new THREE.Vector3(...bodyToGLTF([x, -35, 215]));
      result = fitBox(box, target, [.07 + .015 * sway, .19 + .012 * p, .55 - .025 * p], aspect, .8, chapterId === 'ignition' ? .15 : .16);
    }
    lastCamera = result;
    return structuredClone(result);
  }
  function snapshot() {
    const englishProcess = structuredClone(process);
    for (const cylinder of englishProcess.cylinders) cylinder.label = ENGLISH_STAGE[cylinder.stage];
    return {
      id: 'inline-four', ...current,
      mechanical: { crankAngle: model.inputAngle, camAngle: model.camAngle, firingOrder: [...SPEC.firingOrder],
        cylinders: model.cylinders.map(c => ({ number: c.number, phase: c.phase, stroke: ENGLISH_STAGE[c.stroke.id], pistonHeightMM: c.pistonHeight,
          travelFromTDCMM: c.travelFromTDC, intakeLiftMM: c.intakeLift, exhaustLiftMM: c.exhaustLift })) },
      process: englishProcess, annotations: annotations(current.chapterId), camera: lastCamera ? structuredClone(lastCamera) : null,
      cameraPlan: Object.fromEntries(Object.entries(framing).map(([id, box]) => [id, { min: box.min.toArray(), max: box.max.toArray() }])),
      partCount: viewer.parts.size, disposed,
    };
  }
  update(current);
  return { update, camera, annotations, snapshot,
    dispose() { if (disposed) return; disposed = true; effects.dispose(); }
  };
}
