import * as THREE from 'three';
import { DEFAULT_BASE_COLOR } from './color-accents.mjs';

/** One shared white line-art treatment: pale fill, fine dark contours, soft
 * upper key. Values are a visual style, not a physical material or finish.
 * New examples use these instead of hand-tuning lights per page. */
export const LINE_ART_STYLE_REVISION = 'line-art-style-1';
export const LINE_ART_BACKGROUND = '#ffffff';
// Outline follows the presentation-style primary token; detail creases stay softer.
export const LINE_ART_LINE_STYLE = Object.freeze({ enabled: true, color: '#252525', detailColor: '#93938e' });
export const LINE_ART_FILL = Object.freeze({ color: DEFAULT_BASE_COLOR, metalness: 0, roughness: .88 });
export const LINE_ART_LIGHTS = Object.freeze({
  hemisphere: Object.freeze({ sky: '#ffffff', ground: '#d9d9d5', intensity: 2.4 }),
  key: Object.freeze({ color: '#ffffff', intensity: 2.2, position: Object.freeze([-.5, 1.5, 1.2]) }),
  fill: Object.freeze({ color: '#ffffff', intensity: .65, position: Object.freeze([.8, .35, -.7]) }),
});

/** A fresh fill material per call, so one occurrence can be tinted without
 * touching its repeats. Polygon offset pushes the solid slightly behind
 * coplanar feature lines, keeping creases continuous at close zoom. */
export function createLineArtFill(overrides = {}) {
  return new THREE.MeshStandardMaterial({
    ...LINE_ART_FILL, side: THREE.FrontSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...overrides,
  });
}

/** Add the shared light rig and background to a scene. Returns the owned
 * lights so a page can remove them; directional lights stay world-fixed so the
 * lighting intention survives chapter and camera changes. */
export function addLineArtLighting(scene, { background = true } = {}) {
  const { hemisphere, key, fill } = LINE_ART_LIGHTS;
  if (background) scene.background = new THREE.Color(LINE_ART_BACKGROUND);
  const lights = [new THREE.HemisphereLight(hemisphere.sky, hemisphere.ground, hemisphere.intensity)];
  for (const { color, intensity, position } of [key, fill]) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.fromArray(position); lights.push(light);
  }
  scene.add(...lights);
  return lights;
}
