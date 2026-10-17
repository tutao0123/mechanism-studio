import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mainCLI, reportCLIError } from '../../../shared/voice/cli.mjs';
const rootDir = fileURLToPath(new URL('../', import.meta.url));
export const main = (argv = process.argv.slice(2), options = {}) => mainCLI(argv, {
  ...options, rootDir, lessonPath: new URL('./lesson.json', import.meta.url),
});
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(reportCLIError);
