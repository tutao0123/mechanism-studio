import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Matrix4, OrthographicCamera, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCameraDirector } from '../../../showcase/camera-director.mjs';
import { bindAssembly, applyWorkingPoses, applyDisplayExplosion } from '../../../shared/viewer/scene.mjs';
import { placeAnnotation, moveAnnotation } from '../../../shared/viewer/annotation-layout.mjs';
import { createRobotJointRig } from '../joints.mjs';
import { createKineticStory } from '../story.mjs';
import { createKineticFraming, DETAIL_ORBIT } from '../framing.mjs';
import { createKineticAnnotations, NAME_FADE_SECONDS, SCENE_FADE_SECONDS } from '../annotations.mjs';

const index = JSON.parse(await readFile(new URL('../../planning/scene-index.json', import.meta.url), 'utf8'));
const source = JSON.parse(await readFile(new URL('../../assets/source-assembly.json', import.meta.url), 'utf8'));
const rig = createRobotJointRig(source, index), story = createKineticStory(index);
const framing = createKineticFraming(index, story, rig), annotations = createKineticAnnotations(story);
const ASPECTS = [390 / 844, 1, 16 / 9, 2.4];
const seconds = beat => beat * 60 / story.BPM;
const points = bounds => [bounds.min.x ?? bounds.min[0], bounds.max.x ?? bounds.max[0]].flatMap(x =>
  [bounds.min.y ?? bounds.min[1], bounds.max.y ?? bounds.max[1]].flatMap(y =>
    [bounds.min.z ?? bounds.min[2], bounds.max.z ?? bounds.max[2]].map(z => new Vector3(x, y, z))));
const toBox = bounds => new Box3(new Vector3(...bounds.min), new Vector3(...bounds.max));
function cameraForPose(pose, aspect) {
  const camera = new OrthographicCamera(-pose.halfHeight * aspect, pose.halfHeight * aspect, pose.halfHeight, -pose.halfHeight, .00001, 1000);
  camera.position.fromArray(pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld(true);
  return camera;
}
function checkFits(bounds, pose, aspect, label, horizontal = .80000001, vertical = .86000001) {
  const camera = cameraForPose(pose, aspect);
  for (const point of points(bounds)) {
    const ndc = point.project(camera);
    assert.ok(Math.abs(ndc.x) <= horizontal && Math.abs(ndc.y) <= vertical && Math.abs(ndc.z) <= 1, `${label}: (${ndc.x}, ${ndc.y}, ${ndc.z})`);
  }
}
async function actualAssembly() {
  const bytes = await readFile(new URL('../../assets/robot.glb', import.meta.url));
  const contract = JSON.parse(await readFile(new URL('../../assets/scene-contract.json', import.meta.url), 'utf8'));
  const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return { scene: asset.scene, ...bindAssembly(asset.scene, { contract }) };
}
function applyActualFrame(assembly, state) {
  const offsets = story.localDisplayOffsets(index, state.offsetsWorld, Matrix4, Vector3);
  applyWorkingPoses(assembly.parts, Object.fromEntries(rig.posesAt(state.jointValues)), { target: 'model' });
  applyDisplayExplosion(assembly.parts, 1, binding => offsets.get(binding.id));
  assembly.scene.updateMatrixWorld(true);
}
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

test('kinetic cut binds actual source link identities and a separate 48-beat loop', () => {
  assert.equal(story.BPM, 112); assert.equal(story.TOTAL_BEATS, 48);
  assert.equal(story.DURATION, 25.714285714285715);
  assert.deepEqual(Object.keys(story.stateAt(0).jointValues), rig.jointNames);
  assert.deepEqual(Object.keys(story.MAXIMUM_OFFSETS).sort(), index.parts.map(part => part.id).sort());
  const used = story.GROUPS.flatMap(group => group.ids);
  assert.equal(new Set(used).size, 7);
  assert.deepEqual(used.slice().sort(), index.parts.filter(part => part.id !== 'urdf:base_link').map(part => part.id).sort());
  for (const chapter of story.CHAPTERS) for (const [id] of chapter.labels) assert.ok(index.parts.some(part => part.id === id));
  assert.deepEqual(story.CHAPTERS.map(chapter => [chapter.id, chapter.firstBeat, chapter.lastBeat]), [
    ['grasp', 0, 4], ['reach', 4, 10], ['open', 10, 18], ['wrist', 18, 25],
    ['jaws', 25, 32], ['return', 32, 40], ['resolve', 40, 44], ['loop', 44, 48],
  ]);
});

test('native working poses stay within source limits and are exactly zero throughout editorial explosion', () => {
  const before = JSON.stringify({ index, source }), seen = new Set();
  for (let i = 0; i <= 3600; i++) {
    const state = story.stateAt(story.DURATION * i / 3600);
    const resolved = rig.resolvedValuesAt(state.jointValues);
    assert.equal(state.jointValues.clamp2, state.jointValues.clamp1 === 0 ? 0 : -state.jointValues.clamp1);
    assert.ok(Object.values(resolved).every(Number.isFinite));
    for (const [name, value] of Object.entries(state.jointValues)) if (value !== 0) seen.add(name);
    const exploded = Object.values(state.progress).some(progress => progress > 0);
    if (exploded) assert.ok(Object.values(state.jointValues).every(value => value === 0), `${state.time}: working and editorial pose overlap`);
    if (Object.values(state.jointValues).some(value => value !== 0)) assert.ok(Object.values(state.offsetsWorld).flat().every(value => value === 0));
  }
  assert.ok(seen.has('clamp1') && seen.has('clamp2') && seen.has('base_to_link1') && seen.has('link1_to_link2') && seen.has('link2_to_link3') && seen.has('link4_to_link5'));
  assert.equal(JSON.stringify({ index, source }), before);
});

test('absolute seeking, reverse seeking and the loop restore the same joint and explosion values', () => {
  const requested = [.1, 1.2, 2.4, 4.1, 7.8, 10.6, 14.6, 17.4, 20.9, 23.1, 25.6];
  const snapshots = new Map(requested.map(time => [time, story.stateAt(time)]));
  for (const time of [...requested].reverse()) {
    assert.deepEqual(story.stateAt(time), snapshots.get(time));
    for (const name of rig.jointNames) assert.ok(Math.abs(story.stateAt(time + story.DURATION).jointValues[name] - snapshots.get(time).jointValues[name]) < 1e-12);
    for (const id of Object.keys(story.MAXIMUM_OFFSETS)) for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(story.stateAt(time - story.DURATION).offsetsWorld[id][axis] - snapshots.get(time).offsetsWorld[id][axis]) < 1e-12);
  }
  assert.deepEqual(story.stateAt(0), story.stateAt(story.DURATION));
  const zero = story.stateAt(0), last = story.stateAt(story.DURATION - 1e-6);
  assert.deepEqual(last.jointValues, zero.jointValues); assert.deepEqual(last.offsetsWorld, zero.offsetsWorld);
  for (const aspect of ASPECTS) assert.deepEqual(framing.cameraFor('grasp', aspect), framing.cameraFor('loop', aspect, 1.9));
});

