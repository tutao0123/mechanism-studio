import { createStudyFrameRenderer } from '/shared/study/direct-frame.mjs';
import { DURATION, PLAN_REVISION } from './choreography.mjs';

const WIDTH = 1920, HEIGHT = 1080, FPS = 30, FRAME_COUNT = DURATION * FPS;
const engine = document.getElementById('engine'), status = document.getElementById('status');
const progress = document.getElementById('progress');
let study, compositor;

async function prepare() {
  const deadline = performance.now() + 30000;
  while (!engine.contentWindow?.jointShowcase) {
    if (performance.now() > deadline) throw new Error('The local robot-joint rendering engine did not initialize.');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  study = engine.contentWindow.jointShowcase;
  if (!await study.ready) throw new Error('The robot-joint assembly could not be loaded.');
  compositor = createStudyFrameRenderer(study, { width: WIDTH, height: HEIGHT });
  progress.max = FRAME_COUNT;
  status.textContent = 'Ready for direct frame synthesis.';
  return true;
}

const ready = prepare().catch(error => { status.textContent = error.message; throw error; });
window.jointFilm = {
  ready,
  async start() {
    await ready;
    compositor.restart(); progress.value = 0; status.textContent = 'Composing frames…';
  },
  async frame(seconds) {
    await ready;
    if (!Number.isFinite(seconds) || seconds < 0 || seconds >= DURATION) throw new Error(`Frame time must be within [0, ${DURATION}).`);
    const canvas = await compositor.render(seconds);
    progress.value = Math.min(FRAME_COUNT, Math.floor(seconds * FPS + 1e-7) + 1);
    if ((progress.value - 1) % 60 === 0) status.textContent = `Composing frame ${progress.value} / ${FRAME_COUNT}`;
    return canvas.toDataURL('image/jpeg', .94);
  },
  stop() {
    study.capture.stop();
    status.textContent = 'Frame synthesis complete. Encode the verified images with the original score.';
  },
  snapshot() {
    return { ...compositor.snapshot(), fps: FPS, duration: DURATION, frameCount: FRAME_COUNT, planRevision: PLAN_REVISION, study: study.snapshot() };
  },
};
