/** Reviewable authoring handoffs; the page executes its explicit JS adapters. */
import { readFile, writeFile } from 'node:fs/promises';
import { createGearboxStory } from '../story.mjs';
import { createGearboxFraming } from '../framing.mjs';
import { CUE_WINDOWS, NAME_FADE_SECONDS, SCENE_FADE_SECONDS, ANNOTATION_REVISION } from '../annotations.mjs';
import { GEARS, TEETH, CENTRE_DISTANCE, MODULE, LIMITATIONS, SPEC_REVISION } from '../spec.mjs';
import { KINEMATICS_REVISION, TRAIN, SHIFT_PHASES } from '../kinematics.mjs';

const index = JSON.parse(await readFile(new URL('../assets/scene-index.json', import.meta.url), 'utf8'));
const story = createGearboxStory(index), framing = createGearboxFraming(index, story);
const base = { schemaVersion: 1, stage: 'bound', geometryRevision: index.geometryRevision, planRevision: story.PLAN_REVISION };
const plans = {
  brief: {
    ...base, route: 'Showcase', language: 'en', inputKind: 'Original authored teaching model (no third-party source)', license: 'MIT',
    goal: 'Show how one lever chooses a different power path: structure, free-running gears, synchronizer engagement and the ratio of every forward gear.',
    requestedDepth: 'Whole gearbox to synchronizer keys and bearing balls', availableDepth: `${index.parts.length} parts in ${index.assemblies.length} assemblies`,
    engineeringEvidence: `Authored spec ${SPEC_REVISION}: module ${MODULE * 1000} mm, one ${CENTRE_DISTANCE * 1000} mm centre distance, exact tooth ratios.`,
    presentation: 'Slowed rotation for legibility; authored shift timing; editorial explosion offsets.', limitations: LIMITATIONS,
  },
  timeline: { ...base, bpm: story.BPM, beats: story.TOTAL_BEATS, seconds: story.DURATION,
    clock: 'One seekable PCM transport, or the same explicit visual time while paused/silent.', chapters: story.CHAPTERS,
    driveSchedule: story.SCHEDULE, alignments: story.drive.alignments, shiftPhases: SHIFT_PHASES },
  'mechanism-plan': { ...base, kinematicsRevision: KINEMATICS_REVISION, teeth: TEETH, centreDistance: CENTRE_DISTANCE,
    ratios: Object.fromEntries(Object.entries(GEARS).map(([id, gear]) => [id, gear.ratio])), inputMultipliers: TRAIN,
    powerPaths: Object.fromEntries(Object.keys(GEARS).map(id => [id, story.powerPathIds(id)])),
    model: 'Every input-train angle is an exact tooth ratio of the input angle; the output angle follows the engaged gear. Angles are integrated once on a fixed 1200 Hz grid from authored speeds, never per frame.',
    synchronizer: 'During a shift the input speed blends to the new gear speed (synchronizer action) and a solved speed adjustment aligns sleeve and dog teeth before engagement.' },
  'explosion-plan': { ...base, units: 'm', space: 'world editorial translation', cohorts: story.COHORTS, caseTiming: story.CASE_TIMING,
    maximumOffsets: Object.fromEntries(index.parts.map(part => [part.id, Object.values(story.explode.get(part.id)).reduce((sum, v) => sum.map((x, i) => x + v[i]), [0, 0, 0])])),
    caseLift: Object.fromEntries(story.caseParts), adapter: '../story.mjs:localDisplayOffsets',
    restoration: 'All display offsets are zero at the loop boundary. Assembly rest matrices remain immutable.',
    limitations: 'No disassembly order, collision checking, press fits or circlip removal is claimed.' },
  'camera-plan': { ...base, cameraRevision: framing.cameraRevision, boundsMethod: framing.boundsMethod,
    envelopes: Object.fromEntries(Object.entries(framing.envelopes).map(([id, box]) => [id, { min: box.min.toArray(), max: box.max.toArray() }])),
    transitionSeconds: .8, loop: 'Whole and close chapters share one rest envelope and direction.', adapter: '../framing.mjs' },
  'annotation-plan': { ...base, annotationRevision: ANNOTATION_REVISION, labels: Object.fromEntries(story.CHAPTERS.map(chapter => [chapter.id, chapter.labels])),
    cueWindowsSeconds: CUE_WINDOWS, nameFadeSeconds: NAME_FADE_SECONDS, sceneFadeSeconds: SCENE_FADE_SECONDS,
    policy: 'Near-part names with short leaders; named parts stay settled through each window. Dense chapters restrict obstacles to the named parts and rely on the white text halo.',
    adapter: '../annotations.mjs' },
  'appearance-plan': { ...base, base: 'White surfaces with fine dark feature edges and atlas serif typography.',
    color: 'Restrained pale blue for the parts carrying torque in the engaged gear, plus any part being named.', contextFade: story.FOCUS,
    owner: 'Shared reversible mesh-colour and visibility layers; the case fades with its edges.', adapter: '../story.mjs:appearanceCues, presentationOpacity' },
};
for (const [name, plan] of Object.entries(plans)) await writeFile(new URL(`${name}.json`, import.meta.url), JSON.stringify(plan, null, 2) + '\n');
console.log(`Wrote ${Object.keys(plans).length} bound gearbox authoring handoffs. Runtime remains the explicit example adapters.`);
