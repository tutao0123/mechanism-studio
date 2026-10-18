import { Box3, Quaternion, Vector3 } from 'three';
export const CAMERA_UP = Object.freeze([0, 0, 1]);
export const CAMERA_REVISION = 'wolf-motor-continuous-camera-2';
const UP = new Vector3(...CAMERA_UP);
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p ** 3 * (10 - 15 * p + 6 * p * p); };
const box = record => new Box3(new Vector3(...record.min), new Vector3(...record.max));
const corners = bounds => [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y => [bounds.min.z, bounds.max.z].map(z => new Vector3(x, y, z))));
const copy = pose => ({ position: [...pose.position], target: [...pose.target], halfHeight: pose.halfHeight });
function interpolate(from, to, amount) {
  if (amount <= 0) return copy(from); if (amount >= 1) return copy(to);
  const target = new Vector3(...from.target).lerp(new Vector3(...to.target), amount);
  const a = new Vector3(...from.position).sub(new Vector3(...from.target)), b = new Vector3(...to.position).sub(new Vector3(...to.target));
  const da = a.length(), db = b.length(); a.normalize(); b.normalize();
  const turn = new Quaternion().setFromUnitVectors(a, b), rotation = new Quaternion().slerp(turn, amount);
  const distance = Math.exp(Math.log(da) * (1 - amount) + Math.log(db) * amount);
  return { position: a.applyQuaternion(rotation).multiplyScalar(distance).add(target).toArray(), target: target.toArray(), halfHeight: Math.exp(Math.log(from.halfHeight) * (1 - amount) + Math.log(to.halfHeight) * amount) };
}
function trackThenScale(from, to, targetAmount, scaleAmount) {
  const pose = interpolate(from, to, scaleAmount);
  const target = new Vector3(...from.target).lerp(new Vector3(...to.target), targetAmount);
  const eye = new Vector3(...pose.position).sub(new Vector3(...pose.target)).add(target);
  return { position: eye.toArray(), target: target.toArray(), halfHeight: pose.halfHeight };
}

/** Absolute camera choreography; a chapter boundary cannot recapture a new start.
 * All fit inputs are retained source bounds and authored path endpoints. Only the
 * original selected magnet is followed during its extra observation translation.
 * Low-opacity context may leave the macro frame; its source hierarchy stays put. */
