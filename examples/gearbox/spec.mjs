/** Authored specification of an original five-speed teaching gearbox.
 *
 * Everything here is a declared design, not a measured product: straight-cut
 * spur gears of one module, one centre distance for every countershaft pair,
 * idealized ball bearings and synchronizers. Units are glTF metres and radians;
 * +X runs along the shafts from the engine side (front, −X) to the output (+X),
 * +Y is up. Pure data and arithmetic: no Three.js, no I/O. */

export const SPEC_REVISION = 'gearbox-spec-1';
export const MODULE = 0.003;
export const PRESSURE_ANGLE = 20 * Math.PI / 180;
export const PAIR_TEETH_SUM = 54;
export const CENTRE_DISTANCE = MODULE * PAIR_TEETH_SUM / 2;
export const SPLINE_TEETH = 24;

const freeze = value => Object.freeze(value);
export const pitchRadius = teeth => MODULE * teeth / 2;
export const tipRadius = teeth => pitchRadius(teeth) + MODULE;
export const rootRadius = teeth => pitchRadius(teeth) - 1.25 * MODULE;

/** Shaft axes in the YZ plane; every shaft runs along +X. */
export const AXES = (() => {
  const main = [0, 0], counter = [-CENTRE_DISTANCE, 0];
  // The reverse idler meshes the countershaft reverse gear and the mainshaft
  // reverse gear at their own pitch distances; solve that triangle once.
  const toCounter = MODULE * (16 + 18) / 2, toMain = MODULE * (32 + 18) / 2;
  const y = (toCounter ** 2 - toMain ** 2 - CENTRE_DISTANCE ** 2) / (2 * CENTRE_DISTANCE);
  const z = Math.sqrt(toMain ** 2 - y ** 2);
  return freeze({ main: freeze(main), counter: freeze(counter), idler: freeze([y, z]) });
})();

/** Gear meshes. `driver` turns `follower`; each pair is an external spur mesh. */
export const TEETH = freeze({
  input: 20, counterDrive: 34,
  counter1: 17, main1: 37,
  counter2: 24, main2: 30,
  counter3: 30, main3: 24,
  counter5: 37, main5: 17,
  counterR: 16, idler: 18, mainR: 32,
});

/** Forward ratios are input speed / output speed. Fourth is direct drive. */
const constantMesh = TEETH.counterDrive / TEETH.input;
export const GEARS = freeze({
  1: freeze({ id: '1', label: '1st', counter: 'counter1', main: 'main1', synchro: 's12', side: 1, ratio: constantMesh * TEETH.main1 / TEETH.counter1 }),
  2: freeze({ id: '2', label: '2nd', counter: 'counter2', main: 'main2', synchro: 's12', side: -1, ratio: constantMesh * TEETH.main2 / TEETH.counter2 }),
  3: freeze({ id: '3', label: '3rd', counter: 'counter3', main: 'main3', synchro: 's34', side: 1, ratio: constantMesh * TEETH.main3 / TEETH.counter3 }),
  4: freeze({ id: '4', label: '4th', counter: null, main: 'input', synchro: 's34', side: -1, ratio: 1 }),
  5: freeze({ id: '5', label: '5th', counter: 'counter5', main: 'main5', synchro: 's5r', side: 1, ratio: constantMesh * TEETH.main5 / TEETH.counter5 }),
  R: freeze({ id: 'R', label: 'Reverse', counter: 'counterR', main: 'mainR', synchro: 's5r', side: -1, ratio: -constantMesh * TEETH.mainR / TEETH.counterR }),
});

export const SHAFTS = freeze({
  input: freeze({ radius: 0.014, axis: 'main' }),
  main: freeze({ radius: 0.016, axis: 'main' }),
  counter: freeze({ radius: 0.014, axis: 'counter' }),
  idler: freeze({ radius: 0.010, axis: 'idler' }),
});

/** Synchronizers: spline tip radius and the shift rail that moves the sleeve.
 * A gear's `side` is −1 when it sits in front of (−X) its synchronizer. */
export const SYNCHROS = freeze({
  s34: freeze({ id: 's34', label: '3–4', spline: 0.030, rail: freeze([0.078, 0]) }),
  s12: freeze({ id: 's12', label: '1–2', spline: 0.034, rail: freeze([0.078, -0.026]) }),
  s5r: freeze({ id: 's5r', label: '5–R', spline: 0.026, rail: freeze([0.078, 0.026]) }),
});
export const HUB_WIDTH = 0.022;
export const SLEEVE_WIDTH = 0.026;
export const RING_WIDTH = 0.005;
export const DOG_WIDTH = 0.006;
export const RING_GAP = 0.002;

/** Axial stack along the mainshaft line, front to rear. Countershaft gears and
 * the idler share the x-centres of the teeth they mesh with. */
