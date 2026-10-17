import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createLineArt } from './line-art.mjs';
import { bindAssembly, visibleBounds, isWorldVisible, applyDisplayExplosion, resetDisplay, applyWorkingPoses } from './scene.mjs';

export function createMechanismViewer(options) {
  const { viewport, assetUrl, contractUrl, contract: suppliedContract, scene = new THREE.Scene(),
    camera = new THREE.OrthographicCamera(-.4, .4, .3, -.3, .001, 20), cameraPresets = {},
    parentForPart, configureMesh, onPick, afterDraw, onResize, validateContract,
    autoRender = true, rendererOptions = {}, pixelRatio = 1.8, lineStyle,
    explodeVector = record => record?.explode || [0, 0, 0] } = options;
  if (!viewport || !assetUrl) throw new TypeError('查看器需要 viewport 和 assetUrl');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, ...rendererOptions });
  renderer.setPixelRatio(Math.min(devicePixelRatio, pixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.prepend(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = options.enableDamping ?? false;
  controls.dampingFactor = .12; controls.minZoom = options.minZoom ?? .45; controls.maxZoom = options.maxZoom ?? 5;
  controls.enablePan = true; if (options.target) controls.target.fromArray(options.target);
  const parts = new Map(), meshes = [];
  let lineArt = null, contract = suppliedContract || null, disposed = false, inView = true, scheduled = false;
  let halfHeight = options.cameraHalfHeight ?? .3, pointerDown = null;
  const raycaster = new THREE.Raycaster();
  function draw() {
    scheduled = false; if (disposed || !inView || document.hidden) return;
    controls.update(); scene.updateMatrixWorld(true); lineArt?.update(camera); renderer.render(scene, camera); afterDraw?.(viewer);
  }
  function requestDraw() {
    if (disposed || !autoRender || scheduled || !inView || document.hidden) return;
    scheduled = true; requestAnimationFrame(draw);
  }
  function resize() {
    if (disposed) return;
    const width = Math.max(viewport.clientWidth, 1), height = Math.max(viewport.clientHeight, 1);
    camera.left = -halfHeight * width / height; camera.right = halfHeight * width / height;
    camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    onResize?.(viewer); requestDraw();
  }
  function fitVisibleAssembly({ margin = .8 } = {}) {
    const bounds = visibleBounds(meshes); if (bounds.isEmpty()) return null;
    const center = bounds.getCenter(new THREE.Vector3()), offset = camera.position.clone().sub(controls.target);
    controls.target.copy(center); camera.position.copy(center).add(offset); camera.zoom = 1;
    camera.updateProjectionMatrix(); controls.update(); camera.updateMatrixWorld(true);
    let extent = 0;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const projected = new THREE.Vector3(x, y, z).project(camera); extent = Math.max(extent, Math.abs(projected.x), Math.abs(projected.y));
    }
    camera.zoom = Math.min(controls.maxZoom, margin / Math.max(extent, .001)); camera.updateProjectionMatrix(); controls.update(); requestDraw();
    return bounds;
  }
  function setCamera(id, { offset = [0, 0, 0], zoom, fit = false } = {}) {
    const preset = typeof id === 'object' ? id : cameraPresets[id];
    if (!preset) throw new Error(`未定义视角：${id}`);
    camera.position.fromArray(preset.position).add(new THREE.Vector3(...offset));
    controls.target.fromArray(preset.target || [0, 0, 0]).add(new THREE.Vector3(...offset));
    halfHeight = preset.scale ?? halfHeight; camera.zoom = zoom ?? preset.zoom ?? 1; resize(); controls.update();
    if (fit) fitVisibleAssembly(); requestDraw(); return preset;
  }
  function pick(clientX, clientY) {
    const box = renderer.domElement.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    raycaster.setFromCamera(new THREE.Vector2((clientX - box.left) / box.width * 2 - 1, -(clientY - box.top) / box.height * 2 + 1), camera);
    return raycaster.intersectObjects(meshes, false).find(hit => isWorldVisible(hit.object)) || null;
  }
  const down = event => { pointerDown = [event.clientX, event.clientY]; };
  const up = event => {
    const previous = pointerDown; pointerDown = null;
    if (!previous || Math.hypot(event.clientX - previous[0], event.clientY - previous[1]) > 5) return;
    const hit = pick(event.clientX, event.clientY); onPick?.(hit?.object.userData.selectionId || null, hit);
  };
  renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up);
  const change = () => { options.onControlsChange?.(viewer); requestDraw(); };
  controls.addEventListener('change', change);
  const observer = new ResizeObserver(resize);
  function refreshVisibility() {
    const visible = inView && !document.hidden;
    options.onVisibilityChange?.(visible, viewer);
    if (!visible) return;
    // A model loop can consume its dirty flag while this viewport is hidden.
    // Even a manually rendered viewer must display that latest pose on return.
    if (autoRender) requestDraw(); else draw();
  }
  const intersection = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; refreshVisibility(); });
  const visibilityChange = refreshVisibility;
  document.addEventListener('visibilitychange', visibilityChange);
  const viewer = {
    scene, camera, renderer, controls, parts, meshes, get lineArt() { return lineArt; }, get contract() { return contract; },
    requestDraw, draw, resize, setCamera, fitVisibleAssembly, pick,
    getPart: id => parts.get(id),
    applyPoses(poses, config) { applyWorkingPoses(parts, poses, config); requestDraw(); },
    setExplode(progress, config = {}) {
      const result = applyDisplayExplosion(parts, progress, config.vectorForPart || (binding => explodeVector(binding.record, binding)));
      scene.updateMatrixWorld(true); if (config.fit) fitVisibleAssembly(); requestDraw(); return result;
    },
    setCutaway(enabled, hidden = binding => binding.record?.cutawayHidden) {
      for (const binding of parts.values()) binding.display.visible = !(enabled && hidden(binding)); requestDraw();
    },
    resetObservation() { resetDisplay(parts); requestDraw(); },
    dispose() {
      if (disposed) return; disposed = true; observer.disconnect(); intersection.disconnect();
      document.removeEventListener('visibilitychange', visibilityChange); controls.removeEventListener('change', change);
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up);
      controls.dispose(); lineArt?.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
  viewer.ready = (async () => {
    if (contractUrl) { const response = await fetch(contractUrl); if (!response.ok) throw new Error(`零件契约 HTTP ${response.status}`); contract = await response.json(); }
    validateContract?.(contract);
    const asset = await new GLTFLoader().loadAsync(assetUrl); scene.add(asset.scene); scene.updateMatrixWorld(true);
    const assembly = bindAssembly(asset.scene, { contract, parentForPart, configureMesh });
    for (const [id, binding] of assembly.parts) parts.set(id, binding); meshes.push(...assembly.meshes);
    if (parentForPart && !asset.scene.children.length) scene.remove(asset.scene);
    lineArt = createLineArt(meshes); lineArt.setStyle(lineStyle || { enabled: false }); scene.updateMatrixWorld(true); requestDraw(); return viewer;
  })();
  observer.observe(viewport); intersection.observe(viewport); resize(); return viewer;
}
