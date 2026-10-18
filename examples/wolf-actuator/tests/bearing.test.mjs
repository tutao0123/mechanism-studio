import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Vector3, Matrix4, OrthographicCamera } from 'three';
import { createWolfBearingStory, localDisplayOffsets } from '../bearing/story.mjs';
import { createWolfBearingFraming, CAMERA_UP } from '../bearing/framing.mjs';
import { createWolfBearingAnnotations } from '../bearing/annotations.mjs';
import { readGlb, accessorValues } from '../../../shared/assets/glb.mjs';
import { placeAnnotation } from '../../../shared/viewer/annotation-layout.mjs';
const read = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const index = await read('../assets/scene-index.json'), manifest = await read('../assets/assembly-manifest.json'), story = createWolfBearingStory(index), annotations = createWolfBearingAnnotations(story), framing = createWolfBearingFraming(index, story);
const sourceBefore = JSON.stringify(index), sec = beat => beat * 60 / story.BPM;
const corners = bounds => [bounds.min[0], bounds.max[0]].flatMap(x => [bounds.min[1], bounds.max[1]].flatMap(y => [bounds.min[2], bounds.max[2]].map(z => new Vector3(x, y, z))));
const partById = new Map(index.parts.map(part => [part.id, part]));
function sourcePoints(state, id) { const delta = new Vector3(...state.offsetsWorld[id]); return corners(partById.get(id).worldBounds).map(point => point.add(delta)); }
function camera(pose, aspect) { const result = new OrthographicCamera(-pose.halfHeight * aspect, pose.halfHeight * aspect, pose.halfHeight, -pose.halfHeight, .0001, 1000); result.up.fromArray(CAMERA_UP); result.position.fromArray(pose.position); result.lookAt(new Vector3(...pose.target)); result.updateMatrixWorld(true); return result; }
function assertFits(points, pose, aspect, message) { const using = camera(pose, aspect); for (const point of points) { const p = point.clone().project(using); assert.ok(Math.abs(p.x) <= .98 && Math.abs(p.y) <= .98 && Math.abs(p.z) <= 1, `${message}: ${p.toArray()}`); } }
const { json: gltf, buffer } = readGlb(await readFile(new URL('../assets/assembly.glb', import.meta.url))), geometry = new Map();
function visit(i, parent = new Matrix4()) { const node = gltf.nodes[i], world = parent.clone().multiply(new Matrix4().fromArray(node.matrix)); if (node.extras?.part_id && story.bindings.bearingParts.includes(node.extras.part_id)) geometry.set(node.extras.part_id, gltf.meshes[node.mesh].primitives.flatMap(primitive => accessorValues(gltf, buffer, primitive.attributes.POSITION)).map(point => new Vector3(...point).applyMatrix4(world))); for (const child of node.children ?? []) visit(child, world); }
for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visit(root);

test('bearing A binds seventy actual native leaves, preserving all generic names and both source child assemblies', () => {
  const occurrences = new Map(manifest.occurrences.map(value => [value.occurrence_id, value])), definitions = new Set(manifest.definitions.map(value => value.definition_id));
  assert.equal(story.bindings.bearing, 'occ-b352183e1bd0-root-953098-923'); assert.equal(story.bindings.bearingParts.length, 70); assert.equal(story.bindings.largeParts.length, 4); assert.equal(story.bindings.smallParts.length, 66);
  assert.equal(partById.get(story.bindings.outerRing).name, 'outer-ring-A'); assert.equal(partById.get(story.bindings.focus).name, 'Part 1'); assert.equal(partById.get(story.bindings.focus).triangleCount, 716);
  const parentIds = new Set();
  for (const id of story.bindings.bearingParts) { const part = partById.get(id), occurrence = occurrences.get(id); assert.ok(geometry.has(id)); assert.equal(part.parentId, occurrence.parent_id); assert.ok(definitions.has(occurrence.definition_id)); parentIds.add(part.parentId); }
  assert.deepEqual([...parentIds].sort(), ['occ-b352183e1bd0-root-953098-923-852', 'occ-b352183e1bd0-root-953098-923-922']);
  assert.ok(story.bindings.bearingParts.filter(id => id !== story.bindings.outerRing).every(id => /^Part \d+$/.test(partById.get(id).name)));
  assert.equal(JSON.stringify(index), sourceBefore);
  const wrong = structuredClone(index); wrong.parts.find(part => part.id === story.bindings.focus).name = 'invented ball'; assert.throws(() => createWolfBearingStory(wrong), /Pinned bearing source occurrence/);
});

