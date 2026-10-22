import schema0 from "../schemas/aim.schema.json" with { type: "json" };
import schema1 from "../schemas/assumption.schema.json" with { type: "json" };
import schema2 from "../schemas/bet.schema.json" with { type: "json" };
import schema3 from "../schemas/common.schema.json" with { type: "json" };
import schema4 from "../schemas/decision.schema.json" with { type: "json" };
import schema5 from "../schemas/node.schema.json" with { type: "json" };
import schema6 from "../schemas/outcome.schema.json" with { type: "json" };
import schema7 from "../schemas/playbook.schema.json" with { type: "json" };
import schema8 from "../schemas/sensor.schema.json" with { type: "json" };
import schema9 from "../schemas/task.schema.json" with { type: "json" };
import schema10 from "../schemas/value.schema.json" with { type: "json" };

// The schema documents are the source of truth; this module only registers them.
export interface Schema {
  [keyword: string]: unknown;
  $ref?: string;
  type?: string;
  const?: string | number | boolean;
  enum?: unknown[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  oneOf?: Schema[];
  $defs?: Record<string, Schema>;
}

export const schemas = {
  "aim.schema.json": schema0,
  "assumption.schema.json": schema1,
  "bet.schema.json": schema2,
  "common.schema.json": schema3,
  "decision.schema.json": schema4,
  "node.schema.json": schema5,
  "outcome.schema.json": schema6,
  "playbook.schema.json": schema7,
  "sensor.schema.json": schema8,
  "task.schema.json": schema9,
  "value.schema.json": schema10,
} as unknown as Record<string, Schema>;
export const nodeSchemas = Object.fromEntries(
  schemas['node.schema.json'].oneOf!.map(branch => {
    const schema = branch.$ref ? schemas[branch.$ref] : branch;
    return [schema.properties!.type.const as string, schema];
  }),
);
export const propertySchemas = Object.fromEntries(
  Object.entries(nodeSchemas).map(([name, schema]) => [name, schema.properties!.properties?.properties ?? {}]),
);
export function referenceType(schema: Schema): string | undefined {
  return (schema.items ?? schema)['x-node-type'] as string | undefined;
}
