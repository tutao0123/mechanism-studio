/** Independent 24-second editorial timeline for the cinematic gearbox.
 * The original mechanism remains authoritative. Only its clock is remapped:
 * the complete rotating interval runs at exactly 1.5x, with speed changes
 * confined to stationary assembly/explosion sequences. */
export const DURATION = 24;
export const FPS = 30;
export const SOURCE_DURATION = 40;
export const TIMELINE_REVISION = 'gearbox-cinematic-timeline-1';

const freeze = Object.freeze;
export const SOURCE_TIME_KNOTS = freeze([
  [0, 0], [2, 3.125], [5, 7.5], [8, 13.75],
  [21.125, 33.4375], [24, 40],
].map(([time, source]) => freeze({ time, source, slope: 1.5 })));

export const SHOTS = freeze([
  { id: 'hero', start: 0, end: 2, title: 'POWER. PRECISION.', subtitle: 'Inside a five-speed gearbox.' },
  { id: 'reveal', start: 2, end: 5, title: 'BENEATH THE SURFACE.', subtitle: 'Three shafts. One connected mechanism.' },
  { id: 'explode', start: 5, end: 8, title: 'EVERY PART. A PURPOSE.', subtitle: '124 parts, revealed and reunited.' },
  { id: 'power', start: 8, end: 12 + 1 / 6, title: 'POWER, ROUTED.', subtitle: 'One selected gear pair carries the drive.' },
  { id: 'sync', start: 12 + 1 / 6, end: 17 + 1 / 6, title: 'MATCH. LOCK. DRIVE.', subtitle: 'Synchronizer: match speed, then lock.' },
  { id: 'overdrive', start: 17 + 1 / 6, end: 21.125, title: 'BEYOND ONE TO ONE.', subtitle: 'Fifth gear. Output faster than input.' },
  { id: 'close', start: 21.125, end: 24, title: 'MECHANISM STUDIO.', subtitle: 'An original mechanical teaching model.' },
].map(freeze));

export function normalizeTime(seconds) {
  if (!Number.isFinite(seconds)) throw new TypeError('Finite cinematic seconds required.');
  let time = seconds % DURATION;
  if (time < 0) time += DURATION;
  return Object.is(time, -0) ? 0 : time;
}

function intervalAt(time) {
  const i = SOURCE_TIME_KNOTS.findIndex((point, index) => index < SOURCE_TIME_KNOTS.length - 1 && time < SOURCE_TIME_KNOTS[index + 1].time);
  return [SOURCE_TIME_KNOTS[Math.max(0, i)], SOURCE_TIME_KNOTS[Math.max(0, i) + 1]];
}

/** Hermite interpolation with positive endpoint derivatives. Every interval
 * has endpoint slope 1.5; equal slopes and the drive interval's 1.5 secant
 * reduce that entire interval to a straight line. */
function sourceAtLocal(time) {
  if (time === DURATION) return SOURCE_DURATION;
  const [a, b] = intervalAt(time), span = b.time - a.time, u = (time - a.time) / span;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * a.source + (u3 - 2 * u2 + u) * span * a.slope
    + (-2 * u3 + 3 * u2) * b.source + (u3 - u2) * span * b.slope;
}

export function sourceTimeAt(seconds) {
  return sourceAtLocal(normalizeTime(seconds));
}

/** Source seconds advanced per cinematic second, including across the loop. */
export function remapVelocityAt(seconds) {
  const time = normalizeTime(seconds), [a, b] = intervalAt(time), span = b.time - a.time, u = (time - a.time) / span;
  return ((6 * u * u - 6 * u) * a.source + (3 * u * u - 4 * u + 1) * span * a.slope
    + (-6 * u * u + 6 * u) * b.source + (3 * u * u - 2 * u) * span * b.slope) / span;
}

/** Inverse within one closed source interval. Unlike the looping playback
 * function, source 40 maps to cinematic 24 so audio events have a true end. */
export function cinematicTimeAt(sourceSeconds) {
  if (!Number.isFinite(sourceSeconds) || sourceSeconds < 0 || sourceSeconds > SOURCE_DURATION) throw new RangeError('Source seconds must be within 0..40.');
  if (sourceSeconds === 0) return 0;
  if (sourceSeconds === SOURCE_DURATION) return DURATION;
  let low = 0, high = DURATION;
  for (let i = 0; i < 55; i++) {
    const middle = (low + high) / 2;
    if (sourceAtLocal(middle) < sourceSeconds) low = middle; else high = middle;
  }
  return (low + high) / 2;
}

export function shotAt(seconds) {
  const time = normalizeTime(seconds), index = SHOTS.findIndex(shot => time >= shot.start && time < shot.end);
  const shot = SHOTS[index], localTime = time - shot.start;
  return { shot, index, localTime, progress: localTime / (shot.end - shot.start) };
}

/** Mechanical event times come from the unchanged source story, then use the
 * exact inverse remap. Audio accents must use these rather than shot cuts. */
export const SOURCE_EVENTS = freeze({
  caseLiftStart: 3.375, caseOpen: 5,
  explosionStart: 7.5, fullyExploded: 9.875, returnStart: 11.75, internalsReseated: 13.75,
  firstShiftStart: 14.0625, firstEngaged: 14.6875,
  syncDetailStart: 20, syncShiftStart: 23.75,
  speedMatchStart: 24.3125, speedMatchEnd: 24.6875,
  dogEngagementStart: 24.6875, fourthEngaged: 25,
  fifthShiftStart: 27.8125, fifthEngaged: 28.5625,
  coastStart: 31.75, stopped: 33.4375,
  caseCloseStart: 33.875, caseClosed: 36, loopEnd: 40,
});
export const eventTimes = freeze(Object.fromEntries(Object.entries(SOURCE_EVENTS).map(([id, source]) => [id, cinematicTimeAt(source)])));
