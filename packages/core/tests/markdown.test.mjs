import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMarkdownRecord } from '../dist/src/markdown.js';

const parse = text => parseMarkdownRecord(`---\nid: d\ntype: Node\ntitle: yes\n${text}---\nBody\n`);

test('frontmatter preserves dates, lowercase booleans and text without adding defaults', () => {
  const record = parse('properties:\n  date: 2026-10-20\n  flag: false\n');
  assert.equal(record.title, 'yes'); assert.equal(record.properties.date, '2026-10-20'); assert.equal(record.properties.flag, false);
  assert.equal(record.content, 'Body\n'); assert.ok(!Object.hasOwn(record, 'visibility'));
  for (const text of ['True', 'FALSE', 'on', 'off', 'yes', 'no']) assert.equal(parse(`properties:\n  flag: ${text}\n`).properties.flag, text);
});

test('rejects malformed frontmatter, duplicate keys, reserved content and non-JSON YAML', () => {
  for (const source of ['no frontmatter', '---\nid: d', '---\n- x\n---', '---\nid: a\nid: b\n---', '---\nproperties:\n  x: 1\n  x: 2\n---', '---\ncontent: forbidden\n---', '---\nx: .nan\n---', '---\n1: value\n---', '---\nx: &loop [*loop]\n---', '---\nx: !!binary SGk=\n---', '---\nx: !!set {a, b}\n---', '---\nx: !unknown value\n---', '---\nx: 9007199254740993\n---']) assert.throws(() => parseMarkdownRecord(source), Error, source);
});

test('handles BOM, universal newlines, no final newline and documentation', () => {
  assert.equal(parseMarkdownRecord('\uFEFF---\r\nid: x\r\ntype: Node\r\ntitle: X\r\n---\r\nBody').content, 'Body');
  assert.equal(parseMarkdownRecord('# Docs', 'index.md'), null);
  assert.throws(() => parseMarkdownRecord('---\nid: x', 'index.md'), /closing/);
});

test('preserves YAML 1.1 numeric forms, supports nonrecursive aliases and safe string keys', () => {
  assert.equal(parse('properties:\n  exponent: 1e3\n  leading: 08\n').properties.exponent, '1e3');
  assert.equal(parse('properties:\n  leading: 08\n').properties.leading, '08');
  assert.equal(parse('properties:\n  boolean: !!bool yes\n').properties.boolean, true);
  const record = parse('properties:\n  octal: 012\n  hex: 0x10\n  anchor: &label hello\n  alias: *label\n  __proto__: safe\n');
  assert.equal(record.properties.octal, 10); assert.equal(record.properties.hex, 16);
  assert.equal(record.properties.alias, 'hello'); assert.equal(Object.getPrototypeOf(record.properties), Object.prototype);
  assert.equal(Object.getOwnPropertyDescriptor(record.properties, '__proto__').value, 'safe');
});
