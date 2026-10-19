import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, HemisphereLight, DirectionalLight, MeshStandardMaterial, MeshBasicMaterial, FrontSide } from 'three';
import { STYLES, resolveStyle, applyStyleScene, createStyleFill } from '../styles.mjs';
import { DEFAULT_BASE_COLOR, DEFAULT_ACCENT_COLOR } from '../color-accents.mjs';
import { specLabel, labelLines, labelPlainText } from '../../viewer/spec-label.mjs';

test('atlas reproduces the study shell’s original literals exactly', () => {
  // These were hard-coded in shared/study/study.mjs before styles existed;
  // existing study pages render byte-identical frames with them.
  const atlas = resolveStyle();
  assert.equal(atlas, STYLES.atlas);
  assert.equal(atlas.background, '#ffffff'); assert.equal(atlas.bodyClass, null);
  assert.deepEqual(atlas.lines, { enabled: true, color: '#353532', detailColor: '#93938e' });
  assert.deepEqual(atlas.fill, { material: 'standard', color: '#f1f1ed', metalness: 0, roughness: .88 });
  assert.deepEqual(atlas.accents, { base: DEFAULT_BASE_COLOR, accent: DEFAULT_ACCENT_COLOR });
  const scene = new Scene(); applyStyleScene(scene, atlas);
  assert.equal(scene.background.getHexString(), 'ffffff');
  assert.deepEqual(scene.children.map(light => light.constructor), [HemisphereLight, DirectionalLight, DirectionalLight]);
  const [hemisphere, key, fill] = scene.children;
  assert.deepEqual([hemisphere.color.getHexString(), hemisphere.groundColor.getHexString(), hemisphere.intensity], ['ffffff', 'd9d9d5', 2.4]);
  assert.deepEqual([key.intensity, ...key.position.toArray()], [2.2, -.5, 1.5, 1.2]);
  assert.deepEqual([fill.intensity, ...fill.position.toArray()], [.65, .8, .35, -.7]);
  const material = createStyleFill(atlas);
  assert.ok(material instanceof MeshStandardMaterial);
  assert.deepEqual([material.color.getHexString(), material.metalness, material.roughness, material.side], ['f1f1ed', 0, .88, FrontSide]);
  assert.notEqual(createStyleFill(atlas), material, 'a fresh material per mesh');
});

test('blueprint is unlit sheet-coloured fill with light lines and one stamp colour', () => {
  const blueprint = resolveStyle('blueprint'), scene = new Scene();
  applyStyleScene(scene, blueprint);
  assert.equal(scene.children.length, 0, 'no lights: flat drawing, not a render');
  assert.equal(scene.background.getHexString(), blueprint.fill.color.slice(1));
  const material = createStyleFill(blueprint);
  assert.ok(material instanceof MeshBasicMaterial);
  assert.equal(material.color.getHexString(), blueprint.background.slice(1));
  assert.equal(blueprint.bodyClass, 'style-blueprint');
  assert.ok(blueprint.drafting.stamp && !STYLES.atlas.drafting.stamp);
});

test('the registry refuses unknown or inconsistent styles', () => {
  assert.throws(() => resolveStyle('neon'), /Unknown study style/);
  assert.throws(() => resolveStyle({ ...STYLES.atlas, accents: { base: '#000000', accent: '#ffffff' } }), /accent base must equal the fill/);
  assert.throws(() => createStyleFill({ ...STYLES.atlas, fill: { ...STYLES.atlas.fill, material: 'toon' } }), /unknown fill material/);
});

test('spec labels: index, name and one spec line; plain strings stay plain', () => {
  const label = specLabel({ index: 7, name: '1st gear', spec: '37 T · 3.70 : 1' });
  assert.deepEqual(label, { index: '07', name: '1st gear', spec: '37 T · 3.70 : 1' });
  assert.deepEqual(labelLines(label), [[['index', '07'], ['name', ' 1st gear']], [['spec', '37 T · 3.70 : 1']]]);
  assert.equal(labelPlainText(label), '07 1st gear — 37 T · 3.70 : 1');
  assert.equal(labelLines('Shift lever'), null);
  assert.equal(labelPlainText('Shift lever'), 'Shift lever');
  assert.deepEqual(labelLines(specLabel({ index: 3, name: 'Hub' })), [[['index', '03'], ['name', ' Hub']]]);
  assert.throws(() => specLabel({ index: 0, name: 'x' }), RangeError);
  assert.throws(() => specLabel({ index: 1, name: ' ' }), TypeError);
});
