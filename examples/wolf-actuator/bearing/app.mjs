import { createAssemblyStudy } from '/shared/study/study.mjs';
import { createStudyShell } from '/shared/study/shell.mjs';
import { createWolfBearingStory } from './story.mjs';
import { createWolfBearingAnnotations } from './annotations.mjs';
import { createWolfBearingFraming, CAMERA_UP } from './framing.mjs';

const title = 'Inside a WOLF bearing.';
const credit = 'WOLF by Anthrobotics · CC BY-SA 4.0\nBearing A study & original score: Mechanism Studio';
createStudyShell({ title, creditLabel: credit, sourceUrl: 'https://github.com/Anthrobotics/wolf-actuator' });
try {
  const response = await fetch('../assets/scene-index.json'); if (!response.ok) throw new Error(`Actual source index: HTTP ${response.status}`);
  const index = await response.json(), timeline = createWolfBearingStory(index);
  window.wolfBearingStudy = createAssemblyStudy({
    timeline, annotations: createWolfBearingAnnotations(timeline), cameraUp: CAMERA_UP, cameraContinuity: 'authored',
    presentationOpacity: timeline.opacityFor, labelObstacleIds: timeline.labelObstacleIds,
    createFraming: actual => { if (actual.geometryRevision !== index.geometryRevision) throw new Error('Source revision changed during initialization'); return createWolfBearingFraming(actual, timeline); },
    detailIds: timeline.detailIds, indexUrl: '../assets/scene-index.json', sourceUrl: '../source/provenance.json', assetUrl: '../assets/assembly.glb', contractUrl: '../assets/scene-contract.json',
    scoreUrl: './music-score.json', audioUrl: './audio/bearing-loop.wav', title, documentTitle: 'WOLF bearing A study · Mechanism Studio',
    sourceName: 'Anthrobotics WOLF · CC BY-SA 4.0', creditLabel: credit,
    initialStatus: `${timeline.DURATION.toFixed(2)} s · 70 real bearing-A components · Original Part N names retained.`,
    playingStatus: 'Original score · Layered separation, one real small component up close, and a continuous return.',
  });
} catch (error) { document.getElementById('status').textContent = `Could not prepare the bearing study: ${error.message}`; console.error(error); }
