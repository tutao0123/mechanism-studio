/** Original, explicitly authored teaching mechanism. Lengths are metres. */
export const SPEC_REVISION = 'planetary-24-24-72-v3';
export const GEOMETRY_REVISION = SPEC_REVISION;
export const ROOT_ID = 'pg-asm:planetary';
export const MODULE = .002;
export const PRESSURE_ANGLE = 20 * Math.PI / 180;
export const TEETH = Object.freeze({ sun: 24, planet: 24, ring: 72 });
export const ORBIT_RADIUS = .048;
export const GEAR_WIDTH = .012;
export const PLANET_ANGLES = Object.freeze([0, 2 * Math.PI / 3, 4 * Math.PI / 3]);
export const GEAR_SPEC = Object.freeze({ sunTeeth: 24, planetTeeth: 24, ringTeeth: 72,
  module: MODULE, pressureAngle: PRESSURE_ANGLE, orbitRadius: ORBIT_RADIUS, planetCount: 3,
  sunPhase: 0, planetPhase: Math.PI / 24, ringGapPhase: Math.PI / 72 });
export const DIMENSIONS = Object.freeze({ gearWidth: GEAR_WIDTH, sunBore: .0061,
  planetBore: .0056, ringOuter: .084, ringWidth: .016, carrierZ: .012,
  carrierWidth: .004, carrierBore: .0082, pinRadius: .0039, pinBore: .00155,
  bearingInner: .004, bearingOuter: .0055, bearingWidth: .0124 });
export const HOUSING = Object.freeze({ inner: .0852, outer: .096, halfLength: .020,
  boltCircle: .0905, boltBore: .0017, plateZ: .024, plateWidth: .006, gasketZ: .0205,
  gasketWidth: .001, fastenerZ: .028, sealZ: .033, clipZ: .029 });
export const SUPPORT_BEARINGS = Object.freeze({
  front: Object.freeze({ z: .024, bore: .00605, outer: .016, width: .007, pitch: .011,
    ballRadius: .0021, balls: 10, grooveClearance: .00006, innerShoulder: .0098, outerShoulder: .0122, sealOuter: .012 }),
  rear: Object.freeze({ z: -.024, bore: .00805, outer: .020, width: .007, pitch: .014,
    ballRadius: .0025, balls: 10, grooveClearance: .00006, innerShoulder: .0125, outerShoulder: .0155, sealOuter: .016 }),
});
const record = (id, name, translation, motionRole, group, definition, extra = {}) =>
  Object.freeze({ id: `pg:${id}`, name, translation: Object.freeze(translation), motionRole, group,
    definitionId: `pg-def:${definition ?? id}`, parentId: ROOT_ID, ...extra });
