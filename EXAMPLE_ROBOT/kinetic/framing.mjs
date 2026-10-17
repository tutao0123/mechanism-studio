import { Box3, Vector3 } from 'three';

const UP = new Vector3(0, 1, 0);
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p ** 3 * (10 - 15 * p + 6 * p ** 2); };
export const CAMERA_REVISION = 'robot-kinetic-camera-1';
export const DETAIL_ORBIT = Object.freeze({ chapters: Object.freeze(['wrist', 'jaws']), degrees: 15, startSeconds: .08, endSeconds: .95 });
const vector = (value, label) => { if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) throw new Error(`Finite world-metre ${label} required.`); return new Vector3(...value); };
const box = (bounds, label) => { const result = new Box3(vector(bounds?.min, `${label}.min`), vector(bounds?.max, `${label}.max`)); if (result.isEmpty()) throw new Error(`Reversed actual bounds: ${label}.`); return result; };
const corners = bounds => [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y => [bounds.min.z, bounds.max.z].map(z => new Vector3(x, y, z))));

/** Bounds are prepared from native source geometry and sampled joint poses once.
 * No rendered/live bounds feed back into camera movement. */
export function createKineticFraming(index, story, rig) {
  if (index?.units !== 'm' || !Array.isArray(index.parts) || typeof rig?.boundsAt !== 'function') throw new Error('Actual source index and native joint bounds are required.');
  const rest = new Map(index.parts.map(part => [part.id, box(part.worldBounds, part.id)]));
  const whole = new Box3(), expanded = new Box3(), work = new Box3(), grasp = new Box3();
  for (const [id, bounds] of rest) { whole.union(bounds); expanded.union(bounds).union(bounds.clone().translate(vector(story.MAXIMUM_OFFSETS[id], id))); }
  if (index.asset?.assembledWorldBounds) whole.union(box(index.asset.assembledWorldBounds, 'asset'));
  // Conservative transformed local AABBs, sampled at 120 Hz, plus a 1 mm guard.
  // This is presentation framing, not a collision/trajectory certificate.
  for (const chapterId of ['grasp', 'reach', 'resolve']) {
    const chapter = story.CHAPTERS.find(value => value.id === chapterId), duration = (chapter.lastBeat - chapter.firstBeat) * 60 / story.BPM;
    for (let sample = 0; sample <= Math.ceil(duration * 120); sample++) {
      const time = chapter.firstBeat * 60 / story.BPM + Math.min(duration - 1e-7, sample / 120);
      const state = story.stateAt(time), current = rig.boundsAt(state.jointValues);
      for (const [id, bounds] of current) {
        work.union(box(bounds, id));
        // The macro opening never inherits the arm's much larger reach sweep.
        if (chapterId !== 'reach' && story.details.grasp.includes(id)) grasp.union(box(bounds, id));
      }
    }
  }
  work.union(whole).expandByScalar(.001); grasp.expandByScalar(.001);
  const detailBounds = chapterId => {
    const result = new Box3();
    for (const id of story.details[chapterId]) result.union(rest.get(id).clone().translate(vector(story.MAXIMUM_OFFSETS[id], id)));
    return result;
  };
  const macroDirection = new Vector3(.4, .3, 1).normalize(), wholeDirection = new Vector3(.75, .5, 1).normalize();
  const plans = new Map([
    ['grasp', { bounds: grasp, direction: macroDirection }],
    ['reach', { bounds: work, direction: wholeDirection }],
    ['open', { bounds: expanded, direction: new Vector3(.65, .45, 1).normalize() }],
    ['wrist', { bounds: detailBounds('wrist'), direction: new Vector3(1, .4, .75).normalize() }],
    ['jaws', { bounds: detailBounds('jaws'), direction: new Vector3(.35, .3, 1).normalize() }],
    ['return', { bounds: expanded, direction: new Vector3(.4, .6, 1).normalize() }],
    ['resolve', { bounds: work, direction: wholeDirection }],
    ['loop', { bounds: grasp, direction: macroDirection }],
  ]);
  if ([...plans.values()].some(plan => plan.bounds.isEmpty())) throw new Error('Every kinetic chapter requires actual geometry.');
  const cameraFor = (chapterId, aspect, localTime = 0) => {
    if (!Number.isFinite(aspect) || aspect <= 0 || !Number.isFinite(localTime) || localTime < 0) throw new Error('Finite positive camera aspect and non-negative local time required.');
    const plan = plans.get(chapterId); if (!plan) throw new Error(`Unknown kinetic chapter: ${chapterId}.`);
    const direction = plan.direction.clone();
    if (DETAIL_ORBIT.chapters.includes(chapterId)) {
      const amount = smooth((localTime - DETAIL_ORBIT.startSeconds) / (DETAIL_ORBIT.endSeconds - DETAIL_ORBIT.startSeconds));
      direction.applyAxisAngle(UP, (1 - amount) * DETAIL_ORBIT.degrees * Math.PI / 180);
    }
    const target = plan.bounds.getCenter(new Vector3()), right = new Vector3().crossVectors(UP, direction).normalize(), up = new Vector3().crossVectors(direction, right).normalize();
    let ex = 0, ey = 0;
    for (const corner of corners(plan.bounds)) { corner.sub(target); ex = Math.max(ex, Math.abs(corner.dot(right))); ey = Math.max(ey, Math.abs(corner.dot(up))); }
    const detail = ['wrist', 'jaws'].includes(chapterId), horizontal = detail ? .74 : .80, vertical = detail ? .84 : .86;
    const halfHeight = Math.max(ey / vertical, ex / (aspect * horizontal), .001);
    const distance = Math.max(plan.bounds.getSize(new Vector3()).length() * 2, halfHeight * 2.5, .1);
    return { position: target.clone().addScaledVector(direction, distance).toArray(), target: target.toArray(), halfHeight };
  };
  return {
    geometryRevision: index.geometryRevision, cameraRevision: CAMERA_REVISION,
    boundsMethod: 'Conservative actual-link local AABBs transformed by source forward kinematics at 120 Hz for the authored working poses, with a 1 mm guard; linear editorial offsets use endpoint unions. Sampling is presentation evidence, not a continuous sweep or collision certificate.',
    envelopes: Object.fromEntries([...plans].map(([id, plan]) => [id, plan.bounds.clone()])),
    compositionMargins: { space: 'viewport-fraction', horizontalGeometryFraction: .80, verticalGeometryFraction: .86 },
    cameraFor,
    annotationCameraFor: (chapterId, aspect) => cameraFor(chapterId, aspect, DETAIL_ORBIT.endSeconds),
  };
}
