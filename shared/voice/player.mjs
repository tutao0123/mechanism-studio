import { TtsError } from './errors.mjs';
import { LESSON_HASH_POLICY, validateLesson, lessonSha256 } from './lesson.mjs';
import { PROVIDER_ID, RESOURCE_ID } from './provider.mjs';
import { voiceLocale, voiceMessage } from './messages.mjs';

const MAX_AUDIO_BYTES = 32 * 1024 * 1024;
export function audioURL(src, baseURL, locale = 'zh-CN') {
  if (typeof src !== 'string' || !/^[A-Za-z0-9._/-]+\.mp3$/.test(src)
      || src.startsWith('/') || src.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new TtsError(voiceMessage(locale, 'unsafePath'));
  }
  const base = new URL(baseURL), url = new URL(src, base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new TtsError(voiceMessage(locale, 'unsafePath'));
  return url;
}

export async function validateManifest(manifest, inputLesson, { baseURL, cryptoImpl = globalThis.crypto, locale = inputLesson?.language } = {}) {
  const lesson = validateLesson(inputLesson), ids = lesson.steps.map(step => step.id), message = key => voiceMessage(locale, key);
  if (manifest?.schemaVersion !== 1 || manifest.provider !== PROVIDER_ID || manifest.complete !== true
      || manifest.format !== 'mp3' || manifest.resourceId !== RESOURCE_ID
      || (manifest.lessonHashPolicy != null && manifest.lessonHashPolicy !== LESSON_HASH_POLICY)
      || !manifest.steps || Array.isArray(manifest.steps) || Object.keys(manifest.steps).length !== ids.length
      || Object.keys(manifest.steps).some(id => !ids.includes(id))) throw new TtsError(message('manifestInvalid'));
  let hash;
  try { hash = await lessonSha256(lesson, cryptoImpl); } catch { throw new TtsError(message('manifestUnreadable')); }
  if (manifest.lessonSha256 !== hash) throw new TtsError(message('hashChanged'));
  let total = 0;
  for (const id of ids) {
    const record = manifest.steps[id];
    if (!Number.isSafeInteger(record?.bytes) || record.bytes < 1 || record.bytes > MAX_AUDIO_BYTES
        || !/^[a-f0-9]{64}$/.test(record.sha256)) throw new TtsError(message('recordInvalid'));
    total += record.bytes; audioURL(record.src, baseURL, locale);
  }
  if (total > 128 * 1024 * 1024) throw new TtsError(message('tooLarge'));
  return manifest;
}

/** Owns verified local narration. The caller owns mechanical and chapter timing. */
export function createLessonPlayer({
  lessonURL, manifestURL, baseURL = new URL('./', lessonURL), fetchImpl = globalThis.fetch,
  audioElement, audioFactory = () => new Audio(), cryptoImpl = globalThis.crypto,
  urlImpl = globalThis.URL, locale, onStatus = () => {}, onPlayback = () => {},
} = {}) {
  const base = new URL(baseURL).href;
  let activeLocale = voiceLocale(locale), lesson = null, manifest = null, status = 'loading';
  const text = key => voiceMessage(activeLocale, key);
  let message = text('checking'), audio = audioElement ?? null, stepId = null, sequence = 0, epoch = 0;
  let phase = 'stopped', audioBound = false, muted = Boolean(audioElement?.muted);
  const cached = new Map(), pending = new Map();
  const snapshot = () => ({ status, message, locale: activeLocale, lesson, manifest, stepId, phase,
    playing: !!audio && !audio.paused, paused: !!audio && audio.paused && !!stepId,
    duration: audio && Number.isFinite(audio.duration) ? audio.duration : null,
    currentTime: audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
    muted: audio ? Boolean(audio.muted) : muted, ended: phase === 'ended',
    readySteps: manifest ? Object.keys(manifest.steps).length : 0, preloadedSteps: cached.size });
  const statusChanged = () => onStatus(snapshot());
  const playbackChanged = () => onPlayback(snapshot());
  const clearCache = () => { for (const record of cached.values()) urlImpl.revokeObjectURL(record.url); cached.clear(); pending.clear(); };
  const stop = () => {
    sequence += 1;
    if (audio) { audio.pause(); audio.currentTime = 0; audio.removeAttribute?.('src'); }
    stepId = null; phase = 'stopped'; playbackChanged();
  };
  const onEnded = () => { stop(); phase = 'ended'; playbackChanged(); };
  const onError = () => { stop(); phase = 'error'; message = text('audioLoad'); playbackChanged(); statusChanged(); };
  const events = { ended: onEnded, error: onError, timeupdate: playbackChanged, seeking: playbackChanged, seeked: playbackChanged, loadedmetadata: playbackChanged };
  const bindAudio = () => {
    if (!audio) audio = audioFactory(); audio.muted = muted;
    if (audioBound) return; audioBound = true;
    for (const [event, handler] of Object.entries(events)) audio.addEventListener(event, handler);
  };
  const loadJSON = async url => {
    const response = await fetchImpl(url, { credentials: 'same-origin', redirect: 'error' });
    if (!response.ok) throw new TtsError(text('localMissing'));
    return response.json();
  };
  const load = async () => {
    stop(); epoch += 1; clearCache(); const current = epoch;
    lesson = null; manifest = null; activeLocale = voiceLocale(locale); status = 'loading'; message = text('checking'); statusChanged();
    try {
      const input = await loadJSON(new URL(lessonURL, base));
      if (current !== epoch) return { lesson: null, manifest: null, status: 'cancelled', message: text('cancelled') };
      activeLocale = voiceLocale(locale ?? input?.language); validateLesson(input); lesson = input;
    } catch {
      if (current !== epoch) return { lesson: null, manifest: null, status: 'cancelled', message: text('cancelled') };
      status = 'error'; message = text('lessonFailed'); statusChanged(); throw new TtsError(message);
    }
    try {
      const candidate = await loadJSON(new URL(manifestURL, base));
      const verified = await validateManifest(candidate, lesson, { baseURL: base, cryptoImpl, locale: activeLocale });
      if (current !== epoch) return { lesson: null, manifest: null, status: 'cancelled', message: text('cancelled') };
      manifest = verified; status = 'ready'; message = text('ready');
    } catch (error) {
      if (current !== epoch) return { lesson: null, manifest: null, status: 'cancelled', message: text('cancelled') };
      manifest = null; status = 'unavailable'; message = error instanceof TtsError ? error.message : text('manifestUnreadable');
    }
    statusChanged(); return { lesson, manifest, status, message };
  };
  const preloadStep = async id => {
    if (!manifest || !lesson?.steps.some(step => step.id === id)) throw new TtsError(text('notReady'));
    if (cached.has(id)) return cached.get(id);
    if (pending.has(id)) return pending.get(id);
    const current = epoch, record = manifest.steps[id];
    let task;
    task = (async () => {
      const response = await fetchImpl(audioURL(record.src, base, activeLocale), { credentials: 'same-origin', redirect: 'error' });
      if (!response.ok) throw new TtsError(text('audioRead'));
      const statedLength = Number(response.headers?.get?.('content-length'));
      if (statedLength && statedLength !== record.bytes) throw new TtsError(text('sizeMismatch'));
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== record.bytes) throw new TtsError(text('sizeMismatch'));
      const digest = await cryptoImpl.subtle.digest('SHA-256', bytes);
      const sha = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      if (sha !== record.sha256) throw new TtsError(text('digestMismatch'));
      if (current !== epoch) throw new TtsError(text('cancelled'));
      const result = Object.freeze({ id, url: urlImpl.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })), bytes: record.bytes, sha256: sha });
      cached.set(id, result); return result;
    })().catch(error => { throw error instanceof TtsError ? error : new TtsError(text('audioRead')); }).finally(() => { if (pending.get(id) === task) pending.delete(id); });
    pending.set(id, task); return task;
  };
  const preloadAll = async () => {
    if (!manifest || !lesson) throw new TtsError(text('notReady'));
    const records = {}, current = epoch, ids = lesson.steps.map(step => step.id);
    for (const id of ids) {
      if (current !== epoch) throw new TtsError(text('cancelled'));
      records[id] = await preloadStep(id);
      if (current !== epoch) throw new TtsError(text('cancelled'));
    }
    return records;
  };
  const pause = () => { if (audio && stepId) { audio.pause(); phase = 'paused'; playbackChanged(); } };
  const seek = seconds => {
    if (!Number.isFinite(seconds) || seconds < 0) throw new TtsError(text('invalidTime'));
    if (!audio || !stepId || !audio.getAttribute?.('src')) throw new TtsError(text('noAudio'));
    audio.currentTime = Number.isFinite(audio.duration) ? Math.min(seconds, audio.duration) : seconds;
    playbackChanged(); return audio.currentTime;
  };
  const setMuted = value => { if (typeof value !== 'boolean') throw new TypeError('muted must be boolean'); muted = value; if (audio) audio.muted = value; playbackChanged(); };
  const playStep = async (id, { startTime } = {}) => {
    if (!manifest || !lesson?.steps.some(step => step.id === id)) throw new TtsError(text('notReady'));
    if (startTime !== undefined && (!Number.isFinite(startTime) || startTime < 0)) throw new TtsError(text('invalidTime'));
    if (stepId === id && audio?.getAttribute?.('src')) {
      const current = sequence;
      if (startTime !== undefined) seek(startTime);
      try { await audio.play(); if (current !== sequence) return false; phase = 'playing'; playbackChanged(); return true; }
      catch { if (current !== sequence) return false; message = text('retryPlay'); statusChanged(); return false; }
    }
    stop(); const current = sequence; phase = 'loading'; playbackChanged();
    try {
      const record = await preloadStep(id);
      if (current !== sequence) return false;
      bindAudio(); audio.src = record.url; stepId = id;
      if (startTime !== undefined) seek(startTime);
      await audio.play(); if (current !== sequence) return false;
      phase = 'playing'; playbackChanged(); return true;
    } catch (error) {
      if (current !== sequence) return false;
      stop(); phase = 'error'; message = error instanceof TtsError ? error.message : text('playFailed'); playbackChanged(); statusChanged(); return false;
    }
  };
  const toggleStep = async id => { if (stepId === id && audio && !audio.paused) { pause(); return false; } return playStep(id); };
  const dispose = () => {
    stop(); epoch += 1; clearCache();
    if (audioBound) { for (const [event, handler] of Object.entries(events)) audio.removeEventListener(event, handler); audioBound = false; }
  };
  return { load, preloadStep, preloadAll, stop, pause, seek, setMuted, playStep, toggleStep, snapshot, dispose };
}
