import { Box3, Matrix4, Vector3 } from 'three';
import { compilePresentationPlan } from '../../shared/study/plan.mjs';
import { createJointRig } from './kinematics.mjs';
import { BPM, DURATION, TOTAL_BEATS, CHAPTERS, PLAN_REVISION, MUSIC_EVENTS, sunAngleAt } from './choreography.mjs';

const corners = b => Array.from({ length: 8 }, (_, mask) => b.min.map((v, i) => mask & 1 << i ? b.max[i] : v));
const record = b => ({ min: b.min.toArray(), max: b.max.toArray() });
export function localDisplayOffsets(index, offsets, Matrix = Matrix4, Vector = Vector3) {
  const parents = new Map(index.assemblies.map(a => [a.id, a]));
  return new Map(index.parts.map(p => {
    const inverse = new Matrix().fromArray(parents.get(p.parentId).worldMatrix).invert();
    return [p.id, new Vector(...offsets[p.id]).applyMatrix4(inverse).sub(new Vector().applyMatrix4(inverse)).toArray()];
  }));
}

export function createJointPresentation(index, { plan: override } = {}) {
  const rig = createJointRig(index), ids = index.parts.map(p => p.id), known = new Set(ids);
  const channels = {}, offsets = [];
  const track = (name, rise, fall, vectors) => {
    const actual = Object.fromEntries(Object.entries(vectors).filter(([id]) => known.has(id)));
    if (!Object.keys(actual).length) return;
    channels[name] = { rise, fall }; offsets.push({ channel: name, vectors: actual });
  };
  const group = (members, vector) => Object.fromEntries(members.map(id => [id, vector]));
  // Observation offsets do not imply an assembly service procedure.
  track('case', [5.4, 7.1], [31.0, 32.1], { 'rj:housing': [.13, 0, 0], 'rj:motor-housing': [-.115, 0, .04] });
  track('caps', [4.9, 6.3], [31.8, 32.8], { 'rj:motor-endcap': [0, 0, .155], 'rj:motor-tail-bushing': [0, 0, .155], 'rj:endplate-front': [0, 0, .068], 'rj:endplate-rear': [0, 0, -.068] });
  track('motor-adapter', [6.2, 7.6], [31.0, 32.0], { 'rj:motor-adapter': [0, 0, .038] });
  track('encoder-board', [6.4, 7.8], [31.3, 32.4], { 'rj:encoder-board': [0, 0, .135], 'rj:encoder-sensor': [0, 0, .135] });
  track('encoder-target', [7.2, 8.5], [29.7, 31.0], { 'rj:encoder-disc': [0, 0, .110] });
  track('motor-core', [6.8, 8.0], [30.0, 31.2], group(ids.filter(id => /^rj:motor-(?:stator|coil-)/.test(id)), [0, 0, .062]));
  track('motor-rotor', [7.2, 8.5], [29.7, 31.0], group(ids.filter(id => /^rj:motor-(?:rotor|magnet-|shaft)/.test(id)), [0, 0, .110]));
  track('carrier', [8.4, 9.7], [29.0, 30.1], { 'rj:carrier-front': [0, 0, .034], 'rj:carrier-rear': [0, 0, -.034], 'rj:output-hub': [0, 0, -.062], 'rj:output-flange': [0, 0, -.062], 'rj:input-shaft': [0, 0, .045] });
  track('gears', [8.7, 10.0], [28.8, 30.0], group(ids.filter(id => /^rj:(?:sun|planet-\d+)$/.test(id)), [0, 0, .013]));
  track('ring', [8.7, 10.0], [28.8, 30.0], { 'rj:ring': [0, 0, -.013] });
  track('bearing-inside', [23.8, 24.3], [26.3, 27.0], { 'rj:support-bearing-front-inner': [0,0,-.013], 'rj:support-bearing-front-cage': [0,0,.013] });
  for (const [side, sign] of [['front', 1], ['rear', -1]]) {
    track(`bearing-${side}`, [7.5, 8.9], [30.0, 31.1], group(ids.filter(id => id.startsWith(`rj:support-bearing-${side}-`)), [0, 0, sign * .105]));
    track(`seal-${side}`, [6.2, 7.7], [31.3, 32.3], { [`rj:gasket-${side}`]: [0, 0, sign * .048], [`rj:shaft-seal-${side}`]: [0, 0, sign * .132], [`rj:bearing-clip-${side}`]: [0, 0, sign * .12] });
  }
  const fasteners = index.parts.filter(p => /(?:bolt|screw|washer)/.test(p.id));
  for (const [i, p] of fasteners.entries()) {
    const sign = /rear/.test(p.id) ? -1 : 1, delay = (i % 6) * .075;
    track(`fastener-${i}`, [3.9 + delay, 5.0 + delay], [32.0 + delay, 33.2], { [p.id]: [p.translation[0] * .22, p.translation[1] * .22, sign * .18] });
  }
  for (const p of index.parts.filter(p => /^rj:(?:pin|bearing)-\d+$/.test(p.id))) {
    track(p.id.replace(':', '-'), [9.0, 10.2], [29.0, 30.2], { [p.id]: [p.translation[0] * .6, p.translation[1] * .6, -.025] });
  }
  const motorIds = ids.filter(id => /^rj:motor-(?:stator|coil-|rotor|magnet-|shaft)/.test(id));
  const pairIds = ['rj:sun', 'rj:planet-1'];
  const bearingIds = ids.filter(id => id.startsWith('rj:support-bearing-front-'));
  const rolling = new Set(ids.filter(id => /support-bearing-.*(?:cage|ball-)/.test(id)));
  channels.peek = { rise: [.7, 1.2], fall: [3.0, 3.6] };
  channels.motor = { rise: [12.5, 13.2], fall: [19.1, 19.2] };
  channels.mesh = { rise: [19.0, 19.2], fall: [23.9, 24.0] };
  channels.bearing = { rise: [23.8, 24.0], fall: [28.6, 28.8] };
  channels['outer-peek'] = { rise: [24.0, 24.3], fall: [28.4, 28.6] };
  channels['rolling-visible'] = { rise: [.5, .7], fall: [33.0, 33.3] };
  const view = (bounds, direction, fill = .84) => ({ bounds, direction, fillX: fill, fillY: .82, minHalfHeight: .018, narrow: { belowAspect: .9, fillX: .72, fillY: .76 } });
  const base = { schemaVersion: 'mechanism-presentation-1', id: PLAN_REVISION, geometryRevision: index.geometryRevision,
    bpm: BPM, durationSeconds: DURATION, chapters: CHAPTERS, channels, offsets,
    annotations: { windows: { whole: [], open: [], layers: [[2.2, 4.4], [3.0, 4.4]], motor: [[.8, 3.9], [1.8, 3.9]], mesh: [[.5, 2.3], [1.2, 2.3]], bearing: [[.5, 2.3], [1.2, 2.3]], restore: [], resolve: [] }, fadeInSeconds: .18, fadeOutSeconds: .3 },
    cameras: Object.fromEntries(CHAPTERS.map(c => [c.id, view({ min: [-1,-1,-1], max: [1,1,1] }, [1,.4,1.5])])),
    appearance: { labelWeight: .28, opacity: [
      { channel: 'peek', ids: ids.filter(id => /^(?:rj:housing|rj:endplate-|rj:motor-housing|rj:motor-endcap)/.test(id)), minimum: .12 },
      { channel: 'outer-peek', ids: ['rj:support-bearing-front-outer'], minimum: .12 },
    ] },
  };
  const opacity = (plan, state, id) => {
    const focus = state.chapter.id === 'motor' ? motorIds : state.chapter.id === 'mesh' ? pairIds : state.chapter.id === 'bearing' ? bearingIds : null;
    if (focus && !focus.includes(id)) return 0;
    let amount = plan.presentationOpacity(state,id) * (rolling.has(id) ? state.progress['rolling-visible'] : 1);
    if (state.chapter.id === 'layers' && !motorIds.includes(id)) amount *= 1-state.progress.motor;
    if (state.chapter.id === 'restore' && !bearingIds.includes(id)) {
      const p = Math.min(1,Math.max(0,(state.time-28.8)/.9)); amount *= p*p*(3-2*p);
    }
    return amount;
  };
  const draft = compilePresentationPlan(base, index), boxes = Object.fromEntries(CHAPTERS.map(c => [c.id, new Box3()]));
  for (let i = 0; i < 721; i++) {
    const time = Math.min(DURATION - 1e-6, i * DURATION / 720), state = draft.stateAt(time);
    for (const [id, b] of rig.boundsAtAngle(sunAngleAt(time))) {
      const detail = state.chapter.id;
      const focus = detail === 'motor' ? motorIds : detail === 'mesh' ? pairIds : detail === 'bearing' ? bearingIds : null;
      if ((focus && !focus.includes(id)) || opacity(draft, state, id) <= 0) continue;
      for (const corner of corners(b)) boxes[detail].expandByPoint(new Vector3(...corner.map((v, axis) => v + state.offsetsWorld[id][axis])));
    }
  }
  const whole = boxes.whole.clone().union(boxes.resolve).expandByScalar(.003);
  const wide = boxes.open.clone().union(boxes.layers).union(boxes.restore).expandByScalar(.004);
  for (const c of CHAPTERS) {
    const close = ['motor','mesh','bearing'].includes(c.id);
    const bounds = close ? boxes[c.id].expandByScalar(.002) : ['whole','resolve'].includes(c.id) ? whole : wide;
    const direction = c.id === 'mesh' ? [.08,.1,1] : c.id === 'bearing' ? [1.3,.3,1] : c.id === 'motor' ? [1.3,.25,1] : ['whole','resolve'].includes(c.id) ? [1,.55,-1.4] : [1.8,.4,.85];
    base.cameras[c.id] = view(record(bounds), direction, close ? .76 : .89);
    if (c.id === 'bearing') base.cameras[c.id].minHalfHeight = .012;
  }
  const compiled = compilePresentationPlan(override ?? base, index);
  // One authored push-in while the bearing seats; the rolling shot then holds
  // a precomputed envelope. No camera is derived from live per-frame bounds.
  const seated = new Box3();
  for (let i=0;i<=90;i++) {
    const t=27+1.4*i/90, state=compiled.stateAt(t), bounds=rig.boundsAtAngle(sunAngleAt(t));
    for(const id of bearingIds) for(const p of corners(bounds.get(id))) seated.expandByPoint(new Vector3(...p.map((v,a)=>v+state.offsetsWorld[id][a])));
  }
  const seatedPlan=structuredClone(compiled.plan); seatedPlan.cameras.bearing.bounds=record(seated.expandByScalar(.002));
  const seatedFraming=compilePresentationPlan(seatedPlan,index).framing;
  const cameraFor=(id,aspect,localTime=0)=> {
    const open=compiled.framing.cameraFor(id,aspect,localTime);
    if(id!=='bearing'||localTime<=2.3) return open;
    const end=seatedFraming.cameraFor(id,aspect,localTime),p=Math.min(1,(localTime-2.3)/.7), w=p**3*(10-15*p+6*p*p);
    const mix=(a,b)=>a+(b-a)*w;
    return { position:open.position.map((v,a)=>mix(v,end.position[a])),target:open.target.map((v,a)=>mix(v,end.target[a])),halfHeight:mix(open.halfHeight,end.halfHeight) };
  };
  const framing={...compiled.framing,cameraFor,annotationCameraFor:cameraFor};
  const stateAt = time => { const s = compiled.stateAt(time); return { ...s, sunAngle: sunAngleAt(s.time) }; };
  const presentationOpacity = (state, id) => opacity(compiled, state, id);
  return { plan: compiled.plan, timeline: { ...compiled, stateAt, localDisplayOffsets, TOTAL_BEATS, MUSIC_EVENTS, PLAN_REVISION },
    annotations: compiled.annotations, framing, workingPoses: rig.workingPoses,
    appearanceCues: compiled.appearanceCues, presentationOpacity, cameraCuts: ['mesh','bearing'], rig,
    labelObstacleIds: state => ids.filter(id => presentationOpacity(state,id) >= .5),
    labelObstacleBounds: state => new Map([...rig.boundsAtAngle(state)].map(([id,b]) => [id, { min: b.min.map((v,a) => v + state.offsetsWorld[id][a]), max: b.max.map((v,a) => v + state.offsetsWorld[id][a]) }])),
  };
}
