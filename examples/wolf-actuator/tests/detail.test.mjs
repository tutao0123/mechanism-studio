import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Vector3, Matrix4, OrthographicCamera, Box3 } from 'three';
import { createWolfMotorDetail, localDisplayOffsets } from '../detail/story.mjs';
import { createWolfMotorFraming, CAMERA_UP } from '../detail/framing.mjs';
import { createWolfMotorAnnotations } from '../detail/annotations.mjs';
import { readGlb, accessorValues } from '../../../shared/assets/glb.mjs';
import { placeAnnotation } from '../../../shared/viewer/annotation-layout.mjs';
const read = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const index = await read('../assets/scene-index.json'), manifest = await read('../assets/assembly-manifest.json'), story = createWolfMotorDetail(index), annotations = createWolfMotorAnnotations(story), framing = createWolfMotorFraming(index, story);
const sec = beat => beat * 60 / story.BPM, sourceBefore = JSON.stringify(index);
const corners = bounds => [bounds.min[0], bounds.max[0]].flatMap(x => [bounds.min[1], bounds.max[1]].flatMap(y => [bounds.min[2], bounds.max[2]].map(z => new Vector3(x, y, z))));
function camera(pose, aspect) { const result = new OrthographicCamera(-pose.halfHeight * aspect, pose.halfHeight * aspect, pose.halfHeight, -pose.halfHeight, .0001, 1000); result.up.fromArray(CAMERA_UP); result.position.fromArray(pose.position); result.lookAt(new Vector3(...pose.target)); result.updateMatrixWorld(true); return result; }
function visiblePoints(state, id) { const part = index.parts.find(value => value.id === id), delta = new Vector3(...state.offsetsWorld[id]); return corners(part.worldBounds).map(point => point.add(delta)); }
function assertFits(points, pose, aspect, message, margin = .98) { const using = camera(pose, aspect); for (const point of points) { const projected = point.clone().project(using); assert.ok(Math.abs(projected.x) <= margin && Math.abs(projected.y) <= margin && Math.abs(projected.z) <= 1, `${message}: ${projected.toArray()}`); } }

test('v2 binds native occurrences, partitions repeats by geometry and never invents hardware', () => {
  const occurrences = new Map(manifest.occurrences.map(value => [value.occurrence_id, value]));
  assert.equal(story.PLAN_REVISION, 'wolf-motor-detail-2'); assert.equal(story.bindings.motorParts.length, 86); assert.equal(story.bindings.hardware.length, 6);
  assert.equal(story.bindings.magnets.length, 40); assert.equal(story.bindings.cc.length, 40);
  for (const id of story.bindings.motorParts) assert.equal(occurrences.get(id).parent_id, story.bindings.motor);
  assert.deepEqual(story.bindings.magnetBatches.map(batch => batch.length), [10, 10, 10, 10]); assert.deepEqual(story.bindings.ccBatches.map(batch => batch.length), [10, 10, 10, 10]);
  for (const [batches, ids] of [[story.bindings.magnetBatches, story.bindings.magnets], [story.bindings.ccBatches, story.bindings.cc]]) assert.deepEqual(batches.flat().sort(), [...ids].sort());
  assert.equal(new Set(story.GROUPS.flatMap(group => group.ids)).size, 85); assert.equal(story.MOTION_EVENTS.length, 28);
  for (const event of story.MOTION_EVENTS) { assert.ok(event.endBeat > event.startBeat); assert.deepEqual(event.ids, event.partIds); assert.equal(event.startBeat, event.firstBeat); assert.equal(event.endBeat, event.lastBeat); for (const id of event.ids) assert.ok(story.bindings.motorParts.includes(id)); }
  const reordered = structuredClone(index); reordered.parts.reverse(); const same = createWolfMotorDetail(reordered); assert.deepEqual(same.bindings.magnetBatches, story.bindings.magnetBatches); assert.deepEqual(same.bindings.ccBatches, story.bindings.ccBatches);
  assert.equal(JSON.stringify(index), sourceBefore);
});

