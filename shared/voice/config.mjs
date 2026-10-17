import {randomUUID} from 'node:crypto';
import {TtsError} from './errors.mjs';
import { ENDPOINT, PLAN_ENDPOINT, RESOURCE_ID } from './provider.mjs';
export { ENDPOINT, PLAN_ENDPOINT, RESOURCE_ID };
const CONFIG_KEYS = Object.freeze({
  apiKey: ['DOUBAO_TTS_API_KEY', 'DOUBAO_API_KEY', 'VOLC_SPEECH_API_KEY', 'apiKey'],
  appId: ['DOUBAO_APP_ID', 'appId'],
  accessKey: ['DOUBAO_ACCESS_KEY', 'accessKey'],
  speaker: ['DOUBAO_TTS_SPEAKER', 'DOUBAO_TTS_VOICE_ID', 'speaker'],
  resourceId: ['DOUBAO_TTS_RESOURCE_ID', 'resourceId'],
  sampleRate: ['DOUBAO_TTS_SAMPLE_RATE', 'sampleRate'],
  speechRate: ['DOUBAO_TTS_SPEECH_RATE', 'speechRate'],
  apiMode: ['DOUBAO_TTS_API_MODE', 'apiMode'],
});
const KNOWN_KEYS = new Set(Object.values(CONFIG_KEYS).flat());

/** Reads only the named configuration file; never searches directories or process.env. */
export function parseConfigText(text) {
  let values;
  if (text.trimStart().startsWith('{')) {
    try { values = JSON.parse(text.trimStart()); } catch { throw new TtsError('本地 JSON 配置无法解析。'); }
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw new TtsError('本地 JSON 配置必须是对象。');
    }
  } else {
    values = Object.create(null);
    for (const line of text.split(/\r?\n/)) {
      const keyMatch = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (!keyMatch || !KNOWN_KEYS.has(keyMatch[1])) continue;
      let value = line.slice(keyMatch[0].length).trim();
      if ((value.startsWith('"') && value.endsWith('"'))
          || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      else value = value.replace(/\s+#.*$/, '').trim();
      values[keyMatch[1]] = value;
    }
  }
  const selected = Object.create(null);
  for (const [field, keys] of Object.entries(CONFIG_KEYS)) {
    const key = keys.find((candidate) => Object.hasOwn(values, candidate));
    if (key !== undefined) selected[field] = values[key];
  }
  return normalizeConfig(selected);
}

export function normalizeConfig(input = {}) {
  const value = (field, fallback = '') => input[field] == null ? fallback : String(input[field]).trim();
  const config = {
    apiKey: value('apiKey'), appId: value('appId'), accessKey: value('accessKey'),
    speaker: value('speaker', 'zh_female_vv_uranus_bigtts'),
    resourceId: value('resourceId', RESOURCE_ID),
    sampleRate: Number(value('sampleRate', '24000')),
    speechRate: Number(value('speechRate', '-5')),
    apiMode: value('apiMode', 'speech'),
  };
  if (config.resourceId !== RESOURCE_ID || !/^[A-Za-z0-9_-]+$/.test(config.speaker)
      || ![8000, 16000, 22050, 24000, 32000, 44100, 48000].includes(config.sampleRate)
      || !Number.isInteger(config.speechRate) || config.speechRate < -50 || config.speechRate > 100
      || !['speech', 'agent-plan'].includes(config.apiMode)) {
    throw new TtsError('豆包资源、音色或音频参数无效；仅支持 seed-tts-2.0 的 MP3 合成。');
  }
  return config;
}

export function hasCredentials(config) {
  const present = (value) => Boolean(value) && !/^(?:your[_-]|replace[_-]|<)/i.test(value) && !/[\r\n]/.test(value);
  return config.apiKey ? present(config.apiKey) : present(config.appId) && present(config.accessKey);
}

export function buildRequest(text, config, requestId = randomUUID(), { language } = {}) {
  if (!hasCredentials(config)) throw new TtsError('缺少有效的本地豆包凭据。');
  if (config.apiMode === 'agent-plan' && !config.apiKey) throw new TtsError('Agent Plan 接口需要新 API Key。');
  const headers = {
    'Content-Type': 'application/json',
    'X-Api-Resource-Id': RESOURCE_ID,
    'X-Api-Request-Id': requestId,
    'X-Control-Require-Usage-Tokens-Return': '*',
  };
  if (config.apiKey) headers['X-Api-Key'] = config.apiKey;
  else {
    headers['X-Api-App-Id'] = config.appId;
    headers['X-Api-Access-Key'] = config.accessKey;
  }
  const request = { headers, body: {
    user: { uid: 'mechanism-studio' },
    req_params: {
      text, speaker: config.speaker,
      audio_params: { format: 'mp3', sample_rate: config.sampleRate, speech_rate: config.speechRate },
    },
  } };
  // Official V3 additions is a JSON string. Leave existing Chinese requests unchanged.
  if (language === 'en-US') request.body.req_params.additions = JSON.stringify({ explicit_language: 'en' });
  return request;
}

