import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { SPEC, robotState } from '../model.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const project = fileURLToPath(new URL('../../../', import.meta.url));
const cache = join(root, '.cache'); await mkdir(cache, { recursive: true });
for (const dir of ['assets', '.cache/config', '.cache/scripts', '.cache/data', '.cache/temp']) await mkdir(join(root, dir), { recursive: true });
await writeFile(join(root, 'blender', 'build-input.json'), JSON.stringify({ spec: SPEC, rest: robotState() }, null, 2));
const blender = process.env.MECHANISM_BLENDER_PATH || resolve(project, '.tools', 'blender-4.5.14-windows-x64', 'blender.exe');
const result = spawnSync(blender, ['--background', '--factory-startup', '--python', join(root, 'blender', 'build.py')], {
  cwd: root, stdio: 'inherit', env: { ...process.env,
    BLENDER_USER_CONFIG: join(cache, 'config'), BLENDER_USER_SCRIPTS: join(cache, 'scripts'),
    BLENDER_USER_DATAFILES: join(cache, 'data'), TEMP: join(cache, 'temp'), TMP: join(cache, 'temp'),
  },
});
if (result.error) throw result.error;
if (result.status === 0) {
  const hash = data => createHash('sha256').update(data).digest('hex');
  const reportFile = join(root, 'assets', 'build-report.json');
  const report = JSON.parse(await readFile(reportFile));
  report.glbSHA256 = hash(await readFile(join(root, 'assets', 'quadruped.glb')));
  report.modelSHA256 = hash(await readFile(join(root, 'model.mjs')));
  report.buildInputSHA256 = hash(await readFile(join(root, 'blender', 'build-input.json')));
  report.mcpUsed = false;
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
}
process.exitCode = result.status ?? 1;
