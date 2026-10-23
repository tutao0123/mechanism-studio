import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Matrix4, Vector3 } from 'three';
import { checkedPath } from '../video/export.mjs';
import { createGearboxPresentation } from '../../examples/gearbox/presentation.mjs';
import { createGripperPresentation } from '../../examples/robotiq-gripper/presentation.mjs';
import { createPlanetaryPresentation } from '../../examples/planetary-gears/presentation.mjs';
import { createJointPresentation } from '../../examples/robot-joint/presentation.mjs';

const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const vector = (v, size) => Array.isArray(v) && v.length === size && v.every(Number.isFinite);
const registry = {
  gearbox: { factory: createGearboxPresentation, source: 'assets/provenance.json' },
  'robotiq-gripper': { factory: createGripperPresentation, source: 'source/provenance.json' },
  'planetary-gears': { factory: createPlanetaryPresentation, source: 'assets/provenance.json' },
  'robot-joint': { factory: createJointPresentation, source: 'assets/provenance.json' },
};

/** Numerical checks only. A passing report does not certify rendered legibility,
 * collision clearance, engineering accuracy, media quality, or licensing. */
export function inspectPresentation({ example, index, source, score, presentation, sampleRate = 30 }) {
  ensure(Number.isInteger(sampleRate) && sampleRate > 0 && sampleRate <= 120, 'Sample rate must be an integer in 1..120.');
  const { plan, timeline, annotations, framing, workingPoses, appearanceCues, presentationOpacity } = presentation;
  const ids = new Set(index.parts.map(part => part.id)), duration = timeline.DURATION;
  const before = hash({ index, source, score }), inputHashes = { sceneIndex: hash(index), source: hash(source), plan: hash(plan), ...(score === undefined ? {} : { score: hash(score) }) };
  const times = new Set(Array.from({ length: Math.ceil(duration * sampleRate) }, (_, i) => i / sampleRate).filter(t => t < duration));
  const boundary = time => { for (const delta of [-1e-7, 0, 1e-7]) if (time + delta >= 0 && time + delta < duration) times.add(time + delta); };
  for (const chapter of plan.chapters) { boundary(chapter.firstBeat * 60 / plan.bpm); boundary(chapter.lastBeat * 60 / plan.bpm); }
  for (const channel of Object.values(plan.channels)) { [...channel.rise, ...channel.fall].forEach(boundary); if (channel.cutoff !== undefined) boundary(channel.cutoff); }
  for (const chapter of plan.chapters) for (const window of plan.annotations.windows[chapter.id]) for (const t of window) boundary(chapter.firstBeat * 60 / plan.bpm + t);
  const samples = [...times].sort((a, b) => a - b), checks = [];
  const check = (name, fn) => { try { const detail = fn(); checks.push({ name, status: 'passed', ...(detail ? { detail } : {}) }); } catch (error) { checks.push({ name, status: 'failed', error: error.message }); } };
  check('revision-and-identities', () => {
    ensure(plan.geometryRevision === index.geometryRevision, 'Geometry revision mismatch.');
    ensure(ids.size === index.parts.length, 'Duplicate part identities.');
    ensure(plan.bpm === timeline.BPM && plan.durationSeconds === duration, 'Plan and timeline timing differ.');
  });
  check('sampled-offsets-and-model-poses', () => {
    for (const time of samples) {
      const state = timeline.stateAt(time), poses = workingPoses?.(state) ?? {};
      ensure(Object.keys(state.offsetsWorld).length === ids.size, `Missing display offsets at ${time}.`);
      for (const [id, value] of Object.entries(state.offsetsWorld)) ensure(ids.has(id) && vector(value, 3), `Invalid display offset ${id} at ${time}.`);
      const local = timeline.localDisplayOffsets(index, state.offsetsWorld, Matrix4, Vector3);
      ensure(local instanceof Map && local.size === ids.size, 'Parent-frame offsets must cover each real part.');
      for (const [id, value] of local) ensure(ids.has(id) && vector(value, 3), `Invalid local offset ${id} at ${time}.`);
      for (const [id, pose] of Object.entries(poses)) {
        ensure(ids.has(id) && vector(pose.position, 3) && vector(pose.quaternion, 4), `Invalid model pose ${id} at ${time}.`);
        ensure(Math.abs(Math.hypot(...pose.quaternion) - 1) < 1e-8, `Non-unit rotation ${id} at ${time}.`);
        ensure(pose.scale === undefined || vector(pose.scale, 3) && pose.scale.every(n => Math.abs(n - 1) < 1e-10), `Source part scale changed: ${id}.`);
      }
    }
    return { count: samples.length, parts: ids.size, includes: 'uniform samples plus chapter, channel and annotation boundaries' };
  });
  const sample = time => {
    const state = timeline.stateAt(time), labels = annotations.annotationCues(state, { cameraSettled: true });
    return { state, poses: workingPoses?.(state), labels, appearance: appearanceCues(state, labels), opacity: [...ids].map(id => presentationOpacity?.(state, id) ?? 1) };
  };
  check('absolute-time-seek-determinism', () => {
    const chosen = Array.from({ length: 97 }, (_, i) => duration * i / 97), baseline = chosen.map(t => hash(sample(t)));
    // A permutation with jumps forward and backward catches accumulated state.
    for (let i = 0; i < chosen.length; i++) { const j = i * 37 % 97; ensure(hash(sample(chosen[j])) === baseline[j], `Seek changed the result at ${chosen[j]}.`); }
  });
  check('reassembly-and-loop-reset', () => {
    for (const time of [0, duration - 1e-6, duration]) {
      const state = timeline.stateAt(time);
      for (const [id, value] of Object.entries(state.offsetsWorld)) ensure(Math.hypot(...value) < 1e-8, `Part ${id} is still displaced at loop boundary ${time}.`);
    }
    ensure(hash(sample(0)) === hash(sample(duration)), 'Exact loop reset differs from time zero.');
    return { scope: 'Display reassembly and exact timeline reset; near-boundary mechanical velocity is not assessed here.' };
  });
  check('annotation-and-appearance-contract', () => {
    for (const time of samples) {
      const state = timeline.stateAt(time), cues = annotations.annotationCues(state, { cameraSettled: true });
      ensure(annotations.annotationCues(state, { cameraSettled: false }).length === 0, 'Names appeared while the camera was unsettled.');
      ensure(cues.length <= 2, 'Shared renderer supports at most two retained names per scene.');
      for (const cue of cues) ensure(ids.has(cue.id) && cue.opacity >= 0 && cue.opacity <= 1 && Number.isFinite(cue.opacity), 'Invalid annotation cue.');
      for (const cue of appearanceCues(state, cues)) ensure(ids.has(cue.id) && Number.isFinite(cue.weight) && cue.weight >= 0 && cue.weight <= 1, 'Invalid appearance cue.');
      for (const id of ids) { const alpha = presentationOpacity?.(state, id) ?? 1; ensure(Number.isFinite(alpha) && alpha >= 0 && alpha <= 1, 'Invalid presentation opacity.'); }
    }
  });
  check('authored-camera-envelope', () => {
    const aspects = [16 / 9, 1, 9 / 16];
    for (const chapter of plan.chapters) for (const aspect of aspects) {
      const view = framing.cameraFor(chapter.id, aspect, 0), camera = plan.cameras[chapter.id];
      ensure(vector(view.position, 3) && vector(view.target, 3) && Number.isFinite(view.halfHeight) && view.halfHeight > 0, 'Invalid camera pose.');
      const z = new Vector3(...view.position).sub(new Vector3(...view.target));
      ensure(z.length() > 1e-12, 'Camera position must differ from its target.'); z.normalize();
      const x = new Vector3().crossVectors(new Vector3(...(camera.up ?? [0, 1, 0])), z);
      ensure(x.length() > 1e-12, 'Camera up must not be parallel to its view direction.'); x.normalize();
      const y = new Vector3().crossVectors(z, x).normalize();
      const fill = camera.narrow && aspect < camera.narrow.belowAspect ? camera.narrow : camera;
      for (let mask = 0; mask < 8; mask++) {
        const corner = new Vector3(...view.target.map((n, i) => (mask & (1 << i) ? camera.bounds.max[i] : camera.bounds.min[i]) - n));
        ensure(Math.abs(corner.dot(x)) <= view.halfHeight * aspect * fill.fillX + 1e-9 && Math.abs(corner.dot(y)) <= view.halfHeight * fill.fillY + 1e-9, `Authored envelope is cropped in ${chapter.id} at aspect ${aspect}.`);
      }
    }
    return { aspects, scope: 'Authored envelopes only; moving geometry containment and label overlap need visual review.' };
  });
  check('source-records-unchanged', () => ensure(hash({ index, source, score }) === before, 'Sampling modified source/index/score records.'));
  if (score !== undefined) check('score-timeline-metadata', () => {
    ensure(typeof index.geometryRevision === 'string' && index.geometryRevision.length > 0 && score?.geometryRevision === index.geometryRevision, 'Score geometry revision does not match the scene index.');
    ensure(Number.isInteger(score.sampleRate) && score.sampleRate > 0, 'Score sample rate must be a positive integer.');
    ensure(Number.isFinite(score.bpm) && score.bpm > 0 && score.bpm === timeline.BPM, 'Score tempo does not match the presentation timeline.');
    ensure(Number.isFinite(score.durationSeconds) && Math.abs(score.durationSeconds - duration) <= 1 / score.sampleRate, 'Score duration does not match the presentation timeline.');
    return 'Metadata only: matching geometry revision, tempo and duration; the browser separately verifies the WAV hash and decoded duration.';
  });
  return {
    schemaVersion: 'mechanism-presentation-check-1', example, geometryRevision: index.geometryRevision,
    status: checks.some(check => check.status === 'failed') ? 'failed' : 'automated-passed',
    inputHashes,
    durationSeconds: duration, samples: { rate: sampleRate, count: samples.length }, checks,
    manualReview: { status: 'pending', required: ['Full loop in a real browser, including camera transitions and return to the first scene.', 'Phone-sized labels, short leaders, overlap and framing.', 'Actual exported video and music sync if a video is delivered.'] },
  };
}

