import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { bindAssembly, applyWorkingPoses, applyDisplayExplosion, isWorldVisible } from '../../../shared/viewer/scene.mjs';

export const CINEMATIC_RENDERER_REVISION = 'gearbox-cinematic-renderer-2';

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const finiteVector = value => (Array.isArray(value) || ArrayBuffer.isView(value)) && value.length === 3 && Array.from(value).every(Number.isFinite);

// Finish choices are authored presentation materials, not engineering grades.
function finishFor(id) {
  if (/\/ring-(front|rear)$/.test(id)) return { kind: 'bronze', color: '#a4773e', metalness: .88, roughness: .31 };
  if (id.startsWith('gb:case/') && !/bolt|lever/.test(id)) return { kind: 'graphite', color: '#29333d', metalness: .77, roughness: .37 };
  if (/needle|\/cage$/.test(id)) return { kind: 'bearing', color: '#4b5b69', metalness: .91, roughness: .28 };
  if (/bolt|\/ball-/.test(id)) return { kind: 'polished', color: '#b8c5cc', metalness: .98, roughness: .19 };
  if (/shift\/(fork|rail)/.test(id)) return { kind: 'satin', color: '#7c91a0', metalness: .87, roughness: .34 };
  return { kind: 'steel', color: '#b0bdc7', metalness: .94, roughness: .265 };
}

