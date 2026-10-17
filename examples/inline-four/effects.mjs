import { createFlowPath, createPulse } from '../../shared/animation/effects.mjs';
import { SPEC, bodyToGLTF } from './model.mjs';
import { PROCESS, sparkAnchorMM } from './process.mjs';

/** Purely visual helpers. Never register with viewer.parts, meshes or picking. */
export function createEngineProcessEffects(THREE) {
  const group = new THREE.Group(); group.name = 'engine-process-effects'; group.userData.isProcessEffect = true;
  const cylinders = [];
  const gasGeometry = new THREE.CylinderGeometry(1, 1, 1, 40, 1, false);
  const frontGeometry = new THREE.TorusGeometry(1, .035, 6, 40);
  const frontGlowGeometry = new THREE.SphereGeometry(1, 24, 12);
  const sparkRayGeometry = new THREE.CylinderGeometry(1, 1, 1, 5);
  const injectorGeometry = new THREE.CylinderGeometry(.0022, .0031, .008, 10);
  for (const [index, x] of SPEC.cylinderX.entries()) {
    const root = new THREE.Group(); root.name = `cylinder-${index + 1}/process`; group.add(root);
    const gasMaterial = new THREE.MeshBasicMaterial({ color: PROCESS.intakeColor, transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const gas = new THREE.Mesh(gasGeometry, gasMaterial); gas.name = 'illustrative-charge-volume'; gas.renderOrder = 2;
    root.add(gas);
    const intake = createFlowPath(THREE, {
      points: [[x,-112,257],[x,-78,257],[x,-46,246],[x,-17,226],[x,0,226]].map(bodyToGLTF),
      count: 9, color: PROCESS.intakeColor, radius: .00065, particleRadius: .0019,
    });
    const exhaust = createFlowPath(THREE, {
      points: [[x,0,226],[x,17,226],[x,46,245],[x,76,239],[x,112,222]].map(bodyToGLTF),
      count: 9, color: PROCESS.burnedColor, radius: .00065, particleRadius: .0019,
    });
    const injection = createFlowPath(THREE, {
      // A short schematic port spray joins the intake path upstream of the
      // valve. It is not a direct injector or a resolved droplet trajectory.
      points: [[x+14,-140,282],[x+6,-124,267],[x,-112,257]].map(bodyToGLTF),
      count: 5, color: '#a66d20', radius: .00065, particleRadius: .002,
    });
    injection.group.name = 'schematic-port-fuel-spray';
    const injectorMaterial = new THREE.MeshBasicMaterial({ color: '#956329', depthTest: true, toneMapped: false });
    const injector = new THREE.Mesh(injectorGeometry,injectorMaterial);injector.name='schematic-external-injector-anchor';
    const jetStart=new THREE.Vector3(...bodyToGLTF([x+14,-140,282])),jetNext=new THREE.Vector3(...bodyToGLTF([x+6,-124,267]));
    const jetDirection=jetNext.sub(jetStart).normalize();injector.position.copy(jetStart).addScaledVector(jetDirection,-.004);
    injector.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),jetDirection);injection.group.add(injector);
    root.add(intake.group, exhaust.group, injection.group);
    const spark = createPulse(THREE, { color: '#ffd080', radius: .0019 });
    spark.group.name = 'tdc-spark-display-window'; root.add(spark.group);
    const star = new THREE.Group(); star.name = 'visible-chamber-spark-star'; root.add(star);
    const starMaterial = new THREE.MeshBasicMaterial({ color: '#ce751b', transparent: true, opacity: .95, depthTest: true, depthWrite: false, toneMapped: false });
    const axis = new THREE.Vector3(0, 1, 0);
    for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[.78,.7],[-.78,.7],[.78,-.7],[-.78,-.7]]) {
      const end = new THREE.Vector3(dx * .0065, dz * .0031, 0);
      const middle = end.clone().multiplyScalar(.53).add(new THREE.Vector3(dz * .00055, -dx * .00035, 0));
      for (const [a,b] of [[new THREE.Vector3(),middle],[middle,end]]) {
        const direction = b.clone().sub(a), ray = new THREE.Mesh(sparkRayGeometry, starMaterial);
        ray.position.copy(a).add(b).multiplyScalar(.5); ray.quaternion.setFromUnitVectors(axis,direction.clone().normalize());
        ray.scale.set(.00042,direction.length(),.00042);ray.renderOrder=6;star.add(ray);
      }
    }
    const frontMaterial = new THREE.MeshBasicMaterial({ color: '#df944b', transparent: true, opacity: .5, depthWrite: false, toneMapped: false });
    const flame = new THREE.Mesh(frontGeometry, frontMaterial); flame.name = 'illustrative-flame-front'; flame.rotation.x = Math.PI / 2; flame.renderOrder = 3;
    const glowMaterial = new THREE.MeshBasicMaterial({ color: PROCESS.burnedColor, transparent: true, opacity: .1, depthWrite: false, toneMapped: false });
    const glow = new THREE.Mesh(frontGlowGeometry, glowMaterial); glow.name = 'illustrative-flame-glow'; glow.renderOrder = 2;
    root.add(flame, glow);
    cylinders.push({ root, gas, intake, exhaust, injection, injectorMaterial, spark, star, starMaterial, flame, glow });
  }
  group.traverse(object => { object.userData.isProcessEffect = true; object.raycast = () => {}; });
  let disposed = false;
  return {
    group,
    update(snapshot) {
      if (disposed) return;
      group.visible = snapshot.visible;
      for (const [index, effect] of cylinders.entries()) {
        const state = snapshot.cylinders[index];
        const height = state.heightMM * .001, x = state.xMM * .001;
        effect.gas.position.set(x, (state.topMM + state.bottomMM) * .0005, 0);
        effect.gas.scale.set(PROCESS.chamberRadiusMM * .001, height, PROCESS.chamberRadiusMM * .001);
        effect.gas.material.color.set(state.gas.color); effect.gas.material.opacity = state.gas.opacity;
        effect.intake.update(state.intake); effect.exhaust.update(state.exhaust); effect.injection.update(state.injection);
        const anchor = bodyToGLTF(sparkAnchorMM(state));
        effect.spark.group.position.fromArray(anchor); effect.star.position.fromArray(anchor);
        effect.spark.update({ intensity: state.spark.intensity, scale: .9 + state.spark.intensity * .5 });
        effect.star.visible = state.spark.active;
        effect.star.scale.setScalar(.8 + state.spark.intensity * .2);
        effect.starMaterial.opacity = Math.min(1,state.spark.intensity * 1.6);
        const radius = (.0025 + .034 * state.flame.progress);
        const y = state.topMM * .001 - .002 - height * state.flame.progress * .82;
        effect.flame.position.set(x, y, 0); effect.flame.scale.setScalar(radius); effect.flame.material.opacity = state.flame.intensity * .6;
        effect.glow.position.set(x, y, 0); effect.glow.scale.set(radius, Math.min(height * .1, .004), radius); effect.glow.material.opacity = state.flame.intensity * .14;
        effect.flame.visible = effect.glow.visible = state.flame.intensity > .001;
      }
    },
    dispose() {
      if (disposed) return; disposed = true;
      for (const effect of cylinders) {
        effect.intake.dispose(); effect.exhaust.dispose(); effect.injection.dispose(); effect.spark.dispose();
        effect.gas.material.dispose(); effect.flame.material.dispose(); effect.glow.material.dispose();
        effect.starMaterial.dispose();
        effect.injectorMaterial.dispose();
      }
      gasGeometry.dispose(); frontGeometry.dispose(); frontGlowGeometry.dispose(); sparkRayGeometry.dispose(); injectorGeometry.dispose(); group.removeFromParent();
    },
  };
}
