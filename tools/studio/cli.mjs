import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScore } from '../../scripts/build-audio.mjs';
import { getExample, listExamples } from './registry.mjs';
import { startPreview } from './preview.mjs';

export const HELP = `Mechanism Studio

  npm run studio -- list [--json]
  npm run studio -- generate <example-id>
  npm run studio -- preview [example-id] [--port 4200]
  npm run studio -- export <example-id> [--port 4200]

Preview defaults to the gallery. Original music is built and verified locally
where available; click Play with music in the page to enable sound.

Generate rebuilds an original robot-joint, planetary-gears or gearbox assembly,
part identities, provenance and original music locally. No model download or
Blender service is used; existing authored dimensions define the result.

Export opens a local browser-assisted workbench for registered render adapters.
Open its printed URL, review calibration frames, then Generate. It composes
fixed-size frames and encodes an MP4; it does not record your screen or publish.
Run list to distinguish supported exports from preview-only pages.
`;

function portNumber(text) {
  if (!/^\d+$/.test(String(text)) || !Number.isSafeInteger(Number(text)) || Number(text) < 1 || Number(text) > 65535) {
    throw new Error('Port must be an integer from 1 to 65535.');
  }
  return Number(text);
}

export function parseArgs(args) {
  if (!Array.isArray(args) || args.some(value => typeof value !== 'string')) throw new TypeError('CLI arguments must be strings.');
  if (!args.length || args.length === 1 && ['help', '--help', '-h'].includes(args[0])) return { command: 'help' };
  const [command, ...rest] = args;
  if (!['list', 'generate', 'preview', 'export'].includes(command)) throw new Error(`Unknown command "${command}". Use list, generate, preview or export.`);
  const result = { command }, positionals = [];
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token === '--json' && command === 'list' && !result.json) { result.json = true; continue; }
    if (token === '--port' && ['preview', 'export'].includes(command) && result.port === undefined) {
      if (!rest[i + 1]) throw new Error('--port requires a number.');
      result.port = portNumber(rest[++i]); continue;
    }
    if (token.startsWith('-')) throw new Error(`Unknown or repeated option "${token}" for ${command}.`);
    positionals.push(token);
  }
  if (command === 'list') {
    if (positionals.length) throw new Error('list does not accept an example ID.');
  } else {
    if (positionals.length > 1) throw new Error(`${command} accepts one registered example ID.`);
    if (['generate', 'export'].includes(command) && !positionals.length) throw new Error(`${command} requires a registered example ID.`);
    result.id = positionals[0] || 'gallery';
    const example = getExample(result.id);
    if (command === 'generate' && !example.generate) throw new Error(`"${example.id}" has no local generation recipe. Supported original assemblies: ${listExamples().filter(item => item.generate).map(item => item.id).join(', ')}.`);
    if (command === 'export' && !example.export) throw new Error(`"${example.id}" supports preview only; no unified export adapter is registered. Run "npm run studio -- list" for exportable editions.`);
  }
  return result;
}

export async function runStudio(args, { log = console.log, environment = process.env, preview = startPreview, exportFilm, generate } = {}) {
  const options = parseArgs(args);
  if (options.command === 'help') { log(HELP); return; }
  if (options.command === 'list') {
    const entries = listExamples();
    if (options.json) log(JSON.stringify(entries, null, 2));
    else {
      log(`${'Example ID'.padEnd(23)} ${'Local build'.padEnd(12)} ${'Video export'.padEnd(17)} Title`);
      for (const item of entries) log(`${item.id.padEnd(23)} ${(item.generate ? 'generate' : '—').padEnd(12)} ${(item.export ? `${item.duration}s ${item.width}×${item.height}` : 'preview only').padEnd(17)} ${item.title}`);
      log('\nGenerate: npm run studio -- generate <example-id>\nPreview: npm run studio -- preview <example-id>');
    }
    return entries;
  }
  const example = getExample(options.id);
  if (options.command === 'generate') {
    const runGenerate = generate || (await import('./generate.mjs')).generateExample;
    const result = await runGenerate(example, { log });
    log(`Generated ${result.partCount} parts / ${result.definitionCount} definitions locally: ${result.asset}`);
    log(`Evidence: ${result.report}\nPreview: npm run studio -- preview ${example.id}\nExport: npm run studio -- export ${example.id}`);
    return result;
  }
  const port = options.port ?? (environment.PORT ? portNumber(environment.PORT) : undefined);
  if (options.command === 'preview') {
    const result = await preview(example, { ...(port !== undefined ? { port } : {}), log });
    log(`${example.title}: ${result.url}`);
    log('Local preview is running. Press Ctrl+C to stop.');
    return result;
  }
  if (example.audio) await buildScore(example.audio);
  const runExport = exportFilm || (await import('./export.mjs')).exportExample;
  const result = await runExport(example, { ...(port !== undefined ? { port } : {}) });
  log(`Export workbench: ${result.url}`);
  log(`Open this URL in a WebGL browser, review calibration frames, then choose Generate.\nOutput: ${result.outputDirectory}`);
  log('Keep this command running during export. Press Ctrl+C when finished.');
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runStudio(process.argv.slice(2)).catch(error => { console.error(`Mechanism Studio: ${error.message}`); process.exitCode = 1; });
}
