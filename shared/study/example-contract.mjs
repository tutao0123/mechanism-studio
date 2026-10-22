/** Browser-free boundary between an example definition and the shared player.
 * Resource URLs are local to its preview server; this is not a filesystem sandbox. */
const requiredText = ['id', 'title', 'sourceName', 'initialStatus'];
const resources = ['indexUrl', 'sourceUrl', 'assetUrl', 'contractUrl', 'scoreUrl', 'audioUrl'];
const fail = message => { throw new TypeError(message); };

export function validateStudyDefinition(definition) {
  if (!definition || typeof definition !== 'object') fail('An example definition is required.');
  for (const field of requiredText) if (typeof definition[field] !== 'string' || !definition[field].trim()) fail(`Example ${field} must be nonempty text.`);
  if (!/^[a-z][a-z0-9-]*$/.test(definition.id)) fail('Example id must use lowercase words and hyphens.');
  for (const field of resources) {
    const value = definition[field];
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000?#]/.test(value)) fail(`${field} must be a local root-relative resource URL.`);
    let decoded; try { decoded = decodeURIComponent(value); } catch { fail(`Invalid resource URL: ${field}.`); }
    if (decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').some(segment => segment === '..' || segment.startsWith('.'))) fail(`${field} must stay within the example preview routes.`);
  }
  if (typeof definition.createPresentation !== 'function') fail('createPresentation(index) is required.');
  if (definition.globalName !== undefined && !/^[A-Za-z_$][\w$]*$/.test(definition.globalName)) fail('globalName must be a JavaScript identifier.');
  if (definition.cameraTransitionSeconds !== undefined && (!Number.isFinite(definition.cameraTransitionSeconds) || definition.cameraTransitionSeconds < 0)) fail('Camera transition duration must be finite and nonnegative.');
  return definition;
}

/** Build against the exact index loaded by the player, avoiding a second fetch
 * that could bind the plan to an older geometry revision during development. */
export function prepareStudyExample(definition, index, source) {
  validateStudyDefinition(definition);
  if (!index?.geometryRevision || !Array.isArray(index.parts) || !index.parts.length) fail('An example needs a versioned scene index with parts.');
  const ids = index.parts.map(part => part.id);
  if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) fail('Scene-index part identities must be nonempty and unique.');
  if (!source || typeof source !== 'object' || Array.isArray(source)) fail('Source provenance is required.');
  const presentation = definition.createPresentation(index);
  if (!presentation?.plan || presentation.plan.geometryRevision !== index.geometryRevision) fail('Presentation plan and scene index geometry revisions disagree.');
  const timeline = presentation.timeline;
  for (const name of ['stateAt', 'normalizeTime', 'localDisplayOffsets']) if (typeof timeline?.[name] !== 'function') fail(`Presentation timeline needs ${name}().`);
  if (timeline.BPM !== presentation.plan.bpm || timeline.DURATION !== presentation.plan.durationSeconds) fail('Presentation plan and timeline timing disagree.');
  if (!timeline.CHAPTERS?.length || typeof presentation.annotations?.annotationCues !== 'function' || typeof presentation.framing?.cameraFor !== 'function') fail('Presentation needs chapters, annotations and framing.');
  for (const chapter of timeline.CHAPTERS) if (!Array.isArray(presentation.annotations.CUE_WINDOWS?.[chapter.id]) || presentation.annotations.CUE_WINDOWS[chapter.id].length !== chapter.labels.length) fail('Annotation windows must match the timeline chapter labels.');
  const { createPresentation, id, globalName, eyebrow, figure, note, footer, ...base } = definition;
  const { plan, framing, rig, ...adapter } = presentation;
  return {
    presentation,
    config: {
      ...base, ...adapter, cameraUp: adapter.cameraUp ?? timeline.cameraUp ?? base.cameraUp, indexData: index, sourceData: source,
      createFraming: actual => {
        if (actual !== index) fail('The player must use the same scene index as the compiled presentation.');
        return framing;
      },
    },
  };
}