test('different durations and angular cascades remain deterministic and restore exact source translations', () => {
  assert.equal(story.DURATION, 240 / 7); assert.equal(story.BPM, 112); assert.equal(story.TOTAL_BEATS, 64); assert.deepEqual(story.stateAt(story.DURATION), story.stateAt(0));
  for (let i = 1; i < story.CHAPTERS.length; i++) assert.equal(story.CHAPTERS[i - 1].lastBeat, story.CHAPTERS[i].firstBeat);
  assert.ok(new Set(story.GROUPS.map(group => group.outEndBeat - group.outBeat)).size >= 3);
  for (let beat = 0; beat < 64; beat += .137) {
    const state = story.stateAt(sec(beat)), before = structuredClone(state); story.stateAt(sec(beat + 17)); assert.deepEqual(story.stateAt(sec(beat)), before);
    for (const part of index.parts) { assert.ok(state.offsetsWorld[part.id].every(Number.isFinite)); if (!story.bindings.motorParts.includes(part.id) || part.id === story.bindings.stator) assert.deepEqual(state.offsetsWorld[part.id], [0, 0, 0]); }
  }
  assert.ok(Object.values(story.stateAt(sec(58)).offsetsWorld).flat().every(value => value === 0));
  const records = new Map([...index.assemblies, ...index.parts].map(part => [part.id, part]));
  for (const beat of [8, 19, 25, 32, 36, 41, 55, 60]) {
    const state = story.stateAt(sec(beat)), local = localDisplayOffsets(index, state.offsetsWorld, Matrix4, Vector3);
    for (const part of index.parts) { const matrix = new Matrix4().fromArray(records.get(part.parentId).worldMatrix), delta = new Vector3(...local.get(part.id)).applyMatrix4(matrix).sub(new Vector3().applyMatrix4(matrix)); assert.ok(delta.distanceTo(new Vector3(...state.offsetsWorld[part.id])) < 1e-12); }
  }
  assert.equal(JSON.stringify(index), sourceBefore);
});

test('the original selected magnet alone receives a reversible inspection translation and its full path is bounded', () => {
  const id = story.bindings.labelMagnet, base = story.MAXIMUM_OFFSETS[id], peak = story.PATH_MAXIMUM_OFFSETS[id];
  assert.equal(id, 'occ-b352183e1bd0-root-953098-1010-926'); assert.deepEqual(peak, base.map((value, axis) => value + story.FOCUS_OFFSET[axis]));
  for (let beat = 28; beat <= 38; beat += .031) {
    const state = story.stateAt(sec(beat));
    for (const other of story.bindings.motorParts) { if (other === id) continue; assert.deepEqual(state.offsetsWorld[other], story.MAXIMUM_OFFSETS[other]); }
    for (const point of visiblePoints(state, id)) assert.ok(framing.envelopes.magnet.containsPoint(point));
  }
  assert.deepEqual(story.stateAt(sec(28)).offsetsWorld[id], base); assert.deepEqual(story.stateAt(sec(32)).offsetsWorld[id], peak); assert.deepEqual(story.stateAt(sec(38)).offsetsWorld[id], base);
  assert.ok(new Vector3(...story.FOCUS_OFFSET).length() > .09); assert.equal(JSON.stringify(index), sourceBefore);
});

