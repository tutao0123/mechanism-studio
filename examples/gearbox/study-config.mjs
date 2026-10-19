/** One gearbox study, two looks: both pages bind the same model, story,
 * framing and drafting marks; only the style and the page wording differ. */
import { createAssemblyStudy } from '/shared/study/study.mjs';
import { createStudyShell } from '/shared/study/shell.mjs';
import { createGearboxStory } from './story.mjs';
import { createGearboxFraming } from './framing.mjs';
import { createGearboxDrafting } from './drafting-layer.mjs';
import { resolveStyle } from '../../shared/appearance/styles.mjs';
import * as annotations from './annotations.mjs';

export async function startGearboxStudy({ appearance = 'atlas', title, eyebrow, figure, note, footer, documentTitle, creditLabel, globalName = 'gearboxShowcase' }) {
  const style = resolveStyle(appearance);
  createStudyShell({ title });
  document.querySelector('.eyebrow').textContent = eyebrow;
  document.querySelector('.figure-index').textContent = figure;
  document.querySelector('.intro-note').textContent = note;
  document.querySelector('footer > p:last-child').textContent = footer;
  try {
    const response = await fetch('/assets/scene-index.json');
    if (!response.ok) throw new Error(`Scene index: HTTP ${response.status}`);
    const index = await response.json(), timeline = createGearboxStory(index);
    window[globalName] = createAssemblyStudy({
      appearance: style, timeline, annotations, createFraming: loaded => createGearboxFraming(loaded, timeline),
      workingPoses: timeline.workingPoses, appearanceCues: timeline.appearanceCues, presentationOpacity: timeline.presentationOpacity,
      labelObstacleIds: timeline.labelObstacleIds, createPresentationLayer: createGearboxDrafting({ style }),
      cameraTransitionSeconds: .8,
      indexUrl: '/assets/scene-index.json', sourceUrl: '/assets/provenance.json',
      assetUrl: '/assets/gearbox.glb', contractUrl: '/assets/scene-contract.json',
      scoreUrl: '/audio/music-score.json', audioUrl: '/audio/gearbox-loop.wav',
      title, documentTitle, sourceName: 'Original Mechanism Studio teaching model · MIT', creditLabel,
      initialStatus: '40 s · Original teaching model. Speeds are slowed for reading; no loads, friction or contact are simulated.',
      playingStatus: 'One music clock · Gear speeds follow exact tooth ratios.',
    });
  } catch (error) {
    document.getElementById('status').textContent = `Could not prepare the gearbox study: ${error.message}`;
    console.error(error);
  }
}
