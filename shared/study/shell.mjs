/** Build the shared study DOM once. Content from an example is assigned as text,
 * never interpolated into markup. Existing static pages may use the same IDs. */
export function createStudyShell({ title = 'An assembly, revealed.', creditLabel = '', sourceUrl = '' } = {}) {
  if (document.querySelector('main') || document.getElementById('viewport')) throw new Error('The assembly study shell already exists.');
  const main = document.createElement('main');
  main.innerHTML = `
    <header class="masthead">
      <a class="brand" href="http://127.0.0.1:4179/">Mechanism Studio</a>
      <span class="edition">Studies in mechanical motion</span>
      <span class="figure-index">Assembly study</span>
    </header>
    <section class="intro" aria-labelledby="robot-title">
      <div><p class="eyebrow">An assembly, revealed.</p><h1 id="robot-title"></h1></div>
      <p class="intro-note">Expand. Observe. Reassemble.<br>A continuous mechanical study.</p>
    </section>
    <figure id="stage" aria-label="Looping assembly illustration">
      <div id="viewport" aria-label="Three-dimensional mechanical assembly">
        <svg id="annotations" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
          <g class="annotation" id="annotation-a"><path id="leader-a" d=""/><text id="label-a" x="0" y="0"></text></g>
          <g class="annotation" id="annotation-b"><path id="leader-b" d=""/><text id="label-b" x="0" y="0"></text></g>
        </svg>
        <a class="asset-credit" target="_blank" rel="noopener noreferrer"></a>
      </div>
      <figcaption class="chapter">
        <span id="chapter-number" class="chapter-index">01</span>
        <h2 id="chapter-title">The complete assembly.</h2>
        <p id="chapter-copy">A closer look at how the parts come together.</p>
      </figcaption>
    </figure>
    <section class="transport" aria-label="Presentation controls">
      <div class="transport-actions">
        <button id="play" class="primary" type="button">Play with music</button>
        <button id="pause" type="button">Pause</button>
        <button id="restart" type="button" aria-label="Restart the presentation">Restart</button>
      </div>
      <div class="timeline">
        <span id="elapsed">0:00</span>
        <input id="seek" type="range" aria-label="Presentation position in seconds" min="0" max="36" step="0.01" value="0">
        <span id="duration">0:36</span>
      </div>
      <button id="color-cues" type="button" aria-pressed="true" title="Named parts receive a pale blue accent; switch off for neutral line art">Color cues</button>
      <button id="sound" type="button" aria-pressed="false" aria-label="Toggle music">Sound off</button>
      <span class="loop-note" aria-label="The presentation loops">Loop</span>
    </section>
    <p id="status" class="status" role="status" aria-live="polite">Preparing the mechanical assembly…</p>
    <footer>
      <p class="source-note">Source: <span id="source-name">Open-source mechanical assembly</span> · <a id="source-link" target="_blank" rel="noopener noreferrer">Source &amp; license ↗</a></p>
      <p>Live geometry · Original synthesized score · No narration</p>
    </footer>`;
  main.querySelector('#robot-title').textContent = title;
  main.querySelector('.asset-credit').textContent = creditLabel;
  if (sourceUrl) {
    const url = new URL(sourceUrl, location.href);
    if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('A source link must use HTTP or HTTPS.');
    main.querySelector('.asset-credit').href = url.href;
    main.querySelector('#source-link').href = url.href;
  }
  document.body.prepend(main);
  return main;
}
