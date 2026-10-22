import { parseDocument, visit, isMap, isScalar } from 'yaml';
import { isObject, type JSONValue } from './json.js';

/** Keep the Python loader's YAML 1.1 numbers, string dates and lowercase booleans. */
export function parseFrontmatter(source: string): Record<string, JSONValue> {
  const doc = parseDocument(source, {
    schema: 'yaml-1.1', version: '1.1', uniqueKeys: true, intAsBigInt: true,
    customTags: tags => [
      ...tags.filter(tag => typeof tag === 'string' || tag.tag !== 'tag:yaml.org,2002:timestamp').map(tag => {
        if (typeof tag === 'string' || tag.collection) return tag;
        if (tag.tag === 'tag:yaml.org,2002:bool') return { ...tag, test: tag.test?.test('true') ? /^true$/ : /^false$/ };
        if (tag.tag === 'tag:yaml.org,2002:int' && !tag.format) return { ...tag, test: /^[-+]?(?:0|[1-9][0-9_]*)$/ };
        if (tag.tag === 'tag:yaml.org,2002:float' && tag.test) {
          const legacy = /^(?:[-+]?(?:[0-9][0-9_]*)\.[0-9_]*(?:[eE][-+][0-9]+)?|\.[0-9][0-9_]*(?:[eE][-+][0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/;
          return { ...tag, test: new RegExp(`(?=${legacy.source})${tag.test.source}`) };
        }
        return tag;
      }),
      // Explicit !!bool tags retain PyYAML's constructor semantics.
      { tag: 'tag:yaml.org,2002:bool', default: false, resolve(value: string) {
        const text = value.toLowerCase();
        if (['true', 'yes', 'on'].includes(text)) return true;
        if (['false', 'no', 'off'].includes(text)) return false;
        throw new Error(`invalid explicit YAML boolean: ${value}`);
      } },
    ],
  });
  if (doc.errors.length || doc.warnings.length) throw new Error([...doc.errors, ...doc.warnings].map(error => error.message).join('\n'));
  visit(doc, {
    Node(_key, node) {
      if (node.tag && !['map', 'seq', 'str', 'null', 'int', 'float', 'bool'].map(name => `tag:yaml.org,2002:${name}`).includes(node.tag)) throw new Error(`non-JSON YAML tag: ${node.tag}`);
      if (isMap(node)) for (const pair of node.items) {
        if (!isScalar(pair.key) || typeof pair.key.value !== 'string') throw new Error('YAML object keys must be strings');
      }
    },
  });
  const active = new Set<object>();
  function convert(value: unknown): JSONValue {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') {
      const number = Number(value);
      if (!Number.isSafeInteger(number)) throw new Error('YAML integer exceeds JavaScript safe integer range');
      return number;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'object' || value === null) throw new Error('expected JSON-compatible data');
    if (active.has(value)) throw new Error('recursive YAML aliases are not JSON-compatible');
    active.add(value);
    let result: JSONValue;
    if (Array.isArray(value)) result = value.map(convert);
    else if (value instanceof Map) {
      const entries: Array<[string, JSONValue]> = [];
      for (const [key, item] of value) {
        if (typeof key !== 'string') throw new Error('YAML object keys must be strings');
        entries.push([key, convert(item)]);
      }
      result = Object.fromEntries(entries);
    } else throw new Error('expected JSON-compatible YAML data');
    active.delete(value);
    return result;
  }
  const result = convert(doc.toJS({ mapAsMap: true, maxAliasCount: 100 }));
  if (!isObject(result)) throw new Error('frontmatter must be an object');
  return result as Record<string, JSONValue>;
}

export function parseMarkdownRecord(source: string, filename = 'record.md'): Record<string, JSONValue> | null {
  // Universal newlines match Python's text-file reader.
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  if (lines[0]?.trim() !== '---') {
    if (filename === 'index.md') return null;
    throw new Error('missing opening YAML frontmatter delimiter (---)');
  }
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end < 0) throw new Error('missing closing YAML frontmatter delimiter (---)');
  const record = parseFrontmatter(lines.slice(1, end).join(''));
  if (Object.hasOwn(record, 'content')) throw new Error('content belongs in the Markdown body, not frontmatter');
  record.content = lines.slice(end + 1).join('');
  return record;
}
