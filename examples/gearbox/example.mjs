/** Complete study configuration consumed by the shared example bootstrap. */
import { createGearboxPresentation } from './presentation.mjs';
import { createGearboxDrafting } from './drafting-layer.mjs';
import { resolveStyle } from '../../shared/appearance/styles.mjs';

export function createGearboxExample(options = {}) {
  const style = resolveStyle(options.appearance ?? 'atlas');
  return {
    id: 'gearbox', globalName: 'gearboxShowcase',
    title: 'A gearbox, revealed.', eyebrow: 'A study in switching power paths.',
    figure: 'Five-speed gearbox / Teaching model', note: 'Open. Separate. Drive through every gear.',
    footer: 'Original teaching model · Ideal tooth ratios · Original score · No narration',
    documentTitle: 'A gearbox, revealed · Mechanism Studio',
    creditLabel: 'Five-speed teaching gearbox · Mechanism Studio · MIT\nIdeal tooth ratios · Not a production design',
    sourceName: 'Original Mechanism Studio teaching model · MIT',
    initialStatus: '40 s · Original teaching model. Speeds are slowed for reading; no loads, friction or contact are simulated.',
    playingStatus: 'One music clock · Gear speeds follow exact tooth ratios.',
    indexUrl: '/assets/scene-index.json', sourceUrl: '/assets/provenance.json',
    assetUrl: '/assets/gearbox.glb', contractUrl: '/assets/scene-contract.json',
    scoreUrl: '/audio/music-score.json', audioUrl: '/audio/gearbox-loop.wav',
    cameraTransitionSeconds: .8, ...options, appearance: style,
    createPresentation: createGearboxPresentation,
    createPresentationLayer: createGearboxDrafting({ style }),
  };
}
