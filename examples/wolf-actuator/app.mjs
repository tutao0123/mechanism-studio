import { createAssemblyStudy } from '/shared/study/study.mjs';
import { createStudyShell } from '/shared/study/shell.mjs';
import { createWolfStory } from './story.mjs';
import { createWolfAnnotations } from './annotations.mjs';
import { CAMERA_UP, createWolfFraming } from './framing.mjs';

createStudyShell({ title: 'WOLF, layer by layer.', creditLabel: 'WOLF by Anthrobotics · CC BY-SA 4.0\nAdapted presentation & original score: Mechanism Studio', sourceUrl: 'https://github.com/Anthrobotics/wolf-actuator' });
try {
  const response = await fetch('./assets/scene-index.json');
  if (!response.ok) throw new Error(`Actual CAD scene index: HTTP ${response.status}`);
  const index = await response.json(), timeline = createWolfStory(index);
  window.wolfShowcase = createAssemblyStudy({
    timeline, annotations: createWolfAnnotations(timeline),
    cameraUp: CAMERA_UP,
    createFraming: actual => { if (actual.geometryRevision !== index.geometryRevision) throw new Error('The source asset changed during initialization. Reload the study.'); return createWolfFraming(actual, timeline); },
    detailIds: timeline.detailIds,
    indexUrl: './assets/scene-index.json', sourceUrl: './source/provenance.json',
    assetUrl: './assets/assembly.glb', contractUrl: './assets/scene-contract.json',
    scoreUrl: './audio/music-score.json', audioUrl: './audio/wolf-loop.wav',
    title: 'WOLF, layer by layer.', documentTitle: 'WOLF actuator · Mechanism Studio',
    sourceName: 'Anthrobotics WOLF · CC BY-SA 4.0',
    creditLabel: 'WOLF by Anthrobotics · CC BY-SA 4.0\nAdapted presentation & original score: Mechanism Studio',
    initialStatus: `${timeline.DURATION.toFixed(2)} s · ${index.parts.length} actual source components · Editorial explosion; mates and gear motion are not inferred.`,
    playingStatus: 'Quiet assembly score · Motion and seating textures follow the four source-bound groups.',
  });
} catch (error) {
  document.getElementById('status').textContent = `Could not prepare the WOLF assembly: ${error.message}`;
  console.error(error);
}
