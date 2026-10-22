/** Authored presentation inputs; executable behavior is compiled in presentation.mjs. */
import { LAYOUT } from './spec.mjs';
import { LABELS } from './labels.mjs';
export const BPM = 96;
export const TOTAL_BEATS = 64;
export const DURATION = TOTAL_BEATS * 60 / BPM;
export const PLAN_REVISION = 'gearbox-story-3';
const freeze = Object.freeze;

export const CHAPTERS = freeze([
  { id: 'whole', firstBeat: 0, lastBeat: 5, title: 'A five-speed gearbox.', copy: 'Three shafts, thirteen gears, three synchronizers. One lever chooses the path.', labels: [['gb:case/shift-lever', LABELS.lever]] },
  { id: 'open', firstBeat: 5, lastBeat: 12, title: 'Lift the case.', copy: 'The input shaft drives a countershaft below it; the mainshaft carries the output.', labels: [['gb:input/shaft', LABELS.input], ['gb:counter/shaft', LABELS.counter]] },
  { id: 'explode', firstBeat: 12, lastBeat: 22, title: 'Gears that spin free.', copy: 'Mainshaft gears turn on needle bearings until a synchronizer locks one of them to the shaft.', labels: [['gb:main/synchro-s12/sleeve', LABELS.synchro], ['gb:idler/gear', LABELS.idler]] },
  { id: 'low', firstBeat: 22, lastBeat: 32, title: 'First, then second.', copy: 'Power crosses to the countershaft and back up through one gear pair: 3.70 : 1, then 2.13 : 1.', labels: [['gb:main/gear-1', LABELS.first], ['gb:main/gear-2', LABELS.second]] },
  { id: 'sync', firstBeat: 32, lastBeat: 44, title: 'Matching speeds.', copy: 'A blocker ring brings the gear to shaft speed; then the sleeve slides over its dog teeth. Fourth is direct.', labels: [['gb:main/synchro-s34/sleeve', LABELS.sleeve], ['gb:main/synchro-s34/ring-front', LABELS.ring]] },
  { id: 'over', firstBeat: 44, lastBeat: 54, title: 'Fifth: overdrive.', copy: '0.78 : 1 — the mainshaft now turns faster than the input shaft.', labels: [['gb:main/gear-5', LABELS.fifth]] },
  { id: 'close', firstBeat: 54, lastBeat: 64, title: 'Whole again.', copy: 'An original teaching model: ideal tooth ratios, no loads, friction or wear.', labels: [] },
].map(chapter => freeze({ ...chapter, labels: freeze(chapter.labels.map(freeze)) })));

/** Case opening/closing, close-up context fade and explosion cohorts, in beats. */
export const CASE_TIMING = freeze({ open: freeze([5.4, 8]), close: freeze([54.2, 57.6]) });
export const FOCUS = freeze({ fadeIn: freeze([32, 33.4]), fadeOut: freeze([43, 44.4]), context: .2,
  ids: freeze(['gb:input/shaft', 'gb:main/shaft', 'gb:main/gear-3', 'gb:main/needle-3', 'gb:counter/gear-drive', 'gb:counter/gear-3',
    'gb:shift/fork-s34', 'gb:shift/rail-s34', ...['hub', 'sleeve', 'ring-front', 'ring-rear', 'key-1', 'key-2', 'key-3'].map(name => `gb:main/synchro-s34/${name}`)]) });
export const COHORTS = freeze({
  shift: freeze({ out: 12.0, back: 20.6, beats: 1.4 }),
  counter: freeze({ out: 12.4, back: 20.2, beats: 1.4 }),
  idler: freeze({ out: 12.8, back: 19.8, beats: 1.4 }),
  axial: freeze({ out: 13.0, back: 19.4, beats: 1.5 }),
  inner: freeze({ out: 14.2, back: 18.8, beats: 1.0 }),
});
const AXIAL_SPREAD = .55, PIVOT_X = LAYOUT.s12.centre;
/** Repeated parts (bearing balls, synchronizer keys) lift in a wave across
 * their set, ordered by distance from one corner, and return in reverse order
 * a little quicker. `span` is the beat offset between first and last;
 * `returnBeats` is the return duration of each part. */
export const WAVE = Object.freeze({ span: .6, returnBeats: .8, corner: Object.freeze([0, 1, 1]) });

const normalize = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, k) => a.map(v => v * k);

