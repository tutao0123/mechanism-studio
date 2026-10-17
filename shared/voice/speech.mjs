/** Node-only optional speech adapter. No environment/config discovery or browser API. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { validateOutputPath } from './generator.mjs';

export class SpeechError extends Error {
  constructor(code, message) { super(message); this.name = 'SpeechError'; this.code = code; }
}
const fail = (code, message) => { throw new SpeechError(code, message); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
// audio/L16 is network-byte-order PCM, not the s16le format supported here.
const FORMATS = Object.freeze({ mp3: ['audio/mpeg', 'audio/mp3'], wav: ['audio/wav', 'audio/x-wav', 'audio/wave'], pcm: ['audio/pcm', 'application/octet-stream'] });
const PRESETS = Object.freeze({ openrouter: 'https://openrouter.ai/api/v1/audio/speech', openai: 'https://api.openai.com/v1/audio/speech' });
const identifier = (value, max = 256) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\r\n\u0000-\u001f]/.test(value);
const placeholder = value => /^(?:replace[-_]with(?:[-_]|$)|your[-_]|<)/i.test(value.trim());

/** Custom credentials may only go to an independently caller-authorized HTTPS origin. */
export function normalizeSpeechConfig(input, { allowedOrigins = [] } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('CONFIG', 'Speech configuration must be an object.');
  const provider = input.provider ?? 'openrouter';
  if (!['openrouter', 'openai', 'custom'].includes(provider)) fail('CONFIG', 'Unsupported speech provider preset.');
  let endpoint;
  try { endpoint = new URL(input.endpoint ?? PRESETS[provider]); } catch { fail('ENDPOINT', 'A valid speech endpoint is required.'); }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) fail('ENDPOINT', 'Speech endpoints require HTTPS without credentials, query or fragment.');
  if (provider !== 'custom' && endpoint.href !== PRESETS[provider]) fail('ENDPOINT', 'Preset endpoints cannot be overridden; select custom and authorize its origin.');
  if (provider === 'custom' && !allowedOrigins.includes(endpoint.origin)) fail('ORIGIN', 'Custom speech endpoint origin requires explicit caller authorization.');
  const format = input.format ?? 'mp3';
  if (!Object.hasOwn(FORMATS, format) || (provider === 'openrouter' && !['mp3', 'pcm'].includes(format))) fail('FORMAT', 'Unsupported speech output format for this provider.');
  if (!identifier(input.model) || !identifier(input.voice) || placeholder(input.model) || placeholder(input.voice)) fail('CONFIG', 'Replace configuration placeholders with a model and a voice supported by that model.');
  const responseMode = input.responseMode ?? 'binary';
  if (!['binary', 'json-base64'].includes(responseMode) || (provider !== 'custom' && responseMode !== 'binary')) fail('RESPONSE', 'Base64 JSON responses require an explicit custom adapter configuration.');
  const base64Field = input.base64Field ?? 'audio_base64';
  if (!/^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*$/.test(base64Field) || base64Field.split('.').some(key => ['__proto__', 'constructor', 'prototype'].includes(key))) fail('CONFIG', 'Invalid base64 audio field path.');
  const timeoutMs = input.timeoutMs ?? 120000, maxBytes = input.maxBytes ?? 32 * 1024 * 1024;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300000 || !Number.isInteger(maxBytes) || maxBytes < 16 || maxBytes > 32 * 1024 * 1024) fail('CONFIG', 'Speech timeout or byte limit is outside the supported range.');
  if (input.speed != null && (typeof input.speed !== 'number' || !Number.isFinite(input.speed) || input.speed < 0.25 || input.speed > 4)) fail('CONFIG', 'Speech speed must be a finite supported multiplier.');
  if (input.instructions != null && !identifier(input.instructions, 2000)) fail('CONFIG', 'Speech instructions must be a short single-line string.');
  if (format === 'pcm' && (!Number.isInteger(input.sampleRate) || input.sampleRate < 8000 || input.sampleRate > 192000 || ![1, 2].includes(input.channels) || input.encoding !== 's16le')) fail('CONFIG', 'Raw PCM needs the model-documented sampleRate, channels and explicit s16le encoding; it is not a playable MP3.');
  return Object.freeze({ provider, endpoint: endpoint.href, origin: endpoint.origin, model: input.model, voice: input.voice, format, responseMode, base64Field, timeoutMs, maxBytes, ...(input.speed != null ? { speed: input.speed } : {}), ...(input.instructions != null ? { instructions: input.instructions } : {}), ...(format === 'pcm' ? { sampleRate: input.sampleRate, channels: input.channels, encoding: 's16le' } : {}) });
}

async function cancel(body) { try { await body?.cancel?.(); } catch { /* response body is deliberately not logged */ } }
async function readBounded(body, limit) {
  if (!body || typeof body.getReader !== 'function') fail('EMPTY', 'Speech response has no readable audio body.');
  const reader = body.getReader(), chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) fail('LIMIT', 'Speech response exceeds the configured byte limit.');
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* preserve redacted error */ }
    if (error instanceof SpeechError) throw error;
    fail('STREAM', 'Speech response was interrupted; no audio was published.');
  } finally { reader.releaseLock(); }
  if (!size) fail('EMPTY', 'Speech response contains no audio.');
  return Buffer.concat(chunks, size);
}

