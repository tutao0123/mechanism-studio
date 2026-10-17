/** Reviewable authoring handoffs; the page executes its explicit JS adapters. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHumanoidStory } from '../story.mjs';
import { createHumanoidFraming } from '../framing.mjs';
import { CUE_WINDOWS, NAME_FADE_SECONDS, SCENE_FADE_SECONDS } from '../annotations.mjs';

const index = JSON.parse(await readFile(new URL('../assets/scene-index.json', import.meta.url), 'utf8'));
const source = JSON.parse(await readFile(new URL('../source/provenance.json', import.meta.url), 'utf8'));
const story = createHumanoidStory(index), framing = createHumanoidFraming(index, story);
const base = { schemaVersion: 1, stage: 'bound', geometryRevision: index.geometryRevision, planRevision: story.PLAN_REVISION };
const plans = {
  brief: {
    ...base, route: 'Showcase', language: 'en', source: source.sourceUrl,
    sourceLicense: source.license, inputKind: 'MJCF with retained visual STL assets',
    goal: 'Show one humanoid structure, readable upper/lower chains, and exact visual restoration.',
    requestedDepth: 'Whole robot to source bodies', availableDepth: '30 source bodies, 35 visual mesh occurrences',
    engineeringEvidence: 'Source hierarchy, rest transforms and 29 hinge definitions; the free base is retained as source evidence.',
    presentation: 'Zero joint pose with authored observation translations. No gait, balance, actuator internals, hidden screws or service sequence.',
    distinction: 'A separate WOLF component study uses its own real CAD internals; it must not be described as G1 hardware.',
  },
  timeline: { ...base, bpm: story.BPM, beats: story.TOTAL_BEATS, seconds: story.DURATION,
    clock: 'One seekable PCM transport, or the same explicit visual time while paused/silent.', chapters: story.CHAPTERS },
  'explosion-plan': { ...base, units: 'm', space: 'world editorial translation',
    fixedIds: ['mjcf:pelvis'], groups: story.GROUPS, movementBeats: story.MOVEMENT_BEATS,
    maximumOffsets: story.MAXIMUM_OFFSETS,
    inheritance: 'Subtract the immediate source parent world displacement; convert the residual with the inverse linear parent transform.',
    adapter: '../story.mjs:localDisplayOffsets', restoration: 'All display offsets are zero at opening, resolve and loop boundary. Source rest matrices remain immutable.',
    limitations: 'No inferred joints, collision checking, thread motion or hidden part reconstruction.' },
  'camera-plan': { ...base, cameraRevision: framing.cameraRevision, boundsMethod: framing.boundsMethod,
    envelopes: Object.fromEntries(Object.entries(framing.envelopes).map(([id, box]) => [id, { min: box.min.toArray(), max: box.max.toArray() }])),
    visibleDetailIds: story.details, cutsOnEntry: story.CAMERA_CUTS, transitionSeconds: .65,
    detailArcSettledSeconds: .85, loop: 'Whole and resolve share the exact camera.', adapter: '../framing.mjs' },
  'annotation-plan': { ...base, labels: Object.fromEntries(story.CHAPTERS.map(chapter => [chapter.id, chapter.labels])),
    cueWindowsSeconds: CUE_WINDOWS, nameFadeSeconds: NAME_FADE_SECONDS, sceneFadeSeconds: SCENE_FADE_SECONDS,
    policy: 'Close to real visible part bounds, short leaders, one name at a time; retain names in the scene and fade the group at exit. Omit a cue when a narrow viewport cannot fit it.',
    adapter: '../annotations.mjs' },
  'appearance-plan': { ...base, base: 'White surfaces with fine black edges and atlas serif typography.',
    color: 'Restrained pale blue for a named source body and the currently separating/returning editorial group.',
    owner: 'Independent reversible mesh-colour layer; preserve the source material and selection ownership.', adapter: '../app.mjs:appearanceCues' },
};
for (const [name, plan] of Object.entries(plans)) await writeFile(new URL(`${name}.json`, import.meta.url), JSON.stringify(plan, null, 2) + '\n');
console.log('Wrote six source-bound G1 authoring handoffs. Runtime remains the explicit example adapters.');
