import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
import { readGlb, positionArrays, boundsOf, semanticNodes } from '../../../shared/assets/glb.mjs';
import { createPlanetaryPresentation } from '../presentation.mjs';
import { createPlanetaryExample } from '../example.mjs';
import { DURATION, BPM, TOTAL_BEATS, CHAPTERS, MUSIC_EVENTS, sunAngleAt } from '../choreography.mjs';
import { checkExample, parseArguments } from '../../../tools/study/check-presentation.mjs';

const read = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const index = await read('../assets/scene-index.json');
const source = await read('../assets/provenance.json');
const score = await read('../audio/music-score.json');
const presentation = createPlanetaryPresentation(index);
const { timeline, annotations, framing, rig, plan } = presentation;
const near = (a, b, tolerance = 1e-10, label = '') => assert.ok(Math.abs(a - b) < tolerance, `${label}: ${a} vs ${b}`);
const nearVector = (a, b, tolerance = 1e-10) => a.forEach((v, i) => near(v, b[i], tolerance));
const corners = b => Array.from({ length: 8 }, (_, mask) => new Vector3(...b.min.map((n, axis) => mask & (1 << axis) ? b.max[axis] : n)));
const sampleTimes = Array.from({ length: DURATION * 30 }, (_, frame) => frame / 30);
const centreAt = (state, id) => new Vector3().setFromMatrixPosition(rig.worldMatrices(state).get(id)).add(new Vector3(...state.offsetsWorld[id]));

test('the example selects the real executable plan, shared identity and a complete 36-second loop', () => {
  const example = createPlanetaryExample();
  assert.equal(example.id, 'planetary-gears');
  assert.equal(example.appearance, 'atlas');
  assert.equal(example.createPresentation, createPlanetaryPresentation);
  assert.equal(plan.geometryRevision, index.geometryRevision);
  assert.equal(plan.schemaVersion, 'mechanism-presentation-1');
  assert.equal(DURATION, 36);
  assert.equal(TOTAL_BEATS * 60 / BPM, DURATION);
  assert.equal(CHAPTERS[0].firstBeat, 0);
  assert.equal(CHAPTERS.at(-1).lastBeat, TOTAL_BEATS);
  assert.equal(score.durationSeconds, DURATION);
  assert.equal(score.bpm, BPM);
  assert.equal(score.geometryRevision, index.geometryRevision);
  // A changed data track changes the actual display result, without changing
  // the mechanically computed angles or original specification.
  const editedPlan = structuredClone(plan);
  editedPlan.offsets.find(track => track.channel === 'pair').vectors['pg:sun'][2] += .01;
  const alternate = createPlanetaryPresentation(index, { plan: editedPlan });
  const a = timeline.stateAt(11.5), b = alternate.timeline.stateAt(11.5);
  near(b.offsetsWorld['pg:sun'][2] - a.offsetsWorld['pg:sun'][2], .01);
  assert.equal(a.sunAngle, b.sunAngle);
  assert.deepEqual(presentation.workingPoses(a), alternate.workingPoses(b));
});

test('selected mesh pair retains its actual spacing and orbital relationship through extraction and return', () => {
  for (const time of sampleTimes) {
    const state = timeline.stateAt(time), local = timeline.localDisplayOffsets(index, state.offsetsWorld, Matrix4, Vector3);
    assert.deepEqual(state.offsetsWorld['pg:sun'], state.offsetsWorld['pg:planet-1']);
    const sun = centreAt(state, 'pg:sun'), planet = centreAt(state, 'pg:planet-1');
    near(planet.distanceTo(sun), .048);
    const radial = planet.clone().sub(sun), carrier = state.sunAngle / 4;
    nearVector(radial.toArray(), [.048 * Math.cos(carrier), .048 * Math.sin(carrier), 0]);
    for (const part of index.parts) {
      const parent = index.assemblies.find(assembly => assembly.id === part.parentId);
      const matrix = new Matrix4().fromArray(parent.worldMatrix);
      const worldOffset = new Vector3(...local.get(part.id)).applyMatrix4(matrix).sub(new Vector3().applyMatrix4(matrix));
      nearVector(worldOffset.toArray(), state.offsetsWorld[part.id]);
    }
    for (const errors of rig.phaseErrors(state.sunAngle)) {
      near(errors.external, 0, 2e-12); near(errors.internal, 0, 2e-12);
    }
  }
});

