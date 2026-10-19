import * as THREE from 'three';
import { DEFAULT_BASE_COLOR, DEFAULT_ACCENT_COLOR } from './color-accents.mjs';

/** Study-page visual styles as plain data. `atlas` is the study shell's
 * long-standing look, value for value, so omitting a style changes nothing.
 * Other styles are opt-in per page; they change appearance only, never
 * geometry, identity, motion or timing. Blueprint borrows the drafting palette
 * of the lemo-opuscar style library (MIT) as an idea, not as copied code. */
export const STYLE_REVISION = 'study-styles-1';

const freeze = value => Object.freeze(value);
export const STYLES = freeze({
  atlas: freeze({
    id: 'atlas', label: 'White atlas', bodyClass: null, background: '#ffffff',
    lights: freeze({
      hemisphere: freeze({ sky: '#ffffff', ground: '#d9d9d5', intensity: 2.4 }),
      key: freeze({ color: '#ffffff', intensity: 2.2, position: freeze([-.5, 1.5, 1.2]) }),
      fill: freeze({ color: '#ffffff', intensity: .65, position: freeze([.8, .35, -.7]) }),
    }),
    fill: freeze({ material: 'standard', color: DEFAULT_BASE_COLOR, metalness: 0, roughness: .88 }),
    lines: freeze({ enabled: true, color: '#353532', detailColor: '#93938e' }),
    accents: freeze({ base: DEFAULT_BASE_COLOR, accent: DEFAULT_ACCENT_COLOR }),
    // Drafting marks (dimension and centre lines) use one measured-ink accent.
    drafting: freeze({ ink: '#3f7187', centre: '#9a9a93', halo: '#ffffff', stamp: null }),
  }),
  blueprint: freeze({
    id: 'blueprint', label: 'Blueprint', bodyClass: 'style-blueprint', background: '#18336b',
    // Unlit: solids are filled with the sheet colour, so they only hide the
    // lines behind them, exactly like paper filled before its outline is drawn.
    lights: null,
    fill: freeze({ material: 'basic', color: '#18336b' }),
    lines: freeze({ enabled: true, color: '#e7f0f9', detailColor: '#86a8d6' }),
    accents: freeze({ base: '#18336b', accent: '#3a6fc4' }),
    drafting: freeze({ ink: '#e7f0f9', centre: '#9fbbe3', halo: '#18336b', stamp: '#d8322a' }),
  }),
});

export function resolveStyle(style = 'atlas') {
  const resolved = typeof style === 'string' ? STYLES[style] : style;
  if (!resolved || typeof resolved.id !== 'string' || !resolved.fill || !resolved.lines || !resolved.accents) throw new TypeError(`Unknown study style: ${typeof style === 'string' ? style : style?.id}`);
  // The colour layer tints from the base colour; it must be the solid fill.
  if (resolved.accents.base.toLowerCase() !== resolved.fill.color.toLowerCase()) throw new Error(`${resolved.id}: accent base must equal the fill colour.`);
  return resolved;
}

/** Background and lights for a study scene, in the shell's original order. */
export function applyStyleScene(scene, style) {
  scene.background = new THREE.Color(style.background);
  if (!style.lights) return;
  const { hemisphere, key, fill } = style.lights;
  scene.add(new THREE.HemisphereLight(hemisphere.sky, hemisphere.ground, hemisphere.intensity));
  const keyLight = new THREE.DirectionalLight(key.color, key.intensity); keyLight.position.set(...key.position); scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(fill.color, fill.intensity); fillLight.position.set(...fill.position); scene.add(fillLight);
}

/** A fresh solid material per mesh, so one occurrence can be tinted alone. */
export function createStyleFill(style) {
  const { fill } = style;
  if (fill.material === 'basic') return new THREE.MeshBasicMaterial({ color: fill.color, side: THREE.FrontSide });
  if (fill.material === 'standard') return new THREE.MeshStandardMaterial({ color: fill.color, metalness: fill.metalness, roughness: fill.roughness, side: THREE.FrontSide });
  throw new TypeError(`${style.id}: unknown fill material ${fill.material}`);
}
