import { Box3, Quaternion, Vector3 } from 'three';
import { createWolfMotorFraming } from '../detail/framing.mjs';
import { createWolfBearingFraming } from '../bearing/framing.mjs';
import { createWolfWorkingMotion } from './kinematics.mjs';
export const CAMERA_UP = Object.freeze([0, 0, 1]);
export const CAMERA_REVISION = 'wolf-complete-tour-camera-1';
const UP = new Vector3(...CAMERA_UP), smooth = value => { const p = Math.max(0, Math.min(1, value)); return p ** 3 * (10 - 15 * p + 6 * p * p); };
const corners = bounds => [bounds.min[0], bounds.max[0]].flatMap(x => [bounds.min[1], bounds.max[1]].flatMap(y => [bounds.min[2], bounds.max[2]].map(z => new Vector3(x, y, z))));
const add = (a, b) => a.map((value, i) => value + b[i]);
function interpolate(a, b, amount) {
  if (amount <= 0) return structuredClone(a); if (amount >= 1) return structuredClone(b);
  const target = new Vector3(...a.target).lerp(new Vector3(...b.target), amount), da = new Vector3(...a.position).sub(new Vector3(...a.target)), db = new Vector3(...b.position).sub(new Vector3(...b.target));
  const la = da.length(), lb = db.length(); da.normalize(); db.normalize(); const rotation = new Quaternion().slerp(new Quaternion().setFromUnitVectors(da, db), amount);
  const distance = Math.exp(Math.log(la) * (1 - amount) + Math.log(lb) * amount);
  return { position: da.applyQuaternion(rotation).multiplyScalar(distance).add(target).toArray(), target: target.toArray(), halfHeight: Math.exp(Math.log(a.halfHeight) * (1 - amount) + Math.log(b.halfHeight) * amount) };
}
export function createWolfTourFraming(index, story, rig = createWolfWorkingMotion(index)) {
  const axis = new Vector3(...story.editorialAxis.direction), u = new Vector3(...story.editorialAxis.radialU), v = new Vector3(...story.editorialAxis.radialV);
  const direction = axis.clone().multiplyScalar(.75).addScaledVector(u, .65).addScaledVector(v, .70).normalize(), motorDirection = axis.clone().multiplyScalar(.86).addScaledVector(u, .60).addScaledVector(v, .70).normalize();
  const macro = story.MACRO_MAXIMUM_OFFSETS;
  // Frame-only copied records, at the persistent whole-level observation pose.
  // Native source/rest matrices and the real scene index are never rewritten.
  const shifted = { ...index, parts: index.parts.map(part => ({ ...part, worldBounds: { min: add(part.worldBounds.min, macro[part.id]), max: add(part.worldBounds.max, macro[part.id]) }, worldCenter: add(part.worldCenter, macro[part.id]) })) };
  const motorFrame = createWolfMotorFraming(shifted, story.substories.motor), bearingFrame = createWolfBearingFraming(shifted, story.substories.bearing);
  const restPoints = index.parts.flatMap(part => corners(part.worldBounds)), expandedPoints = shifted.parts.flatMap(part => corners(part.worldBounds)), sweptPoints = [...restPoints, ...expandedPoints];
  const motorIds = new Set([...story.bindings.motor.motorParts, ...rig.rotatingIds]);
  const motionBounds = rig.rotationEnvelope(), motionPoints = [...motorIds].flatMap(id => corners(motionBounds.get(id)).map(point => point.add(new Vector3(...macro[id]))));
  function fit(points, look, aspect, horizontal = .76, vertical = .84) {
    const bounds = new Box3().setFromPoints(points), target = bounds.getCenter(new Vector3()), right = new Vector3().crossVectors(UP, look).normalize(), up = new Vector3().crossVectors(look, right).normalize();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const point of points) { const p = point.clone().sub(target), x = p.dot(right), y = p.dot(up); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    target.addScaledVector(right, (minX + maxX) / 2).addScaledVector(up, (minY + maxY) / 2);
    const halfHeight = Math.max((maxY - minY) / (2 * vertical), (maxX - minX) / (2 * aspect * horizontal), .0005), distance = Math.max(bounds.getSize(new Vector3()).length() * 2, halfHeight * 2.5, .1);
    return { position: target.clone().addScaledVector(look, distance).toArray(), target: target.toArray(), halfHeight };
  }
  const start = new Map(story.CHAPTERS.map(chapter => [chapter.id, chapter.firstBeat]));
  function beatFor(chapterId, aspect, localTime) { if (!start.has(chapterId) || !Number.isFinite(aspect) || aspect <= 0 || !Number.isFinite(localTime) || localTime < 0) throw new Error('Invalid tour camera chapter, aspect or time'); return start.get(chapterId) + localTime * story.BPM / 60; }
  function scopePose(scope, sourceBeat, aspect, { reduced = false } = {}) {
    const study = story.substories[scope], framing = scope === 'motor' ? motorFrame : bearingFrame, wide = fit(sweptPoints, direction, aspect);
    if (sourceBeat >= 57.4) { const ending = study.stateAt(57.4 * 60 / story.BPM), from = framing.cameraFor(ending.chapter.id, aspect, ending.localTime); return reduced ? wide : interpolate(from, wide, smooth((sourceBeat - 57.4) / 2.6)); }
    const state = study.stateAt(Math.max(9, sourceBeat) * 60 / story.BPM);
    return reduced ? framing.stillCameraFor(state.chapter.id, aspect, state.localTime) : framing.cameraFor(state.chapter.id, aspect, state.localTime);
  }
  function atBeat(beat, aspect, reduced = false) {
    const rest = fit(restPoints, direction, aspect), wide = fit(sweptPoints, direction, aspect), motion = fit(motionPoints, motorDirection, aspect), blend = (a, b, first, last) => reduced ? b : interpolate(a, b, smooth((beat - first) / (last - first)));
    if (beat < 8 || beat >= 124) return rest;
    if (beat < 11) return blend(rest, wide, 8, 11);
    if (beat < 20) return wide;
    if (beat < 23) return blend(wide, motion, 20, 23);
    if (beat < 26) return motion;
    if (beat < 28) return blend(motion, scopePose('motor', 9, aspect), 26, 28);
    if (beat <= 66) return scopePose('motor', story.unmapStudyBeat(story.SCOPES.motor, beat), aspect, { reduced });
    if (beat <= 68.5) return wide;
    if (beat < 72) return blend(wide, scopePose('bearing', 9, aspect), 68.5, 72);
    if (beat <= 110) return scopePose('bearing', story.unmapStudyBeat(story.SCOPES.bearing, beat), aspect, { reduced });
    if (beat < 122) return wide;
    return blend(wide, rest, 122, 124);
  }
  function cameraFor(chapterId, aspect, localTime = 0) { return atBeat(beatFor(chapterId, aspect, localTime), aspect); }
  function stillCameraFor(chapterId, aspect, localTime = 0) { return atBeat(beatFor(chapterId, aspect, localTime), aspect, true); }
  function annotationCameraFor(chapterId, aspect) {
    const chapter = story.CHAPTERS.find(value => value.id === chapterId); if (!chapter) throw new Error('Unknown tour annotation chapter');
    if (chapter.scope === 'motor' || chapter.scope === 'bearing') { const frame = chapter.scope === 'motor' ? motorFrame : bearingFrame; return frame.annotationCameraFor(chapter.sourceChapter, aspect); }
    const fixed = chapterId === 'motion' ? 24.5 : chapterId === 'overview' ? 2 : chapterId === 'resolve' ? 126 : (chapter.firstBeat + chapter.lastBeat) / 2;
    return atBeat(fixed, aspect);
  }
  const envelopePoints = [...sweptPoints, ...motionPoints];
  for (const scoped of [motorFrame, bearingFrame]) for (const bounds of Object.values(scoped.envelopes)) envelopePoints.push(...corners({ min: bounds.min.toArray(), max: bounds.max.toArray() }));
  return { geometryRevision: index.geometryRevision, cameraRevision: CAMERA_REVISION, cameraFor, stillCameraFor, annotationCameraFor, motionPrimaryIds: [...motorIds], fullEnvelope: new Box3().setFromPoints(envelopePoints),
    envelopeMethod: 'Immutable native source AABBs + whole/local/focus endpoints + analytic rigid-rotation source envelope. Component cameras operate in the persistent expanded whole frame; context may leave a macro frame.' };
}
