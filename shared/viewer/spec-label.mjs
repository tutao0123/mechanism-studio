/** Near-part names, optionally in the spec-label grammar: a two-digit index,
 * the name, and one spec line whose numbers come from the model's own data
 * (an idea from the lemo-opuscar "Exploded Teardown" style, MIT).
 *
 * A label is either a plain string, rendered exactly as before, or
 * `{ index, name, spec }`. Writers here touch only the given SVG <text>. */
const SVG = 'http://www.w3.org/2000/svg';

export function specLabel({ index, name, spec }) {
  if (!Number.isInteger(index) || index < 1 || index > 99) throw new RangeError('A spec label index is 1–99.');
  if (typeof name !== 'string' || !name.trim()) throw new TypeError('A spec label needs a name.');
  if (spec !== undefined && (typeof spec !== 'string' || !spec.trim())) throw new TypeError('A spec line must be nonempty text.');
  return Object.freeze({ index: String(index).padStart(2, '0'), name, ...(spec && { spec }) });
}

/** Lines of [role, text] runs, or null for a plain-string label. */
export function labelLines(content) {
  if (typeof content === 'string') return null;
  const lines = [[['index', content.index], ['name', ` ${content.name}`]]];
  if (content.spec) lines.push([['spec', content.spec]]);
  return lines;
}
export const labelPlainText = content => typeof content === 'string' ? content : `${content.index} ${content.name}${content.spec ? ` — ${content.spec}` : ''}`;

/** Fill an SVG <text>. Plain strings keep the original single text node. */
export function writeLabel(text, content) {
  const lines = labelLines(content);
  if (!lines) { text.textContent = content; return; }
  text.textContent = '';
  for (const runs of lines) {
    const line = document.createElementNS(SVG, 'tspan'); line.setAttribute('class', `label-line label-line-${runs[0][0] === 'spec' ? 'spec' : 'name'}`);
    for (const [role, value] of runs) {
      const run = document.createElementNS(SVG, 'tspan'); run.setAttribute('class', `label-${role}`); run.textContent = value; line.append(run);
    }
    text.append(line);
  }
}

const lineBoxes = text => [...text.querySelectorAll(':scope > .label-line')].map(line => ({ line, height: parseFloat(getComputedStyle(line).fontSize) * 1.3, width: line.getComputedTextLength() }));

/** Size used for placement; plain strings measure exactly as before. */
export function measureLabel(text) {
  const boxes = lineBoxes(text);
  if (!boxes.length) return { width: text.getComputedTextLength(), height: parseFloat(getComputedStyle(text).fontSize) * 1.3 };
  return { width: Math.max(...boxes.map(box => box.width)), height: boxes.reduce((sum, box) => sum + box.height, 0) };
}

/** Position a label whose block is centred vertically on y. */
export function placeLabelText(text, x, y, anchor) {
  text.setAttribute('x', x); text.setAttribute('y', y); text.setAttribute('text-anchor', anchor);
  const boxes = lineBoxes(text);
  if (!boxes.length) return;
  let top = y - boxes.reduce((sum, box) => sum + box.height, 0) / 2;
  for (const { line, height } of boxes) { line.setAttribute('x', x); line.setAttribute('y', top + height / 2); top += height; }
}
