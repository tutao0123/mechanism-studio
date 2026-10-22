import { Matrix4, Vector3, Box3 } from 'three';
import { compilePresentationPlan } from '../../shared/study/plan.mjs';
import { createPlanetaryRig } from './kinematics.mjs';
import { BPM, DURATION, TOTAL_BEATS, CHAPTERS, PLAN_REVISION, MUSIC_EVENTS, sunAngleAt, INSPECTION_SUN_ANGLE } from './choreography.mjs';

const corners = box => Array.from({ length: 8 }, (_, mask) => box.min.map((n, axis) => mask & 1 << axis ? box.max[axis] : n));
const boundsRecord = bounds => ({ min: bounds.min.toArray(), max: bounds.max.toArray() });

export function localDisplayOffsets(index, offsets, Matrix = Matrix4, Vector = Vector3) {
  const parents = new Map(index.assemblies.map(a => [a.id, a]));
  return new Map(index.parts.map(part => {
    const parent = parents.get(part.parentId);
    if (!parent) throw new Error(`Missing source assembly ${part.parentId}.`);
    const inverse = new Matrix().fromArray(parent.worldMatrix).invert();
    return [part.id, new Vector(...offsets[part.id]).applyMatrix4(inverse).sub(new Vector().applyMatrix4(inverse)).toArray()];
  }));
}

