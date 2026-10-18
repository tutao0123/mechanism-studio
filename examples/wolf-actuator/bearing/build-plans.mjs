import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createWolfBearingStory } from './story.mjs';
import { createWolfBearingAnnotations } from './annotations.mjs';
import { createWolfBearingFraming } from './framing.mjs';
const read = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const index = await read('../assets/scene-index.json'), story = createWolfBearingStory(index), annotations = createWolfBearingAnnotations(story), framing = createWolfBearingFraming(index, story), score = await read('music-score.json');
const wav = await readFile(new URL('audio/bearing-loop.wav', import.meta.url));
if (score.sha256 !== createHash('sha256').update(wav).digest('hex') || score.byteLength !== wav.length || score.bpm !== story.BPM || Math.abs(score.durationSeconds - story.DURATION) > 1 / score.sampleRate) throw new Error('Build and verify the bearing score before its authoring plan.');
const step = 1 / 120; let moving = 0, longest = 0, still = 0;
for (let time = 0; time < story.DURATION - step; time += step) { const a = story.stateAt(time), b = story.stateAt(time + step), active = index.parts.some(part => a.offsetsWorld[part.id].some((value, axis) => Math.abs(value - b.offsetsWorld[part.id][axis]) > 1e-9)); if (active) { moving += step; still = 0; } else { still += step; longest = Math.max(longest, still); } }
const plan = { schemaVersion: '1.1.0', stage: 'bound', planRevision: story.PLAN_REVISION, geometryRevision: index.geometryRevision, sourceSHA256: index.sourceSHA256,
  sourceComponentId: story.bindings.bearing, sourceComponentName: 'bearing-assembly-A <1>', sourcePartCount: 70,
  sourceGroups: { namedOuterRing: 1, largerGenericPartN: 3, smallerGenericPartN: 66 },
  identityPolicy: 'Original occurrence identities, geometry and parents. Part 1 is translated into observation space and magnified by the camera; no clone, mesh scale or inferred functional name.',
  durationSeconds: story.DURATION, bpm: story.BPM, chapters: story.CHAPTERS, groups: story.GROUPS, motionEvents: story.MOTION_EVENTS, maximumOffsets: story.MAXIMUM_OFFSETS, pathMaximumOffsets: story.PATH_MAXIMUM_OFFSETS, focusOffset: story.FOCUS_OFFSET,
  bindings: story.bindings, editorialAxis: story.editorialAxis, annotationWindows: annotations.CUE_WINDOWS,
  presentation: { cameraRevision: framing.cameraRevision, camera: 'Absolute timeline, tracking before zoom, widening before handing target back; reduced motion uses wide stills and a true settled macro.', context: 'Original leaves stay in the scene. Outside-bearing context fades; nonfocus bearing leaves retain at least 0.12 alpha.', framingEvidence: framing.envelopeMethod, styleReference: framing.styleReference },
  diagnostics: { method: '120 Hz finite differences of display translations, excluding camera/opacity, threshold 1e-9 metres/sample.', movingSeconds: moving, movingFraction: moving / story.DURATION, longestUnmovingIntervalSeconds: longest },
  music: { file: 'audio/bearing-loop.wav', sha256: score.sha256, byteLength: score.byteLength, edition: score.edition },
  limitations: ['Editorial explosion and observation excursion, not collision-checked service disassembly.', 'Generic Part N names do not establish balls, rollers, races, seals, cages, material, preload or load ratings.', 'No inferred bearing rotation, contact, joint constraints, force or dynamics.'] };
await writeFile(new URL('plan.json', import.meta.url), `${JSON.stringify(plan, null, 2)}\n`);
console.log(JSON.stringify({ component: plan.sourceComponentId, planRevision: plan.planRevision, focus: story.bindings.focus, scoreEdition: score.edition, ...plan.diagnostics }));
