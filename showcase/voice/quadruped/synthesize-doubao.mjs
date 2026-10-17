import { fileURLToPath } from 'node:url';
import { mainCLI, reportCLIError } from '../../../shared/voice/cli.mjs';

mainCLI(process.argv.slice(2), {
  rootDir: fileURLToPath(new URL('./', import.meta.url)),
  lessonPath: new URL('./lesson.json', import.meta.url),
  expectedStepIds: ['overview', 'joints', 'trajectory', 'gait', 'stance', 'assembly'],
}).catch(reportCLIError);
