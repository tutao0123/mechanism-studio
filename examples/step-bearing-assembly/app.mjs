import * as THREE from 'three';
import { createMechanismViewer } from '/shared/viewer/viewer.mjs';
import { visibleBounds } from '/shared/viewer/scene.mjs';
import { createAssemblyInspection } from '/shared/cad/assembly.mjs';
import { mountAssemblyInspector } from '/shared/cad/inspector.mjs';

const $ = selector => document.querySelector(selector);
async function json(url) { const response = await fetch(url); if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`); return response.json(); }
async function start() {
  const [manifest, contract, provenance] = await Promise.all([
    json('./assets/assembly-manifest.json'), json('./assets/scene-contract.json'), json('./source/provenance.json'),
  ]);
  const inspection = createAssemblyInspection(manifest), scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffffff');
  scene.add(new THREE.AmbientLight('#ffffff', 2.2));
  const key = new THREE.DirectionalLight('#ffffff', 2.0); key.position.set(2, 5, 3); scene.add(key);
  let inspector;
  const viewer = createMechanismViewer({
    viewport: $('#viewport'), assetUrl: './assets/assembly.glb', contract, scene,
    lineStyle: { enabled: true, color: '#272725', detailColor: '#93938b' },
    pixelRatio: 2, enableDamping: false, minZoom: .04, maxZoom: 300,
    configureMesh(mesh) {
      mesh.material = new THREE.MeshStandardMaterial({ color: '#f2f2ef', roughness: 1, metalness: 0,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    },
    onPick(id) { inspector?.select(id); },
    onResize(current) { if (current.meshes.length) current.fitVisibleAssembly(); },
  });
  await viewer.ready;
  const bounds = visibleBounds(viewer.meshes), center = bounds.getCenter(new THREE.Vector3());
  const span = Math.max(...bounds.getSize(new THREE.Vector3()).toArray());
  const presets = {
    overview: { position: center.clone().add(new THREE.Vector3(1.4, 1, 1.4).multiplyScalar(span)).toArray(), target: center.toArray(), scale: span * .65 },
    front: { position: center.clone().add(new THREE.Vector3(0, 0, 2 * span)).toArray(), target: center.toArray(), scale: span * .65 },
    top: { position: center.clone().add(new THREE.Vector3(0, 2 * span, .00001 * span)).toArray(), target: center.toArray(), scale: span * .65 },
  };
  viewer.camera.near = Math.max(span / 10000, .000001); viewer.camera.far = Math.max(span * 25, 20);
  viewer.setCamera(presets.overview, { fit: true });
  inspector = mountAssemblyInspector({ inspection, viewer,
    tree: $('#assembly-tree'), details: $('#part-details'), search: $('#part-search'), status: $('#assembly-status'),
    controls: { fit: $('#fit'), hide: $('#hide'), isolate: $('#isolate'), clearIsolation: $('#clear-isolation'), reset: $('#reset'), explode: $('#explode') },
  });
  for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => viewer.setCamera(presets[button.dataset.view], { fit: true }));
  $('#source-summary').textContent = `${provenance.title || 'Retained STEP assembly'} · ${inspection.index.leafIds.length} part occurrences · ${manifest.definitions.length} source definitions`;
  $('#source-credit').textContent = `${provenance.author || provenance.creator || 'Upstream author'} · ${provenance.license || 'See retained license'}. Display derived from the unchanged source STEP; original component names and hierarchy retained.`;
  $('#loading').hidden = true;
  // Local, read-only observation evidence for browser checks. Source matrices
  // remain in the frozen inspection index; no manufacturing claims are made.
  window.stepAssemblyInspector = Object.freeze({
    ready: true, snapshot: () => inspection.snapshot(),
    identity: id => inspection.index.get(id),
    project: id => {
      const meshes = viewer.meshes.filter(mesh => mesh.userData.selectionId === id);
      if (!meshes.length) return null;
      scene.updateMatrixWorld(true);
      const box = visibleBounds(meshes); if (box.isEmpty()) return null;
      const point = box.getCenter(new THREE.Vector3()).project(viewer.camera), rect = viewer.renderer.domElement.getBoundingClientRect();
      return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
    },
  });
}
start().catch(error => {
  $('#loading').textContent = `Assembly could not be loaded. ${error.message}`;
  $('#loading').classList.add('cad-error');
  $('#assembly-status').textContent = 'Source assembly unavailable';
  console.error(error);
});
