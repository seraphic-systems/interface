import type { PublicDataset, PublicNode, PublicEdge } from '../contracts/public-nodes.js';
import { buildPublicSchema, SCHEMA_VERSION } from './contract.js';
import { compareText, isObject } from './json.js';
import { propertySchemas, referenceType } from './schemas.js';
import { createValidator, formatErrors, validateRecords } from './validation.js';

export class ExportError extends Error {}
const publicValidator = createValidator().compile<PublicDataset>(buildPublicSchema());

export function publicDatasetErrors(dataset: unknown): string[] {
  if (!publicValidator(dataset)) return formatErrors(publicValidator.errors);
  const errors: string[] = [];
  const byId = new Map(dataset.nodes.map(node => [node.id, node]));
  if (byId.size !== dataset.nodes.length) errors.push('nodes: duplicate node IDs');
  const expected = new Set<string>();
  for (const node of dataset.nodes) {
    for (const [field, value] of Object.entries(node.properties)) {
      const type = referenceType(propertySchemas[node.type][field]);
      if (!type) continue;
      for (const id of (Array.isArray(value) ? value : [value]) as string[]) {
        const target = byId.get(id);
        if (!target) errors.push(`${node.id}.${field}: target is not in public dataset`);
        else if (type !== 'Node' && target.type !== type) errors.push(`${node.id}.${field}: expected target type ${type}`);
        expected.add(JSON.stringify([node.id, field, id]));
      }
    }
  }
  const actual = new Set(dataset.edges.map(edge => JSON.stringify([edge.source, edge.field, edge.target])));
  if (actual.size !== expected.size || [...actual].some(edge => !expected.has(edge))) errors.push('edges: must exactly match the public structured references');
  return errors;
}

function* strings(value: unknown): Generator<string> {
  if (typeof value === 'string') yield value;
  else if (Array.isArray(value)) for (const item of value) yield* strings(item);
  else if (isObject(value)) for (const [key, item] of Object.entries(value)) { yield key; yield* strings(item); }
}
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function exportRecords(source: Iterable<readonly [string, unknown]>): PublicDataset {
  const { records, errors } = validateRecords(source);
  if (errors.length) throw new ExportError('Source validation failed:\n' + errors.join('\n'));
  const publicIds = new Set(records.filter(([, record]) => record.visibility === 'public').map(([, record]) => record.id));
  const privatePatterns = records.filter(([, record]) => !publicIds.has(record.id)).map(([, record]) => new RegExp(`(?<![\\p{L}\\p{N}_-])${escapeRegex(record.id)}(?![\\p{L}\\p{N}_-])`, 'u'));
  const nodes: PublicNode[] = [], edges: PublicEdge[] = [];
  for (const [location, record] of records) {
    if (!publicIds.has(record.id)) continue;
    const node: Record<string, unknown> = {};
    for (const field of ['id', 'type', 'title', 'content', 'presentation'] as const) {
      if (Object.hasOwn(record, field)) node[field] = structuredClone(record[field]);
    }
    const props: Record<string, unknown> = {};
    node.properties = props;
    const sourceProps = (record.properties ?? {}) as Record<string, unknown>;
    for (const [field, definition] of Object.entries(propertySchemas[record.type])) {
      if (!Object.hasOwn(sourceProps, field)) continue;
      let value = structuredClone(sourceProps[field]);
      if (referenceType(definition)) {
        if (Array.isArray(value)) value = value.filter(id => publicIds.has(id));
        else if (!publicIds.has(value as string)) continue;
        for (const target of (Array.isArray(value) ? value : [value]) as string[]) edges.push({ source: record.id, field, target });
      }
      Object.defineProperty(props, field, { value, enumerable: true, writable: true, configurable: true });
    }
    for (const text of strings(node)) {
      if (privatePatterns.some(pattern => pattern.test(text))) throw new ExportError(`${location}: public text contains a private node ID; review before export`);
      for (const [, link] of text.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
        const target = link.split('|', 1)[0].split('#', 1)[0].trim();
        if (!publicIds.has(target)) throw new ExportError(`${location}: wiki link target is not public; review before export`);
      }
    }
    nodes.push(node as PublicNode);
  }
  const dataset: PublicDataset = {
    schemaVersion: SCHEMA_VERSION, nodes: nodes.sort((a, b) => compareText(a.id, b.id)),
    edges: edges.sort((a, b) => compareText(a.source, b.source) || compareText(a.field, b.field) || compareText(a.target, b.target)),
  };
  const publicErrors = publicDatasetErrors(dataset);
  if (publicErrors.length) throw new ExportError('Public contract validation failed:\n' + publicErrors.join('\n'));
  return dataset;
}
