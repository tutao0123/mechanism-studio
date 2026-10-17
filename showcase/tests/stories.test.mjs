import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { STORIES } from '../stories.mjs';
import { narrationEditions } from '../presentation.mjs';
import { createTimeline, locateTime } from '../timeline.mjs';
import { validateManifest } from '../../shared/voice/player.mjs';
import { sha256 } from '../../shared/assets/glb.mjs';
import { optionalAssetSet } from '../../tests/optional-assets.mjs';

const base = new URL('../', import.meta.url);
const readJSON = async url => JSON.parse(await readFile(url, 'utf8'));

for (const story of narrationEditions(STORIES)) {
  const { id } = story;
  test(`${id}: English lesson, optional exact audio and measured chapter clock agree`, async t => {
    const lessonURL = new URL(story.lesson, base);
    const [lesson, manifest, durations] = await Promise.all([
      readJSON(lessonURL), readJSON(new URL(story.manifest, base)), readJSON(new URL(story.durations, base)),
    ]);
    assert.equal(lesson.language, 'en-US');
    assert.equal(manifest.provider, 'doubao');
    assert.equal(manifest.speaker, 'en_female_jane_uranus_bigtts');
    await validateManifest(manifest, lesson, { baseURL: `http://localhost/showcase/voice/${id}/` });
    assert.equal(durations.lessonSha256, manifest.lessonSha256, 'measured durations belong to this exact narration');
    assert.deepEqual(Object.keys(durations.steps).sort(), lesson.steps.map(step => step.id).sort());
    const timeline = createTimeline(lesson.steps, durations.steps);
    const records = timeline.chapters.map(chapter => manifest.steps[chapter.id]);
    const localFiles = await optionalAssetSet(records.map(record => new URL(record.src, lessonURL)));
    if (!localFiles) t.diagnostic('Provider narration is excluded from the public release; text, manifest and clock remain validated.');
    for (const [index, chapter] of timeline.chapters.entries()) {
      const record = manifest.steps[chapter.id];
      if (localFiles) {
        const bytes = localFiles[index];
        assert.equal(bytes.length, record.bytes, chapter.id);
        assert.equal(sha256(bytes), record.sha256, chapter.id);
      }
      assert.ok(chapter.duration > 0 && chapter.duration < 180);
      assert.equal(locateTime(timeline, chapter.start + .001).chapter.id, chapter.id);
    }
    assert.equal(locateTime(timeline, timeline.total).chapter.id, lesson.steps[0].id, 'last clip returns to the opening');
  });
}
