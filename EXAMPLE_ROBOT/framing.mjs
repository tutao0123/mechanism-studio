import { Box3, Vector3 } from 'three';

const WORLD_UP = new Vector3(0, 1, 0);
const ISO_DIRECTION = new Vector3(.75, .5, 1).normalize();
// Orthographic screen fractions: twelve percent of composition breathing room
// at either side, and seven percent above/below. These are viewport, not page,
// margins; the title, chapter copy and transport live outside the viewport.
const HORIZONTAL_FRACTION = .76;
const VERTICAL_FRACTION = .86;
const CHAPTERS = ['whole', 'structure', 'wrist', 'grip', 'return', 'resolve'];
export const PULLBACK = Object.freeze({ chapters: Object.freeze(['wrist', 'grip']), startSeconds: 3.2, endSeconds: 3.95, scale: 1.06 });
export function pullbackScale(chapterId, localTime = 0) {
  if (!Number.isFinite(localTime) || localTime < 0) throw new Error('Camera localTime must be finite and non-negative.');
  if (!PULLBACK.chapters.includes(chapterId)) return 1;
  const p = Math.max(0, Math.min(1, (localTime - PULLBACK.startSeconds) / (PULLBACK.endSeconds - PULLBACK.startSeconds)));
  return 1 + (PULLBACK.scale - 1) * p ** 3 * (10 - 15 * p + 6 * p ** 2);
}

function vector(value, label) {
  const coordinates = Array.isArray(value) ? value : [value?.x, value?.y, value?.z];
  if (coordinates.length !== 3 || !coordinates.every(Number.isFinite)) throw new Error(`${label} must be a finite three-component world-metre vector.`);
  return new Vector3(...coordinates);
}

function box(value, label) {
  if (!value) throw new Error(`${label} is missing.`);
  const result = new Box3(vector(value.min, `${label}.min`), vector(value.max, `${label}.max`));
  if (result.isEmpty()) throw new Error(`${label} has reversed bounds.`);
  return result;
}

function corners(bounds) {
  const result = [];
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) result.push(new Vector3(x, y, z));
  return result;
}

function combined(records, expanded) {
  const result = new Box3();
  for (const record of records) {
    result.union(record.rest);
    // Every corner follows an affine segment from p to p + offset. The union
    // of the two AABBs bounds that complete segment, including independently
    // staggered part progress. This does not assert collision-free dismantling.
    if (expanded) result.union(record.rest.clone().translate(record.offset));
  }
  if (result.isEmpty()) throw new Error('A camera envelope requires at least one actual part.');
  return result;
}

function fullyExpanded(records) {
  const result = new Box3();
  for (const record of records) result.union(record.rest.clone().translate(record.offset));
  return result;
}

function select(records, names) {
  const result = records.filter(record => names.has(record.id.replace(/^urdf:/, '')));
  if (result.length !== names.size) throw new Error(`The robot is missing a bound detail part: ${[...names].filter(name => !result.some(record => record.id.replace(/^urdf:/, '') === name)).join(', ')}.`);
  return result;
}

function fit(bounds, aspect, direction) {
  if (!Number.isFinite(aspect) || aspect <= 0) throw new Error('Camera aspect must be a finite positive number.');
  const target = bounds.getCenter(new Vector3());
  const right = new Vector3().crossVectors(WORLD_UP, direction).normalize();
  const up = new Vector3().crossVectors(direction, right).normalize();
  let extentX = 0, extentY = 0;
  for (const corner of corners(bounds)) {
    corner.sub(target);
    extentX = Math.max(extentX, Math.abs(corner.dot(right)));
    extentY = Math.max(extentY, Math.abs(corner.dot(up)));
  }
  const halfHeight = Math.max(extentY / VERTICAL_FRACTION, extentX / (aspect * HORIZONTAL_FRACTION), .001);
  const radius = bounds.getSize(new Vector3()).length() / 2;
  const distance = Math.max(radius * 3.4, halfHeight * 2.5, .1);
  return {
    position: target.clone().addScaledVector(direction, distance).toArray(),
    target: target.toArray(),
    halfHeight,
  };
}

