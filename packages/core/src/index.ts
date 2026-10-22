/** Browser-safe record APIs. Filesystem access and CLIs live under ./node. */
export { validateRecords, graphErrors, entryValidator } from './validation.js';
export type { NodeEntry, ValidationResult } from './validation.js';
export { exportRecords, publicDatasetErrors, ExportError } from './projection.js';
export { parseMarkdownRecord, parseFrontmatter } from './markdown.js';
export { buildPublicSchema, SCHEMA_VERSION } from './contract.js';
export type { NodeRecord, JSONValue } from '../contracts/source-nodes.js';
export type { PublicDataset, PublicNode, PublicEdge } from '../contracts/public-nodes.js';