const STACK = [
  { id: 'input', kind: 'gear', teeth: 0.020, dog: 'rear' },
  { id: 's34', kind: 'synchro' },
  { id: 'main3', kind: 'gear', teeth: 0.020, dog: 'front' },
  { id: 'washer-23', kind: 'gap', width: 0.006 },
  { id: 'main2', kind: 'gear', teeth: 0.020, dog: 'rear' },
  { id: 's12', kind: 'synchro' },
  { id: 'main1', kind: 'gear', teeth: 0.020, dog: 'front' },
  { id: 'washer-1r', kind: 'gap', width: 0.006 },
  { id: 'mainR', kind: 'gear', teeth: 0.018, dog: 'rear' },
  { id: 's5r', kind: 'synchro' },
  { id: 'main5', kind: 'gear', teeth: 0.018, dog: 'front' },
];
const START_X = -0.100;
export const LAYOUT = (() => {
  const items = {}; let x = START_X;
  for (const item of STACK) {
    if (item.kind === 'gap') { x += item.width; continue; }
    if (item.kind === 'synchro') {
      const span = 2 * (RING_GAP + RING_WIDTH) + HUB_WIDTH;
      items[item.id] = freeze({ x0: x, x1: x + span, centre: x + span / 2 }); x += span; continue;
    }
    const front = item.dog === 'front' ? DOG_WIDTH : 0, rear = item.dog === 'rear' ? DOG_WIDTH : 0;
    const teeth0 = x + front, teeth1 = teeth0 + item.teeth;
    items[item.id] = freeze({ x0: x, x1: teeth1 + rear, teethCentre: (teeth0 + teeth1) / 2, teethWidth: item.teeth, dog: item.dog,
      dogRange: freeze(item.dog === 'front' ? [x, teeth0] : [teeth1, teeth1 + DOG_WIDTH]) });
    x = teeth1 + rear;
  }
  const frontWall = freeze([START_X - 0.036, START_X - 0.016]), rearWall = freeze([x + 0.012, x + 0.032]);
  return freeze({ ...items, frontWall, rearWall, mainEnd: rearWall[1] + 0.110, inputStart: START_X - 0.170, bellStart: START_X - 0.150 });
})();

/** Sleeve travel from neutral until its internal teeth cover 75% of the dog
 * ring: hub half width + ring gap/ring + 0.75 dog width − sleeve half width. */
export const SLEEVE_TRAVEL = HUB_WIDTH / 2 + RING_GAP + RING_WIDTH + .75 * DOG_WIDTH - SLEEVE_WIDTH / 2;

/** Idealized deep-groove ball bearings: bore follows the shaft. */
export const BEARINGS = freeze({
  input: freeze({ id: 'input', axis: 'main', shaft: 'input', bore: 0.014, outer: 0.034, width: 0.016, balls: 9, x: (LAYOUT.frontWall[0] + LAYOUT.frontWall[1]) / 2 }),
  rear: freeze({ id: 'rear', axis: 'main', shaft: 'main', bore: 0.016, outer: 0.036, width: 0.016, balls: 10, x: (LAYOUT.rearWall[0] + LAYOUT.rearWall[1]) / 2 }),
  counterFront: freeze({ id: 'counterFront', axis: 'counter', shaft: 'counter', bore: 0.014, outer: 0.032, width: 0.016, balls: 9, x: (LAYOUT.frontWall[0] + LAYOUT.frontWall[1]) / 2 }),
  counterRear: freeze({ id: 'counterRear', axis: 'counter', shaft: 'counter', bore: 0.014, outer: 0.032, width: 0.016, balls: 9, x: (LAYOUT.rearWall[0] + LAYOUT.rearWall[1]) / 2 }),
});
export function bearingGeometry(bearing) {
  const pitch = (bearing.bore + bearing.outer) / 2, ball = .58 * (bearing.outer - bearing.bore);
  // Pure rolling with a fixed outer race: the cage turns at the inner race
  // speed times the inner contact radius over twice the pitch radius.
  return freeze({ pitch, ball, innerRace: pitch - .32 * ball, outerRace: pitch + .32 * ball, cageRatio: (pitch - ball / 2) / (2 * pitch) });
}

export const CASE = freeze({ radius: 0.090, wall: 0.005, plateMargin: 0.012, bolts: 10, rearBolts: 6 });
export const LIMITATIONS = freeze([
  'Original teaching model with authored dimensions; not a production gearbox or engineering CAD.',
  'Straight-cut spur gears of one module for legibility; production gearboxes typically use helical forward gears.',
  'Gear speeds follow ideal rigid tooth ratios. No load, friction, backlash, efficiency or contact stress is computed.',
  'Synchronizer speed matching and dog alignment are authored on the timeline, not simulated friction or indexing.',
  'Ball bearings are idealized pure rolling; needle bearings are plain display sleeves. Seals, oil, the clutch and the shift interlock are omitted.',
]);
