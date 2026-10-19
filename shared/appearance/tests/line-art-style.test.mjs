import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, HemisphereLight, DirectionalLight } from 'three';
import { DEFAULT_BASE_COLOR } from '../color-accents.mjs';
import { LINE_ART_LINE_STYLE, LINE_ART_FILL, createLineArtFill, addLineArtLighting } from '../line-art-style.mjs';

test('shared line-art preset keeps the documented tokens', () => {
  assert.equal(LINE_ART_FILL.color, DEFAULT_BASE_COLOR);
  assert.equal(LINE_ART_FILL.metalness, 0);
  assert.equal(LINE_ART_LINE_STYLE.color, '#252525');
  assert.ok(Object.isFrozen(LINE_ART_LINE_STYLE) && Object.isFrozen(LINE_ART_FILL));
});

test('each fill is an independent offset material for one occurrence', () => {
  const a = createLineArtFill(), b = createLineArtFill({ roughness: .5 });
  assert.notEqual(a, b);
  assert.equal(a.polygonOffset, true); assert.equal(a.polygonOffsetFactor, 1); assert.equal(a.polygonOffsetUnits, 1);
  assert.equal('#' + a.color.getHexString(), DEFAULT_BASE_COLOR);
  assert.equal(b.roughness, .5); assert.equal(a.roughness, LINE_ART_FILL.roughness);
  a.color.set('#000000'); assert.equal('#' + b.color.getHexString(), DEFAULT_BASE_COLOR);
  a.dispose(); b.dispose();
});

test('lighting adds a soft upper key, a weaker fill and a white background', () => {
  const scene = new Scene(), lights = addLineArtLighting(scene);
  assert.equal(scene.background.getHexString(), 'ffffff');
  assert.deepEqual(lights.map(light => light.constructor), [HemisphereLight, DirectionalLight, DirectionalLight]);
  const [, key, fill] = lights;
  assert.ok(key.position.y > 0 && key.intensity > fill.intensity);
  assert.ok(lights.every(light => light.parent === scene));
  const plain = new Scene(); addLineArtLighting(plain, { background: false }); assert.equal(plain.background, null);
});
