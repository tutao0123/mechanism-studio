/** Complete source-linked study configuration for the shared bootstrap. */
import { createGripperPresentation } from './presentation.mjs';

export function createGripperExample() {
  return {
    id: 'robotiq-gripper', globalName: 'robotiqShowcase', appearance: 'atlas',
    title: 'A grasp, connected.', eyebrow: 'A study in coupled motion.',
    figure: 'Robotiq 2F-85 / Linkage study', note: 'One command. Two fingers. One closed loop on each side.',
    documentTitle: 'Robotiq gripper, connected · Mechanism Studio',
    creditLabel: 'Robotiq 2F-85 model © ROS-Industrial · BSD-2-Clause\nSource: MuJoCo Menagerie · Kinematic adaptation\nMechanism Studio · Original synthesized score',
    sourceName: 'Robotiq 2F-85 via MuJoCo Menagerie · BSD-2-Clause',
    initialStatus: '35.56 s · Source body inspection and closed-loop kinematics. No contact or force simulation.',
    playingStatus: 'One music clock · Coupled grasp, source link separation and complete reassembly.',
    indexUrl: '/assets/scene-index.json', sourceUrl: '/source/provenance.json',
    assetUrl: '/assets/assembly.glb', contractUrl: '/assets/scene-contract.json',
    scoreUrl: '/audio/music-score.json', audioUrl: '/audio/showcase-loop.wav',
    cameraTransitionSeconds: .8, cameraCuts: ['detail', 'relation'], createPresentation: createGripperPresentation,
  };
}
