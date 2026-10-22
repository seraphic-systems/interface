"""Contract tests: documentation examples, invalid records and cross-file invariants."""

import copy
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, FormatChecker

from seraph_zero_core.validate_nodes import (
    SCHEMAS, graph_errors, schema_tools, validate_directory, validate_records,
)


from seraph_zero_core.markdown import NodeLoader, load_record

MODEL = Path(__file__).resolve().parents[1] / 'docs/model'


class ValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.validators, cls.property_schemas = schema_tools()
        cls.examples = {}
        for path in sorted(MODEL.rglob('index.md')):
            for block in re.findall(r'```markdown\n---\n(.*?)\n---\n(.*?)```', path.read_text(), re.S):
                record = yaml.load(block[0], Loader=NodeLoader)
                record['content'] = block[1]
                if record['type'] in cls.validators:
                    cls.examples[record['type']] = record

    def example(self, node_type):
        return copy.deepcopy(self.examples[node_type])

    def assert_invalid(self, node_type, update):
        record = self.example(node_type)
        update(record)
        self.assertTrue(list(self.validators[node_type].iter_errors(record)), record)

    def graph(self, *records):
        return graph_errors([(Path(f'{r["id"]}.md'), r) for r in records], self.property_schemas)

    def test_all_documented_examples_match_entry_schema(self):
        self.assertEqual(set(self.examples), set(self.validators))
        entry = Draft202012Validator(
            {'$ref': (SCHEMAS / 'node.schema.json').as_uri()},
            registry=self.validators['Node']._registry, format_checker=FormatChecker(),
        )
        for name, record in self.examples.items():
            with self.subTest(node_type=name):
                self.assertEqual(list(entry.iter_errors(record)), [])

    def test_documented_collection(self):
        records, errors = validate_records(list(self.examples.items()))
        self.assertTrue(records)
        self.assertEqual(errors, [])

    def test_base_fields_unknown_fields_and_nulls(self):
        for name in self.examples:
            for update in [lambda r: r.pop('id'), lambda r: r.update(typo=True),
                           lambda r: r.update(visibility='unlisted'),
                           lambda r: r.update(title=None),
                           lambda r: r.update(presentation={'extra':True})]:
                with self.subTest(node_type=name, update=update):
                    self.assert_invalid(name, update)

    def test_plain_node_allows_custom_properties_but_reserves_base_names(self):
        node = self.example('Node')
        node['properties'] = {'custom': {'nested': [1, True, 'text']}}
        self.assertEqual(list(self.validators['Node'].iter_errors(node)), [])
        node['properties']['visibility'] = 'public'
        self.assertTrue(list(self.validators['Node'].iter_errors(node)))

    def test_specialized_properties_are_closed(self):
        for name in set(self.examples) - {'Node'}:
            with self.subTest(node_type=name):
                self.assert_invalid(name, lambda r: r['properties'].update(typo=True))
                self.assert_invalid(name, lambda r: r.pop('properties'))

    def test_task_conditions_and_checklist(self):
        for patch in [{'playbook':'p'}, {'bet':None}, {'playbook_run':'run'},
                      {'checklist':[]}, {'checklist':[{'text':'step'}]},
                      {'checklist':[{'text':'step','done':'false'}]},
                      {'checklist':[{'text':'step','done':False,'child':'t'}]}]:
            with self.subTest(patch=patch):
                self.assert_invalid('Task', lambda r: r['properties'].update(patch))
        task = self.example('Task')
        task['properties'].pop('bet')
        self.assertTrue(list(self.validators['Task'].iter_errors(task)))
        task['properties'].update(playbook='p', playbook_run='run')
        self.assertEqual(list(self.validators['Task'].iter_errors(task)), [])
        task['properties'].pop('playbook_run')
        self.assertTrue(list(self.validators['Task'].iter_errors(task)))

    def test_bet_conditions_scores_and_enums(self):
        for patch in [{'parent_bet':'b'}, {'impact':0}, {'learning':4}, {'cost':1.5},
                      {'cost':True}, {'stage':'checked'}, {'confidence':'certain'},
                      {'guardrail_risk':True}, {'guardrail_risk':True,'guardrail_values':[]}]:
            with self.subTest(patch=patch):
                self.assert_invalid('Bet', lambda r: r['properties'].update(patch))
        bet = self.example('Bet')
        bet['properties'].pop('outcome')
        self.assertTrue(list(self.validators['Bet'].iter_errors(bet)))
        bet['properties'].update(parent_bet='parent', stage='checked',
                                 observed_result='Evidence', surprise='as_expected')
        self.assertEqual(list(self.validators['Bet'].iter_errors(bet)), [])

    def test_outcome_requires_values_or_aims_and_sensor_for_transformation(self):
        for patch in [{'values':[]}, {'values':[], 'aims':[]},
                      {'transformation':'sum'}, {'values':['v','v']}]:
            with self.subTest(patch=patch):
                self.assert_invalid('Outcome', lambda r: r['properties'].update(patch))
        outcome = self.example('Outcome')
        outcome['properties'].update(values=[], aims=['a'], sensor='s', transformation='sum')
        self.assertEqual(list(self.validators['Outcome'].iter_errors(outcome)), [])

    def test_decision_lifecycle_dates_and_meaningful_text(self):
        for patch in [{'status':'accepted'}, {'decided_on':'2026-10-20'},
                      {'status':'accepted', 'decided_on':'2026-02-30'},
                      {'status':'rejected','decided_on':'2026-10-20','supersedes':['d']},
                      {'context':'   '}, {'consequences':['  ']},
                      {'alternatives':[{'option':'x'}]}]:
            with self.subTest(patch=patch):
                self.assert_invalid('Decision', lambda r: r['properties'].update(patch))
        decision = self.example('Decision')
        decision['properties'].update(status='accepted', decided_on='2026-10-20')
        self.assertEqual(list(self.validators['Decision'].iter_errors(decision)), [])

    def test_required_lists_and_embedded_templates(self):
        self.assert_invalid('Aim', lambda r: r['properties'].update(values=[]))
        self.assert_invalid('Playbook', lambda r: r['properties'].update(task_templates=[]))
        self.assert_invalid('Playbook', lambda r: r['properties']['task_templates'][0].update(checklist=[]))
        self.assert_invalid('Playbook', lambda r: r['properties']['task_templates'][0].update(extra=True))

    def test_references_duplicates_and_types(self):
        value, aim = self.example('Value'), self.example('Aim')
        self.assertEqual(self.graph(value, aim), [])
        self.assertIn('unresolved', '\n'.join(self.graph(aim)))
        self.assertIn('duplicate', '\n'.join(self.graph(value, value)))
        value['type'] = 'Node'
        self.assertIn('must be Value', '\n'.join(self.graph(value, aim)))
        decision = self.example('Decision')
        decision['properties']['related_nodes'] = [value['id'], aim['id']]
        value['type'] = 'Value'
        self.assertEqual(self.graph(value, aim, decision), [])

    def test_guardrail_target_kind(self):
        bet, value = self.example('Bet'), self.example('Value')
        bet['properties'].update(guardrail_values=[value['id']])
        self.assertIn('guardrail Value', '\n'.join(self.graph(bet, value)))
        value['properties']['kind'] = 'guardrail'
        self.assertNotIn('guardrail Value', '\n'.join(self.graph(bet, value)))

    def test_bet_parent_cycles_and_valid_chain(self):
        a, b = self.example('Bet'), self.example('Bet')
        a['properties'].pop('outcome')
        a['properties']['parent_bet'] = b['id'] = 'bet-parent'
        self.assertNotIn('cycle', '\n'.join(self.graph(a,b)))
        b['properties'].pop('outcome')
        b['properties']['parent_bet'] = a['id']
        self.assertIn('cycle', '\n'.join(self.graph(a,b)))
        a['properties']['parent_bet'] = a['id']
        self.assertIn('cycle', '\n'.join(self.graph(a)))

    def test_supersession_status_cycles_and_shared_ancestor(self):
        a, b, c, d = [self.example('Decision') for _ in range(4)]
        for node, node_id in zip([a,b,c,d], ['a','b','c','d']):
            node['id'] = node_id
            node['properties'].update(status='superseded', decided_on='2026-10-20', related_nodes=[])
        a['properties']['supersedes'] = ['b','c']
        b['properties']['supersedes'] = c['properties']['supersedes'] = ['d']
        self.assertEqual(self.graph(a,b,c,d), [])
        d['properties']['status'] = 'accepted'
        self.assertIn('status superseded', '\n'.join(self.graph(a,b,c,d)))
        d['properties'].update(status='superseded', supersedes=['a'])
        self.assertIn('cycle', '\n'.join(self.graph(a,b,c,d)))

    def test_frontmatter_parsing(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'record.md'
            path.write_text('---\nid: d\ntype: Node\ntitle: yes\nproperties:\n  date: 2026-10-20\n  flag: false\n---\nBody\n')
            record = load_record(path)
            self.assertEqual(record['title'], 'yes')
            self.assertEqual(record['properties']['date'], '2026-10-20')
            self.assertIs(record['properties']['flag'], False)
            self.assertEqual(record['content'], 'Body\n')
            self.assertNotIn('visibility', record)  # Validation does not apply defaults.
            for source in ['no frontmatter', '---\nid: d', '---\n- x\n---',
                           '---\nid: a\nid: b\n---', '---\nproperties:\n  x: 1\n  x: 2\n---',
                           '---\ncontent: forbidden\n---', '---\nx: .nan\n---',
                           '---\n1: value\n---', '---\nx: &loop [*loop]\n---']:
                with self.subTest(source=source):
                    path.write_text(source)
                    with self.assertRaises((ValueError, yaml.YAMLError)):
                        load_record(path)

    def test_documentation_skipped_but_broken_records_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'index.md').write_text('# Documentation')
            _, errors = validate_directory(root)
            self.assertIn('no node records', '\n'.join(errors))
            inbox = root / 'inbox.md'
            inbox.write_text('Scratch notes')
            _, errors = validate_directory(root)
            self.assertIn('inbox.md: missing opening YAML frontmatter', '\n'.join(errors))
            inbox.write_text('---\nid: node-inbox\ntype: Node\ntitle: Inbox\n---\nScratch notes')
            records, errors = validate_directory(root)
            self.assertEqual(errors, [])
            self.assertEqual(len(records), 1)
            self.assertEqual(records[0][1]['content'], 'Scratch notes')
            (root / 'broken.md').write_text('Missing delimiter')
            _, errors = validate_directory(root)
            self.assertIn('broken.md', '\n'.join(errors))
            (root / 'broken.md').write_text('---\nid: x\ntype: Unknown\ntitle: X\n---')
            _, errors = validate_directory(root)
            self.assertIn('type: expected', '\n'.join(errors))
            result = subprocess.run([sys.executable, '-m', 'seraph_zero_core.validate_nodes', str(root)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertIn('Validation failed', result.stderr)


if __name__ == '__main__':
    unittest.main()
