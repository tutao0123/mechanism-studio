import { createAssemblyStudy } from '/shared/study/study.mjs';
import { createStudyShell } from '/shared/study/shell.mjs';
import { createGearboxStory } from './story.mjs';
import { createGearboxFraming } from './framing.mjs';
import * as annotations from './annotations.mjs';
const title = 'A gearbox, revealed.';
createStudyShell({ title });
document.querySelector('.eyebrow').textContent = 'A study in switching power paths.';
document.querySelector('.figure-index').textContent = 'Five-speed gearbox / Teaching model';
document.querySelector('.intro-note').textContent = 'Open. Separate. Drive through every gear.';
document.querySelector('footer > p:last-child').textContent = 'Original teaching model · Ideal tooth ratios · Original score · No narration';
try {
  const response = await fetch('/assets/scene-index.json');
  if (!response.ok) throw new Error(`Scene index: HTTP ${response.status}`);
  const index = await response.json(), timeline = createGearboxStory(index);
  window.gearboxShowcase = createAssemblyStudy({
    timeline, annotations, createFraming: loaded => createGearboxFraming(loaded, timeline),
    workingPoses: timeline.workingPoses, appearanceCues: timeline.appearanceCues, presentationOpacity: timeline.presentationOpacity,
    labelObstacleIds: timeline.labelObstacleIds,
    cameraTransitionSeconds: .8,
    indexUrl: '/assets/scene-index.json', sourceUrl: '/assets/provenance.json',
    assetUrl: '/assets/gearbox.glb', contractUrl: '/assets/scene-contract.json',
    scoreUrl: '/audio/music-score.json', audioUrl: '/audio/gearbox-loop.wav',
    title, documentTitle: 'A gearbox, revealed · Mechanism Studio',
    sourceName: 'Original Mechanism Studio teaching model · MIT',
    creditLabel: 'Five-speed teaching gearbox · Mechanism Studio · MIT\nIdeal tooth ratios · Not a production design',
    initialStatus: '40 s · Original teaching model. Speeds are slowed for reading; no loads, friction or contact are simulated.',
    playingStatus: 'One music clock · Gear speeds follow exact tooth ratios.',
  });
} catch (error) {
  document.getElementById('status').textContent = `Could not prepare the gearbox study: ${error.message}`;
  console.error(error);
}