test('dense source forward-kinematics bounds fit the fixed working and macro plans', () => {
  const envelopes = framing.envelopes;
  assert.ok(envelopes.grasp.getSize(new Vector3()).length() < envelopes.reach.getSize(new Vector3()).length() * .5, 'macro does not inherit the arm reach sweep');
  for (const chapterId of ['grasp', 'reach', 'resolve']) {
    const chapter = story.CHAPTERS.find(value => value.id === chapterId);
    const duration = seconds(chapter.lastBeat - chapter.firstBeat), partIds = story.details[chapterId] ?? index.parts.map(part => part.id);
    for (let sample = 0; sample <= Math.ceil(duration * 240); sample++) {
      const time = seconds(chapter.firstBeat) + Math.min(duration - 1e-7, sample / 240), state = story.stateAt(time);
      const actual = rig.boundsAt(state.jointValues);
      for (const id of partIds) {
        const bounds = actual.get(id);
        for (const point of points(bounds)) assert.ok(envelopes[chapterId].containsPoint(point), `${chapterId}: ${id} escaped sampled guard`);
        if (sample % 8 === 0) for (const aspect of ASPECTS) checkFits(bounds, framing.cameraFor(chapterId, aspect, state.localTime), aspect, `${chapterId}: ${id}`);
      }
    }
    for (const aspect of ASPECTS) assert.deepEqual(framing.cameraFor(chapterId, aspect, 0), framing.cameraFor(chapterId, aspect, duration - 1e-7));
  }
  assert.match(framing.boundsMethod, /120 Hz/); assert.match(framing.boundsMethod, /not a continuous sweep or collision certificate/);
});