export function normalizeTime(seconds) {
  if (!Number.isFinite(seconds)) throw new TypeError('Finite timeline seconds required.');
  let time = seconds % DURATION; if (time < 0) time += DURATION;
  return time < 1e-10 || DURATION - time < 1e-10 ? 0 : time;
}

/** World display offsets at full explosion, split by cohort, for one part. */
function explodeVectors(part, assemblies) {
  const id = part.id, group = part.group ?? '', none = [0, 0, 0], result = { shift: none, counter: none, idler: none, axial: none, inner: none };
  const parent = assemblies.get(part.parentId), origin = parent ? [parent.worldMatrix[12], parent.worldMatrix[13], parent.worldMatrix[14]] : [0, 0, 0];
  const axial = x => [AXIAL_SPREAD * (x - PIVOT_X), 0, 0];
  if (group === 'shift') result.shift = [0, .11, 0];
  if (group.startsWith('counter')) result.counter = [0, -.075, 0];
  if (group === 'counter-bearing' || group === 'counter-bearing:balls') result.inner = [origin[0] < 0 ? -.045 : .045, 0, 0];
  if (group === 'idler') result.idler = [0, -.015, .07];
  if (group === 'input') result.axial = add(axial(part.worldMatrix[12]), [-.02, 0, 0]);
  if (group.startsWith('input-bearing')) result.axial = add(axial(origin[0]), [-.05, 0, 0]);
  if (group.startsWith('gear:') && !id.includes('/needle-')) result.axial = axial(part.worldMatrix[12]);
  if (group.startsWith('washer:') || group === 'output') result.axial = axial(part.worldMatrix[12]);
  if (group.startsWith('rear-bearing')) result.axial = add(axial(origin[0]), [.03, 0, 0]);
  if (group.startsWith('synchro:')) {
    result.axial = axial(origin[0]);
    if (group.endsWith(':sleeve')) result.inner = [0, .055, 0];
    if (group.endsWith(':ring-1')) result.inner = [-.012, 0, 0];
    if (group.endsWith(':ring1')) result.inner = [.012, 0, 0];
    if (group.endsWith(':keys')) {
      const [, y0, z0] = part.worldCenter, radial = normalize([0, y0 - origin[1], z0 - origin[2]]);
      result.inner = scale(radial, .014);
    }
  }
  if (group.endsWith(':balls')) {
    const radial = normalize([0, part.worldMatrix[13] - origin[1], part.worldMatrix[14] - origin[2]]);
    result.inner = add(result.inner, scale(radial, .007));
  }
  return result;
}
function caseVector(part) {
  const group = part.group ?? '';
  if (!group.startsWith('case:')) return null;
  if (group === 'case:shell') return [0, .055, 0];
  if (group === 'case:cover') return [0, .075, 0];
  if (group === 'case:front-plate' || group === 'case:bell') return [-.035, 0, 0];
  if (group === 'case:rear-plate' || group === 'case:extension') return [.035, 0, 0];
  if (group === 'case:bolts') return [part.worldCenter[0] < 0 ? -.035 : .035, 0, 0];
  throw new Error(`Unplanned case group: ${group}`);
}


export function createGearboxDisplayMetadata(index) {
  const assemblies = new Map(index.assemblies.map(a => [a.id, a]));
  const explode = new Map(index.parts.map(part => [part.id, explodeVectors(part, assemblies)]));
  const caseParts = new Map(index.parts.map(part => [part.id, caseVector(part)]).filter(([, v]) => v));
  // Wave rank of each repeated part within its own set (same parent assembly).
  const waveDelay = new Map(), sets = new Map();
  for (const part of index.parts) if (/:(balls|keys)$/.test(part.group ?? '')) { const list = sets.get(part.parentId) ?? []; list.push(part); sets.set(part.parentId, list); }
  for (const [parentId, list] of sets) {
    const origin = assemblies.get(parentId).worldMatrix.slice(12, 15), reach = part => -part.worldCenter.reduce((sum, v, i) => sum + (v - origin[i]) * WAVE.corner[i], 0);
    [...list].sort((a, b) => reach(a) - reach(b) || a.id.localeCompare(b.id)).forEach((part, rank, all) => waveDelay.set(part.id, all.length > 1 ? WAVE.span * rank / (all.length - 1) : 0));
  }
  return { explode, caseParts, waveDelay };
}
