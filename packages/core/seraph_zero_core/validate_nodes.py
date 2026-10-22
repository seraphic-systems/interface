#!/usr/bin/env python3
"""Validate Markdown node records and relationships, without modifying files."""

import argparse
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

from .markdown import load_directory

PACKAGE = Path(__file__).resolve().parent
SCHEMAS = PACKAGE / 'schemas'



def schema_tools():
    resources = []
    schemas = {}
    for path in sorted(SCHEMAS.glob('*.schema.json')):
        schema = json.loads(path.read_text())
        Draft202012Validator.check_schema(schema)
        schemas[path.name] = schema
        resources.append((path.as_uri(), Resource.from_contents(schema)))
    registry = Registry().with_resources(resources)
    validators = {}
    property_schemas = {}
    for branch in schemas['node.schema.json']['oneOf']:
        if '$ref' in branch:
            filename = branch['$ref']
            schema = schemas[filename]
            name = schema['properties']['type']['const']
            property_schemas[name] = schema['properties']['properties']['properties']
            target = (SCHEMAS / filename).as_uri()
        else:
            name = 'Node'
            target = (SCHEMAS / 'node.schema.json').as_uri() + '#/oneOf/0'
        validators[name] = Draft202012Validator(
            {'$ref': target}, registry=registry, format_checker=FormatChecker()
        )
    return validators, property_schemas


def field_path(parts):
    return '.'.join(str(part) for part in parts) or '$'


def graph_errors(records, property_schemas):
    """Reference targets are declared in the schemas via x-node-type annotations."""
    errors = []
    by_id = {}
    for path, record in records:
        node_id = record['id']
        if node_id in by_id:
            errors.append(f'{path}: id: duplicate {node_id!r} (also {by_id[node_id][0]})')
        else:
            by_id[node_id] = (path, record)

    for path, record in records:
        props = record.get('properties', {})
        definitions = property_schemas.get(record['type'], {})
        for field, definition in definitions.items():
            if field not in props:
                continue
            item = definition.get('items', definition)
            expected = item.get('x-node-type')
            if expected is None:
                continue
            targets = props[field] if definition.get('type') == 'array' else [props[field]]
            for target_id in targets:
                location = f'{path}: properties.{field}'
                target = by_id.get(target_id)
                if target is None:
                    errors.append(f'{location}: unresolved node ID {target_id!r}')
                    continue
                target_record = target[1]
                if expected != 'Node' and target_record['type'] != expected:
                    errors.append(f'{location}: {target_id!r} must be {expected}, '
                                  f"got {target_record['type']}")
                elif record['type'] == 'Bet' and field == 'guardrail_values':
                    if target_record['properties']['kind'] != 'guardrail':
                        errors.append(f'{location}: {target_id!r} must be a guardrail Value')
                elif record['type'] == 'Decision' and field == 'supersedes':
                    if target_record['properties']['status'] != 'superseded':
                        errors.append(f'{location}: {target_id!r} must have status superseded')

    # Only the two recursive relationships are hierarchical. related_nodes can cycle.
    for node_type, field in [('Bet', 'parent_bet'), ('Decision', 'supersedes')]:
        edges = {}
        for node_id, (_, record) in by_id.items():
            if record['type'] == node_type:
                value = record['properties'].get(field, [])
                edges[node_id] = [value] if isinstance(value, str) else value
        done = set()
        for start in edges:
            if start in done:
                continue
            active = []
            positions = {}
            stack = [(start, False)]
            while stack:
                current, leaving = stack.pop()
                if leaving:
                    positions.pop(current)
                    active.pop()
                    done.add(current)
                elif current in positions:
                    cycle = active[positions[current]:] + [current]
                    errors.append(f'{by_id[current][0]}: properties.{field}: cycle: '
                                  + ' -> '.join(cycle))
                elif current not in done and current in edges:
                    positions[current] = len(active)
                    active.append(current)
                    stack.append((current, True))
                    stack.extend((target, False) for target in reversed(edges[current]))
    return errors


def validate_records(source_records):
    """Validate (location, record) pairs from any storage adapter."""
    validators, property_schemas = schema_tools()
    records, errors = [], []
    for path, record in source_records:
        node_type = record.get('type')
        if not isinstance(node_type, str) or node_type not in validators:
            errors.append(f'{path}: type: expected one of {", ".join(validators)}; got {node_type!r}')
            continue
        failures = sorted(validators[node_type].iter_errors(record),
                          key=lambda error: field_path(error.absolute_path))
        for error in failures:
            errors.append(f'{path}: {field_path(error.absolute_path)}: {error.message}')
        if not failures:
            records.append((path, record))
    errors.extend(graph_errors(records, property_schemas))
    if not records and not errors:
        errors.append('no node records found')
    return records, errors


def validate_directory(root):
    """Load Markdown storage, then validate its canonical records."""
    loaded, load_errors = load_directory(root)
    records, errors = validate_records(loaded)
    return records, load_errors + errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path, help='complete Markdown node directory')
    args = parser.parse_args()
    if not args.directory.is_dir():
        parser.error(f'not a directory: {args.directory}')
    records, errors = validate_directory(args.directory)
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        print(f'Validation failed: {len(errors)} error(s).', file=sys.stderr)
        return 1
    print(f'Validated {len(records)} nodes.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
