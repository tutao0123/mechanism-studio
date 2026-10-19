/** Direct study-frame composition, independent of browser-window screenshots.
 * The study owns time, mechanics and layout. This narrowly scoped compositor
 * combines its WebGL drawing buffer, styled SVG layers and measured text into
 * one fixed-resolution 2D canvas. It is not a general DOM-to-image library. */
export const DIRECT_FRAME_REVISION = 'study-direct-frame-1';
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'g', 'path', 'text', 'tspan', 'rect', 'line', 'polyline', 'polygon', 'circle', 'ellipse']);
const SVG_STYLES = ['color', 'display', 'visibility', 'opacity', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'paint-order', 'vector-effect', 'font-family', 'font-size', 'font-style', 'font-weight', 'font-stretch', 'font-variant', 'font-variant-numeric', 'font-kerning', 'font-feature-settings', 'letter-spacing', 'word-spacing', 'text-anchor', 'dominant-baseline', 'alignment-baseline', 'white-space', 'text-transform', 'text-rendering', 'shape-rendering'];
const TEXT_SELECTORS = ['.eyebrow', '#robot-title', '.asset-credit', '#chapter-number', '#chapter-title', '#chapter-copy'];
const FONT_KEYS = ['fontStyle', 'fontWeight', 'fontSize', 'fontFamily', 'fontStretch', 'fontKerning', 'fontVariantCaps', 'letterSpacing', 'wordSpacing', 'textTransform', 'whiteSpace', 'color'];

export function validateFrameViewport({ width, height, viewportWidth, viewportHeight, scrollX = 0, scrollY = 0 }) {
  ensure([width, height].every(value => Number.isSafeInteger(value) && value > 0) && width * height <= 4096 * 4096, 'Direct-frame dimensions must be positive integers up to 16,777,216 pixels.');
  ensure(viewportWidth === width && viewportHeight === height, `Direct-frame CSS viewport must stay ${width}×${height}; received ${viewportWidth}×${viewportHeight}.`);
  ensure(scrollX === 0 && scrollY === 0, 'The direct-frame study document must not be scrolled.');
  return { width, height };
}

/** DOM Range gives the browser's actual wrapping and glyph positions. Keep
 * lines in document order; never wrap again with approximate canvas widths. */
export function groupTextFragments(fragments, tolerance = .75) {
  const lines = [];
  for (const fragment of fragments) {
    const { text, left, top, width, height } = fragment;
    ensure(typeof text === 'string' && [left, top, width, height].every(Number.isFinite), 'Text fragments need finite geometry and text.');
    if (!text || width <= 0 || height <= 0 || /^[\r\n]+$/.test(text)) continue;
    let line = lines.at(-1);
    if (!line || Math.abs(line.top - top) > tolerance) {
      line = { text: '', left, top, width: 0, height }; lines.push(line);
    }
    line.text += text;
    const right = Math.max(line.left + line.width, left + width);
    line.left = Math.min(line.left, left); line.width = right - line.left;
    line.height = Math.max(line.height, height);
  }
  return lines.map(line => ({ ...line, text: line.text.trimEnd() })).filter(line => line.text.length);
}

export function baselineFromMetrics(top, metrics) {
  ensure(Number.isFinite(top) && Number.isFinite(metrics.fontBoundingBoxAscent) && metrics.fontBoundingBoxAscent >= 0, 'This browser must provide Canvas fontBoundingBoxAscent for exact text baselines.');
  return top + metrics.fontBoundingBoxAscent;
}

export function transformText(text, transform) {
  if (transform === 'none' || !transform) return text;
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  throw new Error(`Unsupported study text-transform: ${transform}`);
}

const boxOf = element => {
  const box = element.getBoundingClientRect();
  return { x: box.left, y: box.top, width: box.width, height: box.height };
};

function effectiveAlpha(element, win, { excludeSelf = false } = {}) {
  let alpha = 1;
  for (let node = excludeSelf ? element.parentElement : element; node; node = node.parentElement) {
    const style = win.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return 0;
    ensure(style.transform === 'none' && style.filter === 'none', 'Transformed or filtered study HTML ancestors are not supported by direct composition.');
    alpha *= Number(style.opacity);
  }
  return alpha;
}

