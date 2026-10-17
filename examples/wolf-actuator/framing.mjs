import { Box3, Vector3 } from 'three';
export const CAMERA_UP = Object.freeze([0, 0, 1]);
export const PULLBACK = Object.freeze({ chapters: Object.freeze(['rings', 'gears']), startSeconds: 3.2, endSeconds: 3.95, scale: 1.06 });
export function pullbackScale(chapter, time = 0) {
  if (!Number.isFinite(time) || time < 0) throw new Error('Camera chapter time must be finite and nonnegative.');
  if (!PULLBACK.chapters.includes(chapter)) return 1;
  const p = Math.max(0, Math.min(1, (time - PULLBACK.startSeconds) / (PULLBACK.endSeconds - PULLBACK.startSeconds)));
  return 1 + (PULLBACK.scale - 1) * p ** 3 * (10 - 15 * p + 6 * p ** 2);
}
const corners = box => {
  const points = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(new Vector3(x, y, z));
  return points;
};
export function createWolfFraming(index, story) {
  const records = index.parts.map(part => ({ id: part.id, rest: new Box3(new Vector3(...part.worldBounds.min), new Vector3(...part.worldBounds.max)), offset: new Vector3(...story.MAXIMUM_OFFSETS[part.id]) }));
  if (!records.length || records.some(record => record.rest.isEmpty())) throw new Error('Actual source bounds are required.');
  const assembled = new Box3(), swept = new Box3();
  for (const record of records) { assembled.union(record.rest); swept.union(record.rest).union(record.rest.clone().translate(record.offset)); }
  const axis = new Vector3(...story.editorialAxis.direction), u = new Vector3(...story.editorialAxis.radialU), v = new Vector3(...story.editorialAxis.radialV);
  const iso = axis.clone().multiplyScalar(.65).addScaledVector(u, .8).addScaledVector(v, .75).normalize();
  const detail = axis.clone().multiplyScalar(.9).addScaledVector(u, .5).addScaledVector(v, .6).normalize();
  const plans = new Map(story.CHAPTERS.map(chapter => {
    const ids = story.details[chapter.id];
    const bounds = ids ? records.filter(record => ids.includes(record.id)).reduce((box, record) => box.union(record.rest.clone().translate(record.offset)), new Box3()) : ['whole', 'resolve'].includes(chapter.id) ? assembled.clone() : swept.clone();
    return [chapter.id, { bounds, direction: ids ? detail : iso }];
  }));
  return {
    geometryRevision: index.geometryRevision,
    envelopes: Object.fromEntries([...plans].map(([id, plan]) => [id, plan.bounds.clone()])),
    compositionMargins: { space: 'viewport-fraction', horizontalGeometryFraction: .74, verticalGeometryFraction: .84 },
    cameraFor(chapterId, aspect, localTime = 0) {
      const plan = plans.get(chapterId); if (!plan || !Number.isFinite(aspect) || aspect <= 0) throw new Error('Unknown camera chapter or invalid aspect.');
      const target = plan.bounds.getCenter(new Vector3()), direction = plan.direction;
      const right = new Vector3().crossVectors(new Vector3(...CAMERA_UP), direction).normalize(), up = new Vector3().crossVectors(direction, right).normalize();
      let ex = 0, ey = 0;
      for (const point of corners(plan.bounds)) { point.sub(target); ex = Math.max(ex, Math.abs(point.dot(right))); ey = Math.max(ey, Math.abs(point.dot(up))); }
      const halfHeight = Math.max(ey / .84, ex / (aspect * .74), .001) * pullbackScale(chapterId, localTime);
      const distance = Math.max(plan.bounds.getSize(new Vector3()).length() * 2, halfHeight * 2.5, .1);
      return { position: target.clone().addScaledVector(direction, distance).toArray(), target: target.toArray(), halfHeight };
    },
  };
}
