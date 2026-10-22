/** Copy into examples/<your-example>/example.mjs after preparing source assets.
 * The project does not publish a fake model or infer joints from this template. */
export function defineExample({ createPresentation, id, title, sourceName, creditLabel }) {
  return {
    id, title, sourceName, creditLabel, createPresentation,
    eyebrow: 'A study in mechanical motion.', figure: 'Assembly / Motion study',
    note: 'Expand. Observe. Reassemble.',
    footer: 'Live geometry · Original synthesized score · No narration',
    appearance: 'atlas', cameraTransitionSeconds: .8,
    indexUrl: '/assets/scene-index.json', sourceUrl: '/source/provenance.json',
    assetUrl: '/assets/assembly.glb', contractUrl: '/assets/scene-contract.json',
    scoreUrl: '/audio/music-score.json', audioUrl: '/audio/showcase-loop.wav',
    initialStatus: 'A source-linked mechanical study. Read the example notes for verified motion and limitations.',
    playingStatus: 'One music clock · Expand, inspect and reassemble.',
  };
}
