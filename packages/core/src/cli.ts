import { parseArgs } from 'node:util';
import { statSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { checkOutputPath, exportDirectory, validateDirectory, writeDataset } from './node.js';
import { sortedJSON } from './json.js';
import { generatedContracts } from './contract.js';

export function run(mode: 'validate' | 'export' | 'generate'): void {
  const usage = mode === 'generate' ? 'seraph-generate-contract [--check]' : `seraph-${mode} <node-directory>${mode === 'export' ? ' [--output <file.json>]' : ''}`;
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs({ allowPositionals: true, options: { help: { type: 'boolean', short: 'h' }, ...(mode === 'generate' ? { check: { type: 'boolean' as const } } : {}), ...(mode === 'export' ? { output: { type: 'string' as const, short: 'o' } } : {}) } });
    if (args.values.help) { process.stdout.write(`Usage: ${usage}\n`); return; }
    if (args.positionals.length !== (mode === 'generate' ? 0 : 1)) throw new Error(`Usage: ${usage}`);
    if (mode !== 'generate' && !statSync(args.positionals[0]).isDirectory()) throw new Error(`not a directory: ${args.positionals[0]}`);
    if (mode === 'export' && args.values.output) checkOutputPath(args.positionals[0], args.values.output as string);
  } catch (error) { process.stderr.write(`${(error as Error).message}\n`); process.exitCode = 2; return; }
  try {
    if (mode === 'generate') {
      // Running under dist/src; committed contracts are at the package root.
      const contracts = fileURLToPath(new URL('../../contracts/', import.meta.url));
      const stale: string[] = [];
      for (const [name, content] of Object.entries(generatedContracts())) {
        const path = resolve(contracts, name);
        if (args.values.check) { try { if (readFileSync(path, 'utf8') !== content) stale.push(name); } catch { stale.push(name); } }
        else writeFileSync(path, content, 'utf8');
      }
      if (stale.length) throw new Error(`Regenerate contracts: ${stale.join(', ')}`);
    } else if (mode === 'validate') {
      const { records, errors } = validateDirectory(args.positionals[0]);
      if (errors.length) throw new Error(errors.join('\n') + `\nValidation failed: ${errors.length} error(s).`);
      process.stdout.write(`Validated ${records.length} nodes.\n`);
    } else {
      const dataset = exportDirectory(args.positionals[0]);
      if (args.values.output) writeDataset(args.values.output as string, dataset);
      else process.stdout.write(sortedJSON(dataset));
    }
  } catch (error) { process.stderr.write(`${(error as Error).message}\n`); process.exitCode = 1; }
}
