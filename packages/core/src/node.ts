import { readFileSync, readdirSync, mkdirSync, mkdtempSync, writeFileSync, renameSync, rmSync, realpathSync, existsSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { PublicDataset } from '../contracts/public-nodes.js';
import { parseMarkdownRecord } from './markdown.js';
import { compareText, sortedJSON } from './json.js';
import { validateRecords, type ValidationResult } from './validation.js';
import { ExportError, exportRecords } from './projection.js';

export function loadRecord(path: string) { return parseMarkdownRecord(readFileSync(path, 'utf8'), basename(path)); }

export function markdownFiles(root: string): string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) paths.push(...markdownFiles(path));
    else if (entry.name.endsWith('.md')) paths.push(path);
  }
  return paths.sort(compareText);
}

export function validateDirectory(root: string): ValidationResult {
  const loaded: Array<[string, unknown]> = [], errors: string[] = [];
  let paths: string[];
  try { paths = markdownFiles(root); } catch (error) { return { records: [], errors: [`${root}: ${(error as Error).message}`] }; }
  for (const path of paths) {
    try { const record = loadRecord(path); if (record !== null) loaded.push([path, record]); }
    catch (error) { errors.push(`${path}: ${(error as Error).message}`); }
  }
  const result = validateRecords(loaded);
  return { records: result.records, errors: [...errors, ...result.errors] };
}

export function exportDirectory(root: string): PublicDataset {
  const { records, errors } = validateDirectory(root);
  if (errors.length) throw new ExportError('Source validation failed:\n' + errors.join('\n'));
  return exportRecords(records);
}

function realDestination(path: string): string {
  const full = resolve(path);
  if (existsSync(full)) return realpathSync(full);
  return join(realDestination(dirname(full)), basename(full));
}

export function checkOutputPath(source: string, destination: string): void {
  const path = relative(realDestination(source), realDestination(destination));
  if (extname(destination) !== '.json' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`))) {
    throw new Error('output must be a .json file outside the source node directory');
  }
}

/** Atomic replacement on the destination filesystem; failures preserve the old snapshot. */
export function writeDataset(destination: string, dataset: PublicDataset): void {
  const content = sortedJSON(dataset);
  const parent = dirname(destination);
  mkdirSync(parent, { recursive: true });
  const temporary = mkdtempSync(join(parent, '.public-nodes-'));
  try {
    const file = join(temporary, 'snapshot.json');
    writeFileSync(file, content, { encoding: 'utf8', mode: 0o600 });
    renameSync(file, destination);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