test('source context fades continuously, internal ghosts never disappear and every opacity restores at the loop', () => {
  const outside = index.parts.find(part => !story.bindings.motorParts.includes(part.id)).id;
  for (let beat = 0; beat < 64; beat += .11) {
    const state = story.stateAt(sec(beat)); assert.equal(story.detailIds(state), null);
    for (const part of index.parts) { const alpha = story.opacityFor(state, part.id); assert.ok(alpha >= 0 && alpha <= 1); if (story.bindings.motorParts.includes(part.id)) assert.ok(alpha >= .12 - 1e-12); }
    assert.ok(story.labelObstacleIds(state).every(id => story.opacityFor(state, id) >= .5));
  }
  assert.equal(story.opacityFor(story.stateAt(0), outside), 1); assert.equal(story.opacityFor(story.stateAt(sec(8)), outside), 0);
  assert.equal(story.opacityFor(story.stateAt(sec(33)), story.bindings.labelMagnet), 1);
  assert.ok(story.bindings.motorParts.filter(id => id !== story.bindings.labelMagnet).every(id => Math.abs(story.opacityFor(story.stateAt(sec(33)), id) - .12) < 1e-12));
  assert.ok(index.parts.every(part => story.opacityFor(story.stateAt(sec(63.9)), part.id) === 1));
  for (const beat of [4, 6, 16, 18, 28, 31, 35.3, 38, 60, 61.2]) for (const id of [outside, story.bindings.body, story.bindings.labelCc]) assert.ok(Math.abs(story.opacityFor(story.stateAt(sec(beat - 1e-6)), id) - story.opacityFor(story.stateAt(sec(beat + 1e-6)), id)) < 1e-8);
});

test('authored cameras are continuous at all chapter and motion joins, seekable and exactly looped', () => {
  for (const aspect of [364 / 410, 16 / 9, 2.5]) {
    assert.deepEqual(framing.cameraFor('whole', aspect, 0), framing.cameraFor('resolve', aspect, 2));
    const joins = [...story.CHAPTERS.map(chapter => chapter.firstBeat).slice(1), 9, 18, 31, 35.3, 57.4];
    for (const beat of joins) {
      const a = story.stateAt(sec(beat - 1e-7)), b = story.stateAt(sec(beat + 1e-7)), pa = framing.cameraFor(a.chapter.id, aspect, a.localTime), pb = framing.cameraFor(b.chapter.id, aspect, b.localTime);
      for (const key of ['position', 'target']) assert.ok(new Vector3(...pa[key]).distanceTo(new Vector3(...pb[key])) < 1e-7); assert.ok(Math.abs(pa.halfHeight - pb.halfHeight) < 1e-7);
    }
    const macro = framing.cameraFor('magnet', aspect, 2.5), overview = framing.cameraFor('repeats', aspect, 4.5); assert.ok(overview.halfHeight / macro.halfHeight > 5, 'camera magnifies real original geometry');
    for (let beat = 27.9; beat <= 38; beat += .037) { const state = story.stateAt(sec(beat)); assertFits(visiblePoints(state, story.bindings.labelMagnet), framing.cameraFor(state.chapter.id, aspect, state.localTime), aspect, `Macro path at beat ${beat}`); }
    for (let beat = 28; beat <= 38; beat += .2) assertFits(visiblePoints(story.stateAt(sec(beat)), story.bindings.labelMagnet), framing.stillCameraFor('magnet', aspect, sec(beat - 28)), aspect, 'Reduced-motion path');
    const wide = framing.stillCameraFor('magnet', aspect, 0), close = framing.stillCameraFor('magnet', aspect, sec(4));
    assert.deepEqual(wide, framing.stillCameraFor('magnet', aspect, sec(9)), 'entry and exit share a fixed wide view');
    assert.deepEqual(close, framing.stillCameraFor('magnet', aspect, sec(6)), 'the reduced close-up holds without camera animation');
    assert.deepEqual(close, framing.annotationCameraFor('magnet', aspect), 'reduced labels use the actual close-up');
    assert.ok(wide.halfHeight / close.halfHeight > 5, 'reduced motion preserves a readable macro');
  }
  assert.equal(JSON.stringify(index), sourceBefore);
});

test('labels wait until both the target and authored camera are still, including the magnet close-up', () => {
  for (let time = 0; time < story.DURATION; time += .017) {
    const state = story.stateAt(time), cues = annotations.annotationCues(state); assert.ok(cues.length <= 2);
    for (const cue of cues) {
      assert.ok(story.opacityFor(state, cue.id) >= .5);
      const before = story.stateAt(time - .000001), after = story.stateAt(time + .000001);
      assert.ok(new Vector3(...before.offsetsWorld[cue.id]).distanceTo(new Vector3(...after.offsetsWorld[cue.id])) < 1e-11, `${state.chapter.id}: target rests while named`);
      const a = framing.cameraFor(before.chapter.id, 16 / 9, before.localTime), b = framing.cameraFor(after.chapter.id, 16 / 9, after.localTime);
      assert.ok(new Vector3(...a.target).distanceTo(new Vector3(...b.target)) < 1e-11 && Math.abs(a.halfHeight - b.halfHeight) < 1e-11, `${state.chapter.id}: camera rests while named`);
    }
  }
  assert.deepEqual(annotations.annotationCues(story.stateAt(sec(29))), []); assert.equal(annotations.annotationCues(story.stateAt(sec(33)))[0].text, 'Magnet'); assert.deepEqual(annotations.annotationCues(story.stateAt(sec(36))), []);
});

