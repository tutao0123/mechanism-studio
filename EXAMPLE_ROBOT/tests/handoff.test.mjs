import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sha256 } from '../../shared/assets/glb.mjs';
import { MAXIMUM_OFFSETS, GROUPS, PLAN_REVISION, DURATION } from '../story.mjs';
import { ANNOTATION_REVISION, CUE_WINDOWS, SCENE_FADE_SECONDS } from '../annotations.mjs';
import { PULLBACK } from '../framing.mjs';

const root = new URL('../', import.meta.url);
const readJson = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
test('module handoffs bind the delivered geometry, actual robot identities and current music edition', async () => {
  const index = await readJson('planning/scene-index.json'), ids = index.parts.map(part => part.id).sort();
  const plans = Object.fromEntries(await Promise.all(['explosion-plan', 'camera-plan', 'appearance-plan', 'annotation-plan', 'timeline'].map(async name => [name, await readJson(`planning/${name}.json`)])));
  assert.equal(index.asset.sha256, sha256(await readFile(new URL(index.asset.file, root))));
  for (const plan of Object.values(plans)) { assert.equal(plan.geometryRevision, index.geometryRevision); assert.equal(plan.stage, 'bound'); }
  assert.deepEqual(Object.keys(plans['explosion-plan'].maximumOffsets).sort(), ids);
  assert.deepEqual(plans['explosion-plan'].maximumOffsets, MAXIMUM_OFFSETS);
  assert.deepEqual(plans['explosion-plan'].groups, GROUPS);
  assert.equal(plans['explosion-plan'].planRevision, PLAN_REVISION);
  assert.equal(plans['camera-plan'].explosionPlanRevision, PLAN_REVISION);
  assert.deepEqual(plans['camera-plan'].pullback, PULLBACK);
  assert.equal(plans['camera-plan'].annotationPlanRevision, ANNOTATION_REVISION);
  assert.equal(plans['annotation-plan'].planRevision, ANNOTATION_REVISION);
  assert.equal(plans['annotation-plan'].maximumSimultaneous, 2);
  assert.deepEqual(plans['annotation-plan'].localChapterWindowsSeconds, CUE_WINDOWS);
  assert.equal(plans['annotation-plan'].fadeSeconds.sceneOut, SCENE_FADE_SECONDS);
  for (const targets of Object.values(plans['camera-plan'].detailVisibility).filter(Array.isArray)) for (const id of targets) assert.ok(ids.includes(id));
  assert.deepEqual(plans['appearance-plan'].assignments.map(item => item.id).sort(), ids);
  const timeline = plans.timeline, score = await readJson('audio/music-score.json');
  assert.equal(timeline.durationSeconds, DURATION); assert.equal(timeline.music.sha256, score.sha256);
  assert.equal(timeline.music.sha256, sha256(await readFile(new URL(timeline.music.file, root))));
  assert.equal(timeline.durationSeconds, timeline.music.frames / timeline.music.sampleRate);
});
