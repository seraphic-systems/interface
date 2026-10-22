# Seraph Zero core

This package owns the node model, schemas, validation, Markdown storage adapter,
and privacy-filtered public export. It ships with the UI in the interface repo;
it does not require a content checkout for installation or tests.

## Install and use

From the application repo root, with Python 3.10 or newer:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ./packages/core
seraph-validate ../seraph-zero-nodes/nodes
seraph-export ../seraph-zero-nodes/nodes --output /tmp/seraph-public/nodes.json
```

Both commands require an explicit complete source directory. They never assume
that content lives inside this package or relative to its installation path.
Export defaults to stdout when `--output` is omitted. Output files must be JSON
outside the source node directory; successful exports replace them atomically.

## Boundaries

- `seraph_zero_core/markdown.py` parses Markdown/YAML into canonical records.
- `validate_nodes.validate_records` checks `(location, record)` pairs from any
  adapter, including cross-record graph rules. Locations are diagnostic labels.
- `export_public_nodes.export_records` validates and projects those same pairs.
- `validate_directory` and `export_directory` wrap those operations for Markdown.
- Schemas and generated public contracts are bundled in the installed package.

A future SQLite or Postgres adapter can supply the same canonical record shape.
No database, web server, or storage write API is introduced here.

See the [model documentation](docs/model/index.md),
[source schema notes](seraph_zero_core/schemas/README.md), and
[public contract](seraph_zero_core/contracts/README.md).
Only a trusted export process may read the private collection. Browser assets
must contain only the filtered export, never the complete source collection.
Text and assets still need human review before publication.

## Develop

From the application repo root, after activating the virtual environment:

```sh
python -m unittest discover -s packages/core/tests -v
seraph-generate-contract --check
```

After a model change, run `seraph-generate-contract` to regenerate the bundled
JSON Schema and TypeScript declarations. Update the schemas, model documentation,
and tests together. The documentation examples form a complete illustrative test
collection; tests never copy private records from the content repo.

The frontend can import `PublicDataset` from
`packages/core/seraph_zero_core/contracts/public-nodes.d.ts` by a relative import.
This is a type contract; runtime validation still requires the JSON Schema.