test('actual independent explosion offsets fit full sweeps and every settled detail arc', () => {
  for (const chapterId of ['open', 'wrist', 'jaws', 'return']) {
    const chapter = story.CHAPTERS.find(value => value.id === chapterId), duration = seconds(chapter.lastBeat - chapter.firstBeat);
    const ids = story.details[chapterId] ?? index.parts.map(part => part.id);
    for (let i = 0; i <= 180; i++) {
      const state = story.stateAt(seconds(chapter.firstBeat) + Math.min(duration - 1e-7, duration * i / 180));
      for (const id of ids) {
        const part = index.parts.find(part => part.id === id);
        const bounds = toBox(part.worldBounds).translate(new Vector3(...state.offsetsWorld[id]));
        for (const point of points(bounds)) assert.ok(framing.envelopes[chapterId].containsPoint(point));
        if (i % 5 === 0) for (const aspect of ASPECTS) checkFits(bounds, framing.cameraFor(chapterId, aspect, state.localTime), aspect, `${chapterId}: ${id}`, story.details[chapterId] ? .74000001 : .80000001, story.details[chapterId] ? .84000001 : .86000001);
      }
    }
  }
});

test('detail camera arc finishes before labels; names persist together and fade with the scene', () => {
  assert.ok(DETAIL_ORBIT.degrees >= 12 && DETAIL_ORBIT.degrees <= 18);
  for (const chapterId of ['wrist', 'jaws']) {
    const chapter = story.CHAPTERS.find(value => value.id === chapterId), start = seconds(chapter.firstBeat), duration = seconds(chapter.lastBeat - chapter.firstBeat);
    assert.ok(DETAIL_ORBIT.endSeconds < annotations.CUE_WINDOWS[chapterId][0][0]);
    for (const aspect of ASPECTS) {
      const settled = framing.cameraFor(chapterId, aspect, DETAIL_ORBIT.endSeconds);
      assert.deepEqual(framing.annotationCameraFor(chapterId, aspect), settled);
      for (const localTime of [1.15, 2.5, duration - .01]) assert.deepEqual(framing.cameraFor(chapterId, aspect, localTime), settled);
      const startDirection = new Vector3(...framing.cameraFor(chapterId, aspect, 0).position).sub(new Vector3(...settled.target)).normalize();
      const endDirection = new Vector3(...settled.position).sub(new Vector3(...settled.target)).normalize();
      const angle = startDirection.angleTo(endDirection) * 180 / Math.PI;
      assert.ok(angle > 12 && angle <= DETAIL_ORBIT.degrees + 1e-9);
    }
    const cueAt = local => annotations.annotationCues(story.stateAt(start + local));
    assert.deepEqual(cueAt(1.14), []);
    assert.equal(cueAt(1.15 + NAME_FADE_SECONDS + .01).length, 1);
    const retained = cueAt(2.5 + NAME_FADE_SECONDS + .01);
    assert.equal(retained.length, 2); assert.ok(retained.every(cue => cue.opacity === 1));
    const leaving = cueAt(duration - SCENE_FADE_SECONDS / 2);
    assert.equal(leaving.length, 2); assert.ok(leaving.every(cue => Math.abs(cue.opacity - .5) < 1e-12));
    assert.deepEqual(annotations.annotationCues(story.stateAt(start + 3), { cameraSettled: false }), []);
    assert.ok(annotations.annotationCues(story.stateAt(start + duration - .01), { paused: true }).every(cue => cue.opacity === 1));
    assert.deepEqual(cueAt(duration + .01), []);
  }
});

