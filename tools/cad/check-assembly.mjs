/** Read retained CAD/display evidence and write a local, scoped audit report. */
import { mkdir, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { dirname, basename, join, relative, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectCadEvidence } from '../../shared/cad/audit.mjs';
import { extractStepMetadata } from './step-metadata.mjs';
import { projectRoot, readCadSourcePackage, resolveScopedPath } from './import-assembly.mjs';

const failure = error => ({ schemaVersion: '1.0.0', status: 'failed', checks: [{ id: 'package-read', status: 'failed', message: error.message }], summary: {}, capabilities: {}, findings: [{ check: 'package-read', severity: 'failed', message: error.message }] });

/** No source/assets are modified. A missing legacy manifest remains limited. */
export async function checkCadExample({ root = projectRoot, example } = {}) {
  try {
    const source = await readCadSourcePackage({ root, example });
    root = source.root;
    async function asset(name, { optional = false, binary = false } = {}) {
      let path;
      try { path = await resolveScopedPath(root, join(source.exampleDirectory, 'assets', name), { mustExist: true }); }
      catch (error) { if (optional && error.code === 'ENOENT') return undefined; throw error; }
      const rel = relative(source.exampleDirectory, path);
      if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel) || !(await stat(path)).isFile()) throw new Error(`Invalid retained asset path: ${name}`);
      const bytes = await readFile(path); return binary ? bytes : JSON.parse(bytes.toString('utf8'));
    }
    const [manifest, contract, importReport, glbBytes] = await Promise.all([
      asset('assembly-manifest.json', { optional: true }), asset('scene-contract.json'), asset('import-report.json'), asset('assembly.glb', { binary: true }),
    ]);
    return inspectCadEvidence({ sourceBytes: source.sourceBytes, provenance: source.provenance, manifest, contract, importReport, glbBytes, sourceMetadata: extractStepMetadata(source.sourceBytes.toString('utf8')) });
  } catch (error) { return failure(error); }
}

export async function writeCadAuditReport(report, { root = projectRoot, output } = {}) {
  if (typeof output !== 'string' || !/^output\/[a-zA-Z0-9][a-zA-Z0-9._/-]*\.json$/.test(output.replaceAll('\\', '/')) || output.split(/[\\/]/).includes('..')) throw new Error('Audit reports must be relative JSON paths under output/.');
  const directory = await resolveScopedPath(root, dirname(output));
  const target = await resolveScopedPath(root, output);
  if (dirname(target) !== directory) throw new Error('Report target resolves outside its output directory.');
  try { if (!(await stat(target)).isFile()) throw new Error('Existing report target must be a regular file.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(directory, { recursive: true });
  const temporary = await resolveScopedPath(root, join(directory, `${basename(target)}.${process.pid}.tmp`));
  await writeFile(temporary, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  await resolveScopedPath(root, target); await rename(temporary, target);
  return target;
}

const usage = 'Usage: npm run audit:cad -- --example examples/<directory> [--output output/<report>.json]\nChecks retained XCAF assembly evidence. Exit 1 means inconsistent/missing evidence; limited is a disclosed limitation, not an engineering certification.';
function argumentsFor(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (['--example', '--output'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) options[args[i].slice(2)] = args[++i];
    else throw new Error(usage);
  }
  if (!options.example) throw new Error(usage);
  options.output ??= `output/cad-check/${basename(options.example.replaceAll('\\', '/'))}.json`;
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some(arg => ['--help', '-h'].includes(arg))) console.log(usage);
  else try {
    const options = argumentsFor(process.argv.slice(2)), report = await checkCadExample(options);
    const path = await writeCadAuditReport(report, options);
    console.log(JSON.stringify({ status: report.status, summary: report.summary, capabilities: report.capabilities, findings: report.findings.map(({ check, severity, message }) => ({ check, severity, message })), report: relative(projectRoot, path).replaceAll('\\', '/') }, null, 2));
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