test('teardown and refitting take place during mechanical holds, with all parts seated before the final drive', () => {
  for (const channel of plan.offsets) {
    const timing = plan.channels[channel.channel];
    for (const interval of [timing.rise, timing.fall]) {
      const reference = sunAngleAt(interval[0]);
      for (let i = 0; i <= 30; i++) near(sunAngleAt(interval[0] + (interval[1] - interval[0]) * i / 30), reference);
    }
  }
  for (const time of [0, 32.1, 32.4, DURATION - 1e-6, DURATION]) {
    for (const offset of Object.values(timeline.stateAt(time).offsetsWorld)) nearVector(offset, [0, 0, 0]);
  }
  near(sunAngleAt(DURATION), 8 * Math.PI);
  const first = rig.worldMatrices(timeline.stateAt(0)), end = rig.worldMatrices(timeline.stateAt(DURATION - 1e-6));
  for (const part of index.parts) {
    if (!['ball', 'cage'].includes(part.bearingElement)) nearVector(first.get(part.id).elements, end.get(part.id).elements, 1e-9);
    else for (const time of [0, DURATION - 1e-6, DURATION]) {
      assert.equal(presentation.presentationOpacity(timeline.stateAt(time), part.id), 0, `${part.id} must be concealed at the nonclosing bearing reset`);
    }
  }
  // The visual loop closes the gear poses, not the noninteger cage/ball phases.
  assert.notDeepEqual(first.get('pg:support-bearing-front-cage').elements, end.get('pg:support-bearing-front-cage').elements);
  for (const time of [0, DURATION - 1e-6]) {
    const state = timeline.stateAt(time);
    for (const id of ['pg:housing', 'pg:endplate-front', 'pg:endplate-rear']) assert.equal(presentation.presentationOpacity(state, id), 1);
  }
  assert.deepEqual(timeline.stateAt(0), timeline.stateAt(DURATION));
  for (const aspect of [16 / 9, 1, 9 / 16]) assert.deepEqual(framing.cameraFor('orbit', aspect), framing.cameraFor('resolve', aspect));
});

test('near names appear sequentially on stationary readable targets, then fade before local motion', () => {
  for (const chapter of plan.chapters) {
    const chapterStart = chapter.firstBeat * 60 / BPM, windows = plan.annotations.windows[chapter.id];
    for (let i = 0; i < windows.length; i++) {
      const [start, end] = windows[i], id = chapter.labels[i][0];
      const firstState = timeline.stateAt(chapterStart + start), centre = centreAt(firstState, id);
      for (let step = 0; step < 40; step++) {
        const time = chapterStart + start + (end - start) * step / 40, state = timeline.stateAt(time);
        nearVector(centreAt(state, id).toArray(), centre.toArray());
        near(sunAngleAt(time), firstState.sunAngle);
        assert.ok(presentation.presentationOpacity(state, id) >= .99);
        assert.equal(annotations.annotationCues(state, { cameraSettled: false }).length, 0);
      }
      assert.equal(annotations.annotationCues(timeline.stateAt(chapterStart + end + .0001)).some(cue => cue.id === id), false);
      assert.ok(annotations.annotationCues(timeline.stateAt(chapterStart + end - .01)).find(cue => cue.id === id).opacity < .04);
    }
    if (windows.length === 2) {
      assert.ok(windows[1][0] - windows[0][0] >= .7);
      const between = chapterStart + (windows[0][0] + windows[1][0]) / 2;
      assert.equal(annotations.annotationCues(timeline.stateAt(between)).length, 1);
      const both = chapterStart + windows[1][0] + .3;
      assert.equal(annotations.annotationCues(timeline.stateAt(both)).length, 2);
    }
  }
  assert.equal(annotations.annotationCues(timeline.stateAt(17.4)).length, 0);
  assert.ok(sunAngleAt(19) > sunAngleAt(17.4));
});

