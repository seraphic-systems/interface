import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { stringify } from 'yaml';
import { parseMarkdownRecord } from '../dist/src/markdown.js';
import { markdownFiles } from '../dist/src/node.js';
import { nodeValidators } from '../dist/src/validation.js';

export const core = fileURLToPath(new URL('../', import.meta.url));
export const examples = Object.fromEntries(markdownFiles(join(core, 'docs/model')).flatMap(path => {
  return [...readFileSync(path, 'utf8').matchAll(/```markdown\n(---\n[\s\S]*?)```/g)].map(([, text]) => parseMarkdownRecord(text)).filter(record => Object.hasOwn(nodeValidators, record.type)).map(record => [record.type, record]);
}));
export const example = type => structuredClone(examples[type]);
export const entries = records => records.map(record => [`${record.id}.md`, record]);
export function temp(t) {
  const directory = mkdtempSync(join(tmpdir(), 'seraph-core-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
export function write(root, ...records) {
  mkdirSync(root, { recursive: true });
  for (const { content = '', ...header } of records) writeFileSync(join(root, `${header.id}.md`), `---\n${stringify(header)}---\n${content}`, 'utf8');
}
export const cli = (mode, args = [], options = {}) => spawnSync(process.execPath, [join(core, `scripts/${mode}.mjs`), ...args], { encoding: 'utf8', ...options });
export function record(id, type, properties, isPublic = false) {
  return { id, type, title: id, properties, content: 'Public prose.\n', ...(isPublic ? { visibility: 'public' } : {}) };
}
export function publicFixture(t) {
  const directory = temp(t), root = join(directory, 'nodes');
  const value = record('value-public', 'Value', { statement: 'Care', kind: 'aspiration' }, true);
  const hidden = record('value-secret', 'Value', { statement: 'PRIVATE STATEMENT', kind: 'aspiration' });
  const aim = record('aim-public', 'Aim', { values: ['value-public', 'value-secret'], direction: 'Gather' }, true);
  write(root, value, hidden, aim);
  return { directory, root, value, hidden, aim };
}
