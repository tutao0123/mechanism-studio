import { readFile, mkdir, writeFile, rename, lstat, realpath, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, resolve, relative, isAbsolute, join } from 'node:path';
import { TtsError } from './errors.mjs';
import { canonicalLesson, LESSON_HASH_POLICY, validateLesson } from './lesson.mjs';
import { ENDPOINT, PLAN_ENDPOINT, RESOURCE_ID, buildRequest, normalizeConfig } from './config.mjs';
import { parseDoubaoStream } from './protocol.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const inside = (root, path) => { const local = relative(root, path); return !local.startsWith('..') && !isAbsolute(local); };
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
async function stat(path) { try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }

/** Reject escaping paths and symlink/junction ancestors, including existing files. */
export async function validateOutputPath(rootDir, path, { directory = false } = {}) {
  const root = resolve(rootDir), candidate = resolve(path);
  if (!inside(root, candidate)) throw new TtsError('音频输出必须位于当前实例内。');
  const rootStat = await stat(root);
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink() || !samePath(root, await realpath(root))) {
    throw new TtsError('音频实例根目录无效或包含链接。');
  }
  const local = relative(root, candidate);
  const segments = local ? local.split(/[\\/]/) : [];
  let current = root;
  for (const [index, segment] of segments.entries()) {
    current = join(current, segment);
    const info = await stat(current);
    if (!info) break;
    if (info.isSymbolicLink()) throw new TtsError('音频输出不能经过符号链接或目录连接。');
    const actual = await realpath(current);
    if (!inside(root, actual) || !samePath(current, actual)) throw new TtsError('音频输出链接指向实例外。');
    if ((index < segments.length - 1 || directory) && !info.isDirectory()) throw new TtsError('音频输出目录无效。');
    if (index === segments.length - 1 && !directory && !info.isFile()) throw new TtsError('音频清单或文件位置无效。');
  }
  return candidate;
}

export async function synthesizeLesson(input, inputConfig, {
  rootDir, fetchImpl = globalThis.fetch, audioDir, manifestPath, expectedStepIds, logger = console.log,
} = {}) {
  if (!rootDir) throw new TtsError('配音生成器必须指定当前实例根目录。');
  const root = resolve(rootDir), lesson = validateLesson(input, { expectedStepIds });
  const config = normalizeConfig(inputConfig);
  buildRequest(lesson.steps[0].narration, config, undefined, { language: lesson.language });
  audioDir = resolve(audioDir ?? join(root, 'assets', 'audio'));
  manifestPath = resolve(manifestPath ?? join(root, 'voice', 'audio-manifest.json'));
  const safePaths = async () => {
    await validateOutputPath(root, audioDir, { directory: true });
    await validateOutputPath(root, dirname(manifestPath), { directory: true });
    await validateOutputPath(root, manifestPath);
  };
  await safePaths();
  const completed = [];
  let totalBytes = 0;
  // No output is created until every request returns a complete success stream.
  for (const step of lesson.steps) {
    const request = buildRequest(step.narration, config, undefined, { language: lesson.language });
    let response;
    try {
      response = await fetchImpl(config.apiMode === 'agent-plan' ? PLAN_ENDPOINT : ENDPOINT, {
        method: 'POST', headers: request.headers, body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(120000), redirect: 'error',
      });
    } catch { throw new TtsError('豆包请求失败或超时；没有发布本轮音频清单。'); }
    if (!response.ok || !response.body) {
      await response.body?.cancel?.().catch(() => {});
      throw new TtsError('豆包 HTTP 请求失败，状态码 ' + response.status + '。');
    }
    const result = await parseDoubaoStream(response.body);
    totalBytes += result.audio.length;
    if (totalBytes > 128 * 1024 * 1024) throw new TtsError('整套课程音频超过 128 MiB 上限。');
    completed.push({ step, ...result });
    logger(lesson.language === 'en-US' ? 'Doubao returned complete audio: ' + step.id + ' (' + result.audio.length + ' bytes).' : '豆包已返回完整音频：' + step.id + '（' + result.audio.length + ' 字节）。');
  }
  const runId = randomUUID();
  let temporaryManifest;
  try {
    // Recheck after provider latency, before every local write/rename.
    await safePaths();
    await mkdir(audioDir, { recursive: true });
    await mkdir(dirname(manifestPath), { recursive: true });
    await safePaths();
    const manifest = {
      schemaVersion: 1, provider: 'doubao', complete: true,
      generatedAt: new Date().toISOString(), resourceId: RESOURCE_ID,
      speaker: config.speaker, apiMode: config.apiMode, format: 'mp3', sampleRate: config.sampleRate,
      lessonHashPolicy: LESSON_HASH_POLICY, lessonSha256: digest(canonicalLesson(lesson)), steps: {},
    };
    for (const { step, audio, usage } of completed) {
      const sha256 = digest(audio);
      // Immutable content-addressed names keep the previous manifest's audio intact.
      const path = join(audioDir, step.id + '-' + sha256 + '.mp3');
      await validateOutputPath(root, path);
      const existing = await stat(path);
      if (existing) {
        const bytes = await readFile(path);
        if (bytes.length !== audio.length || digest(bytes) !== sha256) throw new TtsError('已有音频摘要冲突；没有替换旧清单。');
      } else {
        try { await writeFile(path, audio, { flag: 'wx' }); }
        catch (error) {
          if (error.code !== 'EEXIST') throw error;
          // A concurrent completed batch may publish the same immutable bytes.
          await validateOutputPath(root, path);
          const bytes = await readFile(path);
          if (bytes.length !== audio.length || digest(bytes) !== sha256) throw new TtsError('已有音频摘要冲突；没有替换旧清单。');
        }
      }
      manifest.steps[step.id] = { src: relative(root, path).split('\\').join('/'), bytes: audio.length, sha256, ...(usage ? { usage } : {}) };
    }
    temporaryManifest = manifestPath + '.tmp-' + runId;
    await validateOutputPath(root, temporaryManifest);
    await writeFile(temporaryManifest, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    await safePaths();
    await validateOutputPath(root, temporaryManifest);
    // Publish only the manifest atomically; never rename/delete the old manifest first.
    await rename(temporaryManifest, manifestPath);
    temporaryManifest = null;
    logger(lesson.language === 'en-US' ? 'Published the complete local Doubao manifest for ' + lesson.steps.length + ' steps.' : lesson.steps.length + ' 段豆包音频全部成功，已发布本地音频清单。');
    return manifest;
  } catch (error) {
    // Completed immutable audio may be reused by a concurrent successful batch.
    // Only remove our own unpublished manifest, never shared content files.
    for (const path of [temporaryManifest].filter(Boolean)) {
      try { await validateOutputPath(root, path); await unlink(path); } catch { /* never clean up through an escaping link */ }
    }
    if (error instanceof TtsError) throw error;
    throw new TtsError('本地音频发布失败；旧清单与旧音频保留。');
  }
}