function configureText(context, style) {
  ensure(style.direction === 'ltr' && style.writingMode === 'horizontal-tb', 'Direct study text currently supports horizontal left-to-right writing.');
  ensure(style.textShadow === 'none' && style.textIndent === '0px', 'Text shadows and indentation require a separate direct-frame adapter.');
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.textAlign = 'left'; context.textBaseline = 'alphabetic'; context.direction = 'ltr';
  context.fillStyle = style.color;
  for (const [key, value] of [['letterSpacing', style.letterSpacing], ['wordSpacing', style.wordSpacing]]) {
    const spacing = value === 'normal' ? '0px' : value;
    ensure(key in context || parseFloat(spacing) === 0, `This browser lacks Canvas ${key} support required by the study font.`);
    if (key in context) context[key] = spacing;
  }
  for (const key of ['fontKerning', 'fontStretch', 'fontVariantCaps']) if (key in context && style[key]) context[key] = style[key];
}

function textLines(element, style, doc) {
  ensure([...element.querySelectorAll('*')].every(child => child.tagName === 'BR'), `Unsupported nested markup in ${element.id || element.className}; direct study text accepts plain text and BR only.`);
  for (const pseudo of ['::before', '::after']) {
    const content = doc.defaultView.getComputedStyle(element, pseudo).content;
    ensure(['none', 'normal', '""'].includes(content), `Generated ${pseudo} text needs an explicit direct-frame adapter.`);
  }
  const walker = doc.createTreeWalker(element, doc.defaultView.NodeFilter.SHOW_TEXT), range = doc.createRange(), fragments = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let offset = 0;
    for (const character of node.textContent) {
      range.setStart(node, offset); offset += character.length; range.setEnd(node, offset);
      const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
      if (/^[\r\n]$/.test(character)) continue;
      ensure(rects.length <= 1, 'A text character spans multiple rectangles; unsupported study text layout.');
      if (rects.length) {
        const rect = rects[0];
        fragments.push({ text: transformText(character, style.textTransform), left: rect.left, top: rect.top, width: rect.width, height: rect.height });
      }
    }
  }
  range.detach();
  return groupTextFragments(fragments);
}

