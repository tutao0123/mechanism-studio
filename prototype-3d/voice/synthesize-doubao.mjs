import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateLesson as validateShared } from '../../shared/voice/lesson.mjs';
import { synthesizeLesson as synthesizeShared } from '../../shared/voice/generator.mjs';
import { mainCLI, reportCLIError } from '../../shared/voice/cli.mjs';
export { ENDPOINT, PLAN_ENDPOINT, RESOURCE_ID, buildRequest, parseConfigText, normalizeConfig } from '../../shared/voice/config.mjs';
export { parseDoubaoStream } from '../../shared/voice/protocol.mjs';
export { TtsError } from '../../shared/voice/errors.mjs';
export const STEP_IDS = Object.freeze(["part","wrong","align","turn","reset"]);
const VOICE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(VOICE_DIR);
export const validateLesson = input => validateShared(input, { expectedStepIds: STEP_IDS });
export const synthesizeLesson = (input, config, options = {}) => synthesizeShared(input, config, {
  ...options, rootDir: ROOT, expectedStepIds: STEP_IDS,
  audioDir: options.audioDir ?? join(ROOT, 'assets', 'audio'),
  manifestPath: options.manifestPath ?? join(VOICE_DIR, 'audio-manifest.json'),
});
export const main = (argv = process.argv.slice(2), options = {}) => mainCLI(argv, {
  ...options, rootDir: ROOT, expectedStepIds: STEP_IDS,
  lessonPath: join(VOICE_DIR, 'lesson.json'), manifestPath: join(VOICE_DIR, 'audio-manifest.json'),
});
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(reportCLIError);
