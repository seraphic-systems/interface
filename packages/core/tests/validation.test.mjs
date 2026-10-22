import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateRecords, graphErrors, entryValidator } from '../dist/src/index.js';
import { nodeValidators } from '../dist/src/validation.js';
import { validateDirectory } from '../dist/src/node.js';
import { examples, example, entries, temp, cli } from './helpers.mjs';

const invalid = (type, update) => {
  const record = example(type); update(record);
  assert.equal(nodeValidators[type](record), false, JSON.stringify(record));
};
const graph = (...records) => graphErrors(entries(records)).join('\n');

test('all ten documented types match the entry schema and form a valid collection', () => {
  assert.deepEqual(Object.keys(examples).sort(), Object.keys(nodeValidators).sort());
  assert.equal(Object.keys(examples).length, 10);
  for (const record of Object.values(examples)) assert.equal(entryValidator(record), true, JSON.stringify(entryValidator.errors));
  const result = validateRecords(entries(Object.values(examples)));
  assert.equal(result.records.length, 10); assert.deepEqual(result.errors, []);
});

test('base fields, unknown fields, nulls, visibility and presentation', () => {
  for (const type of Object.keys(examples)) for (const update of [r => delete r.id, r => r.typo = true, r => r.visibility = 'unlisted', r => r.title = null, r => r.presentation = { extra: true }]) invalid(type, update);
});

test('plain Node accepts custom JSON properties and reserves base names', () => {
  const node = example('Node'); node.properties = { custom: { nested: [1, true, 'text'] } };
  assert.equal(nodeValidators.Node(node), true);
  node.properties.visibility = 'public'; assert.equal(nodeValidators.Node(node), false);
});

test('specialized properties are closed and required', () => {
  for (const type of Object.keys(examples).filter(type => type !== 'Node')) {
    invalid(type, r => r.properties.typo = true); invalid(type, r => delete r.properties);
  }
});

test('Task conditions and checklist fields', () => {
  for (const patch of [{ playbook: 'p' }, { bet: null }, { playbook_run: 'run' }, { checklist: [] }, { checklist: [{ text: 'step' }] }, { checklist: [{ text: 'step', done: 'false' }] }, { checklist: [{ text: 'step', done: false, child: 't' }] }]) invalid('Task', r => Object.assign(r.properties, patch));
  const task = example('Task'); delete task.properties.bet;
  assert.equal(nodeValidators.Task(task), false);
  Object.assign(task.properties, { playbook: 'p', playbook_run: 'run' }); assert.equal(nodeValidators.Task(task), true);
  delete task.properties.playbook_run; assert.equal(nodeValidators.Task(task), false);
});

test('Bet conditions, numeric bounds, integer types and enums', () => {
  for (const patch of [{ parent_bet: 'b' }, { impact: 0 }, { learning: 4 }, { cost: 1.5 }, { cost: true }, { stage: 'checked' }, { confidence: 'certain' }, { guardrail_risk: true }, { guardrail_risk: true, guardrail_values: [] }]) invalid('Bet', r => Object.assign(r.properties, patch));
  const bet = example('Bet'); delete bet.properties.outcome; assert.equal(nodeValidators.Bet(bet), false);
  Object.assign(bet.properties, { parent_bet: 'parent', stage: 'checked', observed_result: 'Evidence', surprise: 'as_expected' }); assert.equal(nodeValidators.Bet(bet), true);
});

test('Outcome needs Values or Aims and a sensor for transformations', () => {
  for (const patch of [{ values: [] }, { values: [], aims: [] }, { transformation: 'sum' }, { values: ['v', 'v'] }]) invalid('Outcome', r => Object.assign(r.properties, patch));
  const outcome = example('Outcome'); Object.assign(outcome.properties, { values: [], aims: ['a'], sensor: 's', transformation: 'sum' }); assert.equal(nodeValidators.Outcome(outcome), true);
});

test('Decision lifecycle, real calendar dates and meaningful text', () => {
  for (const patch of [{ status: 'accepted' }, { decided_on: '2026-10-20' }, { status: 'accepted', decided_on: '2026-02-30' }, { status: 'rejected', decided_on: '2026-10-20', supersedes: ['d'] }, { context: '   ' }, { consequences: ['  '] }, { alternatives: [{ option: 'x' }] }]) invalid('Decision', r => Object.assign(r.properties, patch));
  const decision = example('Decision'); Object.assign(decision.properties, { status: 'accepted', decided_on: '2026-10-20' }); assert.equal(nodeValidators.Decision(decision), true);
  for (const date of ['2024-02-29', '2000-02-29']) { decision.properties.decided_on = date; assert.equal(nodeValidators.Decision(decision), true); }
  for (const date of ['2025-02-29', '1900-02-29', '2026-13-01', '0000-01-01']) { decision.properties.decided_on = date; assert.equal(nodeValidators.Decision(decision), false, date); }
});