function serializeStyledSvg(svg, win) {
  const clone = svg.cloneNode(true), sourceNodes = [svg, ...svg.querySelectorAll('*')], targetNodes = [clone, ...clone.querySelectorAll('*')];
  for (let i = 0; i < sourceNodes.length; i++) {
    const source = sourceNodes[i], target = targetNodes[i];
    ensure(SVG_TAGS.has(source.localName), `Unsupported SVG element <${source.localName}>; no foreignObject, script, image or external resources are allowed.`);
    for (const attribute of [...source.attributes]) {
      ensure(!/^on/i.test(attribute.name) && !/(^|:)href$/i.test(attribute.name) && !/url\s*\(/i.test(attribute.value), 'External or active SVG content is not supported by direct composition.');
    }
    target.removeAttribute('class'); target.removeAttribute('id'); target.removeAttribute('style');
    const style = win.getComputedStyle(source);
    for (const property of SVG_STYLES) {
      const value = style.getPropertyValue(property);
      ensure(!/url\s*\(/i.test(value), 'External SVG styles are not supported by direct composition.');
      if (value) target.style.setProperty(property, value);
    }
    // Geometry is retained from SVG attributes; no copied page layout/position
    // can turn the raster image into a differently scaled browser screenshot.
  }
  const box = boxOf(svg);
  clone.setAttribute('xmlns', SVG_NS); clone.setAttribute('width', String(box.width)); clone.setAttribute('height', String(box.height));
  if (!clone.hasAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  return { serialized: new win.XMLSerializer().serializeToString(clone), box };
}

async function svgImage(serialized, win) {
  const url = win.URL.createObjectURL(new win.Blob([serialized], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new win.Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('A styled study SVG layer could not be rasterized.')); image.src = url; });
    return image;
  } finally { win.URL.revokeObjectURL(url); }
}

/** Call after api.ready. The canvas belongs to the WebGL canvas's document,
 * including when that document is in a fixed-size offscreen iframe. Each
 * render(t) samples the original deterministic timeline, then returns canvas.
 * No screenshot, page surface, desktop capture or foreignObject is involved. */
export function createStudyFrameRenderer(api, { width, height } = {}) {
  ensure(api?.viewer?.renderer?.domElement && typeof api.capture?.frame === 'function' && typeof api.capture?.start === 'function', 'Await a ready study API opened with capture=1 before creating a direct-frame renderer.');
  const viewer = api.viewer, webgl = viewer.renderer.domElement, doc = webgl.ownerDocument, win = doc.defaultView;
  const canvas = doc.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false }); ensure(context, 'A 2D canvas context is required.');
  const required = selector => { const nodes = doc.querySelectorAll(selector); ensure(nodes.length === 1, `Direct composition requires exactly one ${selector}.`); return nodes[0]; };
  const main = required('main'), viewport = required('#viewport'), chapter = required('.chapter'), annotation = required('#annotations');
  const textElements = TEXT_SELECTORS.map(required), credit = required('.asset-credit');
  ensure(doc.body.classList.contains('capture'), 'Direct composition requires the study capture layout.');
  ensure(!doc.body.classList.contains('style-blueprint'), 'This direct-frame adapter currently supports the atlas study shell; blueprint title-block styling needs its own adapter.');
  ensure(webgl.parentElement === viewport, 'The study WebGL canvas must be a direct child of #viewport.');
  const shellChildren = ['.masthead', '.intro', '#stage', '.transport', '#status', 'footer'].map(required);
  ensure(main.children.length === shellChildren.length && [...main.children].every(child => shellChildren.includes(child)), 'Unknown main-shell children require a separate direct-frame adapter.');
  ensure([...required('#stage').children].every(child => child === viewport || child === chapter) && required('#stage').children.length === 2, 'The direct-frame stage requires exactly viewport and chapter.');
  ensure(chapter.children.length === 3 && [...chapter.children].every(child => ['chapter-number', 'chapter-title', 'chapter-copy'].includes(child.id)), 'Unknown chapter content requires a direct-frame adapter.');
  for (const selector of ['.masthead', '.intro-note', '.transport', '#status', 'footer']) {
    ensure(win.getComputedStyle(required(selector)).display === 'none', `Unsupported visible ${selector}; use the clean capture study shell.`);
  }
  const checkViewport = () => {
    validateFrameViewport({ width, height, viewportWidth: win.innerWidth, viewportHeight: win.innerHeight, scrollX: win.scrollX, scrollY: win.scrollY });
    const box = boxOf(main);
    ensure(Math.abs(box.x) < .01 && Math.abs(box.y) < .01 && Math.abs(box.width - width) < .01 && Math.abs(box.height - height) < .01, 'The study main layout must fill the fixed CSS viewport exactly.');
    return box;
  };
  checkViewport();
  const svgCache = new Map(), textCache = new Map();
  let disposed = false, busy = false, started = false, lastTime = -1, renderedFrames = 0, lineCount = 0;

  function paintText(element) {
    const style = win.getComputedStyle(element), alpha = effectiveAlpha(element, win);
    if (!alpha) return;
    const box = boxOf(element), key = JSON.stringify([element.textContent, box, FONT_KEYS.map(name => style[name])]);
    let entry = textCache.get(element);
    if (!entry || entry.key !== key) { entry = { key, lines: textLines(element, style, doc) }; textCache.set(element, entry); }
    context.save(); context.globalAlpha = alpha; configureText(context, style);
    for (const line of entry.lines) {
      const metrics = context.measureText(line.text);
      context.fillText(line.text, line.left, baselineFromMetrics(line.top, metrics));
      lineCount++;
    }
    context.restore();
  }

  return {
    canvas,
    async render(seconds) {
      ensure(!disposed && !busy, disposed ? 'The direct-frame renderer is disposed.' : 'Direct frames must be rendered sequentially.');
      ensure(Number.isFinite(seconds) && seconds >= 0 && seconds >= lastTime, 'Direct-frame times must be finite, nonnegative and monotonic; restart before a new loop.');
      busy = true;
      try {
        await doc.fonts.ready; checkViewport();
        // Also clear any saved drawing state left by a failed asynchronous SVG
        // decode before a caller repairs the source and retries the same time.
        if (typeof context.reset === 'function') context.reset();
        else { canvas.width = width; canvas.height = height; }
        if (!started) { api.capture.start(); started = true; }
        api.capture.frame(seconds);
        // Chapter text can change the flex viewport height at a boundary.
        // Resolve that layout and sample the SAME time again, never a seek/cut.
        let viewportBox = boxOf(viewport);
        const pixelRatio = viewer.renderer.getPixelRatio();
        if (webgl.width !== Math.floor(viewport.clientWidth * pixelRatio) || webgl.height !== Math.floor(viewport.clientHeight * pixelRatio)) viewer.renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
        api.capture.frame(seconds); viewportBox = boxOf(viewport); checkViewport();
        ensure(viewportBox.width > 0 && viewportBox.height > 0 && viewportBox.x >= 0 && viewportBox.y >= 0 && viewportBox.x + viewportBox.width <= width + .01 && viewportBox.y + viewportBox.height <= height + .01, 'The study viewport is outside the direct frame.');
        ensure(!viewer.renderer.getContext().isContextLost(), 'The WebGL context is lost.');
        viewer.scene.updateMatrixWorld(true); viewer.camera.updateMatrixWorld(true); viewer.lineArt?.update(viewer.camera);
        viewer.renderer.render(viewer.scene, viewer.camera); // Deliberately bypass document.hidden / IntersectionObserver.
        context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.globalAlpha = 1;
        context.fillStyle = win.getComputedStyle(doc.body).backgroundColor; context.fillRect(0, 0, width, height);
        context.save(); context.beginPath(); context.rect(viewportBox.x, viewportBox.y, viewportBox.width, viewportBox.height); context.clip();
        context.fillStyle = win.getComputedStyle(viewport).backgroundColor; context.fillRect(viewportBox.x, viewportBox.y, viewportBox.width, viewportBox.height);
        // Copy immediately, before awaiting SVG decoding. Pixel ratio affects
        // source sampling only; its destination always uses fixed CSS geometry.
        context.drawImage(webgl, viewportBox.x, viewportBox.y, viewportBox.width, viewportBox.height);
        const layers = [];
        for (const child of viewport.children) {
          if (child === webgl || child === credit) continue;
          ensure(child === annotation || (child.namespaceURI === SVG_NS && child.classList.contains('drafting-overlay')), `Unsupported visible study layer: ${child.tagName}.${child.className?.baseVal ?? child.className}`);
          layers.push(child);
        }
        layers.sort((a, b) => Number(win.getComputedStyle(a).zIndex || 0) - Number(win.getComputedStyle(b).zIndex || 0));
        for (const layer of layers) {
          const alpha = effectiveAlpha(layer, win, { excludeSelf: true }); if (!alpha) continue;
          const { serialized, box } = serializeStyledSvg(layer, win);
          let image = svgCache.get(serialized);
          if (!image) {
            image = await svgImage(serialized, win); svgCache.set(serialized, image);
            while (svgCache.size > 8) svgCache.delete(svgCache.keys().next().value);
          }
          context.globalAlpha = alpha; context.drawImage(image, box.x, box.y, box.width, box.height);
        }
        context.restore();
        lineCount = 0;
        for (const element of textElements) paintText(element);
        const chapterBox = boxOf(chapter), chapterStyle = win.getComputedStyle(chapter), border = parseFloat(chapterStyle.borderTopWidth);
        ensure(!border || chapterStyle.borderTopStyle === 'solid', 'Only the study solid chapter rule is supported.');
        if (border) { context.fillStyle = chapterStyle.borderTopColor; context.fillRect(chapterBox.x, chapterBox.y, chapterBox.width, border); }
        context.restore(); checkViewport();
        lastTime = seconds; renderedFrames++; return canvas;
      } finally { busy = false; }
    },
    restart() { ensure(!disposed && !busy, 'Cannot restart a disposed or busy direct renderer.'); started = false; lastTime = -1; },
    snapshot() { return { revision: DIRECT_FRAME_REVISION, width, height, lastTime, renderedFrames, textLines: lineCount, svgCacheSize: svgCache.size, webglBuffer: { width: webgl.width, height: webgl.height }, cssViewport: { width: win.innerWidth, height: win.innerHeight }, source: 'direct-webgl-svg-text-composition' }; },
    dispose() { ensure(!busy, 'Wait for the current direct frame before disposal.'); disposed = true; svgCache.clear(); textCache.clear(); },
  };
}
