import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SPEC, evaluateLock } from '../../model.mjs';

// Optional developer check. Use a locally installed Playwright or explicit
// runtime path; no machine-specific paths and no automatic browser downloads.
const runtime = process.env.MECHANISM_PLAYWRIGHT_PATH;
const executablePath = process.env.MECHANISM_CHROME_PATH;
const project = fileURLToPath(new URL('../..', import.meta.url));
const cache = resolve(project, 'prototype-3d/.cache/browser');
const shots = resolve(project, 'shots');
const reportPath = resolve(project, 'prototype-3d/validation/browser-check.json');
await Promise.all([mkdir(cache, { recursive: true }), mkdir(shots, { recursive: true }), mkdir(resolve(project, 'prototype-3d/validation'), { recursive: true })]);
const { chromium } = await import(runtime ? pathToFileURL(runtime).href : 'playwright');
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', `--disk-cache-dir=${resolve(cache, 'disk')}`],
  env: { ...process.env, TEMP: cache, TMP: cache } });
const result = { url: process.argv[2] ?? 'http://127.0.0.1:4179/prototype-3d/', browserVersion: browser.version(),
  checks: [], screenshots: [], consoleWarnings: [], resourceErrors: [], pageErrors: [], notes: [
    'Atomic mechanical transitions; no collision, force, or continuous withdrawal simulation is claimed.',
    'Checks cover browser state, exported identity, sampled node poses and specified views; they do not prove all mesh paths are collision-free.',
    'Voice playback checks only accept actual local Doubao audio; this test does not generate or substitute voice.',
  ] };

async function check(name, fn) {
  try { const detail = await fn(); result.checks.push({ name, passed: true, ...(detail === undefined ? {} : { detail }) }); }
  catch (error) { result.checks.push({ name, passed: false, error: error.message }); }
}

async function open(viewport, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, reducedMotion });
  await context.addInitScript(() => {
    window.__testCounters = { requested: 0, callbacks: 0, glDraws: 0 };
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      window.__testCounters.requested++;
      return request(time => { window.__testCounters.callbacks++; callback(time); });
    };
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = getContext.apply(this, args);
      if (gl && String(args[0]).startsWith('webgl') && !gl.__testWrapped) {
        gl.__testWrapped = true;
        for (const method of ['drawArrays', 'drawElements']) {
          const original = gl[method].bind(gl);
          gl[method] = (...params) => { window.__testCounters.glDraws++; return original(...params); };
        }
      }
      return gl;
    };
  });
  const page = await context.newPage();
  page.on('pageerror', error => result.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'warning' || message.type() === 'error') result.consoleWarnings.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) result.resourceErrors.push({ url: response.url(), status: response.status() });
  });
  await page.goto(result.url);
  await page.waitForFunction(() => document.body.dataset.ready === 'true' && window.__mechanismDebug?.metrics().calls > 0);
  return { context, page };
}

