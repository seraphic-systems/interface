import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { exportRecords, publicDatasetErrors, buildPublicSchema, ExportError } from '../dist/src/index.js';
import { exportDirectory, validateDirectory } from '../dist/src/node.js';
import { sortedJSON } from '../dist/src/json.js';
import { generatedContracts } from '../dist/src/contract.js';
import { publicFixture, record, write, cli, examples, entries, core } from './helpers.mjs';

test('record API matches Markdown export without mutating input', t => {
  const f = publicFixture(t); const { records, errors } = validateDirectory(f.root); assert.deepEqual(errors, []);
  const original = structuredClone(records); assert.deepEqual(exportRecords(records.values()), exportDirectory(f.root)); assert.deepEqual(records, original);
  records[0][1].title = null; assert.throws(() => exportRecords(records), /Source validation failed/);
});

test('only explicitly public nodes and public references produce nodes and edges', t => {
  const f = publicFixture(t); f.hidden.visibility = 'private'; write(f.root, f.hidden, record('node-omitted', 'Node', { note: 'PRIVATE NOTE' }));
  const dataset = exportDirectory(f.root);
  assert.deepEqual(dataset.nodes.map(n => n.id), ['aim-public', 'value-public']);
  assert.deepEqual(dataset.nodes[0].properties.values, ['value-public']);
  assert.deepEqual(dataset.edges, [{ source: 'aim-public', field: 'values', target: 'value-public' }]);
  for (const forbidden of ['value-secret', 'PRIVATE', 'visibility', f.root, 'node-omitted']) assert.ok(!JSON.stringify(dataset).includes(forbidden));
  assert.deepEqual(publicDatasetErrors(dataset), []);
});

test('required reference lists may become empty in the public projection', t => {
  const f = publicFixture(t); delete f.value.visibility; write(f.root, f.value);
  const dataset = exportDirectory(f.root);
  assert.equal(dataset.nodes.length, 1); assert.deepEqual(dataset.nodes[0].properties.values, []); assert.deepEqual(dataset.edges, []); assert.deepEqual(publicDatasetErrors(dataset), []);
});

test('private scalar references are removed without removing public relationships', t => {
  const f = publicFixture(t);
  const outcome = record('outcome-hidden', 'Outcome', { values: ['value-secret'], signal: 'S', target: 'T', check_method: 'C' });
  const bet = record('bet-hidden', 'Bet', { outcome: outcome.id, expectation: 'E', confidence: 'low', impact: 1, learning: 1, cost: 1, guardrail_risk: false, status: 'active', stage: 'backlog' });
  const task = record('task-public', 'Task', { bet: bet.id, kind: 'build', owner: 'Tim', stage: 'backlog', checklist: [{ text: 'Launch', done: false }] }, true);
  write(f.root, outcome, bet, task);
  assert.ok(!('bet' in exportDirectory(f.root).nodes.find(n => n.type === 'Task').properties));
  bet.visibility = 'public'; write(f.root, bet); const dataset = exportDirectory(f.root);
  assert.ok(!('outcome' in dataset.nodes.find(n => n.type === 'Bet').properties));
  assert.ok(dataset.edges.some(edge => edge.source === task.id && edge.field === 'bet' && edge.target === bet.id));
});

test('invalid private schemas, references and YAML block publication', t => {
  const f = publicFixture(t);
  f.hidden.properties.kind = 'invalid'; write(f.root, f.hidden); assert.throws(() => exportDirectory(f.root), /Source validation failed/);
  f.hidden.properties.kind = 'aspiration'; f.aim.properties.values = ['missing-value']; write(f.root, f.hidden, f.aim); assert.throws(() => exportDirectory(f.root), /Source validation failed/);
  f.aim.properties.values = ['value-public']; write(f.root, f.aim); writeFileSync(join(f.root, 'broken.md'), '---\nid: x\nid: y\n---\n'); assert.throws(() => exportDirectory(f.root), /Source validation failed/);
});

test('plain Node custom properties never enter the public projection', t => {
  const f = publicFixture(t); write(f.root, record('node-public', 'Node', { custom: { pointer: 'value-secret', nested: [true, 'PRIVATE NOTE'] } }, true));
  const dataset = exportDirectory(f.root); assert.deepEqual(dataset.nodes.find(n => n.type === 'Node').properties, {}); assert.ok(!JSON.stringify(dataset).includes('PRIVATE NOTE'));
});

test('privacy review detects private IDs and unknown wiki links across every exported text field', t => {
  const f = publicFixture(t);
  for (const [field, text] of [
    ['content', 'See [[value-secret|Hidden label]].'], ['content', 'See value-secret.'], ['title', 'Notes on value-secret'], ['content', 'See [[missing-node]].'], ['presentation', { cover: '/value-secret/image.jpg' }], ['properties', { statement: 'value-secret', kind: 'aspiration' }],
  ]) { const node = structuredClone(f.value); node[field] = text; write(f.root, node); assert.throws(() => exportDirectory(f.root), /review before export/); }
  f.value.content = 'See [[aim-public#heading|Gather]].\n'; f.value.presentation = { icon: '☀️', cover: 'https://example.com/approved.jpg' }; write(f.root, f.value);
  const exported = exportDirectory(f.root).nodes.find(n => n.id === f.value.id); assert.equal(exported.content, f.value.content); assert.deepEqual(exported.presentation, f.value.presentation);
});

