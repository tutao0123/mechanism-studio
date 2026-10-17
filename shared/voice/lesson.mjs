import { TtsError } from './errors.mjs';

/** Audio identity deliberately excludes camera angles and mechanical metadata. */
export const LESSON_HASH_POLICY = 'narration-v1';
export const LESSON_LANGUAGES = Object.freeze(['zh-CN', 'en-US']);
const SAFE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const byteLength = text => new TextEncoder().encode(text).length;

export function validateLesson(input, { expectedStepIds } = {}) {
  const english = input?.language === 'en-US';
  if (input?.schemaVersion !== 1 || !LESSON_LANGUAGES.includes(input.language) || !Array.isArray(input.steps)
      || input.steps.length < 1 || input.steps.length > 100) {
    throw new TtsError(english ? 'A lesson requires 1–100 ordered steps in en-US or zh-CN.' : '旁白文件需要 1 至 100 个有序步骤，语言须为 zh-CN 或 en-US。');
  }
  const seen = new Set();
  const steps = input.steps.map((step, index) => {
    if (typeof step?.id !== 'string' || !SAFE_ID.test(step.id) || step.id.length > 64
        || seen.has(step.id) || typeof step.title !== 'string' || !step.title.trim()
        || typeof step.narration !== 'string' || !step.narration.trim()
        || byteLength(step.narration) > 1024
        || (expectedStepIds && step.id !== expectedStepIds[index])) {
      throw new TtsError(english ? 'Invalid step ID, order, title or narration; each narration is limited to 1024 UTF-8 bytes.' : '旁白步骤 ID、顺序或文案无效，单段上限为 1024 字节。');
    }
    seen.add(step.id);
    return { id: step.id, title: step.title.trim(), narration: step.narration.trim() };
  });
  if (expectedStepIds && steps.length !== expectedStepIds.length) throw new TtsError(english ? 'The step count does not match this lesson contract.' : '旁白步骤数量不符合实例契约。');
  return { schemaVersion: 1, language: input.language, steps };
}

export function canonicalLesson(input, options) { return JSON.stringify(validateLesson(input, options)); }

export async function lessonSha256(input, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle) throw new TtsError(input?.language === 'en-US' ? 'This environment cannot verify the narration hash.' : '当前环境不能验证配音文案摘要。');
  const digest = await cryptoImpl.subtle.digest('SHA-256', new TextEncoder().encode(canonicalLesson(input)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