async function snapshot(page) { return page.evaluate(() => window.__mechanismDebug.snapshot()); }
async function metrics(page) { return page.evaluate(() => window.__mechanismDebug.metrics()); }
async function shot(page, name, selector = null) {
  const path = resolve(shots, `3d-${name}.png`);
  if (selector) await page.locator(selector).screenshot({ path });
  else await page.screenshot({ path, fullPage: true });
  result.screenshots.push(path);
}
function pureSnapshot(snapshot) { const { allowedActions, uiBlockReason, ...model } = snapshot.model; return model; }
function near(actual, expected, label, tolerance = 2e-8) { assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`); }
async function lesson(page, id) { await page.locator(`[data-lesson="${id}"]`).click(); await page.waitForTimeout(120); }

try {
  await check('exported GLB identity and manifest agree with the shared model configuration', async () => {
    const manifest = JSON.parse(await readFile(resolve(project, 'prototype-3d/assets/asset-manifest.json'), 'utf8'));
    const spec = JSON.parse(await readFile(resolve(project, 'prototype-3d/spec.json'), 'utf8'));
    assert.deepEqual(spec.spec, JSON.parse(JSON.stringify(SPEC)));
    assert.equal(manifest.assetUnits, 'meters');
    near(manifest.plugPivotGltfMeters[1], SPEC.plugAxisZ / 1000, 'plug pivot');
    const bytes = await readFile(resolve(project, 'prototype-3d/assets/lock.glb'));
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    const nodes = gltf.nodes.filter(node => node.extras?.part_id);
    const ids = nodes.map(node => node.extras.part_id);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual([...ids].sort(), manifest.parts.map(part => part.part_id).sort());
    assert.equal((gltf.animations ?? []).length, 0);
    const camBounds = manifest.parts.find(part => part.part_id === 'cam').localBoundsGltfMeters;
    assert.ok(camBounds.min[0] < 0 && camBounds.max[0] < (SPEC.plugStartX + SPEC.pinRadius) / 1000,
      'tail cam must be at the negative-X end, opposite the positive-X key handle');
    for (const part of manifest.parts) {
      const node = nodes.find(node => node.extras.part_id === part.part_id);
      for (const [field, actual] of [['translation', part.actualGltfTranslationMeters], ['rotation', part.actualGltfRotationQuaternion], ['scale', part.actualGltfScale]]) {
        const defaults = field === 'rotation' ? [0, 0, 0, 1] : field === 'scale' ? [1, 1, 1] : [0, 0, 0];
        (node[field] ?? defaults).forEach((value, index) => near(value, actual[index], `${part.part_id}/${field}/${index}`));
      }
    }
    return { parts: ids.length, bytes: bytes.length, animations: 0 };
  });

  const desktop = await open({ width: 1440, height: 1250 });
  const page = desktop.page;
  await shot(page, 'desktop');
  await check('initial page is ready with an empty lock and keyboard-labelled controls', async () => {
    const current = await snapshot(page);
    assert.deepEqual(pureSnapshot(current), evaluateLock(current.state.mechanical));
    assert.equal(current.model.status, 'empty');
    assert.equal(await page.locator('#insertion').getAttribute('type'), 'range');
    assert.ok(await page.getByLabel('插入钥匙', { exact: false }).count());
    return { ...((({ partCount, triangles, calls }) => ({ partCount, triangles, calls }))(await metrics(page))) };
  });

  await check('real key buttons and insertion button block wrong and blank keys', async () => {
    for (const keyId of ['wrong', 'blank']) {
      await page.locator(`[data-key="${keyId}"]`).click();
      await page.locator('#insert-key').click();
      const current = await snapshot(page);
      assert.equal(current.model.keyId, keyId);
      assert.equal(current.model.insertion, 1);
      assert.equal(current.model.canTurn, false);
      assert.equal(current.model.angle, 0);
      assert.equal(await page.locator('#angle').isDisabled(), true);
    }
  });
  await lesson(page, 'wrong'); await shot(page, 'wrong', '.workspace');

  await check('matching key rotates by keyboard and withdrawal resets before empty state', async () => {
    await page.locator('[data-key="correct"]').click();
    await page.locator('#insert-key').click();
    assert.equal((await snapshot(page)).model.canTurn, true);
    await page.locator('#angle').focus(); await page.locator('#angle').press('End');
    assert.equal((await snapshot(page)).model.angle, 90);
    await page.locator('#insert-key').click();
    const current = await snapshot(page);
    assert.equal(current.model.insertion, 0);
    assert.equal(current.model.angle, 0);
    assert.equal(current.model.status, 'empty');
  });

  await check('all five tutorial buttons select complete mechanical targets', async () => {
    const expected = { part: 'empty', wrong: 'blocked', align: 'ready', turn: 'open', reset: 'empty' };
    for (const [id, status] of Object.entries(expected)) {
      await lesson(page, id);
      const current = await snapshot(page);
      assert.equal(current.state.lesson, id);
      assert.equal(current.model.status, status);
      assert.equal(current.state.view.explode, 0);
      assert.deepEqual(pureSnapshot(current), evaluateLock(current.state.mechanical));
    }
  });

  await lesson(page, 'align');
  await check('five camera presets and cutaway preserve the mechanical result and node poses', async () => {
    const before = await snapshot(page); const beforeNodes = (await metrics(page)).nodes;
    for (const camera of ['overview', 'section', 'end', 'detail', 'rear']) {
      await page.locator(`[data-camera="${camera}"]`).click();
      await page.waitForTimeout(100);
      const current = await snapshot(page);
      assert.equal(current.state.view.camera, camera);
      assert.deepEqual(current.model, before.model);
      assert.deepEqual((await metrics(page)).nodes, beforeNodes);
      if (['end', 'rear'].includes(camera)) assert.equal(await page.locator('.pin-tag:visible').count(), 0);
      await shot(page, `camera-${camera}`, '.stage-panel');
    }
    await page.locator('#cutaway').uncheck();
    assert.deepEqual((await snapshot(page)).model, before.model);
    assert.equal((await metrics(page)).nodes.find(node => node.id === 'shell-front').visible, true);
    await page.locator('#cutaway').check();
  });

  await check('node heights and spring scale match the model in the aligned pose', async () => {
    await lesson(page, 'align');
    const current = await snapshot(page); const nodes = (await metrics(page)).nodes;
    current.model.pins.forEach((pin, index) => {
      const lower = nodes.find(node => node.id === `lower-${index + 1}`);
      const driver = nodes.find(node => node.id === `driver-${index + 1}`);
      const spring = nodes.find(node => node.id === `spring-${index + 1}`);
      near(lower.position[0], pin.x / 1000, `lower-${index + 1}/x`);
      near(lower.position[1], pin.tipZ / 1000, `lower-${index + 1}/height`);
      near(driver.position[1], pin.jointZ / 1000, `driver-${index + 1}/height`);
      const bottom = (pin.jointZ + SPEC.driverLength) / 1000;
      near(spring.position[1], bottom, `spring-${index + 1}/bottom`);
      near(spring.scale[1], SPEC.springTopZ / 1000 - bottom, `spring-${index + 1}/scaleY`);
    });
  });

  await check('turned lock rotates plug, key, lower pins and cam while shell, drivers and springs remain fixed', async () => {
    await lesson(page, 'align'); const before = (await metrics(page)).nodes;
    await lesson(page, 'turn'); const after = (await metrics(page)).nodes;
    for (const node of after) {
      if (/^(shell-|driver-|spring-)/.test(node.id)) {
        const original = before.find(item => item.id === node.id);
        assert.deepEqual(node.position, original.position);
        assert.deepEqual(node.quaternion, original.quaternion);
      }
      if (/^(plug-|key-|lower-)/.test(node.id) || node.id === 'cam') {
        near(node.quaternion[0], Math.SQRT1_2, `${node.id}/qx`);
        near(node.quaternion[3], Math.SQRT1_2, `${node.id}/qw`);
      }
    }
    const current = await snapshot(page);
    current.model.pins.forEach((pin, index) => {
      const lower = after.find(node => node.id === `lower-${index + 1}`);
      near(lower.position[0], pin.x / 1000, `turned lower-${index + 1}/x`);
      near(lower.position[1], SPEC.plugAxisZ / 1000, `turned lower-${index + 1}/axis height`);
      near(lower.position[2], (pin.tipZ - SPEC.plugAxisZ) / 1000, `turned lower-${index + 1}/depth`);
    });
    await shot(page, 'turn', '.workspace');
  });

  await check('exploded observation locks actual UI controls but retains model permission and resets through tutorial', async () => {
    await lesson(page, 'align'); const before = await snapshot(page);
    await page.locator('#explode').focus(); await page.locator('#explode').press('End');
    const current = await snapshot(page);
    assert.equal(current.state.view.explode, 1);
    assert.deepEqual(pureSnapshot(current), pureSnapshot(before));
    assert.deepEqual(current.model.allowedActions, before.model.allowedActions);
    for (const selector of ['#angle', '#insertion', '#insert-key', '[data-key="wrong"]']) assert.equal(await page.locator(selector).isDisabled(), true);
    assert.ok(current.model.uiBlockReason);
    await shot(page, 'exploded', '.workspace');
    await lesson(page, 'wrong');
    assert.equal((await snapshot(page)).state.view.explode, 0);
    assert.equal((await snapshot(page)).model.canTurn, false);
  });

  await check('real canvas clicks select a part without changing the mechanical state', async () => {
    await lesson(page, 'align');
    await page.locator('[data-camera="overview"]').click();
    const before = (await snapshot(page)).model;
    const box = await page.locator('canvas').boundingBox();
    let selected = null;
    for (const [x, y] of [[.4, .5], [.45, .6], [.5, .5], [.6, .65], [.3, .65]]) {
      await page.locator('canvas').click({ position: { x: box.width * x, y: box.height * y } });
      const current = await snapshot(page);
      assert.deepEqual(current.model, before);
      if (current.state.view.selected) { selected = current.state.view.selected; break; }
    }
    assert.ok(selected, 'none of five visible-scene click samples selected a part');
    return { selected, label: await page.locator('#part-name').textContent() };
  });

  await check('idle render scheduling settles after reset', async () => {
    await page.locator('#reset').click(); await page.waitForTimeout(400);
    const before = await page.evaluate(() => ({ ...window.__testCounters }));
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({ ...window.__testCounters }));
    assert.equal(after.callbacks - before.callbacks, 0);
    assert.equal(after.glDraws - before.glDraws, 0);
    return { callbacks: after.callbacks - before.callbacks, glDraws: after.glDraws - before.glDraws };
  });

  await check('Doubao voice UI accurately reflects existing local audio instead of synthesizing alternatives', async () => {
    const label = await page.locator('#voice-status').textContent();
    assert.match(label, /豆包/);
    let manifest = null;
    try { manifest = JSON.parse(await readFile(resolve(project, 'prototype-3d/voice/audio-manifest.json'), 'utf8')); } catch {}
    if (manifest?.complete && manifest.provider === 'doubao') {
      await lesson(page, 'part');
      assert.equal(await page.locator('#narrate').isDisabled(), false);
      for (const id of ['part', 'wrong', 'align', 'turn', 'reset']) {
        assert.equal(manifest.steps[id].src, `assets/audio/${id}.mp3`);
        assert.ok((await readFile(resolve(project, 'prototype-3d', manifest.steps[id].src))).length > 0);
      }
      return { state: 'local Doubao files present', label };
    }
    assert.match(label, /尚未生成|等待/);
    assert.equal(await page.locator('#narrate').isDisabled(), true);
    return { state: 'not generated; playback disabled', label };
  });

  await check('all five real Doubao MP3 files load finite duration metadata in the browser', async () => {
    const manifest = JSON.parse(await readFile(resolve(project, 'prototype-3d/voice/audio-manifest.json'), 'utf8'));
    assert.equal(manifest.provider, 'doubao'); assert.equal(manifest.complete, true);
    const metadata = await page.evaluate(async () => {
      const manifest = await (await fetch('./voice/audio-manifest.json')).json();
      const output = [];
      for (const id of ['part', 'wrong', 'align', 'turn', 'reset']) {
        const audio = new Audio(); audio.preload = 'auto';
        const loaded = new Promise((done, reject) => {
          const timeout = setTimeout(() => reject(new Error(`metadata timeout: ${id}`)), 8000);
          const metadataReady = () => {
            if (Number.isFinite(audio.duration) && audio.duration > 0) { clearTimeout(timeout); done(); }
          };
          for (const event of ['loadedmetadata', 'durationchange', 'canplaythrough']) audio.addEventListener(event, metadataReady);
          audio.addEventListener('error', () => { clearTimeout(timeout); reject(new Error(`metadata error: ${id}`)); }, { once: true });
        });
        audio.src = manifest.steps[id].src; audio.load(); await loaded;
        output.push({ id, duration: audio.duration, readyState: audio.readyState });
        audio.removeAttribute('src'); audio.load();
      }
      return output;
    });
    metadata.forEach(item => assert.ok(Number.isFinite(item.duration) && item.duration > 0, `${item.id}: invalid duration`));
    return metadata;
  });

  await check('actual user clicks play, pause, resume and stop Doubao narration when the tutorial changes', async () => {
    await lesson(page, 'part');
    await page.locator('#narrate').click();
    await page.waitForFunction(() => !document.querySelector('#voice').paused && document.querySelector('#voice').currentTime > 0, null, { timeout: 6000 });
    assert.match(await page.locator('#voice').getAttribute('src'), /part\.mp3$/);
    await page.locator('#narrate').click();
    const pausedAt = await page.locator('#voice').evaluate(audio => ({ paused: audio.paused, currentTime: audio.currentTime }));
    assert.equal(pausedAt.paused, true);
    await page.waitForTimeout(150);
    near(await page.locator('#voice').evaluate(audio => audio.currentTime), pausedAt.currentTime, 'paused voice time', 0.03);
    await page.locator('#narrate').click();
    await page.waitForFunction(time => !document.querySelector('#voice').paused && document.querySelector('#voice').currentTime > time, pausedAt.currentTime);
    await lesson(page, 'wrong');
    assert.equal(await page.locator('#voice').evaluate(audio => audio.paused), true);
    assert.equal(await page.locator('#voice').getAttribute('src'), null);
    await page.locator('#narrate').click();
    await page.waitForFunction(() => !document.querySelector('#voice').paused && document.querySelector('#voice').currentTime > 0);
    assert.match(await page.locator('#voice').getAttribute('src'), /wrong\.mp3$/);
    await page.locator('[data-key="correct"]').click();
    assert.equal(await page.locator('#voice').evaluate(audio => audio.paused), true);
    assert.equal(await page.locator('#voice').getAttribute('src'), null);
  });

  const mobile = await open({ width: 390, height: 844 });
  await check('390px layout has no horizontal overflow and supports the matching-key core workflow', async () => {
    assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await mobile.page.locator('#insert-key').click();
    await mobile.page.locator('#angle').focus(); await mobile.page.locator('#angle').press('End');
    assert.equal((await snapshot(mobile.page)).model.angle, 90);
    await mobile.page.locator('#insert-key').click();
    assert.equal((await snapshot(mobile.page)).model.angle, 0);
    await lesson(mobile.page, 'align');
    await mobile.page.locator('[data-camera="section"]').click();
    await shot(mobile.page, 'mobile');
  });
  await check('render callbacks and WebGL drawing stop when the viewport is offscreen', async () => {
    await mobile.page.locator('footer').scrollIntoViewIfNeeded();
    await mobile.page.waitForTimeout(300);
    assert.equal(await mobile.page.locator('#viewport').evaluate(el => el.getBoundingClientRect().bottom <= 0), true);
    const before = await mobile.page.evaluate(() => ({ ...window.__testCounters }));
    await mobile.page.waitForTimeout(500);
    const after = await mobile.page.evaluate(() => ({ ...window.__testCounters }));
    assert.equal(after.callbacks - before.callbacks, 0);
    assert.equal(after.glDraws - before.glDraws, 0);
    return { callbacks: after.callbacks - before.callbacks, glDraws: after.glDraws - before.glDraws };
  });

  const reduced = await open({ width: 1440, height: 1250 }, 'reduce');
  await check('reduced-motion core flow remains complete and renders settle while idle', async () => {
    await lesson(reduced.page, 'wrong'); assert.equal((await snapshot(reduced.page)).model.canTurn, false);
    await lesson(reduced.page, 'align'); assert.equal((await snapshot(reduced.page)).model.canTurn, true);
    await lesson(reduced.page, 'turn'); assert.equal((await snapshot(reduced.page)).model.angle, 90);
    await reduced.page.locator('#reset').click(); await reduced.page.waitForTimeout(300);
    const before = await reduced.page.evaluate(() => ({ ...window.__testCounters }));
    await reduced.page.waitForTimeout(400);
    const after = await reduced.page.evaluate(() => ({ ...window.__testCounters }));
    assert.equal(after.callbacks - before.callbacks, 0);
    assert.equal(after.glDraws - before.glDraws, 0);
    await shot(reduced.page, 'reduced-motion');
  });

  await check('browser reports no uncaught page errors', () => assert.deepEqual(result.pageErrors, []));
} catch (error) {
  result.checks.push({ name: 'browser harness completes', passed: false, error: error.stack });
} finally {
  await browser.close();
  result.passed = result.checks.every(item => item.passed);
  await writeFile(reportPath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, checks: result.checks, warnings: result.consoleWarnings, report: reportPath }, null, 2));
  process.exitCode = result.passed ? 0 : 1;
}
