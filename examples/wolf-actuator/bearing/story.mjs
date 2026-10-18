/** Original WOLF bearing A occurrences, with editorial display-only separation. */
import { createWolfStory, localDisplayOffsets, normalizeTime, BPM, DURATION, TOTAL_BEATS, SOURCE_SHA256 } from '../story.mjs';
export { localDisplayOffsets, normalizeTime, BPM, DURATION, TOTAL_BEATS, SOURCE_SHA256 };
export const PLAN_REVISION = 'wolf-bearing-study-1';
const freeze = Object.freeze;
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p ** 3 * (10 - 15 * p + 6 * p * p); };
const ramp = (beat, first, last) => smooth((beat - first) / (last - first));
const mul = (a, k) => a.map(value => value * k || 0), add = (a, b) => a.map((value, i) => value + b[i]), sub = (a, b) => a.map((value, i) => value - b[i]);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
export const CAMERA_BEATS = freeze({ bearingIn: freeze([6, 9]), repeatsIn: freeze([16, 18]), macroIn: freeze([28, 31]), macroOut: freeze([35.3, 38]), wholeOut: freeze([57.4, 60]) });

export function createWolfBearingStory(index) {
  const sourceStory = createWolfStory(index), all = new Map([...index.assemblies, ...index.parts].map(part => [part.id, part]));
  const bearing = all.get('occ-b352183e1bd0-root-953098-923');
  if (bearing?.name !== 'bearing-assembly-A <1>') throw new Error('Expected the pinned real bearing assembly A');
  const descends = part => { let parentId = part.parentId; const visited = new Set(); while (parentId) { if (parentId === bearing.id) return true; if (visited.has(parentId)) throw new Error('Cyclic source bearing ancestry'); visited.add(parentId); parentId = all.get(parentId)?.parentId; } return false; };
  const parts = index.parts.filter(descends);
  if (parts.length !== 70) throw new Error('Expected seventy actual bearing-A leaf occurrences');
  const one = (id, name) => { const part = parts.find(value => value.id === id); if (part?.name !== name) throw new Error(`Pinned bearing source occurrence changed: ${name}`); return part; };
  const outer = one('occ-b352183e1bd0-root-953098-923-852-851', 'outer-ring-A');
  const part59 = one('occ-b352183e1bd0-root-953098-923-922-861', 'Part 59'), part69 = one('occ-b352183e1bd0-root-953098-923-922-895', 'Part 69'), part62 = one('occ-b352183e1bd0-root-953098-923-922-911', 'Part 62');
  const focus = one('occ-b352183e1bd0-root-953098-923-922-864', 'Part 1');
  const large = [outer, part59, part69, part62], largeIds = new Set(large.map(part => part.id)), small = parts.filter(part => !largeIds.has(part.id));
  if (small.length !== 66 || !small.every(part => /^Part \d+$/.test(part.name) && Math.max(...part.worldBounds.max.map((value, i) => value - part.worldBounds.min[i])) < .015)) throw new Error('Expected the sixty-six small original Part N bearing pieces');
  const axis = sourceStory.editorialAxis.direction, u = sourceStory.editorialAxis.radialU, v = sourceStory.editorialAxis.radialV, center = part59.worldCenter;
  const radialFor = part => { const relative = sub(part.worldCenter, center), radial = sub(relative, mul(axis, dot(relative, axis))), size = Math.hypot(...radial); if (size < 1e-7) throw new Error('A repeated source bearing part must be off-axis'); return mul(radial, 1 / size); };
  const sorted = [...small].sort((a, b) => { const ar = radialFor(a), br = radialFor(b); return Math.atan2(dot(ar, v), dot(ar, u)) - Math.atan2(dot(br, v), dot(br, u)) || a.id.localeCompare(b.id); });
  const batches = []; let cursor = 0;
  for (let batch = 0; batch < 4; batch++) { const count = Math.ceil((sorted.length - cursor) / (4 - batch)); batches.push(sorted.slice(cursor, cursor + count).map(part => part.id)); cursor += count; }
  const maximum = Object.fromEntries(index.parts.map(part => [part.id, [0, 0, 0]]));
  maximum[outer.id] = mul(axis, .105); maximum[part69.id] = mul(axis, -.062); maximum[part59.id] = mul(axis, .053); maximum[part62.id] = mul(axis, -.030);
  for (const part of small) maximum[part.id] = add(mul(radialFor(part), .032), mul(axis, .010));
  const groups = [
    { id: 'outer-ring', ids: [outer.id], outBeat: 6, outEndBeat: 8.4, inBeat: 55, inEndBeat: 57.4, kind: 'hardware', family: 'bearing-layers' },
    { id: 'part-69', ids: [part69.id], outBeat: 9, outEndBeat: 11.4, inBeat: 52, inEndBeat: 54.4, kind: 'hardware', family: 'bearing-layers' },
    { id: 'part-59', ids: [part59.id], outBeat: 11, outEndBeat: 13, inBeat: 48, inEndBeat: 50, kind: 'hardware', family: 'bearing-layers' },
    { id: 'part-62', ids: [part62.id], outBeat: 13, outEndBeat: 15.5, inBeat: 44.5, inEndBeat: 47, kind: 'hardware', family: 'bearing-layers' },
    ...batches.map((ids, i) => ({ id: `small-sector-${i + 1}`, ids, outBeat: 16 + 1.45 * i, outEndBeat: 17.85 + 1.45 * i, inBeat: 38 + .95 * i, inEndBeat: 39.85 + .95 * i, kind: 'repeat', family: 'bearing-small-parts' })),
  ];
  const GROUPS = freeze(groups.map(group => freeze({ ...group, ids: freeze(group.ids) })));
  const FOCUS_OFFSET = freeze(add(mul(radialFor(focus), .10), mul(axis, .025)));
  const events = GROUPS.flatMap(group => [
    { id: `${group.id}-explode`, ids: group.ids, startBeat: group.outBeat, endBeat: group.outEndBeat, phase: 'explode', kind: group.kind, family: group.family },
    { id: `${group.id}-reassemble`, ids: group.ids, startBeat: group.inBeat, endBeat: group.inEndBeat, phase: 'reassemble', kind: group.kind, family: group.family },
  ]);
  events.push({ id: 'part-1-inspect-out', ids: [focus.id], startBeat: 28, endBeat: 30.5, phase: 'inspect-out', kind: 'inspection', family: 'bearing-focus' }, { id: 'part-1-inspect-in', ids: [focus.id], startBeat: 35.3, endBeat: 38, phase: 'inspect-in', kind: 'inspection', family: 'bearing-focus' });
  const MOTION_EVENTS = freeze(events.sort((a, b) => a.startBeat - b.startBeat).map(event => freeze({ ...event, ids: freeze([...event.ids]), partIds: freeze([...event.ids]), firstBeat: event.startBeat, lastBeat: event.endBeat })));
  const MAXIMUM_OFFSETS = freeze(Object.fromEntries(Object.entries(maximum).map(([id, offset]) => [id, freeze(offset)])));
  const PATH_MAXIMUM_OFFSETS = freeze({ ...MAXIMUM_OFFSETS, [focus.id]: freeze(add(MAXIMUM_OFFSETS[focus.id], FOCUS_OFFSET)) });
  const ids = parts.map(part => part.id), idSet = new Set(ids), leafIds = new Set(index.parts.map(part => part.id));
  const front = all.get(sourceStory.bindings.front);
  const CHAPTERS = freeze([
    { id: 'whole', firstBeat: 0, lastBeat: 6, title: 'Inside a robot joint.', copy: 'From the WOLF actuator to one of its bearing assemblies.', labels: [[front.id, 'Front plate']] },
    { id: 'bearing', firstBeat: 6, lastBeat: 16, title: 'Seventy connected parts.', copy: 'The outer ring and three larger components separate in sequence.', labels: [[outer.id, 'Outer ring A'], [part59.id, 'Part 59']] },
    { id: 'repeats', firstBeat: 16, lastBeat: 28, title: 'A ring of small details.', copy: 'Sixty-six small components open around the centre.', labels: [[focus.id, 'Part 1']] },
    { id: 'component', firstBeat: 28, lastBeat: 38, title: 'One component, up close.', copy: 'The original Part 1, isolated from its ring.', labels: [[focus.id, 'Part 1']] },
    { id: 'return', firstBeat: 38, lastBeat: 60, title: 'Every part finds its place.', copy: 'Small components return first. The larger layers follow.', labels: [[outer.id, 'Outer ring A']] },
    { id: 'resolve', firstBeat: 60, lastBeat: 64, title: 'Back in the WOLF assembly.', copy: 'One bearing. Seventy original components.', labels: [[front.id, 'Front plate']] },
  ].map(chapter => freeze({ ...chapter, labels: freeze(chapter.labels.map(freeze)) })));
  function stateAt(seconds) {
    let time = normalizeTime(seconds), beat = time * BPM / 60; const nearest = Math.round(beat); if (Math.abs(beat - nearest) < 1e-10) { beat = nearest; time = beat * 60 / BPM; }
    const chapterIndex = CHAPTERS.findIndex(chapter => beat >= chapter.firstBeat && beat < chapter.lastBeat), chapter = CHAPTERS[chapterIndex];
    const progress = Object.fromEntries(GROUPS.map(group => [group.id, ramp(beat, group.outBeat, group.outEndBeat) * (1 - ramp(beat, group.inBeat, group.inEndBeat))]));
    const offsetsWorld = Object.fromEntries(index.parts.map(part => [part.id, [0, 0, 0]]));
    for (const group of GROUPS) for (const id of group.ids) offsetsWorld[id] = mul(MAXIMUM_OFFSETS[id], progress[group.id]);
    const inspectionProgress = ramp(beat, 28, 30.5) * (1 - ramp(beat, 35.3, 38)); offsetsWorld[focus.id] = add(offsetsWorld[focus.id], mul(FOCUS_OFFSET, inspectionProgress));
    return { time, beat, chapter, chapterIndex, localTime: time - chapter.firstBeat * 60 / BPM, progress, inspectionProgress, offsetsWorld };
  }
  function opacityFor(state, id) {
    if (!leafIds.has(id)) return 0;
    if (!idSet.has(id)) return 1 - ramp(state.beat, 4, 6) + ramp(state.beat, 60, 61.2);
    if (id === focus.id) return 1;
    const inspect = ramp(state.beat, 28, 31) * (1 - ramp(state.beat, 35.3, 38));
    const context = largeIds.has(id) ? 1 - .78 * ramp(state.beat, 16, 18) * (1 - ramp(state.beat, 35.3, 38)) : 1;
    return context * (1 - inspect) + .12 * inspect;
  }
  const labelObstacleIds = state => index.parts.filter(part => opacityFor(state, part.id) >= .5).map(part => part.id);
  return { BPM, DURATION, TOTAL_BEATS, PLAN_REVISION, CHAPTERS, GROUPS, MOTION_EVENTS, MAXIMUM_OFFSETS, PATH_MAXIMUM_OFFSETS, FOCUS_OFFSET, CAMERA_BEATS, stateAt, normalizeTime, localDisplayOffsets, opacityFor, labelObstacleIds, detailIds: () => null, editorialAxis: sourceStory.editorialAxis,
    bindings: freeze({ bearing: bearing.id, bearingParts: freeze(ids), outerRing: outer.id, part59: part59.id, part69: part69.id, part62: part62.id, largeParts: freeze(large.map(part => part.id)), smallParts: freeze(small.map(part => part.id)), smallBatches: freeze(batches.map(freeze)), focus: focus.id, focusName: focus.name, front: front.id }) };
}
