/** Drafting marks drawn on the model itself: centre lines along real axes and
 * dimension lines between real points, with their numbers in an SVG overlay.
 * Geometry builders are pure (world metres in, Float32Array out); the example
 * decides when a mark is valid, because a dimension of the assembled state is
 * wrong once parts are displaced. Idea credit: the "numbers live on the
 * object" grammar of the lemo-opuscar library (MIT); this is an independent
 * implementation. */
const SVG = 'http://www.w3.org/2000/svg';
const sub = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, k) => a.map(v => v * k);
const length = a => Math.hypot(...a);
const normalize = a => { const l = length(a); if (!(l > 0)) throw new RangeError('Direction needs nonzero length.'); return scale(a, 1 / l); };

/** A centre line from `from` to `to` in the long–short drafting pattern, as
 * line-segment pairs. Pattern lengths are in metres along the line. */
export function centreLinePositions(from, to, { long = .02, gap = .004, short = .004 } = {}) {
  const total = length(sub(to, from)), dir = normalize(sub(to, from)), out = [];
  for (let s = 0; s < total;) {
    for (const piece of [long, short]) {
      const end = Math.min(total, s + piece);
      if (end > s) out.push(...add(from, scale(dir, s)), ...add(from, scale(dir, end)));
      s = end + gap; if (s >= total) break;
    }
  }
  return new Float32Array(out);
}

/**
 * Dimension between points a and b, drawn `offset` metres away along `side`
 * (perpendicular to a→b): two extension lines with a small overshoot, the
 * dimension line, and slanted ticks at both ends (architectural style, no
 * arrowheads). Returns segment positions and where the number belongs.
 */
export function dimensionPositions(a, b, side, offset, { overshoot = .006, gapFromPart = .004, tick = .006 } = {}) {
  const along = normalize(sub(b, a)), out = sideOf(along, side);
  const da = add(a, scale(out, offset)), db = add(b, scale(out, offset)), segments = [];
  for (const [base, end] of [[a, da], [b, db]]) segments.push(...add(base, scale(out, gapFromPart)), ...add(end, scale(out, overshoot)));
  segments.push(...da, ...db);
  // Ticks at 45° in the drawing plane spanned by the line and its side.
  const slant = normalize(add(along, out));
  for (const p of [da, db]) segments.push(...add(p, scale(slant, -tick / 2)), ...add(p, scale(slant, tick / 2)));
  return { positions: new Float32Array(segments), anchor: add(scale(add(da, db), .5), scale(out, overshoot * 1.6)), measured: length(sub(b, a)) };
}
/** The component of `side` perpendicular to `along`, normalized. */
function sideOf(along, side) {
  const s = sub(side, scale(along, side.reduce((sum, v, i) => sum + v * along[i], 0)));
  return normalize(s);
}

/** Millimetres for a drawing: whole numbers unless below 10 mm. */
export function formatMillimetres(metres) {
  if (!Number.isFinite(metres) || metres <= 0) throw new RangeError('A positive length is required.');
  const mm = metres * 1000;
  return `${mm < 10 ? mm.toFixed(1) : Math.round(mm)} mm`;
}

/** SVG overlay for dimension numbers and a single stamp, inside a viewport. */
export function createDraftingOverlay(viewport) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'drafting-overlay'); svg.setAttribute('aria-hidden', 'true');
  viewport.append(svg);
  const items = new Map();
  const item = (id, kind, frame) => {
    if (!items.has(id)) {
      const group = document.createElementNS(SVG, 'g'), text = document.createElementNS(SVG, 'text');
      group.setAttribute('class', `drafting-${kind}`);
      const rect = frame ? document.createElementNS(SVG, 'rect') : null;
      if (rect) group.append(rect);
      group.append(text); svg.append(group);
      items.set(id, { group, text, rect });
    }
    return items.get(id);
  };
  return {
    /** Show text at a projected screen point; opacity 0 hides it. */
    text(id, { text, x, y, opacity, kind = 'dimension', anchor = 'middle', rotate = 0, frame = false }) {
      const { group, text: node, rect } = item(id, kind, frame);
      if (node.textContent !== text) node.textContent = text;
      node.setAttribute('x', x); node.setAttribute('y', y); node.setAttribute('text-anchor', anchor);
      if (rect && opacity > 0) {
        // A stamp's ruled frame, sized from the rendered text.
        const box = node.getBBox(), pad = box.height * .32;
        rect.setAttribute('x', box.x - pad); rect.setAttribute('y', box.y - pad * .6); rect.setAttribute('width', box.width + 2 * pad); rect.setAttribute('height', box.height + 1.2 * pad);
      }
      group.setAttribute('transform', rotate ? `rotate(${rotate} ${x} ${y})` : '');
      group.style.opacity = String(opacity);
    },
    resize(width, height) { svg.setAttribute('viewBox', `0 0 ${width} ${height}`); },
    snapshot: () => [...items].map(([id, { text, group }]) => ({ id, text: text.textContent, opacity: Number(group.style.opacity || 0) })).filter(entry => entry.opacity > 0),
    dispose() { svg.remove(); items.clear(); },
  };
}