test('the shaft-bearing detail seats its actual components before showing shaft-coupled rolling', () => {
  const internals = index.parts.filter(part => ['ball', 'cage'].includes(part.bearingElement));
  assert.equal(internals.filter(part => part.bearingElement === 'ball').length, 20);
  assert.equal(internals.filter(part => part.bearingElement === 'cage').length, 2);
  for (const time of sampleTimes) {
    const state = timeline.stateAt(time);
    const rate = (sunAngleAt(Math.min(DURATION, time + 1e-5)) - sunAngleAt(Math.max(0, time - 1e-5))) / 2e-5;
    for (const side of ['front', 'rear']) {
      const support = index.parts.filter(part => part.group === `support-bearing-${side}`), base = state.offsetsWorld[`pg:support-bearing-${side}-cage`];
      for (const part of support) if (state.offsetsWorld[part.id].some((value, axis) => Math.abs(value - base[axis]) > 1e-9)) {
        assert.ok(Math.abs(rate) < 1e-6, `${part.id} must not roll while its bearing is internally separated at ${time}`);
      }
    }
  }
  const reading = timeline.stateAt(23.7), supportIds = index.parts.filter(part => part.group === 'support-bearing-front').map(part => part.id);
  assert.equal(supportIds.length, 13);
  for (const part of index.parts) assert.equal(presentation.presentationOpacity(reading, part.id), supportIds.includes(part.id) ? 1 : 0);
  assert.ok(reading.offsetsWorld['pg:support-bearing-front-outer'][2] > reading.offsetsWorld['pg:support-bearing-front-inner'][2]);
  for (let i = 1; i <= 10; i++) {
    const id = `pg:support-bearing-front-ball-${i}`;
    const sourceCentre = index.parts.find(part => part.id === id).translation;
    const displayed = centreAt(reading, id);
    near(Math.hypot(displayed.x, displayed.y), Math.hypot(sourceCentre[0], sourceCentre[1]) + .009);
    assert.deepEqual(presentation.workingPoses(reading)[id].scale, [1, 1, 1], 'a detail magnifies the camera, not the ball geometry');
  }
  const start = rig.worldMatrices(timeline.stateAt(25.4)), end = rig.worldMatrices(timeline.stateAt(27.4));
  assert.notDeepEqual(start.get('pg:support-bearing-front-cage').elements, end.get('pg:support-bearing-front-cage').elements);
  assert.notDeepEqual(start.get('pg:support-bearing-front-ball-1').elements, end.get('pg:support-bearing-front-ball-1').elements);
  assert.deepEqual(start.get('pg:support-bearing-front-outer').elements, end.get('pg:support-bearing-front-outer').elements);
  for (let sample = 0; sample <= 120; sample++) {
    const state = timeline.stateAt(25.4 + 2 * sample / 120), world = rig.worldMatrices(state);
    assert.equal(annotations.annotationCues(state).length, 0, 'reading labels finish before rolling');
    for (const id of supportIds) nearVector(state.offsetsWorld[id], [0, 0, .14]);
    for (const part of internals.filter(part => part.supportSide === 'front')) assert.equal(presentation.presentationOpacity(state, part.id), 1);
    for (const side of ['front', 'rear']) {
      const cage = index.parts.find(part => part.id === `pg:support-bearing-${side}-cage`), cageMatrix = world.get(cage.id);
      for (const ball of internals.filter(part => part.supportSide === side && part.bearingElement === 'ball')) {
        const localPocket = new Vector3(...ball.translation.map((value, axis) => value - cage.translation[axis]));
        const pocket = localPocket.applyMatrix4(cageMatrix).add(new Vector3(...state.offsetsWorld[cage.id]));
        nearVector(centreAt(state, ball.id).toArray(), pocket.toArray(), 2e-10);
      }
    }
  }
});

