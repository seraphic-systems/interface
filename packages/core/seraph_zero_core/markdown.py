"""Read Markdown storage into canonical node records without changing files."""

import json
import re

import yaml


class NodeLoader(yaml.SafeLoader):
    """Keep dates as strings, accept only true/false booleans, reject duplicate keys."""

    yaml_implicit_resolvers = {
        key: [(tag, pattern) for tag, pattern in entries
              if tag not in ('tag:yaml.org,2002:timestamp', 'tag:yaml.org,2002:bool')]
        for key, entries in yaml.SafeLoader.yaml_implicit_resolvers.items()
    }

    def construct_mapping(self, node, deep=False):
        result = {}
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            if not isinstance(key, str):
                raise ValueError('YAML object keys must be strings')
            if key in result:
                raise ValueError(f'duplicate YAML key: {key}')
            result[key] = self.construct_object(value_node, deep=deep)
        return result


NodeLoader.add_implicit_resolver(
    'tag:yaml.org,2002:bool', re.compile(r'^(?:true|false)$'), list('tf')
)


def load_record(path):
    lines = path.read_text(encoding='utf-8-sig').splitlines(keepends=True)
    if not lines or lines[0].strip() != '---':
        # Index pages document the schemas rather than representing nodes.
        if path.name == 'index.md':
            return None
        raise ValueError('missing opening YAML frontmatter delimiter (---)')
    end = next((i for i in range(1, len(lines)) if lines[i].strip() == '---'), None)
    if end is None:
        raise ValueError('missing closing YAML frontmatter delimiter (---)')
    record = yaml.load(''.join(lines[1:end]), Loader=NodeLoader)
    if not isinstance(record, dict):
        raise ValueError('frontmatter must be an object')
    if 'content' in record:
        raise ValueError('content belongs in the Markdown body, not frontmatter')
    record['content'] = ''.join(lines[end + 1:])
    # Reject YAML-only values (sets, binary), non-finite numbers and recursive aliases.
    json.dumps(record, allow_nan=False)
    return record


def load_directory(root):
    records, errors = [], []
    for path in sorted(root.rglob('*.md')):
        try:
            record = load_record(path)
        except (ValueError, TypeError, RecursionError, OSError, yaml.YAMLError) as exc:
            errors.append(f'{path}: {exc}')
            continue
        if record is not None:
            records.append((path, record))
    return records, errors