test('every chapter keeps its intended primary source geometry inside the complete authored camera path', () => {
  for (const aspect of [364 / 410, 16 / 9, 2.5]) for (let frame = 0; frame < Math.ceil(story.DURATION * 30); frame++) {
    const state = story.stateAt(frame / 30), pose = framing.cameraFor(state.chapter.id, aspect, state.localTime);
    const ids = ['whole', 'resolve'].includes(state.chapter.id) ? index.parts.map(part => part.id) : state.chapter.id === 'magnet' ? [story.bindings.labelMagnet] : state.chapter.id === 'repeats' ? [...story.bindings.magnets, ...story.bindings.cc] : story.bindings.motorParts;
    for (const id of ids) assertFits(visiblePoints(state, id), pose, aspect, `${state.chapter.id} primary geometry ${id} at ${state.time.toFixed(3)}s`);
  }
});

test('real original magnet GLB vertices yield a short close-up label on desktop and narrow viewports', async () => {
  const { json: gltf, buffer } = readGlb(await readFile(new URL('../assets/assembly.glb', import.meta.url))), geometry = new Map();
  function visit(i, parent = new Matrix4()) { const node = gltf.nodes[i], world = parent.clone().multiply(new Matrix4().fromArray(node.matrix)); if (node.extras?.part_id === story.bindings.labelMagnet) geometry.set(node.extras.part_id, gltf.meshes[node.mesh].primitives.flatMap(primitive => accessorValues(gltf, buffer, primitive.attributes.POSITION)).map(point => new Vector3(...point).applyMatrix4(world))); for (const child of node.children ?? []) visit(child, world); }
  for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visit(root);
  const sourceVertices = geometry.get(story.bindings.labelMagnet); assert.ok(sourceVertices.length > 0);
  for (const aspect of [364 / 410, 16 / 9, 2.5]) for (let frame = Math.floor(sec(28) * 60); frame <= Math.ceil(sec(38) * 60); frame++) {
    const state = story.stateAt(frame / 60), delta = new Vector3(...state.offsetsWorld[story.bindings.labelMagnet]);
    assertFits(sourceVertices.map(point => point.clone().add(delta)), framing.cameraFor(state.chapter.id, aspect, state.localTime), aspect, `Actual selected GLB vertices at ${state.time.toFixed(3)}s`);
  }
  for (const [width, height] of [[1844, 790], [1204, 600], [364, 410]]) {
    const state = story.stateAt(sec(33)), pose = framing.annotationCameraFor('magnet', width / height), using = camera(pose, width / height), delta = new Vector3(...state.offsetsWorld[story.bindings.labelMagnet]);
    const points = sourceVertices.map(point => { const world = point.clone().add(delta), projected = world.clone().project(using); return { x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2, z: projected.z, world: world.toArray() }; });
    const layout = placeAnnotation({ points, width, height, textWidth: width < 540 ? 42 : 55, textHeight: 21, obstacles: [{ x: width - Math.min(280, width - 24) - 12, y: height - 40, width: Math.min(280, width - 24), height: 32 }], preferredSide: 'left' });
    assert.ok(layout, 'one near-part name fits the actual macro silhouette'); assert.ok(layout.leaderLength <= (width < 540 ? 10 : 15) + 1e-9);
    assert.ok(points.some(point => point.x === layout.anchor.x && point.y === layout.anchor.y), 'leader uses an actual source mesh vertex');
  }
});