export function createPlanetaryPresentation(index, { plan: override } = {}) {
  const rig = createPlanetaryRig(index), ids = index.parts.map(part => part.id);
  const selected = ['pg:sun', 'pg:planet-1'];
  const bearingIds = ids.filter(id => id.startsWith('pg:support-bearing-front-'));
  const rollingIds = new Set(ids.filter(id => /support-bearing-(front|rear)-(cage|ball-)/.test(id)));
  const channels = {}, offsets = [];
  const track = (name, rise, fall, vectors) => { channels[name] = { rise, fall }; offsets.push({ channel: name, vectors }); };
  // Exterior sets lift as coherent real occurrence groups, then the inner core
  // separates. These are observation offsets, not a proposed service sequence.
  track('housing', [5.4, 7.5], [29.7, 30.9], { 'pg:housing': [.205, 0, 0] });
  for (const [side, sign] of [['front', 1], ['rear', -1]]) {
    track(`endplate-${side}`, [5.1, 6.9], [30.1, 31.2], { [`pg:endplate-${side}`]: [0, 0, sign * .105] });
    track(`gasket-${side}`, [6.0, 7.4], [29.5, 30.7], { [`pg:gasket-${side}`]: [0, 0, sign * .065] });
    track(`support-${side}`, [6.4, 7.9], [29.2, 30.4], Object.fromEntries(ids.filter(id => id.startsWith(`pg:support-bearing-${side}-`)).map(id => [id, [0, 0, sign * .14]])));
    track(`seal-${side}`, [5.7, 7.2], [30.0, 31.3], { [`pg:shaft-seal-${side}`]: [0, 0, sign * .19], [`pg:bearing-clip-${side}`]: [0, 0, sign * .17] });
    for (let i = 1; i <= 6; i++) {
      const a = (i - .5) * Math.PI / 3, d = (i - 1) * .075;
      track(`case-fastener-${side}-${i}`, [3.9 + d, 5.0 + d], [31.0 + (6 - i) * .06, 32.1], {
        [`pg:housing-bolt-${side}-${i}`]: [.015 * Math.cos(a), .015 * Math.sin(a), sign * .225],
        [`pg:housing-washer-${side}-${i}`]: [.012 * Math.cos(a), .012 * Math.sin(a), sign * .202],
      });
    }
  }
  track('front', [8.5, 9.6], [28.5, 29.6], { 'pg:carrier-front': [0, 0, .047] });
  track('rear', [8.7, 10.0], [28.2, 29.4], { 'pg:carrier-rear': [0, 0, -.048], 'pg:output-hub': [0, 0, -.078] });
  track('ring', [8.7, 10.0], [28.1, 29.4], { 'pg:ring': [0, 0, -.022] });
  track('input', [8.5, 9.8], [28.7, 29.8], { 'pg:input-shaft': [0, 0, .095] });
  track('pair', [8.7, 10.1], [27.6, 28.9], Object.fromEntries(selected.map(id => [id, [0, 0, .027]])));
  for (let i = 1; i <= 3; i++) {
    const angle = (i - 1) * 2 * Math.PI / 3 + INSPECTION_SUN_ANGLE / 4, radial = amount => [amount * Math.cos(angle), amount * Math.sin(angle)];
    const d = (i - 1) * .1;
    track(`fastener-${i}`, [8.45 + d, 9.35 + d], [29.2 + (3 - i) * .1, 30.1], {
      [`pg:screw-${i}`]: [...radial(.016), .078], [`pg:washer-${i}`]: [...radial(.013), .066],
    });
    track(`bearing-${i}`, [9.0 + d, 10.2 + d], [28.5 - d, 29.5 - d], {
      [`pg:bearing-${i}`]: [...radial(.041), .010], [`pg:pin-${i}`]: [...radial(.027), -.035],
    });
    if (i > 1) track(`planet-${i}`, [8.7 + d, 10.1 + d], [27.6 + d, 28.9 + d], { [`pg:planet-${i}`]: [...radial(.037), .025 + d * .06] });
  }
  const micro = { 'pg:support-bearing-front-inner': [0, 0, -.012], 'pg:support-bearing-front-outer': [0, 0, .019], 'pg:support-bearing-front-cage': [0, 0, .047] };
  const cageAtDetail = rig.motionState(sunAngleAt(21.3)).bearings.front.cageAngle;
  for (let i = 1; i <= 10; i++) { const a = (i - 1) * 2 * Math.PI / 10 + cageAtDetail; micro[`pg:support-bearing-front-ball-${i}`] = [.009 * Math.cos(a), .009 * Math.sin(a), 0]; }
  track('bearing-detail', [21.3, 22.3], [24.5, 25.2], micro);
  channels['case-peek'] = { rise: [1.1, 1.8], fall: [4, 5.1] };
  // Bearing phases do not close in four sun turns. Hide only at the editorial
  // loop boundary, under the closed enclosure; retain correct physical ratios.
  channels['bearing-visible'] = { rise: [.8, 1.1], fall: [31.5, 32.3] };
  channels.focus = { rise: [13.3, 14.5], fall: [19.9, 20.5] };
  channels['bearing-focus'] = { rise: [20.1, 20.9], fall: [28.6, 29.2] };
  channels['bearing-roll'] = { rise: [25.2, 25.4], fall: [27.5, 27.9] };
  const opacity = (compiled, state, id) => compiled.presentationOpacity(state, id) * (rollingIds.has(id) ? state.progress['bearing-visible'] : 1);
  const view = (bounds, direction, fill = .88, minimum = .035) => ({ bounds, direction, fillX: fill, fillY: .85, minHalfHeight: minimum, narrow: { belowAspect: .9, fillX: .78, fillY: .80 } });
  const base = {
    schemaVersion: 'mechanism-presentation-1', id: PLAN_REVISION, geometryRevision: index.geometryRevision,
    bpm: BPM, durationSeconds: DURATION, chapters: CHAPTERS, channels, offsets,
    annotations: { windows: { orbit: [], enclosure: [], explode: [[3.1, 4.7], [3.85, 4.7]], approach: [], mesh: [[.25, 2.3], [1.0, 2.3]], 'bearing-approach': [], bearing: [[1.3, 3.5], [2.2, 3.5]], restore: [], resolve: [] }, fadeInSeconds: .18, fadeOutSeconds: .32 },
    cameras: Object.fromEntries(CHAPTERS.map(chapter => [chapter.id, view({ min: [-1, -1, -1], max: [1, 1, 1] }, [1.5, .3, 1])])),
    appearance: { labelWeight: .35, opacity: [
      { channel: 'case-peek', ids: ['pg:housing', 'pg:endplate-front', 'pg:endplate-rear'], minimum: .1 },
      { channel: 'focus', ids: ids.filter(id => !selected.includes(id)), minimum: 0 },
      { channel: 'bearing-focus', ids: ids.filter(id => !bearingIds.includes(id)), minimum: 0 },
      { channel: 'bearing-roll', ids: ['pg:support-bearing-front-outer'], minimum: .10 },
    ] },
  };
  // Sample authored motion before playback, including every display boundary.
  // Bounds are fixed per shot and independent of live viewer/mesh mutations.
  const draft = compilePresentationPlan(base, index), boxes = Object.fromEntries(CHAPTERS.map(c => [c.id, new Box3()]));
  const times = new Set(Array.from({ length: 1441 }, (_, i) => Math.min(DURATION - 1e-7, i * DURATION / 1440)));
  for (const c of Object.values(channels)) for (const t of [...c.rise, ...c.fall]) for (const d of [-1e-7, 0, 1e-7]) if (t + d >= 0 && t + d < DURATION) times.add(t + d);
  for (const t of times) {
    const state = draft.stateAt(t), box = boxes[state.chapter.id];
    for (const [id, bounds] of rig.boundsAtAngle(sunAngleAt(t))) if (opacity(draft, state, id) > 0) {
      for (const p of corners(bounds)) box.expandByPoint(new Vector3(...p.map((n, axis) => n + state.offsetsWorld[id][axis])));
    }
  }
  const whole = boxes.orbit.clone().union(boxes.resolve);
  const expanded = new Box3();
  for (const chapter of CHAPTERS) if (!['mesh', 'bearing'].includes(chapter.id)) expanded.union(boxes[chapter.id]);
  whole.expandByScalar(.004); expanded.expandByScalar(.004);
  boxes.mesh.expandByScalar(.003); boxes.bearing.expandByScalar(.002);
  for (const c of CHAPTERS) base.cameras[c.id] = c.id === 'mesh' ? view(boundsRecord(boxes.mesh), [.08, .12, 1], .72)
    : c.id === 'bearing' ? view(boundsRecord(boxes.bearing), [1.3, .32, 1], .78, .025)
      : ['orbit', 'resolve'].includes(c.id) ? view(boundsRecord(whole), [.7, .45, 1.3], .85)
        : view(boundsRecord(expanded), [1.6, .25, 1], .90);
  const compiled = compilePresentationPlan(override ?? base, index);
  // One authored recenter during seating, then a fixed rolling shot. Its end
  // envelope is precomputed across the entire bearing drive, never from live
  // bounds. The direction and established Atlas camera language stay intact.
  const seated = new Box3();
  for (let i = 0; i <= 160; i++) {
    const t = 25.2 + (27.6 - 25.2) * i / 160, state = compiled.stateAt(t), bounds = rig.boundsAtAngle(sunAngleAt(t));
    for (const id of bearingIds) for (const p of corners(bounds.get(id)))
      seated.expandByPoint(new Vector3(...p.map((n, axis) => n + state.offsetsWorld[id][axis])));
  }
  seated.expandByScalar(.002);
  const seatedPlan = structuredClone(compiled.plan);
  seatedPlan.cameras.bearing = { ...seatedPlan.cameras.bearing, bounds: boundsRecord(seated), minHalfHeight: .021 };
  const seatedFraming = compilePresentationPlan(seatedPlan, index).framing;
  const cameraFor = (id, aspect, localTime = 0) => {
    const open = compiled.framing.cameraFor(id, aspect, localTime);
    if (id !== 'bearing' || localTime <= 3.5) return open;
    const closed = seatedFraming.cameraFor(id, aspect, localTime);
    const p = Math.max(0, Math.min(1, (localTime - 3.5) / .7));
    const w = p ** 3 * (10 - 15 * p + 6 * p * p);
    const mix = (a, b) => a + (b - a) * w;
    return { position: open.position.map((n, i) => mix(n, closed.position[i])),
      target: open.target.map((n, i) => mix(n, closed.target[i])), halfHeight: mix(open.halfHeight, closed.halfHeight) };
  };
  const framing = { ...compiled.framing, cameraFor, annotationCameraFor: cameraFor };
  const stateAt = time => { const state = compiled.stateAt(time); return { ...state, sunAngle: sunAngleAt(state.time) }; };
  const timeline = { ...compiled, stateAt, localDisplayOffsets, TOTAL_BEATS, MUSIC_EVENTS, PLAN_REVISION };
  const presentationOpacity = (state, id) => opacity(compiled, state, id);
  return { plan: compiled.plan, timeline, annotations: compiled.annotations, framing,
    workingPoses: rig.workingPoses, appearanceCues: compiled.appearanceCues, presentationOpacity,
    cameraCuts: ['mesh', 'bearing'], rig,
    labelObstacleIds: state => ids.filter(id => presentationOpacity(state, id) >= .5),
    // All readable targets/obstacles are stationary throughout their windows.
    // Include their real working transforms and current local explosion, not
    // source-rest boxes or the bearing chapter's closed endpoints.
    labelObstacleBounds: state => new Map([...rig.boundsAtAngle(state)].map(([id, bounds]) => [id, {
      min: bounds.min.map((n, axis) => n + state.offsetsWorld[id][axis]),
      max: bounds.max.map((n, axis) => n + state.offsetsWorld[id][axis]),
    }])),
  };
}
