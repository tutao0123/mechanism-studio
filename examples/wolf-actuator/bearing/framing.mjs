/** Reuse the tested component-camera language; adapt source identities only. */
import { createWolfMotorFraming } from '../detail/framing.mjs';
export { CAMERA_UP } from '../detail/framing.mjs';
export const CAMERA_REVISION = 'wolf-bearing-camera-1';
const internal = id => ({ bearing: 'motor', component: 'magnet' }[id] ?? id);
const external = id => ({ motor: 'bearing', magnet: 'component' }[id] ?? id);
export function createWolfBearingFraming(index, story) {
  const adapter = { ...story, CHAPTERS: story.CHAPTERS.map(chapter => ({ ...chapter, id: internal(chapter.id) })), bindings: { ...story.bindings, motorParts: story.bindings.bearingParts, magnets: story.bindings.smallParts, cc: [], labelMagnet: story.bindings.focus } };
  const framing = createWolfMotorFraming(index, adapter);
  return { geometryRevision: framing.geometryRevision, cameraRevision: CAMERA_REVISION, styleReference: 'detail/framing.mjs: source-component tracking before zoom; no motor geometry is used', envelopeMethod: 'Source AABB endpoint unions cover authored linear offsets, including base/inspection/rest for the original Part 1. Macro fits that actual bearing component; ghost context may leave frame.',
    envelopes: Object.fromEntries(Object.entries(framing.envelopes).map(([id, bounds]) => [external(id), bounds])),
    cameraFor: (chapterId, aspect, localTime = 0) => framing.cameraFor(internal(chapterId), aspect, localTime),
    annotationCameraFor: (chapterId, aspect) => framing.annotationCameraFor(internal(chapterId), aspect),
    stillCameraFor: (chapterId, aspect, localTime = 0) => framing.stillCameraFor(internal(chapterId), aspect, localTime) };
}
