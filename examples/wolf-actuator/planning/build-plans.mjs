import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createWolfStory } from '../story.mjs';
import { createWolfAnnotations } from '../annotations.mjs';
import { CAMERA_UP, PULLBACK } from '../framing.mjs';
const index = JSON.parse(await readFile(new URL('../assets/scene-index.json', import.meta.url), 'utf8'));
const timeline = createWolfStory(index), annotations = createWolfAnnotations(timeline);
const score = JSON.parse(await readFile(new URL('../audio/music-score.json', import.meta.url), 'utf8'));
const sourceRecords = new Map([...index.assemblies, ...index.parts].map(record => [record.id, record]));
const describe = id => { const record = sourceRecords.get(id); return { id, name: record.name, definitionId: record.definitionId, parentId: record.parentId, source: record.source }; };
const sourceBindings = Object.fromEntries(Object.entries(timeline.bindings).map(([role, ids]) => [role, Array.isArray(ids) ? ids.map(describe) : describe(ids)]));
const base = { schemaVersion: '1.0.0', stage: 'bound', geometryRevision: index.geometryRevision, sourceSHA256: index.sourceSHA256, sourceRevision: index.sourceRevision, sourceBindings };
const records = {
  brief: { ...base, input: 'Pinned open-source STEP assembly', goal: '34.29-second English assembly showcase, near-part retained names, restrained timeline colour cues and quiet code music.', sourceUnits: 'm', capability: 'Actual source occurrence tree and placement with mixed source geometry; no recovered mates, solved gears or collision-free assembly sequence.' },
  'explosion-plan': { ...base, planRevision: timeline.PLAN_REVISION, editorialAxis: timeline.editorialAxis, groups: timeline.GROUPS, maximumOffsets: timeline.MAXIMUM_OFFSETS, actionDurationBeats: 2, semantics: 'Display-only world-metre translations, inverted through actual source parent matrices; preserved source rest geometry.' },
  'camera-plan': { ...base, planRevision: 'wolf-camera-2', explosionPlanRevision: timeline.PLAN_REVISION, annotationPlanRevision: annotations.ANNOTATION_REVISION, transitionSeconds: .8, cameraUp: CAMERA_UP, pullback: PULLBACK, detailVisibility: timeline.details, policy: 'Fixed source-bound rest/swept envelopes; fully expanded rings/gears detail envelopes. Stable Z-up camera orientation opens the source Y-axis stack across the landscape frame; source matrices stay unchanged. No live bounds camera feedback.' },
  'annotation-plan': { ...base, planRevision: annotations.ANNOTATION_REVISION, maximumSimultaneous: 2, labels: Object.fromEntries(timeline.CHAPTERS.map(chapter => [chapter.id, chapter.labels])), localChapterWindowsSeconds: annotations.CUE_WINDOWS, fadeSeconds: { nameIn: annotations.NAME_FADE_SECONDS, sceneOut: annotations.SCENE_FADE_SECONDS }, policy: 'Near real projected contours, 15–20 px clearance and 10–15 px leaders. Sequential names persist within the scene, then fade together. Omit obstructed labels instead of stretching across the scene.' },
  'appearance-plan': { ...base, planRevision: 'wolf-appearance-1', baseColor: '#f1f1ed', accentColor: '#b7d5df', lineColor: '#353532', policy: 'One pale blue explanation cue following the same annotation opacity; restore neutral at scene boundary. Color cues can be switched off. No inferred physical material or load map.', assignments: index.parts.map(part => ({ id: part.id, baseColor: '#f1f1ed' })) },
  timeline: { ...base, planRevision: 'wolf-timeline-1', bpm: timeline.BPM, durationSeconds: timeline.DURATION, chapters: timeline.CHAPTERS, groups: timeline.GROUPS, music: { file: 'audio/wolf-loop.wav', sha256: score.sha256, edition: score.edition, frames: score.frames, sampleRate: score.sampleRate }, clock: 'Native Audio.currentTime when enabled; same deterministic time for silent viewing and explicit capture frames.' },
};
await mkdir(new URL('./', import.meta.url), { recursive: true });
for (const [name, record] of Object.entries(records)) await writeFile(new URL(`${name}.json`, import.meta.url), JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({ geometryRevision: index.geometryRevision, partCount: index.parts.length, plans: Object.keys(records) }));
