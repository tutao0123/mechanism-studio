/** Drafting marks for the gearbox study: dimensions measured from the model's
 * own data, centre lines on the real shaft axes, and (in the blueprint style)
 * one stamp. A presentation layer: it owns only its lines and overlay, samples
 * the shared story clock, and never moves parts, the camera or the audio. */
import * as THREE from 'three';
import { centreLinePositions, dimensionPositions, formatMillimetres, createDraftingOverlay } from '../../shared/viewer/drafting.mjs';
import { AXES, CENTRE_DISTANCE, LAYOUT } from './spec.mjs';

const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
/** Visibility windows in beats. Dimensions of the assembled state are shown
 * only while every part sits at rest; the stamp marks 4th engaging directly. */
export const DRAFTING_WINDOWS = Object.freeze({
  centreDistance: Object.freeze([23.6, 31.6]),
  overallLength: Object.freeze([58.4, 63.5]),
  stamp: Object.freeze([39.9, 43.4]),
});
const FADE_IN = .3, FADE_OUT = .45;
export function windowOpacity(beat, [start, end]) {
  return Math.min(smooth((beat - start) / FADE_IN), 1 - smooth((beat - (end - FADE_OUT)) / FADE_OUT));
}

/** Pure description of every mark, for tests and plans. */
export function draftingMarks(index) {
  const bounds = index.asset.assembledWorldBounds, front = LAYOUT.input.x0 - .04;
  const [cy, cz] = AXES.counter;
  return {
    centreDistance: { a: [front, 0, 0], b: [front, cy, cz], side: [-1, 0, 0], offset: .03, text: `${formatMillimetres(CENTRE_DISTANCE)}`, value: CENTRE_DISTANCE },
    overallLength: { a: [bounds.min[0], 0, 0], b: [bounds.max[0], 0, 0], side: [0, -1, 0], offset: -bounds.min[1] + .03, text: formatMillimetres(bounds.max[0] - bounds.min[0]), value: bounds.max[0] - bounds.min[0] },
    axes: { main: [0, 0], counter: [cy, cz], idler: [...AXES.idler] },
  };
}

export function createGearboxDrafting({ style }) {
  return ({ viewer, index, viewport }) => {
    const marks = draftingMarks(index), overlay = createDraftingOverlay(viewport), owned = [];
    const lineMaterial = color => { const material = new THREE.LineBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }); owned.push(material); return material; };
    const segments = (positions, material) => {
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const line = new THREE.LineSegments(geometry, material); line.renderOrder = 20; line.frustumCulled = false;
      viewer.scene.add(line); owned.push(geometry); return line;
    };
    const dimensions = ['centreDistance', 'overallLength'].map(key => {
      const mark = marks[key], built = dimensionPositions(mark.a, mark.b, mark.side, mark.offset);
      return { key, mark, anchor: new THREE.Vector3(...built.anchor), line: segments(built.positions, lineMaterial(style.drafting.ink)) };
    });
    // Centre lines are a blueprint convention; they follow each shaft group's
    // display offset so they stay on the axis during the explosion.
    const centre = style.id === 'blueprint' ? lineMaterial(style.drafting.centre) : null;
    const axisLines = centre ? [
      { id: 'main', yz: marks.axes.main, follow: ['gb:input/shaft', 'gb:main/output-flange'], span: [LAYOUT.inputStart - .02, LAYOUT.mainEnd + .02] },
      { id: 'counter', yz: marks.axes.counter, follow: ['gb:counter/shaft'], span: [LAYOUT.frontWall[0] - .02, LAYOUT.rearWall[1] + .02] },
      { id: 'idler', yz: marks.axes.idler, follow: ['gb:idler/shaft'], span: [LAYOUT.mainR.x0 - .03, LAYOUT.mainR.x1 + .03] },
    ].map(axis => ({ ...axis, line: segments(new Float32Array(6), centre) })) : [];
    const projected = new THREE.Vector3();
    const toScreen = (point, width, height) => { projected.copy(point).project(viewer.camera); return { x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2 }; };
    return {
      update({ state }) {
        const width = viewport.clientWidth, height = viewport.clientHeight, beat = state.beat;
        overlay.resize(width, height);
        for (const { key, mark, anchor, line } of dimensions) {
          const opacity = windowOpacity(beat, DRAFTING_WINDOWS[key]);
          line.visible = opacity > 0; line.material.opacity = .9 * opacity;
          const at = toScreen(anchor, width, height), vertical = Math.abs(mark.b[1] - mark.a[1]) > Math.abs(mark.b[0] - mark.a[0]);
          overlay.text(key, { text: mark.text, x: at.x + (vertical ? -6 : 0), y: at.y + (vertical ? 0 : 14), anchor: vertical ? 'end' : 'middle', opacity });
        }
        for (const axis of axisLines) {
          // The span follows the moving ends of the shaft group; y/z follow its offset.
          const offsets = axis.follow.map(id => state.offsetsWorld[id]);
          const [dy, dz] = [offsets[0][1], offsets[0][2]], x0 = axis.span[0] + Math.min(...offsets.map(o => o[0])), x1 = axis.span[1] + Math.max(...offsets.map(o => o[0]));
          const positions = centreLinePositions([x0, axis.yz[0] + dy, axis.yz[1] + dz], [x1, axis.yz[0] + dy, axis.yz[1] + dz], { long: .022, gap: .005, short: .005 });
          const geometry = axis.line.geometry;
          if (geometry.attributes.position.array.length !== positions.length) geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          else { geometry.attributes.position.array.set(positions); geometry.attributes.position.needsUpdate = true; }
          geometry.computeBoundingSphere(); axis.line.material.opacity = .75;
        }
        if (style.drafting.stamp) {
          const opacity = windowOpacity(beat, DRAFTING_WINDOWS.stamp);
          overlay.text('stamp', { text: 'DIRECT  1 : 1', x: width * .8, y: height * .2, rotate: -7, opacity, kind: 'stamp', frame: true });
        }
      },
      snapshot: () => overlay.snapshot(),
      dispose() { for (const item of owned) item.dispose(); overlay.dispose(); },
    };
  };
}
