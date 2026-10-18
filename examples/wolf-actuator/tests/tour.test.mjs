import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Vector3, Matrix4, OrthographicCamera } from 'three';
import { createWolfTourStory, localDisplayOffsets } from '../tour/story.mjs';
import { createWolfTourFraming, CAMERA_UP } from '../tour/framing.mjs';
import { createWolfTourAnnotations } from '../tour/annotations.mjs';
import { createWolfWorkingMotion } from '../tour/kinematics.mjs';
const read = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const index = await read('../assets/scene-index.json'), before = JSON.stringify(index), story = createWolfTourStory(index), rig = createWolfWorkingMotion(index), framing = createWolfTourFraming(index, story, rig), annotations = createWolfTourAnnotations(story), sec = beat => beat * 60 / story.BPM;
const corners = bounds => [bounds.min[0], bounds.max[0]].flatMap(x => [bounds.min[1], bounds.max[1]].flatMap(y => [bounds.min[2], bounds.max[2]].map(z => new Vector3(x, y, z))));
function primaryIds(state) {
  if (state.scope === 'motor') return state.studyState.chapter.id === 'magnet' ? [story.bindings.motorMagnet] : state.studyState.chapter.id === 'repeats' ? [...story.bindings.motor.magnets, ...story.bindings.motor.cc] : story.bindings.motor.motorParts;
  if (state.scope === 'bearing') return state.studyState.chapter.id === 'component' ? [story.bindings.bearingPart] : state.studyState.chapter.id === 'repeats' ? story.bindings.bearing.smallParts : story.bindings.bearing.bearingParts;
  if (state.chapter.id === 'motion') return state.beat < 26 ? framing.motionPrimaryIds : story.bindings.motor.motorParts;
  if (state.chapter.id === 'transfer' && state.beat >= 68.5) return story.bindings.bearing.bearingParts;
  return index.parts.map(part => part.id);
}
function camera(pose, aspect) { const result = new OrthographicCamera(-pose.halfHeight * aspect, pose.halfHeight * aspect, pose.halfHeight, -pose.halfHeight, .0001, 1000); result.up.fromArray(CAMERA_UP); result.position.fromArray(pose.position); result.lookAt(new Vector3(...pose.target)); result.updateMatrixWorld(true); return result; }

test('one native 245-leaf scene composes whole/local observation and restores each level independently', () => {
  assert.equal(story.DURATION, 480 / 7); assert.equal(story.TOTAL_BEATS, 128); assert.equal(story.BPM, 112);
  assert.equal(story.bindings.motor.motorParts.length, 86); assert.equal(story.bindings.bearing.bearingParts.length, 70);
  for (const beat of [0, 9, 22, 31, 45, 55, 66, 70, 76, 89, 101, 110, 118, 126]) {
    const state = story.stateAt(sec(beat)); assert.equal(Object.keys(state.offsetsWorld).length, 245);
    for (const part of index.parts) assert.deepEqual(state.offsetsWorld[part.id], state.macroOffsetsWorld[part.id].map((value, axis) => value + state.localOffsetsWorld[part.id][axis]));
    const records = new Map([...index.assemblies, ...index.parts].map(part => [part.id, part])), residuals = localDisplayOffsets(index, state.offsetsWorld, Matrix4, Vector3);
    for (const part of index.parts) { const matrix = new Matrix4().fromArray(records.get(part.parentId).worldMatrix), worldDelta = new Vector3(...residuals.get(part.id)).applyMatrix4(matrix).sub(new Vector3().applyMatrix4(matrix)); assert.ok(worldDelta.distanceTo(new Vector3(...state.offsetsWorld[part.id])) < 1e-12); }
    const expected = structuredClone(state); story.stateAt(sec(beat + 73)); assert.deepEqual(story.stateAt(sec(beat)), expected);
  }
  for (const beat of [66, 72, 110]) { const state = story.stateAt(sec(beat)); assert.ok(Object.values(state.localOffsetsWorld).flat().every(value => value === 0)); assert.deepEqual(state.macroOffsetsWorld, story.MACRO_MAXIMUM_OFFSETS, 'component reset retains whole expansion'); }
  assert.ok(Object.values(story.stateAt(sec(123)).offsetsWorld).flat().every(value => value === 0)); assert.deepEqual(story.stateAt(story.DURATION), story.stateAt(0)); assert.equal(JSON.stringify(index), before);
});

test('mapped action events, two observation windows and the continuous PCM retain actual identities and time', async () => {
  const ids = new Set(index.parts.map(part => part.id)); assert.equal(story.MOTION_EVENTS.length, 54);
  for (const event of story.MOTION_EVENTS) { assert.ok(event.firstBeat < event.lastBeat); assert.ok(['whole', 'motor', 'bearing'].includes(event.scope)); for (const id of event.partIds) assert.ok(ids.has(id)); }
  for (const scope of Object.values(story.SCOPES)) for (const value of [6, 13, 28, 31, 38, 47, 60]) assert.ok(Math.abs(story.unmapStudyBeat(scope, story.mapStudyBeat(scope, value)) - value) < 1e-12);
  assert.equal(story.mapStudyBeat(story.SCOPES.motor, 28), 42); assert.equal(story.mapStudyBeat(story.SCOPES.motor, 38), 50); assert.equal(story.mapStudyBeat(story.SCOPES.bearing, 28), 86); assert.equal(story.mapStudyBeat(story.SCOPES.bearing, 38), 94);
  const plan = await read('../tour/plan.json'), score = await read('../tour/music-score.json'), wav = await readFile(new URL('../tour/audio/tour-loop.wav', import.meta.url));
  assert.deepEqual(plan.motionEvents, story.MOTION_EVENTS); assert.equal(plan.sourcePartCount, 245); assert.equal(score.sha256, createHash('sha256').update(wav).digest('hex')); assert.equal(score.durationSeconds, story.DURATION); assert.equal(score.byteLength, wav.length);
});

