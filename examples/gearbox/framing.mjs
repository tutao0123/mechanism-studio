import { Box3, Vector3 } from 'three';
import { LAYOUT, CENTRE_DISTANCE } from './spec.mjs';

/** Planned orthographic views from actual part bounds at every display-offset
 * endpoint. Envelopes are fixed per chapter; moving bounds never drive the
 * camera. The whole/open/close views share one envelope so the loop seam is
 * continuous. Rotation about a shaft axis keeps each part inside its own
 * cylindrical bounds, which the axis-aligned boxes already cover. */
export const CAMERA_REVISION = 'gearbox-framing-1';
const UP = new Vector3(0, 1, 0);
const corners = b => [b.min.x, b.max.x].flatMap(x => [b.min.y, b.max.y].flatMap(y => [b.min.z, b.max.z].map(z => new Vector3(x, y, z))));

export function createGearboxFraming(index, story) {
  const rest = new Map(index.parts.map(part => [part.id, new Box3(new Vector3(...part.worldBounds.min), new Vector3(...part.worldBounds.max))]));
  // Synchronizer sleeves, rails and forks also slide by one travel along X.
  const sliding = id => /\/(sleeve|ring-front|ring-rear|key-\d)$|shift\/(rail|fork)-/.test(id);
  const reach = (id, box) => sliding(id) ? box.clone().expandByVector(new Vector3(story.sleeveTravel, 0, 0)) : box;
  const union = (ids, offsets = []) => {
    const bounds = new Box3();
    for (const id of ids) {
      const box = reach(id, rest.get(id));
      bounds.union(box);
      for (const offset of offsets) bounds.union(box.clone().translate(new Vector3(...offset(id))));
    }
    return bounds;
  };
  const all = [...rest.keys()], internals = all.filter(id => !story.caseParts.has(id));
  const caseLift = id => story.caseParts.get(id) ?? [0, 0, 0];
  const exploded = id => Object.values(story.explode.get(id)).reduce((sum, v) => sum.map((x, i) => x + v[i]), [0, 0, 0]);
  // The 3–4 close-up: input gear, synchronizer and 3rd pair, up to the s34 rail.
  const detail = new Box3(new Vector3(LAYOUT.input.x0 - .008, -CENTRE_DISTANCE + .024, -.05), new Vector3(LAYOUT.main3.x1 + .008, .09, .05));
  const envelopes = {
    whole: union(all),
    opening: union(all, [caseLift]),
    internals: union(internals),
    exploded: union(internals, [exploded]),
    detail,
  };
  const direction = new Vector3(-.5, .42, 1).normalize(), detailDirection = new Vector3(-.22, .3, 1).normalize();
  const plans = new Map([
    ['whole', { bounds: envelopes.whole, direction, fill: .92 }],
    ['open', { bounds: envelopes.opening, direction, fill: .9 }],
    ['explode', { bounds: envelopes.exploded, direction, fill: .9 }],
    ['low', { bounds: envelopes.internals, direction, fill: .84 }],
    ['sync', { bounds: envelopes.detail, direction: detailDirection, fill: .8 }],
    ['over', { bounds: envelopes.internals, direction, fill: .84 }],
    ['close', { bounds: envelopes.whole, direction, fill: .92 }],
  ]);
  const cameraFor = (chapterId, aspect, localTime = 0) => {
    if (!(aspect > 0) || !Number.isFinite(aspect) || !Number.isFinite(localTime) || localTime < 0) throw new Error('Positive aspect and finite local time required.');
    const plan = plans.get(chapterId);
    if (!plan) throw new Error(`Unknown gearbox chapter: ${chapterId}`);
    const target = plan.bounds.getCenter(new Vector3()), d = plan.direction;
    const right = new Vector3().crossVectors(UP, d).normalize(), up = new Vector3().crossVectors(d, right).normalize();
    let x = 0, y = 0;
    for (const vertex of corners(plan.bounds)) { vertex.sub(target); x = Math.max(x, Math.abs(vertex.dot(right))); y = Math.max(y, Math.abs(vertex.dot(up))); }
    const halfHeight = Math.max(y / plan.fill, x / (aspect * plan.fill), .01);
    const distance = Math.max(plan.bounds.getSize(new Vector3()).length() * 2, halfHeight * 3, 1);
    return { position: target.clone().addScaledVector(d, distance).toArray(), target: target.toArray(), halfHeight };
  };
  return { geometryRevision: index.geometryRevision, cameraRevision: CAMERA_REVISION,
    boundsMethod: 'Actual part AABB unions at rest and at every display-offset endpoint; sliding sleeves, rings, keys, rails and forks reserve one travel. Presentation evidence, not a collision certificate.',
    envelopes, cameraFor };
}
