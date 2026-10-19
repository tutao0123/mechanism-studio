/** Near-part names in the spec-label grammar: index (order of appearance),
 * name, and one spec line computed from the authored spec, never typed in. */
import { TEETH, GEARS, MODULE, SPLINE_TEETH, SLEEVE_TRAVEL, SYNCHROS, CENTRE_DISTANCE } from './spec.mjs';
import { specLabel } from '../../shared/viewer/spec-label.mjs';

const mm = metres => `${+(metres * 1000).toFixed(1)} mm`;
const ratio = gear => `${GEARS[gear].ratio.toFixed(2)} : 1`;
const counterGears = Object.keys(TEETH).filter(key => key.startsWith('counter')).length;
export const LABELS = Object.freeze({
  lever: specLabel({ index: 1, name: 'Shift lever', spec: `${Object.keys(SYNCHROS).length} rails · ${Object.keys(GEARS).length} positions` }),
  input: specLabel({ index: 2, name: 'Input shaft', spec: `${TEETH.input} T · m ${MODULE * 1000}` }),
  counter: specLabel({ index: 3, name: 'Countershaft', spec: `${counterGears} gears · ${mm(CENTRE_DISTANCE)} below` }),
  synchro: specLabel({ index: 4, name: 'Synchronizer', spec: `${SPLINE_TEETH} splines · ${mm(SLEEVE_TRAVEL)} travel` }),
  idler: specLabel({ index: 5, name: 'Reverse idler', spec: `${TEETH.idler} T · reverses the output` }),
  first: specLabel({ index: 6, name: '1st gear', spec: `${TEETH.main1} T · ${ratio(1)}` }),
  second: specLabel({ index: 7, name: '2nd gear', spec: `${TEETH.main2} T · ${ratio(2)}` }),
  sleeve: specLabel({ index: 8, name: 'Sleeve', spec: `slides ${mm(SLEEVE_TRAVEL)}` }),
  ring: specLabel({ index: 9, name: 'Blocker ring', spec: `${SPLINE_TEETH} teeth · Ø ${mm(2 * SYNCHROS.s34.spline)}` }),
  fifth: specLabel({ index: 10, name: '5th gear', spec: `${TEETH.main5} T · ${ratio(5)}` }),
});
