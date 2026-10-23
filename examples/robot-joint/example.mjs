import { createJointPresentation } from './presentation.mjs';
import { PARTS } from './spec.mjs';
import { createBearingCues } from './bearing-cues.mjs';
export function createJointExample() {
  return {
    id: 'robot-joint', globalName: 'jointShowcase', title: 'Inside a robot joint.',
    eyebrow: 'Original geometry, from a mechanical description.', figure: `Robot joint / ${PARTS.length} parts`,
    note: 'Motor. Reducer. Bearings. A complete path to the output.',
    footer: 'Original parametric model · Ideal kinematics · Synthesized music',
    documentTitle: 'Inside a robot joint · Mechanism Studio',
    sourceName: 'Original Mechanism Studio teaching geometry · MIT',
    creditLabel: 'Mechanism Studio · Original teaching model\nIdeal kinematics · Display disassembly',
    initialStatus: `36 s · ${PARTS.length} authored parts. Ideal motion; display disassembly is not a service procedure.`,
    playingStatus: 'One music clock · Motor, reduction, rolling support, reassembly.',
    appearance: 'atlas', cameraTransitionSeconds: .9,
    indexUrl: '/assets/scene-index.json', sourceUrl: '/assets/provenance.json', assetUrl: '/assets/assembly.glb', contractUrl: '/assets/scene-contract.json',
    scoreUrl: '/audio/music-score.json', audioUrl: '/audio/joint-loop.wav', createPresentation: createJointPresentation, createPresentationLayer: createBearingCues,
  };
}