test('actual moving bounds fit authored envelopes and the single seating recenter in landscape, square and phone views', () => {
  const aspects = [16 / 9, 1, 390 / 844], up = new Vector3(0, 1, 0);
  const framingTimes = [...new Set([...sampleTimes, ...Array.from({ length: 101 }, (_, i) => 24.5 + .7 * i / 100), 25.2, 27.6 - 1e-7])];
  for (const time of framingTimes) {
    const state = timeline.stateAt(time), authored = plan.cameras[state.chapter.id], bounds = rig.boundsAtAngle(state);
    for (const aspect of aspects) {
      const camera = framing.cameraFor(state.chapter.id, aspect, state.localTime), target = new Vector3(...camera.target);
      const direction = new Vector3(...camera.position).sub(target).normalize();
      const right = new Vector3().crossVectors(up, direction).normalize(), vertical = new Vector3().crossVectors(direction, right).normalize();
      const opening = framing.cameraFor(state.chapter.id, aspect, 0);
      if (state.chapter.id !== 'bearing' || state.localTime <= 3.5) {
        assert.deepEqual(camera, opening, 'reading and other shot envelopes must stay fixed');
      } else if (state.localTime >= 4.2) {
        assert.deepEqual(camera, framing.cameraFor('bearing', aspect, 5), 'seated bearing drive must use one fixed envelope');
      } else {
        const settled = framing.cameraFor('bearing', aspect, 5);
        const originalDirection = new Vector3(...opening.position).sub(new Vector3(...opening.target)).normalize();
        nearVector(direction.toArray(), originalDirection.toArray(), 1e-10);
        assert.ok(camera.halfHeight <= opening.halfHeight && camera.halfHeight >= settled.halfHeight);
        assert.equal(annotations.annotationCues(state).length, 0, 'the recenter starts only after label reading finishes');
        near(state.sunAngle, sunAngleAt(24.5), 1e-10, 'recenter happens while the bearing is seating, before drive');
      }
      for (const part of index.parts) {
        if (presentation.presentationOpacity(state, part.id) <= 1e-8) continue;
        for (const corner of corners(bounds.get(part.id))) {
          corner.add(new Vector3(...state.offsetsWorld[part.id]));
          for (let axis = 0; axis < 3; axis++) {
            assert.ok(corner.getComponent(axis) >= authored.bounds.min[axis] - 1e-9, `${state.chapter.id}/${part.id} lower envelope at ${time}`);
            assert.ok(corner.getComponent(axis) <= authored.bounds.max[axis] + 1e-9, `${state.chapter.id}/${part.id} upper envelope at ${time}`);
          }
          const projected = corner.sub(target);
          assert.ok(Math.abs(projected.dot(right)) <= camera.halfHeight * aspect * .95, `${part.id} horizontal framing at ${time}/${aspect}`);
          assert.ok(Math.abs(projected.dot(vertical)) <= camera.halfHeight * .95, `${part.id} vertical framing at ${time}/${aspect}`);
        }
      }
    }
  }
  for (const aspect of aspects) {
    const open = framing.cameraFor('bearing', aspect, 3.5), seated = framing.cameraFor('bearing', aspect, 4.2);
    assert.ok(seated.halfHeight < open.halfHeight, 'the assembled bearing receives a deliberate closer view');
    for (const [localTime, reference] of [[3.5 + 1e-5, open], [4.2 - 1e-5, seated]]) {
      const camera = framing.cameraFor('bearing', aspect, localTime);
      nearVector(camera.target, reference.target, 1e-8);
      nearVector(camera.position, reference.position, 1e-8);
      near(camera.halfHeight, reference.halfHeight, 1e-8);
    }
  }
});

