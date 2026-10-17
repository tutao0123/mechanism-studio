import { bodyToGLTF } from './model.mjs';

export const PROCESS_COLORS = Object.freeze({ core: '#537f91', bypass: '#8daeb8', hot: '#c88642', exhaust: '#b9a08a', combustion: '#e8a04c' });
export const PROCESS_LIMITS = Object.freeze({
  combustorX: [-10, 195], combustorInnerMM: 57, combustorOuterMM: 105,
  coreNozzleExitX: 540, tailEndX: 625,
});
const TAU = Math.PI * 2;
const normalizedAngle = value => {
  if (!Number.isFinite(value) || value < 0 || value > 360) throw new TypeError('过程轴角需要 0–360 度。');
  return (value % 360) / 360;
};
const polar = (x, radius, theta) => [x, radius * Math.sin(theta), radius * Math.cos(theta)];
const route = (id, section, theta, points) => ({ id, section, bodyPoints: points.map(([x, radius]) => polar(x, radius, theta)) });

/** Prescribed centre-lines; they indicate ordering and direction, never CFD streamlines. */
export function processGeometry() {
  const routes = [];
  const frontAngles = [Math.PI * 1.12, Math.PI * 1.5, Math.PI * 1.88];
  for (const [index, theta] of frontAngles.entries()) {
    routes.push(route('core-' + index, 'core', theta, [[-515,122],[-450,117],[-393,103],[-338,86],[-278,80],[-217,72],[-163,68],[-109,63],[-55,60],[-12,74],[28,80]]));
    routes.push(route('hot-' + index, 'hot', theta, [[28,80],[92,82],[165,79],[205,73],[245,69],[310,75],[375,81],[418,79],[475,65],[540,48]]));
    routes.push(route('exhaust-' + index, 'exhaust', theta, [[540,48],[570,51],[600,55],[PROCESS_LIMITS.tailEndX,61]]));
  }
  for (let index = 0; index < 6; index += 1) {
    const theta = Math.PI * (1.05 + index * .18);
    routes.push(route('bypass-' + index, 'bypass', theta, [[-515,178],[-445,183],[-385,183],[-250,178],[-30,174],[200,168],[420,162],[475,155],[530,149]]));
  }
  const combustion = [];
  for (const x of [42,107,160]) for (let index = 0; index < 12; index += 1) {
    combustion.push({ id: `burn-${x}-${index}`, bodyPosition: polar(x, 80, index / 12 * TAU), axialHalfLengthMM: 22, radialRadiusMM: 8 });
  }
  return { routes: routes.map(record => ({ ...record, points: record.bodyPoints.map(bodyToGLTF) })),
    combustion: combustion.map(record => ({ ...record, position: bodyToGLTF(record.bodyPosition) })) };
}

/** Pure observation state. Pausing is implicit because the two input angles stop. */
export function processState(mechanicalState, { enabled = true, flow = true, combustion = true } = {}) {
  if ([enabled, flow, combustion].some(value => typeof value !== 'boolean')) throw new TypeError('过程开关必须为布尔值。');
  const corePhase = normalizedAngle(mechanicalState.highAngle), bypassPhase = normalizedAngle(mechanicalState.lowAngle);
  const view = mechanicalState.view;
  if (!view || typeof view.cutaway !== 'boolean' || !Number.isFinite(view.explode) || view.explode < 0 || view.explode > 1) throw new TypeError('过程需要有效观察状态。');
  const suppression = !enabled ? 'disabled' : view.explode > 0 ? 'exploded' : !view.cutaway ? 'closed-shell' : null;
  const visible = suppression === null;
  return { enabled, visible, suppression, flowVisible: visible && flow, combustionVisible: visible && combustion,
    corePhase, bypassPhase, exhaustPhase: corePhase,
    combustionIntensity: visible && combustion ? .72 : 0,
    tailIntensity: visible && flow ? .22 : 0,
    continuousCombustion: true, tailFlame: false,
    phaseSource: 'prescribed-shaft-angle', solver: 'illustrative-paths-no-cfd-or-thermodynamics' };
}