function addBrushedFinish(material) {
  // Object-space machining grain needs no source UV edit. Its derivative filter
  // removes unresolved detail at distance rather than letting it shimmer.
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMachiningPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMachiningPosition = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMachiningPosition;')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float machiningPhase = vMachiningPosition.x * 10800.0;
        float machiningFilter = 1.0 - smoothstep(0.45, 1.2, fwidth(machiningPhase));
        float machiningGrain = sin(machiningPhase + sin(vMachiningPosition.z * 190.0)) * 0.6 + sin(machiningPhase * 1.73 + vMachiningPosition.z * 115.0) * 0.4;
        roughnessFactor = clamp(roughnessFactor + machiningGrain * machiningFilter * 0.006, 0.12, 0.8);
      `);
  };
  material.customProgramCacheKey = () => 'gearbox-cinematic-machining-v2';
}

function softGroundTexture(document) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 7, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0,0,0,0.7)');
  gradient.addColorStop(.4, 'rgba(0,0,0,0.35)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

async function readContract() {
  const response = await fetch(new URL('../assets/scene-contract.json', import.meta.url));
  if (!response.ok) throw new Error(`Gearbox contract HTTP ${response.status}`);
  return response.json();
}

/** Fixed-buffer PBR rendering only. The caller owns story time, source mechanics,
 * camera paths, caption composition and audio. No RAF, window screenshot or
 * host-DPI sizing is involved. */
export async function createCinematicRenderer({ canvas, width = 1920, height = 1080, index } = {}) {
  if (!canvas?.getContext || !canvas.ownerDocument) throw new TypeError('A browser-owned output canvas is required.');
  if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 4096)) throw new RangeError('Finite output dimensions up to 4096px are required.');
  if (index?.units !== 'm' || !Array.isArray(index.parts)) throw new TypeError('A gearbox scene index in metres is required.');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .96;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#060a10');
  scene.fog = new THREE.Fog('#060a10', 1.45, 5.5);
  const camera = new THREE.PerspectiveCamera(36, width / height, .002, 15);
  // Reserve the lower composition for the caller's typography. Labels project
  // through this same camera, so the image and their attachment points agree.
  camera.zoom = .92; camera.setViewOffset(width, height, 0, 95, width, height);
  camera.position.set(-.68, .36, .92); camera.lookAt(.015, -.01, 0);

  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, .055);
  scene.environment = environment.texture; scene.environmentIntensity = .56;
  room.dispose(); pmrem.dispose();

  const target = new THREE.Object3D(); target.position.set(.02, -.035, 0); scene.add(target);
  const key = new THREE.DirectionalLight('#ffe3c5', 2.95);
  key.position.set(-.55, 1.0, .7); key.target = target; key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -.8, right: .8, top: .7, bottom: -.7, near: .05, far: 3.8 });
  key.shadow.bias = -.000035; key.shadow.normalBias = .0004;
  const rim = new THREE.DirectionalLight('#86c4d3', 2.1); rim.position.set(.5, .45, -.75); rim.target = target;
  const fill = new THREE.DirectionalLight('#b9d5ee', .6); fill.position.set(.25, -.12, 1.1); fill.target = target;
  const top = new THREE.DirectionalLight('#f6f8ff', 1.0); top.position.set(.05, 1.1, -.05); top.target = target;
  scene.add(key, rim, fill, top, new THREE.HemisphereLight('#8ca6bb', '#090d15', .12));

  const materials = new Set(), geometries = new Set(), originalMaterials = new Set();
  const floorY = index.asset.assembledWorldBounds.min[1] - .11;
  const floorGeometry = new THREE.PlaneGeometry(12, 12); geometries.add(floorGeometry);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: '#08090a', metalness: 0, roughness: .98, envMap: environment.texture, envMapIntensity: .08 }); materials.add(floorMaterial);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2; floor.position.y = floorY; floor.receiveShadow = true;
  scene.add(floor);
  const groundTexture = softGroundTexture(canvas.ownerDocument);
  const groundMaterial = new THREE.MeshBasicMaterial({ map: groundTexture, transparent: true, opacity: .38, depthWrite: false, toneMapped: false });
  materials.add(groundMaterial);
  const groundGeometry = new THREE.PlaneGeometry(.93, .62); geometries.add(groundGeometry);
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2; ground.position.set(.025, floorY + .0003, 0); scene.add(ground);

  const [asset, contract] = await Promise.all([
    new GLTFLoader().loadAsync(new URL('../assets/gearbox.glb', import.meta.url).href), readContract(),
  ]);
  scene.add(asset.scene);
  const records = [], meshesByPart = new Map(), finishes = {};
  const { parts, meshes } = bindAssembly(asset.scene, {
    contract,
    configureMesh(mesh, binding) {
      for (const original of [].concat(mesh.material)) originalMaterials.add(original);
      geometries.add(mesh.geometry);
      const finish = finishFor(binding.id);
      const material = new THREE.MeshPhysicalMaterial({ color: finish.color, metalness: finish.metalness, roughness: finish.roughness,
        clearcoat: finish.kind === 'graphite' ? .22 : .08, clearcoatRoughness: .4,
        emissive: '#1b9db7', emissiveIntensity: 0, envMapIntensity: 1,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      });
      if (finish.kind !== 'graphite') addBrushedFinish(material);
      mesh.material = material; mesh.castShadow = true; mesh.receiveShadow = true;
      materials.add(material); finishes[finish.kind] = (finishes[finish.kind] || 0) + 1;
      const partMeshes = meshesByPart.get(binding.id) || [];
      partMeshes.push(mesh); meshesByPart.set(binding.id, partMeshes);
      let edge = null;
      // A handful of structural seams only; PBR shading owns the silhouettes.
      if (finish.kind === 'graphite' || /\/sleeve$/.test(binding.id)) {
        const geometry = new THREE.EdgesGeometry(mesh.geometry, 55); geometries.add(geometry);
        const ink = new THREE.LineBasicMaterial({ color: '#8ca4b4', transparent: true, opacity: .055, depthWrite: false, toneMapped: true });
        materials.add(ink); edge = new THREE.LineSegments(geometry, ink); edge.renderOrder = 1; mesh.add(edge);
      }
      records.push({ id: binding.id, mesh, material, edge, finish, opacity: 1 });
    },
  });
  for (const material of originalMaterials) material.dispose();
  const expected = new Set(index.parts.map(part => part.id));
  if (parts.size !== expected.size || [...parts.keys()].some(id => !expected.has(id))) throw new Error('Cinematic source part identities disagree with the scene index.');

  let disposed = false, lastTime = null, frames = 0;
  const projected = new THREE.Vector3(), center = new THREE.Vector3(), bounds = new THREE.Box3();

  function render(state) {
    if (disposed) throw new Error('The cinematic renderer has been disposed.');
    if (!Number.isFinite(state?.time) || !state.workingPoses || !(state.offsetsLocal instanceof Map) || typeof state.opacityFor !== 'function') throw new TypeError('A resolved cinematic frame state is required.');
    if (!finiteVector(state.camera?.position) || !finiteVector(state.camera?.target) || !Number.isFinite(state.camera.fov) || state.camera.fov <= 1 || state.camera.fov >= 120) throw new TypeError('A finite perspective camera pose is required.');
    for (const id of parts.keys()) if (!finiteVector(state.offsetsLocal.get(id))) throw new Error(`Missing cinematic display offset: ${id}`);
    const opacity = new Map();
    for (const id of parts.keys()) {
      const value = state.opacityFor(id);
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`Invalid cinematic opacity: ${id}`);
      opacity.set(id, value);
    }
    applyWorkingPoses(parts, state.workingPoses, { target: 'model' });
    applyDisplayExplosion(parts, 1, binding => Array.from(state.offsetsLocal.get(binding.id)));
    const power = clamp(state.effect?.power ?? 1), sweep = clamp(state.effect?.lightSweep ?? .5);
    for (const record of records) {
      const alpha = opacity.get(record.id), { material, mesh, edge } = record;
      record.opacity = alpha; mesh.visible = alpha > .0001;
      const transparent = alpha < .9999;
      if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
      material.opacity = alpha; material.depthWrite = !transparent;
      mesh.castShadow = alpha > .98;
      const weight = clamp(state.powerIds?.get(record.id) ?? 0);
      material.emissiveIntensity = weight * power * .25;
      if (edge) edge.material.opacity = .055 * alpha;
    }
    rim.position.x = .35 + sweep * .35;
    rim.intensity = 1.95 + sweep * .3;
    key.intensity = 2.85 + sweep * .2;
    camera.position.fromArray(state.camera.position); camera.fov = state.camera.fov;
    camera.lookAt(new THREE.Vector3(...state.camera.target)); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);
    renderer.render(scene, camera);
    lastTime = state.time; frames++;
    return canvas;
  }

  function projectPart(id) {
    const owned = meshesByPart.get(id);
    if (!owned) throw new Error(`Unknown cinematic part: ${id}`);
    bounds.makeEmpty();
    for (const mesh of owned) {
      if (!isWorldVisible(mesh) || mesh.material.opacity < .35) continue;
      mesh.geometry.computeBoundingBox();
      bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
    }
    if (bounds.isEmpty()) return { x: 0, y: 0, visible: false };
    bounds.getCenter(center); projected.copy(center).project(camera);
    return { x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2,
      visible: projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 };
  }

  function snapshot() {
    return { revision: CINEMATIC_RENDERER_REVISION, width: canvas.width, height: canvas.height, pixelRatio: renderer.getPixelRatio(),
      geometryRevision: index.geometryRevision, parts: parts.size, meshes: meshes.length,
      visibleMeshes: meshes.filter(mesh => isWorldVisible(mesh)).length, finishes: { ...finishes },
      camera: { position: camera.position.toArray(), fov: camera.fov, near: camera.near, far: camera.far,
        zoom: camera.zoom, viewOffset: { ...camera.view } },
      time: lastTime, frames, shaders: renderer.info.programs?.length ?? 0, drawCalls: renderer.info.render.calls,
      method: 'fixed-buffer-direct-WebGL', environment: 'procedural-RoomEnvironment-PMREM', disposed };
  }

  function dispose() {
    if (disposed) return; disposed = true;
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    groundTexture.dispose(); environment.dispose();
    key.shadow.map?.dispose(); renderer.dispose(); scene.clear();
  }

  return { render, projectPart, snapshot, dispose, scene, camera, renderer, parts, meshes };
}
