"""Publication boundary, standalone contract, and repeatable CLI export tests."""

import copy
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, FormatChecker

from seraph_zero_core.export_public_nodes import ExportError, export_directory, export_records, public_dataset_errors
from seraph_zero_core.generate_public_contract import build_schema, generated_files
from seraph_zero_core.validate_nodes import validate_directory
from seraph_zero_core.markdown import NodeLoader


MODEL = Path(__file__).resolve().parents[1] / 'docs/model'


class PublicExportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'nodes'
        self.root.mkdir()
        self.value = self.record('value-public', 'Value', {
            'statement': 'Care', 'kind': 'aspiration'}, public=True)
        self.hidden = self.record('value-secret', 'Value', {
            'statement': 'PRIVATE STATEMENT', 'kind': 'aspiration'})
        self.aim = self.record('aim-public', 'Aim', {
            'values': ['value-public', 'value-secret'], 'direction': 'Gather'}, public=True)
        self.write(self.value, self.hidden, self.aim)

    def record(self, node_id, node_type, properties, public=False):
        node = {'id': node_id, 'type': node_type, 'title': node_id,
                'properties': properties, 'content': 'Public prose.\n'}
        if public:
            node['visibility'] = 'public'
        return node

    def write(self, *records):
        for record in records:
            header = {key: value for key, value in record.items() if key != 'content'}
            (self.root / f'{record["id"]}.md').write_text(
                '---\n' + yaml.safe_dump(header, sort_keys=False) + '---\n' + record['content'],
                encoding='utf-8')

    def cli(self, *args):
        return subprocess.run([sys.executable, '-m', 'seraph_zero_core.export_public_nodes',
                               str(self.root), *map(str, args)], capture_output=True, text=True)

    def test_record_api_matches_markdown_export_without_mutating_input(self):
        records, errors = validate_directory(self.root)
        self.assertEqual(errors, [])
        original = copy.deepcopy(records)
        self.assertEqual(export_records(iter(records)), export_directory(self.root))
        self.assertEqual(records, original)
        records[0][1]['title'] = None
        with self.assertRaisesRegex(ExportError, 'Source validation failed'):
            export_records(records)

    def test_cli_requires_an_explicit_source_directory(self):
        result = subprocess.run(
            [sys.executable, '-m', 'seraph_zero_core.export_public_nodes'],
            cwd=self.temp.name, capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, '')

    def test_only_explicit_public_nodes_and_public_edges_are_exported(self):
        self.hidden['visibility'] = 'private'
        self.write(self.hidden)
        default_private = self.record('node-omitted', 'Node', {'note': 'PRIVATE NOTE'})
        self.write(default_private)
        dataset = export_directory(self.root)
        self.assertEqual([n['id'] for n in dataset['nodes']], ['aim-public', 'value-public'])
        self.assertEqual(dataset['nodes'][0]['properties']['values'], ['value-public'])
        self.assertEqual(dataset['edges'], [
            {'source': 'aim-public', 'field': 'values', 'target': 'value-public'}])
        encoded = json.dumps(dataset)
        for forbidden in ('value-secret', 'PRIVATE', 'visibility', str(self.root), 'node-omitted'):
            self.assertNotIn(forbidden, encoded)
        self.assertEqual(public_dataset_errors(dataset), [])

    def test_required_reference_lists_can_be_empty_in_public_projection(self):
        self.value.pop('visibility')
        self.write(self.value)
        dataset = export_directory(self.root)
        self.assertEqual(len(dataset['nodes']), 1)
        self.assertEqual(dataset['nodes'][0]['properties']['values'], [])
        self.assertEqual(dataset['edges'], [])
        self.assertEqual(public_dataset_errors(dataset), [])

    def test_private_scalar_references_are_removed(self):
        outcome = self.record('outcome-hidden', 'Outcome', {
            'values': ['value-secret'], 'signal': 'S', 'target': 'T', 'check_method': 'C'})
        bet = self.record('bet-hidden', 'Bet', {
            'outcome': 'outcome-hidden', 'expectation': 'E', 'confidence': 'low',
            'impact': 1, 'learning': 1, 'cost': 1, 'guardrail_risk': False,
            'status': 'active', 'stage': 'backlog'})
        task = self.record('task-public', 'Task', {
            'bet': 'bet-hidden', 'kind': 'build', 'owner': 'Tim', 'stage': 'backlog',
            'checklist': [{'text': 'Launch', 'done': False}]}, public=True)
        self.write(outcome, bet, task)
        dataset = export_directory(self.root)
        exported_task = next(n for n in dataset['nodes'] if n['type'] == 'Task')
        self.assertNotIn('bet', exported_task['properties'])
        bet['visibility'] = 'public'
        self.write(bet)
        dataset = export_directory(self.root)
        exported_bet = next(n for n in dataset['nodes'] if n['type'] == 'Bet')
        self.assertNotIn('outcome', exported_bet['properties'])
        self.assertIn({'source': 'task-public', 'field': 'bet', 'target': 'bet-hidden'}, dataset['edges'])

    def test_invalid_private_records_and_graphs_block_publication(self):
        for change in ('schema', 'graph', 'yaml'):
            with self.subTest(change=change):
                hidden = copy.deepcopy(self.hidden)
                if change == 'schema':
                    hidden['properties']['kind'] = 'invalid'
                    self.write(hidden)
                elif change == 'graph':
                    self.write(self.hidden)
                    self.aim['properties']['values'] = ['missing-value']
                    self.write(self.aim)
                else:
                    (self.root / 'broken.md').write_text('---\nid: x\nid: y\n---\n')
                with self.assertRaisesRegex(ExportError, 'Source validation failed'):
                    export_directory(self.root)

    def test_plain_node_custom_properties_are_not_published(self):
        node = self.record('node-public', 'Node', {
            'custom': {'pointer': 'value-secret', 'nested': [True, 'PRIVATE NOTE']}}, public=True)
        self.write(node)
        dataset = export_directory(self.root)
        exported = next(n for n in dataset['nodes'] if n['type'] == 'Node')
        self.assertEqual(exported['properties'], {})
        self.assertNotIn('PRIVATE NOTE', json.dumps(dataset))

    def test_text_review_blocks_known_private_ids_and_unknown_wiki_links(self):
        for field, text in [('content', 'See [[value-secret|Hidden label]].'),
                            ('content', 'See value-secret.'),
                            ('title', 'Notes on value-secret'),
                            ('content', 'See [[missing-node]].'),
                            ('presentation', {'cover': '/value-secret/image.jpg'}),
                            ('properties', {'statement': 'value-secret', 'kind': 'aspiration'})]:
            with self.subTest(field=field):
                node = copy.deepcopy(self.value)
                node[field] = text
                self.write(node)
                with self.assertRaisesRegex(ExportError, 'review before export'):
                    export_directory(self.root)
        self.value['content'] = 'See [[aim-public#heading|Gather]].\n'
        self.value['presentation'] = {'icon': '☀️', 'cover': 'https://example.com/approved.jpg'}
        self.write(self.value)
        exported = next(n for n in export_directory(self.root)['nodes'] if n['id'] == self.value['id'])
        self.assertEqual(exported['content'], self.value['content'])
        self.assertEqual(exported['presentation'], self.value['presentation'])

    def test_contract_rejects_unknown_fields_types_and_invalid_property_values(self):
        dataset = export_directory(self.root)
        changes = [lambda d: d.update(schemaVersion=2),
                   lambda d: d.update(sourcePath='/private/source'),
                   lambda d: d['nodes'][0].update(visibility='public'),
                   lambda d: d['nodes'][0].update(type='Unknown'),
                   lambda d: d['nodes'][0]['properties'].update(direction=3),
                   lambda d: d['nodes'][1]['properties'].update(kind='unknown'),
                   lambda d: d['nodes'][0]['properties'].update(extra=True)]
        for change in changes:
            broken = copy.deepcopy(dataset)
            change(broken)
            self.assertTrue(public_dataset_errors(broken))

    def test_collection_contract_checks_ids_targets_types_and_edge_equivalence(self):
        dataset = export_directory(self.root)
        changes = [lambda d: d['nodes'].append(copy.deepcopy(d['nodes'][0])),
                   lambda d: d['nodes'][0]['properties'].update(values=['missing']),
                   lambda d: d['nodes'][0]['properties'].update(values=['aim-public']),
                   lambda d: d.update(edges=[]),
                   lambda d: d['edges'].append({'source': 'value-secret', 'field': 'values',
                                               'target': 'value-public'}),
                   lambda d: d['edges'].append(copy.deepcopy(d['edges'][0]))]
        for change in changes:
            broken = copy.deepcopy(dataset)
            change(broken)
            self.assertTrue(public_dataset_errors(broken))

    def test_snapshot_replaces_removed_nodes_and_is_deterministic(self):
        destination = Path(self.temp.name) / 'dist/nodes.json'
        first = self.cli('--output', destination)
        self.assertEqual(first.returncode, 0, first.stderr)
        original = destination.read_bytes()
        self.assertEqual(self.cli('--output', destination).returncode, 0)
        self.assertEqual(destination.read_bytes(), original)
        self.assertEqual(self.cli().stdout.encode(), original)
        self.assertEqual(first.stdout, '')
        self.aim['visibility'] = self.value['visibility'] = 'private'
        self.write(self.aim, self.value)
        self.assertEqual(self.cli('--output', destination).returncode, 0)
        self.assertEqual(json.loads(destination.read_text()),
                         {'schemaVersion': 1, 'nodes': [], 'edges': []})
        self.assertEqual(list(destination.parent.glob('.public-nodes-*')), [])

    def test_failed_export_emits_no_json_and_preserves_last_successful_file(self):
        destination = Path(self.temp.name) / 'nodes.json'
        destination.write_text('last successful export')
        self.hidden['properties']['kind'] = 'invalid'
        self.write(self.hidden)
        for args in [(), ('--output', destination)]:
            result = self.cli(*args)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(result.stdout, '')
            self.assertIn('Source validation failed', result.stderr)
        self.assertEqual(destination.read_text(), 'last successful export')

    def test_cli_rejects_bad_directories_and_source_destinations(self):
        for destination in (self.root / 'output.json', self.root / 'value-public.md'):
            self.assertEqual(self.cli('--output', destination).returncode, 2)
        empty = Path(self.temp.name) / 'empty'
        empty.mkdir()
        for directory in (empty, empty / 'missing'):
            result = subprocess.run([sys.executable, '-m', 'seraph_zero_core.export_public_nodes',
                                     str(directory)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, '')

    def test_generated_contract_is_committed_current_and_standalone(self):
        schema = build_schema()
        Draft202012Validator.check_schema(schema)
        self.assertEqual(set(schema['$defs']) - {'PublicNode', 'PublicEdge'},
                         {'Node', 'Value', 'Aim', 'Outcome', 'Bet', 'Task',
                          'Assumption', 'Sensor', 'Playbook', 'Decision'})
        validator = Draft202012Validator(json.loads(json.dumps(schema)), format_checker=FormatChecker())
        self.assertEqual(list(validator.iter_errors(export_directory(self.root))), [])
        self.assertNotIn('common.schema.json', json.dumps(schema))
        for path, content in generated_files().items():
            self.assertEqual(path.read_text(), content, f'Regenerate {path}')

    def test_all_ten_documented_types_export_with_complete_source_graph(self):
        examples = []
        for path in MODEL.rglob('index.md'):
            for header, body in re.findall(r'```markdown\n---\n(.*?)\n---\n(.*?)```',
                                           path.read_text(), re.S):
                record = yaml.load(header, Loader=NodeLoader)
                if record['type'] not in build_schema()['$defs']:
                    continue
                record.update(content=body, visibility='public')
                examples.append(record)
        self.write(*examples)
        dataset = export_directory(self.root)
        self.assertEqual({node['type'] for node in dataset['nodes']},
                         {'Node', 'Value', 'Aim', 'Outcome', 'Bet', 'Task',
                          'Assumption', 'Sensor', 'Playbook', 'Decision'})
        self.assertEqual(public_dataset_errors(dataset), [])
        decision = next(node for node in dataset['nodes'] if node['type'] == 'Decision')
        decision['properties']['decided_on'] = '2026-02-30'
        self.assertTrue(public_dataset_errors(dataset))


if __name__ == '__main__':
    unittest.main()
