import { createAssemblyStudy } from '/shared/study/study.mjs';
import { createStudyShell } from '/shared/study/shell.mjs';
import { createHumanoidStory } from './story.mjs';
import { createHumanoidFraming } from './framing.mjs';
import * as annotations from './annotations.mjs';
const title = 'A humanoid, revealed.';
createStudyShell({ title });
document.querySelector('.eyebrow').textContent = 'A study in connected structure.';
document.querySelector('.figure-index').textContent = 'Unitree G1 / Humanoid study';
document.querySelector('.intro-note').textContent = 'Thirty source bodies. Expand. Understand. Reconnect.';
document.querySelector('footer > p:last-child').textContent = 'Source-based geometry · Original score + Kenney CC0 cues · No narration';
try {
  const response = await fetch('/assets/scene-index.json');
  if (!response.ok) throw new Error(`Source index: HTTP ${response.status}`);
  const index = await response.json(), timeline = createHumanoidStory(index);
  window.humanoidShowcase = createAssemblyStudy({
    timeline, annotations, createFraming: loaded => createHumanoidFraming(loaded, timeline), detailIds: timeline.detailIds,
    cameraCuts: timeline.CAMERA_CUTS, cameraTransitionSeconds: .65,
    appearanceCues(state, labels) {
      const cues = labels.map(label => ({ id: label.id, weight: label.opacity }));
      const returning = state.chapter.id === 'return';
      if (returning || state.chapter.id === 'separate') for (const group of timeline.GROUPS) {
        const progress = (state.beat - (returning ? group.inBeat : group.outBeat)) / timeline.MOVEMENT_BEATS;
        const weight = progress > 0 && progress < 1 ? Math.sin(Math.PI * progress) * .58 : 0;
        for (const id of group.ids) cues.push({ id, weight });
      }
      return cues;
    },
    indexUrl: '/assets/scene-index.json', sourceUrl: '/source/provenance.json',
    assetUrl: '/assets/humanoid.glb', contractUrl: '/assets/scene-contract.json',
    scoreUrl: '/audio/music-score.json', audioUrl: '/audio/humanoid-loop.wav',
    title, documentTitle: 'G1 humanoid, revealed · Mechanism Studio',
    sourceName: 'Unitree G1 via MuJoCo Menagerie · BSD-3-Clause',
    creditLabel: 'G1 model © Unitree Robotics · BSD-3-Clause\nSource: MuJoCo Menagerie · Adapted display\nMechanism Studio · Score + Kenney CC0 cues',
    initialStatus: '35.56 s · Source-body exploded presentation. No simulated gait or collision-checked teardown.',
    playingStatus: 'One music clock · Gentle original score and sparse CC0 editorial cues.',
  });
} catch (error) {
  document.getElementById('status').textContent = `Could not prepare the humanoid study: ${error.message}`;
  console.error(error);
}
