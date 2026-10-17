import * as THREE from 'three';
import { createMechanismViewer } from '../../shared/viewer/viewer.mjs';
import { createAssemblyInspection } from '../../shared/cad/assembly.mjs';

const $ = id => document.getElementById(id);
const json = async path => { const response = await fetch(path); if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`); return response.json(); };
const formatNumber = value => Math.abs(value) < 0.00005 ? '0.000' : value.toFixed(3);
const formatMatrix = matrix => Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, column) => formatNumber(matrix[column * 4 + row]).padStart(10)).join(' ')).join('\n');

try {
  const [manifest, provenance, report] = await Promise.all([json('assets/assembly-manifest.json'), json('source/provenance.json'), json('assets/import-report.json')]);
  const inspection = createAssemblyInspection(manifest), index = inspection.index;
  const expanded = new Set(index.occurrenceIds.filter(id => index.children(id).length && index.ancestors(id).length < 2));
  const elements = new Map(), queryMatches = new Set();
  let snapshot = inspection.snapshot(), query = '', currentCamera = 'overview', focusedId = index.rootId;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#ffffff');
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9c9c2', 2.25));
  const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(.3, .7, .5); scene.add(key);
  const viewer = createMechanismViewer({
    viewport: $('viewport'), assetUrl: './assets/assembly.glb', contractUrl: './assets/scene-contract.json', scene,
    cameraHalfHeight: .12, cameraPresets: {
      overview: { position: [.4, .3, .4], target: [0, 0, 0], scale: .12 },
      front: { position: [0, .03, .6], target: [0, 0, 0], scale: .12 },
      side: { position: [.6, .03, 0], target: [0, 0, 0], scale: .12 },
      top: { position: [.0001, .6, 0], target: [0, 0, 0], scale: .12 },
    },
    configureMesh(mesh) {
      mesh.material = new THREE.MeshStandardMaterial({ color: '#eeeeea', metalness: .03, roughness: .85, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    },
    lineStyle: { enabled: true, color: '#3d3d39', detailColor: '#92928a' },
    onPick(id) { if (id) select(id, { reveal: true }); },
  });
  await viewer.ready;
  if (viewer.parts.size !== index.displayIds.length || index.displayIds.some(id => !viewer.parts.has(id))) throw new Error('Source occurrences and display part identities disagree.');
  viewer.setCamera('overview', { fit: true });

  const definitions = new Map();
  for (const id of index.occurrenceIds) {
    const occurrence = index.get(id), group = definitions.get(occurrence.definition_id) || [];
    group.push(id); definitions.set(occurrence.definition_id, group);
  }
  const occurrenceLabel = id => index.get(id).label || index.get(id).name || index.definition(index.get(id).definition_id).name || id;
  const depthOf = id => index.ancestors(id).length + 1;

  function addTreeNode(id, container) {
    const occurrence = index.get(id), children = index.children(id), peers = definitions.get(occurrence.definition_id);
    const node = document.createElement('div'); node.role = 'treeitem'; node.tabIndex = id === focusedId ? 0 : -1;
    node.dataset.occurrenceId = id; node.setAttribute('aria-level', depthOf(id)); node.setAttribute('aria-selected', 'false');
    if (children.length) node.setAttribute('aria-expanded', String(expanded.has(id)));
    const row = document.createElement('div'); row.className = 'tree-row';
    const toggle = document.createElement('button'); toggle.className = 'tree-toggle'; toggle.tabIndex = -1; toggle.disabled = !children.length;
    toggle.textContent = expanded.has(id) ? '−' : '+'; toggle.setAttribute('aria-label', `Toggle ${occurrenceLabel(id)}`);
    toggle.addEventListener('click', event => { event.stopPropagation(); expanded.has(id) ? expanded.delete(id) : expanded.add(id); updateTree(); });
    const label = document.createElement('button'); label.className = 'tree-name'; label.tabIndex = -1; label.textContent = occurrenceLabel(id);
    label.addEventListener('click', event => { event.stopPropagation(); select(id, { focus: true }); });
    const mark = document.createElement('span'); mark.className = 'tree-mark';
    mark.textContent = children.length ? `${index.leafDescendants(id).length}` : peers.length > 1 ? `${peers.indexOf(id) + 1}/${peers.length}` : '';
    mark.title = children.length ? 'Leaf occurrences in this assembly' : 'Instance of this source definition';
    const visibility = document.createElement('button'); visibility.className = 'tree-visibility'; visibility.tabIndex = -1;
    visibility.addEventListener('click', event => { event.stopPropagation(); toggleVisibility(id); });
    row.append(toggle, label, mark, visibility); node.append(row);
    const group = document.createElement('div'); group.role = 'group';
    if (children.length) { node.append(group); for (const child of children) addTreeNode(child, group); }
    container.append(node); elements.set(id, { node, row, toggle, visibility, group });
    node.addEventListener('focus', event => { if (event.target === node) focusNode(id); });
    node.addEventListener('keydown', event => { if (event.target === node) treeKey(event, id); });
  }
  for (const id of [index.rootId]) addTreeNode(id, $('assembly-tree'));

  function visibleTreeIds() {
    const result = [];
    function visit(id) {
      if (query && !queryMatches.has(id)) return;
      result.push(id);
      if (expanded.has(id) || query) for (const child of index.children(id)) visit(child);
    }
    visit(index.rootId); return result;
  }
  function focusNode(id, move = false) {
    if (elements.has(focusedId)) elements.get(focusedId).node.tabIndex = -1;
    focusedId = id; elements.get(id).node.tabIndex = 0;
    if (move) elements.get(id).node.focus({ preventScroll: true });
  }
  function revealTreeNode(id) {
    const tree = $('assembly-tree'), row = elements.get(id).row.getBoundingClientRect(), bounds = tree.getBoundingClientRect();
    if (row.top < bounds.top) tree.scrollTop -= bounds.top - row.top;
    else if (row.bottom > bounds.bottom) tree.scrollTop += row.bottom - bounds.bottom;
  }
  function treeKey(event, id) {
    const ids = visibleTreeIds(), current = ids.indexOf(id), children = index.children(id); let next;
    if (event.key === 'ArrowDown') next = ids[Math.min(current + 1, ids.length - 1)];
    else if (event.key === 'ArrowUp') next = ids[Math.max(current - 1, 0)];
    else if (event.key === 'Home') next = ids[0];
    else if (event.key === 'End') next = ids.at(-1);
    else if (event.key === 'ArrowRight') { if (children.length && !expanded.has(id)) expanded.add(id); else next = children.find(child => !query || queryMatches.has(child)); updateTree(); }
    else if (event.key === 'ArrowLeft') { if (children.length && expanded.has(id)) expanded.delete(id); else next = index.get(id).parent_id; updateTree(); }
    else if (event.key === 'Enter' || event.key === ' ') select(id);
    else if (event.key.toLowerCase() === 'h') toggleVisibility(id);
    else return;
    event.preventDefault(); if (next) { focusNode(next, true); revealTreeNode(next); }
  }
  function updateTree() {
    const highlighted = new Set(snapshot.highlighted_ids);
    for (const [id, elementsForId] of elements) {
      const { node, group, row, toggle, visibility } = elementsForId, state = snapshot.visibility[id];
      node.hidden = Boolean(query && !queryMatches.has(id));
      node.setAttribute('aria-selected', String(snapshot.selected_id === id));
      if (index.children(id).length) { node.setAttribute('aria-expanded', String(query || expanded.has(id))); group.hidden = !query && !expanded.has(id); }
      toggle.textContent = expanded.has(id) ? '−' : '+';
      row.classList.toggle('context', highlighted.has(id) && snapshot.selected_id !== id);
      row.classList.toggle('is-hidden', state === 'hidden');
      visibility.textContent = state === 'hidden' ? '○' : state === 'partial' ? '◐' : '●';
      visibility.setAttribute('aria-label', `${state === 'hidden' ? 'Show' : 'Hide'} ${occurrenceLabel(id)}`);
      visibility.title = `${state} — click to hide or show`;
    }
  }
  function select(id, { reveal = false, focus = false } = {}) {
    inspection.select(id);
    if (reveal) {
      if (query) { query = ''; $('search').value = ''; queryMatches.clear(); }
      for (const parent of index.ancestors(id)) expanded.add(parent);
    }
    render(); focusNode(id, focus);
    if (reveal || focus) revealTreeNode(id);
  }
  function toggleVisibility(id) {
    if (snapshot.visibility[id] === 'hidden') { inspection.clearIsolation(); inspection.setHidden(id, false); }
    else inspection.setHidden(id, true);
    render();
  }
  function updateDetails() {
    const id = snapshot.selected_id, occurrence = id ? index.get(id) : null;
    $('identity-fields').hidden = !id; $('placement-details').hidden = !id;
    $('isolate').disabled = !id; $('hide').disabled = !id;
    $('clear-isolation').hidden = !snapshot.isolated_id;
    $('isolate').textContent = snapshot.isolated_id === id && id ? 'Isolated' : 'Isolate';
    $('selection-name').textContent = id ? occurrenceLabel(id) : 'Select a part';
    if (!id) { $('selection-context').textContent = 'The tree and the model share the same occurrence identities. Repeated parts remain separate.'; $('repeated-instances').hidden = true; return; }
    const peers = definitions.get(occurrence.definition_id), kind = occurrence.kind === 'assembly' ? 'Assembly' : 'Part';
    $('selection-context').textContent = `${kind} occurrence${peers.length > 1 ? ` ${peers.indexOf(id) + 1} of ${peers.length} using the same source definition` : ''}. ${occurrence.kind === 'assembly' ? 'Selection includes its descendant parts.' : 'All mesh faces of this occurrence select this identity.'}`;
    $('occurrence-id').textContent = occurrence.source?.nauoEntity ? `${occurrence.source.nauoEntity} · ${id}` : id;
    $('definition-id').textContent = occurrence.definition_id;
    $('parent-name').textContent = occurrence.parent_id ? occurrenceLabel(occurrence.parent_id) : 'Root assembly';
    $('repeat-count').textContent = `${peers.length} occurrence${peers.length === 1 ? '' : 's'}`;
    $('source-origin').textContent = occurrence.worldMatrixSource.slice(12, 15).map(formatNumber).join(', ');
    $('visibility-state').textContent = snapshot.visibility[id];
    $('hide').textContent = snapshot.visibility[id] === 'hidden' ? 'Show' : 'Hide';
    $('local-matrix').textContent = formatMatrix(occurrence.localMatrixSource);
    $('world-matrix').textContent = formatMatrix(occurrence.worldMatrixSource);
    $('repeated-instances').hidden = peers.length < 2;
    $('instance-links').replaceChildren();
    for (const peer of peers) {
      const button = document.createElement('button'); button.textContent = `Instance ${peers.indexOf(peer) + 1}`;
      button.setAttribute('aria-pressed', String(peer === id)); button.title = peer;
      button.addEventListener('click', () => { const followIsolation = snapshot.isolated_id === snapshot.selected_id; select(peer, { reveal: true }); if (followIsolation) { inspection.isolate(peer); render(); } }); $('instance-links').append(button);
    }
  }
  function render() {
    snapshot = inspection.snapshot(); const visible = new Set(snapshot.visible_part_ids), visibleNodes = new Set(snapshot.visible_ids), highlighted = new Set(snapshot.highlighted_ids), partColors = {};
    for (const [id, binding] of viewer.parts) {
      binding.display.visible = binding.record.sourceKind === 'assembly' ? visibleNodes.has(id) : visible.has(id);
      const selected = highlighted.has(id); if (selected) partColors[id] = '#315778';
      binding.node.traverse(node => { if (node.isMesh && node.userData.selectionId === id) { node.visible = visible.has(id); node.material.color.set(selected ? '#cddce5' : '#eeeeea'); } });
    }
    viewer.setExplode(snapshot.explode);
    viewer.lineArt.setStyle({ enabled: true, color: '#3d3d39', detailColor: '#92928a', partColors });
    updateTree(); updateDetails();
    $('explode').value = String(Math.round(snapshot.explode * 100)); $('explode-value').value = `${Math.round(snapshot.explode * 100)}%`;
    $('status').textContent = `${snapshot.visible_part_ids.length} / ${index.displayIds.length} geometry occurrences visible`;
    $('view-caption').textContent = snapshot.isolated_id ? `Isolated: ${occurrenceLabel(snapshot.isolated_id)}` : snapshot.explode ? 'Exploded display · source placements unchanged' : 'Assembled source pose';
    viewer.requestDraw();
  }
  $('search').addEventListener('input', () => {
    query = $('search').value.trim().toLowerCase(); queryMatches.clear();
    for (const id of index.occurrenceIds) if (`${occurrenceLabel(id)} ${id} ${index.get(id).definition_id}`.toLowerCase().includes(query)) {
      queryMatches.add(id); for (const parent of index.ancestors(id)) queryMatches.add(parent);
    }
    updateTree();
    const visible = visibleTreeIds(); if (visible.length && !visible.includes(focusedId)) focusNode(visible[0]);
  });
  $('expand-all').addEventListener('click', () => {
    const collapse = index.occurrenceIds.every(id => !index.children(id).length || expanded.has(id));
    expanded.clear(); if (!collapse) for (const id of index.occurrenceIds) if (index.children(id).length) expanded.add(id);
    $('expand-all').textContent = collapse ? 'Expand all' : 'Collapse all'; updateTree();
    if (!visibleTreeIds().includes(focusedId)) focusNode(index.rootId);
  });
  $('explode').addEventListener('input', () => { inspection.setExplode(Number($('explode').value) / 100); render(); });
  $('isolate').addEventListener('click', () => { inspection.isolate(); render(); });
  $('clear-isolation').addEventListener('click', () => { inspection.clearIsolation(); render(); });
  $('hide').addEventListener('click', () => { if (snapshot.selected_id) toggleVisibility(snapshot.selected_id); });
  $('fit').addEventListener('click', () => viewer.fitVisibleAssembly());
  function setCamera(camera) {
    currentCamera = camera; viewer.setCamera(camera, { fit: true });
    for (const button of document.querySelectorAll('[data-camera]')) button.setAttribute('aria-pressed', String(button.dataset.camera === camera));
  }
  for (const button of document.querySelectorAll('[data-camera]')) button.addEventListener('click', () => setCamera(button.dataset.camera));
  $('restore').addEventListener('click', () => { inspection.resetObservation(); viewer.resetObservation(); render(); setCamera('overview'); });
  for (const button of document.querySelectorAll('[data-source-definition]')) button.addEventListener('click', () => {
    const definition = manifest.definitions.find(definition => definition.source.productDefinitionEntity === button.dataset.sourceDefinition);
    const occurrence = manifest.occurrences.find(occurrence => occurrence.definition_id === definition?.definition_id);
    if (!occurrence) return;
    inspection.resetObservation();
    const peers = manifest.occurrences.filter(peer => peer.definition_id === definition.definition_id);
    if (peers.length > 1) { inspection.setHidden(index.rootId, true); for (const peer of peers) inspection.setHidden(peer.occurrence_id, false); }
    else inspection.isolate(occurrence.occurrence_id);
    select(occurrence.occurrence_id, { reveal: true }); render(); viewer.fitVisibleAssembly();
  });
  $('tree-summary').textContent = `${index.leafIds.length} part occurrences · ${manifest.definitions.filter(definition => definition.kind === 'part').length} part definitions`;
  $('source-title').textContent = provenance.title || 'A traceable engineering assembly';
  const credit = $('source-credit'); credit.replaceChildren();
  const upstream = document.createElement('a'); upstream.href = provenance.url; upstream.textContent = provenance.author;
  credit.append('Original model by ', upstream, `. ${provenance.license}. The STEP is retained byte for byte; the display mesh and inspection manifest are derivatives.`);
  $('import-warning').textContent = report.sourceStatistics.unmeshedFaces
    ? `${report.sourceStatistics.unmeshedFaces} imported source faces have no display triangles. Their identities and diagnostics are retained in the import report.`
    : report.sourceStatistics.recoveredMeshFaces
      ? `All imported faces have display triangles. ${report.sourceStatistics.recoveredMeshFaces} faces required adjusted meshing parameters, recorded individually in the import report. These settings are not an accuracy guarantee.`
      : 'All imported faces have display triangles.';
  for (const [value, text] of [[index.leafIds.length, 'part occurrences'], [manifest.definitions.filter(d => d.kind === 'part').length, 'part definitions'], [report.display?.triangles ?? '—', 'display triangles']]) {
    const item = document.createElement('div'), strong = document.createElement('strong'); strong.textContent = value.toLocaleString(); item.append(strong, text); $('source-stats').append(item);
  }
  window.shaftBearing = { viewer, inspection, manifest, report, select, setCamera, get currentCamera() { return currentCamera; } };
  render();
} catch (error) {
  $('status').textContent = 'Unable to load this assembly'; $('error').hidden = false; $('error').textContent = error.message; console.error(error);
}
