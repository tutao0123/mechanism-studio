/** Move a cached short layout with its planned camera projection. Font and
 * clearance stay in CSS pixels; the chosen side never flips mid-shot. */
export function moveAnnotation(layout, anchor) {
  const dx = anchor.x - layout.anchor.x, dy = anchor.y - layout.anchor.y;
  return { ...layout, anchor, rect: { ...layout.rect, x: layout.rect.x + dx, y: layout.rect.y + dy },
    end: { x: layout.end.x + dx, y: layout.end.y + dy }, text: { ...layout.text, x: layout.text.x + dx, y: layout.text.y + dy } };
}

const overlaps = (a, b, gap = 4) => a.x < b.x + b.width + gap && a.x + a.width > b.x - gap && a.y < b.y + b.height + gap && a.y + a.height > b.y - gap;
/** Place a name beside the actual projected silhouette, never at screen margins.
 * Points come from the target's real mesh vertices. Rectangles of other visible
 * links are conservative exclusion areas. Hide if no short, clear placement fits.
 * Pure inputs make pause, backward seek and viewport changes reproducible. */
export function placeAnnotation({ points, width, height, textWidth, textHeight, obstacles = [], preferredSide = 'right' }) {
  if (!points?.length || ![width, height, textWidth, textHeight].every(value => Number.isFinite(value) && value > 0)) return null;
  const safe = points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.z >= -1 && p.z <= 1);
  if (!safe.length) return null;
  const bounds = safe.reduce((b, p) => ({ minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x), minY: Math.min(b.minY, p.y), maxY: Math.max(b.maxY, p.y) }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const { minX, maxX, minY, maxY } = bounds;
  // Do not pin an offscreen source to an unrelated screen edge.
  if (maxX < 0 || minX > width || maxY < 0 || minY > height) return null;
  const gap = width < 540 ? 15 : 20, padding = 9;
  const sides = [preferredSide, ...['right', 'left', 'top', 'bottom'].filter(side => side !== preferredSide)];
  for (const side of sides) for (const fraction of [.5, .25, .75]) {
    const horizontal = side === 'left' || side === 'right';
    const edge = { x: side === 'left' ? minX : side === 'right' ? maxX : minX + (maxX - minX) * fraction,
      y: side === 'top' ? minY : side === 'bottom' ? maxY : minY + (maxY - minY) * fraction };
    // Nearest real vertex on this projected boundary, not the link's centre.
    const anchor = safe.reduce((best, p) => Math.hypot(p.x - edge.x, p.y - edge.y) < Math.hypot(best.x - edge.x, best.y - edge.y) ? p : best);
    if (anchor.x < padding || anchor.x > width - padding || anchor.y < padding || anchor.y > height - padding) continue;
    const rect = { x: horizontal ? (side === 'left' ? anchor.x - gap - textWidth : anchor.x + gap) : anchor.x - textWidth / 2,
      y: horizontal ? anchor.y - textHeight / 2 : (side === 'top' ? anchor.y - gap - textHeight : anchor.y + gap), width: textWidth, height: textHeight };
    if (rect.x < padding || rect.y < padding || rect.x + rect.width > width - padding || rect.y + rect.height > height - padding || overlaps(rect, { x: minX, y: minY, width: maxX - minX, height: maxY - minY }, 0) || obstacles.some(obstacle => overlaps(rect, obstacle))) continue;
    const end = { x: horizontal ? (side === 'left' ? rect.x + textWidth + 5 : rect.x - 5) : anchor.x,
      y: horizontal ? anchor.y : (side === 'top' ? rect.y + textHeight + 5 : rect.y - 5) };
    return { side, rect, anchor: { x: anchor.x, y: anchor.y }, end,
      text: { x: side === 'left' ? rect.x + textWidth : horizontal ? rect.x : anchor.x, y: rect.y + textHeight / 2, anchor: side === 'left' ? 'end' : horizontal ? 'start' : 'middle' },
      leaderLength: Math.hypot(end.x - anchor.x, end.y - anchor.y) };
  }
  return null;
}
