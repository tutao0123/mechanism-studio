/**
 * Source assembly identity and observation state. No mesh, DOM, CAD solver or
 * tessellation dependency: definition IDs describe reusable designs; occurrence
 * IDs describe their actual positions in the source assembly tree.
 */

const KINDS = new Set(['assembly', 'part']);
const ABSOLUTE_TOLERANCE = 1e-7;
const RELATIVE_TOLERANCE = 1e-9;

function fail(message) { throw new Error(`Assembly identity: ${message}`); }
function hasId(value) { return typeof value === 'string' && value.trim().length > 0; }
function near(a, b) {
  return Math.abs(a - b) <= ABSOLUTE_TOLERANCE + RELATIVE_TOLERANCE * Math.max(Math.abs(a), Math.abs(b));
}

function matrix(value, label) {
  if (!Array.isArray(value) || value.length !== 16 || value.some(n => typeof n !== 'number' || !Number.isFinite(n))) {
    fail(`${label} must contain 16 finite column-major numbers`);
  }
  if (![3, 7, 11].every(i => near(value[i], 0)) || !near(value[15], 1)) {
    fail(`${label} must be an affine matrix with bottom row [0, 0, 0, 1]`);
  }
  return value;
}

/** Column-major multiplication: multiplyMatrices(parent, local) = world. */
export function multiplyMatrices(a, b) {
  matrix(a, 'left matrix'); matrix(b, 'right matrix');
  const out = Array(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    }
  }
  return out;
}

/**
 * Convert a right-handed +Z source placement to right-handed +Y glTF.
 * Points map as metersPerUnit * [x, z, -y]. This conjugates the entire matrix;
 * local axes and rotations are converted along with translations.
 */
export function sourceToGltfMatrix(sourceMatrix, { metersPerUnit = 0.001 } = {}) {
  matrix(sourceMatrix, 'source matrix');
  if (!Number.isFinite(metersPerUnit) || metersPerUnit <= 0) fail('metersPerUnit must be positive and finite');
  const s = metersPerUnit, q = 1 / s;
  const basis = [s, 0, 0, 0, 0, 0, -s, 0, 0, s, 0, 0, 0, 0, 0, 1];
  const inverse = [q, 0, 0, 0, 0, 0, q, 0, 0, -q, 0, 0, 0, 0, 0, 1];
  return multiplyMatrices(multiplyMatrices(basis, sourceMatrix), inverse);
}

function cloneJson(value, path = 'manifest', ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || value === null) fail(`${path} must contain JSON-compatible values`);
  if (ancestors.has(value)) fail(`${path} contains a circular reference`);
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) fail(`${path} must contain plain JSON objects`);
  ancestors.add(value);
  const result = Array.isArray(value)
    ? value.map((item, i) => cloneJson(item, `${path}[${i}]`, ancestors))
    : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJson(item, `${path}.${key}`, ancestors)]));
  ancestors.delete(value);
  return result;
}

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

