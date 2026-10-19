import { createStudyFrameRenderer } from '/shared/study/direct-frame.mjs';

const engine = document.getElementById('engine'), status = document.getElementById('status');
const progress = document.getElementById('progress');
let study, compositor;
async function prepare() {
  const deadline = performance.now() + 30000;
  while (!engine.contentWindow?.gearboxShowcase) {
    if (performance.now() > deadline) throw new Error('The local rendering engine did not initialize.');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  study = engine.contentWindow.gearboxShowcase;
  if (!await study.ready) throw new Error('The assembly could not be loaded.');
  compositor = await createStudyFrameRenderer(study, { width: 1080, height: 1080 });
  status.textContent = 'Ready for direct frame synthesis. No screen recording.';
  return true;
}
const ready = prepare().catch(error => { status.textContent = error.message; throw error; });
window.gearboxFilm = {
  ready,
  async start() { await ready; compositor.restart(); progress.value = 0; status.textContent = 'Composing frames…'; },
  async frame(seconds) {
    await ready;
    const canvas = await compositor.render(seconds);
    progress.value = Math.min(1200, Math.floor(seconds * 30) + 1);
    if (Math.floor(seconds * 30) % 60 === 0) status.textContent = `Composing frame ${progress.value} / 1200`;
    return canvas.toDataURL('image/jpeg', .94);
  },
  stop() { study.capture.stop(); status.textContent = 'Frame synthesis complete. Encode the verified images with the original score.'; },
  snapshot() { return compositor.snapshot(); },
};