const centre = (i, z = 0) => [ORBIT_RADIUS * Math.cos(PLANET_ANGLES[i]), ORBIT_RADIUS * Math.sin(PLANET_ANGLES[i]), z];
export const PARTS = Object.freeze([
  record('sun', 'Sun gear · 24 teeth', [0, 0, 0], 'sun', 'gears'),
  record('ring', 'Fixed ring · 72 internal teeth', [0, 0, 0], 'fixed', 'ring'),
  ...PLANET_ANGLES.map((_, i) => record(`planet-${i + 1}`, `Planet ${i + 1} · 24 teeth`, centre(i), 'planet', 'planets', 'planet', { planetIndex: i })),
  record('carrier-rear', 'Rear carrier spider', [0, 0, -.012], 'carrier', 'carrier', 'carrier'),
  record('carrier-front', 'Front carrier spider', [0, 0, .012], 'carrier', 'carrier', 'carrier'),
  ...PLANET_ANGLES.map((_, i) => record(`pin-${i + 1}`, `Planet pin ${i + 1}`, centre(i), 'carrier', 'pins', 'pin', { planetIndex: i })),
  ...PLANET_ANGLES.map((_, i) => record(`bearing-${i + 1}`, `Journal bushing ${i + 1}`, centre(i), 'planet', 'bearings', 'bearing', { planetIndex: i })),
  ...PLANET_ANGLES.map((_, i) => record(`washer-${i + 1}`, `Thrust washer ${i + 1}`, centre(i, .0152), 'carrier', 'washers', 'washer', { planetIndex: i })),
  ...PLANET_ANGLES.map((_, i) => record(`screw-${i + 1}`, `Socket screw ${i + 1}`, centre(i, .016), 'carrier', 'screws', 'screw', { planetIndex: i })),
  record('input-shaft', 'Input shaft', [0, 0, .021], 'sun', 'input'),
  record('output-hub', 'Carrier output hub', [0, 0, -.024], 'carrier', 'output'),
  record('housing', 'Gear housing', [0, 0, 0], 'fixed', 'housing'),
  ...['front', 'rear'].flatMap(side => {
    const sign = side === 'front' ? 1 : -1, bearing = SUPPORT_BEARINGS[side], group = `support-bearing-${side}`;
    const boltPosition = k => { const a = 2 * Math.PI * (k + .5) / 6; return [HOUSING.boltCircle * Math.cos(a), HOUSING.boltCircle * Math.sin(a), sign * HOUSING.fastenerZ]; };
    const extra = { supportSide: side };
    return [
      record(`endplate-${side}`, `${side === 'front' ? 'Front' : 'Rear'} endplate`, [0, 0, sign * HOUSING.plateZ], 'fixed', 'endplates', undefined, extra),
      record(`gasket-${side}`, `${side === 'front' ? 'Front' : 'Rear'} housing gasket`, [0, 0, sign * HOUSING.gasketZ], 'fixed', 'gaskets', 'gasket', extra),
      ...Array.from({ length: 6 }, (_, k) => record(`housing-bolt-${side}-${k + 1}`, `${side} housing screw ${k + 1}`, boltPosition(k), 'fixed', 'housing-bolts', `housing-bolt-${side}`, extra)),
      ...Array.from({ length: 6 }, (_, k) => record(`housing-washer-${side}-${k + 1}`, `${side} housing washer ${k + 1}`, boltPosition(k), 'fixed', 'housing-washers', 'housing-washer', extra)),
      record(`shaft-seal-${side}`, `${side === 'front' ? 'Input' : 'Output'} shaft seal`, [0, 0, sign * HOUSING.sealZ], 'fixed', 'seals', undefined, extra),
      record(`support-bearing-${side}-inner`, `${side} bearing inner race`, [0, 0, bearing.z], side === 'front' ? 'sun' : 'carrier', group, undefined, { ...extra, bearingElement: 'inner' }),
      record(`support-bearing-${side}-outer`, `${side} bearing outer race`, [0, 0, bearing.z], 'fixed', group, undefined, { ...extra, bearingElement: 'outer' }),
      record(`support-bearing-${side}-cage`, `${side} bearing cage`, [0, 0, bearing.z], 'bearing-cage', group, undefined, { ...extra, bearingElement: 'cage' }),
      ...Array.from({ length: bearing.balls }, (_, k) => {
        const angle = 2 * Math.PI * k / bearing.balls;
        return record(`support-bearing-${side}-ball-${k + 1}`, `${side} bearing ball ${k + 1}`, [bearing.pitch * Math.cos(angle), bearing.pitch * Math.sin(angle), bearing.z], 'bearing-ball', group, `support-bearing-${side}-ball`, { ...extra, bearingElement: 'ball', ballIndex: k });
      }),
      record(`bearing-clip-${side}`, `${side} bearing retaining clip`, [0, 0, sign * HOUSING.clipZ], 'fixed', 'bearing-clips', undefined, extra),
    ];
  }),
]);
export const LIMITATIONS = Object.freeze([
  'Original parametric teaching geometry; not sourced production CAD or a manufacturing drawing.',
  'Standard involute spur profiles with small display backlash; root joins are simplified and no strength or manufacturing tolerance claim is made.',
  'The three planet journals retain their original plain bushings. Two additional shaft support bearings expose separate races, cages and ten balls each.',
  'Support bearings use ideal zero-contact-angle, no-slip kinematics with fixed outer races. Cage orbit and absolute ball spin follow the corresponding shaft; load, slip, elastic deformation and cage dynamics are not simulated.',
  'Raceway curvature includes 60 micrometres of conformity relief away from the nominal equatorial contacts. This tessellated teaching model is not a tolerance or contact-pressure calculation.',
  'Four sun turns close the gear train but not each bearing occurrence phase. Rolling internals are hidden at the editorial loop reset; their ratios are never altered to force closure.',
  'Pin bores, screw sockets, housing passages, grooved races and seal profiles are modeled; helical threads, fits, lubrication and seal deformation are not solved.',
  'The ring/housing restraint, bearing seating, carrier/output and sun/input rigid connections are authored teaching assumptions; the housing has no independently verified production mounting design.',
  'Mesh-phase and speed checks are geometric/kinematic evidence, not a contact, load, friction or collision solver.',
]);