/** Validate, copy and freeze the source manifest, then build immutable lookups. */
export function createAssemblyIndex(input) {
  const manifest = cloneJson(input);
  if (!manifest || Array.isArray(manifest)) fail('manifest must be an object');
  if (!hasId(manifest.root_id)) fail('root_id is required');
  const units = manifest.source?.units;
  if (!(hasId(units) || (units && !Array.isArray(units) && hasId(units.length)))) {
    fail('source.units must declare a length unit');
  }
  if (!Array.isArray(manifest.definitions) || !manifest.definitions.length) fail('definitions must be a nonempty array');
  if (!Array.isArray(manifest.occurrences) || !manifest.occurrences.length) fail('occurrences must be a nonempty array');
  const definitions = new Map(), occurrences = new Map(), children = new Map();
  for (const definition of manifest.definitions) {
    if (!definition || !hasId(definition.definition_id)) fail('every definition needs a definition_id');
    if (definitions.has(definition.definition_id)) fail(`duplicate definition_id ${definition.definition_id}`);
    if (!KINDS.has(definition.kind)) fail(`definition ${definition.definition_id} has an invalid kind`);
    if (!hasId(definition.name)) fail(`definition ${definition.definition_id} needs a name`);
    if (Object.hasOwn(definition, 'geometry') && (!definition.geometry || typeof definition.geometry !== 'object' || Array.isArray(definition.geometry))) {
      fail(`definition ${definition.definition_id}.geometry must be an object when supplied`);
    }
    definitions.set(definition.definition_id, definition);
  }
  for (const occurrence of manifest.occurrences) {
    if (!occurrence || !hasId(occurrence.occurrence_id)) fail('every occurrence needs an occurrence_id');
    const id = occurrence.occurrence_id;
    if (occurrences.has(id)) fail(`duplicate occurrence_id ${id}`);
    if (!KINDS.has(occurrence.kind)) fail(`occurrence ${id} has an invalid kind`);
    if (!hasId(occurrence.label)) fail(`occurrence ${id} needs a label`);
    const definition = definitions.get(occurrence.definition_id);
    if (!definition) fail(`occurrence ${id} references missing definition ${occurrence.definition_id}`);
    if (definition.kind !== occurrence.kind) fail(`occurrence ${id} kind does not match its definition`);
    if (occurrence.parent_id !== null && !hasId(occurrence.parent_id)) fail(`occurrence ${id} needs parent_id (null only for root)`);
    if (!occurrence.source || typeof occurrence.source !== 'object' || Array.isArray(occurrence.source)) fail(`occurrence ${id} needs source metadata`);
    matrix(occurrence.localMatrixSource, `${id}.localMatrixSource`);
    matrix(occurrence.worldMatrixSource, `${id}.worldMatrixSource`);
    occurrences.set(id, occurrence); children.set(id, []);
  }
  const root = occurrences.get(manifest.root_id);
  if (!root) fail(`root_id ${manifest.root_id} is missing`);
  if (root.parent_id !== null) fail('root must have parent_id null');
  if (root.kind !== 'assembly') fail('root must be an assembly');
  for (const occurrence of occurrences.values()) {
    if (occurrence.occurrence_id === manifest.root_id) continue;
    const parent = occurrences.get(occurrence.parent_id);
    if (!parent) fail(`occurrence ${occurrence.occurrence_id} has a missing parent ${occurrence.parent_id}`);
    if (parent.kind !== 'assembly') fail(`part ${parent.occurrence_id} cannot parent another occurrence`);
    children.get(parent.occurrence_id).push(occurrence.occurrence_id);
  }
  // Check the entire graph, including cycles disconnected from the declared root.
  const complete = new Set();
  function visit(id, active = new Set()) {
    if (active.has(id)) fail(`assembly tree has a cycle at ${id}`);
    if (complete.has(id)) return;
    active.add(id);
    for (const child of children.get(id)) visit(child, active);
    active.delete(id); complete.add(id);
  }
  for (const id of occurrences.keys()) visit(id);
  const reachable = new Set();
  function mark(id) { reachable.add(id); for (const child of children.get(id)) mark(child); }
  mark(manifest.root_id);
  if (reachable.size !== occurrences.size) fail('every occurrence must descend from root_id');
  for (const occurrence of occurrences.values()) {
    const expected = occurrence.parent_id === null ? occurrence.localMatrixSource
      : multiplyMatrices(occurrences.get(occurrence.parent_id).worldMatrixSource, occurrence.localMatrixSource);
    if (expected.some((n, i) => !near(n, occurrence.worldMatrixSource[i]))) {
      fail(`${occurrence.occurrence_id}.worldMatrixSource disagrees with parent world * local`);
    }
  }
  freezeDeep(manifest);
  const occurrenceIds = Object.freeze([...occurrences.keys()]);
  const leafIds = Object.freeze(occurrenceIds.filter(id => occurrences.get(id).kind === 'part'));
  // A source assembly can own a body as well as actual child occurrences.
  // Keep its engineering kind/parentage; display ownership does not create a
  // synthetic part or erase the source assembly's own geometry.
  const displayIds = Object.freeze(occurrenceIds.filter(id => {
    const occurrence = occurrences.get(id);
    return occurrence.kind === 'part' || Object.hasOwn(definitions.get(occurrence.definition_id), 'geometry');
  }));
  const displaySet = new Set(displayIds);
  for (const [id, ids] of children) children.set(id, Object.freeze(ids));
  function requireOccurrence(id) {
    if (!occurrences.has(id)) fail(`unknown occurrence_id ${id}`);
    return occurrences.get(id);
  }
  function descendants(id, { includeSelf = false } = {}) {
    requireOccurrence(id);
    const out = includeSelf ? [id] : [];
    function append(parent) { for (const child of children.get(parent)) { out.push(child); append(child); } }
    append(id); return Object.freeze(out);
  }
  const leafCache = new Map(occurrenceIds.map(id => [id, Object.freeze(descendants(id, { includeSelf: true }).filter(child => occurrences.get(child).kind === 'part'))]));
  const displayCache = new Map(occurrenceIds.map(id => [id, Object.freeze(descendants(id, { includeSelf: true }).filter(child => displaySet.has(child)))]));
  return Object.freeze({
    manifest, rootId: manifest.root_id, occurrenceIds, leafIds, displayIds,
    get: id => occurrences.get(id),
    definition: id => definitions.get(id),
    children(id) { requireOccurrence(id); return children.get(id); },
    ancestors(id) {
      let occurrence = requireOccurrence(id); const result = [];
      while (occurrence.parent_id !== null) { result.push(occurrence.parent_id); occurrence = occurrences.get(occurrence.parent_id); }
      return Object.freeze(result); // nearest parent first
    },
    descendants,
    leafDescendants(id) { requireOccurrence(id); return leafCache.get(id); },
    displayDescendants(id) { requireOccurrence(id); return displayCache.get(id); },
  });
}

