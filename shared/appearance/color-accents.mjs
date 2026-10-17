/** Deterministic presentation accents. Colours identify the current explanation;
 * they never imply a material, load, temperature, or other solved CAD property. */
export const COLOR_ACCENT_REVISION = 'color-accents-1';
export const DEFAULT_BASE_COLOR = '#f1f1ed';
export const DEFAULT_ACCENT_COLOR = '#b7d5df';

const clamp = value => Math.max(0, Math.min(1, value));
function rgb(hex) {
  if (typeof hex !== 'string' || !/^#[\da-f]{6}$/i.test(hex)) throw new TypeError('Presentation colours must be six-digit hex values.');
  return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
}
const hex = channels => '#' + channels.map(value => Math.round(value).toString(16).padStart(2, '0')).join('');

/** Return a complete fresh assignment for every stable part ID, including the
 * neutral baseline. Duplicate cues combine by maximum weight, never addition.
 * Unknown IDs and non-finite weights are ignored; hidden parts stay hidden in
 * the renderer. No previous frame, timer, random value, or mutable cache is used.
 * Weights may come from annotation opacity or another authored process timeline. */
export function sampleColorAccents(partIds, cues = [], { enabled = true, baseColor = DEFAULT_BASE_COLOR, accentColor = DEFAULT_ACCENT_COLOR } = {}) {
  const base = rgb(baseColor), accent = rgb(accentColor), ids = [...partIds];
  if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) throw new TypeError('Presentation part IDs must be unique non-empty strings.');
  const weights = new Map(ids.map(id => [id, 0]));
  if (enabled) for (const cue of cues) {
    if (!cue || !weights.has(cue.id) || !Number.isFinite(cue.weight)) continue;
    weights.set(cue.id, Math.max(weights.get(cue.id), clamp(cue.weight)));
  }
  return new Map(ids.map(id => {
    const weight = weights.get(id), color = hex(base.map((value, i) => value + (accent[i] - value) * weight));
    return [id, { weight, color }];
  }));
}