test('geometric sectors cover each small occurrence once and event identities survive arbitrary source ordering', () => {
  assert.deepEqual(story.bindings.smallBatches.map(batch => batch.length), [17, 17, 16, 16]); assert.deepEqual(story.bindings.smallBatches.flat().sort(), [...story.bindings.smallParts].sort());
  assert.equal(new Set(story.GROUPS.flatMap(group => group.ids)).size, 70); assert.equal(story.MOTION_EVENTS.length, 18);
  for (const event of story.MOTION_EVENTS) { assert.ok(event.endBeat > event.startBeat); assert.equal(event.firstBeat, event.startBeat); assert.equal(event.lastBeat, event.endBeat); assert.deepEqual(event.ids, event.partIds); for (const id of event.ids) assert.ok(story.bindings.bearingParts.includes(id)); }
  const changedOrder = structuredClone(index); changedOrder.parts.reverse(); const other = createWolfBearingStory(changedOrder); assert.deepEqual(other.bindings.smallBatches, story.bindings.smallBatches);
  assert.ok(story.GROUPS.filter(group => group.kind === 'repeat').every(group => group.family === 'bearing-small-parts'));
});

test('one complete 245-part offset map is deterministic, hierarchy-correct and exactly restored', () => {
  assert.equal(story.BPM, 112); assert.equal(story.TOTAL_BEATS, 64); assert.equal(story.DURATION, 240 / 7); assert.deepEqual(story.stateAt(story.DURATION), story.stateAt(0));
  for (let i = 1; i < story.CHAPTERS.length; i++) assert.equal(story.CHAPTERS[i - 1].lastBeat, story.CHAPTERS[i].firstBeat);
  for (let beat = 0; beat < 64; beat += .137) {
    const state = story.stateAt(sec(beat)); assert.equal(Object.keys(state.offsetsWorld).length, 245); const before = structuredClone(state); story.stateAt(sec(beat + 17)); assert.deepEqual(story.stateAt(sec(beat)), before);
    for (const part of index.parts) { assert.ok(state.offsetsWorld[part.id].every(Number.isFinite)); if (!story.bindings.bearingParts.includes(part.id)) assert.deepEqual(state.offsetsWorld[part.id], [0, 0, 0]); }
  }
  const records = new Map([...index.assemblies, ...index.parts].map(part => [part.id, part]));
  for (const beat of [7, 14, 23, 32, 36, 42, 56, 60]) { const state = story.stateAt(sec(beat)), local = localDisplayOffsets(index, state.offsetsWorld, Matrix4, Vector3); for (const part of index.parts) { const matrix = new Matrix4().fromArray(records.get(part.parentId).worldMatrix), delta = new Vector3(...local.get(part.id)).applyMatrix4(matrix).sub(new Vector3().applyMatrix4(matrix)); assert.ok(delta.distanceTo(new Vector3(...state.offsetsWorld[part.id])) < 1e-12); } }
  assert.ok(Object.values(story.stateAt(sec(58)).offsetsWorld).flat().every(value => value === 0)); assert.equal(JSON.stringify(index), sourceBefore);
});

