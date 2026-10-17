import { engineState, SPEC } from './model.mjs';

// Display geometry, deliberately separate from engineState's rigid kinematics.
// The original asset's crown is 22 mm above the wrist-pin centre. A 0.5 mm
// display gap avoids z-fighting; these values do not define a compression ratio.
export const PROCESS = Object.freeze({
  chamberTopMM: 230, crownOffsetMM: 22.5, chamberRadiusMM: 38.5,
  sparkWindowDegrees: 14, flameSweepDegrees: 92,
  sparkFrontYMM: -27,
  intakeColor: '#5193ad', burnedColor: '#dba16b', sparkColor: '#ecad55',
});
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const labels = Object.freeze({ intake: '进气流入', compression: '活塞上行 · 混合气压缩', power: '点火后膨胀做功', exhaust: '废气排出' });

// The source plug ends above the simplified open display chamber. Place the
// teaching flash in its visible front half, not behind the intake-valve disc.
export function sparkAnchorMM(cylinder) {
  return [cylinder.xMM, PROCESS.sparkFrontYMM, (cylinder.topMM + cylinder.bottomMM) / 2];
}

/** Every phase, volume and pulse is a pure function of the existing crank model. */
export function processState(angle, { enabled = true, cutaway = true, explode = 0 } = {}) {
  if (typeof enabled !== 'boolean' || typeof cutaway !== 'boolean') throw new TypeError('过程开关与剖面开关必须是布尔值。');
  if (!Number.isFinite(explode) || explode < 0 || explode > 1) throw new TypeError('过程观察展开必须在 0–1。');
  const model = engineState(angle);
  const visible = enabled && cutaway && explode === 0;
  return {
    angle: model.angle, visible,
    hiddenReason: !enabled ? 'disabled' : explode > 0 ? 'exploded' : !cutaway ? 'closed-cutaway' : null,
    source: 'existing-crank-angle', pressureOrFlowSolver: false,
    cylinders: model.cylinders.map(cylinder => {
      const { phase, stroke, pistonHeight } = cylinder;
      const progress = (phase - stroke.start) / 180;
      const bottomMM = pistonHeight + PROCESS.crownOffsetMM;
      const heightMM = PROCESS.chamberTopMM - bottomMM;
      const intakeIntensity = cylinder.intakeLift / SPEC.valveLift;
      const exhaustIntensity = cylinder.exhaustLift / SPEC.valveLift;
      const spark = stroke.id === 'power' && phase < PROCESS.sparkWindowDegrees;
      const sparkIntensity = spark ? (1 - phase / PROCESS.sparkWindowDegrees) ** .65 : 0;
      const flameProgress = stroke.id === 'power' ? clamp(phase / PROCESS.flameSweepDegrees) : 0;
      const flameIntensity = stroke.id === 'power' ? Math.sin(Math.PI * clamp((phase + 3) / (PROCESS.flameSweepDegrees + 12))) * (1 - progress * .65) : 0;
      return {
        number: cylinder.number, xMM: cylinder.x, phase, stage: stroke.id, label: labels[stroke.id], progress,
        pistonHeightMM: pistonHeight, bottomMM, topMM: PROCESS.chamberTopMM, heightMM,
        volumeMM3: Math.PI * PROCESS.chamberRadiusMM ** 2 * heightMM,
        gas: {
          color: stroke.id === 'power' || stroke.id === 'exhaust' ? PROCESS.burnedColor : PROCESS.intakeColor,
          // Opacity is an illustrative contrast cue, never pressure/density data.
          opacity: stroke.id === 'compression' ? .1 + .14 * progress
            : stroke.id === 'power' ? .22 - .14 * progress : stroke.id === 'exhaust' ? .09 : .075 + .055 * progress,
        },
        intake: { intensity: intakeIntensity, phase: progress * 2 },
        injection: { intensity: intakeIntensity, phase: progress * 2 },
        exhaust: { intensity: exhaustIntensity, phase: progress * 2 },
        spark: { active: spark, intensity: sparkIntensity },
        flame: { progress: flameProgress, intensity: Math.max(0, flameIntensity) },
      };
    }),
  };
}
