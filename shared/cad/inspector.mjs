/** Source-aware inspection UI. The manifest owns identity; the viewer owns
 * display wrappers. Selection, hiding and observation never rewrite source
 * placements or turn a source assembly tree into a joint model. */

export function sameDefinitionOccurrences(index, id) {
  const occurrence = index.get(id);
  if (!occurrence) return [];
  return index.occurrenceIds.filter(candidate => index.get(candidate).definition_id === occurrence.definition_id);
}

export function describeOccurrence(index, id) {
  const occurrence = index.get(id);
  if (!occurrence) return null;
  const definition = index.definition(occurrence.definition_id);
  const path = [...index.ancestors(id)].reverse().concat(id);
  const peers = sameDefinitionOccurrences(index, id);
  return {
    id, name: occurrence.label, definitionId: occurrence.definition_id,
    definitionName: definition.name, kind: occurrence.kind,
    path, pathLabels: path.map(part => index.get(part).label),
    sourceUsage: occurrence.source.nauoEntity ?? null,
    sourceProduct: definition.source?.productDefinitionEntity ?? null,
    sourceLabel: occurrence.source.xcafLabel ?? null,
    peerIds: peers, peerPosition: peers.indexOf(id) + 1,
    displayCount: index.displayDescendants(id).length,
  };
}

/** Search preserves the actual path to every hit; it creates no fake groups. */
export function matchingTreeIds(index, query = '') {
  const term = query.trim().toLowerCase();
  if (!term) return new Set(index.occurrenceIds);
  const matches = new Set();
  for (const id of index.occurrenceIds) {
    const item = index.get(id), definition = index.definition(item.definition_id);
    if (![item.label, id, item.definition_id, definition.name, item.source.nauoEntity ?? ''].some(value => value.toLowerCase().includes(term))) continue;
    matches.add(id);
    for (const ancestor of index.ancestors(id)) matches.add(ancestor);
  }
  return matches;
}

/** Apply visibility to owned solid meshes, not enclosing wrappers: an assembly
 * can own geometry and children, and revealing a child must not reveal the
 * parent's hidden body. Each occurrence gets independent materials even when
 * its geometry is shared with another instance. */
export function createInspectionBinding(inspection, viewer, { selectionColor = '#d8e6ec', lineColor = '#272725', detailColor = '#93938b' } = {}) {
  const expected = new Set(inspection.index.displayIds);
  if (viewer.parts.size !== expected.size || [...viewer.parts.keys()].some(id => !expected.has(id))) throw new Error('Inspector display identities do not match the source manifest.');
  const records = viewer.meshes.map(mesh => {
    if (!expected.has(mesh.userData.selectionId)) throw new Error('A visible mesh has no source occurrence owner.');
    const original = mesh.material;
    mesh.material = Array.isArray(original) ? original.map(material => material.clone()) : original.clone();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    return { mesh, original, materials, colors: materials.map(material => material.color?.clone()) };
  });
  let disposed = false;
  function apply(state = inspection.snapshot()) {
    if (disposed) throw new Error('Inspector binding has been disposed.');
    const visible = new Set(state.visible_part_ids), selected = new Set(state.highlighted_ids);
    for (const binding of viewer.parts.values()) binding.display.visible = true;
    for (const { mesh, materials, colors } of records) {
      const id = mesh.userData.selectionId;
      mesh.visible = visible.has(id);
      materials.forEach((material, index) => {
        if (material.color && colors[index]) selected.has(id) ? material.color.set(selectionColor) : material.color.copy(colors[index]);
      });
    }
    viewer.setExplode(state.explode);
    viewer.lineArt?.setStyle({ enabled: true, color: lineColor, detailColor,
      partColors: Object.fromEntries(state.highlighted_ids.map(id => [id, '#254d60'])) });
    viewer.requestDraw();
    return state;
  }
  return { apply, dispose() {
    if (disposed) return;
    disposed = true;
    for (const { mesh, original, materials } of records) { mesh.material = original; materials.forEach(material => material.dispose()); }
  } };
}