test('the small focus is the same Part 1 with only a reversible translation, and opacity preserves context', () => {
  const id = story.bindings.focus, base = story.MAXIMUM_OFFSETS[id], peak = story.PATH_MAXIMUM_OFFSETS[id], outside = index.parts.find(part => !story.bindings.bearingParts.includes(part.id)).id;
  assert.deepEqual(peak, base.map((value, axis) => value + story.FOCUS_OFFSET[axis])); assert.deepEqual(story.stateAt(sec(28)).offsetsWorld[id], base); assert.deepEqual(story.stateAt(sec(33)).offsetsWorld[id], peak); assert.deepEqual(story.stateAt(sec(38)).offsetsWorld[id], base);
  for (let beat = 0; beat < 64; beat += .11) { const state = story.stateAt(sec(beat)); assert.equal(story.detailIds(state), null); for (const part of index.parts) { const alpha = story.opacityFor(state, part.id); assert.ok(alpha >= 0 && alpha <= 1); if (story.bindings.bearingParts.includes(part.id)) assert.ok(alpha >= .12 - 1e-12); } }
  assert.equal(story.opacityFor(story.stateAt(sec(33)), id), 1); assert.equal(story.opacityFor(story.stateAt(sec(8)), outside), 0); assert.ok(index.parts.every(part => story.opacityFor(story.stateAt(sec(63.9)), part.id) === 1));
  for (let beat = 28; beat <= 38; beat += .037) { const state = story.stateAt(sec(beat)); for (const other of story.bindings.bearingParts) if (other !== id) assert.deepEqual(state.offsetsWorld[other], story.MAXIMUM_OFFSETS[other]); for (const point of sourcePoints(state, id)) assert.ok(framing.envelopes.component.containsPoint(point)); }
  assert.equal(JSON.stringify(index), sourceBefore);
});

test('continuous authored camera covers all primary bounds at 30fps and joins exactly at every scene', () => {
  for (const aspect of [364 / 410, 16 / 9, 2.5]) {
    assert.deepEqual(framing.cameraFor('whole', aspect), framing.cameraFor('resolve', aspect, 2));
    for (const beat of [6, 9, 16, 18, 28, 31, 35.3, 38, 57.4, 60]) { const a = story.stateAt(sec(beat - 1e-7)), b = story.stateAt(sec(beat + 1e-7)), pa = framing.cameraFor(a.chapter.id, aspect, a.localTime), pb = framing.cameraFor(b.chapter.id, aspect, b.localTime); assert.ok(new Vector3(...pa.target).distanceTo(new Vector3(...pb.target)) < 1e-7); assert.ok(new Vector3(...pa.position).distanceTo(new Vector3(...pb.position)) < 1e-7); assert.ok(Math.abs(pa.halfHeight - pb.halfHeight) < 1e-7); }
    for (let frame = 0; frame < Math.ceil(story.DURATION * 30); frame++) { const state = story.stateAt(frame / 30), pose = framing.cameraFor(state.chapter.id, aspect, state.localTime), ids = ['whole', 'resolve'].includes(state.chapter.id) ? index.parts.map(part => part.id) : state.chapter.id === 'component' ? [story.bindings.focus] : state.chapter.id === 'repeats' ? story.bindings.smallParts : story.bindings.bearingParts; for (const id of ids) assertFits(sourcePoints(state, id), pose, aspect, `${state.chapter.id} ${id} at ${state.time.toFixed(3)}s`); }
  }
});

test('actual original Part 1 vertices stay in frame at 60fps throughout extraction, macro and return', () => {
  const vertices = geometry.get(story.bindings.focus); assert.ok(vertices.length > 0);
  for (const aspect of [364 / 410, 16 / 9, 2.5]) {
    const wide = framing.stillCameraFor('component', aspect, 0), close = framing.stillCameraFor('component', aspect, sec(4)); assert.ok(wide.halfHeight / close.halfHeight > 5); assert.deepEqual(close, framing.stillCameraFor('component', aspect, sec(6))); assert.deepEqual(close, framing.annotationCameraFor('component', aspect));
    for (let frame = Math.floor(sec(28) * 60); frame <= Math.ceil(sec(38) * 60); frame++) { const state = story.stateAt(frame / 60), delta = new Vector3(...state.offsetsWorld[story.bindings.focus]), points = vertices.map(point => point.clone().add(delta)); assertFits(points, framing.cameraFor(state.chapter.id, aspect, state.localTime), aspect, `Real Part 1 GLB vertices ${state.time.toFixed(3)}s`); if (state.chapter.id === 'component') assertFits(points, framing.stillCameraFor('component', aspect, state.localTime), aspect, 'Reduced-motion Part 1'); }
  }
});

