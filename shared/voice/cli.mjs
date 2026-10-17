import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TtsError } from './errors.mjs';
import { validateLesson } from './lesson.mjs';
import { parseConfigText, normalizeConfig, hasCredentials } from './config.mjs';
import { synthesizeLesson } from './generator.mjs';

/** Explicit caller-owned paths; no config discovery and no process.env fallback. */
export async function mainCLI(argv = process.argv.slice(2), {
  rootDir, lessonPath, manifestPath, audioDir, expectedStepIds,
  logger = console.log, fetchImpl = globalThis.fetch,
} = {}) {
  let generate = false, configPath = null, help = false;
  const overrides = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--generate') generate = true;
    else if (arg === '--dry-run') generate = false;
    else if (['--config', '--speaker', '--api-mode'].includes(arg)) {
      const value = argv[++index];
      if (!value || value.startsWith('--') || /^https?:/i.test(value)) throw new TtsError('请指定有效的本地命令参数。');
      if (arg === '--config') configPath = value;
      else overrides[arg === '--speaker' ? 'speaker' : 'apiMode'] = value;
    } else if (arg === '--help' || arg === '-h') help = true;
    else throw new TtsError('不支持的命令行参数。');
  }
  if (help) {
    logger('默认仅本地校验：node voice/synthesize-doubao.mjs [--config 本地配置路径]\n实际调用豆包：node voice/synthesize-doubao.mjs --generate --config 本地配置路径 [--speaker 音色ID] [--api-mode speech|agent-plan]');
    return { mode: 'help' };
  }
  if (!rootDir || !lessonPath) throw new TtsError('课程 CLI 必须指定实例与文案路径。');
  let lesson;
  try { lesson = validateLesson(JSON.parse(await readFile(lessonPath, 'utf8')), { expectedStepIds }); }
  catch (error) { if (error instanceof TtsError) throw error; throw new TtsError('本地旁白文件无法读取或解析。'); }
  let config = normalizeConfig();
  if (configPath) {
    let text;
    try { text = await readFile(resolve(configPath), 'utf8'); }
    catch { throw new TtsError('指定的本地配置文件无法读取。'); }
    config = parseConfigText(text);
  }
  config = normalizeConfig({ ...config, ...overrides });
  if (!generate) {
    const ready = hasCredentials(config);
    if (lesson.language === 'en-US') {
      logger('Validated ' + lesson.steps.length + ' English narration steps locally; MP3, seed-tts-2.0.');
      logger(ready ? 'Local authentication fields are present; no request or account-permission check was made.' : 'No Doubao credentials configured; no request was made.');
      logger('Dry run complete. No audio or completion manifest was generated.');
    } else {
      logger('本地校验通过：' + lesson.steps.length + ' 段中文旁白，MP3，seed-tts-2.0。');
      logger(ready ? '本地鉴权字段齐全；尚未请求豆包或验证账户权限。' : '未配置豆包凭据；尚未请求豆包。');
      logger('干运行结束；没有生成音频或完成清单。');
    }
    return { mode: 'dry-run', steps: lesson.steps.length, ready };
  }
  if (!configPath) throw new TtsError('实际合成需要 --config 指定本地豆包配置文件。');
  return synthesizeLesson(lesson, config, { rootDir, manifestPath, audioDir, expectedStepIds, logger, fetchImpl });
}

export function reportCLIError(error) {
  console.error(error instanceof TtsError ? error.message : '本地音频生成失败；请检查课程与发布位置。');
  process.exitCode = 1;
}