test('source-solid membership cuts and whole-assembly camera transitions fit every 60 Hz sample', () => {
  assert.deepEqual(story.CAMERA_CUTS, ['reach', 'wrist', 'jaws', 'return', 'loop']);
  assert.ok(Object.isFrozen(story.CAMERA_CUTS));
  const visibleIds = state => (story.detailIds(state) ?? index.parts.map(part => part.id)).slice().sort();
  for (const chapter of story.CHAPTERS) {
    const boundary = seconds(chapter.firstBeat), before = visibleIds(story.stateAt(boundary - 1e-6)), after = visibleIds(story.stateAt(boundary));
    assert.equal(story.CAMERA_CUTS.includes(chapter.id), JSON.stringify(before) !== JSON.stringify(after), `${chapter.id}: cut only when source-solid membership changes`);
  }
  for (const aspect of ASPECTS) {
    const director = createCameraDirector({ duration: .55 });
    let transitionCount = 0, previousChapter = null;
    for (let i = 0; i <= Math.ceil(story.DURATION * 60); i++) {
      const state = story.stateAt(Math.min(i / 60, story.DURATION)), planned = framing.cameraFor(state.chapter.id, aspect, state.localTime);
      if (previousChapter !== null && previousChapter !== state.chapter.id) transitionCount++;
      const changed = previousChapter !== null && previousChapter !== state.chapter.id;
      const cut = changed && story.CAMERA_CUTS.includes(state.chapter.id);
      const input = { chapterKey: state.chapter.id, localTime: state.localTime, pose: planned, cut };
      const actual = director.sample(input), again = director.sample({ ...input, cut: false });
      assert.deepEqual(again, actual, 'pause repeats the identical chapter time without camera drift');
      assert.ok([...actual.position, ...actual.target, actual.halfHeight].every(Number.isFinite));
      assert.ok(new Vector3(...actual.position).distanceTo(new Vector3(...actual.target)) > .001);
      if (!director.snapshot().transitioning) assert.deepEqual(actual, planned);
      if (cut) assert.deepEqual(actual, planned, 'solid membership and camera framing change on the same frame');
      const native = rig.boundsAt(state.jointValues), ids = story.detailIds(state) ?? index.parts.map(part => part.id);
      for (const id of ids) {
        const bounds = toBox(native.get(id)).translate(new Vector3(...state.offsetsWorld[id]));
        checkFits(bounds, actual, aspect, `${state.chapter.id} @${state.time}: ${id}`);
      }
      previousChapter = state.chapter.id;
    }
    assert.equal(transitionCount, 8, 'all chapter boundaries, including the end-to-opening seam, were sampled');
  }
});

test('invalid source bindings and camera values fail; returned envelope mutation cannot reframe the study', () => {
  assert.throws(() => createKineticStory({ ...index, units: 'mm' }), /actual robot index in metres/);
  assert.throws(() => createKineticStory({ ...index, parts: index.parts.slice(1) }), /eight retained source links/);
  for (const value of [NaN, Infinity, -Infinity]) assert.throws(() => story.stateAt(value), /finite/);
  for (const aspect of [0, -1, NaN, Infinity]) assert.throws(() => framing.cameraFor('wrist', aspect), /Finite positive/);
  assert.throws(() => framing.cameraFor('invented', 1.8), /Unknown kinetic chapter/);
  assert.throws(() => framing.cameraFor('wrist', 1.8, -.01), /non-negative/);
  const expected = framing.cameraFor('wrist', 1.8);
  framing.envelopes.wrist.expandByScalar(10);
  const returned = framing.cameraFor('wrist', 1.8); returned.target[0] += 999;
  assert.deepEqual(framing.cameraFor('wrist', 1.8), expected);
});

test('actual GLB binding composes working and display layers over 257 timeline samples without rewriting source rest', async t => {
  const assembly = await actualAssembly();
  const original = new Map([...assembly.parts].map(([id, binding]) => [id, binding.node.matrix.toArray()]));
  let maxError = 0, snapshots = 0;
  for (let sample = 0; sample < 257; sample++) {
    const state = story.stateAt(sample * .1);
    applyActualFrame(assembly, state);
    const expected = rig.worldMatricesAt(state.jointValues);
    for (const [id, binding] of assembly.parts) {
      const world = expected.get(id).slice();
      for (let axis = 0; axis < 3; axis++) world[12 + axis] += state.offsetsWorld[id][axis];
      binding.node.matrixWorld.elements.forEach((value, element) => { maxError = Math.max(maxError, Math.abs(value - world[element])); });
      assert.deepEqual(binding.node.matrix.toArray(), original.get(id), `${sample}: immutable source rest ${id}`);
      snapshots++;
    }
  }
  assert.equal(snapshots, 2056); assert.ok(maxError < 1e-12, `Actual nested viewer composition disagrees with source FK + world offsets: ${maxError}`);
  t.diagnostic(`257 sequential samples, ${snapshots} source-node snapshots, maximum world-matrix error ${maxError}`);
});