export async function checkExample(example) {
  ensure(Object.hasOwn(registry, example), `Supported examples: ${Object.keys(registry).join(', ')}.`);
  const entry = registry[example], base = `examples/${example}`;
  const read = async name => JSON.parse(await readFile(await checkedPath(`${base}/${name}`), 'utf8'));
  const [index, source, score] = await Promise.all([read('assets/scene-index.json'), read(entry.source), read('audio/music-score.json')]);
  const presentation = entry.factory(index);
  return inspectPresentation({ example, index, source, score, presentation });
}

export function parseArguments(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help') { options.help = true; continue; }
    ensure(['--example', '--output'].includes(flag), `Unknown argument: ${flag}`);
    const key = flag.slice(2); ensure(!Object.hasOwn(options, key), `Duplicate ${flag}.`);
    const value = argv[++i]; ensure(value && !value.startsWith('--'), `Missing ${flag} value.`); options[key] = value;
  }
  if (!options.help) { ensure(Object.hasOwn(registry, options.example), `Select --example ${Object.keys(registry).join(', ')}.`); ensure(options.output?.endsWith('.json'), '--output must name a project-local output/*.json file.'); }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) console.log(`node tools/study/check-presentation.mjs --example ${Object.keys(registry).join('|')} --output output/presentation-checks/report.json\nNumerical checks only. Visual/media review remains pending.`);
    else {
      const output = await checkedPath(options.output, { output: true });
      const report = await checkExample(options.example);
      await mkdir(dirname(output), { recursive: true });
      // Recheck after directory creation before writing through a changed link.
      await checkedPath(options.output, { output: true });
      await writeFile(output, JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify({ example: options.example, status: report.status, report: options.output, manualReview: report.manualReview.status }));
      if (report.status === 'failed') process.exitCode = 1;
    }
  } catch (error) { console.error(`Presentation check: ${error.message}`); process.exitCode = 1; }
}
