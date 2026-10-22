/** Executable presentation data, independent of DOM, Three.js and mechanics.
 * A plan binds authored offsets, views and cues to an exact geometry revision.
 * It never derives joints, source transforms, collision clearance or sound. */
export const PRESENTATION_PLAN_SCHEMA = 'mechanism-presentation-1';
const EPSILON = 1e-10;
const own = (object, key) => Object.hasOwn(object, key);
const ensure = (condition, message) => { if (!condition) throw new TypeError(`Presentation plan: ${message}`); };
const finite = (value, path) => ensure(typeof value === 'number' && Number.isFinite(value), `${path} must be finite.`);
const text = (value, path) => ensure(typeof value === 'string' && value.trim().length > 0, `${path} must be nonempty text.`);
const object = (value, path) => ensure(value !== null && typeof value === 'object' && !Array.isArray(value), `${path} must be an object.`);
const array = (value, path) => ensure(Array.isArray(value), `${path} must be an array.`);
const unit = (value, path) => { finite(value, path); ensure(value >= 0 && value <= 1, `${path} must be in 0..1.`); };
const positive = (value, path) => { finite(value, path); ensure(value > 0, `${path} must be positive.`); };
const vector = (value, path) => { array(value, path); ensure(value.length === 3, `${path} must have three components.`); value.forEach((n, i) => finite(n, `${path}[${i}]`)); };
const allowed = (value, required, optional, path) => {
  object(value, path);
  for (const key of required) ensure(own(value, key), `${path}.${key} is required.`);
  for (const key of Object.keys(value)) ensure(required.includes(key) || optional.includes(key), `unknown field ${path}.${key}.`);
};
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const p = clamp(value); return p ** 3 * (10 - 15 * p + 6 * p * p); };
const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normal = value => { const length = Math.hypot(...value); return value.map(n => n / length); };

/** Reject values JSON would silently drop or alter. Copy before compiling so
 * neither later author edits nor mutable scene-index records affect sampling. */
function copyJson(value, path = 'plan', parents = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') { finite(value, path); return value; }
  ensure(typeof value === 'object', `${path} must contain only JSON data.`);
  ensure(!parents.has(value), `${path} contains a cycle.`);
  ensure(Array.isArray(value) || [null, Object.prototype].includes(Object.getPrototypeOf(value)), `${path} must contain only plain JSON objects.`);
  const keys = Reflect.ownKeys(value);
  ensure(keys.every(key => typeof key === 'string'), `${path} cannot have symbol keys.`);
  parents.add(value);
  let result;
  if (Array.isArray(value)) {
    ensure(keys.length === value.length + 1 && keys.includes('length'), `${path} must be a dense JSON array without extra properties.`);
    result = Array.from({ length: value.length }, (_, i) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      ensure(descriptor && own(descriptor, 'value'), `${path}[${i}] must be a JSON value.`);
      return copyJson(descriptor.value, `${path}[${i}]`, parents);
    });
  } else {
    result = Object.fromEntries(keys.map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      ensure(descriptor.enumerable && own(descriptor, 'value'), `${path}.${key} must be an enumerable JSON value.`);
      return [key, copyJson(descriptor.value, `${path}.${key}`, parents)];
    }));
  }
  parents.delete(value);
  return result;
}
function freezeDeep(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeDeep); Object.freeze(value); }
  return value;
}
function interval(value, maximum, path) {
  array(value, path);
  ensure(value.length === 2, `${path} must contain start and end.`);
  value.forEach((n, i) => finite(n, `${path}[${i}]`));
  ensure(value[0] >= 0 && value[0] < value[1] && value[1] <= maximum + EPSILON, `${path} must be ordered within 0..${maximum}.`);
}
function labelText(value, path) {
  if (typeof value === 'string') return text(value, path);
  allowed(value, ['index', 'name'], ['spec'], path);
  ensure(typeof value.index === 'string' && /^(0[1-9]|[1-9][0-9])$/.test(value.index), `${path}.index must be a two-digit string 01..99.`);
  text(value.name, `${path}.name`);
  if (own(value, 'spec')) text(value.spec, `${path}.spec`);
}

