import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { STORIES } from '../stories.mjs';
import { PRESENTATION_PROFILES, resolvePresentation, narrationEditions } from '../presentation.mjs';
import { createCameraDirector } from '../camera-director.mjs';

const base = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, base), 'utf8'));

test('quadruped opens its real short edition and explicitly retains a separate full edition', async () => {
  const short = resolvePresentation(STORIES.quadruped), full = resolvePresentation(STORIES.quadruped, 'explain');
  assert.equal(short.presentationMode, 'showcase'); assert.equal(full.presentationMode, 'explain');
  assert.deepEqual(short.availableModes, ['showcase', 'explain']);
  assert.equal(short.asset, full.asset); assert.equal(short.contract, full.contract); assert.equal(short.adapter, full.adapter);
  assert.notEqual(short.lesson, full.lesson); assert.notEqual(short.manifest, full.manifest);
  const [shortLesson, shortTimes, fullTimes, fullManifest] = await Promise.all([json(short.lesson), json(short.durations), json(full.durations), json(full.manifest)]);
  const shortDuration = Object.values(shortTimes.steps).reduce((sum, duration) => sum + duration, 0);
  assert.ok(shortDuration >= 30 && shortDuration <= 40, `Short audio is ${shortDuration} seconds`);
  assert.equal(shortLesson.steps.reduce((sum, step) => sum + step.durationHint, 0), shortDuration, 'silent hints use measured short timing');
  assert.ok(Math.abs(Object.values(fullTimes.steps).reduce((sum, duration) => sum + duration, 0) - 91.944) < 1e-9);
  assert.equal(fullManifest.lessonSha256, '7b45c70e4f1f3d0315103a43b916cf4f6cac192d82fad1bf06f7de6654114389', 'original full narration identity remains intact');
});

test('URL fallback only selects available editions; existing engines remain full lessons', () => {
  assert.equal(resolvePresentation(STORIES.quadruped, 'unknown').presentationMode, 'showcase');
  assert.equal(resolvePresentation(STORIES['inline-four'], 'showcase').presentationMode, 'explain');
  assert.equal(resolvePresentation(STORIES.turbofan).presentationMode, 'explain');
  assert.equal(resolvePresentation({ lesson: 'voice/x/lesson.json', modes: { showcase: {} } }).presentationMode, 'showcase');
  assert.throws(() => resolvePresentation({ lesson: 'voice/x/lesson.json', modes: { other: {} } }));
  assert.throws(() => resolvePresentation({ lesson: 'voice/x/lesson.json', defaultMode: 'explain', modes: { showcase: {} } }));
});

test('offline audits enumerate the short and preserved full tracks once each', () => {
  const ids = narrationEditions(STORIES).map(edition => edition.id);
  assert.deepEqual(ids.sort(), ['inline-four', 'quadruped', 'quadruped-short', 'turbofan']);
  assert.equal(new Set(ids).size, ids.length);
});

test('short camera transitions finish in their own chapter time while full timing is preserved', () => {
  const whole = { position: [3, 2, 4], target: [0, 0, 0], halfHeight: 1 };
  const detail = { position: [.4, .8, 2], target: [.1, .2, .3], halfHeight: .2 };
  for (const profile of Object.values(PRESENTATION_PROFILES)) {
    const director = createCameraDirector({ duration: profile.transitionDuration });
    director.sample({ chapterKey: 'overview', localTime: 0, pose: whole });
    assert.deepEqual(director.sample({ chapterKey: 'detail', localTime: 0, pose: detail }), whole);
    assert.notDeepEqual(director.sample({ chapterKey: 'detail', localTime: profile.transitionDuration / 2, pose: detail }), detail);
    assert.deepEqual(director.sample({ chapterKey: 'detail', localTime: profile.transitionDuration, pose: detail }), detail);
  }
  assert.ok(PRESENTATION_PROFILES.showcase.transitionDuration <= 1);
  assert.equal(PRESENTATION_PROFILES.explain.transitionDuration, 2.4);
});
