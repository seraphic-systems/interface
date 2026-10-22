#!/usr/bin/env python3
"""Validate the complete source and export only the public node projection."""

import argparse
import copy
import json
import os
import re
import sys
import tempfile
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

from .generate_public_contract import VERSION, build_schema, reference_type
from .validate_nodes import field_path, schema_tools, validate_directory, validate_records

class ExportError(ValueError):
    pass


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for key, item in value.items():
            yield key
            yield from strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)


def public_dataset_errors(dataset):
    """Check both the standalone contract and collection-wide public invariants."""
    schema = build_schema()
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = [f'{field_path(error.absolute_path)}: {error.message}'
              for error in validator.iter_errors(dataset)]
    if errors:
        return errors
    by_id = {node['id']: node for node in dataset['nodes']}
    if len(by_id) != len(dataset['nodes']):
        errors.append('nodes: duplicate node IDs')
    expected_edges = set()
    for node in dataset['nodes']:
        definitions = schema['$defs'][node['type']]['properties']['properties']['properties']
        for field, value in node['properties'].items():
            definition = definitions[field]
            target_type = reference_type(definition)
            if not target_type:
                continue
            for target_id in value if isinstance(value, list) else [value]:
                target = by_id.get(target_id)
                if target is None:
                    errors.append(f'{node["id"]}.{field}: target is not in public dataset')
                elif target_type != 'Node' and target['type'] != target_type:
                    errors.append(f'{node["id"]}.{field}: expected target type {target_type}')
                expected_edges.add((node['id'], field, target_id))
    actual_edges = {(edge['source'], edge['field'], edge['target']) for edge in dataset['edges']}
    if actual_edges != expected_edges:
        errors.append('edges: must exactly match the public structured references')
    return errors


def export_records(source_records):
    """Validate and project canonical records supplied by any storage adapter."""
    records, errors = validate_records(source_records)
    if errors:
        raise ExportError('Source validation failed:\n' + '\n'.join(errors))
    _, property_schemas = schema_tools()
    public_ids = {record['id'] for _, record in records if record.get('visibility') == 'public'}
    private_ids = {record['id'] for _, record in records} - public_ids
    private_patterns = [re.compile(r'(?<![\w-])' + re.escape(node_id) + r'(?![\w-])')
                        for node_id in sorted(private_ids)]
    nodes, edges = [], []
    for path, record in records:
        if record['id'] not in public_ids:
            continue
        node = {key: copy.deepcopy(record[key]) for key in
                ('id', 'type', 'title', 'content', 'presentation') if key in record}
        node['properties'] = {}
        for field, definition in property_schemas.get(record['type'], {}).items():
            if field not in record.get('properties', {}):
                continue
            value = copy.deepcopy(record['properties'][field])
            if reference_type(definition):
                if isinstance(value, list):
                    value = [target for target in value if target in public_ids]
                elif value not in public_ids:
                    continue
                for target in value if isinstance(value, list) else [value]:
                    edges.append({'source': node['id'], 'field': field, 'target': target})
            node['properties'][field] = value
        # Never silently rewrite prose: reject detectable leaks and let the author
        # edit the public text. This also inspects titles and presentation strings.
        for text in strings(node):
            if any(pattern.search(text) for pattern in private_patterns):
                raise ExportError(f'{path}: public text contains a private node ID; review before export')
            for link in re.findall(r'\[\[([^\]\n]+)\]\]', text):
                target = link.split('|', 1)[0].split('#', 1)[0].strip()
                if target not in public_ids:
                    raise ExportError(f'{path}: wiki link target is not public; review before export')
        nodes.append(node)
    dataset = {'schemaVersion': VERSION, 'nodes': sorted(nodes, key=lambda node: node['id']),
               'edges': sorted(edges, key=lambda edge: (edge['source'], edge['field'], edge['target']))}
    errors = public_dataset_errors(dataset)
    if errors:
        raise ExportError('Public contract validation failed:\n' + '\n'.join(errors))
    return dataset


def export_directory(root):
    records, errors = validate_directory(root)
    if errors:
        raise ExportError('Source validation failed:\n' + '\n'.join(errors))
    return export_records(records)


def write_dataset(destination, content):
    """Replace the whole snapshot atomically; no partial or appended exports."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=destination.parent,
                                         prefix='.public-nodes-', delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(content)
        os.replace(temporary, destination)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path, help='complete Markdown node directory')
    parser.add_argument('-o', '--output', type=Path, help='JSON destination; default: stdout')
    args = parser.parse_args()
    if not args.directory.is_dir():
        parser.error(f'not a directory: {args.directory}')
    if args.output and (args.output.suffix != '.json' or
                        args.output.resolve().is_relative_to(args.directory.resolve())):
        parser.error('output must be a .json file outside the source node directory')
    try:
        dataset = export_directory(args.directory)
        content = json.dumps(dataset, indent=2, ensure_ascii=False, sort_keys=True, allow_nan=False) + '\n'
        if args.output:
            write_dataset(args.output, content)
        else:
            sys.stdout.write(content)
    except (ExportError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
