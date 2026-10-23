import { PARTS } from './spec.mjs';

export const BPM = 100, TOTAL_BEATS = 60, DURATION = 36;
export const PLAN_REVISION = 'robot-joint-atlas-36s-1';
export const CHAPTERS = [
  { id: 'whole', firstBeat: 0, lastBeat: 6, title: 'One compact robot joint.', copy: 'A motor, a planetary reducer and a supported output.', labels: [] },
  { id: 'open', firstBeat: 6, lastBeat: 14, title: 'Lift the outer layers.', copy: 'The fasteners release before the enclosure separates.', labels: [] },
  { id: 'layers', firstBeat: 14, lastBeat: 22, title: 'A place for every part.', copy: 'Motor, transmission and bearings share one axis.', labels: [['rj:motor-housing', 'Motor housing'], ['rj:ring', 'Fixed ring']] },
  { id: 'motor', firstBeat: 22, lastBeat: 32, title: 'Start with the motor.', copy: 'The magnets turn with the rotor. The coils stay fixed.', labels: [['rj:motor-stator', 'Stator'], ['rj:motor-rotor', 'Rotor']] },
  { id: 'mesh', firstBeat: 32, lastBeat: 40, title: 'Four turns in. One turn out.', copy: 'A fixed ring makes the carrier the reduced-speed output.', labels: [['rj:sun', 'Sun'], ['rj:planet-1', 'Planet']] },
  { id: 'bearing', firstBeat: 40, lastBeat: 48, title: 'Support the rotating shaft.', copy: 'The inner race drives the rolling elements. The outer race stays fixed.', labels: [['rj:support-bearing-front-inner', 'Inner race'], ['rj:support-bearing-front-cage', 'Cage']] },
  { id: 'restore', firstBeat: 48, lastBeat: 56, title: 'Every layer returns.', copy: 'Transmission, motor and enclosure seat on the same axis.', labels: [] },
  { id: 'resolve', firstBeat: 56, lastBeat: 60, title: 'From a description to a mechanism.', copy: 'Original geometry. One connected mechanical story.', labels: [] },
];
export const MUSIC_EVENTS = [
  { id: 'release', kind: 'release', beat: 6.6, partIds: ['rj:motor-endcap'], level: .35, durationBeats: 1.5 },
  { id: 'motor-lift', kind: 'motion', beat: 11.5, partIds: ['rj:motor-rotor', 'rj:motor-stator'], level: .35, durationBeats: 2 },
  { id: 'drive', kind: 'detail', beat: 29, partIds: ['rj:motor-rotor'], level: .25, durationBeats: 1 },
  { id: 'bearing', kind: 'detail', beat: 45, partIds: ['rj:support-bearing-front-cage'], level: .2, durationBeats: 1 },
  { id: 'seat', kind: 'seat', beat: 55, partIds: PARTS.map(p => p.id), level: .35, durationBeats: .5 },
];
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p ** 3 * (10 - 15 * p + 6 * p * p); };
/** Ideal kinematic inputs. Disassembly/return take place during drive holds. */
export function sunAngleAt(t) {
  const tau = 2 * Math.PI;
  return tau * (smooth(t / 3.1) + smooth((t - 17.4) / 1.6)
    + .35 * smooth((t - 21.8) / 1.9) + .65 * smooth((t - 27.0) / 1.4)
    + smooth((t - 33.6) / 2.4));
}
