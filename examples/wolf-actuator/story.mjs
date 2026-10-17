/** Bind presentation decisions to the imported STEP occurrence graph at runtime.
 * Display translations are editorial, never mates or simulated gear motion. */
export const BPM = 112;
export const TOTAL_BEATS = 64;
export const DURATION = TOTAL_BEATS * 60 / BPM;
export const PLAN_REVISION = 'wolf-explosion-1';
export const SOURCE_SHA256 = 'b352183e1bd0d55c403a6f406c3b2886a3b1b374b47cf32bcb69d4277d252e35';
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p ** 3 * (10 - 15 * p + 6 * p ** 2); };
const add = (a, b) => a.map((value, i) => value + b[i]);
const sub = (a, b) => a.map((value, i) => value - b[i]);
const mul = (a, scale) => a.map(value => { const product = value * scale; return product === 0 ? 0 : product; });
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const length = a => Math.hypot(...a);
const unit = a => { const size = length(a); if (!(size > 1e-9)) throw new Error('Source plate centres cannot define an editorial axis.'); return mul(a, 1 / size); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const freeze = value => Object.freeze(value);
export function normalizeTime(seconds) {
  if (!Number.isFinite(seconds)) throw new TypeError('Timeline seconds must be finite.');
  let time = seconds % DURATION; if (time < 0) time += DURATION;
  return time < 1e-10 || DURATION - time < 1e-10 ? 0 : time;
}

export function createWolfStory(index) {
  if (index?.units !== 'm' || !Array.isArray(index.parts) || !Array.isArray(index.assemblies)) throw new Error('WOLF requires actual metre parts and assembly matrices.');
  if (index.sourceSHA256 !== SOURCE_SHA256) throw new Error('WOLF presentation is pinned to the retained STEP digest.');
  const all = new Map([...index.assemblies, ...index.parts].map(record => [record.id, record]));
  if (all.size !== index.assemblies.length + index.parts.length) throw new Error('Duplicate source occurrence identity.');
  const one = (name, records = index.parts) => {
    const matches = records.filter(part => part.name === name);
    if (matches.length !== 1) throw new Error(`Expected one real source occurrence named ${name}, received ${matches.length}.`);
    return matches[0];
  };
  const front = one('front-plate'), back = one('back-plate'), encoder = one('encoder-housing'), holder = one('encoder-magnet-holder');
  const ringA = one('internal-ring-gear-A'), ringB = one('internal-ring-gear-B'), sun = one('sun-gear');
  const shaft = one('motor-shaft'), mount = one('motor-mount-plate-8318');
  const bearingA = one('bearing-assembly-A <1>', index.assemblies), bearingB = one('bearing-assembly-B <1>', index.assemblies);
  const descends = (part, ancestorId) => {
    let parentId = part.parentId; const visited = new Set();
    while (parentId) {
      if (parentId === ancestorId) return true;
      if (visited.has(parentId)) throw new Error('Cycle in source assembly ancestry.');
      visited.add(parentId); parentId = all.get(parentId)?.parentId;
    }
    return false;
  };
  const bearingLeavesA = index.parts.filter(part => descends(part, bearingA.id)), bearingLeavesB = index.parts.filter(part => descends(part, bearingB.id));
  if (!bearingLeavesA.length || !bearingLeavesB.length) throw new Error('Both source bearing subassemblies must own real leaf geometry.');
  const planets = Array.from({ length: 12 }, (_, i) => one(`planet-${i + 1}`));
  const center = front.worldCenter.map((value, i) => (value + back.worldCenter[i]) / 2), axis = unit(sub(front.worldCenter, back.worldCenter));
  const reference = Math.abs(axis[1]) > .9 ? [0, 0, 1] : [0, 1, 0];
  const radialU = unit(cross(reference, axis)), radialV = unit(cross(axis, radialU));
  const bounds = index.asset.assembledWorldBounds, size = Math.max(...sub(bounds.max, bounds.min));
  if (!Number.isFinite(size) || size <= 0) throw new Error('Source assembly bounds must have positive extent.');
  const maximum = Object.fromEntries(index.parts.map(part => [part.id, [0, 0, 0]]));
  const set = (part, vector) => { maximum[part.id] = vector; };
  set(front, mul(axis, 1.10 * size)); set(back, mul(axis, -1.10 * size));
  set(encoder, add(mul(axis, 1.48 * size), mul(radialU, .13 * size)));
  set(holder, add(mul(axis, 1.23 * size), mul(radialU, .13 * size)));
  for (const part of bearingLeavesA) set(part, mul(axis, .72 * size));
  for (const part of bearingLeavesB) set(part, mul(axis, -.72 * size));
  set(ringA, mul(axis, .40 * size)); set(ringB, mul(axis, -.40 * size));
  set(sun, mul(axis, .08 * size));
  for (const [i, planet] of planets.entries()) {
    const relative = sub(planet.worldCenter, center), radial = sub(relative, mul(axis, dot(relative, axis)));
    const direction = length(radial) > 1e-9 ? unit(radial) : add(mul(radialU, Math.cos(i * Math.PI / 6)), mul(radialV, Math.sin(i * Math.PI / 6)));
    set(planet, add(mul(direction, .30 * size), mul(axis, .08 * size)));
  }
  const groups = [
    { id: 'covers', ids: [front.id, back.id, encoder.id, holder.id], outBeat: 8, inBeat: 52 },
    { id: 'bearings', ids: [...bearingLeavesA, ...bearingLeavesB].map(part => part.id), outBeat: 12, inBeat: 48 },
    { id: 'rings', ids: [ringA.id, ringB.id], outBeat: 16, inBeat: 44 },
    { id: 'gears', ids: [sun.id, ...planets.map(part => part.id)], outBeat: 20, inBeat: 40 },
  ];
  const moving = groups.flatMap(group => group.ids);
  if (new Set(moving).size !== moving.length) throw new Error('Editorial groups must be disjoint source occurrences.');
  const outerA = one('outer-ring-A'), outerB = one('outer-ring-B');
  const chapters = [
    { id: 'whole', firstBeat: 0, lastBeat: 8, title: 'A real robot joint, revealed.', copy: `${index.parts.length} source components. One traceable STEP assembly.`, labels: [[front.id, 'Front plate'], [encoder.id, 'Encoder housing']] },
    { id: 'structure', firstBeat: 8, lastBeat: 24, title: 'Separate the layers.', copy: 'Covers, bearing subassemblies, rings and gears unfold in four deliberate stages.', labels: [[front.id, 'Front plate'], [outerA.id, 'Bearing outer ring A']] },
    { id: 'rings', firstBeat: 24, lastBeat: 32, title: 'Two internal ring gears.', copy: 'The two source ring gears remain separate occurrences, with their original geometry intact.', labels: [[ringA.id, 'Internal ring A'], [ringB.id, 'Internal ring B']] },
    { id: 'gears', firstBeat: 32, lastBeat: 40, title: 'One sun. Twelve planets.', copy: 'Thirteen individually named source gears. Separation reveals the arrangement; rotation is not simulated.', labels: [[sun.id, 'Sun gear'], [planets[0].id, 'Planet 1 of 12']] },
    { id: 'return', firstBeat: 40, lastBeat: 56, title: 'Return in reverse order.', copy: 'Gears, rings, bearings, then covers. Display offsets resolve to the original source placement.', labels: [[shaft.id, 'Motor shaft'], [mount.id, 'Motor mount plate']] },
    { id: 'resolve', firstBeat: 56, lastBeat: 64, title: 'The source assembly, restored.', copy: 'A mechanical illustration from open CAD. Editorial motion, preserved identity.', labels: [[front.id, 'Front plate'], [encoder.id, 'Encoder housing']] },
  ];
  const CHAPTERS = freeze(chapters.map(chapter => freeze({ ...chapter, labels: freeze(chapter.labels.map(freeze)) })));
  const GROUPS = freeze(groups.map(group => freeze({ ...group, ids: freeze(group.ids) })));
  const MAXIMUM_OFFSETS = freeze(Object.fromEntries(Object.entries(maximum).map(([id, vector]) => [id, freeze(vector)])));
  function stateAt(seconds) {
    let time = normalizeTime(seconds), beat = time * BPM / 60;
    const nearest = Math.round(beat); if (Math.abs(beat - nearest) < 1e-10) { beat = nearest; time = beat * 60 / BPM; }
    const chapterIndex = CHAPTERS.findIndex(chapter => beat >= chapter.firstBeat && beat < chapter.lastBeat), chapter = CHAPTERS[chapterIndex];
    const progress = Object.fromEntries(GROUPS.map(group => [group.id, smooth((beat - group.outBeat) / 2) * (1 - smooth((beat - group.inBeat) / 2))]));
    const offsetsWorld = Object.fromEntries(index.parts.map(part => [part.id, [0, 0, 0]]));
    for (const group of GROUPS) for (const id of group.ids) offsetsWorld[id] = mul(MAXIMUM_OFFSETS[id], progress[group.id]);
    return { time, beat, chapter, chapterIndex, localTime: time - chapter.firstBeat * 60 / BPM, progress, offsetsWorld };
  }
  const details = freeze({ rings: freeze([ringA.id, ringB.id]), gears: freeze([sun.id, ...planets.map(part => part.id)]) });
  return { BPM, TOTAL_BEATS, DURATION, PLAN_REVISION, CHAPTERS, GROUPS, MAXIMUM_OFFSETS, stateAt, normalizeTime, localDisplayOffsets,
    details, detailIds: state => details[state.chapter.id] ?? null,
    editorialAxis: freeze({ direction: freeze(axis), radialU: freeze(radialU), radialV: freeze(radialV), center: freeze(center), assemblySpan: size, basis: 'Actual source front/back plate world-bound centres; this is a presentation axis, not a recovered mate.' }),
    bindings: freeze({ front: front.id, back: back.id, encoder: encoder.id, holder: holder.id, outerA: outerA.id, outerB: outerB.id, ringA: ringA.id, ringB: ringB.id, sun: sun.id, planets: freeze(planets.map(part => part.id)), shaft: shaft.id, mount: mount.id, bearingA: bearingA.id, bearingB: bearingB.id }) };
}

/** Convert an editorial world displacement through the actual immediate parent
 * matrix, including non-mesh assembly parents. Do not normalize translation. */
export function localDisplayOffsets(index, offsetsWorld, Matrix4, Vector3) {
  const all = new Map([...(index.assemblies ?? []), ...index.parts].map(part => [part.id, part])), leafIds = new Set(index.parts.map(part => part.id)), result = new Map();
  for (const part of index.parts) {
    const own = offsetsWorld[part.id];
    if (!Array.isArray(own) || own.length !== 3 || !own.every(Number.isFinite)) throw new Error(`Missing finite display offset: ${part.id}`);
    const parent = all.get(part.parentId);
    if (part.parentId && !parent) throw new Error(`Missing actual source parent matrix: ${part.parentId}`);
    let inherited = [0, 0, 0], ancestor = parent; const visited = new Set();
    while (ancestor) {
      if (visited.has(ancestor.id)) throw new Error('Cycle in source parent matrices.'); visited.add(ancestor.id);
      if (leafIds.has(ancestor.id)) { inherited = offsetsWorld[ancestor.id]; break; }
      ancestor = all.get(ancestor.parentId);
    }
    const delta = new Vector3(...own).sub(new Vector3(...inherited));
    if (parent) {
      if (parent.worldMatrix?.length !== 16 || !parent.worldMatrix.every(Number.isFinite)) throw new Error(`Invalid source parent matrix: ${parent.id}`);
      const matrix = new Matrix4().fromArray(parent.worldMatrix); if (Math.abs(matrix.determinant()) < 1e-12) throw new Error(`Singular source parent matrix: ${parent.id}`);
      const inverse = matrix.invert(), origin = new Vector3().applyMatrix4(inverse); delta.applyMatrix4(inverse).sub(origin);
    }
    result.set(part.id, delta.toArray());
  }
  return result;
}
