import { Ajv2020 } from 'ajv/dist/2020.js';
import { fullFormats } from 'ajv-formats/dist/formats.js';
import type { ErrorObject } from 'ajv';
import type { NodeRecord } from '../contracts/source-nodes.js';
import { assertJSON, isObject } from './json.js';
import { nodeSchemas, propertySchemas, referenceType, schemas } from './schemas.js';

export type NodeEntry = readonly [location: string, record: NodeRecord];
export interface ValidationResult { records: NodeEntry[]; errors: string[] }

export function createValidator(): Ajv2020 {
  const ajv = new Ajv2020({ allErrors: true, strict: false, ownProperties: true, formats: fullFormats });
  ajv.addFormat('date', { type: 'string', validate: value => {
    if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  } });
  ajv.addKeyword({ keyword: 'x-node-type', schemaType: 'string', valid: true });
  return ajv;
}

const ajv = createValidator();
for (const [name, schema] of Object.entries(schemas)) ajv.addSchema(schema, name);
export const nodeValidators = Object.fromEntries(Object.entries(nodeSchemas).map(([name, schema]) => [name, ajv.compile<NodeRecord>(schema)]));
export const entryValidator = ajv.getSchema<NodeRecord>('node.schema.json')!;

export function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map(error => {
    const path = error.instancePath.split('/').slice(1).map(part => part.replace(/~1/g, '/').replace(/~0/g, '~')).join('.') || '$';
    return `${path}: ${error.message}`;
  });
}

export function graphErrors(records: Iterable<NodeEntry>): string[] {
  const errors: string[] = [];
  const byId = new Map<string, NodeEntry>();
  for (const [location, record] of records) {
    if (byId.has(record.id)) errors.push(`${location}: id: duplicate ${JSON.stringify(record.id)} (also ${byId.get(record.id)![0]})`);
    else byId.set(record.id, [location, record]);
  }
  for (const [location, record] of byId.values()) {
    const props = (record.properties ?? {}) as Record<string, unknown>;
    for (const [field, definition] of Object.entries(propertySchemas[record.type])) {
      if (!Object.hasOwn(props, field)) continue;
      const expected = referenceType(definition);
      if (!expected) continue;
      const targets = (definition.type === 'array' ? props[field] : [props[field]]) as string[];
      for (const id of targets) {
        const target = byId.get(id)?.[1];
        const label = `${location}: properties.${field}: ${JSON.stringify(id)}`;
        if (!target) errors.push(`${location}: properties.${field}: unresolved node ID ${JSON.stringify(id)}`);
        else if (expected !== 'Node' && target.type !== expected) errors.push(`${label} must be ${expected}, got ${target.type}`);
        else if (record.type === 'Bet' && field === 'guardrail_values' && (target.properties as Record<string, unknown>).kind !== 'guardrail') errors.push(`${label} must be a guardrail Value`);
        else if (record.type === 'Decision' && field === 'supersedes' && (target.properties as Record<string, unknown>).status !== 'superseded') errors.push(`${label} must have status superseded`);
      }
    }
  }
  for (const [type, field] of [['Bet', 'parent_bet'], ['Decision', 'supersedes']]) {
    const edges = new Map<string, string[]>();
    for (const [, record] of byId.values()) {
      if (record.type !== type) continue;
      const target = (record.properties as Record<string, unknown>)[field] ?? [];
      edges.set(record.id, typeof target === 'string' ? [target] : target as string[]);
    }
    const done = new Set<string>();
    for (const start of edges.keys()) {
      const active: string[] = [];
      const positions = new Map<string, number>();
      const stack: Array<[string, boolean]> = [[start, false]];
      while (stack.length) {
        const [current, leaving] = stack.pop()!;
        if (leaving) { positions.delete(current); active.pop(); done.add(current); }
        else if (positions.has(current)) errors.push(`${byId.get(current)![0]}: properties.${field}: cycle: ${[...active.slice(positions.get(current)), current].join(' -> ')}`);
        else if (!done.has(current) && edges.has(current)) {
          positions.set(current, active.length); active.push(current); stack.push([current, true]);
          for (const target of [...edges.get(current)!].reverse()) stack.push([target, false]);
        }
      }
    }
  }
  return errors;
}

export function validateRecords(source: Iterable<readonly [string, unknown]>): ValidationResult {
  const records: NodeEntry[] = [], errors: string[] = [];
  for (const [location, value] of source) {
    try { assertJSON(value); } catch (error) { errors.push(`${location}: ${(error as Error).message}`); continue; }
    if (!isObject(value) || typeof value.type !== 'string' || !Object.hasOwn(nodeValidators, value.type)) {
      errors.push(`${location}: type: expected one of ${Object.keys(nodeValidators).join(', ')}`); continue;
    }
    const validate = nodeValidators[value.type];
    if (validate(value)) records.push([location, value]);
    else errors.push(...formatErrors(validate.errors).map(message => `${location}: ${message}`));
  }
  errors.push(...graphErrors(records));
  if (!records.length && !errors.length) errors.push('no node records found');
  return { records, errors };
}
