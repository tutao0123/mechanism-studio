/** Node-only CLI. Validate by default; never load credentials without --generate. */
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpeechError, normalizeSpeechConfig, synthesizeSpeech } from './speech.mjs';
import { validateOutputPath } from './generator.mjs';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const inside = (root, path) => { const value = relative(root, path); return value === '' || (value !== '..' && !value.startsWith('../') && !value.startsWith('..\\') && !isAbsolute(value)); };

export async function mainSpeechCLI(argv, { projectDir = project, env = process.env, fetchImpl = globalThis.fetch, logger = console.log } = {}) {
  const args = { generate: false, origins: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--generate') args.generate = true;
    else if (arg === '--dry-run') args.generate = false;
    else if (arg === '--help' || arg === '-h') { logger('node shared/voice/speech-cli.mjs --config <local-json> --input <text-file> --root <example-dir> [--output <example-output-dir>] [--allow-origin https://custom-host] [--generate]'); return { mode: 'help' }; }
    else if (['--config', '--input', '--root', '--output', '--allow-origin'].includes(arg)) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new SpeechError('ARGS', 'Missing speech CLI argument.');
      if (arg === '--allow-origin') args.origins.push(value);
      else args[arg.slice(2)] = value;
    } else throw new SpeechError('ARGS', 'Unsupported speech CLI argument.');
  }
  if (!args.config || !args.input || !args.root) throw new SpeechError('ARGS', 'Speech CLI requires --config, --input and --root.');
  const rootDir = resolve(args.root), inputPath = resolve(args.input), outputDir = resolve(args.output ?? resolve(rootDir, 'output/narration'));
  if (!inside(resolve(projectDir), rootDir) || !inside(rootDir, inputPath)) throw new SpeechError('PATH', 'Speech root/input must stay in this Mechanism Studio project and example.');
  await validateOutputPath(projectDir, rootDir, { directory: true });
  await validateOutputPath(rootDir, inputPath);
  await validateOutputPath(rootDir, outputDir, { directory: true });
  let input, text;
  try { input = JSON.parse(await readFile(resolve(args.config), 'utf8')); text = await readFile(inputPath, 'utf8'); }
  catch { throw new SpeechError('FILE', 'Speech text/configuration could not be read or parsed; file contents omitted.'); }
  if (Object.hasOwn(input, 'apiKey')) throw new SpeechError('AUTH', 'Store only apiKeyEnv in speech JSON; supply the value through the server/CLI environment.');
  const config = normalizeSpeechConfig(input, { allowedOrigins: args.origins });
  if (typeof text !== 'string' || !text.trim() || Buffer.byteLength(text) > 16000) throw new SpeechError('TEXT', 'Speech text must contain 1–16000 UTF-8 bytes.');
  if (!args.generate) { logger(`Speech configuration and text validated locally (${config.provider}, ${config.format}). No credentials read, request sent or audio generated.`); return { mode: 'dry-run', provider: config.provider }; }
  if (typeof input.apiKeyEnv !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(input.apiKeyEnv)) throw new SpeechError('AUTH', 'Explicit generation requires a named apiKeyEnv configuration field.');
  const result = await synthesizeSpeech(text, input, { rootDir, outputDir, apiKey: env[input.apiKeyEnv], allowedOrigins: args.origins, fetchImpl });
  logger(`Speech generated locally (${result.metadata.bytes} bytes); no upload or lesson migration performed.`);
  return { mode: 'generated', ...result };
}
if (process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  mainSpeechCLI(process.argv.slice(2)).catch(error => { console.error(error instanceof SpeechError ? error.message : 'Speech generation failed; credentials and provider body omitted.'); process.exitCode = 1; });
}
