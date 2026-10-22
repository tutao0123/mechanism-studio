import { PARTS } from './spec.mjs';

export const BPM = 100, TOTAL_BEATS = 60, DURATION = 36;
export const PLAN_REVISION = 'planetary-atlas-80parts-rolling-36s-3';
export const INSPECTION_SUN_ANGLE = 2 * Math.PI;
export const seconds = beat => beat * 60 / BPM;
export const CHAPTERS = [
  { id: 'orbit', firstBeat: 0, lastBeat: 6, title: 'Eighty parts. One mechanism.', copy: 'An authored planetary reducer, from enclosure to rolling elements.', labels: [] },
  { id: 'enclosure', firstBeat: 6, lastBeat: 14, title: 'Open the outer layers.', copy: 'Fasteners, end plates and seals reveal the transmission.', labels: [] },
  { id: 'explode', firstBeat: 14, lastBeat: 22, title: 'A place for every part.', copy: 'The casing separates from the carrier, gears and shaft supports.', labels: [['pg:housing', 'Housing'], ['pg:endplate-front', 'End plate']] },
  { id: 'approach', firstBeat: 22, lastBeat: 25, title: 'Find the driving pair.', copy: 'Follow the same sun and planet into the working mesh.', labels: [] },
  { id: 'mesh', firstBeat: 25, lastBeat: 32, title: 'Spin and orbit, together.', copy: 'The planet spins backwards while its centre travels forwards.', labels: [['pg:sun', 'Sun · 24 teeth'], ['pg:planet-1', 'Planet · 24 teeth']] },
  { id: 'bearing-approach', firstBeat: 32, lastBeat: 35, title: 'Inside one shaft support.', copy: 'The input shaft drives the inner race; the outer race stays fixed.', labels: [] },
  { id: 'bearing', firstBeat: 35, lastBeat: 46, title: 'Roll, orbit, repeat.', copy: 'The outer race stays fixed. Surface marks reveal ball spin and cage orbit.', labels: [['pg:support-bearing-front-outer', 'Outer race'], ['pg:support-bearing-front-ball-9', 'Steel ball']] },
  { id: 'restore', firstBeat: 46, lastBeat: 54, title: 'Restore every layer.', copy: 'Bearing, transmission, enclosure. The fasteners return last.', labels: [] },
  { id: 'resolve', firstBeat: 54, lastBeat: 60, title: 'Built around a four-to-one ratio.', copy: 'The 24-tooth sun drives a carrier inside the fixed 72-tooth ring.', labels: [] },
];
export const MUSIC_EVENTS = [
  { id: 'enclosure-release', kind: 'release', beat: 6.5, partIds: ['pg:housing-bolt-front-1', 'pg:housing-bolt-rear-1'], level: .4, durationBeats: 1.6 },
  { id: 'gears-lift', kind: 'motion', beat: 14.5, partIds: ['pg:sun', 'pg:planet-1', 'pg:planet-2', 'pg:planet-3'], level: .35, durationBeats: 2.1 },
  { id: 'bearing-opens', kind: 'detail', beat: 35.5, partIds: ['pg:support-bearing-front-outer', 'pg:support-bearing-front-cage'], level: .25, durationBeats: 1.1 },
  { id: 'assembly-seated', kind: 'seat', beat: 53.5, partIds: PARTS.map(part => part.id), level: .4, durationBeats: .5 },
];

const smooth = p => { p = Math.max(0, Math.min(1, p)); return p ** 3 * (10 - 15 * p + 6 * p * p); };
/** An authored time schedule of ideal positions, not a torque/acceleration simulation.
 * Four sun turns close one carrier turn. Names settle before mesh motion. */
export function sunAngleAt(time) {
  const tau = 2 * Math.PI;
  if (time < 3.2) return tau * smooth(time / 3.2);
  const detail = tau / 6 * smooth((time - 17.4) / 1.4);
  const bearing = tau * smooth((time - 25.4) / 2);
  return tau + detail + bearing + (2 * tau - tau / 6) * smooth((time - 32.4) / 3.6);
}