/** Compile the versioned JSON plan against { geometryRevision, parts:[{id}] }.
 * Channel names are authored keys, not built-in mechanical roles. Multiple
 * offset entries add; accent weights combine by maximum; opacity uses the
 * lowest independently authored opacity. Every call samples from absolute time. */
export function compilePresentationPlan(input, index) {
  const plan = copyJson(input);
  allowed(plan, ['schemaVersion', 'id', 'geometryRevision', 'bpm', 'durationSeconds', 'chapters', 'channels', 'offsets', 'annotations', 'cameras', 'appearance'], [], 'plan');
  ensure(plan.schemaVersion === PRESENTATION_PLAN_SCHEMA, `unsupported schemaVersion ${plan.schemaVersion}.`);
  text(plan.id, 'id'); text(plan.geometryRevision, 'geometryRevision');
  ensure(index && index.geometryRevision === plan.geometryRevision, 'geometryRevision must match the scene index.');
  array(index.parts, 'index.parts');
  const partIds = index.parts.map((part, i) => { text(part?.id, `index.parts[${i}].id`); return part.id; });
  ensure(partIds.length > 0 && new Set(partIds).size === partIds.length, 'scene-index part IDs must be nonempty and unique.');
  const parts = new Set(partIds), part = (id, path) => ensure(parts.has(id), `${path} references unknown part ID ${id}.`);
  positive(plan.bpm, 'bpm'); positive(plan.durationSeconds, 'durationSeconds');
  const BPM = plan.bpm, DURATION = plan.durationSeconds, totalBeats = DURATION * BPM / 60;
  finite(totalBeats, 'total beats');
  array(plan.chapters, 'chapters'); ensure(plan.chapters.length > 0, 'chapters cannot be empty.');
  const chapterIds = new Set();
  let previousEnd = 0;
  for (const [i, chapter] of plan.chapters.entries()) {
    const path = `chapters[${i}]`;
    allowed(chapter, ['id', 'firstBeat', 'lastBeat', 'title', 'copy', 'labels'], [], path);
    text(chapter.id, `${path}.id`); ensure(!chapterIds.has(chapter.id), `duplicate chapter ID ${chapter.id}.`); chapterIds.add(chapter.id);
    finite(chapter.firstBeat, `${path}.firstBeat`); finite(chapter.lastBeat, `${path}.lastBeat`);
    ensure(chapter.firstBeat >= 0 && chapter.lastBeat > chapter.firstBeat && chapter.firstBeat === previousEnd, `${path} must be ordered and contiguous, without gaps or overlaps.`);
    previousEnd = chapter.lastBeat;
    text(chapter.title, `${path}.title`); ensure(typeof chapter.copy === 'string', `${path}.copy must be text.`);
    array(chapter.labels, `${path}.labels`);
    ensure(chapter.labels.length <= 2, `${path} supports at most two labels in the study player.`);
    const labelIds = new Set();
    for (const [j, label] of chapter.labels.entries()) {
      const labelPath = `${path}.labels[${j}]`;
      array(label, labelPath); ensure(label.length === 2, `${labelPath} must contain a part ID and text.`);
      part(label[0], labelPath); ensure(!labelIds.has(label[0]), `${path} has duplicate label part ID ${label[0]}.`); labelIds.add(label[0]);
      labelText(label[1], `${labelPath}[1]`);
    }
  }
  ensure(Math.abs(previousEnd - totalBeats) <= EPSILON, 'chapters must cover the full durationSeconds at bpm.');
  object(plan.channels, 'channels');
  for (const [name, channel] of Object.entries(plan.channels)) {
    text(name, 'channel name');
    allowed(channel, ['rise', 'fall'], ['cutoff'], `channels.${name}`);
    interval(channel.rise, DURATION, `channels.${name}.rise`); interval(channel.fall, DURATION, `channels.${name}.fall`);
    ensure(channel.fall[0] >= channel.rise[0] && channel.fall[1] >= channel.rise[1], `channels.${name}.fall must follow its rise.`);
    if (own(channel, 'cutoff')) { finite(channel.cutoff, `channels.${name}.cutoff`); ensure(channel.cutoff >= 0 && channel.cutoff <= DURATION, `channels.${name}.cutoff must be within the timeline.`); }
  }
  const channel = (name, path) => ensure(typeof name === 'string' && own(plan.channels, name), `${path} references unknown channel ${name}.`);
  array(plan.offsets, 'offsets');
  for (const [i, offset] of plan.offsets.entries()) {
    const path = `offsets[${i}]`;
    allowed(offset, ['channel', 'vectors'], [], path); channel(offset.channel, path); object(offset.vectors, `${path}.vectors`);
    for (const [id, value] of Object.entries(offset.vectors)) { part(id, path); vector(value, `${path}.vectors.${id}`); }
  }
  allowed(plan.annotations, ['windows', 'fadeInSeconds', 'fadeOutSeconds'], [], 'annotations');
  object(plan.annotations.windows, 'annotations.windows');
  positive(plan.annotations.fadeInSeconds, 'annotations.fadeInSeconds'); positive(plan.annotations.fadeOutSeconds, 'annotations.fadeOutSeconds');
  object(plan.cameras, 'cameras');
  for (const [name, mapping] of [['annotations.windows', plan.annotations.windows], ['cameras', plan.cameras]]) {
    for (const id of Object.keys(mapping)) ensure(chapterIds.has(id), `${name} references unknown chapter ${id}.`);
    for (const id of chapterIds) ensure(own(mapping, id), `${name} is missing chapter ${id}.`);
  }
  const cameraData = new Map();
  let uniformUp, explicitUp = false;
  for (const chapter of plan.chapters) {
    const windows = plan.annotations.windows[chapter.id], length = (chapter.lastBeat - chapter.firstBeat) * 60 / BPM;
    array(windows, `annotations.windows.${chapter.id}`);
    ensure(windows.length === chapter.labels.length, `annotation windows must match labels for ${chapter.id}.`);
    let previousStart = 0;
    for (const [i, window] of windows.entries()) {
      interval(window, length, `annotations.windows.${chapter.id}[${i}]`);
      ensure(window[0] >= previousStart, `annotation windows must reveal in label order for ${chapter.id}.`); previousStart = window[0];
    }
    const camera = plan.cameras[chapter.id], path = `cameras.${chapter.id}`;
    allowed(camera, ['bounds', 'direction', 'fillX', 'fillY', 'minHalfHeight'], ['up', 'distance', 'narrow'], path);
    allowed(camera.bounds, ['min', 'max'], [], `${path}.bounds`);
    vector(camera.bounds.min, `${path}.bounds.min`); vector(camera.bounds.max, `${path}.bounds.max`);
    ensure(camera.bounds.min.every((n, i) => n <= camera.bounds.max[i]), `${path}.bounds min must not exceed max.`);
    vector(camera.direction, `${path}.direction`);
    if (own(camera, 'up')) vector(camera.up, `${path}.up`);
    const rawUp = camera.up ?? [0, 1, 0];
    for (const [name, value] of [['direction', camera.direction], ['up', rawUp]]) { const magnitude = Math.hypot(...value); ensure(Number.isFinite(magnitude) && magnitude > 0, `${path}.${name} must have finite nonzero length.`); }
    const direction = normal(camera.direction), upHint = normal(rawUp), rightRaw = cross(upHint, direction);
    // The study's OrbitControls and camera director keep one fixed up vector.
    if (uniformUp) ensure(upHint.every((n, i) => Math.abs(n - uniformUp[i]) <= EPSILON), 'camera up must be uniform across all chapters.');
    else uniformUp = upHint;
    explicitUp ||= own(camera, 'up');
    ensure(Math.hypot(...rightRaw) > 1e-12, `${path}.direction cannot be parallel to up.`);
    const right = normal(rightRaw), up = normal(cross(direction, right));
    for (const field of ['fillX', 'fillY']) { positive(camera[field], `${path}.${field}`); ensure(camera[field] <= 1, `${path}.${field} must be at most 1.`); }
    positive(camera.minHalfHeight, `${path}.minHalfHeight`);
    if (own(camera, 'distance')) positive(camera.distance, `${path}.distance`);
    if (own(camera, 'narrow')) {
      allowed(camera.narrow, ['belowAspect', 'fillX', 'fillY'], [], `${path}.narrow`);
      positive(camera.narrow.belowAspect, `${path}.narrow.belowAspect`);
      for (const field of ['fillX', 'fillY']) { positive(camera.narrow[field], `${path}.narrow.${field}`); ensure(camera.narrow[field] <= 1, `${path}.narrow.${field} must be at most 1.`); }
    }
    const target = camera.bounds.min.map((n, i) => n / 2 + camera.bounds.max[i] / 2), size = camera.bounds.min.map((n, i) => camera.bounds.max[i] - n);
    const diagonal = Math.hypot(...size); finite(diagonal, `${path}.bounds diagonal`);
    let x = 0, y = 0;
    for (let mask = 0; mask < 8; mask++) {
      const corner = target.map((n, i) => (mask & (1 << i) ? camera.bounds.max[i] : camera.bounds.min[i]) - n);
      x = Math.max(x, Math.abs(dot(corner, right))); y = Math.max(y, Math.abs(dot(corner, up)));
    }
    cameraData.set(chapter.id, { camera, target, direction, upHint, x, y, diagonal });
  }
  allowed(plan.appearance, ['labelWeight'], ['accents', 'opacity'], 'appearance');
  unit(plan.appearance.labelWeight, 'appearance.labelWeight');
  for (const type of ['accents', 'opacity']) {
    if (!own(plan.appearance, type)) continue;
    array(plan.appearance[type], `appearance.${type}`);
    for (const [i, entry] of plan.appearance[type].entries()) {
      const field = type === 'accents' ? 'weight' : 'minimum', path = `appearance.${type}[${i}]`;
      allowed(entry, ['channel', 'ids', field], [], path); channel(entry.channel, path); unit(entry[field], `${path}.${field}`); array(entry.ids, `${path}.ids`);
      ensure(new Set(entry.ids).size === entry.ids.length, `${path}.ids must be unique.`);
      entry.ids.forEach(id => part(id, path));
    }
  }
  freezeDeep(plan);
  const CHAPTERS = plan.chapters, CUE_WINDOWS = plan.annotations.windows;
  const opacityById = new Map(partIds.map(id => [id, (plan.appearance.opacity ?? []).filter(entry => entry.ids.includes(id))]));

  function normalizeTime(seconds) {
    finite(seconds, 'timeline seconds');
    let time = seconds % DURATION;
    if (time < 0) time += DURATION;
    return time < EPSILON || DURATION - time < EPSILON ? 0 : time;
  }
  function stateAt(seconds) {
    let time = normalizeTime(seconds), beat = time * BPM / 60;
    if (Math.abs(beat - Math.round(beat)) < EPSILON) { beat = Math.round(beat); time = beat * 60 / BPM; }
    if (beat >= CHAPTERS.at(-1).lastBeat || time >= DURATION) { beat = 0; time = 0; }
    const chapterIndex = CHAPTERS.findIndex(chapter => beat >= chapter.firstBeat && beat < chapter.lastBeat);
    ensure(chapterIndex >= 0, 'sample time must belong to a chapter.');
    const chapter = CHAPTERS[chapterIndex];
    const progress = Object.fromEntries(Object.entries(plan.channels).map(([name, c]) => [name, c.cutoff !== undefined && time >= c.cutoff ? 0 : clamp(smooth((time - c.rise[0]) / (c.rise[1] - c.rise[0])) * (1 - smooth((time - c.fall[0]) / (c.fall[1] - c.fall[0]))))]));
    const offsetsWorld = Object.fromEntries(partIds.map(id => [id, [0, 0, 0]]));
    for (const offset of plan.offsets) for (const [id, delta] of Object.entries(offset.vectors)) {
      for (let axis = 0; axis < 3; axis++) offsetsWorld[id][axis] += delta[axis] * progress[offset.channel];
    }
    return { time, beat, chapter, chapterIndex, localTime: time - chapter.firstBeat * 60 / BPM, progress, offsetsWorld };
  }
  function annotationCues(state, { paused = false, cameraSettled = true } = {}) {
    ensure(chapterIds.has(state?.chapter?.id), 'annotation state references an unknown chapter.'); finite(state.localTime, 'annotation localTime');
    if (!cameraSettled) return [];
    const chapter = CHAPTERS.find(chapter => chapter.id === state.chapter.id);
    return CUE_WINDOWS[chapter.id].flatMap(([start, end], i) => {
      if (state.localTime < start || state.localTime >= end) return [];
      const [id, text] = chapter.labels[i];
      const opacity = paused ? 1 : Math.max(0, Math.min(1, (state.localTime - start) / plan.annotations.fadeInSeconds, (end - state.localTime) / plan.annotations.fadeOutSeconds));
      return [{ id, text, index: i, start, end, opacity }];
    });
  }
  function cameraFor(chapterId, aspect, localTime = 0) {
    positive(aspect, 'camera aspect'); finite(localTime, 'camera localTime'); ensure(localTime >= 0, 'camera localTime cannot be negative.');
    ensure(cameraData.has(chapterId), `unknown camera chapter ${chapterId}.`);
    const { camera, target, direction, upHint, x, y, diagonal } = cameraData.get(chapterId);
    const fill = camera.narrow && aspect < camera.narrow.belowAspect ? camera.narrow : camera;
    const halfHeight = Math.max(y / fill.fillY, x / (aspect * fill.fillX), camera.minHalfHeight);
    const distance = camera.distance ?? Math.max(diagonal * 2, halfHeight * 3, 1);
    finite(halfHeight, 'camera halfHeight'); finite(distance, 'camera distance');
    return { position: target.map((n, i) => n + direction[i] * distance), target: [...target], halfHeight, ...(camera.up ? { up: [...upHint] } : {}) };
  }
  const progressFor = (state, name) => { const value = state?.progress?.[name]; unit(value, `state.progress.${name}`); return value; };
  function appearanceCues(state, labels = []) {
    array(labels, 'appearance labels');
    const weights = new Map();
    const add = (id, value) => weights.set(id, Math.max(weights.get(id) ?? 0, value));
    for (const label of labels) { part(label?.id, 'appearance label'); unit(label.opacity, 'appearance label opacity'); add(label.id, label.opacity * plan.appearance.labelWeight); }
    for (const entry of plan.appearance.accents ?? []) {
      const value = progressFor(state, entry.channel) * entry.weight;
      for (const id of entry.ids) add(id, value);
    }
    return [...weights].filter(([, weight]) => weight > 0).map(([id, weight]) => ({ id, weight }));
  }
  function presentationOpacity(state, id) {
    part(id, 'presentationOpacity');
    let opacity = 1;
    for (const entry of opacityById.get(id)) opacity = Math.min(opacity, 1 - (1 - entry.minimum) * progressFor(state, entry.channel));
    return opacity;
  }
  return Object.freeze({ plan, BPM, DURATION, CHAPTERS, normalizeTime, stateAt,
    annotations: Object.freeze({ CUE_WINDOWS, annotationCues }), framing: Object.freeze({ cameraFor, annotationCameraFor: cameraFor }), appearanceCues, presentationOpacity,
    ...(explicitUp ? { cameraUp: Object.freeze([...uniformUp]) } : {}) });
}