export function createWolfMotorFraming(index, story) {
  const axis = new Vector3(...story.editorialAxis.direction), u = new Vector3(...story.editorialAxis.radialU), v = new Vector3(...story.editorialAxis.radialV);
  const records = new Map(index.parts.map(part => [part.id, { rest: box(part.worldBounds), offset: new Vector3(...story.MAXIMUM_OFFSETS[part.id]) }]));
  if ([...records.values()].some(record => record.rest.isEmpty())) throw new Error('Actual source part bounds required');
  const sourcePoints = (ids, swept = false) => ids.flatMap(id => {
    const record = records.get(id); if (!record) throw new Error(`Unknown source frame target: ${id}`);
    return swept ? [...corners(record.rest), ...corners(record.rest.clone().translate(record.offset))] : corners(record.rest);
  });
  const expandedPoints = ids => ids.flatMap(id => corners(records.get(id).rest.clone().translate(records.get(id).offset)));
  const allIds = index.parts.map(part => part.id), repeatIds = [...story.bindings.magnets, ...story.bindings.cc];
  const wholePoints = sourcePoints(allIds), motorPoints = sourcePoints(story.bindings.motorParts, true), repeatPoints = sourcePoints(repeatIds, true), repeatExpandedPoints = expandedPoints(repeatIds);
  const wholeDirection = axis.clone().multiplyScalar(.75).addScaledVector(u, .65).addScaledVector(v, .70).normalize();
  const motorDirection = axis.clone().multiplyScalar(.86).addScaledVector(u, .60).addScaledVector(v, .70).normalize();
  const turnAxis = new Vector3().crossVectors(UP, motorDirection).normalize();
  const repeatDirection = motorDirection.clone().applyAxisAngle(turnAxis, 12 * Math.PI / 180).normalize();
  function fit(points, direction, aspect, horizontal = .76, vertical = .84) {
    if (!points.length) throw new Error('An authored frame needs source geometry');
    const bounds = new Box3().setFromPoints(points), target = bounds.getCenter(new Vector3());
    const right = new Vector3().crossVectors(UP, direction).normalize(), up = new Vector3().crossVectors(direction, right).normalize();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const point of points) { const p = point.clone().sub(target), x = p.dot(right), y = p.dot(up); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    target.addScaledVector(right, (minX + maxX) / 2).addScaledVector(up, (minY + maxY) / 2);
    const halfHeight = Math.max((maxY - minY) / (2 * vertical), (maxX - minX) / (2 * aspect * horizontal), .0005), distance = Math.max(bounds.getSize(new Vector3()).length() * 2, halfHeight * 2.5, .1);
    return { position: target.clone().addScaledVector(direction, distance).toArray(), target: target.toArray(), halfHeight };
  }
  const focusRecord = records.get(story.bindings.labelMagnet), focusPath = [...corners(focusRecord.rest.clone().translate(focusRecord.offset)), ...corners(focusRecord.rest.clone().translate(new Vector3(...story.PATH_MAXIMUM_OFFSETS[story.bindings.labelMagnet])))];
  const chapterStart = new Map(story.CHAPTERS.map(chapter => [chapter.id, chapter.firstBeat]));
  const timeFor = (chapterId, localTime) => {
    if (!chapterStart.has(chapterId) || !Number.isFinite(localTime) || localTime < 0) throw new Error('Invalid authored chapter/time');
    return chapterStart.get(chapterId) + localTime * story.BPM / 60;
  };
  const checkAspect = aspect => { if (!Number.isFinite(aspect) || aspect <= 0) throw new Error('Finite positive camera aspect required'); };
  function atBeat(beat, aspect) {
    const whole = fit(wholePoints, wholeDirection, aspect), motor = fit(motorPoints, motorDirection, aspect), repeats = fit(repeatExpandedPoints, repeatDirection, aspect, .72), returning = fit(motorPoints, repeatDirection, aspect);
    const blend = (from, to, first, last) => interpolate(from, to, smooth((beat - first) / (last - first)));
    if (beat <= 6 || beat >= 60) return whole;
    if (beat < 9) return blend(whole, motor, 6, 9);
    if (beat < 16) return motor;
    if (beat < 18) return blend(motor, repeats, 16, 18);
    if (beat < 28) return repeats;
    const state = story.stateAt(beat * 60 / story.BPM), focusBounds = focusRecord.rest.clone().translate(new Vector3(...state.offsetsWorld[story.bindings.labelMagnet]));
    const macro = fit(corners(focusBounds), repeatDirection, aspect, .60, .68);
    // Locate the travelling part while the frame is still wide, then magnify.
    // A single log-zoom/target lerp would crop the part halfway through the move.
    if (beat < 31) return trackThenScale(repeats, macro, smooth((beat - 28) / 1.2), smooth((beat - 29.3) / 1.7));
    if (beat <= 35.3) return macro;
    // Reverse the visual order: widen around the travelling part, then reveal
    // the assembly target once enough surrounding space is already visible.
    if (beat < 38) return trackThenScale(macro, returning, smooth((beat - 36.8) / 1.2), smooth((beat - 35.3) / 1.6));
    if (beat < 57.4) return returning;
    return blend(returning, whole, 57.4, 60);
  }
  const envelopes = { whole: new Box3().setFromPoints(wholePoints), motor: new Box3().setFromPoints(motorPoints), repeats: new Box3().setFromPoints(repeatPoints), magnet: new Box3().setFromPoints([...motorPoints, ...focusPath]), return: new Box3().setFromPoints(motorPoints), resolve: new Box3().setFromPoints(wholePoints) };
  const annotationTimes = { whole: 1, motor: 3, repeats: 4.5, magnet: 2.5, return: 3, resolve: 1.2 };
  function cameraFor(chapterId, aspect, localTime = 0) { checkAspect(aspect); return atBeat(timeFor(chapterId, localTime), aspect); }
  function annotationCameraFor(chapterId, aspect) { return cameraFor(chapterId, aspect, annotationTimes[chapterId]); }
  function stillCameraFor(chapterId, aspect, localTime = 0) {
    checkAspect(aspect); const beat = timeFor(chapterId, localTime);
    if (chapterId !== 'magnet') return annotationCameraFor(chapterId, aspect);
    // Two fixed reduced-motion views: a wide path while the part travels, then
    // a cut to its actual still close-up. Labels exist only inside that hold.
    if (beat >= 30.5 && beat <= 35.3) return annotationCameraFor('magnet', aspect);
    return fit([...motorPoints, ...focusPath], repeatDirection, aspect);
  }
  return { geometryRevision: index.geometryRevision, cameraRevision: CAMERA_REVISION, envelopes: Object.fromEntries(Object.entries(envelopes).map(([id, bounds]) => [id, bounds.clone()])), cameraFor, annotationCameraFor, stillCameraFor,
    envelopeMethod: 'Source AABB endpoint unions cover authored linear offsets, including base/inspection/rest for the original focus magnet. Macro fits that actual part; ghost context may leave frame.' };
}