/**
 * Fixed framing for the imported static URDF robot and authored display-only
 * linear offsets. Inputs are world-space metres, after the source-to-display
 * conversion. Neither source placements nor a live viewer are read or changed.
 *
 * sceneIndex.parts: [{ id, worldBounds: { min: [x,y,z], max: [x,y,z] } }]
 * maximumOffsets: Map<id, [x,y,z]> or an equivalent object; absent IDs stay put.
 * Wrist/grip chapters show their listed own bodies at full display expansion;
 * their fixed close-ups therefore use that state rather than a swept envelope.
 * Structure/return retain complete independent zero-to-one progress coverage.
 * Exposed envelopes are copies; camera plans keep private immutable inputs.
 */
export function createRobotFraming(sceneIndex, maximumOffsets = {}) {
  if (!Array.isArray(sceneIndex?.parts) || !sceneIndex.parts.length) throw new Error('The robot scene index must contain actual part bounds.');
  if (sceneIndex.units && sceneIndex.units !== 'm') throw new Error('Robot framing requires explicit display-metre bounds.');
  const offsets = maximumOffsets instanceof Map ? new Map(maximumOffsets) : new Map(Object.entries(maximumOffsets));
  const ids = new Set();
  const records = sceneIndex.parts.map(part => {
    if (typeof part.id !== 'string' || !part.id || ids.has(part.id)) throw new Error('Robot part IDs must be unique nonempty strings.');
    ids.add(part.id);
    return { id: part.id, rest: box(part.worldBounds, `${part.id}.worldBounds`), offset: offsets.has(part.id) ? vector(offsets.get(part.id), `${part.id}.maximumOffset`) : new Vector3() };
  });
  for (const id of offsets.keys()) if (!ids.has(id)) throw new Error(`Maximum offset references an unknown robot part: ${id}.`);
  const whole = combined(records, false);
  if (whole.getSize(new Vector3()).length() <= 0) throw new Error('The robot bounds have no spatial extent.');
  // The retained asset bound may be more conservative than individual mesh
  // bounds, so retain it for the assembled opening when it is supplied.
  const assetBounds = sceneIndex.asset?.assembledWorldBounds ?? sceneIndex.assetBounds;
  if (assetBounds) whole.union(box(assetBounds, 'asset.assembledWorldBounds'));
  const expanded = combined(records, true).union(whole);
  const wrist = fullyExpanded(select(records, new Set(['link4_1', 'link5_1', 'clamp1_1', 'clamp2_1'])));
  const grip = fullyExpanded(select(records, new Set(['link5_1', 'clamp1_1', 'clamp2_1'])));
  const plans = new Map([
    ['whole', { bounds: whole, direction: ISO_DIRECTION }],
    ['structure', { bounds: expanded, direction: ISO_DIRECTION }],
    ['wrist', { bounds: wrist, direction: new Vector3(.95, .4, .8).normalize() }],
    ['grip', { bounds: grip, direction: new Vector3(.4, .35, 1).normalize() }],
    ['return', { bounds: expanded, direction: ISO_DIRECTION }],
    ['resolve', { bounds: whole, direction: ISO_DIRECTION }],
  ]);

  return {
    geometryRevision: sceneIndex.geometryRevision ?? null,
    envelopes: Object.fromEntries(CHAPTERS.map(id => [id, plans.get(id).bounds.clone()])),
    compositionMargins: Object.freeze({
      space: 'viewport-fraction',
      horizontalGeometryFraction: HORIZONTAL_FRACTION,
      verticalGeometryFraction: VERTICAL_FRACTION,
    }),
    cameraFor(chapterId, aspect, localTime = 0) {
      const plan = plans.get(chapterId);
      if (!plan) throw new Error(`Unknown robot camera chapter: ${chapterId}.`);
      const result = fit(plan.bounds, aspect, plan.direction);
      result.halfHeight *= pullbackScale(chapterId, localTime);
      return result;
    },
  };
}