test('required lists and embedded templates', () => {
  invalid('Aim', r => r.properties.values = []);
  invalid('Playbook', r => r.properties.task_templates = []);
  invalid('Playbook', r => r.properties.task_templates[0].checklist = []);
  invalid('Playbook', r => r.properties.task_templates[0].extra = true);
});

test('references resolve to expected types and IDs are unique', () => {
  const value = example('Value'), aim = example('Aim');
  assert.equal(graph(value, aim), ''); assert.match(graph(aim), /unresolved/); assert.match(graph(value, value), /duplicate/);
  value.type = 'Node'; assert.match(graph(value, aim), /must be Value/);
  const decision = example('Decision'); decision.properties.related_nodes = [value.id, aim.id]; value.type = 'Value'; assert.equal(graph(value, aim, decision), '');
});

test('guardrail references require guardrail Values', () => {
  const bet = example('Bet'), value = example('Value'); bet.properties.guardrail_values = [value.id];
  assert.match(graph(bet, value), /guardrail Value/);
  value.properties.kind = 'guardrail'; assert.doesNotMatch(graph(bet, value), /guardrail Value/);
});

test('Bet parent chains allow valid ancestry and reject cycles and self references', () => {
  const a = example('Bet'), b = example('Bet'); delete a.properties.outcome; b.id = 'bet-parent'; a.properties.parent_bet = b.id;
  assert.doesNotMatch(graph(a, b), /cycle/);
  delete b.properties.outcome; b.properties.parent_bet = a.id; assert.match(graph(a, b), /cycle/);
  a.properties.parent_bet = a.id; assert.match(graph(a), /cycle/);
});

test('Decision supersession enforces statuses, cycles and shared ancestry', () => {
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(id => { const r = example('Decision'); r.id = id; Object.assign(r.properties, { status: 'superseded', decided_on: '2026-10-20', related_nodes: [] }); return r; });
  a.properties.supersedes = ['b', 'c']; b.properties.supersedes = c.properties.supersedes = ['d']; assert.equal(graph(a, b, c, d), '');
  d.properties.status = 'accepted'; assert.match(graph(a, b, c, d), /status superseded/);
  Object.assign(d.properties, { status: 'superseded', supersedes: ['a'] }); assert.match(graph(a, b, c, d), /cycle/);
});

test('documentation is skipped while empty directories and broken records fail', t => {
  const root = temp(t); writeFileSync(join(root, 'index.md'), '# Documentation');
  assert.match(validateDirectory(root).errors.join('\n'), /no node records/);
  writeFileSync(join(root, 'inbox.md'), 'Scratch notes'); assert.match(validateDirectory(root).errors.join('\n'), /inbox.md: missing opening/);
  writeFileSync(join(root, 'inbox.md'), '---\nid: node-inbox\ntype: Node\ntitle: Inbox\n---\nScratch notes');
  const result = validateDirectory(root); assert.deepEqual(result.errors, []); assert.equal(result.records[0][1].content, 'Scratch notes');
  writeFileSync(join(root, 'broken.md'), 'Missing delimiter'); assert.match(validateDirectory(root).errors.join('\n'), /broken.md/);
  writeFileSync(join(root, 'broken.md'), '---\nid: x\ntype: Unknown\ntitle: X\n---'); assert.match(validateDirectory(root).errors.join('\n'), /type: expected/);
  const command = cli('validate', [root]); assert.equal(command.status, 1); assert.match(command.stderr, /Validation failed/);
});

test('storage-independent API rejects non-JSON values without mutating records', () => {
  for (const bad of [undefined, NaN, Infinity, new Date(), new Set(), 1n, () => 1]) {
    const r = example('Node'); r.properties = { bad }; assert.ok(validateRecords([['adapter', r]]).errors.length);
  }
  const r = example('Node'); r.properties = {}; r.properties.loop = r;
  assert.match(validateRecords([['adapter', r]]).errors.join('\n'), /recursive/);
  for (const bad of [null, [], 'value', 1, { type: '__proto__' }]) assert.ok(validateRecords([['adapter', bad]]).errors.length);
});