test('privacy ID boundaries include Unicode letters and regex punctuation', () => {
  const hidden = record('secret.(id)', 'Node', {});
  const visible = record('public', 'Node', {}, true);
  for (const text of ['secret.(id)', '(secret.(id))', 'a secret.(id) b']) { visible.content = text; assert.throws(() => exportRecords(entries([hidden, visible])), /review before export/); }
  for (const text of ['αsecret.(id)β', 'secretX(id)', 'prefix-secret.(id)']) { visible.content = text; assert.doesNotThrow(() => exportRecords(entries([hidden, visible]))); }
});

test('public contract rejects unknown fields, types and invalid property values', t => {
  const f = publicFixture(t), dataset = exportDirectory(f.root);
  for (const update of [d => d.schemaVersion = 2, d => d.sourcePath = '/private/source', d => d.nodes[0].visibility = 'public', d => d.nodes[0].type = 'Unknown', d => d.nodes[0].properties.direction = 3, d => d.nodes[1].properties.kind = 'unknown', d => d.nodes[0].properties.extra = true]) {
    const broken = structuredClone(dataset); update(broken); assert.ok(publicDatasetErrors(broken).length);
  }
});

test('public collection checks duplicates, missing or mistyped targets and exact edges', t => {
  const f = publicFixture(t), dataset = exportDirectory(f.root);
  for (const update of [d => d.nodes.push(structuredClone(d.nodes[0])), d => d.nodes[0].properties.values = ['missing'], d => d.nodes[0].properties.values = ['aim-public'], d => d.edges = [], d => d.edges.push({ source: 'value-secret', field: 'values', target: 'value-public' }), d => d.edges.push(structuredClone(d.edges[0]))]) {
    const broken = structuredClone(dataset); update(broken); assert.ok(publicDatasetErrors(broken).length);
  }
});

test('CLI export is deterministic and replaces removed nodes including an empty public set', t => {
  const f = publicFixture(t), destination = join(f.directory, 'dist/nodes.json');
  const args = [f.root, '--output', destination]; const first = cli('export', args); assert.equal(first.status, 0, first.stderr); assert.equal(first.stdout, '');
  const original = readFileSync(destination, 'utf8'); assert.equal(cli('export', args).status, 0); assert.equal(readFileSync(destination, 'utf8'), original); assert.equal(cli('export', [f.root]).stdout, original);
  f.aim.visibility = f.value.visibility = 'private'; write(f.root, f.aim, f.value); assert.equal(cli('export', args).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(destination, 'utf8')), { schemaVersion: 1, nodes: [], edges: [] }); assert.deepEqual(readdirSync(join(f.directory, 'dist')).filter(name => name.startsWith('.public-nodes-')), []);
});

test('failed CLI export emits no JSON and preserves the previous successful file', t => {
  const f = publicFixture(t), destination = join(f.directory, 'nodes.json'); writeFileSync(destination, 'last successful export');
  f.hidden.properties.kind = 'invalid'; write(f.root, f.hidden);
  for (const args of [[f.root], [f.root, '--output', destination]]) {
    const result = cli('export', args); assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.match(result.stderr, /Source validation failed/);
  }
  assert.equal(readFileSync(destination, 'utf8'), 'last successful export');
});

test('CLI requires source, rejects invalid directories and output paths including symlinks', t => {
  const f = publicFixture(t);
  for (const args of [[], [f.root, '--unknown'], [join(f.root, 'missing')], [f.root, '--output', join(f.root, 'output.json')], [f.root, '--output', join(f.directory, 'value-public.md')]]) assert.equal(cli('export', args).status, 2);
  const empty = join(f.directory, 'empty'); mkdirSync(empty); const result = cli('export', [empty]); assert.equal(result.status, 1); assert.equal(result.stdout, '');
  const link = join(f.directory, 'source-link'); symlinkSync(f.root, link, 'dir'); assert.equal(cli('export', [f.root, '--output', join(link, 'nested/output.json')]).status, 2);
  assert.equal(cli('validate').status, 2);
});

test('write failures leave no partial snapshots or temporary directories', t => {
  const f = publicFixture(t), destination = join(f.directory, 'directory.json'); mkdirSync(destination);
  const result = cli('export', [f.root, '--output', destination]); assert.equal(result.status, 1); assert.equal(result.stdout, '');
  assert.deepEqual(readdirSync(f.directory).filter(name => name.startsWith('.public-nodes-')), []);
});

test('generated contracts are current and public JSON Schema is standalone', () => {
  const schema = buildPublicSchema(); assert.equal(Object.keys(schema.$defs).length, 12); assert.ok(!JSON.stringify(schema).includes('common.schema.json'));
  for (const [name, content] of Object.entries(generatedContracts())) assert.equal(readFileSync(join(core, 'contracts', name), 'utf8'), content, name);
  assert.equal(cli('generate', ['--check']).status, 0);
});

test('all ten documented types export with a complete public graph and match the Python snapshot', t => {
  const f = publicFixture(t);
  const all = Object.values(examples).map(record => ({ ...structuredClone(record), visibility: 'public' })); write(f.root, ...all);
  const dataset = exportDirectory(f.root); assert.equal(new Set(dataset.nodes.map(n => n.type)).size, 10); assert.deepEqual(publicDatasetErrors(dataset), []);
  const documented = exportRecords(entries(all));
  assert.equal(sortedJSON(documented), readFileSync(join(core, 'tests/fixtures/legacy-public.json'), 'utf8'));
  const decision = dataset.nodes.find(n => n.type === 'Decision'); decision.properties.decided_on = '2026-02-30'; assert.ok(publicDatasetErrors(dataset).length);
});