test('annotation obstacles include the real opened cage geometry and stay stable throughout reading windows', async () => {
  const glb = readGlb(await readFile(new URL('../assets/assembly.glb', import.meta.url)));
  const nodes = semanticNodes(glb.json), id = 'pg:support-bearing-front-cage';
  const node = nodes.get(id), localBox = boundsOf(positionArrays(glb.json, glb.buffer, node).flatMap(primitive => primitive.values));
  const opened = timeline.stateAt(23.8), pose = presentation.workingPoses(opened)[id];
  const model = new Matrix4().compose(new Vector3(...pose.position), new Quaternion(...pose.quaternion), new Vector3(...pose.scale));
  const displayedWorld = new Matrix4().makeTranslation(...opened.offsetsWorld[id]).multiply(model).multiply(new Matrix4().fromArray(node.matrix));
  const actual = new Box3().setFromPoints(corners(localBox).map(corner => corner.applyMatrix4(displayedWorld)));
  const returned = presentation.labelObstacleBounds(opened).get(id);
  nearVector(returned.min, actual.min.toArray(), 2e-8);
  nearVector(returned.max, actual.max.toArray(), 2e-8);
  const closed = presentation.labelObstacleBounds(timeline.stateAt(21)).get(id);
  near(returned.min[2] - closed.min[2], .047);
  near(returned.max[2] - closed.max[2], .047);

  for (const chapter of plan.chapters) for (const [start, end] of plan.annotations.windows[chapter.id]) {
    const t0 = chapter.firstBeat * 60 / BPM, first = timeline.stateAt(t0 + start);
    const referenceIds = presentation.labelObstacleIds(first), reference = presentation.labelObstacleBounds(first);
    for (let sample = 0; sample < 20; sample++) {
      const state = timeline.stateAt(t0 + start + (end - start) * sample / 20);
      const actualIds = presentation.labelObstacleIds(state), actualBounds = presentation.labelObstacleBounds(state);
      assert.deepEqual(actualIds, referenceIds);
      for (const id of actualIds) {
        nearVector(actualBounds.get(id).min, reference.get(id).min);
        nearVector(actualBounds.get(id).max, reference.get(id).max);
      }
    }
  }
});

test('sampling and seeking keep source records immutable and restore context after detail', () => {
  const before = JSON.stringify({ index, source, score });
  const sample = time => {
    const state = timeline.stateAt(time), labels = annotations.annotationCues(state);
    return { state, poses: presentation.workingPoses(state), labels, accents: presentation.appearanceCues(state, labels),
      opacity: index.parts.map(part => presentation.presentationOpacity(state, part.id)) };
  };
  const times = [0, 6, 9.9, 16.2, 18.9, 22, 25, 29, 35.99], expected = times.map(sample);
  for (const i of [8, 1, 5, 3, 0, 6, 2, 7, 4, 0]) assert.deepEqual(sample(times[i]), expected[i]);
  const focused = timeline.stateAt(18), restored = timeline.stateAt(DURATION - .01), initial = timeline.stateAt(0);
  for (const part of index.parts) {
    assert.equal(presentation.presentationOpacity(focused, part.id), ['pg:sun', 'pg:planet-1'].includes(part.id) ? 1 : 0);
    assert.equal(presentation.presentationOpacity(restored, part.id), presentation.presentationOpacity(initial, part.id));
  }
  for (const cue of MUSIC_EVENTS) {
    assert.ok(cue.beat >= 0 && cue.beat < TOTAL_BEATS);
    assert.ok(cue.partIds.every(id => index.parts.some(part => part.id === id)));
  }
  assert.equal(JSON.stringify({ index, source, score }), before);
});

test('the registered presentation checker reports numerical success without claiming manual review', async () => {
  assert.equal(parseArguments(['--example', 'planetary-gears', '--output', 'output/presentation-checks/planetary-gears.json']).example, 'planetary-gears');
  const report = await checkExample('planetary-gears');
  assert.equal(report.status, 'automated-passed', JSON.stringify(report.checks));
  assert.equal(report.geometryRevision, index.geometryRevision);
  assert.equal(report.durationSeconds, DURATION);
  assert.ok(report.checks.every(check => check.status === 'passed'));
  assert.equal(report.manualReview.status, 'pending');
  assert.match(report.manualReview.required.join(' '), /browser.*Phone-sized.*exported video/s);
});