/**
 * Observation-only state. Visibility is tracked per display-bearing occurrence
 * (parts and assemblies with their own body), allowing a single child to be
 * shown after hiding its parent without exposing siblings. Every returned
 * snapshot is immutable and detached from subsequent changes.
 */
export function createAssemblyInspection(manifest) {
  const index = createAssemblyIndex(manifest), hiddenParts = new Set();
  let selectedId = null, isolatedId = null, explode = 0;
  function requireId(id) { if (!index.get(id)) fail(`unknown occurrence_id ${id}`); }
  function snapshot() {
    const isolation = isolatedId === null ? null : new Set(index.displayDescendants(isolatedId));
    const visibleParts = index.displayIds.filter(id => !hiddenParts.has(id) && (!isolation || isolation.has(id)));
    const visibleDisplays = new Set(visibleParts), visible = new Set(visibleParts);
    for (const id of visibleParts) for (const ancestor of index.ancestors(id)) visible.add(ancestor);
    const visibility = Object.fromEntries(index.occurrenceIds.map(id => {
      const displays = index.displayDescendants(id), count = displays.filter(display => visibleDisplays.has(display)).length;
      return [id, count === 0 ? 'hidden' : count === displays.length ? 'visible' : 'partial'];
    }));
    return freezeDeep({
      selected_id: selectedId,
      highlighted_ids: selectedId === null ? [] : [...index.displayDescendants(selectedId)],
      hidden_part_ids: index.displayIds.filter(id => hiddenParts.has(id)),
      isolated_id: isolatedId,
      visible_part_ids: visibleParts,
      visible_ids: index.occurrenceIds.filter(id => visible.has(id)),
      hidden_ids: index.occurrenceIds.filter(id => !visible.has(id)),
      visibility,
      explode,
    });
  }
  function setHidden(id, hidden = true) {
    requireId(id);
    if (typeof hidden !== 'boolean') fail('hidden must be a boolean');
    for (const display of index.displayDescendants(id)) hidden ? hiddenParts.add(display) : hiddenParts.delete(display);
    return snapshot();
  }
  return Object.freeze({
    index,
    snapshot,
    select(id) { if (id !== null) requireId(id); selectedId = id; return snapshot(); },
    setHidden,
    toggleHidden(id) {
      requireId(id);
      const displays = index.displayDescendants(id);
      return setHidden(id, !displays.every(display => hiddenParts.has(display)));
    },
    isolate(id = selectedId) {
      if (id === null) fail('select an occurrence before isolation');
      requireId(id); isolatedId = id; return snapshot();
    },
    clearIsolation() { isolatedId = null; return snapshot(); },
    setExplode(progress) {
      if (typeof progress !== 'number' || !Number.isFinite(progress) || progress < 0 || progress > 1) fail('explode must be between 0 and 1');
      explode = progress; return snapshot();
    },
    resetObservation() {
      hiddenParts.clear(); isolatedId = null; explode = 0;
      return snapshot(); // selection survives, matching an ordinary inspection UI
    },
  });
}
