import {mainCLI} from '../../../shared/voice/cli.mjs';
import {fileURLToPath} from 'node:url';
mainCLI(process.argv.slice(2),{rootDir:fileURLToPath(new URL('../',import.meta.url)),lessonPath:fileURLToPath(new URL('lesson.json',import.meta.url))}).catch(()=>{console.error('本地豆包合成失败；请检查配置与课程。');process.exitCode=1;});
