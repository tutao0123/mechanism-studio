import { createAssemblyStudy } from './study.mjs';
import { createStudyShell } from './shell.mjs';
import { validateStudyDefinition, prepareStudyExample } from './example-contract.mjs';

/** Common bootstrap for plan-backed studies. Exactly one study owns a page.
 * Exposes the same API under mechanismStudy and the optional historical name. */
export async function startStudyExample(definition) {
  validateStudyDefinition(definition);
  createStudyShell({ title: definition.title, creditLabel: definition.creditLabel });
  for (const [field, selector] of Object.entries({ eyebrow: '.eyebrow', figure: '.figure-index', note: '.intro-note', footer: 'footer > p:last-child' })) {
    if (definition[field] !== undefined) document.querySelector(selector).textContent = definition[field];
  }
  try {
    const read = async url => { const result = await fetch(url); if (!result.ok) throw new Error(`${url}: HTTP ${result.status}`); return result.json(); };
    const [index, source] = await Promise.all([read(definition.indexUrl), read(definition.sourceUrl)]);
    const { config, presentation } = prepareStudyExample(definition, index, source);
    const api = createAssemblyStudy(config);
    Object.defineProperties(api, { exampleId: { value: definition.id }, presentation: { value: presentation } });
    window.mechanismStudy = api;
    if (definition.globalName) window[definition.globalName] = api;
    if (!await api.ready) throw new Error('The shared player could not prepare the assembly. See its status and console for details.');
    return api;
  } catch (error) {
    document.getElementById('status').textContent = `Could not prepare ${definition.id}: ${error.message}`;
    throw error;
  }
}
