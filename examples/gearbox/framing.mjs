import { Box3, Vector3 } from 'three';
import { LAYOUT, CENTRE_DISTANCE } from './spec.mjs';

/** Planned orthographic views from actual part bounds at every display-offset
 * endpoint. Envelopes are fixed per chapter; moving bounds never drive the
 * camera. The whole/open/close views share one envelope so the loop seam is
 * continuous. Rotation about a shaft axis keeps each part inside its own
 * cylindrical bounds, which the axis-aligned boxes already cover. */
export const CAMERA_REVISION = 'gearbox-framing-1';

export function createGearboxCameraPlan(index, story) {
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
  const cameras = Object.fromEntries([...plans].map(([id, plan]) => [id, {
    bounds: { min: plan.bounds.min.toArray(), max: plan.bounds.max.toArray() },
    direction: plan.direction.toArray(), fillX: plan.fill, fillY: plan.fill, minHalfHeight: .01,
  }]));
  return { geometryRevision: index.geometryRevision, cameraRevision: CAMERA_REVISION,
    boundsMethod: 'Actual part AABB unions at rest and at every display-offset endpoint; sliding sleeves, rings, keys, rails and forks reserve one travel. Presentation evidence, not a collision certificate.',
    envelopes, cameras };
}

/** Existing callers use the same compiled camera executor as the study. */
export function createGearboxFraming(index, story) {
  if (story.geometryRevision !== index.geometryRevision || !story.framing) throw new Error('Compiled gearbox presentation required.');
  return story.framing;
}
