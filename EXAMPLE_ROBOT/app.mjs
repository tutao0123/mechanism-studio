import { createAssemblyStudy } from '/shared/study/study.mjs';
import { createRobotFraming } from './framing.mjs';
import { annotationCues, CUE_WINDOWS } from './annotations.mjs';
import * as timeline from './story.mjs';

window.robotShowcase = createAssemblyStudy({
  timeline, annotations: { annotationCues, CUE_WINDOWS },
  createFraming: index => createRobotFraming(index, timeline.MAXIMUM_OFFSETS),
  detailIds: state => state.chapter.id === 'wrist'
    ? ['urdf:link4_1', 'urdf:link5_1', 'urdf:clamp1_1', 'urdf:clamp2_1']
    : state.chapter.id === 'grip' ? ['urdf:link5_1', 'urdf:clamp1_1', 'urdf:clamp2_1'] : null,
  indexUrl: './planning/scene-index.json', sourceUrl: './source/provenance.json',
  assetUrl: './assets/robot.glb', contractUrl: './assets/scene-contract.json',
  scoreUrl: './audio/music-score.json', audioUrl: './audio/robot-loop.wav',
  title: 'SO-ARM 102, revealed.', documentTitle: 'SO-ARM 102 · Mechanism Studio',
  sourceName: 'Robonine SO-ARM 102 · CC BY 4.0',
  creditLabel: 'SO-ARM 102 by Robonine · CC BY 4.0\nPresentation & original score: Mechanism Studio',
  initialStatus: '34.29 s · Eight source links · Display explosion, not a collision-checked disassembly.',
  playingStatus: 'Soft half-time score · Quiet motion and seating cues follow the assembly.',
});
