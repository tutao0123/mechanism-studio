import { createPlanetaryPresentation } from './presentation.mjs';
import { createBearingCues } from './bearing-cues.mjs';

export function createPlanetaryExample() {
  return {
    id: 'planetary-gears', globalName: 'planetaryShowcase',
    title: 'More than gears.', eyebrow: 'Eighty parts, one planetary reducer.',
    figure: 'Planetary reducer / 80 parts',
    note: 'Housing. Transmission. Bearings. Every layer revealed.',
    footer: 'Original parametric model · Ideal kinematics · Synthesized music',
    documentTitle: 'More than gears · Mechanism Studio',
    sourceName: 'Original Mechanism Studio teaching geometry · MIT',
    creditLabel: 'Mechanism Studio · Original teaching model\nIdeal kinematics · Display disassembly',
    initialStatus: '36 s · 80 authored parts. Ideal gear and bearing motion; display separation is not a service procedure.',
    playingStatus: 'One music clock · Enclosure, transmission, bearing detail, reassembly.',
    appearance: 'atlas', cameraTransitionSeconds: .9,
    indexUrl: '/assets/scene-index.json', sourceUrl: '/assets/provenance.json',
    assetUrl: '/assets/assembly.glb', contractUrl: '/assets/scene-contract.json',
    scoreUrl: '/audio/music-score.json', audioUrl: '/audio/planetary-loop.wav',
    createPresentation: createPlanetaryPresentation,
    createPresentationLayer: createBearingCues,
  };
}