test('input turn finishes before camera hand-off and context fades without scope resets', () => {
  const stator = story.substories.motor.bindings.stator, front = story.bindings.whole.front, holder = story.bindings.whole.holder;
  assert.equal(story.stateAt(sec(20)).motionDemoProgress, 0); assert.equal(story.stateAt(sec(26)).motionDemoProgress, 1); assert.equal(story.stateAt(sec(28)).motionDemoProgress, 0);
  assert.deepEqual(rig.workingPoses(story.stateAt(sec(26))), rig.workingPoses(story.stateAt(sec(28))), 'a completed illustrative revolution is exact identity');
  assert.equal(story.opacityFor(story.stateAt(sec(24)), front), 0); assert.equal(story.opacityFor(story.stateAt(sec(24)), holder), 1); assert.equal(story.opacityFor(story.stateAt(sec(29)), holder), 0); assert.equal(story.opacityFor(story.stateAt(sec(29)), stator), 1);
  for (const beat of [20, 22, 26, 28, 66, 68.5, 71.5, 72, 110, 124]) for (const id of [front, holder, stator, story.bindings.bearingPart]) { const a = story.stateAt(sec(beat - 1e-7)), b = story.stateAt(sec(beat + 1e-7)); assert.ok(Math.abs(story.opacityFor(a, id) - story.opacityFor(b, id)) < 1e-7); }
  for (let beat = 0; beat < 128; beat += .37) { const state = story.stateAt(sec(beat)); for (const part of index.parts) { const alpha = story.opacityFor(state, part.id); assert.ok(alpha >= 0 && alpha <= 1); } }
});

test('whole, rotating input and both component paths stay in frame on three aspects, with continuous joins', () => {
  const rest = rig.boundsAt(0), frames = Array.from({ length: Math.ceil(story.DURATION * 30) }, (_, frame) => { const state = story.stateAt(frame / 30); return { state, bounds: state.motionDemoProgress > 0 && state.motionDemoProgress < 1 ? rig.boundsAt(state.motionDemoProgress) : rest }; });
  for (const aspect of [364 / 410, 16 / 9, 2.5]) {
    assert.deepEqual(framing.cameraFor('overview', aspect), framing.cameraFor('resolve', aspect, 1));
    for (const beat of [...story.CHAPTERS.slice(1).map(chapter => chapter.firstBeat), 11, 23, 26, 68.5, 122]) { const a = story.stateAt(sec(beat - 1e-7)), b = story.stateAt(sec(beat + 1e-7)), ca = framing.cameraFor(a.chapter.id, aspect, a.localTime), cb = framing.cameraFor(b.chapter.id, aspect, b.localTime); assert.ok(new Vector3(...ca.target).distanceTo(new Vector3(...cb.target)) < 1e-7); assert.ok(new Vector3(...ca.position).distanceTo(new Vector3(...cb.position)) < 1e-7); assert.ok(Math.abs(ca.halfHeight - cb.halfHeight) < 1e-7); }
    for (const { state, bounds } of frames) { const using = camera(framing.cameraFor(state.chapter.id, aspect, state.localTime), aspect); for (const id of primaryIds(state)) { const delta = new Vector3(...state.offsetsWorld[id]); for (const point of corners(bounds.get(id))) { const p = point.add(delta).project(using); assert.ok(Math.abs(p.x) <= .98 && Math.abs(p.y) <= .98 && Math.abs(p.z) <= 1, `${state.chapter.id} ${id} at ${state.time.toFixed(3)}s / ${aspect}: ${p.toArray()}`); } } }
  }
  assert.equal(JSON.stringify(index), before);
});

test('labels remain on stationary source targets and each settled macro leaves over 1.4 seconds fully readable', () => {
  assert.deepEqual(annotations.CUE_WINDOWS.motion, []);
  for (const id of ['motor-magnet', 'bearing-component']) { const [first, last] = annotations.CUE_WINDOWS[id][0]; assert.ok(last - first - .16 - .20 >= 1.4); }
  for (let time = 0; time < story.DURATION; time += .037) { const state = story.stateAt(time), cues = annotations.annotationCues(state); assert.ok(cues.length <= 1); for (const cue of cues) { assert.ok(story.opacityFor(state, cue.id) >= .5); const a = story.stateAt(time - 1e-6), b = story.stateAt(time + 1e-6); assert.ok(new Vector3(...a.offsetsWorld[cue.id]).distanceTo(new Vector3(...b.offsetsWorld[cue.id])) < 1e-11); const ca = framing.cameraFor(a.chapter.id, 16 / 9, a.localTime), cb = framing.cameraFor(b.chapter.id, 16 / 9, b.localTime); assert.ok(new Vector3(...ca.target).distanceTo(new Vector3(...cb.target)) < 1e-11 && Math.abs(ca.halfHeight - cb.halfHeight) < 1e-11, `${state.chapter.id}: camera settles before a name`); } }
});
