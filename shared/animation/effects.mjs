// Declarative teaching effects: the caller owns phase and semantic intensity.
// No clock, random source, mechanical state, solver or rendering loop lives here.
const finite = (value, label) => { if (!Number.isFinite(value)) throw new TypeError(label + ' must be finite'); return value; };
export function wrapPhase(value) { finite(value, 'phase'); return ((value % 1) + 1) % 1; }
export function sampleFlowOffsets(count, phase) {
  if (!Number.isInteger(count) || count < 1 || count > 256) throw new RangeError('flow count must be 1–256');
  const start = wrapPhase(phase);
  return Array.from({ length: count }, (_, index) => (start + index / count) % 1);
}
function normalizedIntensity(value) {
  finite(value, 'intensity'); if (value < 0 || value > 1) throw new RangeError('intensity must be 0–1'); return value;
}
function positive(value, label) { finite(value, label); if (value <= 0) throw new RangeError(label + ' must be positive'); return value; }

/** points and radii are already in the same glTF metre frame as the displayed asset. */
export function createFlowPath(THREE, { points, count = 14, color = '#3986a1', radius = .00035, particleRadius = .0018 } = {}) {
  if (!Array.isArray(points) || points.length < 2 || !points.every(p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite))) throw new TypeError('flow path needs finite three-component points');
  sampleFlowOffsets(count, 0); positive(radius, 'path radius'); positive(particleRadius, 'particle radius');
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  if (curve.getLength() < 1e-8) throw new RangeError('flow path has no length');
  const group = new THREE.Group(); group.name = 'teaching-flow'; group.userData.processEffect = true;
  const pathGeometry = new THREE.TubeGeometry(curve, Math.max(24, points.length * 10), radius, 4, false);
  const pathMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .25, depthWrite: false });
  const trace = new THREE.Mesh(pathGeometry, pathMaterial); trace.renderOrder = 3; group.add(trace);
  const particleGeometry = new THREE.ConeGeometry(particleRadius, particleRadius * 3.2, 6);
  const particleMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .88, depthWrite: false });
  const particles = new THREE.InstancedMesh(particleGeometry, particleMaterial, count); particles.frustumCulled = false; particles.renderOrder = 4; group.add(particles);
  const marker = new THREE.Object3D(), axis = new THREE.Vector3(0, 1, 0);
  let state = { phase: 0, intensity: 0 }, disposed = false;
  function update({ phase, intensity = 1 }) {
    if (disposed) throw new Error('disposed flow');
    const next = { phase: wrapPhase(phase), intensity: normalizedIntensity(intensity) }, offsets = sampleFlowOffsets(count, next.phase);
    // Validate all input before modifying the live effect.
    state = next; group.visible = next.intensity > 0;
    pathMaterial.opacity = .24 * next.intensity; particleMaterial.opacity = .9 * next.intensity;
    offsets.forEach((u, index) => {
      marker.position.copy(curve.getPointAt(u)); marker.quaternion.setFromUnitVectors(axis, curve.getTangentAt(u).normalize());
      marker.updateMatrix(); particles.setMatrixAt(index, marker.matrix);
    });
    particles.instanceMatrix.needsUpdate = true;
  }
  update({ phase: 0, intensity: 0 });
  return { group, update,
    snapshot: () => ({ ...state, visible: group.visible, offsets: sampleFlowOffsets(count, state.phase) }),
    dispose() { if (disposed) return; disposed = true; group.removeFromParent(); pathGeometry.dispose(); pathMaterial.dispose(); particleGeometry.dispose(); particleMaterial.dispose(); }
  };
}

/** A small visible event marker; callers decide whether it represents ignition, contact, etc. */
export function createPulse(THREE, { color = '#e59a2b', radius = .004 } = {}) {
  positive(radius, 'pulse radius');
  const group = new THREE.Group(); group.name = 'teaching-event'; group.userData.processEffect = true;
  const geometry = new THREE.OctahedronGeometry(radius, 1);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
  const core = new THREE.Mesh(geometry, material); core.renderOrder = 5; group.add(core);
  let state = { intensity: 0, scale: 1 }, disposed = false;
  function update({ intensity = 0, scale = 1 }) {
    if (disposed) throw new Error('disposed pulse');
    const next = { intensity: normalizedIntensity(intensity), scale: positive(scale, 'pulse scale') };
    state = next; group.visible = next.intensity > 0; core.scale.setScalar(next.scale); material.opacity = .9 * next.intensity;
  }
  update({});
  return { group, update, snapshot: () => ({ ...state, visible: group.visible }),
    dispose() { if (disposed) return; disposed = true; group.removeFromParent(); geometry.dispose(); material.dispose(); }
  };
}
