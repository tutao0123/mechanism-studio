import { createAssemblyStudy } from '/shared/study/study.mjs';
import { createStudyShell } from '/shared/study/shell.mjs';
import { createWolfTourStory } from './story.mjs';
import { createWolfTourAnnotations } from './annotations.mjs';
import { createWolfTourFraming, CAMERA_UP } from './framing.mjs';
import { createWolfWorkingMotion } from './kinematics.mjs';
const title = 'WOLF, from whole to detail.';
const credit = 'WOLF by Anthrobotics · CC BY-SA 4.0\nContinuous tour & original score: Mechanism Studio';
createStudyShell({ title, creditLabel: credit, sourceUrl: 'https://github.com/Anthrobotics/wolf-actuator' });
try {
  const response = await fetch('../assets/scene-index.json'); if (!response.ok) throw new Error(`Actual source index: HTTP ${response.status}`);
  const index = await response.json(), timeline = createWolfTourStory(index), rig = createWolfWorkingMotion(index);
  window.wolfCompleteTour = createAssemblyStudy({
    timeline, annotations: createWolfTourAnnotations(timeline), cameraUp: CAMERA_UP, cameraContinuity: 'authored',
    presentationOpacity: timeline.opacityFor, labelObstacleIds: timeline.labelObstacleIds, workingPoses: state => rig.workingPoses(state),
    createFraming: actual => { if (actual.geometryRevision !== index.geometryRevision) throw new Error('Source revision changed during initialization'); return createWolfTourFraming(actual, timeline, rig); },
    detailIds: timeline.detailIds, indexUrl: '../assets/scene-index.json', sourceUrl: '../source/provenance.json', assetUrl: '../assets/assembly.glb', contractUrl: '../assets/scene-contract.json',
    scoreUrl: './music-score.json', audioUrl: './audio/tour-loop.wav', title, documentTitle: 'WOLF complete tour · Mechanism Studio', sourceName: 'Anthrobotics WOLF · CC BY-SA 4.0', creditLabel: credit,
    initialStatus: `${timeline.DURATION.toFixed(2)} s · 245 original components · One continuous scene · Illustrative input motion; no meshing simulation.`,
    playingStatus: 'One continuous score · Whole assembly, motor and magnet, bearing and Part 1, then complete reassembly.',
  });
} catch (error) { document.getElementById('status').textContent = `Could not prepare the WOLF tour: ${error.message}`; console.error(error); }
