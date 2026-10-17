/** Compatibility entry point: retain the reviewed Galileo 2 cache locations. */
import { runCadImport } from './import-assembly.mjs';

const extra = process.argv.slice(2);
if (extra.some(argument => argument !== '--from-cache')) throw new Error('Usage: node tools/cad/import-shaft-bearing.mjs [--from-cache]');
const result = await runCadImport({ example: 'examples/shaft-bearing', fromCache: extra.includes('--from-cache'), cacheDirectory: 'output/cad-research', cachePrefix: 'shaft-bearing-' });
console.log(JSON.stringify({ ...result.report.sourceStatistics, display: result.display, coarseTriangles: result.coarseTriangles, glbSHA256: result.report.glbSHA256 }, null, 2));
