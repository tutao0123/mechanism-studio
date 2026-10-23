/** Original compact joint design, metres and radians. Not production CAD. */
export const SPEC_REVISION = 'robot-joint-24-24-72-v1';
export const GEOMETRY_REVISION = SPEC_REVISION;
export const ROOT_ID = 'rj-asm:joint';
export const REDUCER_SCALE = .6;
export const MODULE = .0012;
export const PRESSURE_ANGLE = 20 * Math.PI / 180;
export const TEETH = Object.freeze({ sun: 24, planet: 24, ring: 72 });
export const ORBIT_RADIUS = .0288;
export const GEAR_WIDTH = .0072;
export const PLANET_ANGLES = Object.freeze([0, 2 * Math.PI / 3, 4 * Math.PI / 3]);
export const GEAR_SPEC = Object.freeze({ sunTeeth: 24, planetTeeth: 24, ringTeeth: 72,
  module: MODULE, pressureAngle: PRESSURE_ANGLE, orbitRadius: ORBIT_RADIUS, planetCount: 3,
  sunPhase: 0, planetPhase: Math.PI / 24, ringGapPhase: Math.PI / 72 });
export const HOUSING = Object.freeze({ inner: .05112, outer: .0576, halfLength: .012,
  boltCircle: .0543, boltBore: .00102, plateZ: .0144, plateWidth: .0036, gasketZ: .0123,
  gasketWidth: .0006, fastenerZ: .0168, sealZ: .0198, clipZ: .0174 });
export const SUPPORT_BEARINGS = Object.freeze({
  front: Object.freeze({ z: .0144, bore: .00363, outer: .0096, width: .0042, pitch: .0066,
    ballRadius: .00126, balls: 10, grooveClearance: .000036, innerShoulder: .00588, outerShoulder: .00732, sealOuter: .0072 }),
  rear: Object.freeze({ z: -.0144, bore: .00483, outer: .012, width: .0042, pitch: .0084,
    ballRadius: .0015, balls: 10, grooveClearance: .000036, innerShoulder: .0075, outerShoulder: .0093, sealOuter: .0096 }),
});
export const MOTOR_SPEC = Object.freeze({ centerZ: .039, length: .021, shaftRadius: .0036,
  rotorInner: .025, rotorOuter: .0288, magnetInner: .0290, magnetOuter: .0310,
  statorInner: .0318, statorYokeInner: .042, statorOuter: .048,
  housingInner: .04815, housingOuter: .0576, housingStartZ: .024,
  housingEndZ: .052, magnetCount: 14, coilCount: 12, airGap: .0008,
  endcapZ: .054, boltCircle: .0543, encoderZ: .0508 });
const assemblyOf = group => ['motor','motor-magnets','motor-coils','motor-fasteners','encoder'].includes(group) ? 'rj-asm:motor'
  : group.startsWith('support-bearing') ? 'rj-asm:support'
  : ['housing','endplates','gaskets','housing-bolts','housing-washers','seals','bearing-clips'].includes(group) ? 'rj-asm:structure'
  : group === 'output' ? 'rj-asm:output' : 'rj-asm:reducer';
const record = (id, name, translation, motionRole, group, definition, extra = {}) =>
  Object.freeze({ id: `rj:${id}`, name, translation: Object.freeze(translation), motionRole, group,
    definitionId: `rj-def:${definition ?? id}`, parentId: assemblyOf(group), ...extra });
