/** The mechanism supplies only the driver coordinate. Source-body display
 * translations and presentation cues come from the compiled plan. */
import { BPM, normalizeTime, smooth } from './presentation-data.mjs';
import { createGripperPresentation } from './presentation.mjs';
export { BPM, TOTAL_BEATS, DURATION, PLAN_REVISION, CHAPTERS, GROUPS, MUSIC_EVENTS, normalizeTime, smooth } from './presentation-data.mjs';
const ramp = (b, a, z) => smooth((b - a) / (z - a));
export function localDisplayOffsets(index,offsets,Matrix4,Vector3){
 const byId=new Map(index.parts.map(p=>[p.id,p]));
 return new Map(index.parts.map(p=>{const parent=byId.get(p.parentId),v=new Vector3(...offsets[p.id]).sub(new Vector3(...(parent?offsets[parent.id]:[0,0,0])));if(parent){const inv=new Matrix4().fromArray(parent.worldMatrix).invert();v.applyMatrix4(inv).sub(new Vector3().applyMatrix4(inv));}return[p.id,v.toArray()];}));
}

export function createGripperMechanics(index) {
  const ids = new Set(index.parts.map(part => part.id));
  if (ids.size !== 11 || !ids.has('mjcf:base')) throw new Error('Retained Robotiq source index required.');
  function stateAt(seconds) {
    const beat = normalizeTime(seconds) * BPM / 60;
    const pulse = (a, b, c, d) => .72 * ramp(beat, a, b) * (1 - ramp(beat, c, d));
    return { driverAngle: pulse(1, 4, 6, 10) + pulse(55, 58, 59, 62) };
  }
  return { stateAt, localDisplayOffsets, geometryRevision: index.geometryRevision };
}

/** Preserve the score/inspection API while using the same executable plan. */
export function createGripperStory(index) { return createGripperPresentation(index).timeline; }
export const createMusicStory = createGripperStory;