test('actual projected detail vertices support near-part labels in settled and reduced desktop/mobile plans', async t => {
  const assembly = await actualAssembly(), counts = {};
  for (const [width, height] of [[1280, 640], [364, 410]]) for (const reduced of [false, true]) for (const chapterId of ['wrist', 'jaws']) {
    const chapter = story.CHAPTERS.find(value => value.id === chapterId), duration = seconds(chapter.lastBeat - chapter.firstBeat);
    const state = story.stateAt(seconds(chapter.firstBeat) + 1.151), visible = story.detailIds(state);
    applyActualFrame(assembly, state);
    const plan = reduced ? framing.cameraFor(chapterId, width / height, 0) : framing.annotationCameraFor(chapterId, width / height);
    const camera = cameraForPose(plan, width / height);
    const project = world => {
      const ndc = world.clone().project(camera);
      return { x: (ndc.x + 1) * width / 2, y: (1 - ndc.y) * height / 2, z: ndc.z, world };
    };
    const clouds = new Map(visible.map(id => [id, []]));
    for (const mesh of assembly.meshes) {
      const id = mesh.userData.selectionId;
      if (!clouds.has(id)) continue;
      const vertices = mesh.geometry.getAttribute('position');
      for (let vertex = 0; vertex < vertices.count; vertex++) clouds.get(id).push(project(new Vector3().fromBufferAttribute(vertices, vertex).applyMatrix4(mesh.matrixWorld)));
    }
    const exclusions = new Map(visible.map(id => {
      const part = index.parts.find(part => part.id === id), projected = [];
      // Match the study runtime's conservative other-body chapter exclusions.
      for (const time of [seconds(chapter.firstBeat), seconds(chapter.lastBeat) - 1e-6]) {
        const offset = new Vector3(...story.stateAt(time).offsetsWorld[id]);
        projected.push(...points(part.worldBounds).map(point => project(point.add(offset))));
      }
      const xs = projected.map(point => point.x), ys = projected.map(point => point.y);
      return [id, { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }];
    }));
    const retained = [], creditWidth = Math.min(260, width - 24);
    // Font widths below are conservative character estimates, as in the old
    // source-vertex test. Browser-rendered type/credit measurements remain a
    // separate visual check; this test does not claim font/layout certification.
    const credit = { x: width - 12 - creditWidth, y: height - 8 - 30, width: creditWidth, height: 30 };
    for (const [labelIndex, [id, text]] of chapter.labels.entries()) {
      const obstacles = [credit, ...[...exclusions].filter(([other]) => other !== id).map(([, rect]) => rect), ...retained.map(record => record.layout.rect)];
      const input = { points: clouds.get(id), width, height, textWidth: text.length * (width < 540 ? 6 : 7), textHeight: width < 540 ? 20 : 24, obstacles, preferredSide: labelIndex ? 'right' : 'left' };
      const layout = placeAnnotation(input);
      if (!layout) continue; // Report any omitted cue; never force a distant or obstructed placement.
      const anchor = input.points.find(point => point.x === layout.anchor.x && point.y === layout.anchor.y);
      assert.ok(anchor, 'Leader starts at an actual retained mesh vertex');
      assert.ok(layout.leaderLength > 0 && layout.leaderLength <= (width < 540 ? 10 : 15) + 1e-9);
      assert.ok(layout.rect.x >= 9 && layout.rect.y >= 9 && layout.rect.x + layout.rect.width <= width - 9 && layout.rect.y + layout.rect.height <= height - 9);
      assert.ok(!obstacles.some(rect => overlaps(layout.rect, rect)), `${chapterId}: type avoids bodies, prior names and source credit`);
      retained.push({ layout, worldAnchor: anchor.world });
    }
    const key = `${width}x${height}/${reduced ? 'reduced' : 'settled'}/${chapterId}`;
    counts[key] = retained.length;
    for (const localTime of [2.8, 3.1, duration - .1]) {
      const currentPlan = framing.cameraFor(chapterId, width / height, reduced ? 0 : localTime), currentCamera = cameraForPose(currentPlan, width / height);
      const moved = retained.map(record => {
        const ndc = record.worldAnchor.clone().project(currentCamera);
        return moveAnnotation(record.layout, { x: (ndc.x + 1) * width / 2, y: (1 - ndc.y) * height / 2 });
      });
      for (const [i, layout] of moved.entries()) {
        const original = retained[i].layout;
        assert.equal(layout.side, original.side); assert.equal(layout.rect.width, original.rect.width); assert.equal(layout.rect.height, original.rect.height);
        assert.ok(Math.abs(Math.hypot(layout.end.x - layout.anchor.x, layout.end.y - layout.anchor.y) - original.leaderLength) < 1e-9);
        assert.ok(layout.rect.x >= 5 && layout.rect.y >= 5 && layout.rect.x + layout.rect.width <= width - 5 && layout.rect.y + layout.rect.height <= height - 5, `${key}: retained type remains onscreen`);
        for (let j = i + 1; j < moved.length; j++) assert.ok(!overlaps(layout.rect, moved[j].rect), `${key}: retained labels do not overlap`);
      }
    }
  }
  t.diagnostic(`Actual geometry readable cue counts (out of two): ${JSON.stringify(counts)}`);
  for (const [key, count] of Object.entries(counts)) assert.equal(count, 2, `${key}: two readable local labels`);
});
