/** Source-bound editorial motion. No mates, screw travel or motor physics inferred. */
import { createWolfStory, localDisplayOffsets, normalizeTime, BPM, DURATION, TOTAL_BEATS, SOURCE_SHA256 } from '../story.mjs';
export { localDisplayOffsets, normalizeTime, BPM, DURATION, TOTAL_BEATS, SOURCE_SHA256 };
export const PLAN_REVISION = 'wolf-motor-detail-2';
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p ** 3 * (10 - 15 * p + 6 * p * p); };
const mul = (a, k) => a.map(value => value * k || 0), add = (a, b) => a.map((value, i) => value + b[i]), sub = (a, b) => a.map((value, i) => value - b[i]);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0), length = a => Math.hypot(...a), unit = a => mul(a, 1 / length(a));
const freeze = Object.freeze;
const ramp = (beat, first, last) => smooth((beat - first) / (last - first));
export const CAMERA_BEATS = freeze({ motorIn: freeze([6, 9]), repeatsIn: freeze([16, 18]), macroIn: freeze([28, 31]), macroOut: freeze([35.3, 38]), wholeOut: freeze([57.4, 60]) });

export function createWolfMotorDetail(index) {
  const sourceStory = createWolfStory(index), all = new Map([...index.assemblies, ...index.parts].map(part => [part.id, part]));
  const motors = index.assemblies.filter(assembly => assembly.name === 'motor-8318 <1>');
  if (motors.length !== 1) throw new Error('Expected one real 8318 motor assembly');
  const motor = motors[0], motorParts = index.parts.filter(part => part.parentId === motor.id);
  const one = name => { const values = motorParts.filter(part => part.name === name); if (values.length !== 1) throw new Error(`Expected one source motor component: ${name}`); return values[0]; };
  const shaft = one('motor-shaft'), nut = one('motor-hex-nut'), mount = one('motor-mount-plate-8318'), rotor = one('rotor'), body = one('rotor-body'), stator = one('stator');
  const magnets = motorParts.filter(part => part.name === 'magnet'), cc = motorParts.filter(part => part.name === 'cc');
  if (motorParts.length !== 86 || magnets.length !== 40 || cc.length !== 40) throw new Error('Expected 86 real motor leaves, including forty magnet and forty generic cc source names');
  const labelMagnet = magnets.find(part => part.id === 'occ-b352183e1bd0-root-953098-1010-926'), labelCc = cc.find(part => part.id === 'occ-b352183e1bd0-root-953098-1010-929');
  if (!labelMagnet || !labelCc) throw new Error('Pinned visible source annotation targets changed');
  const axis = sourceStory.editorialAxis.direction, u = sourceStory.editorialAxis.radialU, v = sourceStory.editorialAxis.radialV, center = stator.worldCenter;
  const radialFor = part => { const relative = sub(part.worldCenter, center), radial = sub(relative, mul(axis, dot(relative, axis))); if (length(radial) < 1e-7) throw new Error('Expected off-axis actual source repeat geometry'); return unit(radial); };
  const maximum = Object.fromEntries(index.parts.map(part => [part.id, [0, 0, 0]]));
  maximum[shaft.id] = mul(axis, .10); maximum[nut.id] = mul(axis, .135); maximum[mount.id] = mul(axis, -.105);
  maximum[rotor.id] = add(mul(axis, -.042), mul(u, .072)); maximum[body.id] = add(mul(axis, .042), mul(u, -.072));
  for (const [parts, radialDistance, axialDistance] of [[magnets, .032, .032], [cc, .026, -.038]]) for (const part of parts) maximum[part.id] = add(mul(radialFor(part), radialDistance), mul(axis, axialDistance));
  // Contiguous angular sectors derive from geometry, never mesh/source order.
  const sectors = parts => [...parts].sort((a, b) => { const ar = radialFor(a), br = radialFor(b); return Math.atan2(dot(ar, v), dot(ar, u)) - Math.atan2(dot(br, v), dot(br, u)) || a.id.localeCompare(b.id); }).reduce((batches, part, i) => { batches[Math.floor(i / 10)].push(part.id); return batches; }, [[], [], [], []]);
  const magnetBatches = sectors(magnets), ccBatches = sectors(cc);
  const groups = [
    { id: 'nut', ids: [nut.id], outBeat: 6, outEndBeat: 7.4, inBeat: 56, inEndBeat: 57.4, kind: 'hardware' },
    { id: 'shaft', ids: [shaft.id], outBeat: 7.1, outEndBeat: 9.3, inBeat: 53, inEndBeat: 55.2, kind: 'hardware' },
    { id: 'mount', ids: [mount.id], outBeat: 9, outEndBeat: 11.2, inBeat: 49, inEndBeat: 51.2, kind: 'hardware' },
    { id: 'rotor', ids: [rotor.id], outBeat: 11, outEndBeat: 13.6, inBeat: 46, inEndBeat: 48.6, kind: 'hardware' },
    { id: 'body', ids: [body.id], outBeat: 12.4, outEndBeat: 15, inBeat: 44, inEndBeat: 46.6, kind: 'hardware' },
    ...magnetBatches.map((ids, i) => ({ id: `magnet-sector-${i + 1}`, ids, outBeat: 16 + 1.15 * i, outEndBeat: 17.6 + 1.15 * i, inBeat: 39.2 + .9 * i, inEndBeat: 40.8 + .9 * i, kind: 'repeat' })),
    ...ccBatches.map((ids, i) => ({ id: `cc-sector-${i + 1}`, ids, outBeat: 18.1 + 1.15 * i, outEndBeat: 19.9 + 1.15 * i, inBeat: 38 + .9 * i, inEndBeat: 39.8 + .9 * i, kind: 'repeat' })),
  ];
  const GROUPS = freeze(groups.map(group => freeze({ ...group, ids: freeze(group.ids) })));
  const FOCUS_OFFSET = freeze(add(mul(radialFor(labelMagnet), .09), mul(axis, .025)));
  const events = GROUPS.flatMap(group => [
    { id: `${group.id}-explode`, ids: group.ids, startBeat: group.outBeat, endBeat: group.outEndBeat, phase: 'explode', kind: group.kind },
    { id: `${group.id}-reassemble`, ids: group.ids, startBeat: group.inBeat, endBeat: group.inEndBeat, phase: 'reassemble', kind: group.kind },
  ]);
  events.push({ id: 'magnet-inspect-out', ids: [labelMagnet.id], startBeat: 28, endBeat: 30.5, phase: 'inspect-out', kind: 'inspection' }, { id: 'magnet-inspect-in', ids: [labelMagnet.id], startBeat: 35.3, endBeat: 38, phase: 'inspect-in', kind: 'inspection' });
  const MOTION_EVENTS = freeze(events.sort((a, b) => a.startBeat - b.startBeat).map(event => freeze({ ...event, ids: freeze([...event.ids]), partIds: freeze([...event.ids]), firstBeat: event.startBeat, lastBeat: event.endBeat })));
  const ids = motorParts.map(part => part.id), hardware = [shaft, nut, mount, rotor, body, stator].map(part => part.id), repeatIds = [...magnets, ...cc].map(part => part.id), idSet = new Set(ids), hardwareSet = new Set(hardware), leafIds = new Set(index.parts.map(part => part.id));
  const front = all.get(sourceStory.bindings.front), back = all.get(sourceStory.bindings.back);
  const CHAPTERS = freeze([
    { id: 'whole', firstBeat: 0, lastBeat: 6, title: 'Inside a robot joint.', copy: 'Meet the WOLF actuator. Follow its motor inside.', labels: [[front.id, 'Front plate']] },
    { id: 'motor', firstBeat: 6, lastBeat: 16, title: 'Layer by layer.', copy: 'The shaft, mounting plate and shells separate in sequence.', labels: [[shaft.id, 'Motor shaft'], [nut.id, 'Motor hex nut']] },
    { id: 'repeats', firstBeat: 16, lastBeat: 28, title: 'Forty. And forty.', copy: 'Forty magnets, beside forty pieces named “cc” in the original model.', labels: [[labelMagnet.id, 'Magnet'], [labelCc.id, 'Source part: cc']] },
    { id: 'magnet', firstBeat: 28, lastBeat: 38, title: 'One magnet. A closer look.', copy: 'One of forty magnets, isolated from its ring.', labels: [[labelMagnet.id, 'Magnet']] },
    { id: 'return', firstBeat: 38, lastBeat: 60, title: 'A chain of returning parts.', copy: 'The rings close. The shells, mounting plate and shaft follow.', labels: [[stator.id, 'Stator']] },
    { id: 'resolve', firstBeat: 60, lastBeat: 64, title: 'Whole again.', copy: '86 motor components. One connected assembly.', labels: [[front.id, 'Front plate']] },
  ].map(chapter => freeze({ ...chapter, labels: freeze(chapter.labels.map(freeze)) })));
  const MAXIMUM_OFFSETS = freeze(Object.fromEntries(Object.entries(maximum).map(([id, offset]) => [id, freeze(offset)])));
  const PATH_MAXIMUM_OFFSETS = freeze({ ...MAXIMUM_OFFSETS, [labelMagnet.id]: freeze(add(MAXIMUM_OFFSETS[labelMagnet.id], FOCUS_OFFSET)) });
  function stateAt(seconds) {
    let time = normalizeTime(seconds), beat = time * BPM / 60;
    const nearest = Math.round(beat); if (Math.abs(beat - nearest) < 1e-10) { beat = nearest; time = beat * 60 / BPM; }
    const chapterIndex = CHAPTERS.findIndex(chapter => beat >= chapter.firstBeat && beat < chapter.lastBeat), chapter = CHAPTERS[chapterIndex];
    const progress = Object.fromEntries(GROUPS.map(group => [group.id, ramp(beat, group.outBeat, group.outEndBeat) * (1 - ramp(beat, group.inBeat, group.inEndBeat))]));
    const offsetsWorld = Object.fromEntries(index.parts.map(part => [part.id, [0, 0, 0]]));
    for (const group of GROUPS) for (const id of group.ids) offsetsWorld[id] = mul(MAXIMUM_OFFSETS[id], progress[group.id]);
    const inspectionProgress = ramp(beat, 28, 30.5) * (1 - ramp(beat, 35.3, 38));
    offsetsWorld[labelMagnet.id] = add(offsetsWorld[labelMagnet.id], mul(FOCUS_OFFSET, inspectionProgress));
    return { time, beat, chapter, chapterIndex, localTime: time - chapter.firstBeat * 60 / BPM, progress, inspectionProgress, offsetsWorld };
  }
  function opacityFor(state, id) {
    if (!leafIds.has(id)) return 0;
    if (!idSet.has(id)) return 1 - ramp(state.beat, 4, 6) + ramp(state.beat, 60, 61.2);
    if (id === labelMagnet.id) return 1;
    const inspect = ramp(state.beat, 28, 31) * (1 - ramp(state.beat, 35.3, 38));
    const context = hardwareSet.has(id) ? 1 - .78 * ramp(state.beat, 16, 18) * (1 - ramp(state.beat, 35.3, 38)) : 1;
    return context * (1 - inspect) + .12 * inspect;
  }
  const labelObstacleIds = state => index.parts.filter(part => opacityFor(state, part.id) >= .5).map(part => part.id);
  const details = freeze({ motor: freeze(ids), repeats: freeze(repeatIds), magnet: freeze([labelMagnet.id]), return: freeze(ids) });
  return { BPM, DURATION, TOTAL_BEATS, PLAN_REVISION, CHAPTERS, GROUPS, MOTION_EVENTS, MAXIMUM_OFFSETS, PATH_MAXIMUM_OFFSETS, FOCUS_OFFSET, CAMERA_BEATS, stateAt, normalizeTime, localDisplayOffsets, details,
    detailIds: () => null, opacityFor, labelObstacleIds, editorialAxis: sourceStory.editorialAxis, inspectionOffset: FOCUS_OFFSET,
    bindings: freeze({ motor: motor.id, shaft: shaft.id, nut: nut.id, mount: mount.id, rotor: rotor.id, body: body.id, stator: stator.id, magnets: freeze(magnets.map(part => part.id)), cc: freeze(cc.map(part => part.id)), magnetBatches: freeze(magnetBatches.map(freeze)), ccBatches: freeze(ccBatches.map(freeze)), motorParts: freeze(ids), hardware: freeze(hardware), labelMagnet: labelMagnet.id, labelCc: labelCc.id, front: front.id, back: back.id }) };
}
