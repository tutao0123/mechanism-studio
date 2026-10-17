import { createFlowPath, createPulse } from '../../shared/animation/effects.mjs';
import { processGeometry, PROCESS_COLORS } from './process.mjs';

/** Visual-only process group; never inserted in model nodes or picking/bounds lists. */
export function createTurbofanProcess(THREE) {
  const group = new THREE.Group(); group.name = 'turbofan/teaching-process';
  const geometry = processGeometry(), flows = [], burners = [], rings = [];
  let lastState = null;
  for (const route of geometry.routes) {
    const tail = route.section === 'exhaust';
    const effect = createFlowPath(THREE, { points: route.points,
      count: tail ? 5 : route.section === 'bypass' ? 16 : 18,
      color: PROCESS_COLORS[route.section], radius: tail ? .00045 : .00065,
      particleRadius: tail ? .0018 : .0025 });
    effect.group.name = 'process/' + route.id;
    group.add(effect.group); flows.push({ ...route, effect });
  }
  for (const pocket of geometry.combustion) {
    const holder = new THREE.Group(); holder.name = 'process/' + pocket.id;
    holder.position.fromArray(pocket.position); holder.scale.set(2.75, 1, 1);
    const pulse = createPulse(THREE, { color: PROCESS_COLORS.combustion, radius: .008 });
    holder.add(pulse.group); group.add(holder); burners.push(pulse);
  }
  // Annular bands leave the shaft centre empty, matching the liner's air space.
  for (const x of [42,107,160]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.08, .008, 8, 64),
      new THREE.MeshBasicMaterial({ color: PROCESS_COLORS.combustion, transparent: true, opacity: .1, depthWrite: false }));
    ring.name = 'process/annular-combustion'; ring.position.set(x * .001, 0, 0); ring.rotation.y = Math.PI / 2;
    ring.renderOrder = 4; group.add(ring); rings.push(ring);
  }
  function update(state) {
    lastState = { ...state };
    group.visible = state.visible;
    for (const route of flows) {
      route.effect.group.visible = state.flowVisible;
      route.effect.update({ phase: route.section === 'bypass' ? state.bypassPhase : state.corePhase,
        intensity: !state.flowVisible ? 0 : route.section === 'exhaust' ? state.tailIntensity : route.section === 'hot' ? .72 : .64 });
    }
    // Steady annular combustion: no rotor-angle flicker and no pulse beyond nozzle.
    for (const pulse of burners) {
      pulse.group.visible = state.combustionVisible;
      pulse.update({ intensity: state.combustionIntensity, scale: 1 });
    }
    for (const ring of rings) { ring.visible = state.combustionVisible; ring.material.opacity = .15 * state.combustionIntensity; }
  }
  return { group, update, snapshot: () => ({ ...lastState, visible: group.visible, routeCount: flows.length, combustionPockets: burners.length,
    annularBands: rings.length, externalFlamePockets: 0,
    flows: flows.map(route => ({ id: route.id, section: route.section, ...route.effect.snapshot() })) }),
    dispose() { for (const route of flows) route.effect.dispose(); for (const burner of burners) burner.dispose(); for (const ring of rings) { ring.geometry.dispose(); ring.material.dispose(); } group.removeFromParent(); } };
}