const centre = (i, z = 0) => [ORBIT_RADIUS * Math.cos(PLANET_ANGLES[i]), ORBIT_RADIUS * Math.sin(PLANET_ANGLES[i]), z];
const around = (radius, angle, z) => [radius * Math.cos(angle), radius * Math.sin(angle), z];
export const PARTS = Object.freeze([
  record('sun', 'Motor-driven sun · 24 teeth', [0, 0, 0], 'sun', 'gears'),
  record('ring', 'Fixed ring · 72 internal teeth', [0, 0, 0], 'fixed', 'ring'),
  ...PLANET_ANGLES.map((_, i) => record(`planet-${i + 1}`, `Planet ${i + 1} · 24 teeth`, centre(i), 'planet', 'planets', 'planet', { planetIndex: i })),
  record('carrier-rear', 'Output carrier spider', [0, 0, -.0072], 'carrier', 'carrier', 'carrier'),
  record('carrier-front', 'Front carrier spider', [0, 0, .0072], 'carrier', 'carrier', 'carrier'),
  ...PLANET_ANGLES.map((_, i) => record(`pin-${i + 1}`, `Planet pin ${i + 1}`, centre(i), 'carrier', 'pins', 'pin', { planetIndex: i })),
  ...PLANET_ANGLES.map((_, i) => record(`bearing-${i + 1}`, `Journal bushing ${i + 1}`, centre(i), 'planet', 'bearings', 'bearing', { planetIndex: i })),
  ...PLANET_ANGLES.map((_, i) => record(`washer-${i + 1}`, `Thrust washer ${i + 1}`, centre(i, .00912), 'carrier', 'washers', 'washer', { planetIndex: i })),
  ...PLANET_ANGLES.map((_, i) => record(`screw-${i + 1}`, `Carrier socket screw ${i + 1}`, centre(i, .0096), 'carrier', 'screws', 'screw', { planetIndex: i })),
  record('input-shaft', 'Sun input shaft', [0, 0, .0126], 'sun', 'input'),
  record('output-hub', 'Hollow output hub', [0, 0, -.0144], 'carrier', 'output'),
  record('housing', 'Reducer housing', [0, 0, 0], 'fixed', 'housing'),
  ...['front', 'rear'].flatMap(side => {
    const sign = side === 'front' ? 1 : -1, bearing = SUPPORT_BEARINGS[side], group = `support-bearing-${side}`;
    const position = k => around(HOUSING.boltCircle, 2 * Math.PI * (k + .5) / 6, sign * HOUSING.fastenerZ), extra = { supportSide: side };
    return [
      record(`endplate-${side}`, `${side === 'front' ? 'Motor-side' : 'Output-side'} endplate`, [0, 0, sign * HOUSING.plateZ], 'fixed', 'endplates', undefined, extra),
      record(`gasket-${side}`, `${side} housing gasket`, [0, 0, sign * HOUSING.gasketZ], 'fixed', 'gaskets', 'gasket', extra),
      ...Array.from({ length: 6 }, (_, k) => record(`housing-bolt-${side}-${k + 1}`, `${side} housing screw ${k + 1}`, position(k), 'fixed', 'housing-bolts', `housing-bolt-${side}`, extra)),
      ...Array.from({ length: 6 }, (_, k) => record(`housing-washer-${side}-${k + 1}`, `${side} housing washer ${k + 1}`, position(k), 'fixed', 'housing-washers', 'housing-washer', extra)),
      record(`shaft-seal-${side}`, `${side} shaft seal`, [0, 0, sign * HOUSING.sealZ], 'fixed', 'seals', undefined, extra),
      record(`support-bearing-${side}-inner`, `${side} bearing inner race`, [0, 0, bearing.z], side === 'front' ? 'sun' : 'carrier', group, undefined, { ...extra, bearingElement: 'inner' }),
      record(`support-bearing-${side}-outer`, `${side} bearing outer race`, [0, 0, bearing.z], 'fixed', group, undefined, { ...extra, bearingElement: 'outer' }),
      record(`support-bearing-${side}-cage`, `${side} bearing cage`, [0, 0, bearing.z], 'bearing-cage', group, undefined, { ...extra, bearingElement: 'cage' }),
      ...Array.from({ length: bearing.balls }, (_, k) => record(`support-bearing-${side}-ball-${k + 1}`, `${side} bearing ball ${k + 1}`,
        around(bearing.pitch, 2 * Math.PI * k / bearing.balls, bearing.z), 'bearing-ball', group, `support-bearing-${side}-ball`, { ...extra, bearingElement: 'ball', ballIndex: k })),
      record(`bearing-clip-${side}`, `${side} bearing retaining clip`, [0, 0, sign * HOUSING.clipZ], 'fixed', 'bearing-clips', undefined, extra),
    ];
  }),
  record('output-flange', 'Robot-link output flange', [0, 0, -.0265], 'carrier', 'output'),
  record('motor-adapter', 'Motor mounting spacer', [0, 0, .0201], 'fixed', 'motor'),
  record('motor-shaft', 'Rotor drive shaft', [0, 0, MOTOR_SPEC.centerZ], 'sun', 'motor'),
  record('motor-rotor', 'Fourteen-pole rotor drum', [0, 0, MOTOR_SPEC.centerZ], 'sun', 'motor'),
  record('motor-stator', 'Twelve-tooth stator core', [0, 0, MOTOR_SPEC.centerZ], 'fixed', 'motor'),
  ...Array.from({ length: MOTOR_SPEC.magnetCount }, (_, k) => record(`motor-magnet-${k + 1}`, `Rotor magnet ${k + 1}`, [0, 0, MOTOR_SPEC.centerZ], 'sun', 'motor-magnets', 'motor-magnet', { angularIndex: k, restAngle: 2 * Math.PI * k / MOTOR_SPEC.magnetCount, magneticPolarity: k % 2 ? 'S' : 'N' })),
  ...Array.from({ length: MOTOR_SPEC.coilCount }, (_, k) => record(`motor-coil-${k + 1}`, `Stator winding ${k + 1}`, [0, 0, MOTOR_SPEC.centerZ], 'fixed', 'motor-coils', 'motor-coil', { angularIndex: k, restAngle: 2 * Math.PI * k / MOTOR_SPEC.coilCount, electricalPhase: ['A', 'B', 'C'][k % 3] })),
  record('motor-housing', 'Motor cooling sleeve', [0, 0, .038], 'fixed', 'motor'),
  record('motor-endcap', 'Rear motor cap', [0, 0, MOTOR_SPEC.endcapZ], 'fixed', 'motor'),
  record('motor-tail-bushing', 'Rear motor journal bushing', [0, 0, MOTOR_SPEC.endcapZ], 'fixed', 'motor'),
  ...Array.from({ length: 6 }, (_, k) => record(`motor-bolt-${k + 1}`, `Motor cap screw ${k + 1}`, around(MOTOR_SPEC.boltCircle, 2 * Math.PI * k / 6, .056), 'fixed', 'motor-fasteners', 'motor-bolt')),
  ...Array.from({ length: 6 }, (_, k) => record(`motor-washer-${k + 1}`, `Motor cap washer ${k + 1}`, around(MOTOR_SPEC.boltCircle, 2 * Math.PI * k / 6, .056), 'fixed', 'motor-fasteners', 'motor-washer')),
  record('encoder-disc', 'Rotor position target', [0, 0, MOTOR_SPEC.encoderZ], 'sun', 'encoder'),
  record('encoder-board', 'Position-sensor board', [0, 0, .0521], 'fixed', 'encoder'),
  record('encoder-sensor', 'Position-sensor package', [.007, 0, .05165], 'fixed', 'encoder'),
]);
export const ASSEMBLIES = Object.freeze([
  { id: ROOT_ID, name: 'Compact robot joint actuator', parentId: null,
    children: ['motor', 'reducer', 'support', 'structure', 'output'].map(s => `rj-asm:${s}`) },
  ...[['motor', 'Brushless motor and position sensing'], ['reducer', 'Planetary reduction stage'], ['support', 'Rolling shaft supports'], ['structure', 'Reducer enclosure and fasteners'], ['output', 'Robot-link output']]
    .map(([id, name]) => ({ id: `rj-asm:${id}`, name, parentId: ROOT_ID, children: PARTS.filter(p => p.parentId === `rj-asm:${id}`).map(p => p.id) })),
]);
export const LIMITATIONS = Object.freeze([
  'Original compact joint teaching design generated locally; not a vendor model, exact CAD B-rep, manufacturing drawing or certified actuator.',
  'The original Mechanism Studio planetary reducer geometry is reused at 0.6 scale and extended with an independently authored 12-slot / 14-pole motor, position-sensor package and robot-link flange.',
  'A fixed 72-tooth ring, 24-tooth sun and three 24-tooth planets give an ideal 4:1 reduction; the rotor, input shaft and sun are an authored rigid connection.',
  'Motor winding packs, pole labels and sensor components show structural intent only. Electromagnetic forces, commutation, winding circuits, control electronics, thermal performance and sensor output are not simulated.',
  'Shaft supports use ideal zero-contact-angle, no-slip rolling kinematics with fixed outer races. Load, bearing contact pressure, slip, lubrication, fatigue, stiffness and cage dynamics are not solved.',
  'The motor input shaft uses the reducer-side rolling support and an additional rear plain journal bushing. This is an illustrative support arrangement, without speed, load or wear rating.',
  'Gear teeth are involute meshes with display backlash and simplified root joins. Threads, shaft coupling keys, fits and mounting preloads are simplified or assumed.',
  'Named magnetic blocks and coil packs are genuine repeated geometry, with occurrence rotations and a positive nominal rotor-to-stator air gap; they are not borrowed commercial motor internals.',
  'The nested assembly tree is authored for this design. Exploded paths are editorial offsets, not a collision-checked disassembly or recovered CAD constraints.',
  'The gear train repeats after four sun turns; individual rolling-bearing ball identities need not. Cover the rolling internals during any editorial time reset.',
]);