function appendText(document, parent, tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

/** Mount into the provided shell. All source strings use textContent; source
 * names and IDs are data, never markup. Keyboard navigation follows the real
 * visible hierarchy, and model picks reveal the exact selected occurrence. */
export function mountAssemblyInspector({ inspection, viewer, tree, details, search, status, controls, onState }) {
  const document = tree.ownerDocument, index = inspection.index;
  const binding = createInspectionBinding(inspection, viewer);
  const rows = new Map(), expanded = new Set(index.occurrenceIds.filter(id => index.get(id).kind === 'assembly'));
  const disposers = [];
  let focusedId = index.rootId, query = '', visibleRows = [];
  const on = (element, event, callback) => { element.addEventListener(event, callback); disposers.push(() => element.removeEventListener(event, callback)); };
  tree.replaceChildren(); tree.setAttribute('role', 'tree'); tree.setAttribute('aria-label', 'Source assembly tree');
  const traversal = [];
  function visit(id, depth = 0) {
    traversal.push(id);
    const item = index.get(id), children = index.children(id);
    const row = document.createElement('div');
    row.className = 'cad-tree-row'; row.dataset.occurrenceId = id;
    row.setAttribute('role', 'treeitem'); row.setAttribute('aria-level', String(depth + 1));
    row.setAttribute('aria-selected', 'false'); row.tabIndex = id === focusedId ? 0 : -1;
    row.style.setProperty('--tree-depth', String(depth));
    const chevron = appendText(document, row, 'span', children.length ? '▾' : '·', 'cad-tree-chevron');
    chevron.setAttribute('aria-hidden', 'true');
    appendText(document, row, 'span', item.label, 'cad-tree-name');
    const peers = sameDefinitionOccurrences(index, id);
    const ordinal = peers.length > 1 ? `${peers.indexOf(id) + 1}/${peers.length}` : children.length ? String(children.length) : '';
    appendText(document, row, 'span', ordinal, 'cad-tree-ordinal');
    row.title = `${item.label}\n${id}`;
    on(row, 'click', event => {
      if (event.target === chevron && children.length) { expanded.has(id) ? expanded.delete(id) : expanded.add(id); renderTree(); return; }
      focusedId = id; row.focus(); select(id);
    });
    on(row, 'keydown', event => {
      const position = visibleRows.indexOf(id);
      let target;
      if (event.key === 'ArrowDown') target = visibleRows[Math.min(position + 1, visibleRows.length - 1)];
      else if (event.key === 'ArrowUp') target = visibleRows[Math.max(position - 1, 0)];
      else if (event.key === 'Home') target = visibleRows[0];
      else if (event.key === 'End') target = visibleRows.at(-1);
      else if (event.key === 'ArrowRight') { if (children.length && !expanded.has(id)) expanded.add(id); else target = children[0]; renderTree(); }
      else if (event.key === 'ArrowLeft') { if (children.length && expanded.has(id)) expanded.delete(id); else target = item.parent_id; renderTree(); }
      else if (event.key === 'Enter' || event.key === ' ') select(id);
      else return;
      event.preventDefault();
      if (target && !rows.get(target).hidden) { focusedId = target; renderTree(); rows.get(target).focus(); }
    });
    if (children.length) row.setAttribute('aria-expanded', 'true');
    rows.set(id, row); tree.append(row);
    children.forEach(child => visit(child, depth + 1));
  }
  visit(index.rootId);
  const empty = appendText(document, tree, 'p', 'No matching source occurrences.', 'cad-no-results');
  function renderTree() {
    const matching = matchingTreeIds(index, query), state = inspection.snapshot();
    visibleRows = traversal.filter(id => matching.has(id) && (query || index.ancestors(id).every(parent => expanded.has(parent))));
    if (!visibleRows.includes(focusedId)) focusedId = visibleRows[0] ?? index.rootId;
    const visibleSet = new Set(visibleRows);
    for (const [id, row] of rows) {
      row.hidden = !visibleSet.has(id); row.tabIndex = id === focusedId ? 0 : -1;
      row.dataset.visibility = state.visibility[id];
      row.setAttribute('aria-selected', String(state.selected_id === id));
      if (index.children(id).length) {
        row.setAttribute('aria-expanded', String(Boolean(query) || expanded.has(id)));
        row.firstChild.textContent = query || expanded.has(id) ? '▾' : '▸';
      }
    }
    empty.hidden = visibleRows.length > 0;
  }
  function renderDetails() {
    details.replaceChildren();
    const state = inspection.snapshot(), item = describeOccurrence(index, state.selected_id);
    if (!item) {
      appendText(document, details, 'p', 'Select a part', 'cad-detail-title');
      appendText(document, details, 'p', 'Click a solid or choose an occurrence in the tree. Repeated components share a definition but keep their own source placement.', 'cad-muted');
    } else {
      appendText(document, details, 'p', item.kind === 'assembly' ? 'Source assembly' : 'Source part', 'cad-eyebrow');
      appendText(document, details, 'h2', item.name, 'cad-detail-title');
      const list = document.createElement('dl'); list.className = 'cad-identity'; details.append(list);
      for (const [label, value] of [
        ['Occurrence', item.id], ['Definition', item.definitionId], ['Definition name', item.definitionName],
        ['Instance', `${item.peerPosition} of ${item.peerIds.length} with this definition`],
        ['Source path', item.pathLabels.join(' / ')], ['STEP product', item.sourceProduct ?? 'Not retained'],
        ['STEP usage', item.sourceUsage ?? 'Root — no parent usage'], ['XCAF label', item.sourceLabel ?? 'Not retained'],
        ['Visibility', state.visibility[item.id]],
      ]) { appendText(document, list, 'dt', label); appendText(document, list, 'dd', value); }
      const siblings = document.createElement('div'); siblings.className = 'cad-peer-controls'; details.append(siblings);
      for (const [label, direction] of [['Previous instance', -1], ['Next instance', 1]]) {
        const button = appendText(document, siblings, 'button', label);
        button.type = 'button'; button.disabled = item.peerIds.length < 2; button.dataset.direction = String(direction);
        button.addEventListener('click', () => {
          select(item.peerIds[(item.peerPosition - 1 + direction + item.peerIds.length) % item.peerIds.length], { reveal: true });
          details.querySelector(`[data-direction="${direction}"]`)?.focus({ preventScroll: true });
        });
      }
      appendText(document, details, 'p', 'Instance navigation selects only; it preserves visibility and camera position. Use Isolate, then Fit visible, for an unobstructed view.', 'cad-muted cad-detail-note');
    }
    const hasSelection = Boolean(item), hasGeometry = item?.displayCount > 0;
    controls.hide.disabled = !hasSelection || !hasGeometry;
    controls.isolate.disabled = !hasSelection || !hasGeometry;
    controls.clearIsolation.disabled = state.isolated_id === null;
    controls.hide.textContent = hasSelection && index.displayDescendants(item.id).every(id => state.hidden_part_ids.includes(id)) ? 'Show selection' : 'Hide selection';
  }
  function update() {
    const state = binding.apply();
    renderTree(); renderDetails();
    controls.explode.value = String(Math.round(state.explode * 100));
    const isolated = state.isolated_id ? ` · isolated: ${index.get(state.isolated_id).label}` : '';
    status.textContent = `${state.visible_part_ids.length} / ${index.displayIds.length} source occurrences visible${isolated}`;
    onState?.(state);
    return state;
  }
  function select(id, { reveal = true } = {}) {
    inspection.select(id);
    if (id && reveal) {
      if (query && !matchingTreeIds(index, query).has(id)) { query = ''; search.value = ''; }
      for (const ancestor of index.ancestors(id)) expanded.add(ancestor);
      focusedId = id;
    }
    update();
    if (id && reveal) rows.get(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return inspection.snapshot();
  }
  on(search, 'input', () => { query = search.value.trim(); renderTree(); });
  on(controls.hide, 'click', () => { inspection.toggleHidden(inspection.snapshot().selected_id); update(); });
  on(controls.isolate, 'click', () => { inspection.isolate(); update(); });
  on(controls.clearIsolation, 'click', () => { inspection.clearIsolation(); update(); });
  on(controls.reset, 'click', () => { inspection.resetObservation(); update(); viewer.fitVisibleAssembly(); });
  on(controls.fit, 'click', () => viewer.fitVisibleAssembly());
  on(controls.explode, 'input', () => { inspection.setExplode(Number(controls.explode.value) / 100); update(); });
  update();
  return { select, update, inspection, viewer,
    dispose() { disposers.forEach(dispose => dispose()); binding.dispose(); tree.replaceChildren(); details.replaceChildren(); },
  };
}