function audioBytesValid(bytes, format) {
  if (format === 'mp3') return bytes.length >= 4 && (bytes.subarray(0, 3).toString() === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
  if (format === 'wav') return bytes.length >= 44 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WAVE';
  // A complete PCM16 frame is required; sample rate/channels are caller-declared.
  return bytes.length >= 2 && bytes.length % 2 === 0;
}

/** Explicit invocation is the API boundary. Transport chunks are buffered, never SSE. */
export async function requestSpeech(text, input, { apiKey, allowedOrigins = [], fetchImpl = globalThis.fetch, signal } = {}) {
  const config = normalizeSpeechConfig(input, { allowedOrigins });
  if (!identifier(apiKey, 4096) || /^(?:your[_-]|replace[_-]|<)/i.test(apiKey)) fail('AUTH', 'A valid caller-supplied speech API key is required.');
  if (typeof text !== 'string' || !text.trim() || Buffer.byteLength(text) > 16000) fail('TEXT', 'Speech input must contain 1–16000 UTF-8 bytes.');
  const body = { model: config.model, input: text.trim(), voice: config.voice, response_format: config.format, ...(config.speed != null ? { speed: config.speed } : {}), ...(config.instructions != null ? { instructions: config.instructions } : {}) };
  let response;
  try {
    response = await fetchImpl(config.endpoint, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(config.timeoutMs)]) : AbortSignal.timeout(config.timeoutMs) });
  } catch { fail('NETWORK', 'Speech request failed or timed out; no audio was published.'); }
  if (!response.ok) {
    await cancel(response.body);
    fail('HTTP', `Speech request failed (HTTP ${Number.isInteger(response.status) ? response.status : 'error'}); provider body omitted.`);
  }
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const length = Number(response.headers.get('content-length'));
  const wireLimit = config.responseMode === 'binary' ? config.maxBytes : Math.ceil(config.maxBytes * 4 / 3) + 8192;
  if (length > wireLimit) { await cancel(response.body); fail('LIMIT', 'Speech response exceeds the configured byte limit.'); }
  if (config.responseMode === 'binary' && !FORMATS[config.format].map(x => x.toLowerCase()).includes(contentType)) { await cancel(response.body); fail('TYPE', 'Speech response is not the configured audio type; JSON/SSE/HTML was not saved as audio.'); }
  if (config.responseMode === 'json-base64' && contentType !== 'application/json') { await cancel(response.body); fail('TYPE', 'Expected an explicitly configured base64 JSON speech response.'); }
  let bytes = await readBounded(response.body, wireLimit);
  if (config.responseMode === 'json-base64') {
    let value;
    try { value = JSON.parse(bytes.toString('utf8')); } catch { fail('BASE64', 'Speech JSON response could not be decoded.'); }
    for (const key of config.base64Field.split('.')) value = value && Object.hasOwn(value, key) ? value[key] : undefined;
    if (typeof value !== 'string' || !value || value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) fail('BASE64', 'Speech response is missing canonical base64 audio.');
    bytes = Buffer.from(value, 'base64');
  }
  if (bytes.length > config.maxBytes) fail('LIMIT', 'Decoded speech audio exceeds the configured byte limit.');
  if (!audioBytesValid(bytes, config.format) || (config.format === 'pcm' && bytes.length % (config.channels * 2) !== 0)) fail('AUDIO', 'Speech payload has no matching audio header or complete PCM frame.');
  return { bytes, metadata: { schemaVersion: 1, provider: config.provider, endpointOrigin: config.origin, model: config.model, voice: config.voice, format: config.format, inputSha256: hash(text.trim()), sha256: hash(bytes), bytes: bytes.length, ...(config.speed != null ? { speed: config.speed } : {}), ...(config.format === 'pcm' ? { sampleRate: config.sampleRate, channels: config.channels, encoding: config.encoding } : {}) } };
}

/** Content-addressed, example-local output. No existing lesson/manifests are replaced. */
export async function synthesizeSpeech(text, input, { rootDir, outputDir, ...requestOptions } = {}) {
  if (!rootDir) fail('PATH', 'Speech synthesis requires an explicit example root.');
  const directory = resolve(outputDir ?? join(rootDir, 'output', 'narration'));
  await validateOutputPath(rootDir, directory, { directory: true });
  const { bytes, metadata } = await requestSpeech(text, input, requestOptions);
  await validateOutputPath(rootDir, directory, { directory: true });
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${metadata.sha256}.${metadata.format}`), recordPath = join(directory, `${metadata.sha256}-${hash(JSON.stringify(metadata))}.speech.json`);
  await validateOutputPath(rootDir, path); await validateOutputPath(rootDir, recordPath);
  async function immutable(file, content) {
    await validateOutputPath(rootDir, file);
    try { await writeFile(file, content, { flag: 'wx' }); }
    catch (error) {
      if (error.code !== 'EEXIST') fail('WRITE', 'Speech output could not be published.');
      await validateOutputPath(rootDir, file);
      const existing = await readFile(file);
      if (!existing.equals(Buffer.from(content))) fail('CONFLICT', 'Existing speech output differs; previous files were retained.');
    }
  }
  await immutable(path, bytes);
  await immutable(recordPath, JSON.stringify(metadata, null, 2) + '\n');
  return { path, recordPath, metadata };
}
