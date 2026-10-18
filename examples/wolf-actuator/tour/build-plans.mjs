import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createWolfTourStory } from './story.mjs';
import { createWolfTourFraming } from './framing.mjs';
import { createWolfTourAnnotations } from './annotations.mjs';
import { createWolfWorkingMotion } from './kinematics.mjs';
const read = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const index = await read('../assets/scene-index.json'), story = createWolfTourStory(index), rig = createWolfWorkingMotion(index), framing = createWolfTourFraming(index, story, rig), annotations = createWolfTourAnnotations(story), score = await read('music-score.json'), wav = await readFile(new URL('audio/tour-loop.wav', import.meta.url));
if (score.sha256 !== createHash('sha256').update(wav).digest('hex') || score.byteLength !== wav.length || score.bpm !== story.BPM || Math.abs(score.durationSeconds - story.DURATION) > 1 / score.sampleRate) throw new Error('The actual continuous score must match the tour before building its plan.');
const plan = { schemaVersion: '1.2.0', stage: 'bound', planRevision: story.PLAN_REVISION, geometryRevision: index.geometryRevision, sourceSHA256: index.sourceSHA256,
  durationSeconds: story.DURATION, bpm: story.BPM, totalBeats: story.TOTAL_BEATS, sourcePartCount: index.parts.length,
  identityPolicy: 'One retained 245-leaf scene. Local motor and bearing studies restore to the current whole-level expanded pose; only the last return restores source rest. Original focus occurrences are never cloned or mesh-scaled.',
  chapters: story.CHAPTERS, scopes: story.SCOPES, groups: story.GROUPS, motionEvents: story.MOTION_EVENTS, bindings: story.bindings,
  macroMaximumOffsets: story.MACRO_MAXIMUM_OFFSETS, combinedEndpointOffsets: story.MAXIMUM_OFFSETS, pathEndpointOffsets: story.PATH_MAXIMUM_OFFSETS, offsetOwnership: story.offsetOwnership,
  workingMotion: { ...rig.evidence, demonstration: { firstBeat: 20, turnCompleteBeat: 26, handoffCompleteBeat: 28 }, runtimeOwner: 'kinematics.workingPoses -> viewer.model; source static rest remains the immutable baseline' },
  presentation: { cameraRevision: framing.cameraRevision, envelope: { min: framing.fullEnvelope.min.toArray(), max: framing.fullEnvelope.max.toArray() }, envelopeMethod: framing.envelopeMethod, opacity: 'Whole context fades before input close-up; inner context retains the component-study ghost policy; contexts recover during wide hand-offs.', annotationWindows: annotations.CUE_WINDOWS, macroType: 'Original occurrence tracking first, camera magnification second; fixed reduced-motion macro during settled read.' },
  music: { file: 'audio/tour-loop.wav', edition: score.edition, sha256: score.sha256, byteLength: score.byteLength, durationSeconds: score.durationSeconds },
  limitations: ['Whole/component explosion and focus excursions are editorial, not service or collision-checked disassembly.', 'Input co-rotation is an authored teaching linkage supported by selected manual attachments and source geometry; the STEP provides no recovered mates.', 'Planet/ring/bearing transmission, 34:1 signed kinematics, torque, load and dynamics are not simulated.', 'Generic cc and Part N names retain their source uncertainty.'] };
await writeFile(new URL('plan.json', import.meta.url), `${JSON.stringify(plan, null, 2)}\n`);
console.log(JSON.stringify({ planRevision: plan.planRevision, durationSeconds: plan.durationSeconds, sourcePartCount: plan.sourcePartCount, chapters: plan.chapters.length, motionEvents: plan.motionEvents.length, audioSha256: score.sha256 }));
