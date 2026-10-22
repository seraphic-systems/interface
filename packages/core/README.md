# Seraph Zero core

`@seraph-zero/core` owns the node model, JSON schemas, validation, Markdown
storage adapter, and privacy-filtered public export. It is a TypeScript npm
workspace alongside the UI and does not need a content checkout to build or test.
Node.js 22.12 or newer is required.

## Install and use

From the application repo root:

```sh
npm ci
npm run build:core
npm run validate:nodes -- ../seraph-zero-nodes/nodes
npm run export:public -- ../seraph-zero-nodes/nodes --output /tmp/seraph-public/nodes.json
```

The installed CLI names are `seraph-validate`, `seraph-export`, and
`seraph-generate-contract`. Both data commands require an explicit complete
source directory. They never assume content lives inside the package. Export
writes JSON to stdout unless `--output` is supplied; use
`npm run --silent export:public -- <directory>` for clean JSON in shell pipelines,
or invoke `npx --no-install seraph-export <directory>` after building core.
Output must be a JSON file outside the source directory. Successful exports
atomically replace the whole snapshot; failed exports preserve the previous file.

## Package boundaries

```ts
// Browser-safe: no filesystem imports or private records.
import { validateRecords, publicDatasetErrors } from '@seraph-zero/core';
import type { NodeRecord, PublicDataset } from '@seraph-zero/core';

// Node.js only: Markdown files and publication snapshots.
import { validateDirectory, exportDirectory } from '@seraph-zero/core/node';
```

`validateRecords` accepts iterable `[location, record]` pairs and returns
`{ records, errors }`. Locations are diagnostic strings. `exportRecords` validates
and projects the same pairs, throwing `ExportError` on failure. A future SQLite
or Postgres adapter can supply those records without involving Markdown.
`parseMarkdownRecord` handles frontmatter without filesystem access; the Node.js
entry provides `loadRecord`, `validateDirectory`, and `exportDirectory`.

JSON schemas in [schemas/](schemas/README.md) remain authoritative. Source record
and public dataset TypeScript types in `contracts/` are generated from them.
Types describe field shapes; runtime validation enforces conditions, numeric
bounds, calendar dates, reference types, and graph invariants. Defaults are never
inserted and records are never mutated.

Markdown parsing retains the previous loader's YAML 1.1 numeric forms, string
dates, lowercase implicit booleans, and duplicate-key checks. Non-JSON YAML and
recursive aliases are rejected. Integers outside JavaScript's safe integer range
are rejected rather than rounded; alias expansion is bounded.

See the [model documentation](docs/model/index.md) and
[public contract](contracts/README.md). Only a trusted export process should read
the private collection. Browser assets receive only the successful filtered
snapshot. Public prose and assets still require human review.

## Develop

From the application repo root:

```sh
npm run test:core
npm run check:contracts
npm run generate:contracts
```

The generator rebuilds core before reading schemas and updates public JSON Schema,
public TypeScript types, and source-record TypeScript types. Commit those outputs
with schema, documentation, and test changes. Tests use a complete illustrative
collection from `docs/model`; the legacy public snapshot fixture was produced by
the original Python implementation. No private records are copied into tests.