test('names appear only while actual targets and authored camera are stationary', () => {
  for (let time = 0; time < story.DURATION; time += .017) { const state = story.stateAt(time), cues = annotations.annotationCues(state); assert.ok(cues.length <= 2); for (const cue of cues) { assert.ok(story.opacityFor(state, cue.id) >= .5); const a = story.stateAt(time - 1e-6), b = story.stateAt(time + 1e-6); assert.ok(new Vector3(...a.offsetsWorld[cue.id]).distanceTo(new Vector3(...b.offsetsWorld[cue.id])) < 1e-11, `${state.chapter.id}: named source part moves`); const ca = framing.cameraFor(a.chapter.id, 16 / 9, a.localTime), cb = framing.cameraFor(b.chapter.id, 16 / 9, b.localTime); assert.ok(new Vector3(...ca.target).distanceTo(new Vector3(...cb.target)) < 1e-11 && Math.abs(ca.halfHeight - cb.halfHeight) < 1e-11, `${state.chapter.id}: named source view moves`); } }
  assert.equal(annotations.annotationCues(story.stateAt(sec(33)))[0].text, 'Part 1'); assert.deepEqual(annotations.annotationCues(story.stateAt(sec(36))), []);
});

test('a near-part label fits the original small component at large capture type and on a narrow page', () => {
  const state = story.stateAt(sec(33)), delta = new Vector3(...state.offsetsWorld[story.bindings.focus]), vertices = geometry.get(story.bindings.focus);
  for (const [width, height] of [[1844, 790], [1204, 600], [364, 410]]) { const using = camera(framing.annotationCameraFor('component', width / height), width / height), points = vertices.map(point => { const p = point.clone().add(delta).project(using); return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2, z: p.z }; }), creditWidth = Math.min(560, width - 24); const layout = placeAnnotation({ points, width, height, textWidth: width < 540 ? 39 : 108, textHeight: width < 540 ? 18 : 47, obstacles: [{ x: width - creditWidth - 12, y: height - 76, width: creditWidth, height: 64 }], preferredSide: 'left' }); assert.ok(layout, 'macro label fits at the actual silhouette'); assert.ok(layout.leaderLength <= (width < 540 ? 10 : 15) + 1e-9); assert.ok(points.some(point => point.x === layout.anchor.x && point.y === layout.anchor.y)); }
});

test('authoring plan and new music bind the real bearing identities and actual audio bytes', async () => {
  const plan = await read('../bearing/plan.json'), score = await read('../bearing/music-score.json'), bytes = await readFile(new URL('../bearing/audio/bearing-loop.wav', import.meta.url));
  assert.equal(plan.sourceComponentId, story.bindings.bearing); assert.equal(plan.sourcePartCount, 70); assert.equal(plan.planRevision, story.PLAN_REVISION); assert.deepEqual(plan.motionEvents, story.MOTION_EVENTS); assert.deepEqual(plan.pathMaximumOffsets, story.PATH_MAXIMUM_OFFSETS);
  assert.equal(score.sha256, createHash('sha256').update(bytes).digest('hex')); assert.equal(score.byteLength, bytes.length); assert.equal(score.durationSeconds, story.DURATION); assert.equal(score.bpm, story.BPM); assert.ok(plan.diagnostics.longestUnmovingIntervalSeconds < 4);
});
