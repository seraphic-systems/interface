import { validateRecords, exportRecords } from '@seraph-zero/core';
import type { NodeRecord, PublicDataset } from '@seraph-zero/core';
import type { PublicNode } from '@seraph-zero/core/contracts';

const node: NodeRecord = { id: 'v', type: 'Value', title: 'Care', properties: { statement: 'Care', kind: 'aspiration' } };
validateRecords([['adapter', node]]);
const dataset: PublicDataset = exportRecords([['adapter', node]]);
const visible: PublicNode | undefined = dataset.nodes[0];
void visible;

// @ts-expect-error Specialized records require their structured properties.
const incomplete: NodeRecord = { id: 'v', type: 'Value', title: 'Care' };
// @ts-expect-error Public datasets have a literal contract version.
const invalid: PublicDataset = { schemaVersion: 2, nodes: [], edges: [] };
void incomplete;
void invalid;
