/** Presentation timing is separate from the visual style and mechanical model. */
export const PRESENTATION_PROFILES = Object.freeze({
  showcase: Object.freeze({ label: 'Showcase · short', transitionDuration: .8,
    annotations: Object.freeze({ start: .15, stagger: .12, fadeIn: .25, fadeOut: .2, settleStart: .6 }) }),
  explain: Object.freeze({ label: 'Explain · full', transitionDuration: 2.4,
    annotations: Object.freeze({ start: .55, stagger: .18, fadeIn: .7, fadeOut: .5, settleStart: .8 }) }),
});

/** Missing/unsupported URL choices select a real edition, never a fake short mode. */
export function resolvePresentation(story, requestedMode) {
  if (!story?.lesson) throw new TypeError('A presentation needs a story.');
  const editions = story.modes ?? { explain: {} };
  const availableModes = Object.keys(editions);
  if (!availableModes.length || availableModes.some(mode => !Object.hasOwn(PRESENTATION_PROFILES, mode))) throw new TypeError('Unknown presentation edition.');
  const preferred = story.defaultMode ?? (Object.hasOwn(editions, 'showcase') ? 'showcase' : 'explain');
  const mode = Object.hasOwn(editions, requestedMode) ? requestedMode : preferred;
  if (!Object.hasOwn(editions, mode)) throw new TypeError('The default presentation edition is unavailable.');
  return { ...story, ...editions[mode], presentationMode: mode, profile: PRESENTATION_PROFILES[mode], availableModes };
}

/** All distinct local narration editions, including preserved full versions. */
export function narrationEditions(stories) {
  const editions = new Map();
  for (const [storyId, story] of Object.entries(stories)) {
    for (const mode of Object.keys(story.modes ?? { explain: {} })) {
      const edition = resolvePresentation(story, mode);
      const match = /^voice\/([\w-]+)\/lesson\.json$/.exec(edition.lesson);
      if (!match) throw new TypeError('Narration must use the local story layout.');
      const id = match[1], existing = editions.get(id);
      if (existing && (existing.lesson !== edition.lesson || existing.manifest !== edition.manifest || existing.durations !== edition.durations)) throw new TypeError('Conflicting narration edition.');
      editions.set(id, { ...edition, id, storyId });
    }
  }
  return [...editions.values()];
}
