import { Box3, Vector3 } from 'three';
const UP = new Vector3(0, 1, 0);
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p ** 3 * (10 - 15 * p + 6 * p ** 2); };
export const DETAIL_SETTLED_SECONDS = .85;
export const CAMERA_REVISION = 'g1-framing-1';
const readBounds = (bounds, id) => {
  if (!bounds || ![...bounds.min, ...bounds.max].every(Number.isFinite)) throw new Error(`Actual bounds required: ${id}`);
  const result = new Box3(new Vector3(...bounds.min), new Vector3(...bounds.max));
  if (result.isEmpty()) throw new Error(`Empty actual source bounds: ${id}`);
  return result;
};
const corners = bounds => [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y => [bounds.min.z, bounds.max.z].map(z => new Vector3(x, y, z))));
export function createHumanoidFraming(index, story) {
  const rest = new Map(index.parts.map(part => [part.id, readBounds(part.worldBounds, part.id)]));
  const whole = new Box3(), expanded = new Box3();
  for (const [id, bounds] of rest) { whole.union(bounds); expanded.union(bounds).union(bounds.clone().translate(new Vector3(...story.MAXIMUM_OFFSETS[id]))); }
  const detail = name => {
    const bounds = new Box3();
    for (const id of story.details[name]) bounds.union(rest.get(id).clone().translate(new Vector3(...story.MAXIMUM_OFFSETS[id])));
    return bounds;
  };
  const front = new Vector3(1, .10, .50).normalize();
  const plans = new Map([
    ['whole', { bounds: whole, direction: front }],
    ['separate', { bounds: expanded, direction: new Vector3(1, .15, .62).normalize() }],
    ['upper', { bounds: detail('upper'), direction: new Vector3(1, .13, .43).normalize() }],
    ['lower', { bounds: detail('lower'), direction: new Vector3(1, .10, .40).normalize() }],
    ['return', { bounds: expanded, direction: new Vector3(1, .15, .62).normalize() }],
    ['resolve', { bounds: whole, direction: front }],
  ]);
  const cameraFor = (chapterId, aspect, localTime = 0) => {
    if (!(aspect > 0) || !Number.isFinite(aspect) || !Number.isFinite(localTime) || localTime < 0) throw new Error('Positive aspect and finite local time required.');
    const plan = plans.get(chapterId);
    if (!plan) throw new Error(`Unknown humanoid chapter: ${chapterId}`);
    const direction = plan.direction.clone(), isDetail = chapterId === 'upper' || chapterId === 'lower';
    if (isDetail) direction.applyAxisAngle(UP, (1 - smooth((localTime - .06) / (DETAIL_SETTLED_SECONDS - .06))) * 11 * Math.PI / 180);
    const target = plan.bounds.getCenter(new Vector3());
    const right = new Vector3().crossVectors(UP, direction).normalize(), up = new Vector3().crossVectors(direction, right).normalize();
    let x = 0, y = 0;
    for (const vertex of corners(plan.bounds)) { vertex.sub(target); x = Math.max(x, Math.abs(vertex.dot(right))); y = Math.max(y, Math.abs(vertex.dot(up))); }
    const halfHeight = Math.max(y / .84, x / (aspect * (isDetail ? .73 : .82)), .01);
    const distance = Math.max(plan.bounds.getSize(new Vector3()).length() * 2, halfHeight * 3, 1);
    return { position: target.clone().addScaledVector(direction, distance).toArray(), target: target.toArray(), halfHeight };
  };
  return { geometryRevision: index.geometryRevision, cameraRevision: CAMERA_REVISION, boundsMethod: 'Actual source-body world AABB unions at all linear display-offset endpoints. Detail arcs settle before labels; this is presentation evidence, not a collision certificate.', envelopes: Object.fromEntries([...plans].map(([name, plan]) => [name, plan.bounds.clone()])), cameraFor, annotationCameraFor: (name, aspect) => cameraFor(name, aspect, DETAIL_SETTLED_SECONDS) };
}
